/** Non-secret local target storage. */
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { RemoteEndpoint, RemoteTarget } from './types.ts'

const KEY = /^[A-Za-z0-9_-]{1,64}$/u
const ALIAS = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/u

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Reject extra fields so callers cannot persist credentials in a target record. */
export function parseTarget(value: unknown): RemoteTarget {
  if (!record(value) || Object.keys(value).sort().join(',')
    !== 'endpoints,id,instanceId,instanceKey,name,profile,remotePort,workspaceHint') {
    throw new Error('remote-workspace: invalid target fields')
  }
  for (const key of ['id', 'instanceKey'] as const) {
    if (typeof value[key] !== 'string' || !KEY.test(value[key])) throw new Error(`remote-workspace: invalid ${key}`)
  }
  for (const key of ['name', 'instanceId', 'profile', 'workspaceHint'] as const) {
    if (typeof value[key] !== 'string' || value[key].length > 4096
      || (key !== 'workspaceHint' && value[key].length === 0)) throw new Error(`remote-workspace: invalid ${key}`)
  }
  if (!Number.isInteger(value.remotePort) || (value.remotePort as number) < 1 || (value.remotePort as number) > 65535) {
    throw new Error('remote-workspace: invalid remotePort')
  }
  if (!Array.isArray(value.endpoints) || value.endpoints.length < 1 || value.endpoints.length > 3) {
    throw new Error('remote-workspace: invalid endpoints')
  }
  const ids = new Set<string>()
  const endpoints = value.endpoints.map((entry: unknown): RemoteEndpoint => {
    if (!record(entry) || Object.keys(entry).sort().join(',') !== 'id,kind,sshAlias'
      || typeof entry.id !== 'string' || !KEY.test(entry.id) || ids.has(entry.id)
      || !['lan', 'frp-tcp', 'stcp'].includes(String(entry.kind))
      || typeof entry.sshAlias !== 'string' || !ALIAS.test(entry.sshAlias)) {
      throw new Error('remote-workspace: invalid endpoint')
    }
    ids.add(entry.id)
    return { id: entry.id, kind: entry.kind as RemoteEndpoint['kind'], sshAlias: entry.sshAlias }
  })
  return {
    id: value.id as string, name: value.name as string, instanceKey: value.instanceKey as string,
    instanceId: value.instanceId as string, profile: value.profile as string,
    workspaceHint: value.workspaceHint as string, remotePort: value.remotePort as number, endpoints,
  }
}

/** Owns only non-sensitive target JSON beneath the current DSH home. */
export class TargetStore {
  constructor(private readonly file: string) {}

  /** @returns validated records from the current file. */
  async list(): Promise<RemoteTarget[]> {
    let raw: string
    try { raw = await readFile(this.file, 'utf8') } catch (error) {
      if (record(error) && error.code === 'ENOENT') return []
      throw error
    }
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length > 100) throw new Error('remote-workspace: invalid target file')
    return parsed.map(parseTarget)
  }

  /** @param value - full validated replacement target. @returns saved records. */
  async save(value: unknown): Promise<RemoteTarget[]> {
    const target = parseTarget(value)
    const targets = await this.list()
    const existing = targets.findIndex(item => item.id === target.id)
    if (existing < 0) targets.push(target)
    else targets[existing] = target
    await mkdir(dirname(this.file), { recursive: true })
    const temporary = `${this.file}.${randomUUID()}.tmp`
    await writeFile(temporary, JSON.stringify(targets, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
    await rename(temporary, this.file)
    return targets
  }
}

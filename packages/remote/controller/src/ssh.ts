/** Plugin-owned OpenSSH processes. Aliases and the fixed helper path are the only remote inputs. */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createConnection, createServer } from 'node:net'
import type { DiscoveredTarget, RemoteDescriptor } from './types.ts'

const SSH_OPTIONS = [
  '-T', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes',
  '-o', 'ForwardAgent=no', '-o', 'ForwardX11=no', '-o', 'PermitLocalCommand=no',
  '-o', 'ControlMaster=no', '-o', 'ControlPath=none', '-o', 'ConnectTimeout=15',
  '-o', 'ServerAliveInterval=10', '-o', 'ServerAliveCountMax=3',
] as const

function validAlias(alias: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/u.test(alias)
}

function validHelperPath(path: string): boolean {
  return /^\/(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+$/u.test(path)
}

function childExit(child: ChildProcessWithoutNullStreams): Promise<number | null> {
  return new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('close', (code) =>{  resolve(code) })
  })
}

function descriptor(value: unknown): DiscoveredTarget {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('remote-workspace: invalid helper response')
  const row = value as Record<string, unknown>
  if (row.protocolVersion !== 1 || typeof row.instanceId !== 'string' || row.instanceId.length < 1
    || typeof row.bootId !== 'string' || row.bootId.length < 1
    || typeof row.instanceKey !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/u.test(row.instanceKey)
    || typeof row.profile !== 'string' || row.profile.length < 1 || row.profile.length > 4096
    || typeof row.workspaceHint !== 'string' || row.workspaceHint.length > 4096
    || typeof row.port !== 'number' || !Number.isInteger(row.port) || row.port < 1 || row.port > 65535) {
    throw new Error('remote-workspace: invalid helper response')
  }
  return { protocolVersion: 1, instanceId: row.instanceId, bootId: row.bootId,
    instanceKey: row.instanceKey, profile: row.profile, workspaceHint: row.workspaceHint, port: row.port }
}

/** Run the fixed helper over a separate non-interactive SSH process. */
export async function discover(alias: string, instanceKey: string, helperPath: string, signal: AbortSignal): Promise<RemoteDescriptor> {
  const value = await helper(alias, instanceKey, helperPath, signal, false)
  const info = descriptor(value)
  if (typeof value !== 'object' || value === null || !('launchUrl' in value) || typeof value.launchUrl !== 'string') {
    throw new Error('remote-workspace: invalid helper response')
  }
  return { ...info, launchUrl: value.launchUrl }
}

/** Read public instance facts over a host-key-verified SSH connection.
 * @param alias - configured OpenSSH alias. @param instanceKey - Companion key.
 * @param helperPath - fixed executable. @param signal - operation lifetime.
 * @returns identity and port with no launch credential.
 */
export async function discoverTarget(alias: string, instanceKey: string, helperPath: string, signal: AbortSignal): Promise<DiscoveredTarget> {
  const info = descriptor(await helper(alias, instanceKey, helperPath, signal, true))
  return { protocolVersion: info.protocolVersion, instanceKey: info.instanceKey, instanceId: info.instanceId,
    bootId: info.bootId, profile: info.profile, workspaceHint: info.workspaceHint, port: info.port }
}

async function helper(alias: string, instanceKey: string, helperPath: string, signal: AbortSignal, identityOnly: boolean): Promise<unknown> {
  signal.throwIfAborted()
  if (!validAlias(alias) || !/^[A-Za-z0-9_-]{1,64}$/u.test(instanceKey) || !validHelperPath(helperPath)) {
    throw new Error('remote-workspace: invalid SSH discovery configuration')
  }
  const child = spawn('ssh', [...SSH_OPTIONS, alias, helperPath, ...(identityOnly ? ['--identity'] : [])], { shell: false, windowsHide: true, stdio: 'pipe' })
  const stop = (): void => { child.kill() }
  signal.addEventListener('abort', stop, { once: true })
  let timedOut = false
  const timeout = setTimeout(() => { timedOut = true; stop() }, 20_000)
  let stdout = ''
  let oversized = false
  let stderr = ''
  child.stdout.setEncoding('utf8')
  child.stdout.on('data', (chunk: string) => {
    stdout += chunk
    if (Buffer.byteLength(stdout, 'utf8') > 65_536) { oversized = true; child.kill() }
  })
  child.stderr.setEncoding('utf8')
  child.stderr.on('data', (chunk: string) => { stderr = (stderr + chunk).slice(-8192) })
  child.stdin.on('error', () => { /* SSH exit is reported by childExit. */ })
  child.stdin.end(JSON.stringify({ protocolVersion: 1, instanceKey }) + '\n')
  try {
    const code = await childExit(child)
    signal.throwIfAborted()
    if (timedOut) throw new Error('remote-workspace: SSH_UNREACHABLE')
    // oxlint-disable-next-line typescript/no-unnecessary-condition -- stdout events can change this while childExit is pending.
    if (oversized || code !== 0) {
      // Remote shell statuses are stable across locales and describe the command, rather than SSH authentication.
      if (code === 126 || code === 127) throw new Error('remote-workspace: SSH_HELPER')
      if (/Host key verification failed|REMOTE HOST IDENTIFICATION HAS CHANGED/u.test(stderr)) throw new Error('remote-workspace: SSH_HOST_KEY')
      if (/Permission denied/u.test(stderr)) throw new Error('remote-workspace: SSH_AUTH')
      if (/Could not resolve hostname/u.test(stderr)) throw new Error('remote-workspace: SSH_ALIAS')
      if (/Connection refused|Connection timed out|No route to host/u.test(stderr)) throw new Error('remote-workspace: SSH_UNREACHABLE')
      if (/not found|No such file|BAD_INPUT|INFO_FAILED|CONFIG_REQUIRED|UNSAFE_PATH|UNSAFE_FILE|BAD_DESCRIPTOR|LINUX_REQUIRED/u.test(stderr)) {
        throw new Error('remote-workspace: SSH_HELPER')
      }
      throw new Error('remote-workspace: SSH helper failed')
    }
    try { return JSON.parse(stdout) as unknown } catch {
      throw new Error('remote-workspace: invalid helper response')
    }
  } finally {
    clearTimeout(timeout)
    signal.removeEventListener('abort', stop)
  }
}

async function freePort(): Promise<number> {
  const server = createServer()
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (typeof address !== 'object' || address === null) { server.close(); reject(new Error('remote-workspace: no local port')); return }
      server.close((error) => { if (error === undefined) resolve(address.port); else reject(error) })
    })
  })
}

async function canConnect(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host: '127.0.0.1', port })
    socket.once('connect', () => { socket.destroy(); resolve(true) })
    socket.once('error', () => { socket.destroy(); resolve(false) })
    socket.setTimeout(1000, () => { socket.destroy(); resolve(false) })
  })
}

/** One SSH local forward created by this plugin; stop never targets another process. */
export interface OwnedForward {
  readonly port: number
  readonly exited: Promise<number | null>
  stop(): Promise<void>
}

/** Create the sole local forward to a known remote loopback port. */
export async function forward(alias: string, remotePort: number, signal: AbortSignal): Promise<OwnedForward> {
  if (!validAlias(alias) || !Number.isInteger(remotePort) || remotePort < 1 || remotePort > 65535) {
    throw new Error('remote-workspace: invalid forward configuration')
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    signal.throwIfAborted()
    const port = await freePort()
    const child = spawn('ssh', [
      ...SSH_OPTIONS, '-o', 'ExitOnForwardFailure=yes', '-N',
      '-L', `127.0.0.1:${String(port)}:127.0.0.1:${String(remotePort)}`, alias,
    ], { shell: false, windowsHide: true, stdio: 'pipe' })
    child.stdout.resume()
    child.stderr.resume()
    child.stdin.end()
    const exited = childExit(child)
    let stopped = false
    const stop = async (): Promise<void> => {
      if (stopped) return
      stopped = true
      child.kill()
      await exited.catch(() => undefined)
    }
    const abort = (): void => { void stop() }
    signal.addEventListener('abort', abort, { once: true })
    let ready = false
    try {
      for (let poll = 0; poll < 30; poll++) {
        signal.throwIfAborted()
        if (await canConnect(port)) { ready = true; break }
        if (child.exitCode !== null) break
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      if (ready) {
        return { port, exited, stop: async () => {
          signal.removeEventListener('abort', abort)
          await stop()
        } }
      }
    } finally {
      if (!ready) { signal.removeEventListener('abort', abort); await stop() }
    }
  }
  throw new Error('remote-workspace: SSH forward unavailable')
}

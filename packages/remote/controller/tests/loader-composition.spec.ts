/** Desktop-side controller through the real Loader, Web server, Connection, and Typert HTTP route. */
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterEach, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Include from '@deepseek-ai/cordis-plugin-include'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import TypertGatewayService from '@deepseek-ai/dsh-api-gateway'
import RemoteAccessService from '@deepseek-ai/dsh-api-remote-access'
import * as ConnectionPlugin from '@deepseek-ai/dsh-client-connection'
import WebServer from '@deepseek-ai/dsh-host-webserver'
import TypertRegistry from '@deepseek-ai/dsh-typert-registry'
import RemoteWorkspaceController from '../src/index.ts'
import { authenticate, probeEventStream, readIdentity } from '../src/auth.ts'
import { UpstreamAuthRequired } from '../src/errors.ts'

let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
})

it('serves the controller state through authenticated Typert HTTP after Loader composition', async () => {
  const configPath = fileURLToPath(new URL('./fixtures/cordis.yml', import.meta.url))
  const ctx = new Context()
  context = ctx
  ctx.baseUrl = pathToFileURL(dirname(configPath)).href + '/'
  ctx.provide('profileContext', { home: join(tmpdir(), 'dsh-remote-loader-test'), name: 'desktop' } as never)
  const records = new Map<unknown, unknown>()
  ctx.provide('credentials', {
    async modifyRecord(key: unknown, mutate: (current: unknown) => Promise<unknown>): Promise<unknown> {
      const current = records.get(key)
      const next = await mutate(current)
      if (next !== undefined) records.set(key, next)
      return next ?? current
    },
  } as never)
  await ctx.plugin(Loader)
  ctx.loader.builtins.include = Include
  const modules = new Map<string, unknown>([
    ['@deepseek-ai/dsh-host-webserver', WebServer],
    ['@deepseek-ai/dsh-typert-registry', TypertRegistry],
    ['@deepseek-ai/dsh-api-gateway', TypertGatewayService],
    ['@deepseek-ai/dsh-api-remote-access', RemoteAccessService],
    ['@deepseek-ai/dsh-client-connection', ConnectionPlugin],
    ['@harness-remote/controller', RemoteWorkspaceController],
  ])
  ctx.loader.internal = {
    version: 'v2',
    async import(specifier: string) {
      if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
      return modules.get(specifier)
    },
  } as unknown as NonNullable<typeof ctx.loader.internal>
  await ctx.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(configPath).href } })
  await ctx.loader.await()

  // Every named check starts as `unknown`; `unknown` is never reported as healthy.
  expect(ctx.remoteWorkspace.getState()).toMatchObject({ phase: 'idle', generation: 0 })
  expect(ctx.remoteWorkspace.getState().diagnostics.every(check => check.state === 'unknown')).toBe(true)
  expect(ctx.remoteWorkspace.getState().diagnostics.map(check => check.name)).toEqual(
    ['ssh', 'helper', 'service', 'descriptor', 'listener', 'identity', 'authentication', 'events', 'application'])
  const origin = `http://127.0.0.1:${String(ctx.webServer.port)}`
  const launch = new URL(ctx.connection.authenticatedUrl(origin))
  let cookieHeader: string | undefined
  ctx.connection.authorizeIndex({ method: 'GET', url: `${launch.pathname}${launch.search}`, headers: { host: launch.host } }, {
    writeHead(_status, headers) { cookieHeader = headers?.['set-cookie'] },
    end() {},
  })
  const cookie = cookieHeader?.split(';', 1)[0]
  if (cookie === undefined) throw new Error('missing browser Cookie')
  const response = await fetch(`${origin}/api/remoteWorkspace/getState`, {
    method: 'POST', headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ type: 'client-request', rpcId: 'remote-state-test',
      method: 'remoteWorkspace/getState', payload: { args: {} } }),
  })
  expect(response.status).toBe(200)
  const state = await response.json() as { result: { value: { phase: string; generation: number
    diagnostics: { name: string; state: string }[] } } }
  expect(state).toMatchObject({ type: 'server-response', rpcId: 'remote-state-test',
    result: { ok: true, value: { phase: 'idle', generation: 0 } } })
  // The published snapshot always carries every named check, and `unknown` is not health.
  expect(state.result.value.diagnostics.map(check => check.name)).toEqual(
    ['ssh', 'helper', 'service', 'descriptor', 'listener', 'identity', 'authentication', 'events', 'application'])
  expect(state.result.value.diagnostics.every(check => check.state === 'unknown')).toBe(true)
  const quickBody = JSON.stringify({ type: 'client-request', rpcId: 'quick-test', method: 'remoteWorkspace/quickConnect',
    payload: { args: { sshAlias: '-invalid', instanceKey: 'default', operationId: 'quick-test' } } })
  const denied = await fetch(`${origin}/api/remoteWorkspace/quickConnect`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: quickBody,
  })
  expect(denied.status).toBe(401)
  const invalid = await fetch(`${origin}/api/remoteWorkspace/quickConnect`, {
    method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: quickBody,
  })
  expect(invalid.status).toBe(200)
  expect(await invalid.json()).toMatchObject({ result: { ok: false } })
  expect(await ctx.remoteWorkspace.listTargets()).toEqual([])
  const aliases = await fetch(`${origin}/api/remoteWorkspace/listAliases`, {
    method: 'POST', headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ type: 'client-request', rpcId: 'alias-test', method: 'remoteWorkspace/listAliases', payload: { args: {} } }),
  })
  expect(await aliases.json()).toMatchObject({ result: { ok: true, value: expect.any(Array) } })

  // Use the current Harness authentication and event carrier, not a canned HTTP response.
  const port = ctx.webServer.port
  if (port === undefined) throw new Error('Web listener did not bind')
  const identity = { protocolVersion: 1 as const, instanceKey: 'default', instanceId: 'compat-instance',
    bootId: 'compat-boot', profile: 'web', workspaceHint: '/compat-workspace',
    version: '0.2.1-rc.2', capabilities: ['web', 'remote.mux'] }
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact', path: '/',
    handler(req, res) {
      if (!ctx.connection.authorizeIndex(req, res)) return
      res.writeHead(200, { 'content-type': 'text/html' })
      res.end('<!doctype html><title>Compatibility fixture</title>')
    },
  }), 'compatibility: browser index')
  ctx.effect(() => ctx.connection.fetch.register({
    path: '/api/remote-workspace/identity', methods: ['GET'], requestBody: 'buffered',
    fetch: () => Promise.resolve(Response.json(identity)),
  }), 'compatibility: identity fixture')
  ctx.effect(() => ctx.typertGateway.registerRemoteEvents(async function* (signal) {
    if (signal.aborted) return
    await new Promise<void>(resolve => signal.addEventListener('abort', () => resolve(), { once: true }))
  }, { home: '/compat-home' }), 'compatibility: idle event source')
  const descriptor = { ...identity, port, launchUrl: ctx.connection.authenticatedUrl(`${origin}/`) }
  const remoteCookie = await authenticate(port, port, descriptor)
  expect(await readIdentity(port, port, remoteCookie)).toEqual(identity)
  await expect(probeEventStream(port, port, remoteCookie)).resolves.toBeUndefined()
  await expect(readIdentity(port, port, 'invalid=credential')).rejects.toBeInstanceOf(UpstreamAuthRequired)
  await expect(authenticate(port, port, { ...descriptor,
    launchUrl: `${origin}/?token=invalid-launch-credential` })).rejects.toBeInstanceOf(UpstreamAuthRequired)
})

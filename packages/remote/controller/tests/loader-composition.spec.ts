/** Desktop-side controller through the real Loader, Web server, Connection, and Typert HTTP route. */
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterEach, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Include from '@deepseek-ai/cordis-plugin-include'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import TypertGatewayService from '@deepseek-ai/dsh-api-gateway'
import * as ConnectionPlugin from '@deepseek-ai/dsh-client-connection'
import WebServer from '@deepseek-ai/dsh-host-webserver'
import TypertRegistry from '@deepseek-ai/dsh-typert-registry'
import RemoteWorkspaceController from '../src/index.ts'

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

  expect(ctx.remoteWorkspace.getState()).toEqual({ phase: 'idle', generation: 0 })
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
  await expect(response.json()).resolves.toEqual({
    type: 'server-response', rpcId: 'remote-state-test',
    result: { ok: true, value: { phase: 'idle', generation: 0 } },
  })
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
})

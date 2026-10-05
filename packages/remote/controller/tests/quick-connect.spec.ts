/** Quick connection discovers public facts while preserving saved identity pins and single ownership. */
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ConnectionManager } from '../src/manager.ts'
import { TargetStore } from '../src/store.ts'
import type { DiscoveredTarget } from '../src/types.ts'
import * as ssh from '../src/ssh.ts'

vi.mock('../src/ssh.ts', () => ({ discoverTarget: vi.fn(), discover: vi.fn(), forward: vi.fn() }))
vi.mock('../src/auth.ts', () => ({ authenticate: vi.fn(async () => 'private-cookie'),
  readIdentity: vi.fn(async () => ({ protocolVersion: 1, instanceId: 'instance-a', bootId: 'boot-a', instanceKey: 'default', profile: 'web', workspaceHint: '/srv/project' })),
  probeEventStream: vi.fn(async () => {}) }))
vi.mock('../src/proxy.ts', () => ({ AuthProxy: class {
  async start(): Promise<void> {}
  async stop(): Promise<void> {}
  openTicket(): string { return 'http://127.0.0.1/ticket' }
} }))

const info: DiscoveredTarget = { protocolVersion: 1, instanceId: 'instance-a', bootId: 'boot-a', instanceKey: 'default',
  profile: 'web', workspaceHint: '/srv/project', port: 4321 }
let directory: string, store: TargetStore, manager: ConnectionManager

beforeEach(async () => {
  vi.clearAllMocks()
  directory = await mkdtemp(join(tmpdir(), 'dsh-quick-connect-'))
  store = new TargetStore(join(directory, 'targets.json'))
  manager = new ConnectionManager(store, '/usr/local/bin/dsh-remote-info')
  vi.mocked(ssh.discoverTarget).mockResolvedValue(info)
  vi.mocked(ssh.discover).mockResolvedValue({ ...info, launchUrl: 'http://127.0.0.1:4321/?token=private' })
  vi.mocked(ssh.forward).mockResolvedValue({ port: 12345, exited: new Promise(() => {}), stop: async () => {} })
})
afterEach(async () => { await manager.dispose(); await rm(directory, { recursive: true, force: true }) })

it('connects from an alias and default key, persisting only automatically discovered public fields', async () => {
  expect((await manager.quickConnect('harness-lan', 'default', 'intent-a')).phase).toBe('app-ready')
  const targets = await store.list()
  expect(targets).toHaveLength(1)
  expect(targets[0]).toMatchObject({ name: 'harness-lan', instanceId: 'instance-a', profile: 'web', remotePort: 4321, workspaceHint: '/srv/project' })
  const text = await readFile(join(directory, 'targets.json'), 'utf8')
  expect(text).not.toMatch(/token|cookie|launchUrl|bootId/u)
  expect(ssh.forward).toHaveBeenCalledWith('harness-lan', 4321, expect.any(AbortSignal))
})

it('reuses a saved target and rejects changed identity instead of silently replacing its pin', async () => {
  const first = await manager.quickConnect('harness-lan', 'default', 'intent-a')
  await manager.disconnect(first.connectionId!)
  vi.mocked(ssh.discover).mockResolvedValue({ ...info, instanceId: 'replaced', launchUrl: 'http://127.0.0.1:4321/?token=private' })
  await expect(manager.quickConnect('harness-lan', 'default', 'intent-b')).rejects.toThrow('identity mismatch')
  expect((await store.list())[0]?.instanceId).toBe('instance-a')
  expect(ssh.discoverTarget).toHaveBeenCalledTimes(1)
  expect(manager.getState().phase).toBe('identity-mismatch')
})

it('does not save a failed SSH discovery and permits retry', async () => {
  vi.mocked(ssh.discoverTarget).mockRejectedValueOnce(new Error('remote-workspace: SSH_HOST_KEY'))
  await expect(manager.quickConnect('harness-lan', 'default', 'intent-a')).rejects.toThrow('SSH_HOST_KEY')
  expect(await store.list()).toEqual([])
  expect((await manager.quickConnect('harness-lan', 'default', 'intent-b')).phase).toBe('app-ready')
})

it('reserves discovery against concurrent quick and saved connection requests', async () => {
  const waiting = Promise.withResolvers<DiscoveredTarget>()
  vi.mocked(ssh.discoverTarget).mockReturnValueOnce(waiting.promise)
  const first = manager.quickConnect('harness-lan', 'default', 'intent-a')
  await expect(manager.quickConnect('harness-lan', 'default', 'intent-b')).rejects.toThrow('already starting')
  await expect(manager.connect('target', 'lan', 'intent-c')).rejects.toThrow('already starting')
  waiting.resolve(info)
  await first
  expect(ssh.discoverTarget).toHaveBeenCalledTimes(1)
})

it('aborts and awaits in-flight discovery during disposal without saving late results', async () => {
  const started = Promise.withResolvers<void>()
  vi.mocked(ssh.discoverTarget).mockImplementationOnce(async (_alias, _key, _helper, signal) => {
    started.resolve()
    await new Promise<void>(resolve => signal.addEventListener('abort', () => resolve(), { once: true }))
    signal.throwIfAborted()
    return info
  })
  const first = manager.quickConnect('harness-lan', 'default', 'intent-a')
  const rejected = expect(first).rejects.toThrow('controller disposed')
  await started.promise
  await manager.dispose()
  await rejected
  expect(await store.list()).toEqual([])
  await expect(manager.quickConnect('harness-lan', 'default', 'intent-b')).rejects.toThrow('controller disposed')
})

it('rejects malformed aliases and mismatched instance keys before saving', async () => {
  await expect(manager.quickConnect('-oProxyCommand=bad', 'default', 'intent-a')).rejects.toThrow('invalid SSH')
  expect(ssh.discoverTarget).not.toHaveBeenCalled()
  vi.mocked(ssh.discoverTarget).mockResolvedValueOnce({ ...info, instanceKey: 'another' })
  await expect(manager.quickConnect('harness-lan', 'default', 'intent-b')).rejects.toThrow('identity mismatch')
  expect(await store.list()).toEqual([])
})

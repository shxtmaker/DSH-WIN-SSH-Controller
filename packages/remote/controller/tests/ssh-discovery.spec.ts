/** Public SSH discovery uses the fixed identity command and keeps process errors actionable. */
import { PassThrough } from 'node:stream'
import { beforeEach, expect, it, vi } from 'vitest'
import { ChildProcess, spawn } from 'node:child_process'
import { discover, discoverTarget } from '../src/ssh.ts'
vi.mock('node:child_process', async importOriginal => ({ ...await importOriginal<typeof import('node:child_process')>(), spawn: vi.fn() }))
const info = { protocolVersion: 1, instanceId: 'instance-a', bootId: 'boot-a', instanceKey: 'default',
  profile: 'web', workspaceHint: '/srv/project', port: 4321 }

function process(output: unknown, stderr = '', exitCode = 0, raw?: string): void {
  vi.mocked(spawn).mockImplementationOnce(() => {
    const child = Object.assign(new ChildProcess(), { stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(),
      kill: () => true })
    child.stdin.on('finish', () => queueMicrotask(() => {
      child.stdout.end(raw ?? JSON.stringify(output)); child.stderr.end(stderr); child.emit('exit', exitCode); child.emit('close', exitCode)
    }))
    return child
  })
}
beforeEach(() => vi.clearAllMocks())

it('runs --identity with strict host keys, no shell and the default key on stdin, returning no credential fields', async () => {
  process({ ...info, launchUrl: 'credential-must-not-escape', extra: 'discard' })
  expect(await discoverTarget('harness-lan', 'default', '/usr/local/bin/dsh-remote-info', new AbortController().signal)).toEqual(info)
  const [command, args, options] = vi.mocked(spawn).mock.calls[0]!
  expect(command).toBe('ssh')
  expect(args).toEqual(expect.arrayContaining(['BatchMode=yes', 'StrictHostKeyChecking=yes', 'ForwardAgent=no', 'harness-lan', '/usr/local/bin/dsh-remote-info', '--identity']))
  expect(options).toMatchObject({ shell: false, windowsHide: true })
})

it('keeps the full launch descriptor only for the authenticated connection path', async () => {
  process({ ...info, launchUrl: 'http://127.0.0.1:4321/?token=private' })
  const result = await discover('harness-lan', 'default', '/usr/local/bin/dsh-remote-info', new AbortController().signal)
  expect(result.launchUrl).toContain('token=private')
  expect(vi.mocked(spawn).mock.calls[0]?.[1]).not.toContain('--identity')
})

it.each([
  ['Host key verification failed.', 'SSH_HOST_KEY'], ['Permission denied (publickey).', 'SSH_AUTH'],
  ['Could not resolve hostname missing', 'SSH_ALIAS'], ['Connection refused', 'SSH_UNREACHABLE'],
  ['/usr/local/bin/dsh-remote-info: not found', 'SSH_HELPER'],
])('classifies %s without returning raw SSH output', async (stderr, code) => {
  process({}, stderr, 255)
  await expect(discoverTarget('harness-lan', 'default', '/usr/local/bin/dsh-remote-info', new AbortController().signal)).rejects.toThrow(`remote-workspace: ${code}`)
})

it('rejects invalid descriptor ports and pre-aborted discovery without starting another process', async () => {
  process({ ...info, port: 0 })
  await expect(discoverTarget('harness-lan', 'default', '/usr/local/bin/dsh-remote-info', new AbortController().signal)).rejects.toThrow('invalid helper response')
  const controller = new AbortController(); controller.abort(new Error('cancelled'))
  await expect(discoverTarget('harness-lan', 'default', '/usr/local/bin/dsh-remote-info', controller.signal)).rejects.toThrow('cancelled')
  expect(spawn).toHaveBeenCalledTimes(1)
})

it('reports malformed helper JSON without including credential fragments in the error', async () => {
  process(undefined, '', 0, '{"launchUrl":"secret-token",')
  await expect(discover('harness-lan', 'default', '/usr/local/bin/dsh-remote-info', new AbortController().signal)).rejects.toThrow(/^remote-workspace: invalid helper response$/u)
})

/** Alias suggestions contain only literal Host names, including bounded Include files. */
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { listSshAliases } from '../src/aliases.ts'
const directories: string[] = []
afterEach(async () => { await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true }))) })
async function home(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), 'dsh-aliases-')); directories.push(path)
  await mkdir(join(path, '.ssh')); return path
}
it('reads multiple and quoted aliases, ignores patterns, comments and secrets, and handles include cycles', async () => {
  const path = await home()
  await mkdir(join(path, '.ssh', 'config.d'))
  await writeFile(join(path, '.ssh', 'config'), 'Host alpha "beta" *.example !excluded # fake\n  IdentityFile secret-key\nInclude config.d/*\nHost=gamma\nMatch exec "never execute"\nInclude missing\n')
  await writeFile(join(path, '.ssh', 'config.d', 'servers'), 'Host delta alpha\nInclude config\n')
  expect(await listSshAliases(path)).toEqual(['alpha', 'beta', 'delta', 'gamma'])
})
it('returns no suggestions when the user has no SSH config', async () => {
  expect(await listSshAliases(await home())).toEqual([])
})
it('rejects an oversized config rather than returning a partial list', async () => {
  const path = await home()
  await writeFile(join(path, '.ssh', 'config'), 'Host alpha\n' + '#'.repeat(1_048_576))
  await expect(listSshAliases(path)).rejects.toThrow('size limit')
})

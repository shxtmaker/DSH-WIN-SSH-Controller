/** Read literal OpenSSH Host aliases without exposing configuration or executing commands. */
import { glob, readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { isAbsolute, join, resolve } from 'node:path'

/** Enumerate selectable Host aliases from the user config and its Include files.
 * @param home - user home containing .ssh/config.
 * @returns unique literal aliases; patterns and negated hosts are omitted.
 */
export async function listSshAliases(home = homedir()): Promise<string[]> {
  const base = join(home, '.ssh')
  const visited = new Set<string>()
  const aliases = new Set<string>()
  let bytes = 0
  async function read(path: string): Promise<void> {
    if (visited.has(path)) return
    if (visited.size >= 64) throw new Error('remote-workspace: SSH config include limit')
    visited.add(path)
    let content: string
    try { content = await readFile(path, 'utf8') } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return
      throw error
    }
    bytes += Buffer.byteLength(content)
    if (bytes > 1_048_576) throw new Error('remote-workspace: SSH config size limit')
    let inMatch = false
    for (const line of content.split(/\r?\n/u)) {
      const parts = line.replace(/^\s*(Host|Include|Match)\s*=/iu, '$1 ').match(/"[^"\r\n]*"|'[^'\r\n]*'|#[^\r\n]*|[^\s#]+/gu)?.filter(part => !part.startsWith('#')).map(part => part.replace(/^["']|["']$/gu, '')) ?? []
      const key = parts.shift()?.toLowerCase()
      if (key === 'match') inMatch = true
      if (key === 'host') {
        inMatch = false
        for (const alias of parts) if (/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/u.test(alias)) aliases.add(alias)
      }
      if (key === 'include' && !inMatch) {
        for (const part of parts) {
          const expanded = part.startsWith('~/') ? join(home, part.slice(2)) : isAbsolute(part) ? part : resolve(base, part)
          for await (const match of glob(expanded.replaceAll('\\', '/'))) await read(match)
        }
      }
    }
  }
  await read(join(base, 'config'))
  return [...aliases].sort((a, b) => a.localeCompare(b))
}

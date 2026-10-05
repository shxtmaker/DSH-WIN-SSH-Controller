/** Reject incomplete Git bundles and stale Host/Client contracts. */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { root, project } from './runtime.mjs'
import { archiveEntries } from './verify-artifacts.mjs'
import { gitRuntimeBytes } from './sync-git-package.mjs'

export async function verifyGitPackage(directory = root) {
  const manifest = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'))
  assert.equal(manifest.dsh?.bundle?.patch, './cordis.patch.yml', 'Git root must declare an installable Harness bundle')
  const patch = await readFile(join(directory, 'cordis.patch.yml'), 'utf8')
  assert.equal(patch, `- insert:\n    - id: remote-workspace-controller\n      name: '${manifest.name}'\n      config:\n        helperPath: /usr/local/bin/dsh-remote-info\n`)
  assert.equal(manifest.main, 'runtime/controller/index.js')
  assert.equal(manifest.types, 'runtime/controller/types/index.d.ts')
  assert.deepEqual(manifest.files, ['runtime', 'cordis.patch.yml'])
  const defaults = { '.': 'runtime/controller/index.js', './typert': 'runtime/controller/typert.host.js', './remote': 'runtime/controller/typert.remote-client.js', './client': 'runtime/client/client.js' }
  for (const [name, path] of Object.entries(defaults)) assert.equal(manifest.exports?.[name]?.default, `./${path}`, `Missing Git export: ${name}`)
  assert.equal(manifest.exports?.['./types']?.types, './runtime/controller/types/types.d.ts')
  assert.equal(manifest.exports?.['./package.json'], './package.json')
  assert.equal(manifest.exports?.['./cordis.patch.yml'], './cordis.patch.yml')
  for (const name of ['prepare', 'preinstall', 'install', 'postinstall']) assert.equal(manifest.scripts?.[name], undefined, 'Git installation must not rebuild Harness')
  for (const role of project.artifacts) {
    const entries = archiveEntries(await readFile(join(directory, `dist/remote/harness-remote-${role}-${project.version}.tgz`)))
    const source = JSON.parse(entries.get('package/package.json').toString())
    if (role === 'controller') {
      assert.deepEqual(manifest.dependencies, source.dependencies)
      assert.deepEqual(manifest.peerDependencies, source.peerDependencies)
    }
    if (role === 'client') assert.deepEqual(manifest.dsh.client, source.dsh.client)
    for (const [path, bytes] of entries) {
      if (!path.startsWith('package/lib/')) continue
      const output = `runtime/${role}/${path.slice('package/lib/'.length)}`
      assert.deepEqual(await readFile(join(directory, output)), gitRuntimeBytes(bytes, manifest.name), `Stale Git runtime or contract: ${output}`)
    }
  }
}

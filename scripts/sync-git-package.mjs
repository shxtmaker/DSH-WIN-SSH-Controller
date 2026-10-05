/** Expose the verified workspace bundle and its packaged components for Git installation. */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { root, project } from './runtime.mjs'
import { archiveEntries, verifyArtifacts } from './verify-artifacts.mjs'

/** Adapt package identifiers consistently across Host metadata, Client factories, and declarations. */
export function gitRuntimeBytes(bytes, packageName) {
  return Buffer.from(bytes.toString('utf8').replaceAll('@harness-remote/controller', packageName).replaceAll('@harness-remote/client', packageName))
}

export async function syncGitPackage(directory = join(root, 'dist/remote')) {
  await verifyArtifacts(directory)
  const path = join(root, 'package.json')
  const manifest = JSON.parse(await readFile(path, 'utf8'))
  const packages = new Map()
  for (const role of project.artifacts) {
    const entries = archiveEntries(await readFile(join(directory, `harness-remote-${role}-${project.version}.tgz`)))
    packages.set(role, JSON.parse(entries.get('package/package.json').toString()))
    for (const [source, bytes] of entries) {
      if (!source.startsWith('package/lib/')) continue
      const output = join(root, 'runtime', role, source.slice('package/lib/'.length))
      await mkdir(dirname(output), { recursive: true })
      await writeFile(output, gitRuntimeBytes(bytes, manifest.name))
    }
  }
  const controller = packages.get('controller'), client = packages.get('client')
  Object.assign(manifest, {
    main: 'runtime/controller/index.js', types: 'runtime/controller/types/index.d.ts',
    exports: {
      '.': { types: './runtime/controller/types/index.d.ts', default: './runtime/controller/index.js' },
      './types': { types: './runtime/controller/types/types.d.ts' },
      './typert': { types: './runtime/controller/typert.host.d.ts', default: './runtime/controller/typert.host.js' },
      './remote': { types: './runtime/controller/typert.remote-client.d.ts', default: './runtime/controller/typert.remote-client.js' },
      './client': { types: './runtime/client/types/client/index.d.ts', default: './runtime/client/client.js' },
      './cordis.patch.yml': './cordis.patch.yml', './package.json': './package.json',
    },
    files: ['runtime', 'cordis.patch.yml'],
    dependencies: controller.dependencies, peerDependencies: controller.peerDependencies,
    dsh: { bundle: { patch: './cordis.patch.yml' }, client: client.dsh.client },
  })
  await writeFile(path, JSON.stringify(manifest, null, 2) + '\n')
  await writeFile(join(root, 'cordis.patch.yml'), `- insert:\n    - id: remote-workspace-controller\n      name: '${manifest.name}'\n      config:\n        helperPath: /usr/local/bin/dsh-remote-info\n`)
}

if (process.argv[1] && resolve(process.argv[1]) === join(root, 'scripts/sync-git-package.mjs')) {
  await syncGitPackage(resolve(root, process.argv[2] ?? 'dist/remote'))
  console.log('OK Git package synchronized from verified Controller artifacts')
}

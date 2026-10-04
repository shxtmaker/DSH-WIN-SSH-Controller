/** Host plugin bundles and the browser-safe library consumed by the Client bundle. */
import { resolve } from 'node:path'
import { defineConfig } from 'tsdown'
import { typertPlugin } from './packages/typert/generator/lib/types/tsdown-plugin.js'

const protocolPlugin = typertPlugin({ mode: 'workspace', faces: ['host'] })
export default defineConfig([
  ...['controller', 'bundle'].map(name => ({
    cwd: resolve(`packages/remote/${name}`),
    entry: ['lib/types/index.js'],
    outDir: 'lib', format: ['esm'], platform: 'node', target: 'es2024',
    fixedExtension: false, clean: false, dts: false,
    deps: { neverBundle: [/^@deepseek-ai\//u, 'ws', 'zod'] },
    plugins: [protocolPlugin],
  })),
  {
    cwd: resolve('packages/util/crypto'), entry: ['lib/types/index.js'],
    outDir: 'lib', format: ['esm'], platform: 'browser', target: 'es2024',
    fixedExtension: false, clean: false, dts: false,
  },
])

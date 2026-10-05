/** Exercise the Git package through the same bundle reader used by the Harness manager. */
import assert from 'node:assert/strict'
import { copyFile, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { parseArgs } from 'node:util'
import { runInNewContext } from 'node:vm'
import { root, pnpm, run } from './runtime.mjs'

const { values } = parseArgs({ options: { harness: { type: 'string' }, installation: { type: 'string' }, spec: { type: 'string' } } })
if (!values.harness && !values.installation) throw new Error('Specify --harness /path/to/built-harness or --installation /path/to/isolated-cli-installation')
const installation = values.installation && resolve(values.installation)
const installedRequire = installation && createRequire(await realpath(join(installation, 'node_modules/@deepseek-ai/dsh/package.json')))
const operations = installedRequire ? installedRequire.resolve('@deepseek-ai/dsh-plugin-manager/operations') : join(resolve(values.harness), 'packages/boot/plugin-manager/lib/types/operations.js')
const appBoot = installedRequire ? installedRequire.resolve('@deepseek-ai/dsh-app-boot') : join(resolve(values.harness), 'packages/boot/app-boot/lib/index.js')
const { bundleManifest } = await import(pathToFileURL(operations).href)
const { bundlePatchPaths, loadOverlayPatches, composeEntries, resolveBundleDir, loadProfileDirectory, createRuntimeResolution, PluginPackages } = await import(pathToFileURL(appBoot).href)
const temporary = await mkdtemp(join(tmpdir(), 'dsh-controller-git-install-'))
try {
  let spec = values.spec
  if (!spec) {
    const repository = join(temporary, 'repository')
    await mkdir(repository)
    const tracked = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8', windowsHide: true })
    assert.equal(tracked.status, 0, tracked.stderr)
    for (const file of new Set(tracked.stdout.split('\0').filter(Boolean))) {
      const destination = join(repository, file)
      await mkdir(dirname(destination), { recursive: true })
      await copyFile(join(root, file), destination)
    }
    run('git', ['init', '--initial-branch=main'], repository)
    run('git', ['add', '.'], repository)
    run('git', ['-c', 'user.name=Installation Test', '-c', 'user.email=test@localhost', '-c', 'core.hooksPath=/dev/null', 'commit', '--quiet', '-m', 'Installation fixture'], repository)
    spec = `git+${pathToFileURL(repository).href}#main`
  }
  const profile = installation ? join(temporary, 'dsh-home/profiles/git-install-check') : join(temporary, 'profile')
  if (installation) {
    const cli = join(dirname(await realpath(join(installation, 'node_modules/@deepseek-ai/dsh/package.json'))), 'lib/bin.js')
    const result = spawnSync(process.execPath, [cli, 'plugin', '--profile', 'git-install-check', 'add', spec], {
      cwd: temporary, encoding: 'utf8', timeout: 120_000, maxBuffer: 4 * 1024 * 1024,
      env: { ...process.env, DSH_HOME: join(temporary, 'dsh-home'), DSH_TELEMETRY: '0' },
    })
    console.log(result.stdout)
    if (result.stderr) console.error(result.stderr)
    assert.equal(result.status, 0, result.error?.message ?? result.stderr)
  } else {
    await mkdir(profile)
    await writeFile(join(profile, 'package.json'), JSON.stringify({ name: 'controller-installation-test', private: true, type: 'module' }) + '\n')
    pnpm(['add', spec, '--ignore-scripts', '--config.auto-install-peers=false'], profile)
  }
  const installed = JSON.parse(await readFile(join(profile, 'package.json'), 'utf8'))
  const names = Object.keys(installed.dependencies)
  assert.equal(names.length, 1, 'The isolated profile must contain exactly the requested Git package')
  const name = names[0]
  if (installation) assert.ok(installed.dsh.profile.bundles.includes(name), 'CLI must select the installed bundle in the profile')
  const manifest = bundleManifest(name, profile, join(profile, 'package.json'))
  assert.ok(manifest, 'not-bundle: 这个包没有声明组合包，不能作为插件管理')
  const directory = resolveBundleDir('dsh', name, join(profile, 'package.json'), profile)
  const patches = bundlePatchPaths(directory, manifest.dsh.bundle).flatMap(file => loadOverlayPatches('dsh', file))
  const rows = composeEntries([patches])
  assert.deepEqual(rows.map(row => row.id), ['remote-workspace-controller'])
  assert.deepEqual(rows.map(row => row.name), [name])
  assert.equal(rows[0].config.helperPath, '/usr/local/bin/dsh-remote-info')
  const require = createRequire(await realpath(join(directory, 'package.json')))
  for (const row of rows) {
    const entry = require.resolve(row.name)
    assert.ok((await readFile(entry)).length > 0)
  }
  assert.equal(manifest.dsh.client.platform, 'web')
  assert.ok((await readFile(require.resolve(`${name}/client`), 'utf8')).includes(`id: "${name}"`))
  assert.ok((await readFile(require.resolve(`${name}/typert`))).length > 0)
  assert.ok((await readFile(require.resolve(`${name}/remote`))).length > 0)
  console.log(`PASS Git installation: ${name}; bundle, Controller runtime, Typert exports and Client module resolve without build scripts`)
  const hostRequire = installedRequire ?? createRequire(appBoot)
  const { Context } = await import(pathToFileURL(hostRequire.resolve('@deepseek-ai/cordis')).href)
  const ctx = new Context()
  try {
    const anchor = installation ? await realpath(join(installation, 'node_modules/@deepseek-ai/dsh/package.json')) : join(resolve(values.harness), 'apps/cli/package.json')
    const loaded = loadProfileDirectory('dsh', profile, anchor)
    const resolution = await createRuntimeResolution({ installAnchor: anchor, profile: loaded, home: join(temporary, 'dsh-home') })
    await ctx.plugin(PluginPackages, { resolution })
    ctx.baseUrl = pathToFileURL(profile).href + '/'
    ctx.provide('profileContext', { home: join(temporary, 'native-home'), name: 'desktop', cwd: temporary })
    const credentials = new Map()
    ctx.provide('credentials', { async modifyRecord(key, mutate) {
      const current = credentials.get(key), next = await mutate(current)
      if (next !== undefined) credentials.set(key, next)
      return next ?? current
    } })
    const Loader = (await import(pathToFileURL(hostRequire.resolve('@deepseek-ai/cordis-plugin-loader')).href)).default
    await ctx.plugin(Loader)
    for (const row of [
      { name: '@deepseek-ai/dsh-host-webserver', config: { host: '127.0.0.1', port: 0 } },
      { name: '@deepseek-ai/dsh-typert-registry' },
      { name: '@deepseek-ai/dsh-api-gateway' },
      { name: '@deepseek-ai/dsh-client-connection' },
      ...rows,
    ]) await ctx.loader.create(row)
    await ctx.loader.await()
    assert.deepEqual(ctx.remoteWorkspace.getState(), { phase: 'idle', generation: 0 })
    const origin = `http://127.0.0.1:${ctx.webServer.port}`
    const launch = new URL(ctx.connection.authenticatedUrl(origin))
    let browserCookie
    ctx.connection.authorizeIndex({ method: 'GET', url: `${launch.pathname}${launch.search}`, headers: { host: launch.host } }, {
      writeHead(_status, headers) { browserCookie = headers?.['set-cookie']?.split(';', 1)[0] }, end() {},
    })
    assert.ok(browserCookie, 'Temporary authentication cookie must be issued')
    const body = JSON.stringify({ type: 'client-request', rpcId: 'git-controller-state', method: 'remoteWorkspace/getState', payload: { args: {} } })
    const denied = await fetch(`${origin}/api/remoteWorkspace/getState`, { method: 'POST', headers: { 'content-type': 'application/json' }, body })
    assert.equal(denied.status, 401)
    const response = await fetch(`${origin}/api/remoteWorkspace/getState`, { method: 'POST', headers: { 'content-type': 'application/json', cookie: browserCookie }, body })
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { type: 'server-response', rpcId: 'git-controller-state', result: { ok: true, value: { phase: 'idle', generation: 0 } } })
    console.log('PASS installed Controller: real Loader composition and authenticated Typert HTTP state route; unauthenticated access rejected')

    const quickBody = JSON.stringify({ type: 'client-request', rpcId: 'git-controller-quick', method: 'remoteWorkspace/quickConnect',
      payload: { args: { sshAlias: '-invalid', instanceKey: 'default', operationId: 'git-quick-test' } } })
    const quickDenied = await fetch(`${origin}/api/remoteWorkspace/quickConnect`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: quickBody })
    assert.equal(quickDenied.status, 401)
    const quickInvalid = await fetch(`${origin}/api/remoteWorkspace/quickConnect`, {
      method: 'POST', headers: { 'content-type': 'application/json', cookie: browserCookie }, body: quickBody,
    })
    assert.equal(quickInvalid.status, 200)
    assert.equal((await quickInvalid.json()).result.ok, false)
    assert.deepEqual(await ctx.remoteWorkspace.listTargets(), [])
    const aliasResponse = await fetch(`${origin}/api/remoteWorkspace/listAliases`, {
      method: 'POST', headers: { 'content-type': 'application/json', cookie: browserCookie },
      body: JSON.stringify({ type: 'client-request', rpcId: 'git-controller-aliases', method: 'remoteWorkspace/listAliases', payload: { args: {} } }),
    })
    assert.equal(aliasResponse.status, 200)
    const aliases = (await aliasResponse.json()).result
    assert.equal(aliases.ok, true)
    assert.ok(aliases.value.every(alias => /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/u.test(alias)))
    console.log('PASS installed quick connection routes: unauthenticated 401, malformed alias rejected without persistence, public alias enumeration')

    let clientModule
    runInNewContext(await readFile(require.resolve(`${name}/client`), 'utf8'), { window: { __ModuleLoader__: { load: module => { clientModule = module } } } })
    assert.equal(clientModule.id, name)
    const renderer = ctx.pluginPackages.packageOf('@deepseek-ai/dsh-client-ui-renderer', pathToFileURL(join(profile, 'package.json')).href)
    assert.ok(renderer, 'The Harness installation must provide the Client renderer')
    const reactRequire = createRequire(join(renderer.dir, 'package.json'))
    const client = clientModule.factory(specifier => reactRequire(specifier))
    let mountedContract
    const release = await client.apply({ remote: { async $mount(contract) { mountedContract = contract; return async () => {} } } })
    assert.equal(mountedContract.package, name)
    const hostContract = (await import(pathToFileURL(require.resolve(`${name}/typert`)).href)).TYPERT
    assert.deepEqual(Array.from(mountedContract.descriptors, method => method.id), hostContract.invocations.map(method => method.id))
    await release()
    console.log('PASS installed Client factory: module identity and mounted method contracts match the installed Host package')
  } finally { await ctx.fiber.dispose() }
} finally {
  await rm(temporary, { recursive: true, force: true })
}

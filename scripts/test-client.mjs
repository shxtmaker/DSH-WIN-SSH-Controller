/** Verify the packaged Client factory in a browser with deterministic local Host responses. */
import assertModule from 'node:assert/strict'
import { createServer } from 'node:http'
import { existsSync } from 'node:fs'
import { readFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { parseArgs } from 'node:util'
import { root, workspace } from './runtime.mjs'

/** Count every assertion, so a run reports exact pass/fail totals instead of only a final line. */
let assertions = 0
const assert = new Proxy(assertModule, {
  get: (target, property) => {
    const member = target[property]
    if (typeof member !== 'function') return member
    return (...args) => { assertions += 1; return member(...args) }
  },
})
const { values } = parseArgs({ options: { workspace: { type: 'string' } } })
const target = workspace(values.workspace)
const webRequire = createRequire(join(target, 'apps/web/package.json'))
const reactRequire = createRequire(join(target, 'packages/client/ui-renderer/package.json'))
const { chromium } = webRequire('playwright')
const files = new Map([
  ['/', join(root, 'tests/client-fixture.html')], ['/plugin.js', join(root, 'runtime/client/client.js')],
  ['/react.js', join(dirname(reactRequire.resolve('react/package.json')), 'umd/react.development.js')],
  ['/react-dom.js', join(dirname(webRequire.resolve('react-dom/package.json')), 'umd/react-dom.development.js')],
])
const native = join(target, 'packages/client')
files.set('/shell.css', join(native, 'web/src/base.css'))
files.set('/native-page.css', join(native, 'ui-plugin-manager/src/client/PluginManagerPage.module.css'))
files.set('/native-button.css', join(native, 'ui-primitives/src/Button.module.css'))
files.set('/native-input.css', join(native, 'ui-primitives/src/Input.module.css'))
const theme = (await Promise.all(['base.css', 'design-platform.css', 'gradient-shadow-text.css', 'corner-shape.css', 'focus.css'].map(name =>
  readFile(join(native, 'ui-theme/src/styles', name), 'utf8')))).join('\n')
const server = createServer(async (req, res) => {
  if (req.url === '/theme.css') { res.setHeader('content-type', 'text/css'); res.end(theme); return }
  const file = files.get(req.url)
  if (!file) { res.writeHead(404); res.end(); return }
  try { res.setHeader('content-type', req.url === '/' ? 'text/html; charset=utf-8' : req.url.endsWith('.css') ? 'text/css' : 'text/javascript'); res.end(await readFile(file)) }
  catch { res.writeHead(500); res.end() }
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))

/**
 * Launch the host Playwright browser with a task-owned writable HOME.
 *
 * Chromium's crashpad cannot create its database when HOME is read-only, and a pinned workspace
 * may resolve a browser build the host cache does not carry, so the host Chromium build is used
 * explicitly when it exists (the same fallback `test-proxy-browser.mjs` uses).
 */
async function launchBrowser() {
  const home = await mkdtemp(join(tmpdir(), 'dsh-client-test-'))
  await mkdir(home, { recursive: true })
  const env = { ...process.env, HOME: home, XDG_CONFIG_HOME: join(home, '.config'),
    XDG_CACHE_HOME: join(home, '.cache'), XDG_DATA_HOME: join(home, '.local/share') }
  const installed = join(process.env.HOME ?? '', '.cache/ms-playwright/chromium-1243/chrome-linux64/chrome')
  const candidates = [undefined, process.env.DSH_TEST_BROWSER, installed]
    .filter((path, index) => index === 0 || (path !== undefined && path !== '' && existsSync(path)))
  let failure
  for (const executablePath of candidates) {
    try {
      return await chromium.launch({ headless: true, env,
        ...(executablePath === undefined ? {} : { executablePath }) })
    } catch (error) { failure ??= error }
  }
  try { return await chromium.launch({ channel: 'msedge', headless: true, env }) }
  catch { throw failure }
}

let browser
try {
  browser = await launchBrowser()
  const page = await browser.newPage({ viewport: { width: 1080, height: 1000 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const origin = `http://127.0.0.1:${server.address().port}`
  await page.goto(origin)
  const alias = page.getByPlaceholder('选择或输入，如 harness-lan')
  await alias.waitFor()
  await mkdir(join(root, 'out/verification'), { recursive: true })
  await page.evaluate(() => { document.body.setAttribute('data-ds-dark-theme', ''); document.documentElement.style.colorScheme = 'dark' })
  await page.screenshot({ path: join(root, 'out/verification/native-style-current.png'), fullPage: true })
  for (const mode of ['light', 'dark']) {
    await page.evaluate(mode => {
      document.body.toggleAttribute('data-ds-dark-theme', mode === 'dark')
      document.documentElement.style.colorScheme = mode
    }, mode)
    const styleParity = await page.evaluate(() => {
      const pick = (selector, properties) => {
        const style = getComputedStyle(document.querySelector(selector))
        return Object.fromEntries(properties.map(key => [key, style[key]]))
      }
      const typography = ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight']
      return {
        title: pick('#app h1', typography), nativeTitle: pick('#native-reference h1', typography),
        intro: pick('#app header p', [...typography, 'color']), nativeIntro: pick('#native-reference p', [...typography, 'color']),
        button: pick('#app button[type="submit"]', [...typography, 'height', 'borderRadius', 'backgroundColor', 'color']),
        nativeButton: pick('#native-reference button', [...typography, 'height', 'borderRadius', 'backgroundColor', 'color']),
        input: pick('#app input[required]', ['fontFamily', 'fontSize', 'lineHeight', 'color']),
        nativeInput: pick('#native-reference input', ['fontFamily', 'fontSize', 'lineHeight', 'color']),
      }
    })
    await writeFile(join(root, `out/verification/native-style-${mode}.json`), JSON.stringify(styleParity, null, 2) + '\n')
    for (const key of ['title', 'intro', 'button', 'input']) {
      assert.deepEqual(styleParity[key], styleParity[`native${key[0].toUpperCase()}${key.slice(1)}`], `${key} must match native Harness styles`)
    }
    console.log(`PASS native ${mode} theme: title, intro, button and input computed styles match Harness`)
  }
  await page.waitForFunction(() => document.querySelector('input[placeholder="选择或输入，如 harness-lan"]')?.value === 'harness-lan')
  assert.equal(await page.locator('input:visible').count(), 3)
  const aliases = page.getByRole('listbox', { name: '已有 SSH 连接', exact: true })
  const aliasSearch = page.getByRole('searchbox', { name: '搜索 SSH 别名', exact: true })
  const targets = page.getByRole('listbox', { name: '已保存目标', exact: true })
  const targetSearch = page.getByRole('searchbox', { name: '搜索目标名称、SSH 别名或工作区', exact: true })
  assert.equal(await aliases.inputValue(), 'harness-lan')
  await page.evaluate(() => { window.fixture.aliases = ['harness-lan', 'harness-wan', 'lab-box'] })
  await page.getByRole('button', { name: '刷新', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('select[aria-label="已有 SSH 连接"]')?.options.length === 4)
  await aliasSearch.fill(' WAN ')
  assert.deepEqual(await aliases.locator('option').allTextContents(), ['请选择 SSH 别名', 'harness-wan'])
  await aliasSearch.press('Enter')
  assert.equal(await page.evaluate(() => window.fixture.calls), 0)
  await aliases.selectOption('harness-wan')
  assert.equal(await alias.inputValue(), 'harness-wan')
  await aliasSearch.fill('no-such-alias')
  await page.getByRole('status').filter({ hasText: '没有匹配的连接' }).waitFor()
  assert.equal(await alias.inputValue(), 'harness-wan')
  await aliasSearch.fill('')
  await aliases.selectOption('lab-box')
  await aliases.press('ArrowUp')
  assert.equal(await alias.inputValue(), 'harness-wan')
  await aliases.press('Enter')
  assert.equal(await page.evaluate(() => window.fixture.calls), 0)
  await mkdir(join(root, 'out/verification'), { recursive: true })
  await page.screenshot({ path: join(root, 'out/verification/searchable-connections.png'), fullPage: true })
  await aliases.selectOption('harness-lan')
  const help = page.getByRole('button', { name: '查看帮助: SSH 别名', exact: true })
  assert.equal(await help.getAttribute('aria-expanded'), 'false')
  await help.click()
  assert.equal(await help.getAttribute('aria-expanded'), 'true')
  assert.match(await page.getByRole('note').filter({ hasText: '用户名、地址、密钥和跳板机' }).innerText(), /无需重复填写/u)
  await help.press('Escape')
  assert.equal(await help.getAttribute('aria-expanded'), 'false')
  const shape = await help.evaluate(element => ({ radius: getComputedStyle(element).borderRadius, width: element.clientWidth, height: element.clientHeight }))
  assert.equal(shape.radius, '50%'); assert.equal(shape.width, shape.height)
  await page.getByText('高级选项', { exact: true }).click()
  assert.equal(await page.locator('input:visible').count(), 4)
  await page.locator('details input:visible').fill('team')
  await page.getByText('高级选项', { exact: true }).click()
  await mkdir(join(root, 'out/verification'), { recursive: true })
  await page.screenshot({ path: join(root, 'out/verification/quick-connection.png'), fullPage: true })
  await help.click()
  await page.screenshot({ path: join(root, 'out/verification/click-help.png'), fullPage: true })
  await help.click()
  await page.evaluate(() => { window.fixture.delay = 150 })
  await page.getByRole('button', { name: '一键连接', exact: true }).dblclick()
  assert.equal(await aliases.isDisabled(), true)
  assert.equal(await aliasSearch.isDisabled(), true)
  await page.getByRole('heading', { name: '连接状态: 已连接', exact: true }).waitFor()
  assert.equal(await page.evaluate(() => window.fixture.calls), 1)
  assert.equal(await page.evaluate(() => window.fixture.opens), 0)
  assert.equal(await targets.inputValue(), 'auto-id')
  assert.equal(await page.evaluate(() => window.fixture.targets[0].instanceKey), 'team')
  await page.getByRole('button', { name: '在应用内打开', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: '请先选择一个本机会话' }).waitFor()
  assert.equal(await page.evaluate(() => window.fixture.tickets), 0)
  await page.evaluate(() => { window.fixture.session = true })
  await page.getByRole('button', { name: '在应用内打开', exact: true }).click()
  await page.waitForFunction(() => window.fixture.opens === 1, undefined, { timeout: 3000 })
  assert.equal(await page.evaluate(() => window.fixture.panel), null)
  assert.equal(await page.evaluate(() => window.fixture.openedSession), 'session-a')
  assert.equal(await page.evaluate(() => window.fixture.openedUrl), 'http://127.0.0.1/example-ticket')
  await page.evaluate(() => { window.fixture.panel = 'remote-workspace'; window.fixture.browserFailure = 'Browser type unavailable' })
  await page.getByRole('button', { name: '在应用内打开', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: 'Browser type unavailable' }).waitFor()
  assert.equal(await page.evaluate(() => window.fixture.panel), 'remote-workspace')
  await page.evaluate(() => { window.fixture.browserFailure = ''; window.fixture.ticketDelay = 150 })
  await page.getByRole('button', { name: '在应用内打开', exact: true }).click()
  await page.waitForFunction(() => window.fixture.tickets === 3)
  await page.evaluate(() => { window.fixture.sessionId = 'session-b' })
  await page.getByRole('alert').filter({ hasText: '本机会话已切换' }).waitFor()
  assert.equal(await page.evaluate(() => window.fixture.opens), 1)
  await page.evaluate(() => { window.fixture.sessionId = 'session-a'; window.fixture.ticketDelay = 0 })
  await page.screenshot({ path: join(root, 'out/verification/connected.png'), fullPage: true })
  await page.getByRole('button', { name: '断开', exact: true }).click()
  await page.evaluate(() => {
    window.fixture.targets.push({ ...window.fixture.targets[0], id: 'dev-id', name: '开发服务器',
      profile: 'dev', workspaceHint: '/srv/Design-Workspace',
      endpoints: [{ id: 'tcp', kind: 'frp-tcp', sshAlias: 'dev-ssh' }] });
  })
  await page.getByRole('button', { name: '刷新', exact: true }).click()
  await targetSearch.fill(' DESIGN-WORKSPACE ')
  assert.deepEqual(await targets.locator('option').allTextContents(), ['新建目标', '开发服务器 · dev-ssh'])
  await targets.selectOption('dev-id')
  assert.equal(await page.getByRole('combobox').inputValue(), 'tcp')
  assert.equal(await page.evaluate(() => window.fixture.calls), 1)
  await targetSearch.fill('开发服务器')
  assert.equal(await targets.inputValue(), 'dev-id')
  await targetSearch.fill('dev-ssh')
  assert.equal(await targets.inputValue(), 'dev-id')
  await targetSearch.fill('nothing-matches')
  await page.getByRole('status').filter({ hasText: '没有匹配的连接' }).waitFor()
  await page.getByRole('status').filter({ hasText: '当前目标: 开发服务器 · dev-ssh' }).waitFor()
  assert.equal(await page.getByRole('combobox').inputValue(), 'tcp')
  await targetSearch.fill('')
  await targets.selectOption('')
  assert.equal(await page.getByRole('combobox').inputValue(), '')
  assert.equal(await page.getByRole('button', { name: '连接', exact: true }).isDisabled(), true)
  await targets.selectOption('auto-id')
  await page.evaluate(() => { window.fixture.targets = window.fixture.targets.filter(target => target.id === 'auto-id') })
  await page.getByRole('button', { name: '刷新', exact: true }).click()
  await page.getByText('手动配置目标', { exact: true }).click()
  await page.getByRole('button', { name: '查看帮助: 远端 Web 端口', exact: true }).click()
  await page.getByRole('note').filter({ hasText: '此处不是 SSH 端口或 frp 端口' }).waitFor()
  await page.getByText('手动配置目标', { exact: true }).click()
  await page.getByRole('button', { name: '一键连接', exact: true }).click()
  await page.waitForFunction(() => window.fixture.opens === 2)
  await page.getByRole('button', { name: '断开', exact: true }).click()
  await page.evaluate(() => { window.fixture.failure = 'remote-workspace: SSH_HOST_KEY' })
  await page.getByRole('button', { name: '一键连接', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: 'SSH 主机密钥尚未确认或已变化' }).waitFor()
  await page.evaluate(() => { window.fixture.failure = 'remote-workspace: SSH_HELPER' })
  await page.getByRole('button', { name: '一键连接', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: '远端 helper 缺失、不可执行或配置不正确' }).waitFor()
  await page.evaluate(() => { window.fixture.failure = ''; window.fixture.failAliases = true })
  await page.getByRole('button', { name: '刷新', exact: true }).click()
  await page.getByRole('status').filter({ hasText: '暂时无法读取 SSH 别名' }).waitFor()
  await alias.fill('manual-alias')
  await page.getByRole('button', { name: '一键连接', exact: true }).click()
  await page.waitForFunction(() => window.fixture.opens === 3)
  await page.getByRole('button', { name: '断开', exact: true }).click()
  await page.evaluate(() => { window.fixture.failAliases = false; window.fixture.aliases = [] })
  await page.getByRole('button', { name: '刷新', exact: true }).click()
  await page.getByRole('status').filter({ hasText: '尚未找到已有 SSH 别名' }).waitFor()
  assert.equal(await alias.inputValue(), 'manual-alias')
  await page.evaluate(() => { window.fixture.aliases = ['harness-lan', 'harness-wan', 'lab-box'] })
  await page.getByRole('button', { name: '刷新', exact: true }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await aliasSearch.fill('wan')
  await page.screenshot({ path: join(root, 'out/verification/searchable-connections-narrow.png'), fullPage: true })
  await aliasSearch.fill('')
  await page.screenshot({ path: join(root, 'out/verification/narrow-connection.png'), fullPage: true })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await page.evaluate(() => {
    window.fixture.targetName = window.fixture.targets[0].name;
    window.fixture.targets[0].name = '很长的连接名称'.repeat(50);
    window.fixture.aliases.push('long-alias-'.repeat(11));
  })
  await page.getByRole('button', { name: '刷新', exact: true }).click()
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await page.evaluate(() => {
    window.fixture.targets[0].name = window.fixture.targetName;
    window.fixture.aliases.pop();
  })
  await page.getByRole('button', { name: '刷新', exact: true }).click()
  await page.evaluate(() => { window.fixture.missingRoutes = true })
  await page.getByRole('button', { name: '一键连接', exact: true }).click()
  const restart = page.getByRole('alert').filter({ hasText: '请完全退出 DeepSeek Harness（包括托盘）后重新打开' })
  await restart.waitFor({ timeout: 3000 })
  assert.equal(await page.getByRole('button', { name: '一键连接', exact: true }).isDisabled(), true)
  assert.equal(await page.getByRole('button', { name: '连接', exact: true }).isDisabled(), false)
  const oldHostCalls = await page.evaluate(() => window.fixture.calls)
  await alias.press('Enter')
  assert.equal(await page.evaluate(() => window.fixture.calls), oldHostCalls)
  await page.screenshot({ path: join(root, 'out/verification/restart-required.png'), fullPage: true })
  await page.evaluate(() => { window.fixture.missingRoutes = false; window.fixture.failAliases = false })
  await page.getByRole('button', { name: '刷新', exact: true }).click()
  await restart.waitFor({ state: 'hidden' })
  assert.equal(await page.getByRole('button', { name: '一键连接', exact: true }).isEnabled(), true)
  await page.evaluate(() => { window.fixture.missingRoutes = true })
  await page.getByRole('button', { name: '刷新', exact: true }).click()
  await restart.waitFor({ timeout: 3000 })
  assert.equal(await page.getByRole('button', { name: '一键连接', exact: true }).isDisabled(), true)
  await page.evaluate(() => { window.fixture.missingRoutes = false; window.fixture.failure = 'unrelated resource: HTTP 404' })
  await page.getByRole('button', { name: '刷新', exact: true }).click()
  await restart.waitFor({ state: 'hidden' })
  await page.getByRole('button', { name: '一键连接', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: 'unrelated resource: HTTP 404' }).waitFor()
  assert.equal(await page.getByRole('button', { name: '一键连接', exact: true }).isEnabled(), true)
  assert.deepEqual(errors, [])
  await page.evaluate(() => { window.fixture.failure = '' })
  await page.getByRole('button', { name: '刷新', exact: true }).click()
  await alias.fill('harness-lan')
  for (const mode of ['dark', 'light']) {
    await page.evaluate(mode => {
      document.body.toggleAttribute('data-ds-dark-theme', mode === 'dark')
      document.documentElement.style.colorScheme = mode
    }, mode)
    await page.setViewportSize({ width: 1080, height: 1240 })
    await page.locator('#app > section').evaluate(element => { element.scrollTop = 0 })
    await page.screenshot({ path: join(root, `out/verification/native-style-${mode}.png`), fullPage: true })
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByText('手动配置目标', { exact: true }).click()
  const portHelp = page.getByRole('button', { name: '查看帮助: 远端 Web 端口', exact: true })
  if (await portHelp.getAttribute('aria-expanded') !== 'true') await portHelp.click()
  await page.getByRole('note').filter({ hasText: '此处不是 SSH 端口或 frp 端口' }).waitFor()
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('#app section, #app input, #app select')].every(element =>
    element.scrollWidth <= element.clientWidth + 1)), true, 'expanded manual form must not overflow at 390px')
  await page.getByRole('button', { name: '保存目标', exact: true }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: join(root, 'out/verification/native-style-manual-narrow.png'), fullPage: true })
  await page.getByText('手动配置目标', { exact: true }).click()
  await page.locator('#app > section').evaluate(element => { element.scrollTop = 0 })
  await page.screenshot({ path: join(root, 'out/verification/native-style-narrow.png'), fullPage: true })
  assert.deepEqual(errors, [])

  // --- B11 layered diagnostics, service actions and dual open entry points ----------------------
  const checkedAt = '2026-10-13T00:00:00.000Z'
  const diagnostics = entries => entries.map(([name, state, code]) => ({ name, state, checkedAt,
    ...(code === undefined ? {} : { code }) }))
  await page.evaluate(state => {
    window.fixture.session = false
    window.fixture.state = state
  }, { phase: 'app-ready', generation: 1, connectionId: 'connection-a', targetId: 'auto-id', endpointId: 'ssh',
    hostName: 'harness-lan', instanceId: 'instance-a', profile: 'web', workspaceHint: '/srv/project' })
  await page.evaluate(checks => { window.fixture.state = { ...window.fixture.state, diagnostics: checks } },
    diagnostics([['ssh', 'ok'], ['helper', 'failed', 'HELPER_NOT_FOUND'], ['service', 'checking'],
      ['descriptor', 'unknown'], ['listener', 'unsupported'], ['identity', 'ok'], ['authentication', 'ok'],
      ['events', 'ok'], ['application', 'ok']]))
  await page.getByRole('button', { name: '刷新', exact: true }).click()
  await page.getByText('分层检查明细', { exact: true }).click()
  const rows = page.locator('[data-check]')
  assert.equal(await rows.count(), 9)
  assert.deepEqual(await rows.evaluateAll(list => list.map(row => [row.dataset.check, row.dataset.state])),
    [['ssh', 'ok'], ['helper', 'failed'], ['service', 'checking'], ['descriptor', 'unknown'],
      ['listener', 'unsupported'], ['identity', 'ok'], ['authentication', 'ok'], ['events', 'ok'],
      ['application', 'ok']])
  const labels = await rows.evaluateAll(list => Object.fromEntries(list.map(row =>
    [row.dataset.check, row.querySelector('[data-state]').textContent])))
  assert.deepEqual(labels, { ssh: '正常', helper: '失败', service: '检查中', descriptor: '未知',
    listener: '不支持', identity: '正常', authentication: '正常', events: '正常', application: '正常' })
  const tones = await rows.evaluateAll(list => Object.fromEntries(list.map(row =>
    [row.dataset.check, getComputedStyle(row.querySelector('[data-state]')).color])))
  assert.equal(tones.identity, tones.ssh, 'the same state must use the same treatment')
  assert.equal(new Set([tones.ssh, tones.helper, tones.service, tones.descriptor, tones.listener]).size, 5,
    'every diagnostics state must render distinctly')
  assert.notEqual(tones.descriptor, tones.ssh, 'unknown must never render as healthy')
  assert.notEqual(labels.descriptor, labels.ssh, 'unknown must not read as ok')
  assert.match(await rows.filter({ hasText: '未知' }).first().innerText(), /不能当作正常/u)
  assert.match(await rows.filter({ hasText: '不支持' }).first().innerText(), /已记录的限制/u)
  assert.equal(await page.locator('[data-check="helper"] code').innerText(), 'HELPER_NOT_FOUND')

  // An old helper advertises CONTROL_UNSUPPORTED: manual instructions replace the action buttons.
  await page.evaluate(checks => {
    window.fixture.state = { ...window.fixture.state,
      capabilities: { controlVersion: 1, helperVersion: '0.1.0', mode: 'unsupported', actions: [] },
      service: undefined,
      diagnostics: checks }
  }, diagnostics([['ssh', 'ok'], ['helper', 'unsupported', 'CONTROL_UNSUPPORTED'],
    ['service', 'unsupported', 'CONTROL_UNSUPPORTED'], ['descriptor', 'unknown'], ['listener', 'ok'],
    ['identity', 'ok'], ['authentication', 'ok'], ['events', 'ok'], ['application', 'ok']]))
  await page.getByRole('button', { name: '刷新', exact: true }).click()
  await page.getByText('需在远端手动启动', { exact: true }).waitFor()
  assert.equal(await page.locator('[data-manual-start]').count(), 1)
  assert.match(await page.locator('[data-manual-start]').innerText(), /CONTROL_UNSUPPORTED/u)
  assert.equal(await page.locator('[data-action]').count(), 0, 'CONTROL_UNSUPPORTED hides the action buttons')

  // A managed helper with an active unit: stop and restart require an explicit interruption warning.
  await page.evaluate(checks => {
    window.fixture.state = { ...window.fixture.state,
      capabilities: { controlVersion: 1, helperVersion: '0.3.0', mode: 'systemd-user',
        actions: ['start', 'stop', 'restart'] },
      service: { unit: 'dsh-remote-web.service', state: 'active', registered: true },
      serviceOperation: undefined, diagnostics: checks }
  }, diagnostics([['ssh', 'ok'], ['helper', 'ok'], ['service', 'ok'], ['descriptor', 'ok'], ['listener', 'ok'],
    ['identity', 'ok'], ['authentication', 'ok'], ['events', 'ok'], ['application', 'ok']]))
  await page.getByRole('button', { name: '刷新', exact: true }).click()
  await page.getByText('dsh-remote-web.service', { exact: true }).waitFor()
  assert.equal(await page.locator('[data-action="start"]').count(), 0, 'an active unit offers no start')
  assert.equal(await page.locator('[data-action="stop"]').count(), 1)
  assert.equal(await page.locator('[data-action="restart"]').count(), 1)
  await page.locator('[data-action="stop"]').click()
  const confirm = page.locator('[data-confirm="stop"]')
  await confirm.waitFor()
  const confirmText = await confirm.innerText()
  assert.match(confirmText, /harness-lan/u, 'the confirmation names the target')
  assert.match(confirmText, /中断/u, 'the confirmation states the interruption')
  assert.doesNotMatch(confirmText, /安全/u, 'the confirmation never claims the stop is safe')
  assert.doesNotMatch(confirmText, /没有任务/u)
  assert.equal(await page.evaluate(() => window.fixture.serviceSubmits), 0, 'opening the confirmation submits nothing')
  await page.getByRole('button', { name: '取消', exact: true }).click()
  assert.equal(await page.locator('[data-confirm]').count(), 0)
  await page.locator('[data-action="restart"]').click()
  await page.locator('[data-confirm="restart"]').waitFor()
  assert.match(await page.locator('[data-confirm="restart"]').innerText(), /服务重新就绪前无法访问/u)
  await page.locator('[data-confirm-accept="restart"]').click()
  await page.waitForFunction(() => window.fixture.serviceSubmits === 1)
  await page.waitForFunction(() => document.querySelector('[data-phase="completed"]') !== null)
  const completedColor = await page.locator('[data-phase="completed"]').evaluate(element => getComputedStyle(element).color)
  assert.match(await page.locator('[data-phase="completed"]').innerText(), /已完成/u)
  assert.equal(await page.evaluate(() => window.fixture.serviceArgs.action), 'restart')
  assert.equal(await page.evaluate(() => window.fixture.serviceArgs.ref.targetId), 'auto-id')
  assert.equal(await page.evaluate(() => window.fixture.serviceArgs.expectedInstanceId), 'instance-a')

  // Reloading the page only reads a receipt; it never resubmits the action.
  await page.getByRole('button', { name: '刷新', exact: true }).click()
  await page.getByRole('button', { name: '刷新', exact: true }).click()
  assert.equal(await page.evaluate(() => window.fixture.serviceSubmits), 1, 'refresh must not resubmit')
  assert.equal(await page.evaluate(() => window.fixture.serviceReads), 0, 'a finished action needs no read')

  await page.evaluate(() => { window.fixture.state = { ...window.fixture.state,
    serviceOperation: { phase: 'outcome-unknown', action: 'restart', operationId: 'op-unknown', code: 'OUTCOME_UNKNOWN' } } })
  await page.getByRole('button', { name: '刷新', exact: true }).click()
  const unknownOperation = page.locator('[data-phase="outcome-unknown"]')
  await unknownOperation.waitFor()
  assert.equal(await page.locator('[data-phase="completed"]').count(), 0)
  assert.match(await unknownOperation.innerText(), /结果未知/u)
  assert.match(await unknownOperation.innerText(), /不要重复提交/u)
  assert.doesNotMatch(await unknownOperation.innerText(), /已完成/u, 'outcome-unknown is never success')
  assert.notEqual(await unknownOperation.evaluate(element => getComputedStyle(element).color), completedColor)

  await page.evaluate(() => { window.fixture.state = { ...window.fixture.state,
    serviceOperation: { phase: 'failed', action: 'stop', operationId: 'op-failed', code: 'SERVICE_FAILED' } } })
  await page.getByRole('button', { name: '刷新', exact: true }).click()
  const failedOperation = page.locator('[data-phase="failed"]')
  await failedOperation.waitFor()
  assert.equal(await page.locator('[data-phase="completed"]').count(), 0)
  assert.match(await failedOperation.innerText(), /服务操作失败/u)
  assert.doesNotMatch(await failedOperation.innerText(), /已完成/u, 'a failed action is never success')
  assert.notEqual(await failedOperation.evaluate(element => getComputedStyle(element).color), completedColor)

  // A submitted-but-running action is completed by reading `getServiceOperation`, not by resubmitting.
  await page.evaluate(() => {
    window.fixture.state = { ...window.fixture.state,
      serviceOperation: { phase: 'waiting', action: 'restart', operationId: 'op-read' } }
    window.fixture.operationResult = { phase: 'completed', action: 'restart', operationId: 'op-read' }
  })
  await page.getByRole('button', { name: '刷新', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('[data-phase="completed"]') !== null)
  assert.equal(await page.evaluate(() => window.fixture.serviceReads), 1)
  assert.equal(await page.evaluate(() => window.fixture.readOperationId), 'op-read')
  assert.equal(await page.evaluate(() => window.fixture.serviceSubmits), 1)
  await page.getByRole('button', { name: '刷新', exact: true }).click()
  assert.equal(await page.evaluate(() => window.fixture.serviceReads), 1, 'reading stops once the receipt is terminal')
  assert.equal(await page.evaluate(() => window.fixture.serviceSubmits), 1)

  // The system browser is the primary entry point when no local Session is selected.
  await page.evaluate(() => { window.fixture.session = false })
  await page.getByRole('button', { name: '刷新', exact: true }).click()
  const systemOpen = page.getByRole('button', { name: '在系统浏览器中打开', exact: true })
  await systemOpen.waitFor()
  assert.equal(await systemOpen.isEnabled(), true)
  await page.getByText('当前未选择本机会话，系统浏览器是本页的主要打开入口。', { exact: true }).waitFor()
  const entryBackgrounds = await page.evaluate(() => {
    const find = name => [...document.querySelectorAll('#app button')].find(button => button.textContent.trim() === name)
    return { system: getComputedStyle(find('在系统浏览器中打开')).backgroundColor,
      inApp: getComputedStyle(find('在应用内打开')).backgroundColor }
  })
  assert.notEqual(entryBackgrounds.system, 'rgba(0, 0, 0, 0)', 'without a session the system browser is primary')
  assert.equal(entryBackgrounds.inApp, 'rgba(0, 0, 0, 0)')

  const ticketsBefore = await page.evaluate(() => window.fixture.tickets)
  await systemOpen.click()
  await page.waitForFunction(() => window.fixture.windowOpens.length === 1)
  assert.deepEqual(await page.evaluate(() => window.fixture.windowOpens[0]),
    { url: 'http://127.0.0.1/example-ticket', target: '_blank', features: 'noopener,noreferrer' })
  assert.equal(await page.evaluate(() => window.fixture.tickets), ticketsBefore + 1)
  const openStatus = page.locator('[data-open-status="requested"]')
  await openStatus.waitFor()
  assert.match(await openStatus.innerText(), /已请求打开/u)
  assert.match(await openStatus.innerText(), /不代表远端页面已经加载成功/u)
  const ticketLink = openStatus.locator('a')
  assert.equal(await ticketLink.getAttribute('href'), 'http://127.0.0.1/example-ticket')
  assert.equal(await ticketLink.getAttribute('target'), '_blank')
  assert.equal(await ticketLink.getAttribute('rel'), 'noopener noreferrer')
  assert.equal(await page.evaluate(() => window.fixture.opens), 3, 'the system path never opens the sidebar Browser')

  // A blocked popup still offers the explicit link, and an expired ticket can be regenerated.
  await page.evaluate(() => { window.fixture.popupBlocked = true; window.fixture.ticketUrl = 'http://127.0.0.1/example-ticket-2' })
  const ticketsBeforeRegenerate = await page.evaluate(() => window.fixture.tickets)
  await page.getByRole('button', { name: '重新生成链接', exact: true }).click()
  await page.waitForFunction(url => window.fixture.windowOpens.at(-1)?.url === url, 'http://127.0.0.1/example-ticket-2')
  assert.equal(await page.evaluate(() => window.fixture.tickets), ticketsBeforeRegenerate + 1)
  assert.equal(await page.locator('[data-open-status="requested"] a').getAttribute('href'),
    'http://127.0.0.1/example-ticket-2')
  await page.getByText('票据短期有效，过期后请重新生成。', { exact: true }).waitFor()
  await page.evaluate(() => { window.fixture.popupBlocked = false; window.fixture.ticketFailure = '远程票据已失效' })
  await page.getByRole('button', { name: '重新生成链接', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: '远程票据已失效' }).waitFor()
  assert.equal(await systemOpen.isEnabled(), true, 'a failed ticket must not break the entry point')
  await page.evaluate(() => { window.fixture.ticketFailure = '' })

  // Explicit re-authentication: upstream keeps a button, local authorization does not.
  await page.evaluate(() => { window.fixture.state = { ...window.fixture.state, accessWarning: 'UPSTREAM_AUTH_REQUIRED' } })
  await page.getByRole('button', { name: '刷新', exact: true }).click()
  await page.getByText('远端认证需要更新', { exact: true }).waitFor()
  assert.equal(await page.locator('[data-auth="upstream"]').count(), 1)
  assert.equal(await page.locator('[data-auth="local"]').count(), 0)
  await page.getByRole('button', { name: '更新远端认证', exact: true }).click()
  await page.waitForFunction(() => window.fixture.authRefreshes === 1)
  await page.locator('[data-auth="upstream"]').waitFor({ state: 'detached' })

  await page.evaluate(checks => {
    window.fixture.state = { ...window.fixture.state, accessWarning: undefined, diagnostics: checks }
  }, diagnostics([['ssh', 'ok'], ['helper', 'ok'], ['service', 'ok'], ['descriptor', 'ok'], ['listener', 'ok'],
    ['identity', 'ok'], ['authentication', 'failed', 'LOCAL_AUTH_REQUIRED'], ['events', 'ok'], ['application', 'ok']]))
  await page.getByRole('button', { name: '刷新', exact: true }).click()
  await page.getByText('本机页面授权已失效', { exact: true }).waitFor()
  const localAuth = page.locator('[data-auth="local"]')
  assert.equal(await localAuth.locator('button').count(), 0, 'local authorization never calls refreshAuthentication')
  assert.match(await localAuth.innerText(), /重新打开远端页面/u)
  assert.equal(await page.evaluate(() => window.fixture.authRefreshes), 1)

  // A local Session still keeps the in-app path, which never uses the system-browser call.
  await page.evaluate(() => { window.fixture.session = true })
  await page.getByRole('button', { name: '刷新', exact: true }).click()
  const opensBefore = await page.evaluate(() => window.fixture.opens)
  const windowOpensBefore = await page.evaluate(() => window.fixture.windowOpens.length)
  await page.getByRole('button', { name: '在应用内打开', exact: true }).click()
  await page.waitForFunction(count => window.fixture.opens === count + 1, opensBefore)
  assert.equal(await page.evaluate(() => window.fixture.windowOpens.length), windowOpensBefore)
  await page.evaluate(() => { window.fixture.session = false })
  await page.getByRole('button', { name: '刷新', exact: true }).click()

  // 390px: the widest new content (open diagnostics, confirmation dialog, operation receipt) fits.
  await page.locator('[data-action="stop"]').click()
  await page.locator('[data-confirm="stop"]').waitFor()
  await page.setViewportSize({ width: 390, height: 844 })
  assert.equal(await page.locator('[data-check]').first().isVisible(), true)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true,
    'no horizontal overflow at 390px')
  assert.equal(await page.evaluate(() => [...document.querySelectorAll(
    '#app section, #app input, #app select, #app [data-check], #app [data-phase], #app [data-confirm], #app [data-open-status], #app dl')]
    .every(element => element.scrollWidth <= element.clientWidth + 1)), true, 'every changed block fits at 390px')
  await page.screenshot({ path: join(root, 'out/verification/b11-diagnostics-service-narrow.png'), fullPage: true })
  await page.getByRole('button', { name: '取消', exact: true }).click()
  assert.equal(await page.evaluate(() => window.fixture.serviceSubmits), 1)
  await page.setViewportSize({ width: 1080, height: 1240 })
  await page.locator('#app > section').evaluate(element => { element.scrollTop = 0 })
  await page.screenshot({ path: join(root, 'out/verification/b11-diagnostics-service.png'), fullPage: true })
  assert.deepEqual(errors, [])
  console.log('PASS B11 layered diagnostics: every check state renders distinctly, unknown is never healthy')
  console.log('PASS B11 service: CONTROL_UNSUPPORTED hides actions, stop/restart confirm the interruption, refresh never resubmits, outcome-unknown and failed are not success')
  console.log('PASS B11 open entry points: the system browser works without a local Session, tickets regenerate, and the in-app path is preserved')
  console.log('PASS B11 re-authentication: upstream offers an explicit renewal, local authorization asks for a reopen')

  console.log('PASS native theme screenshots and expanded manual form at 390px')
  console.log('PASS packaged Client: searchable SSH and saved-target lists, keyboard selection without connection, empty and no-match states, selection preservation, manual alias fallback, circular help, duplicate suppression, selected-session opening, error recovery, narrow layout and stale Host route recovery')
  console.log(`RESULT ${assertions}/${assertions} assertions passed, 0 failed`)
} catch (error) {
  console.error(`FAIL after ${assertions} passed assertions`)
  throw error
} finally {
  await browser?.close()
  await new Promise(resolve => server.close(resolve))
}

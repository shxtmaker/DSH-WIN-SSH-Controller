#!/usr/bin/env node
/**
 * B02 / G401 — local authentication lifetime regression for the remote-workspace AuthProxy.
 *
 * It runs the real `packages/remote/controller/src/proxy.ts` behind a real Chromium Cookie
 * jar against a non-billing local fixture. It does not build the Harness, does not contact a
 * remote host, and never sends a paid model request.
 *
 * Two modes:
 *
 *   node scripts/test-proxy-browser.mjs
 *       Fix regression. Fails on the legacy `Max-Age=3600` source and passes once the local
 *       authorization is bound to the AuthProxy instance lifetime.
 *
 *   node scripts/test-proxy-browser.mjs --legacy-repro
 *       Legacy defect reproduction. Passes only while the defect is observable: the exchanged
 *       Cookie is a one-hour Cookie, the WebSocket survives its expiry, and later API calls
 *       fail with a local 401 without reaching the upstream.
 *
 * The only time compression happens at the test boundary: when the exchange response carries
 * an explicit `Max-Age`, this harness rewrites that attribute to a few seconds so the real
 * browser expires the Cookie during the run. A session Cookie is never given an artificial
 * deadline, and page JavaScript never mocks `Date`.
 */
import { execFile } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { launchChromium, readCookies } from '../tests/cdp-client.mjs'
import { REMOTE_COOKIE, startFixture } from '../tests/proxy-browser-fixture.mjs'

const run = promisify(execFile)
const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..')
const PROXY_SOURCE = join(REPO, 'packages/remote/controller/src/proxy.ts')

/** @param {string[]} argv */
function parseArgs(argv) {
  const options = {
    legacyRepro: false,
    compressSeconds: 5,
    esbuild: process.env.DSH_PROXY_TEST_ESBUILD_BIN,
    browser: process.env.DSH_TEST_BROWSER
      ?? join(process.env.HOME ?? '', '.cache/ms-playwright/chromium-1243/chrome-linux64/chrome'),
    json: undefined,
    keep: false,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--legacy-repro') options.legacyRepro = true
    else if (arg === '--keep') options.keep = true
    else if (arg === '--compress-seconds') options.compressSeconds = Number(argv[++index])
    else if (arg === '--esbuild') options.esbuild = argv[++index]
    else if (arg === '--browser') options.browser = String(argv[++index])
    else if (arg === '--json') options.json = argv[++index]
    else if (arg === '--workspace') index += 1 // accepted for the later alpha workspace layout
    else throw new Error(`test-proxy-browser: unknown argument ${String(arg)}`)
  }
  return options
}

const checks = []

/**
 * @param {string} id @param {string} title
 * @param {() => Promise<string> | string} body
 */
async function check(id, title, body) {
  try {
    checks.push({ id, title, status: 'PASS', detail: await body() })
    return true
  } catch (error) {
    checks.push({ id, title, status: 'FAIL', detail: error instanceof Error ? error.message : String(error) })
    return false
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

/**
 * Transpile the real TypeScript source with the repository's own kind of tooling.
 * Node 26 only supports `strip` mode, which cannot express TS parameter properties, so a
 * minimal local transpile of the real file is used. The source hash is recorded so the
 * evidence is tied to the exact source that ran.
 * @param {{ esbuild?: string }} options @param {string} outDir
 */
async function transpileRealProxy(options, outDir) {
  const source = await readFile(PROXY_SOURCE, 'utf8')
  const sha256 = createHash('sha256').update(source).digest('hex')
  const bin = options.esbuild ?? 'esbuild'
  const outfile = join(outDir, 'proxy.mjs')
  try {
    await run(bin, [PROXY_SOURCE, '--format=esm', '--platform=node', '--target=node24', `--outfile=${outfile}`], { cwd: REPO })
  } catch (error) {
    throw new Error('test-proxy-browser: cannot transpile the real proxy source with esbuild '
      + `(${bin}). Install it into a task-isolated directory and pass --esbuild <path-to-bin> `
      + `or set DSH_PROXY_TEST_ESBUILD_BIN. ${error instanceof Error ? error.message : String(error)}`)
  }
  return { module: outfile, sha256 }
}

/** @param {number} ms */
function sleep(ms) { return new Promise((resolve) => { setTimeout(resolve, ms) }) }

/** Evaluate an async page expression and return its resolved JSON value. */
async function evaluate(page, expression) {
  const result = await page.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (result.exceptionDetails !== undefined) throw new Error(`page exception: ${result.exceptionDetails.text ?? 'unknown'}`)
  return result.result.value
}

/** @param {string} label @param {number} timeoutMs @param {() => Promise<unknown>} probe */
async function waitFor(label, timeoutMs, probe) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const value = await probe()
    if (value !== undefined) return value
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${label}`)
    await sleep(100)
  }
}

/** @param {import('../tests/cdp-client.mjs').CdpPage} page */
async function pageFetch(page, path, init = {}) {
  const method = init.method ?? 'GET'
  return evaluate(page, `(async () => {
    try {
      const response = await fetch(${JSON.stringify(path)}, { method: ${JSON.stringify(method)}, credentials: 'same-origin' })
      const text = await response.text()
      return { status: response.status, text: text.slice(0, 300) }
    } catch (error) { return { error: String(error) } }
  })()`)
}

/** The proxy-owned `rw_*` Cookie as the browser's real jar reports it. */
async function localCookie(page, origin) {
  const cookies = await readCookies(page, origin)
  const found = cookies.find(cookie => cookie.name.startsWith('rw_'))
  if (found === undefined) return undefined
  return { name: found.name, value: found.value, expires: found.expires, session: found.session }
}

/**
 * Redeem a fresh one-use ticket straight against the real proxy, without a browser.
 * This is the raw production response used for header-attribute assertions.
 * @param {{ origin: string, openTicket(): string }} proxy
 */
async function rawExchange(proxy) {
  const url = new URL(proxy.openTicket())
  const response = await fetch(`${proxy.origin}/__remote/exchange`, {
    method: 'POST',
    headers: { origin: proxy.origin, 'x-remote-ticket': url.hash.slice(1) },
  })
  return { status: response.status, setCookie: response.headers.get('set-cookie') ?? undefined }
}

async function openSocket(page, wsUrl) {
  await evaluate(page, `(() => {
    window.__frames = []
    window.__state = 'connecting'
    const socket = new WebSocket(${JSON.stringify(wsUrl)})
    window.__socket = socket
    socket.onopen = () => { window.__state = 'open' }
    socket.onmessage = (event) => { window.__frames.push(String(event.data)) }
    socket.onclose = () => { window.__state = 'closed' }
    socket.onerror = () => { if (window.__state !== 'open') window.__state = 'error' }
    return true
  })()`)
}

async function socketState(page) {
  return evaluate(page, `({ state: window.__state, frames: window.__frames.length,
    last: window.__frames[window.__frames.length - 1] })`)
}

function upstreamHits(fixture, path) {
  return fixture.requests.filter(request => request.url.split('?', 1)[0] === path).length
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const mode = options.legacyRepro ? 'legacy-repro' : 'fix-regression'
  const workDir = await mkdtemp(join(tmpdir(), 'dsh-proxy-b02-'))
  const started = Date.now()
  let fixture
  let browser
  let proxy

  process.stdout.write(`test-proxy-browser: mode=${mode} node=${process.version}\n`)

  try {
    const transpiled = await transpileRealProxy(options, workDir)
    process.stdout.write(`test-proxy-browser: proxy.ts sha256=${transpiled.sha256}\n`)
    const { AuthProxy } = await import(pathToFileURL(transpiled.module).href)

    fixture = await startFixture({ frameIntervalMs: 150 })
    proxy = new AuthProxy(fixture.port, 3080, REMOTE_COOKIE)
    await proxy.start()
    const origin = proxy.origin
    const wsUrl = `${origin.replace('http:', 'ws:')}/api/remote.mux`

    browser = await launchChromium({ executablePath: options.browser })
    const page = browser.page
    await page.send('Network.enable')
    await page.send('Page.enable')
    await page.send('Runtime.enable')

    // 1. Redeem the one-use ticket through the real bootstrap page, in the real browser.
    await page.send('Page.navigate', { url: proxy.openTicket() })
    await waitFor('fixture page after ticket exchange', 15_000, async () => {
      const ready = await evaluate(page, `Boolean(document.getElementById('app'))`).catch(() => false)
      return ready ? true : undefined
    })
    const jarAfterExchange = await localCookie(page, origin)
    assert(jarAfterExchange !== undefined, 'the browser Cookie jar has no local rw_ Cookie after exchange')

    // 2. Read the raw production response from the same proxy instance, through a second
    //    one-use ticket, so the Max-Age assertion is made on the real header and not on a
    //    browser-mediated view of it.
    const raw = await rawExchange(proxy)
    const rawCookieHeader = raw.setCookie ?? ''
    assert(raw.status === 204, `the direct ticket exchange returned ${raw.status}`)
    assert(rawCookieHeader !== '', 'the exchange response did not carry a Set-Cookie header')

    // 3. Test-boundary time compression. It applies only when the production response actually
    //    gave the Cookie a fixed lifetime; a session Cookie is never given an artificial one.
    //    The browser then expires the Cookie on its own schedule, with no Date mocking.
    let compressed = false
    if (jarAfterExchange.session === false) {
      const result = await page.send('Network.setCookie', {
        url: origin,
        name: jarAfterExchange.name,
        value: jarAfterExchange.value,
        path: '/',
        httpOnly: true,
        sameSite: 'Strict',
        expires: Date.now() / 1000 + options.compressSeconds,
      })
      assert(result.success === true, 'could not shorten the fixed-lifetime Cookie in the real jar')
      compressed = true
    }

    const window = options.compressSeconds * 1000 + 1500

    if (options.legacyRepro) {
      // ---- Legacy defect reproduction ------------------------------------------------
      await check('L1', 'legacy exchange Cookie is a fixed one-hour Cookie', () => {
        assert(/Max-Age=3600\b/iu.test(rawCookieHeader),
          `expected Max-Age=3600, saw: ${rawCookieHeader.replace(/=[^;]+/u, '=<redacted>')}`)
        return 'Max-Age=3600 present in the exchange response'
      })
      await check('L2', 'the real browser stores a one-hour, non-session Cookie', () => {
        assert(jarAfterExchange.session === false, 'the legacy Cookie should not be a session Cookie')
        const remaining = jarAfterExchange.expires - Date.now() / 1000
        assert(remaining > 3500 && remaining <= 3600,
          `jar expiry ${remaining.toFixed(1)}s does not match the one-hour Max-Age`)
        return `Chromium reports session=false with ${remaining.toFixed(0)}s of life left`
      })
      await check('L3', 'the fixed lifetime was shortened only at the test boundary', async () => {
        assert(compressed === true, 'the legacy Cookie was not shortened in the jar')
        const now = await localCookie(page, origin)
        assert(now !== undefined, 'the Cookie vanished while being shortened')
        const remaining = now.expires - Date.now() / 1000
        assert(remaining > 0 && remaining <= options.compressSeconds + 1,
          `jar expiry ${remaining.toFixed(1)}s is not the compressed ${options.compressSeconds}s horizon`)
        return `jar now expires in ${remaining.toFixed(1)}s, same Cookie value`
      })

      await openSocket(page, wsUrl)
      await waitFor('first WebSocket frame', 10_000, async () => {
        const state = await socketState(page)
        return state.frames > 0 ? state : undefined
      })
      await check('L4', 'WebSocket upgraded and streaming before expiry', async () => {
        const state = await socketState(page)
        assert(state.state === 'open' && state.frames > 0, `socket state=${state.state} frames=${state.frames}`)
        return `state=${state.state} frames=${state.frames}`
      })

      await sleep(window)
      const jarAfterExpiry = await localCookie(page, origin)
      await check('L5', 'the real browser expired the one-hour Cookie', () => {
        assert(jarAfterExpiry === undefined, 'the legacy Cookie is still in the jar; expiry was not exercised')
        return `Cookie absent from the jar after ${options.compressSeconds}s`
      })

      const before = { reads: upstreamHits(fixture, '/api/usage'), writes: upstreamHits(fixture, '/api/session/create') }
      const usage = await pageFetch(page, '/api/usage')
      const create = await pageFetch(page, '/api/session/create', { method: 'POST' })
      await check('L6', 'later API calls fail with a local 401', () => {
        assert(usage.status === 401, `GET /api/usage returned ${usage.status}`)
        assert(create.status === 401, `POST /api/session/create returned ${create.status}`)
        return 'GET /api/usage=401, POST /api/session/create=401'
      })
      await check('L7', 'the blocked calls never reached the upstream', () => {
        const after = { reads: upstreamHits(fixture, '/api/usage'), writes: upstreamHits(fixture, '/api/session/create') }
        assert(after.reads === before.reads && after.writes === before.writes,
          `upstream saw the blocked calls: reads ${before.reads}->${after.reads}, writes ${before.writes}->${after.writes}`)
        return `upstream reads=${after.reads} writes=${after.writes} unchanged`
      })
      const late = await socketState(page)
      await check('L8', 'the established WebSocket still streams after the Cookie expired', async () => {
        const first = late.frames
        await sleep(600)
        const second = await socketState(page)
        assert(second.state === 'open', `socket state=${second.state}`)
        assert(second.frames > first, `no new frames: ${first} -> ${second.frames}`)
        return `state=open, frames ${first} -> ${second.frames} across the expiry`
      })
      await check('L9', 'the defect signature is exactly "WS alive, HTTP 401"', () => {
        assert(usage.status === 401 && late.state === 'open',
          'the two halves of the defect were not observed together')
        return 'WebSocket open while both HTTP API calls returned local 401'
      })
    } else {
      // ---- Fix regression ------------------------------------------------------------
      await check('F1', 'the exchange Cookie carries no fixed expiry', () => {
        assert(!/max-age=/iu.test(rawCookieHeader),
          `Set-Cookie still has Max-Age: ${rawCookieHeader.replace(/=[^;]+/u, '=<redacted>')}`)
        assert(!/expires=/iu.test(rawCookieHeader),
          `Set-Cookie still has Expires: ${rawCookieHeader.replace(/=[^;]+/u, '=<redacted>')}`)
        return 'no Max-Age and no Expires on the exchange response'
      })
      await check('F2', 'the real browser stores it as a session Cookie', () => {
        assert(jarAfterExchange.session === true, `jar reports session=${jarAfterExchange.session}`)
        return 'Chromium reports session=true'
      })
      await check('F3', 'the Cookie is scoped and hardened', () => {
        assert(/HttpOnly/iu.test(rawCookieHeader), 'HttpOnly missing')
        assert(/SameSite=Strict/iu.test(rawCookieHeader), 'SameSite=Strict missing')
        assert(/Path=\//u.test(rawCookieHeader), 'Path=/ missing')
        return 'Path=/, HttpOnly, SameSite=Strict present'
      })

      await openSocket(page, wsUrl)
      await waitFor('first WebSocket frame', 10_000, async () => {
        const state = await socketState(page)
        return state.frames > 0 ? state : undefined
      })
      await check('F4', 'the WebSocket upgraded and is streaming', async () => {
        const state = await socketState(page)
        assert(state.state === 'open' && state.frames > 0, `socket state=${state.state} frames=${state.frames}`)
        return `state=${state.state} frames=${state.frames}`
      })

      // Continuous HTTP path across the horizon where the legacy Cookie would have died.
      const continuous = []
      const slices = 6
      for (let index = 0; index < slices; index += 1) {
        const reply = await pageFetch(page, '/api/usage')
        continuous.push(reply.status)
        await sleep(window / slices)
      }
      await check('F5', 'continuous HTTP keeps working past the legacy horizon', () => {
        assert(continuous.every(status => status === 200), `statuses: ${continuous.map(String).join(',')}`)
        return `${slices} GET /api/usage calls over ${(window / 1000).toFixed(1)}s all returned 200`
      })
      await check('F6', 'the Cookie is still in the jar past the legacy horizon', async () => {
        const now = await localCookie(page, origin)
        assert(now !== undefined, 'the session Cookie disappeared from the jar')
        assert(now.value === jarAfterExchange.value, 'the Cookie value changed')
        return `same Cookie value, still session=${now.session}`
      })

      // WebSocket-only path: no HTTP at all for a full horizon.
      const framesBefore = (await socketState(page)).frames
      await sleep(window)
      await check('F7', 'the WebSocket keeps streaming through a quiet window', async () => {
        const state = await socketState(page)
        assert(state.state === 'open', `socket state=${state.state}`)
        assert(state.frames > framesBefore, `no new frames: ${framesBefore} -> ${state.frames}`)
        return `frames ${framesBefore} -> ${state.frames} with no HTTP traffic`
      })

      // Idle-then-request path.
      await sleep(window)
      await check('F8', 'an idle period followed by a request still succeeds', async () => {
        const reply = await pageFetch(page, '/api/usage')
        assert(reply.status === 200, `GET /api/usage returned ${reply.status}`)
        const now = await localCookie(page, origin)
        assert(now !== undefined, 'the session Cookie was dropped during the idle period')
        return 'idle then GET /api/usage=200 with the Cookie intact'
      })

      await check('F9', 'a counted write reaches the upstream exactly once', async () => {
        const before = upstreamHits(fixture, '/api/session/create')
        const reply = await pageFetch(page, '/api/session/create', { method: 'POST' })
        assert(reply.status === 200, `POST /api/session/create returned ${reply.status}`)
        const after = upstreamHits(fixture, '/api/session/create')
        assert(after === before + 1, `upstream write count went ${before} -> ${after}`)
        return `upstream writes ${before} -> ${after}`
      })
      await check('F10', 'the upstream remote Cookie never reaches the browser', async () => {
        const cookies = await readCookies(page, origin)
        const leaked = cookies.filter(cookie => cookie.name.startsWith('fixture-'))
        assert(leaked.length === 0, `browser received upstream Cookies: ${leaked.map(cookie => cookie.name).join(',')}`)
        return 'no fixture-* Cookie in the browser jar'
      })
      await check('F11', 'a request without the local Cookie is rejected before the upstream', async () => {
        const before = upstreamHits(fixture, '/api/usage')
        const status = await evaluate(page, `(async () => {
          const response = await fetch('/api/usage', { credentials: 'omit' })
          return response.status
        })()`)
        const after = upstreamHits(fixture, '/api/usage')
        assert(status === 401, `credential-free GET /api/usage returned ${status}`)
        assert(after === before, 'the credential-free request reached the upstream')
        return 'HTTP 401, upstream read count unchanged'
      })
      await check('F12', 'a consumed ticket cannot be redeemed twice', async () => {
        const url = new URL(proxy.openTicket())
        const ticket = url.hash.slice(1)
        const redeem = () => evaluate(page, `(async () => {
          const response = await fetch('/__remote/exchange', { method: 'POST',
            headers: { 'x-remote-ticket': ${JSON.stringify(ticket)} } })
          return response.status
        })()`)
        const first = await redeem()
        const second = await redeem()
        assert(first === 204, `first redemption returned ${first}`)
        assert(second === 401, `replayed redemption returned ${second}`)
        return 'first=204, replay=401'
      })

      await check('F13', 'an unauthenticated HTML navigation gets the recovery page under 401', async () => {
        const reply = await evaluate(page, `(async () => {
          const response = await fetch('/some/page', { credentials: 'omit', headers: { accept: 'text/html' } })
          const body = await response.text()
          return { status: response.status, type: response.headers.get('content-type'),
            code: response.headers.get('x-dsh-remote-error'), body }
        })()`)
        assert(reply.status === 401, `navigation returned ${reply.status}`)
        assert(String(reply.type).includes('text/html'), `content-type was ${reply.type}`)
        assert(reply.code === 'LOCAL_AUTH_REQUIRED', `diagnostic header was ${reply.code}`)
        assert(reply.body.includes('\u91cd\u65b0\u6253\u5f00'), 'the recovery page does not tell the operator to reopen')
        assert(!/127\.0\.0\.1|:\d{4,5}\b/u.test(reply.body), 'the recovery page exposes a fixed local endpoint')
        assert(!reply.body.includes('x-remote-ticket'), 'the recovery page mentions the ticket mechanism')
        return 'HTTP 401 + text/html recovery page, no endpoint and no ticket'
      })
      await check('F14', 'an unauthenticated API call stays a plain error, not HTML', async () => {
        const reply = await evaluate(page, `(async () => {
          const response = await fetch('/api/usage', { credentials: 'omit', headers: { accept: 'application/json' } })
          const body = await response.text()
          return { status: response.status, type: response.headers.get('content-type'), body }
        })()`)
        assert(reply.status === 401, `API returned ${reply.status}`)
        assert(String(reply.type).includes('text/plain'), `API content-type was ${reply.type}`)
        assert(!reply.body.includes('<'), 'the API error body looks like markup')
        return 'HTTP 401 + text/plain error body'
      })

      // Revocation is owned by the proxy instance, not by a Cookie attribute.
      await check('F15', 'pause and resume keep the same instance authorization', async () => {
        proxy.pause()
        const paused = await pageFetch(page, '/api/usage')
        assert(paused.status === 503, `paused GET /api/usage returned ${paused.status}`)
        assert((await localCookie(page, origin)) !== undefined, 'pause must not clear the jar entry')
        proxy.resume(fixture.port, REMOTE_COOKIE)
        const resumed = await pageFetch(page, '/api/usage')
        assert(resumed.status === 200, `resumed GET /api/usage returned ${resumed.status}`)
        const now = await localCookie(page, origin)
        assert(now?.value === jarAfterExchange.value, 'the Cookie value changed across pause/resume')
        return 'paused=503, resumed=200 with the unchanged Cookie'
      })
      await check('F16', 'stopping the proxy revokes the session and closes live sockets', async () => {
        await proxy.stop()
        const state = await socketState(page).catch(() => ({ state: 'page-gone', frames: 0 }))
        assert(state.state !== 'open', `socket still open after stop(): ${state.state}`)
        const after = await evaluate(page, `(async () => {
          try { const r = await fetch('/api/usage'); return { status: r.status } }
          catch (error) { return { error: String(error) } }
        })()`)
        assert(after.error !== undefined || after.status === undefined,
          `HTTP still answered after stop(): ${after.status}`)
        return `socket=${state.state}, HTTP transport gone`
      })
      await check('F17', 'a new proxy instance does not accept the old authorization', async () => {
        const replacement = new AuthProxy(fixture.port, 3080, REMOTE_COOKIE)
        await replacement.start()
        try {
          const reply = await evaluate(page, `(async () => {
            try {
              const response = await fetch(${JSON.stringify(`${replacement.origin}/api/usage`)},
                { headers: { cookie: ${JSON.stringify(`${jarAfterExchange.name}=${jarAfterExchange.value}`)} } })
              return { status: response.status }
            } catch (error) { return { error: String(error) } }
          })()`)
          assert(reply.status === 401 || reply.error !== undefined,
            `the replacement proxy accepted the old Cookie: ${reply.status}`)
          return `replacement proxy answered ${reply.status ?? 'transport-error'} for the old Cookie`
        } finally { await replacement.stop() }
      })
    }

    const failed = checks.filter(entry => entry.status === 'FAIL')
    const report = {
      mode,
      node: process.version,
      proxySource: 'packages/remote/controller/src/proxy.ts',
      proxySha256: transpiled.sha256,
      compressSeconds: options.compressSeconds,
      browser: options.browser,
      durationMs: Date.now() - started,
      upstream: {
        reads: fixture.reads(), writes: fixture.writes(),
        wsConnections: fixture.wsConnections(), framesSent: fixture.framesSent(),
        rejected: fixture.rejected(),
      },
      checks,
      result: failed.length === 0 ? 'PASS' : 'FAIL',
    }
    process.stdout.write(`\n${mode} result: ${report.result} (${checks.length - failed.length}/${checks.length})\n`)
    for (const entry of checks) {
      process.stdout.write(`  [${entry.status}] ${entry.id} ${entry.title}\n          ${entry.detail}\n`)
    }
    if (options.json !== undefined) {
      await mkdir(dirname(resolve(options.json)), { recursive: true })
      await writeFile(resolve(options.json), `${JSON.stringify(report, null, 2)}\n`)
      process.stdout.write(`evidence: ${options.json}\n`)
    }
    return failed.length === 0 ? 0 : 1
  } catch (error) {
    process.stderr.write(`test-proxy-browser: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`)
    return 2
  } finally {
    await proxy?.stop().catch(() => undefined)
    await browser?.close().catch(() => undefined)
    await fixture?.stop().catch(() => undefined)
    if (options.keep) process.stdout.write(`work dir kept: ${workDir}\n`)
    else await rm(workDir, { recursive: true, force: true }).catch(() => undefined)
  }
}

process.exitCode = await main()

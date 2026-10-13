/**
 * Minimal Chrome DevTools Protocol driver for the B02 browser regression.
 *
 * A real Chromium process owns the Cookie jar; this module only speaks CDP over the
 * browser's own WebSocket endpoint. It intentionally does not depend on Playwright or
 * Puppeteer so the regression cannot silently substitute a simulated cookie store.
 */
import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** One page attached to the browser-level CDP connection. */
export class CdpPage {
  /** @param {CdpConnection} connection @param {string} sessionId */
  constructor(connection, sessionId) {
    this.connection = connection
    this.sessionId = sessionId
    this.listeners = new Set()
  }

  /**
   * @template T
   * @param {string} method
   * @param {Record<string, unknown>} [params]
   * @returns {Promise<T>}
   */
  send(method, params = {}) {
    return this.connection.send(method, params, this.sessionId)
  }

  /** @param {(event: { method: string, params: Record<string, unknown>, sessionId?: string }) => void} listener */
  onEvent(listener) {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  /** @internal @param {{ method: string, params: Record<string, unknown>, sessionId?: string }} event */
  emit(event) { for (const listener of this.listeners) listener(event) }
}

/** Browser-level CDP connection over the browser's own WebSocket endpoint. */
export class CdpConnection {
  /** @param {WebSocket} socket */
  constructor(socket) {
    this.socket = socket
    this.nextId = 1
    this.pending = new Map()
    this.pages = new Map()
    socket.addEventListener('message', (event) => { this.receive(String(event.data)) })
  }

  /** @param {string} url @returns {Promise<CdpConnection>} */
  static async connect(url) {
    const socket = new WebSocket(url)
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', () => { resolve() }, { once: true })
      socket.addEventListener('error', () => { reject(new Error(`cdp: cannot connect to ${url}`)) }, { once: true })
    })
    return new CdpConnection(socket)
  }

  /**
   * @template T
   * @param {string} method
   * @param {Record<string, unknown>} [params]
   * @param {string} [sessionId]
   * @returns {Promise<T>}
   */
  send(method, params = {}, sessionId) {
    const id = this.nextId++
    const payload = { id, method, params }
    if (sessionId !== undefined) payload.sessionId = sessionId
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.socket.send(JSON.stringify(payload))
    })
  }

  /** @param {string} raw */
  receive(raw) {
    const message = JSON.parse(raw)
    if (message.id !== undefined) {
      const pending = this.pending.get(message.id)
      if (pending === undefined) return
      this.pending.delete(message.id)
      if (message.error !== undefined) pending.reject(new Error(`cdp: ${message.error.message ?? 'unknown error'}`))
      else pending.resolve(message.result)
      return
    }
    if (message.method !== undefined && message.sessionId !== undefined) {
      this.pages.get(message.sessionId)?.emit({
        method: message.method, params: message.params ?? {}, sessionId: message.sessionId,
      })
    }
  }

  /** @param {string} [url] @returns {Promise<CdpPage>} */
  async newPage(url = 'about:blank') {
    const target = await this.send('Target.createTarget', { url })
    const attached = await this.send('Target.attachToTarget', { targetId: target.targetId, flatten: true })
    const page = new CdpPage(this, attached.sessionId)
    this.pages.set(attached.sessionId, page)
    return page
  }

  close() { this.socket.close() }
}

/**
 * @param {import('node:child_process').ChildProcess} child
 * @param {number} timeoutMs
 * @returns {Promise<string>}
 */
async function waitForEndpoint(child, timeoutMs) {
  return new Promise((resolve, reject) => {
    let buffer = ''
    const timer = setTimeout(() => { reject(new Error(`chromium: no DevTools endpoint within ${timeoutMs}ms`)) }, timeoutMs)
    const onData = (chunk) => {
      buffer += chunk.toString('utf8')
      const match = /DevTools listening on (ws:\/\/\S+)/u.exec(buffer)
      if (match?.[1] !== undefined) {
        clearTimeout(timer)
        resolve(match[1])
      }
    }
    child.stderr?.on('data', onData)
    child.once('exit', (code) => {
      clearTimeout(timer)
      reject(new Error(`chromium: exited early with code ${code}: ${buffer.slice(-400)}`))
    })
  })
}

/**
 * Launch a real Chromium with an owned temporary profile and a real Cookie jar.
 * @param {{ executablePath: string, headless?: boolean, extraArgs?: string[] }} options
 */
export async function launchChromium(options) {
  const root = await mkdtemp(join(tmpdir(), 'dsh-proxy-browser-'))
  const userDataDir = join(root, 'profile')
  // Chromium aborts before it can report a DevTools endpoint when HOME is read-only
  // (crashpad cannot create its database). Give it a writable, task-owned HOME.
  const homeDir = join(root, 'home')
  await mkdir(userDataDir, { recursive: true })
  await mkdir(homeDir, { recursive: true })
  const args = [
    options.headless === false ? '' : '--headless=new',
    '--remote-debugging-port=0',
    `--user-data-dir=${userDataDir}`,
    '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
    '--disable-component-update', '--disable-sync', '--disable-extensions',
    '--disable-features=Translate,OptimizationHints,MediaRouter',
    '--disable-dev-shm-usage', '--disable-gpu', '--no-sandbox',
    '--window-size=1024,768', 'about:blank',
    ...(options.extraArgs ?? []),
  ].filter(part => part !== '')
  const child = spawn(options.executablePath, args, {
    stdio: ['ignore', 'ignore', 'pipe'],
    env: {
      ...process.env,
      HOME: homeDir,
      XDG_CONFIG_HOME: join(homeDir, '.config'),
      XDG_CACHE_HOME: join(homeDir, '.cache'),
      XDG_DATA_HOME: join(homeDir, '.local/share'),
    },
  })
  const endpoint = await waitForEndpoint(child, 30_000)
  const connection = await CdpConnection.connect(endpoint)
  const page = await connection.newPage()
  return {
    page,
    executablePath: options.executablePath,
    userDataDir,
    pid: () => child.pid,
    async close() {
      try { connection.close() } catch { /* the browser may already be gone */ }
      child.kill('SIGKILL')
      await new Promise((resolve) => { child.once('exit', () => { resolve() }); setTimeout(resolve, 3000) })
      await rm(root, { recursive: true, force: true }).catch(() => undefined)
    },
  }
}

/**
 * Read the browser's own Cookie jar for one URL.
 * @param {CdpPage} page @param {string} url
 */
export async function readCookies(page, url) {
  const result = await page.send('Network.getCookies', { urls: [url] })
  return result.cookies
}

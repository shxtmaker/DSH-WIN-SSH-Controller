/** One-connection loopback reverse proxy with a single-use page ticket. */
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { createServer, request, type IncomingMessage, type ServerResponse, type Server } from 'node:http'
import { connect, type Socket } from 'node:net'
import type { AddressInfo } from 'node:net'
import type { Duplex } from 'node:stream'
import { LOCAL_AUTH_REQUIRED, type RemoteErrorCode } from './errors.ts'

const BOOTSTRAP = '<!doctype html><html><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"></head><body><p>正在打开远程工作区…</p><script src="/__remote/open.js"></script></body></html>'
const BOOTSTRAP_JS = `(() => {
  const ticket = location.hash.slice(1)
  history.replaceState(null, '', '/__remote/open')
  fetch('/__remote/exchange', { method: 'POST', credentials: 'same-origin',
    headers: { 'x-remote-ticket': ticket } })
    .then(response => { if (!response.ok) throw new Error('ticket'); location.replace('/') })
    .catch(() => { document.body.textContent = '打开票据已失效，请回到连接管理页重新打开。' })
})()
`

/**
 * Static page for an HTML navigation that arrives without a local session Cookie.
 * It carries no credential, no ticket, and no fixed control port: it only tells the
 * operator to reopen the workspace from the Controller, which mints a fresh ticket.
 * The response keeps its 401 status.
 */
const RECOVERY = '<!doctype html><html lang="zh"><head><meta charset="utf-8"><meta name="referrer" content="no-referrer">'
  + '<title>远程工作区需要重新打开</title></head><body>'
  + '<h1>此页面已不再持有本地授权</h1>'
  + '<p>远程工作区通过一次性票据换取仅在当前代理实例内有效的本地会话。当前请求没有可用的本地会话 Cookie，因此被拒绝。</p>'
  + '<p>请回到 Controller 的连接管理页，对同一目标选择“重新打开”。重新打开不会中断 SSH 连接，也不会重放此前的业务请求。</p>'
  + '<p>如果重新打开后仍然出现本页，请检查远端 Harness 服务与 SSH 转发是否正常。</p>'
  + '</body></html>'

const HOP_HEADERS = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'transfer-encoding', 'upgrade'])
const REQUEST_DROP = new Set(['host', 'cookie', 'authorization', 'origin', 'referer', 'forwarded',
  'x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto', 'sec-fetch-site', 'x-dsh-remote-error'])
const RESPONSE_DROP = new Set(['set-cookie', 'set-cookie2', 'x-dsh-remote-error'])

/** Fixed diagnostic header the proxy adds only to errors it generated itself. */
const ERROR_HEADER = 'x-dsh-remote-error'

function token(): string { return randomBytes(32).toString('base64url') }

function sameSecret(first: string, second: string): boolean {
  const a = Buffer.from(first), b = Buffer.from(second)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Live proxy-owned HTTP server, session Cookie, tickets, and sockets. */
export class AuthProxy {
  private readonly server: Server
  private readonly sockets = new Set<Socket>()
  private readonly ticketValues = new Map<string, number>()
  private readonly cookieName = `rw_${randomBytes(12).toString('hex')}`
  private readonly cookieValue = token()
  private portValue = 0
  private closed = false
  private paused = false

  /** Codes already reported for this instance, so one scan cannot produce endless notices. */
  private readonly reported = new Set<RemoteErrorCode>()

  /**
   * @param upstreamPort - this plugin's SSH local-forward port.
   * @param remotePort - approved Harness authority port.
   * @param upstreamCookie - Host-only remote session Cookie.
   * @param onError - bounded notification for errors this proxy generated itself. Each fixed
   *   code is reported at most once per instance, so an unauthenticated loopback scan cannot
   *   produce an unbounded stream of events and cannot affect other authenticated pages.
   */
  constructor(private upstreamPort: number, private readonly remotePort: number,
    private upstreamCookie: string, private readonly onError?: (code: RemoteErrorCode) => void) {
    this.server = createServer((req, res) => { this.handle(req, res) })
    this.server.on('upgrade', (req, socket, head) => { this.upgrade(req, socket, head) })
    this.server.on('connection', (socket) => {
      this.sockets.add(socket)
      socket.once('close', () => { this.sockets.delete(socket) })
    })
  }

  /** @returns the bound local origin after start. */
  get origin(): string { return `http://127.0.0.1:${String(this.portValue)}` }

  /** Bind only loopback on an OS-assigned port. */
  async start(): Promise<void> {
    if (this.closed || this.portValue !== 0) throw new Error('remote-workspace: proxy already started')
    await new Promise<void>((resolve, reject) => {
      this.server.once('error', reject)
      this.server.listen(0, '127.0.0.1', () => {
        this.server.off('error', reject)
        this.portValue = (this.server.address() as AddressInfo).port
        resolve()
      })
    })
  }

  /** @returns a 30-second, one-use fragment URL; the remote token is absent. */
  openTicket(): string {
    if (this.closed || this.paused || this.portValue === 0) throw new Error('remote-workspace: proxy unavailable')
    for (const [value, expiry] of this.ticketValues) {
      if (expiry < Date.now()) this.ticketValues.delete(value)
    }
    if (this.ticketValues.size >= 16) throw new Error('remote-workspace: too many pending open tickets')
    const value = token()
    this.ticketValues.set(value, Date.now() + 30_000)
    return `${this.origin}/__remote/open#${value}`
  }

  /** Keep the Browser origin while severing the old, unauthenticated transport. */
  pause(): void {
    if (this.closed) return
    this.paused = true
    this.ticketValues.clear()
    this.upstreamPort = 0
    this.upstreamCookie = ''
    for (const socket of this.sockets) socket.destroy()
  }

  /** Resume only after SSH discovery, token exchange, identity, and event checks pass. */
  resume(upstreamPort: number, upstreamCookie: string): void {
    if (this.closed || !this.paused || upstreamPort < 1 || upstreamCookie.length === 0)
      throw new Error('remote-workspace: proxy cannot resume')
    this.upstreamPort = upstreamPort
    this.upstreamCookie = upstreamCookie
    this.paused = false
  }

  /** Revoke sessions, tickets, and every owned transport without touching SSH or Harness. */
  async stop(): Promise<void> {
    if (this.closed) return
    this.closed = true
    this.ticketValues.clear()
    const done = new Promise<void>((resolve) => { this.server.close(() =>{  resolve() }) })
    for (const socket of this.sockets) socket.destroy()
    await done
  }

  private trusted(req: IncomingMessage, requireOrigin = false): boolean {
    if (this.closed || req.headers.host !== new URL(this.origin).host
      || req.headers['sec-fetch-site'] === 'cross-site') return false
    const origin = req.headers.origin
    if (requireOrigin && origin !== this.origin) return false
    return origin === undefined || origin === this.origin
  }

  private authenticated(req: IncomingMessage): boolean {
    const header = req.headers.cookie
    if (header === undefined) return false
    const parts = header.split(';').map(part => part.trim())
    const matched = parts.filter(part => part.startsWith(`${this.cookieName}=`))
    const entry = matched[0]
    return matched.length === 1 && entry !== undefined
      && sameSecret(entry.slice(this.cookieName.length + 1), this.cookieValue)
  }

  /** @param code - fixed code to report once per proxy instance. */
  private report(code: RemoteErrorCode): void {
    if (this.reported.has(code)) return
    this.reported.add(code)
    try { this.onError?.(code) } catch { /* a listener must never break the proxy */ }
  }

  private reject(res: ServerResponse, code: number, error?: RemoteErrorCode): void {
    const headers: Record<string, string> = { 'cache-control': 'no-store', 'content-type': 'text/plain; charset=utf-8' }
    if (error !== undefined) { headers[ERROR_HEADER] = error; this.report(error) }
    res.writeHead(code, headers)
    res.end('remote workspace access denied')
  }

  /**
   * Refuse a request that carries no usable local authorization.
   *
   * An HTML navigation gets the static recovery page, still under 401. Anything else keeps a
   * plain error: an API or write call must never be answered with a 200 or with login HTML.
   */
  private unauthorized(req: IncomingMessage, res: ServerResponse): void {
    const navigation = (req.method === 'GET' || req.method === 'HEAD')
      && (req.headers.accept ?? '').includes('text/html')
    if (!navigation) { this.reject(res, 401, LOCAL_AUTH_REQUIRED); return }
    this.report(LOCAL_AUTH_REQUIRED)
    res.writeHead(401, {
      'cache-control': 'no-store',
      [ERROR_HEADER]: LOCAL_AUTH_REQUIRED,
      'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'",
      'content-type': 'text/html; charset=utf-8',
      'referrer-policy': 'no-referrer',
    })
    res.end(RECOVERY)
  }

  private handle(req: IncomingMessage, res: ServerResponse): void {
    if (!this.trusted(req) || req.url === undefined || !req.url.startsWith('/') || req.url.startsWith('//')
      || req.method === 'CONNECT') { this.reject(res, 403, 'FORBIDDEN'); return }
    if (this.paused) { this.reject(res, 503, 'PROXY_PAUSED'); return }
    if (req.method === 'GET' && req.url === '/__remote/open') {
      res.writeHead(200, { 'cache-control': 'no-store', 'content-security-policy': "default-src 'none'; script-src 'self'; connect-src 'self'", 'content-type': 'text/html; charset=utf-8', 'referrer-policy': 'no-referrer' })
      res.end(BOOTSTRAP)
      return
    }
    if (req.method === 'GET' && req.url === '/__remote/open.js') {
      res.writeHead(200, { 'cache-control': 'no-store', 'content-type': 'text/javascript; charset=utf-8' })
      res.end(BOOTSTRAP_JS)
      return
    }
    if (req.method === 'POST' && req.url === '/__remote/exchange') {
      if (!this.trusted(req, true) || req.headers['sec-fetch-site'] === 'cross-site'
        || (req.headers['content-length'] !== undefined && req.headers['content-length'] !== '0')) {
        this.reject(res, 403, 'FORBIDDEN'); return
      }
      const value = req.headers['x-remote-ticket']
      if (typeof value !== 'string') { this.reject(res, 401, LOCAL_AUTH_REQUIRED); return }
      const expiry = this.ticketValues.get(value)
      this.ticketValues.delete(value)
      if (expiry === undefined || expiry < Date.now()) { this.reject(res, 401, LOCAL_AUTH_REQUIRED); return }
      // A session Cookie: no Max-Age and no Expires. Its server-side validity is the lifetime
      // of this AuthProxy instance, so a long-lived page keeps working while the operator keeps
      // the connection open. Revocation is `pause()` / `stop()` plus instance replacement, not
      // a client-side clock. Browser session restore may keep the Cookie; the server decides.
      res.writeHead(204, {
        'cache-control': 'no-store',
        'set-cookie': `${this.cookieName}=${this.cookieValue}; Path=/; HttpOnly; SameSite=Strict`,
      })
      res.end()
      return
    }
    if (req.url.startsWith('/__remote/')) { this.reject(res, 404, 'NOT_FOUND'); return }
    if (!this.authenticated(req)) { this.unauthorized(req, res); return }
    this.proxyHttp(req, res)
  }

  private requestHeaders(req: IncomingMessage): Record<string, string | string[]> {
    const headers: Record<string, string | string[]> = {}
    for (const [key, value] of Object.entries(req.headers)) {
      if (value !== undefined && !HOP_HEADERS.has(key) && !REQUEST_DROP.has(key)
        && !key.startsWith('proxy-') && !key.startsWith('x-forwarded-')) headers[key] = value
    }
    headers.host = `127.0.0.1:${String(this.remotePort)}`
    headers.cookie = this.upstreamCookie
    if (req.headers.origin !== undefined) headers.origin = `http://127.0.0.1:${String(this.remotePort)}`
    if (req.headers['sec-fetch-site'] !== undefined) headers['sec-fetch-site'] = 'same-origin'
    return headers
  }

  private proxyHttp(req: IncomingMessage, res: ServerResponse): void {
    const upstream = request({ host: '127.0.0.1', port: this.upstreamPort, method: req.method,
      path: req.url, headers: this.requestHeaders(req), timeout: 60_000 }, (incoming) => {
      const headers: Record<string, string | string[]> = {}
      for (const [key, value] of Object.entries(incoming.headers)) {
        if (value !== undefined && !HOP_HEADERS.has(key) && !RESPONSE_DROP.has(key)) headers[key] = value
      }
      const location = incoming.headers.location
      Reflect.deleteProperty(headers, 'location')
      if (location !== undefined) {
        try {
          const remote = `http://127.0.0.1:${String(this.remotePort)}`
          const url = new URL(location, remote)
          if (url.origin === remote) headers.location = `${url.pathname}${url.search}${url.hash}`
        } catch { /* An invalid redirect never leaves the fixed local origin. */ }
      }
      res.writeHead(incoming.statusCode ?? 502, headers)
      incoming.pipe(res)
    })
    upstream.once('timeout', () => upstream.destroy(new Error('remote-workspace: upstream timeout')))
    upstream.once('error', () => { if (!res.headersSent) this.reject(res, 502, 'UPSTREAM_UNREACHABLE'); else res.destroy() })
    req.once('aborted', () => upstream.destroy())
    res.once('close', () => upstream.destroy())
    req.pipe(upstream)
  }

  private upgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void {
    const path = req.url
    const missingAuth = !this.authenticated(req)
    if (this.paused || !this.trusted(req, true) || missingAuth || path !== '/api/remote.mux'
      || req.headers.upgrade?.toLowerCase() !== 'websocket'
      || typeof req.headers['sec-websocket-key'] !== 'string') {
      // The same fixed code as the HTTP path, so a page can tell "authorization is gone" from
      // "the proxy is paused" without parsing a localized message.
      const code: RemoteErrorCode = missingAuth ? LOCAL_AUTH_REQUIRED : this.paused ? 'PROXY_PAUSED' : 'FORBIDDEN'
      this.report(code)
      socket.end(`HTTP/1.1 403 Forbidden\r\nConnection: close\r\n${ERROR_HEADER}: ${code}\r\n\r\n`)
      return
    }
    const upstream = connect({ host: '127.0.0.1', port: this.upstreamPort })
    const authority = `127.0.0.1:${String(this.remotePort)}`
    upstream.once('connect', () => {
      const headers = this.requestHeaders(req)
      headers.origin = `http://${authority}`
      headers.upgrade = 'websocket'
      headers.connection = 'Upgrade'
      const lines = [`GET ${path} HTTP/1.1`, ...Object.entries(headers).map(([name, value]) => `${name}: ${Array.isArray(value) ? value.join(', ') : value}`), '', '']
      upstream.write(lines.join('\r\n'))
      if (head.length > 0) upstream.write(head)
      let response = Buffer.alloc(0)
      const handshake = (chunk: Buffer): void => {
        response = Buffer.concat([response, chunk])
        if (response.length > 16_384) { close(); return }
        const boundary = response.indexOf('\r\n\r\n')
        if (boundary < 0) return
        upstream.off('data', handshake)
        const lines = response.subarray(0, boundary).toString('latin1').split('\r\n')
        if (!/^HTTP\/1\.[01] 101\b/u.test(lines[0] ?? '')) { close(); return }
        const safe = lines.filter(line => !/^set-cookie2?:/iu.test(line))
        socket.write(safe.join('\r\n') + '\r\n\r\n')
        const remaining = response.subarray(boundary + 4)
        if (remaining.length > 0) socket.write(remaining)
        upstream.pipe(socket)
        socket.pipe(upstream)
      }
      upstream.on('data', handshake)
    })
    const close = (): void => { upstream.destroy(); socket.destroy() }
    upstream.once('error', close)
    socket.once('error', close)
    upstream.once('close', () => socket.destroy())
    socket.once('close', () => upstream.destroy())
  }
}

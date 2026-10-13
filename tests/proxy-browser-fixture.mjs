/**
 * B02 non-billing upstream fixture.
 *
 * This is a test double, not the real Harness. It exists so the AuthProxy can be
 * exercised end to end with a real browser while the only variable under test is
 * the proxy's own local authentication lifetime.
 *
 * It deliberately uses no third-party dependency: the WebSocket handshake and the
 * server-to-client frames are written directly, so the regression runs without a
 * prepared Harness workspace or an installed node_modules tree.
 */
import { createHash, randomUUID } from 'node:crypto'
import { createServer } from 'node:http'

/** Host-only remote session Cookie the fixture accepts. Never a real credential. */
export const REMOTE_COOKIE = 'fixture-remote-session=remote-secret-value'

/** Header value the proxy must not leak into the browser. */
export const REMOTE_COOKIE_NAME = 'fixture-remote-session'

function json(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(payload)
}

function acceptKey(key) {
  return createHash('sha1').update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64')
}

/** One unmasked, unfragmented text frame; server-to-client frames are never masked. */
function textFrame(text) {
  const payload = Buffer.from(text, 'utf8')
  if (payload.length < 126) return Buffer.concat([Buffer.from([0x81, payload.length]), payload])
  const header = Buffer.alloc(4)
  header[0] = 0x81
  header[1] = 126
  header.writeUInt16BE(payload.length, 2)
  return Buffer.concat([header, payload])
}

export async function startFixture(options = {}) {
  const frameIntervalMs = options.frameIntervalMs ?? 150
  const requests = []
  const identity = { instanceId: `fixture-${randomUUID()}`, bootId: randomUUID() }
  const sockets = new Set()
  const timers = new Set()
  let readCount = 0
  let writeCount = 0
  let wsCount = 0
  let frameCount = 0
  let rejectCount = 0

  const server = createServer((req, res) => {
    const cookie = req.headers.cookie
    requests.push({
      method: req.method ?? '', url: req.url ?? '', cookie,
      origin: req.headers.origin, host: req.headers.host,
      upstreamAuth: req.headers.authorization,
    })
    const path = (req.url ?? '').split('?', 1)[0] ?? ''
    if (path.startsWith('/api/') && cookie !== REMOTE_COOKIE) {
      rejectCount += 1
      json(res, 401, { error: 'fixture: upstream session required' })
      return
    }
    if (path === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
      res.end('<!doctype html><html><head><meta charset="utf-8"><title>fixture harness</title></head><body><p id="app">fixture-harness-ready</p></body></html>')
      return
    }
    if (path === '/api/usage') {
      readCount += 1
      json(res, 200, { ok: true, usage: { inputTokens: 11, outputTokens: 7 } })
      return
    }
    if (path === '/api/session/create' && req.method === 'POST') {
      writeCount += 1
      json(res, 200, { ok: true, sessionId: `session-${String(writeCount)}` })
      return
    }
    if (path === '/api/remote-workspace/identity') {
      json(res, 200, { instanceId: identity.instanceId, bootId: identity.bootId, profile: 'fixture', port: 0 })
      return
    }
    // The proxy must strip upstream Set-Cookie headers; this proves it.
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'set-cookie': 'fixture-leak=must-not-reach-browser' })
    res.end('fixture')
  })

  server.on('upgrade', (req, socket) => {
    const cookie = req.headers.cookie
    requests.push({
      method: 'GET', url: req.url ?? '', cookie,
      origin: req.headers.origin, host: req.headers.host,
      upstreamAuth: req.headers.authorization,
    })
    const key = req.headers['sec-websocket-key']
    const path = (req.url ?? '').split('?', 1)[0] ?? ''
    if (path !== '/api/remote.mux' || typeof key !== 'string' || cookie !== REMOTE_COOKIE) {
      rejectCount += 1
      socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n')
      return
    }
    wsCount += 1
    sockets.add(socket)
    socket.on('data', () => { /* client frames are irrelevant to this fixture */ })
    socket.on('close', () => { sockets.delete(socket) })
    socket.on('error', () => { sockets.delete(socket) })
    socket.write([
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${acceptKey(key)}`,
      'set-cookie: fixture-ws-leak=must-not-reach-browser',
      '', '',
    ].join('\r\n'))
    const timer = setInterval(() => {
      if (socket.destroyed) return
      frameCount += 1
      socket.write(textFrame(JSON.stringify({ type: 'tick', n: frameCount })))
    }, frameIntervalMs)
    timers.add(timer)
    socket.on('close', () => { clearInterval(timer); timers.delete(timer) })
  })

  server.listen(0, '127.0.0.1')
  await new Promise((resolve) => { server.once('listening', () => { resolve() }) })
  const address = server.address()
  if (typeof address !== 'object' || address === null) throw new Error('fixture: missing port')

  return {
    port: address.port,
    origin: `http://127.0.0.1:${String(address.port)}`,
    requests,
    identity,
    reads: () => readCount,
    writes: () => writeCount,
    wsConnections: () => wsCount,
    framesSent: () => frameCount,
    openSockets: () => sockets.size,
    rejected: () => rejectCount,
    async stop() {
      for (const timer of timers) clearInterval(timer)
      timers.clear()
      for (const socket of sockets) socket.destroy()
      sockets.clear()
      await new Promise((resolve) => { server.close(() => { resolve() }) })
    },
  }
}

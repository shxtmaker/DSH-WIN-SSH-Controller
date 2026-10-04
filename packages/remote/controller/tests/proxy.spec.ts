import { createServer, request, type Server } from 'node:http'
import { once } from 'node:events'
import { afterEach, describe, expect, it } from 'vitest'
import WebSocket, { WebSocketServer } from 'ws'
import { AuthProxy } from '../src/proxy.ts'

const servers: Server[] = []
const proxies: AuthProxy[] = []

afterEach(async () => {
  await Promise.all(proxies.splice(0).map(proxy => proxy.stop()))
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() =>{  resolve() }))))
})

interface CapturedRequest {
  readonly cookie: string | undefined
  readonly host: string | undefined
  readonly origin: string | undefined
}

async function upstream(): Promise<{ port: number; requests: CapturedRequest[] }> {
  const requests: CapturedRequest[] = []
  const server = createServer((req, res) => {
    requests.push({ cookie: req.headers.cookie, host: req.headers.host, origin: req.headers.origin })
    if (req.url === '/offsite') {
      res.writeHead(302, { location: 'https://attacker.example/' })
      res.end()
      return
    }
    res.setHeader('set-cookie', 'remote-secret=must-not-escape; HttpOnly')
    res.setHeader('content-type', 'application/octet-stream')
    res.end(Buffer.from([0, 1, 2, 255]))
  })
  const wss = new WebSocketServer({ noServer: true })
  server.on('upgrade', (req, socket, head) => {
    requests.push({ cookie: req.headers.cookie, host: req.headers.host, origin: req.headers.origin })
    wss.handleUpgrade(req, socket, head, (peer) => { peer.send('ready') })
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  servers.push(server)
  const address = server.address()
  if (typeof address !== 'object' || address === null) throw new Error('missing port')
  return { port: address.port, requests }
}

async function session(proxy: AuthProxy): Promise<{ cookie: string; ticket: string }> {
  const url = new URL(proxy.openTicket())
  const ticket = url.hash.slice(1)
  const response = await fetch(`${proxy.origin}/__remote/exchange`, { method: 'POST',
    headers: { origin: proxy.origin, 'x-remote-ticket': ticket } })
  expect(response.status).toBe(204)
  const cookie = response.headers.get('set-cookie')?.split(';', 1)[0]
  if (!cookie) throw new Error('missing local cookie')
  return { cookie, ticket }
}

async function wsResult(url: string, headers: Record<string, string>): Promise<number | string> {
  return new Promise((resolve) => {
    const socket = new WebSocket(url, { headers, handshakeTimeout: 3000 })
    socket.once('unexpected-response', (_req, response) => { resolve(response.statusCode ?? 0); socket.terminate() })
    socket.once('message', (data) => {
      const bytes = Buffer.isBuffer(data) ? data : Array.isArray(data) ? Buffer.concat(data) : Buffer.from(data)
      resolve(bytes.toString('utf8'))
      socket.close()
    })
    socket.once('error', () => { resolve(0) })
  })
}

async function status(url: string, cookie: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = request(url, { agent: false, headers: { cookie } }, (res) => {
      res.resume()
      res.once('end', () => { resolve(res.statusCode ?? 0) })
    })
    req.once('error', reject)
    req.end()
  })
}

describe('remote workspace auth proxy', () => {
  it('requires one ticket, then isolates the two Cookies and forwards binary and WebSocket', async () => {
    const remote = await upstream()
    const proxy = new AuthProxy(remote.port, 3080, 'remote-session=host-only')
    proxies.push(proxy)
    await proxy.start()
    expect((await fetch(proxy.origin)).status).toBe(401)
    const { cookie, ticket } = await session(proxy)
    expect((await fetch(`${proxy.origin}/__remote/exchange`, { method: 'POST',
      headers: { origin: proxy.origin, 'x-remote-ticket': ticket } })).status).toBe(401)
    const reply = await fetch(proxy.origin, { headers: { cookie } })
    expect(reply.status).toBe(200)
    expect([...new Uint8Array(await reply.arrayBuffer())]).toEqual([0, 1, 2, 255])
    expect(reply.headers.get('set-cookie')).toBeNull()
    const redirect = await fetch(`${proxy.origin}/offsite`, { headers: { cookie }, redirect: 'manual' })
    expect(redirect.status).toBe(302)
    expect(redirect.headers.get('location')).toBeNull()
    expect(remote.requests[0]).toEqual({ cookie: 'remote-session=host-only', host: '127.0.0.1:3080', origin: undefined })
    expect(await wsResult(proxy.origin.replace('http:', 'ws:') + '/api/remote.mux',
      { origin: proxy.origin, cookie })).toBe('ready')
    expect(remote.requests[2]).toEqual({ cookie: 'remote-session=host-only', host: '127.0.0.1:3080', origin: 'http://127.0.0.1:3080' })
  })

  it('rejects missing credentials and cross-site HTTP and WebSocket requests before upstream', async () => {
    const remote = await upstream()
    const proxy = new AuthProxy(remote.port, 3080, 'remote-session=host-only')
    proxies.push(proxy)
    await proxy.start()
    const { cookie } = await session(proxy)
    expect((await fetch(proxy.origin, { headers: { cookie, origin: 'https://attacker.example' } })).status).toBe(403)
    expect((await fetch(proxy.origin, { headers: { cookie, 'sec-fetch-site': 'cross-site' } })).status).toBe(403)
    const wsUrl = proxy.origin.replace('http:', 'ws:') + '/api/remote.mux'
    expect(await wsResult(wsUrl, { origin: proxy.origin })).toBe(403)
    expect(await wsResult(wsUrl, { origin: 'https://attacker.example', cookie })).toBe(403)
    expect(remote.requests).toHaveLength(0)
    await proxy.stop()
    await expect(fetch(proxy.origin)).rejects.toThrow()
  })

  it('keeps its local origin and session while replacing a lost authenticated SSH forward', async () => {
    const first = await upstream()
    const second = await upstream()
    const proxy = new AuthProxy(first.port, 3080, 'remote-session=first')
    proxies.push(proxy)
    await proxy.start()
    const origin = proxy.origin
    const { cookie } = await session(proxy)
    expect(await status(origin, cookie)).toBe(200)
    proxy.pause()
    expect(() => proxy.openTicket()).toThrow('proxy unavailable')
    expect(await status(origin, cookie)).toBe(503)
    expect(await wsResult(origin.replace('http:', 'ws:') + '/api/remote.mux',
      { origin, cookie })).toBe(403)
    proxy.resume(second.port, 'remote-session=second')
    expect(proxy.origin).toBe(origin)
    expect(await status(origin, cookie)).toBe(200)
    expect(first.requests).toHaveLength(1)
    expect(second.requests).toEqual([{ cookie: 'remote-session=second', host: '127.0.0.1:3080', origin: undefined }])
  })
})

/** Authenticate the one approved remote authority and verify its live identity. */
import { request } from 'node:http'
import WebSocket from 'ws'
import type { RemoteDescriptor, RemoteIdentity } from './types.ts'

interface HttpReply { readonly status: number; readonly headers: import('node:http').IncomingHttpHeaders; readonly body: Buffer }

async function read(port: number, authority: string, path: string, cookie?: string): Promise<HttpReply> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    const req = request({ host: '127.0.0.1', port, method: 'GET', path,
      headers: { host: authority, ...(cookie === undefined ? {} : { cookie }), accept: 'application/json' },
      timeout: 10_000 }, (res) => {
      res.on('data', (chunk: Buffer) => {
        size += chunk.length
        if (size > 65_536) req.destroy(new Error('remote-workspace: response too large'))
        else chunks.push(chunk)
      })
      res.once('end', () =>{  resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }) })
      res.once('error', reject)
    })
    req.once('timeout', () => req.destroy(new Error('remote-workspace: authentication timeout')))
    req.once('error', reject)
    req.end()
  })
}

/** Accept only the configured loopback Harness launch URL and extract its transient token. */
export function launchToken(value: string, remotePort: number): string {
  let url: URL
  try { url = new URL(value) } catch { throw new Error('remote-workspace: invalid launch URL') }
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.port !== String(remotePort)
    || url.pathname !== '/' || url.hash !== '' || url.username !== '' || url.password !== ''
    || [...url.searchParams.keys()].join(',') !== 'token') {
    throw new Error('remote-workspace: unexpected launch URL')
  }
  const token = url.searchParams.get('token')
  if (token === null || token.length < 16 || token.length > 4096) throw new Error('remote-workspace: invalid launch token')
  return token
}

/** Exchange a launch token for a Host-only browser Cookie, without redirects. */
export async function authenticate(port: number, remotePort: number, descriptor: RemoteDescriptor): Promise<string> {
  const token = launchToken(descriptor.launchUrl, remotePort)
  const authority = `127.0.0.1:${String(remotePort)}`
  const reply = await read(port, authority, `/?token=${encodeURIComponent(token)}`)
  if (reply.status !== 303 || reply.headers.location !== './') throw new Error('remote-workspace: remote authentication rejected')
  const setCookie = reply.headers['set-cookie']
  if (setCookie?.length !== 1) throw new Error('remote-workspace: remote session Cookie missing')
  const cookie = setCookie[0]?.split(';', 1)[0]
  if (cookie === undefined || !/^[!#$%&'*+.^_`|~A-Za-z0-9-]+=[!#$%&'*+.^_`|~A-Za-z0-9-]+$/u.test(cookie)) {
    throw new Error('remote-workspace: invalid remote session Cookie')
  }
  return cookie
}

function identity(value: unknown): RemoteIdentity {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('remote-workspace: invalid identity')
  const row = value as Record<string, unknown>
  if (row.protocolVersion !== 1 || typeof row.instanceId !== 'string' || typeof row.bootId !== 'string'
    || typeof row.instanceKey !== 'string' || typeof row.profile !== 'string'
    || typeof row.workspaceHint !== 'string' || typeof row.version !== 'string'
    || !Array.isArray(row.capabilities) || !row.capabilities.every(item => typeof item === 'string')) {
    throw new Error('remote-workspace: invalid identity')
  }
  return row as unknown as RemoteIdentity
}

/** Read Companion identity through Harness's authenticated /api transport. */
export async function readIdentity(port: number, remotePort: number, cookie: string): Promise<RemoteIdentity> {
  const reply = await read(port, `127.0.0.1:${String(remotePort)}`, '/api/remote-workspace/identity', cookie)
  if (reply.status !== 200) throw new Error('remote-workspace: authenticated identity unavailable')
  return identity(JSON.parse(reply.body.toString('utf8')) as unknown)
}

/** Open the actual Typert event stream and wait for its first ready frame. */
export async function probeEventStream(port: number, remotePort: number, cookie: string): Promise<void> {
  const authority = `127.0.0.1:${String(remotePort)}`
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${String(port)}/api/remote.mux`, {
      headers: { host: authority, cookie, origin: `http://${authority}` },
      handshakeTimeout: 10_000,
    })
    let done = false
    const finish = (error?: Error): void => {
      if (done) return
      done = true
      clearTimeout(timer)
      socket.close()
      if (error === undefined) resolve()
      else reject(error)
    }
    const timer = setTimeout(() =>{  finish(new Error('remote-workspace: event stream not ready')) }, 10_000)
    socket.once('open', () => {
      socket.send(JSON.stringify({ type: 'open', streamId: 'remote-workspace-readiness', endpoint: '$events', payload: { args: {} } }))
    })
    socket.on('message', (data) => {
      let frame: unknown
      const bytes = Buffer.isBuffer(data) ? data : Array.isArray(data) ? Buffer.concat(data) : Buffer.from(data)
      try { frame = JSON.parse(bytes.toString('utf8')) as unknown } catch { finish(new Error('remote-workspace: invalid event frame')); return }
      if (typeof frame !== 'object' || frame === null || !('type' in frame) || !('streamId' in frame)) return
      if (frame.type === 'error') { finish(new Error('remote-workspace: event stream rejected')); return }
      if (frame.type === 'item' && frame.streamId === 'remote-workspace-readiness'
        && 'value' in frame && typeof frame.value === 'object' && frame.value !== null
        && 'type' in frame.value && frame.value.type === 'ready') finish()
    })
    socket.once('error', () =>{  finish(new Error('remote-workspace: event stream unavailable')) })
    socket.once('close', () =>{  finish(new Error('remote-workspace: event stream closed before ready')) })
  })
}

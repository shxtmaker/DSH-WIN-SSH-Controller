/** One-target connection state, generation fencing, and owned resource teardown. */
import { randomUUID } from 'node:crypto'
import { authenticate, probeEventStream, readIdentity } from './auth.ts'
import { AuthProxy } from './proxy.ts'
import { discover, discoverTarget, forward, type OwnedForward } from './ssh.ts'
import { TargetStore } from './store.ts'
import type { RemoteEndpoint, RemoteSnapshot, RemoteTarget } from './types.ts'

class IdentityMismatch extends Error {}
class AuthenticationRequired extends Error {}

interface ActiveConnection {
  readonly id: string
  readonly operationId: string
  readonly target: RemoteTarget
  readonly endpoint: RemoteEndpoint
  readonly lifetime: AbortController
  forward: OwnedForward | undefined
  proxy: AuthProxy | undefined
  retrying: boolean
}

/** Holds exactly one remote attachment and never owns the remote Harness process. */
export class ConnectionManager {
  private current: ActiveConnection | undefined
  private connecting = false
  private pending: AbortController | undefined
  private disposed = false
  private settlement: Promise<void> | undefined
  private state: RemoteSnapshot = { phase: 'idle', generation: 0 }
  private readonly listeners = new Set<(state: RemoteSnapshot) => void>()

  /** @param targets - non-secret target store. @param helperPath - fixed Linux helper executable path. */
  constructor(private readonly targets: TargetStore, private readonly helperPath: string) {}

  /** @returns current non-sensitive snapshot. */
  getState(): RemoteSnapshot { return this.state }

  /** @returns configured non-secret targets. */
  listTargets(): Promise<RemoteTarget[]> { return this.targets.list() }

  /** @param target - full non-secret target. @returns saved records. */
  saveTarget(target: unknown): Promise<RemoteTarget[]> { return this.targets.save(target) }

  /**
   * Connect a reviewed SSH alias to one configured instance.
   * @param targetId - stable target id.
   * @param endpointId - selected LAN, frp TCP, or STCP alias.
   * @param operationId - caller operation id for duplicate connect suppression.
   * @returns authenticated connection snapshot.
   */
  async connect(targetId: string, endpointId: string, operationId: string): Promise<RemoteSnapshot> {
    this.checkAvailable(operationId)
    if (this.current?.operationId === operationId) return this.state
    this.connecting = true
    const settled = Promise.withResolvers<void>()
    this.settlement = settled.promise
    try {
      const found = (await this.targets.list()).find(item => item.id === targetId)
      const route = found?.endpoints.find(item => item.id === endpointId)
      if (found === undefined || route === undefined) throw new Error('remote-workspace: unknown target or endpoint')
      return await this.attach(found, route, operationId)
    } finally { this.connecting = false; settled.resolve() }
  }

  /** Read public identity, pin new targets, and attach using only an SSH alias.
   * @param sshAlias - reviewed OpenSSH alias. @param instanceKey - Companion key, normally default.
   * @param operationId - caller operation id.
   * @returns authenticated attachment state; existing identity pins are never replaced.
   */
  async quickConnect(sshAlias: string, instanceKey: string, operationId: string): Promise<RemoteSnapshot> {
    this.checkAvailable(operationId)
    if (this.current?.operationId === operationId) return this.state
    this.connecting = true
    const settled = Promise.withResolvers<void>()
    this.settlement = settled.promise
    const lifetime = new AbortController()
    this.pending = lifetime
    this.publish({ phase: 'discovering', hostName: sshAlias, generation: this.state.generation + 1 })
    try {
      if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/u.test(sshAlias) || !/^[A-Za-z0-9_-]{1,64}$/u.test(instanceKey)) {
        throw new Error('remote-workspace: invalid SSH discovery configuration')
      }
      const targets = await this.targets.list()
      lifetime.signal.throwIfAborted()
      const existing = targets.find(item => item.instanceKey === instanceKey && item.endpoints.some(route => route.sshAlias === sshAlias))
      if (existing !== undefined) {
        const endpoint = existing.endpoints.find(route => route.sshAlias === sshAlias)
        if (endpoint === undefined) throw new Error('remote-workspace: unknown endpoint')
        return await this.attach(existing, endpoint, operationId, lifetime)
      }
      const info = await discoverTarget(sshAlias, instanceKey, this.helperPath, lifetime.signal)
      lifetime.signal.throwIfAborted()
      if (info.instanceKey !== instanceKey) throw new IdentityMismatch('remote-workspace: configured instance identity mismatch')
      const target: RemoteTarget = { id: randomUUID(), name: sshAlias, instanceKey, instanceId: info.instanceId,
        profile: info.profile, workspaceHint: info.workspaceHint, remotePort: info.port,
        endpoints: [{ id: 'ssh', kind: 'lan', sshAlias }] }
      await this.targets.save(target)
      lifetime.signal.throwIfAborted()
      return await this.attach(target, target.endpoints[0]!, operationId, lifetime)
    } catch (error) {
      if (!this.disposed && !lifetime.signal.aborted) this.publish({ ...this.state, connectionId: undefined, phase: this.failurePhase(error), reason: this.failureReason(error) })
      throw error
    } finally {
      if (this.pending === lifetime) this.pending = undefined
      this.connecting = false
      settled.resolve()
    }
  }

  private checkAvailable(operationId: string): void {
    if (this.disposed) throw new Error('remote-workspace: controller disposed')
    if (!/^[A-Za-z0-9_-]{1,64}$/u.test(operationId)) throw new Error('remote-workspace: invalid operation id')
    if (this.current !== undefined) {
      if (this.current.operationId === operationId) return
      throw new Error('remote-workspace: disconnect the active target first')
    }
    if (this.connecting) throw new Error('remote-workspace: a connection is already starting')
  }

  private async attach(target: RemoteTarget, endpoint: RemoteEndpoint, operationId: string, lifetime = new AbortController()): Promise<RemoteSnapshot> {
    lifetime.signal.throwIfAborted()
    if (this.disposed) throw new Error('remote-workspace: controller disposed')
    const active: ActiveConnection = {
      id: randomUUID(), operationId, target, endpoint, lifetime,
      forward: undefined, proxy: undefined, retrying: false,
    }
    this.current = active
    this.publish({ phase: 'ssh-auth', connectionId: active.id, targetId: target.id, endpointId: endpoint.id,
      hostName: target.name, instanceId: target.instanceId, profile: target.profile,
      workspaceHint: target.workspaceHint, generation: this.state.generation + 1 })
    try {
      await this.attempt(active)
      return this.state
    } catch (error) {
      if (this.current === active) {
        this.current = undefined
        active.lifetime.abort()
        await this.release(active)
        this.publish({ ...this.state, connectionId: undefined, phase: this.failurePhase(error), reason: this.failureReason(error) })
      }
      throw error
    }
  }

  /** @param connectionId - attachment to release. @returns idle or unchanged state. */
  async disconnect(connectionId: string): Promise<RemoteSnapshot> {
    const active = this.current
    if (active === undefined || active.id !== connectionId) return this.state
    this.current = undefined
    active.lifetime.abort(new Error('remote-workspace: disconnected'))
    await this.release(active)
    this.publish({ phase: 'idle', generation: this.state.generation + 1 })
    return this.state
  }

  /** @param connectionId - active attachment. @returns one-use, short-lived local URL. */
  createOpenTicket(connectionId: string): string {
    const active = this.current
    if (active === undefined || active.id !== connectionId || this.state.phase !== 'app-ready'
      || active.proxy === undefined) throw new Error('remote-workspace: connection is not ready')
    return active.proxy.openTicket()
  }

  /** @param signal - stream cancellation. @returns latest state followed by changes. */
  async *watch(signal: AbortSignal): AsyncIterable<RemoteSnapshot> {
    const queue = [this.state]
    let wake: (() => void) | undefined
    const listener = (state: RemoteSnapshot): void => { queue.push(state); wake?.() }
    const stop = (): void => { wake?.() }
    this.listeners.add(listener)
    signal.addEventListener('abort', stop, { once: true })
    try {
      while (!signal.aborted) {
        const next = queue.shift()
        if (next !== undefined) { yield next; continue }
        await new Promise<void>((resolve) => { wake = resolve })
        wake = undefined
      }
    } finally {
      this.listeners.delete(listener)
      signal.removeEventListener('abort', stop)
    }
  }

  /** Release local resources on Host plugin disposal. */
  async dispose(): Promise<void> {
    this.disposed = true
    this.pending?.abort(new Error('remote-workspace: controller disposed'))
    const id = this.current?.id
    if (id !== undefined) await this.disconnect(id)
    await this.settlement
  }

  private publish(state: RemoteSnapshot): void {
    this.state = state
    for (const listener of this.listeners) listener(state)
  }

  private async attempt(active: ActiveConnection): Promise<void> {
    const signal = active.lifetime.signal
    const generation = this.state.generation + 1
    const identity = { connectionId: active.id, targetId: active.target.id, endpointId: active.endpoint.id,
      hostName: active.target.name, instanceId: active.target.instanceId, profile: active.target.profile,
      workspaceHint: active.target.workspaceHint, generation }
    this.publish({ ...identity, phase: active.retrying ? 'reconnecting' : 'discovering' })
    let ready = false
    try {
      const descriptor = await discover(active.endpoint.sshAlias, active.target.instanceKey, this.helperPath, signal)
      signal.throwIfAborted()
      if (descriptor.instanceId !== active.target.instanceId || descriptor.instanceKey !== active.target.instanceKey
        || descriptor.port !== active.target.remotePort || descriptor.profile !== active.target.profile) {
        throw new IdentityMismatch('remote-workspace: configured instance identity mismatch')
      }
      this.publish({ ...identity, phase: 'forwarding', bootId: descriptor.bootId })
      active.forward = await forward(active.endpoint.sshAlias, active.target.remotePort, signal)
      signal.throwIfAborted()
      this.publish({ ...identity, phase: 'authenticating', bootId: descriptor.bootId })
      let cookie: string
      try { cookie = await authenticate(active.forward.port, active.target.remotePort, descriptor) } catch {
        throw new AuthenticationRequired('remote-workspace: remote authentication failed')
      }
      signal.throwIfAborted()
      const live = await readIdentity(active.forward.port, active.target.remotePort, cookie)
      if (live.instanceId !== descriptor.instanceId || live.bootId !== descriptor.bootId
        || live.instanceKey !== descriptor.instanceKey || live.profile !== descriptor.profile) {
        throw new IdentityMismatch('remote-workspace: authenticated instance identity mismatch')
      }
      await probeEventStream(active.forward.port, active.target.remotePort, cookie)
      signal.throwIfAborted()
      if (active.proxy === undefined) {
        active.proxy = new AuthProxy(active.forward.port, active.target.remotePort, cookie)
        await active.proxy.start()
      } else {
        active.proxy.resume(active.forward.port, cookie)
      }
      signal.throwIfAborted()
      this.publish({ ...identity, phase: 'app-ready', bootId: live.bootId,
        workspaceHint: live.workspaceHint })
      ready = true
      const ownedForward = active.forward
      void ownedForward.exited.then(() => {
        if (this.current === active && active.forward === ownedForward && !signal.aborted) void this.lost(active)
      }).catch(() => {
        if (this.current === active && active.forward === ownedForward && !signal.aborted) void this.lost(active)
      })
    } finally {
      if (!ready) await this.release(active, active.retrying)
    }
  }

  private async lost(active: ActiveConnection): Promise<void> {
    if (active.retrying || this.current !== active) return
    active.retrying = true
    await this.release(active, true)
    if (this.current !== active) return
    this.publish({ ...this.state, phase: 'disconnected', reason: 'SSH transport closed' })
    const deadline = Date.now() + 5 * 60_000
    for (let attempt = 0; Date.now() < deadline && this.current === active && !active.lifetime.signal.aborted; attempt++) {
      const seconds = [1, 2, 4, 8, 16, 30][Math.min(attempt, 5)] ?? 30
      await new Promise<void>(resolve => setTimeout(resolve, seconds * 1000 + Math.floor(Math.random() * 500)))
      // oxlint-disable-next-line typescript/no-unnecessary-condition -- Explicit disconnect can run during the awaited timer.
      if (this.current !== active || active.lifetime.signal.aborted) break
      try { await this.attempt(active); active.retrying = false; return } catch (error) {
        const phase = this.failurePhase(error)
        this.publish({ ...this.state, phase, reason: this.failureReason(error) })
        if (phase === 'identity-mismatch' || phase === 'auth-required') break
      }
    }
    active.retrying = false
    if (this.current === active) {
      this.current = undefined
      await this.release(active)
      this.publish({ ...this.state, connectionId: undefined, phase: 'disconnected' })
    }
  }

  private async release(active: ActiveConnection, keepProxy = false): Promise<void> {
    const proxy = active.proxy, ssh = active.forward
    if (keepProxy) proxy?.pause()
    else active.proxy = undefined
    active.forward = undefined
    await Promise.all([keepProxy ? undefined : proxy?.stop(), ssh?.stop()])
  }

  private failurePhase(error: unknown): RemoteSnapshot['phase'] {
    if (error instanceof IdentityMismatch) return 'identity-mismatch'
    if (error instanceof AuthenticationRequired) return 'auth-required'
    return 'error'
  }

  private failureReason(error: unknown): string {
    if (error instanceof IdentityMismatch || error instanceof AuthenticationRequired) return error.message
    return error instanceof Error ? error.message.replace(/token=[^\s]+/gu, 'token=[redacted]') : 'connection failed'
  }
}

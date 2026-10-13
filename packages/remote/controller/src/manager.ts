/** One-target connection state, generation fencing, layered checks, and owned resource teardown. */
import { randomUUID } from 'node:crypto'
import { authenticate, probeEventStream, readIdentity } from './auth.ts'
import { AuthProxy } from './proxy.ts'
import { IdentityMismatch, LOCAL_AUTH_REQUIRED, ServiceStopped, UpstreamAuthRequired, UpstreamUnreachable,
  type CheckName, type RemoteErrorCode } from './errors.ts'
import { errorFacts, redact } from './errors.ts'
import { ControlClient, type ControlOperationReceipt, type ControlStatus } from './service-client.ts'
import { discover, discoverTarget, forward, type OwnedForward } from './ssh.ts'
import { TargetStore } from './store.ts'
import { diagnostics, type EndpointRef, type RemoteCapabilities, type RemoteCheck, type RemoteEndpoint,
  type RemoteInspection, type RemoteServiceState, type RemoteSnapshot, type RemoteTarget,
  type ServiceOperationState } from './types.ts'

/** Named-check accumulator for one connection attempt. */
class Checks {
  private readonly entries: Partial<Record<CheckName, { state: 'unknown' | 'checking' | 'ok' | 'failed' | 'unsupported'; code?: RemoteErrorCode }>> = {}

  set(name: CheckName, state: 'unknown' | 'checking' | 'ok' | 'failed' | 'unsupported', code?: RemoteErrorCode): void {
    this.entries[name] = { state, ...(code === undefined ? {} : { code }) }
  }

  list(): readonly RemoteCheck[] { return diagnostics(this.entries, new Date().toISOString()) }

  /** @returns the first failed check, for phase selection. */
  firstFailure(): RemoteErrorCode | undefined {
    for (const name of ['ssh', 'helper', 'service', 'descriptor', 'listener', 'identity', 'authentication', 'events', 'application'] as const) {
      const entry = this.entries[name]
      if (entry?.state === 'failed' && entry.code !== undefined) return entry.code
    }
    return undefined
  }
}

interface ActiveConnection {
  readonly id: string
  readonly operationId: string
  readonly target: RemoteTarget
  readonly endpoint: RemoteEndpoint
  readonly lifetime: AbortController
  forward: OwnedForward | undefined
  proxy: AuthProxy | undefined
  retrying: boolean
  cookie: string | undefined
  capabilities: RemoteCapabilities | undefined
  service: RemoteServiceState | undefined
  checks: Checks
  operation: ServiceOperationState
  refreshing: boolean
  /** Set while a start/restart is waiting for the new descriptor to become ready. */
  awaitingReady: boolean
}

/** Holds exactly one remote attachment and never owns the remote Harness process. */
export class ConnectionManager {
  private current: ActiveConnection | undefined
  private connecting = false
  private pending: AbortController | undefined
  private disposed = false
  private settlement: Promise<void> | undefined
  private state: RemoteSnapshot = { phase: 'idle', generation: 0, diagnostics: diagnostics({}, new Date().toISOString()) }
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
    const checks = new Checks()
    checks.set('ssh', 'checking')
    this.publish({ phase: 'discovering', hostName: sshAlias, generation: this.state.generation + 1, diagnostics: checks.list() })
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
      const info = await this.identityOnly(sshAlias, instanceKey, lifetime.signal, checks)
      lifetime.signal.throwIfAborted()
      if (info.instanceKey !== instanceKey) throw new IdentityMismatch('remote-workspace: configured instance identity mismatch')
      const target: RemoteTarget = { id: randomUUID(), name: sshAlias, instanceKey, instanceId: info.instanceId,
        profile: info.profile, workspaceHint: info.workspaceHint, remotePort: info.port,
        endpoints: [{ id: 'ssh', kind: 'lan', sshAlias }] }
      await this.targets.save(target)
      lifetime.signal.throwIfAborted()
      return await this.attach(target, target.endpoints[0]!, operationId, lifetime)
    } catch (error) {
      if (!this.disposed && !lifetime.signal.aborted) {
        this.publish({ ...this.state, connectionId: undefined, phase: this.failurePhase(error),
          reason: redact(this.failureReason(error)), diagnostics: this.failureChecks(checks, error) })
      }
      throw error
    } finally {
      if (this.pending === lifetime) this.pending = undefined
      this.connecting = false
      settled.resolve()
    }
  }

  /**
   * Read-only preflight for one endpoint. It never saves a target and never starts a service,
   * so a first-time alias can be inspected before anything is pinned.
   * @param ref - saved target or first-time SSH alias.
   * @param operationId - caller operation id, validated but never persisted.
   * @returns capability, service and layered diagnostic summary.
   */
  async inspectEndpoint(ref: EndpointRef, operationId: string): Promise<RemoteInspection> {
    if (this.disposed) throw new Error('remote-workspace: controller disposed')
    if (!/^[A-Za-z0-9_-]{1,64}$/u.test(operationId)) throw new Error('remote-workspace: invalid operation id')
    const resolved = await this.resolve(ref)
    const lifetime = new AbortController()
    const checks = new Checks()
    checks.set('ssh', 'checking')
    let capabilities: RemoteCapabilities | undefined
    let service: RemoteServiceState | undefined
    try {
      await this.identityOnly(resolved.sshAlias, resolved.instanceKey, lifetime.signal, checks)
      const control = this.control(resolved.sshAlias, resolved.instanceKey)
      const caps = await control.capabilities(lifetime.signal)
      if (caps.ok) {
        capabilities = { controlVersion: 1, helperVersion: caps.value.helperVersion, mode: caps.value.mode,
          actions: caps.value.actions }
        checks.set('helper', 'ok')
        const status = await control.status(lifetime.signal)
        if (status.ok) {
          service = this.serviceState(status.value, resolved.instanceKey)
          checks.set('service', service.registered ? 'ok' : 'unsupported',
            service.registered ? undefined : 'SERVICE_UNREGISTERED')
          checks.set('descriptor', status.value.descriptor.parsable ? 'ok' : 'failed',
            status.value.descriptor.parsable ? undefined : 'DESCRIPTOR_INVALID')
          if (status.value.listener === undefined) checks.set('listener', 'unknown')
          else if (!status.value.listener.supported) checks.set('listener', 'unsupported', 'UNSUPPORTED_WEB_TRANSPORT')
          else checks.set('listener', 'ok')
          if (service.state === 'failed') checks.set('application', 'failed', 'SERVICE_FAILED')
          else if (service.state === 'inactive') checks.set('application', 'failed', 'SERVICE_STOPPED')
          else if (service.state === 'active') checks.set('application', 'unknown')
        } else {
          checks.set('service', 'failed', status.error.code)
        }
      } else if (caps.error.code === 'CONTROL_UNSUPPORTED') {
        // An old helper has no management protocol; that is a documented degradation, not a fault.
        checks.set('helper', 'unsupported', 'CONTROL_UNSUPPORTED')
        checks.set('service', 'unsupported', 'CONTROL_UNSUPPORTED')
        checks.set('descriptor', 'unknown')
      } else {
        checks.set('helper', 'failed', caps.error.code)
        checks.set('service', 'unknown', caps.error.code)
        checks.set('descriptor', 'unknown')
      }
      return { sshAlias: resolved.sshAlias, instanceKey: resolved.instanceKey, known: resolved.known,
        ...(capabilities === undefined ? {} : { capabilities }),
        ...(service === undefined ? {} : { service }),
        diagnostics: checks.list(), checkedAt: new Date().toISOString() }
    } catch (error) {
      return { sshAlias: resolved.sshAlias, instanceKey: resolved.instanceKey, known: resolved.known,
        diagnostics: this.failureChecks(checks, error), checkedAt: new Date().toISOString() }
    }
  }

  /**
   * Submit one restricted service action against the active attachment.
   *
   * Writes are serialized per target. A `stop` pauses the local proxy before the command so no
   * page keeps talking to a service that is going away; a `start` or `restart` waits for the
   * new descriptor, the identity and the application to become ready again.
   *
   * @param ref - endpoint the action applies to; must match the active connection when present.
   * @param action - start, stop or restart.
   * @param operationId - idempotency key; reused when asking for the result.
   * @param issuedAt - ISO timestamp of the caller's intent.
   * @param registrationRevision - revision the caller saw.
   * @param expectedInstanceId - pinned instance id, when known.
   * @returns the receipt recorded by the helper, or a local failure.
   */
  async serviceAction(ref: EndpointRef, action: 'start' | 'stop' | 'restart', operationId: string,
    issuedAt: string, registrationRevision: string, expectedInstanceId?: string): Promise<ServiceOperationState> {
    if (this.disposed) throw new Error('remote-workspace: controller disposed')
    const active = this.current
    if (active === undefined) throw new Error('remote-workspace: connect to the target before a service action')
    const resolved = await this.resolve(ref)
    if (resolved.sshAlias !== active.endpoint.sshAlias) {
      throw new Error('remote-workspace: disconnect the active target first')
    }
    if (active.operation.phase === 'submitting' || active.operation.phase === 'waiting') {
      throw new Error('remote-workspace: a service action is already in progress')
    }
    const startedAt = new Date().toISOString()
    const update = (patch: Partial<ServiceOperationState>): ServiceOperationState => {
      active.operation = { ...active.operation, ...patch }
      this.publishFor(active, { serviceOperation: active.operation })
      return active.operation
    }
    update({ phase: 'submitting', action, operationId, startedAt })
    if (action === 'stop') active.proxy?.pause()
    const control = this.control(resolved.sshAlias, resolved.instanceKey)
    const result = await control.submit(action, { operationId, issuedAt, registrationRevision,
      ...(expectedInstanceId === undefined ? {} : { expectedInstanceId }) }, active.lifetime.signal)
    if (!result.ok) {
      update({ phase: result.error.code === 'OUTCOME_UNKNOWN' ? 'outcome-unknown' : 'failed',
        code: result.error.code, finishedAt: new Date().toISOString() })
      await this.reconcileAfterAction(active, action)
      return active.operation
    }
    const receipt = result.value
    if (receipt.outcome === 'pending') update({ phase: 'waiting' })
    if (receipt.outcome === 'outcome-unknown') {
      // The command may have been accepted. Only the recorded receipt and the real state are
      // consulted; the action is never resent under a new id.
      update({ phase: 'outcome-unknown', code: 'OUTCOME_UNKNOWN', finishedAt: new Date().toISOString() })
      await this.reconcileAfterAction(active, action)
      return active.operation
    }
    if (receipt.outcome === 'failed') {
      update({ phase: 'failed', code: receipt.code ?? 'SERVICE_FAILED', finishedAt: new Date().toISOString() })
      await this.reconcileAfterAction(active, action)
      return active.operation
    }
    update({ phase: 'completed', finishedAt: new Date().toISOString() })
    if (action === 'stop') {
      this.publishFor(active, { phase: 'service-stopped',
        ...(active.service === undefined ? {} : { service: { ...active.service, state: 'inactive' as const } }) })
      return active.operation
    }
    await this.waitForReady(active)
    return active.operation
  }

  /**
   * Read one previously submitted action's receipt. This never submits a new action.
   * @param ref - endpoint the receipt belongs to.
   * @param operationId - the id used when the action was submitted.
   */
  async getServiceOperation(ref: EndpointRef, operationId: string): Promise<ServiceOperationState> {
    const resolved = await this.resolve(ref)
    const control = this.control(resolved.sshAlias, resolved.instanceKey)
    const lifetime = new AbortController()
    const result = await control.operationStatus(operationId, lifetime.signal)
    if (!result.ok) return { phase: 'failed', operationId, code: result.error.code, finishedAt: new Date().toISOString() }
    return this.operationFromReceipt(result.value)
  }

  /**
   * Re-authenticate the active attachment without touching the remote service.
   *
   * It rebuilds the SSH forward, exchanges a fresh remote Cookie, re-verifies identity and the
   * event stream, then resumes the same local proxy. Concurrent calls for the same connection
   * are single-flight, and no previously submitted business request is replayed.
   *
   * @param connectionId - active attachment.
   * @param operationId - caller operation id.
   * @returns the new snapshot.
   */
  async refreshAuthentication(connectionId: string, operationId: string): Promise<RemoteSnapshot> {
    const active = this.current
    if (active === undefined || active.id !== connectionId) throw new Error('remote-workspace: unknown connection')
    if (!/^[A-Za-z0-9_-]{1,64}$/u.test(operationId)) throw new Error('remote-workspace: invalid operation id')
    if (active.refreshing) return this.state
    active.refreshing = true
    try {
      active.checks.set('authentication', 'checking')
      this.publishFor(active, { phase: 'authenticating' })
      const descriptor = await discover(active.endpoint.sshAlias, active.target.instanceKey, this.helperPath, active.lifetime.signal)
      this.assertDescriptor(active.target, descriptor)
      active.forward = await forward(active.endpoint.sshAlias, active.target.remotePort, active.lifetime.signal)
      const cookie = await authenticate(active.forward.port, active.target.remotePort, descriptor)
      const live = await readIdentity(active.forward.port, active.target.remotePort, cookie)
      this.assertIdentity(descriptor, live)
      await probeEventStream(active.forward.port, active.target.remotePort, cookie)
      active.cookie = cookie
      active.proxy?.resume(active.forward.port, cookie)
      active.checks.set('authentication', 'ok')
      active.checks.set('events', 'ok')
      this.publishFor(active, { phase: 'app-ready', bootId: live.bootId, workspaceHint: live.workspaceHint })
      return this.state
    } catch (error) {
      active.checks.set('authentication', 'failed', this.codeFor(error))
      this.publishFor(active, { phase: this.failurePhase(error), reason: redact(this.failureReason(error)) })
      throw error
    } finally { active.refreshing = false }
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

  /** @returns the saved target and alias for an endpoint reference. */
  private async resolve(ref: EndpointRef): Promise<{ sshAlias: string; instanceKey: string; known: boolean }> {
    if ('sshAlias' in ref) {
      if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/u.test(ref.sshAlias) || !/^[A-Za-z0-9_-]{1,64}$/u.test(ref.instanceKey)) {
        throw new Error('remote-workspace: invalid SSH discovery configuration')
      }
      const known = (await this.targets.list()).some(item => item.instanceKey === ref.instanceKey
        && item.endpoints.some(route => route.sshAlias === ref.sshAlias))
      return { sshAlias: ref.sshAlias, instanceKey: ref.instanceKey, known }
    }
    const found = (await this.targets.list()).find(item => item.id === ref.targetId)
    const route = found?.endpoints.find(item => item.id === ref.endpointId)
    if (found === undefined || route === undefined) throw new Error('remote-workspace: unknown target or endpoint')
    return { sshAlias: route.sshAlias, instanceKey: found.instanceKey, known: true }
  }

  private control(sshAlias: string, instanceKey: string): ControlClient {
    return new ControlClient({ alias: sshAlias, instanceKey, helperPath: this.helperPath })
  }

  private serviceState(status: ControlStatus, instanceKey: string): RemoteServiceState {
    return {
      unit: status.service?.unit ?? '',
      state: status.service?.state ?? 'unknown',
      registered: status.registered && status.instanceKey === instanceKey,
    }
  }

  private operationFromReceipt(receipt: ControlOperationReceipt): ServiceOperationState {
    const phase = receipt.outcome === 'pending' ? 'waiting'
      : receipt.outcome === 'completed' ? 'completed'
        : receipt.outcome === 'outcome-unknown' ? 'outcome-unknown' : 'failed'
    return { phase, action: receipt.action as ServiceOperationState['action'], operationId: receipt.operationId,
      ...(receipt.code === undefined ? {} : { code: receipt.code }),
      ...(receipt.issuedAt === undefined ? {} : { startedAt: receipt.issuedAt }),
      ...(receipt.recordedAt === undefined ? {} : { finishedAt: receipt.recordedAt }) }
  }

  /** Read the public instance identity over `--identity`; never fetches a launch credential. */
  private async identityOnly(sshAlias: string, instanceKey: string, signal: AbortSignal, checks: Checks) {
    try {
      const info = await discoverTarget(sshAlias, instanceKey, this.helperPath, signal)
      checks.set('ssh', 'ok')
      checks.set('helper', 'ok')
      checks.set('identity', 'ok')
      checks.set('descriptor', 'ok')
      return info
    } catch (error) {
      const code = this.codeFor(error)
      checks.set(errorFacts(code).stage === 'ssh' ? 'ssh' : 'helper', 'failed', code)
      throw error
    }
  }

  private async attach(target: RemoteTarget, endpoint: RemoteEndpoint, operationId: string,
    lifetime = new AbortController()): Promise<RemoteSnapshot> {
    lifetime.signal.throwIfAborted()
    if (this.disposed) throw new Error('remote-workspace: controller disposed')
    const active: ActiveConnection = {
      id: randomUUID(), operationId, target, endpoint, lifetime,
      forward: undefined, proxy: undefined, retrying: false, cookie: undefined,
      capabilities: undefined, service: undefined, checks: new Checks(), operation: { phase: 'idle' },
      refreshing: false, awaitingReady: false,
    }
    this.current = active
    active.checks.set('ssh', 'checking')
    this.publishFor(active, { phase: 'ssh-auth', connectionId: active.id, targetId: target.id, endpointId: endpoint.id,
      hostName: target.name, instanceId: target.instanceId, profile: target.profile,
      workspaceHint: target.workspaceHint, serviceOperation: active.operation })
    try {
      await this.attempt(active)
      return this.state
    } catch (error) {
      if (this.current === active) {
        this.current = undefined
        active.lifetime.abort()
        await this.release(active)
        this.publish({ ...this.state, connectionId: undefined, phase: this.failurePhase(error),
          reason: redact(this.failureReason(error)), diagnostics: active.checks.list() })
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
    this.publish({ phase: 'idle', generation: this.state.generation + 1,
      diagnostics: diagnostics({}, new Date().toISOString()) })
    return this.state
  }

  /** @param connectionId - active attachment. @returns one-use, short-lived local URL. */
  createOpenTicket(connectionId: string): string {
    const active = this.current
    if (active === undefined || active.id !== connectionId || this.state.phase !== 'app-ready'
      || active.proxy === undefined) throw new Error('remote-workspace: connection is not ready')
    return active.proxy.openTicket()
  }

  /**
   * Record that a browser page asked for access without a usable local Cookie.
   * A single unauthenticated scan never marks the remote service as stopped and never closes
   * another authenticated page's WebSocket.
   * @param code - fixed code reported by the proxy.
   */
  noteAccessWarning(code: RemoteErrorCode): void {
    if (this.state.accessWarning === code) return
    this.publish({ ...this.state, accessWarning: code })
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

  /**
   * Publish only while `active` is still the current attachment.
   * A late result from a replaced or disconnected connection is dropped instead of
   * overwriting the new target's state.
   */
  private publishFor(active: ActiveConnection, patch: Partial<RemoteSnapshot>): void {
    if (this.current !== active || this.disposed) return
    this.publish({ ...this.state, ...patch, generation: this.state.generation + 1,
      diagnostics: active.checks.list() })
  }

  private assertDescriptor(target: RemoteTarget, descriptor: { instanceId: string; instanceKey: string; port: number; profile: string }): void {
    if (descriptor.instanceId !== target.instanceId || descriptor.instanceKey !== target.instanceKey
      || descriptor.port !== target.remotePort || descriptor.profile !== target.profile) {
      throw new IdentityMismatch('remote-workspace: configured instance identity mismatch')
    }
  }

  private assertIdentity(descriptor: { instanceId: string; bootId: string; instanceKey: string; profile: string },
    live: { instanceId: string; bootId: string; instanceKey: string; profile: string }): void {
    if (live.instanceId !== descriptor.instanceId || live.bootId !== descriptor.bootId
      || live.instanceKey !== descriptor.instanceKey || live.profile !== descriptor.profile) {
      throw new IdentityMismatch('remote-workspace: authenticated instance identity mismatch')
    }
  }

  private async attempt(active: ActiveConnection): Promise<void> {
    const signal = active.lifetime.signal
    const identity = { connectionId: active.id, targetId: active.target.id, endpointId: active.endpoint.id,
      hostName: active.target.name, instanceId: active.target.instanceId, profile: active.target.profile,
      workspaceHint: active.target.workspaceHint }
    this.publishFor(active, { ...identity, phase: active.retrying ? 'reconnecting' : 'checking' })
    let ready = false
    try {
      // 1. Capability preflight. An old helper is a documented degradation, not a fault.
      const control = this.control(active.endpoint.sshAlias, active.target.instanceKey)
      const caps = await control.capabilities(signal)
      if (caps.ok) {
        active.capabilities = { controlVersion: 1, helperVersion: caps.value.helperVersion,
          mode: caps.value.mode, actions: caps.value.actions }
        active.checks.set('helper', 'ok')
        const status = await control.status(signal)
        if (status.ok) {
          active.service = this.serviceState(status.value, active.target.instanceKey)
          active.checks.set('service', active.service.registered ? 'ok' : 'unsupported',
            active.service.registered ? undefined : 'SERVICE_UNREGISTERED')
        } else {
          active.checks.set('service', 'failed', status.error.code)
        }
      } else if (caps.error.code === 'CONTROL_UNSUPPORTED') {
        active.checks.set('helper', 'unsupported', 'CONTROL_UNSUPPORTED')
        active.checks.set('service', 'unsupported', 'CONTROL_UNSUPPORTED')
      } else {
        active.checks.set('helper', 'failed', caps.error.code)
      }
      signal.throwIfAborted()
      this.publishFor(active, {
        ...(active.capabilities === undefined ? {} : { capabilities: active.capabilities }),
        ...(active.service === undefined ? {} : { service: active.service }),
      })

      // 2. Descriptor. A stopped service is reported as such instead of as an auth failure.
      this.publishFor(active, { phase: 'discovering' })
      let descriptor
      try {
        descriptor = await discover(active.endpoint.sshAlias, active.target.instanceKey, this.helperPath, signal)
      } catch (error) {
        const code = this.codeFor(error)
        if (active.service !== undefined && (active.service.state === 'inactive' || active.service.state === 'failed')) {
          active.checks.set('descriptor', 'failed', 'SERVICE_STOPPED')
          active.checks.set('application', 'failed', 'SERVICE_STOPPED')
          throw new ServiceStopped('remote-workspace: remote service is not running')
        }
        active.checks.set('descriptor', 'failed', code)
        throw error
      }
      signal.throwIfAborted()
      this.assertDescriptor(active.target, descriptor)
      active.checks.set('ssh', 'ok')
      active.checks.set('descriptor', 'ok')
      active.checks.set('identity', 'ok')

      this.publishFor(active, { phase: 'forwarding', bootId: descriptor.bootId })
      active.forward = await forward(active.endpoint.sshAlias, active.target.remotePort, signal)
      signal.throwIfAborted()

      // 3. Remote authentication. Only a real 401 from the upstream is an authentication result;
      //    transport problems keep their own code.
      this.publishFor(active, { phase: 'authenticating', bootId: descriptor.bootId })
      active.checks.set('authentication', 'checking')
      let cookie: string
      try {
        cookie = await authenticate(active.forward.port, active.target.remotePort, descriptor)
      } catch (error) {
        active.checks.set('authentication', 'failed', this.codeFor(error))
        throw error
      }
      signal.throwIfAborted()
      const live = await readIdentity(active.forward.port, active.target.remotePort, cookie)
      this.assertIdentity(descriptor, live)
      active.checks.set('authentication', 'ok')
      active.checks.set('identity', 'ok')

      this.publishFor(active, { phase: 'verifying', bootId: live.bootId })
      active.checks.set('events', 'checking')
      await probeEventStream(active.forward.port, active.target.remotePort, cookie)
      active.checks.set('events', 'ok')
      active.checks.set('application', 'ok')
      signal.throwIfAborted()

      if (active.proxy === undefined) {
        active.proxy = new AuthProxy(active.forward.port, active.target.remotePort, cookie, (code) => {
          // A late notice from a replaced proxy is dropped rather than attributed to the new
          // target; the proxy itself reports each fixed code at most once per instance.
          if (this.current !== active) return
          this.noteAccessWarning(code)
        })
        await active.proxy.start()
      } else {
        active.proxy.resume(active.forward.port, cookie)
      }
      active.cookie = cookie
      signal.throwIfAborted()
      this.publishFor(active, { phase: 'app-ready', bootId: live.bootId, workspaceHint: live.workspaceHint,
        accessWarning: undefined })
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

  /** Re-read the real service state after an action whose outcome is not certain. */
  private async reconcileAfterAction(active: ActiveConnection, action: 'start' | 'stop' | 'restart'): Promise<void> {
    if (this.current !== active) return
    const control = this.control(active.endpoint.sshAlias, active.target.instanceKey)
    const status = await control.status(active.lifetime.signal)
    if (!status.ok) return
    active.service = this.serviceState(status.value, active.target.instanceKey)
    this.publishFor(active, { service: active.service })
    if (action === 'stop') {
      active.checks.set('application', 'failed', 'SERVICE_STOPPED')
      this.publishFor(active, { phase: 'service-stopped' })
    }
  }

  /** Wait for a started or restarted service to become really ready again. */
  private async waitForReady(active: ActiveConnection): Promise<void> {
    const deadline = Date.now() + 60_000
    active.awaitingReady = true
    try {
      while (Date.now() < deadline && this.current === active && !active.lifetime.signal.aborted) {
        await new Promise<void>(resolve => setTimeout(resolve, 2_000))
        if (this.current !== active || active.lifetime.signal.aborted) return
        try {
          active.forward = undefined
          await this.attempt(active)
          active.checks.set('service', 'ok')
          return
        } catch (error) {
          this.publishFor(active, { phase: this.failurePhase(error), reason: redact(this.failureReason(error)) })
        }
      }
      // The polling ends here; the action is never resent.
      active.checks.set('application', 'failed', 'APPLICATION_NOT_READY')
      this.publishFor(active, { phase: 'error', reason: 'remote service did not become ready in time' })
    } finally { active.awaitingReady = false }
  }

  private async lost(active: ActiveConnection): Promise<void> {
    if (active.retrying || this.current !== active) return
    active.retrying = true
    await this.release(active, true)
    if (this.current !== active) return
    active.checks.set('ssh', 'failed', 'SSH_UNAVAILABLE')
    this.publishFor(active, { phase: 'disconnected', reason: 'SSH transport closed' })
    const deadline = Date.now() + 5 * 60_000
    for (let attempt = 0; Date.now() < deadline && this.current === active && !active.lifetime.signal.aborted; attempt++) {
      const seconds = [1, 2, 4, 8, 16, 30][Math.min(attempt, 5)] ?? 30
      await new Promise<void>(resolve => setTimeout(resolve, seconds * 1000 + Math.floor(Math.random() * 500)))
      // oxlint-disable-next-line typescript/no-unnecessary-condition -- Explicit disconnect can run during the awaited timer.
      if (this.current !== active || active.lifetime.signal.aborted) break
      try { await this.attempt(active); active.retrying = false; return } catch (error) {
        const phase = this.failurePhase(error)
        this.publishFor(active, { phase, reason: redact(this.failureReason(error)) })
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
    active.cookie = undefined
    await Promise.all([keepProxy ? undefined : proxy?.stop(), ssh?.stop()])
  }

  private codeFor(error: unknown): RemoteErrorCode {
    if (error instanceof IdentityMismatch) return 'IDENTITY_MISMATCH'
    if (error instanceof UpstreamAuthRequired) return 'UPSTREAM_AUTH_REQUIRED'
    if (error instanceof ServiceStopped) return 'SERVICE_STOPPED'
    const message = error instanceof Error ? error.message : ''
    if (/SSH_HOST_KEY/u.test(message)) return 'HOST_KEY_REJECTED'
    if (/SSH_AUTH\b/u.test(message)) return 'SSH_AUTH_FAILED'
    if (/SSH_ALIAS|SSH_UNREACHABLE|SSH forward unavailable/u.test(message)) return 'SSH_UNAVAILABLE'
    if (/SSH_HELPER/u.test(message)) return 'HELPER_BAD_CONFIG'
    if (/identity|launch URL|launch token|session Cookie/u.test(message)) return 'UPSTREAM_AUTH_REQUIRED'
    if (error instanceof UpstreamUnreachable) return 'UPSTREAM_UNREACHABLE'
    if (/event stream/u.test(message)) return 'APPLICATION_NOT_READY'
    return 'SSH_UNAVAILABLE'
  }

  private failureChecks(checks: Checks, error: unknown): readonly RemoteCheck[] {
    const code = this.codeFor(error)
    const stage = errorFacts(code).stage
    const name: CheckName = stage === 'auth' ? 'authentication' : stage === 'descriptor' ? 'descriptor'
      : stage === 'service' ? 'service' : stage === 'application' ? 'application' : 'ssh'
    checks.set(name, 'failed', code)
    return checks.list()
  }

  private failurePhase(error: unknown): RemoteSnapshot['phase'] {
    if (error instanceof IdentityMismatch) return 'identity-mismatch'
    if (error instanceof ServiceStopped) return 'service-stopped'
    if (error instanceof UpstreamAuthRequired) return 'auth-required'
    return 'error'
  }

  private failureReason(error: unknown): string {
    if (error instanceof IdentityMismatch || error instanceof UpstreamAuthRequired || error instanceof ServiceStopped) {
      return error.message
    }
    return error instanceof Error ? error.message.replace(/token=[^\s]+/gu, 'token=[redacted]') : 'connection failed'
  }
}

/** Re-exported so the Host plugin can surface the local-authorization code without importing the proxy. */
export { LOCAL_AUTH_REQUIRED }

/**
 * Typed client for the Agent management helper.
 *
 * The helper is invoked through the same fixed absolute path as discovery, with the literal
 * argument `--control`. Nothing here accepts a command, a unit name, a path or a shell string:
 * the only variable inputs are the allowlisted instance key, a bounded operation id, a
 * registration revision and an optional expected instance id.
 *
 * This module performs protocol validation and one invocation. It holds no replay logic; a
 * caller that lost an answer may only ask `operationStatus`.
 */
import { errorFacts, isRemoteErrorCode, redact, type RemoteErrorCode } from './errors.ts'
import { runHelper, validAlias, validHelperPath } from './ssh.ts'

/** Fixed contract version for the management protocol, separate from discovery's 1. */
export const CONTROL_VERSION = 1

export type ControlAction = 'capabilities' | 'status' | 'start' | 'stop' | 'restart' | 'operationStatus'

export const CONTROL_ACTIONS: readonly ControlAction[] = ['capabilities', 'status', 'start', 'stop', 'restart', 'operationStatus']
export const CONTROL_WRITE_ACTIONS: readonly ControlAction[] = ['start', 'stop', 'restart']

/** Management mode the helper reports for one registered instance. */
export type ControlMode = 'systemd-user' | 'unsupported' | 'unregistered'

export type ServiceState = 'unknown' | 'inactive' | 'activating' | 'active' | 'deactivating' | 'failed'

export interface ControlServiceState {
  readonly unit: string
  readonly loadState: string
  readonly activeState: string
  readonly subState: string
  readonly state: ServiceState
  readonly reason?: string
}

export interface ControlDescriptorState {
  readonly present: boolean
  readonly parsable: boolean
  readonly bootId?: string
  readonly instanceId?: string
}

export interface ControlListenerState {
  readonly host: string
  readonly port: number
  readonly protocol: string
  readonly supported: boolean
}

export interface ControlCapabilities {
  readonly helperVersion: string
  readonly discoveryVersions: readonly number[]
  readonly actions: readonly ControlAction[]
  readonly mode: ControlMode
}

export interface ControlStatus {
  readonly helperVersion: string
  readonly instanceKey: string
  readonly registered: boolean
  readonly mode: ControlMode
  readonly registrationRevision?: string
  readonly instanceId?: string
  readonly service?: ControlServiceState
  readonly descriptor: ControlDescriptorState
  readonly listener?: ControlListenerState
  readonly loopback?: { readonly connectable: boolean; readonly checkedAt: string }
  readonly checkedAt: string
}

export type OperationOutcome = 'pending' | 'completed' | 'failed' | 'outcome-unknown'

export interface ControlOperationReceipt {
  readonly operationId: string
  readonly action: ControlAction
  readonly instanceKey: string
  readonly issuedAt: string
  readonly recordedAt: string
  readonly registrationRevision: string
  readonly outcome: OperationOutcome
  readonly code?: RemoteErrorCode
  readonly summary?: string
}

export interface ControlFailure {
  readonly code: RemoteErrorCode
  readonly message: string
  readonly stage: string
  readonly retryable: boolean
}

/** Either a validated payload or a fixed failure; never a partially parsed object. */
export type ControlResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ControlFailure }

function failure(code: RemoteErrorCode, message: string): ControlFailure {
  const facts = errorFacts(code)
  return { code, message: redact(message), stage: facts.stage, retryable: facts.retryable }
}

function object(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

function boundedString(value: unknown, max: number): string | undefined {
  return typeof value === 'string' && value.length > 0 && value.length <= max ? value : undefined
}

const INSTANCE_KEY = /^[A-Za-z0-9_-]{1,64}$/u
const OPERATION_ID = /^[A-Za-z0-9_-]{8,64}$/u
const REVISION = /^[A-Za-z0-9_-]{1,64}$/u
const INSTANCE_ID = /^[A-Za-z0-9_-]{1,128}$/u

export function validOperationId(value: string): boolean { return OPERATION_ID.test(value) }
export function validInstanceKey(value: string): boolean { return INSTANCE_KEY.test(value) }
export function validRegistrationRevision(value: string): boolean { return REVISION.test(value) }
export function validExpectedInstanceId(value: string): boolean { return INSTANCE_ID.test(value) }

function serviceState(value: unknown): ControlServiceState | undefined {
  const row = object(value)
  if (row === undefined) return undefined
  const unit = boundedString(row.unit, 256)
  const loadState = boundedString(row.loadState, 64)
  const activeState = boundedString(row.activeState, 64)
  const subState = boundedString(row.subState, 64)
  const state = boundedString(row.state, 32)
  if (unit === undefined || loadState === undefined || activeState === undefined
    || subState === undefined || state === undefined) return undefined
  const allowed: readonly string[] = ['unknown', 'inactive', 'activating', 'active', 'deactivating', 'failed']
  if (!allowed.includes(state)) return undefined
  return { unit, loadState, activeState, subState, state: state as ServiceState,
    ...(typeof row.reason === 'string' ? { reason: redact(row.reason) } : {}) }
}

function descriptorState(value: unknown): ControlDescriptorState | undefined {
  const row = object(value)
  if (row === undefined || typeof row.present !== 'boolean' || typeof row.parsable !== 'boolean') return undefined
  const bootId = typeof row.bootId === 'string' ? boundedString(row.bootId, 256) : undefined
  const instanceId = typeof row.instanceId === 'string' ? boundedString(row.instanceId, 128) : undefined
  return { present: row.present, parsable: row.parsable, ...(bootId !== undefined ? { bootId } : {}),
    ...(instanceId !== undefined ? { instanceId } : {}) }
}

function listenerState(value: unknown): ControlListenerState | undefined {
  const row = object(value)
  if (row === undefined) return undefined
  const host = boundedString(row.host, 128)
  const protocol = boundedString(row.protocol, 16)
  if (host === undefined || protocol === undefined || !Number.isInteger(row.port)
    || (row.port as number) < 1 || (row.port as number) > 65535 || typeof row.supported !== 'boolean') return undefined
  return { host, port: row.port as number, protocol, supported: row.supported }
}

/** @returns a validated capability payload, or undefined when the shape is not trusted. */
export function parseCapabilities(value: unknown): ControlCapabilities | undefined {
  const row = object(value)
  if (row === undefined) return undefined
  const helperVersion = boundedString(row.helperVersion, 64)
  const mode = boundedString(row.mode, 32)
  if (helperVersion === undefined || mode === undefined
    || !['systemd-user', 'unsupported', 'unregistered'].includes(mode)) return undefined
  if (!Array.isArray(row.discoveryVersions) || !row.discoveryVersions.every(entry => Number.isInteger(entry))) return undefined
  if (!Array.isArray(row.actions)) return undefined
  const actions = row.actions.filter((entry): entry is ControlAction =>
    typeof entry === 'string' && (CONTROL_ACTIONS as readonly string[]).includes(entry))
  if (actions.length !== row.actions.length) return undefined
  return { helperVersion, discoveryVersions: row.discoveryVersions as number[], actions, mode: mode as ControlMode }
}

/** @returns a validated status payload, or undefined when the shape is not trusted. */
export function parseStatus(value: unknown): ControlStatus | undefined {
  const row = object(value)
  if (row === undefined) return undefined
  const helperVersion = boundedString(row.helperVersion, 64)
  const instanceKey = boundedString(row.instanceKey, 64)
  const mode = boundedString(row.mode, 32)
  const checkedAt = boundedString(row.checkedAt, 64)
  const descriptor = descriptorState(row.descriptor)
  if (helperVersion === undefined || instanceKey === undefined || mode === undefined
    || checkedAt === undefined || descriptor === undefined || typeof row.registered !== 'boolean'
    || !['systemd-user', 'unsupported', 'unregistered'].includes(mode)) return undefined
  const registrationRevision = typeof row.registrationRevision === 'string'
    ? boundedString(row.registrationRevision, 64) : undefined
  const instanceId = typeof row.instanceId === 'string' ? boundedString(row.instanceId, 128) : undefined
  const service = row.service === undefined ? undefined : serviceState(row.service)
  if (row.service !== undefined && service === undefined) return undefined
  const listener = row.listener === undefined ? undefined : listenerState(row.listener)
  if (row.listener !== undefined && listener === undefined) return undefined
  const loopback = object(row.loopback)
  return {
    helperVersion, instanceKey, registered: row.registered, mode: mode as ControlMode,
    ...(registrationRevision !== undefined ? { registrationRevision } : {}),
    ...(instanceId !== undefined ? { instanceId } : {}),
    ...(service !== undefined ? { service } : {}),
    descriptor,
    ...(listener !== undefined ? { listener } : {}),
    ...(loopback !== undefined && typeof loopback.connectable === 'boolean' && typeof loopback.checkedAt === 'string'
      ? { loopback: { connectable: loopback.connectable, checkedAt: loopback.checkedAt } } : {}),
    checkedAt,
  }
}

/** @returns a validated operation receipt, or undefined when the shape is not trusted. */
export function parseReceipt(value: unknown): ControlOperationReceipt | undefined {
  const row = object(value)
  if (row === undefined) return undefined
  const operationId = boundedString(row.operationId, 64)
  const action = boundedString(row.action, 32)
  const instanceKey = boundedString(row.instanceKey, 64)
  const issuedAt = boundedString(row.issuedAt, 64)
  const recordedAt = boundedString(row.recordedAt, 64)
  const registrationRevision = boundedString(row.registrationRevision, 64)
  const outcome = boundedString(row.outcome, 32)
  const outcomes: readonly string[] = ['pending', 'completed', 'failed', 'outcome-unknown']
  if (operationId === undefined || action === undefined || instanceKey === undefined
    || issuedAt === undefined || recordedAt === undefined || registrationRevision === undefined
    || outcome === undefined || !outcomes.includes(outcome)
    || !(CONTROL_ACTIONS as readonly string[]).includes(action)) return undefined
  const code = typeof row.code === 'string' ? row.code : undefined
  if (code !== undefined && !isRemoteErrorCode(code)) return undefined
  return {
    operationId, action: action as ControlAction, instanceKey, issuedAt, recordedAt,
    registrationRevision, outcome: outcome as OperationOutcome,
    ...(code !== undefined ? { code } : {}),
    ...(typeof row.summary === 'string' ? { summary: redact(row.summary) } : {}),
  }
}

/** One validated control response body. */
interface ControlEnvelope {
  readonly controlVersion: 1
  readonly action: ControlAction
  readonly ok: boolean
  readonly payload?: unknown
  readonly error?: { readonly code: RemoteErrorCode; readonly message: string }
}

function envelope(text: string): ControlEnvelope | RemoteErrorCode {
  let value: unknown
  try { value = JSON.parse(text) as unknown } catch { return 'BAD_INPUT' }
  const row = object(value)
  if (row === undefined || row.controlVersion !== CONTROL_VERSION) return 'BAD_INPUT'
  if (typeof row.action !== 'string' || !(CONTROL_ACTIONS as readonly string[]).includes(row.action)) return 'BAD_INPUT'
  if (typeof row.ok !== 'boolean') return 'BAD_INPUT'
  if (row.ok) return { controlVersion: CONTROL_VERSION, action: row.action as ControlAction, ok: true, payload: row }
  const error = object(row.error)
  const code = error === undefined ? undefined : boundedString(error.code, 64)
  if (code === undefined || !isRemoteErrorCode(code)) return 'BAD_INPUT'
  return {
    controlVersion: CONTROL_VERSION, action: row.action as ControlAction, ok: false,
    error: { code, message: typeof error?.message === 'string' ? redact(error.message) : '' },
  }
}

export interface ControlClientOptions {
  readonly alias: string
  readonly instanceKey: string
  readonly helperPath: string
  /** Read-only calls default to 10s; write actions may pass the service-command budget. */
  readonly timeoutMs?: number
}

/** One control invocation over its own SSH process. */
export class ControlClient {
  private readonly options: ControlClientOptions

  constructor(options: ControlClientOptions) { this.options = options }

  private async invoke(body: Record<string, unknown>, signal: AbortSignal): Promise<ControlEnvelope | RemoteErrorCode> {
    if (!validAlias(this.options.alias) || !validHelperPath(this.options.helperPath)
      || !validInstanceKey(this.options.instanceKey)) return 'HELPER_BAD_CONFIG'
    const request = `${JSON.stringify({ controlVersion: CONTROL_VERSION, ...body })}\n`
    if (Buffer.byteLength(request, 'utf8') > 4096) return 'BAD_INPUT'
    const run = await runHelper(this.options.alias, this.options.helperPath, ['--control'],
      request, signal, this.options.timeoutMs ?? 10_000)
    if (run.timedOut) return 'SSH_TIMEOUT'
    if (run.oversized) return 'HELPER_BAD_CONFIG'
    if (run.code !== 0) {
      // A helper that rejects --control with BAD_INPUT is the only signal that selects
      // connect-only mode; every other non-zero exit keeps its own error.
      const structured = /\b([A-Z_]{4,})\b/u.exec(run.stderr)?.[1]
      if (structured === 'BAD_INPUT') return 'CONTROL_UNSUPPORTED'
      if (structured !== undefined && isRemoteErrorCode(structured)) return structured
      if (run.code === 126 || run.code === 127) return 'HELPER_NOT_FOUND'
      return 'CONTROL_FAILED'
    }
    if (Buffer.byteLength(run.stdout, 'utf8') > 65_536) return 'HELPER_BAD_CONFIG'
    return envelope(run.stdout)
  }

  /** @returns whether this helper implements the management protocol at all. */
  async capabilities(signal: AbortSignal): Promise<ControlResult<ControlCapabilities>> {
    return this.read('capabilities', {}, signal, parseCapabilities)
  }

  /** @returns the instance's registration, service, descriptor and listener facts. */
  async status(signal: AbortSignal): Promise<ControlResult<ControlStatus>> {
    return this.read('status', {}, signal, parseStatus)
  }

  /** @returns one recorded receipt without submitting a new action. */
  async operationStatus(operationId: string, signal: AbortSignal): Promise<ControlResult<ControlOperationReceipt>> {
    if (!validOperationId(operationId)) return { ok: false, error: failure('BAD_INPUT', 'invalid operation id') }
    return this.read('operationStatus', { operationId }, signal, parseReceipt)
  }

  /**
   * Submit exactly one write action. The caller owns idempotence: the same operationId must be
   * reused when asking for the result and never replaced to force a retry.
   */
  async submit(action: ControlAction, body: {
    operationId: string; issuedAt: string; registrationRevision: string; expectedInstanceId?: string
  }, signal: AbortSignal): Promise<ControlResult<ControlOperationReceipt>> {
    if (!(CONTROL_WRITE_ACTIONS as readonly string[]).includes(action)) {
      return { ok: false, error: failure('BAD_INPUT', 'not a write action') }
    }
    if (!validOperationId(body.operationId) || !validRegistrationRevision(body.registrationRevision)
      || Number.isNaN(Date.parse(body.issuedAt))) {
      return { ok: false, error: failure('BAD_INPUT', 'invalid write action input') }
    }
    if (body.expectedInstanceId !== undefined && !validExpectedInstanceId(body.expectedInstanceId)) {
      return { ok: false, error: failure('BAD_INPUT', 'invalid expected instance id') }
    }
    return this.read(action, { ...body }, signal, parseReceipt)
  }

  private async read<T>(action: ControlAction, body: Record<string, unknown>, signal: AbortSignal,
    parse: (value: unknown) => T | undefined): Promise<ControlResult<T>> {
    const result = await this.invoke({ action, instanceKey: this.options.instanceKey, ...body }, signal)
    if (typeof result === 'string') return { ok: false, error: failure(result, `control ${action} failed`) }
    if (!result.ok) return { ok: false, error: failure(result.error?.code ?? 'CONTROL_FAILED', result.error?.message ?? '') }
    if (result.action !== action) return { ok: false, error: failure('BAD_INPUT', 'action mismatch in control response') }
    const parsed = parse(result.payload)
    if (parsed === undefined) return { ok: false, error: failure('BAD_INPUT', `invalid ${action} payload`) }
    return { ok: true, value: parsed }
  }
}

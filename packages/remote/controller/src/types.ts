/** Non-secret target records and observable local connection state. */
import type { CheckName, CheckState, RemoteCheck, RemoteErrorCode } from './errors.ts'

export type { CheckName, CheckState, RemoteCheck, RemoteErrorCode } from './errors.ts'

/** One reviewed OpenSSH alias reaching the same target by a particular path. */
export interface RemoteEndpoint {
  readonly id: string
  readonly kind: 'lan' | 'frp-tcp' | 'stcp'
  readonly sshAlias: string
}

/** Persisted target identity; transient frp or visitor ports are never identity. */
export interface RemoteTarget {
  readonly id: string
  readonly name: string
  readonly instanceKey: string
  readonly instanceId: string
  readonly profile: string
  readonly workspaceHint: string
  readonly remotePort: number
  readonly endpoints: readonly RemoteEndpoint[]
}

/**
 * Phases published to the management page without credentials or process details.
 *
 * `checking` and `verifying` are separate so that no single phase has to mean the SSH
 * transport, the remote service, the descriptor, the remote Cookie and application readiness
 * at the same time. Health lives in `diagnostics` instead.
 */
export type RemotePhase = 'idle' | 'ssh-auth' | 'checking' | 'discovering' | 'forwarding'
  | 'authenticating' | 'verifying' | 'app-ready' | 'disconnected' | 'reconnecting'
  | 'identity-mismatch' | 'auth-required' | 'service-stopped' | 'error'

/** Management capability summary; only ever held in Host memory. */
export interface RemoteCapabilities {
  readonly controlVersion: number
  readonly helperVersion: string
  readonly mode: 'systemd-user' | 'unsupported' | 'unregistered'
  readonly actions: readonly string[]
}

/** Public service facts; the unit name is never accepted from a request. */
export interface RemoteServiceState {
  readonly unit: string
  readonly state: 'unknown' | 'inactive' | 'activating' | 'active' | 'deactivating' | 'failed'
  readonly registered: boolean
}

/** Lifecycle of one submitted service action. */
export type ServiceOperationPhase = 'idle' | 'submitting' | 'waiting' | 'completed' | 'failed' | 'outcome-unknown'

/** Result of the most recent service action for the active connection. */
export interface ServiceOperationState {
  readonly phase: ServiceOperationPhase
  readonly action?: 'start' | 'stop' | 'restart' | undefined
  readonly operationId?: string | undefined
  readonly code?: RemoteErrorCode | undefined
  readonly startedAt?: string | undefined
  readonly finishedAt?: string | undefined
}

/** One connection generation's public facts. */
export interface RemoteSnapshot {
  readonly phase: RemotePhase
  readonly connectionId?: string | undefined
  readonly targetId?: string
  readonly endpointId?: string
  readonly hostName?: string
  readonly instanceId?: string
  readonly bootId?: string
  readonly profile?: string
  readonly workspaceHint?: string
  readonly generation: number
  readonly reason?: string
  /** One entry per named check; `unknown` is never rendered as healthy. */
  readonly diagnostics: readonly RemoteCheck[]
  readonly capabilities?: RemoteCapabilities | undefined
  readonly service?: RemoteServiceState | undefined
  readonly serviceOperation?: ServiceOperationState | undefined
  /** Fixed code when a browser page lost its local authorization; never a credential. */
  readonly accessWarning?: RemoteErrorCode | undefined
}

/** The constrained SSH helper response, kept only on the Host. */
export interface RemoteDescriptor {
  readonly protocolVersion: 1
  readonly instanceId: string
  readonly bootId: string
  readonly instanceKey: string
  readonly profile: string
  readonly workspaceHint: string
  readonly port: number
  readonly launchUrl: string
}

/** Public SSH helper identity, excluding the launch credential. */
export type DiscoveredTarget = Omit<RemoteDescriptor, 'launchUrl'>

/** Authenticated Companion identity with no credential fields. */
export interface RemoteIdentity {
  readonly protocolVersion: 1
  readonly instanceId: string
  readonly bootId: string
  readonly instanceKey: string
  readonly profile: string
  readonly workspaceHint: string
  readonly version: string
  readonly capabilities: readonly string[]
}

/** Mutually exclusive endpoint reference: a saved target, or a first-time SSH alias. */
export type EndpointRef =
  | { readonly targetId: string; readonly endpointId: string }
  | { readonly sshAlias: string; readonly instanceKey: string }

/** Read-only inspection result; never saves a target and never starts a service. */
export interface RemoteInspection {
  readonly sshAlias: string
  readonly instanceKey: string
  readonly known: boolean
  readonly capabilities?: RemoteCapabilities | undefined
  readonly service?: RemoteServiceState | undefined
  readonly diagnostics: readonly RemoteCheck[]
  readonly checkedAt: string
}

const CHECK_NAMES: readonly CheckName[] = ['ssh', 'helper', 'service', 'descriptor', 'listener',
  'identity', 'authentication', 'events', 'application']

/** Build a diagnostics list with every named check present, defaulting to `unknown`. */
export function diagnostics(
  entries: Partial<Record<CheckName, { state: CheckState; code?: RemoteErrorCode }>>,
  checkedAt: string,
): readonly RemoteCheck[] {
  return CHECK_NAMES.map((name) => {
    const entry = entries[name]
    if (entry === undefined) return { name, state: 'unknown' as const, checkedAt }
    return { name, state: entry.state, checkedAt, ...(entry.code === undefined ? {} : { code: entry.code }) }
  })
}

/**
 * One error vocabulary for every layer of the remote connection.
 *
 * The management page decides what to offer from these codes and stages, never from a
 * localized sentence. Codes are fixed, carry no address, credential or command text, and are
 * also the value the proxy puts in the `X-DSH-Remote-Error` response header.
 */

/** Connection layer a failure belongs to. */
export type RemoteErrorStage = 'ssh' | 'helper' | 'service' | 'descriptor' | 'auth' | 'application' | 'local'

/** Fixed error codes shared with the Agent control contract. */
export type RemoteErrorCode =
  | 'SSH_UNAVAILABLE' | 'SSH_AUTH_FAILED' | 'HOST_KEY_REJECTED' | 'SSH_TIMEOUT'
  | 'HELPER_NOT_FOUND' | 'HELPER_UNSAFE' | 'HELPER_BAD_CONFIG' | 'CONTROL_UNSUPPORTED'
  | 'SERVICE_UNREGISTERED' | 'SERVICE_STOPPED' | 'SERVICE_FAILED' | 'USER_MANAGER_UNAVAILABLE'
  | 'DESCRIPTOR_MISSING' | 'DESCRIPTOR_INVALID' | 'DESCRIPTOR_STALE' | 'UNSUPPORTED_WEB_TRANSPORT'
  | 'LOCAL_AUTH_REQUIRED' | 'UPSTREAM_AUTH_REQUIRED' | 'IDENTITY_MISMATCH'
  | 'APPLICATION_NOT_READY' | 'UPSTREAM_UNREACHABLE'
  | 'REGISTRATION_STALE' | 'OPERATION_CONFLICT' | 'OPERATION_EXPIRED' | 'OUTCOME_UNKNOWN'
  | 'BAD_INPUT' | 'CONFIG_REQUIRED' | 'UNSAFE_PATH' | 'UNSAFE_FILE' | 'LINUX_REQUIRED'
  | 'CONTROL_FAILED' | 'FORBIDDEN' | 'NOT_FOUND' | 'PROXY_PAUSED'

/** Result of one named preflight check. */
export type CheckState = 'unknown' | 'checking' | 'ok' | 'failed' | 'unsupported'

/** Named checks reported separately instead of collapsing into one phase. */
export type CheckName = 'ssh' | 'helper' | 'service' | 'descriptor' | 'listener' | 'identity'
  | 'authentication' | 'events' | 'application'

/** One check's public result; no credentials and no command text. */
export interface RemoteCheck {
  readonly name: CheckName
  readonly state: CheckState
  readonly code?: RemoteErrorCode
  readonly checkedAt: string
}

interface ErrorFacts {
  readonly stage: RemoteErrorStage
  /** Whether repeating the same request can plausibly succeed without operator action. */
  readonly retryable: boolean
  /** Whether the failure is a real authentication result rather than a transport problem. */
  readonly authentication: boolean
}

const FACTS: Record<RemoteErrorCode, ErrorFacts> = {
  SSH_UNAVAILABLE: { stage: 'ssh', retryable: true, authentication: false },
  SSH_AUTH_FAILED: { stage: 'ssh', retryable: false, authentication: false },
  HOST_KEY_REJECTED: { stage: 'ssh', retryable: false, authentication: false },
  SSH_TIMEOUT: { stage: 'ssh', retryable: true, authentication: false },
  HELPER_NOT_FOUND: { stage: 'helper', retryable: false, authentication: false },
  HELPER_UNSAFE: { stage: 'helper', retryable: false, authentication: false },
  HELPER_BAD_CONFIG: { stage: 'helper', retryable: false, authentication: false },
  CONTROL_UNSUPPORTED: { stage: 'helper', retryable: false, authentication: false },
  SERVICE_UNREGISTERED: { stage: 'service', retryable: false, authentication: false },
  SERVICE_STOPPED: { stage: 'service', retryable: true, authentication: false },
  SERVICE_FAILED: { stage: 'service', retryable: false, authentication: false },
  USER_MANAGER_UNAVAILABLE: { stage: 'service', retryable: false, authentication: false },
  DESCRIPTOR_MISSING: { stage: 'descriptor', retryable: true, authentication: false },
  DESCRIPTOR_INVALID: { stage: 'descriptor', retryable: false, authentication: false },
  DESCRIPTOR_STALE: { stage: 'descriptor', retryable: true, authentication: false },
  UNSUPPORTED_WEB_TRANSPORT: { stage: 'descriptor', retryable: false, authentication: false },
  LOCAL_AUTH_REQUIRED: { stage: 'auth', retryable: true, authentication: true },
  UPSTREAM_AUTH_REQUIRED: { stage: 'auth', retryable: true, authentication: true },
  IDENTITY_MISMATCH: { stage: 'auth', retryable: false, authentication: true },
  APPLICATION_NOT_READY: { stage: 'application', retryable: true, authentication: false },
  UPSTREAM_UNREACHABLE: { stage: 'application', retryable: true, authentication: false },
  REGISTRATION_STALE: { stage: 'service', retryable: false, authentication: false },
  OPERATION_CONFLICT: { stage: 'service', retryable: false, authentication: false },
  OPERATION_EXPIRED: { stage: 'service', retryable: false, authentication: false },
  OUTCOME_UNKNOWN: { stage: 'service', retryable: false, authentication: false },
  BAD_INPUT: { stage: 'helper', retryable: false, authentication: false },
  CONFIG_REQUIRED: { stage: 'helper', retryable: false, authentication: false },
  UNSAFE_PATH: { stage: 'helper', retryable: false, authentication: false },
  UNSAFE_FILE: { stage: 'helper', retryable: false, authentication: false },
  LINUX_REQUIRED: { stage: 'helper', retryable: false, authentication: false },
  CONTROL_FAILED: { stage: 'service', retryable: false, authentication: false },
  FORBIDDEN: { stage: 'local', retryable: false, authentication: false },
  NOT_FOUND: { stage: 'local', retryable: false, authentication: false },
  PROXY_PAUSED: { stage: 'local', retryable: true, authentication: false },
}

const CODES = new Set<string>(Object.keys(FACTS))

/** @returns whether an untrusted string is one of the fixed contract codes. */
export function isRemoteErrorCode(value: string): value is RemoteErrorCode {
  return CODES.has(value)
}

/** @returns the layer facts for a fixed code. */
export function errorFacts(code: RemoteErrorCode): ErrorFacts { return FACTS[code] }

/**
 * Redact a diagnostic string before it can reach a log, a snapshot or the management page.
 * Remote paths, credentials in URLs and anything that looks like a token are removed.
 */
export function redact(value: string): string {
  return value
    .replace(/(?:[A-Za-z0-9._-]*(?:token|secret|password|passwd|cookie|key)[A-Za-z0-9._-]*)\s*[=:]\s*\S+/giu, '$1=<redacted>')
    .replace(/\/\/([^@/\s]+)@/gu, '//<redacted>@')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, 300)
}

/**
 * Map an OpenSSH failure to a fixed code.
 *
 * `ssh` returns 255 for many distinct failures, so host-key and authentication problems are
 * only split out when the evidence is reliable. Everything else keeps the unified transport
 * code rather than guessing from an English message in an unknown locale.
 *
 * @param stderr - bounded stderr tail, already truncated by the caller.
 * @param code - process exit status, or null when the process was killed.
 * @param timedOut - whether the caller's own deadline fired.
 */
export function classifySshFailure(stderr: string, code: number | null, timedOut: boolean): RemoteErrorCode {
  if (timedOut) return 'SSH_TIMEOUT'
  if (/REMOTE HOST IDENTIFICATION HAS CHANGED|Host key verification failed/u.test(stderr)) return 'HOST_KEY_REJECTED'
  if (/Permission denied|Authentication failed|no supported authentication methods/u.test(stderr)) return 'SSH_AUTH_FAILED'
  if (/Could not resolve hostname/u.test(stderr)) return 'SSH_UNAVAILABLE'
  if (/Connection refused|Connection timed out|No route to host|Connection closed/u.test(stderr)) return 'SSH_UNAVAILABLE'
  if (code === 126 || code === 127) return 'HELPER_NOT_FOUND'
  return 'SSH_UNAVAILABLE'
}

/**
 * Map a structured helper failure to a fixed code.
 * A helper that rejects `--control` with BAD_INPUT is the only signal that selects connect-only
 * mode; every other non-zero exit keeps its own transport, permission or configuration error.
 *
 * @param stderr - bounded stderr tail.
 * @param code - process exit status, or null when the process was killed.
 * @param controlRequest - whether this invocation used `--control`.
 */
export function classifyHelperFailure(stderr: string, code: number | null, controlRequest: boolean): RemoteErrorCode {
  const structured = /\b(BAD_INPUT|CONFIG_REQUIRED|UNSAFE_PATH|UNSAFE_FILE|LINUX_REQUIRED|BAD_DESCRIPTOR|INFO_FAILED|CONTROL_FAILED|SERVICE_UNREGISTERED|USER_MANAGER_UNAVAILABLE|REGISTRATION_STALE|IDENTITY_MISMATCH|OPERATION_CONFLICT|OPERATION_EXPIRED)\b/u.exec(stderr)?.[1]
  // Two helper codes describe this side of the wire rather than an error code of their own.
  if (structured === 'BAD_DESCRIPTOR') return 'DESCRIPTOR_INVALID'
  if (structured === 'INFO_FAILED') return 'HELPER_BAD_CONFIG'
  if (structured !== undefined && isRemoteErrorCode(structured)) {
    if (structured === 'BAD_INPUT' && controlRequest) return 'CONTROL_UNSUPPORTED'
    return structured
  }
  if (code === 126 || code === 127) return 'HELPER_NOT_FOUND'
  if (/UNSAFE_PATH|UNSAFE_FILE/u.test(stderr)) return 'HELPER_UNSAFE'
  return 'HELPER_BAD_CONFIG'
}

/**
 * One error vocabulary for every layer of the remote connection.
 *
 * The management page decides what to offer from these codes and stages, never from a
 * localized sentence. Codes are fixed, carry no address, credential or command text, and are
 * also the value the proxy puts in the `X-DSH-Remote-Error` response header.
 */
/** Connection layer a failure belongs to. */
export type RemoteErrorStage = 'ssh' | 'helper' | 'service' | 'descriptor' | 'auth' | 'application' | 'local';
/** Fixed error codes shared with the Agent control contract. */
export type RemoteErrorCode = 'SSH_UNAVAILABLE' | 'SSH_AUTH_FAILED' | 'HOST_KEY_REJECTED' | 'SSH_TIMEOUT' | 'HELPER_NOT_FOUND' | 'HELPER_UNSAFE' | 'HELPER_BAD_CONFIG' | 'CONTROL_UNSUPPORTED' | 'SERVICE_UNREGISTERED' | 'SERVICE_STOPPED' | 'SERVICE_FAILED' | 'USER_MANAGER_UNAVAILABLE' | 'DESCRIPTOR_MISSING' | 'DESCRIPTOR_INVALID' | 'DESCRIPTOR_STALE' | 'UNSUPPORTED_WEB_TRANSPORT' | 'LOCAL_AUTH_REQUIRED' | 'UPSTREAM_AUTH_REQUIRED' | 'IDENTITY_MISMATCH' | 'APPLICATION_NOT_READY' | 'UPSTREAM_UNREACHABLE' | 'REGISTRATION_STALE' | 'OPERATION_CONFLICT' | 'OPERATION_EXPIRED' | 'OUTCOME_UNKNOWN' | 'BAD_INPUT' | 'CONFIG_REQUIRED' | 'UNSAFE_PATH' | 'UNSAFE_FILE' | 'LINUX_REQUIRED' | 'CONTROL_FAILED' | 'FORBIDDEN' | 'NOT_FOUND' | 'PROXY_PAUSED';
/** Result of one named preflight check. */
export type CheckState = 'unknown' | 'checking' | 'ok' | 'failed' | 'unsupported';
/** Named checks reported separately instead of collapsing into one phase. */
export type CheckName = 'ssh' | 'helper' | 'service' | 'descriptor' | 'listener' | 'identity' | 'authentication' | 'events' | 'application';
/** One check's public result; no credentials and no command text. */
export interface RemoteCheck {
    readonly name: CheckName;
    readonly state: CheckState;
    readonly code?: RemoteErrorCode;
    readonly checkedAt: string;
}
interface ErrorFacts {
    readonly stage: RemoteErrorStage;
    /** Whether repeating the same request can plausibly succeed without operator action. */
    readonly retryable: boolean;
    /** Whether the failure is a real authentication result rather than a transport problem. */
    readonly authentication: boolean;
}
/** @returns whether an untrusted string is one of the fixed contract codes. */
export declare function isRemoteErrorCode(value: string): value is RemoteErrorCode;
/** @returns the layer facts for a fixed code. */
export declare function errorFacts(code: RemoteErrorCode): ErrorFacts;
/**
 * Redact a diagnostic string before it can reach a log, a snapshot or the management page.
 * Remote paths, credentials in URLs and anything that looks like a token are removed.
 */
export declare function redact(value: string): string;
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
export declare function classifySshFailure(stderr: string, code: number | null, timedOut: boolean): RemoteErrorCode;
/**
 * Map a structured helper failure to a fixed code.
 * A helper that rejects `--control` with BAD_INPUT is the only signal that selects connect-only
 * mode; every other non-zero exit keeps its own transport, permission or configuration error.
 *
 * @param stderr - bounded stderr tail.
 * @param code - process exit status, or null when the process was killed.
 * @param controlRequest - whether this invocation used `--control`.
 */
export declare function classifyHelperFailure(stderr: string, code: number | null, controlRequest: boolean): RemoteErrorCode;
/** Local authorization is missing or does not match the live proxy instance. */
export declare const LOCAL_AUTH_REQUIRED = "LOCAL_AUTH_REQUIRED";
/** Raised when the remote instance is not the one this target pinned. */
export declare class IdentityMismatch extends Error {
}
/** Raised when the remote Harness itself rejected our remote session Cookie (a real 401). */
export declare class UpstreamAuthRequired extends Error {
}
/** Raised when the remote service is not listening yet; this is not an authentication failure. */
export declare class ServiceStopped extends Error {
}
/** Raised when the upstream is reachable but not answering usefully. */
export declare class UpstreamUnreachable extends Error {
}
export {};
//# sourceMappingURL=errors.d.ts.map
import type { DiscoveredTarget, RemoteDescriptor } from './types.ts';
export declare function validAlias(alias: string): boolean;
export declare function validHelperPath(path: string): boolean;
/** Outcome of one fixed-helper invocation, with bounded output and no parsed meaning. */
export interface HelperRun {
    readonly code: number | null;
    readonly stdout: string;
    readonly stderr: string;
    readonly timedOut: boolean;
    readonly oversized: boolean;
}
/**
 * Run the fixed absolute helper over its own non-interactive SSH process.
 *
 * The caller supplies the already-validated alias, helper path and extra arguments; this
 * function performs no allowlist decisions of its own beyond the argument count.
 *
 * @param alias - configured OpenSSH alias.
 * @param helperPath - fixed executable, never derived from a request.
 * @param args - literal helper arguments, only `--identity` or `--control`.
 * @param request - one line of JSON written to the helper's stdin.
 * @param signal - operation lifetime.
 * @param timeoutMs - hard deadline for the whole invocation.
 */
export declare function runHelper(alias: string, helperPath: string, args: readonly string[], request: string, signal: AbortSignal, timeoutMs?: number): Promise<HelperRun>;
/** Run the fixed helper over a separate non-interactive SSH process. */
export declare function discover(alias: string, instanceKey: string, helperPath: string, signal: AbortSignal): Promise<RemoteDescriptor>;
/** Read public instance facts over a host-key-verified SSH connection.
 * @param alias - configured OpenSSH alias. @param instanceKey - Companion key.
 * @param helperPath - fixed executable. @param signal - operation lifetime.
 * @returns identity and port with no launch credential.
 */
export declare function discoverTarget(alias: string, instanceKey: string, helperPath: string, signal: AbortSignal): Promise<DiscoveredTarget>;
/** One SSH local forward created by this plugin; stop never targets another process. */
export interface OwnedForward {
    readonly port: number;
    readonly exited: Promise<number | null>;
    stop(): Promise<void>;
}
/** Create the sole local forward to a known remote loopback port. */
export declare function forward(alias: string, remotePort: number, signal: AbortSignal): Promise<OwnedForward>;
//# sourceMappingURL=ssh.d.ts.map
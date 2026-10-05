import type { DiscoveredTarget, RemoteDescriptor } from './types.ts';
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
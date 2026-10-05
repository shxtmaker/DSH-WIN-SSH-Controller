import type { RemoteDescriptor } from './types.ts';
/** Run the fixed helper over a separate non-interactive SSH process. */
export declare function discover(alias: string, instanceKey: string, helperPath: string, signal: AbortSignal): Promise<RemoteDescriptor>;
/** One SSH local forward created by this plugin; stop never targets another process. */
export interface OwnedForward {
    readonly port: number;
    readonly exited: Promise<number | null>;
    stop(): Promise<void>;
}
/** Create the sole local forward to a known remote loopback port. */
export declare function forward(alias: string, remotePort: number, signal: AbortSignal): Promise<OwnedForward>;
//# sourceMappingURL=ssh.d.ts.map
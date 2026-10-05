import { TargetStore } from './store.ts';
import type { RemoteSnapshot, RemoteTarget } from './types.ts';
/** Holds exactly one remote attachment and never owns the remote Harness process. */
export declare class ConnectionManager {
    private readonly targets;
    private readonly helperPath;
    private current;
    private connecting;
    private pending;
    private disposed;
    private settlement;
    private state;
    private readonly listeners;
    /** @param targets - non-secret target store. @param helperPath - fixed Linux helper executable path. */
    constructor(targets: TargetStore, helperPath: string);
    /** @returns current non-sensitive snapshot. */
    getState(): RemoteSnapshot;
    /** @returns configured non-secret targets. */
    listTargets(): Promise<RemoteTarget[]>;
    /** @param target - full non-secret target. @returns saved records. */
    saveTarget(target: unknown): Promise<RemoteTarget[]>;
    /**
     * Connect a reviewed SSH alias to one configured instance.
     * @param targetId - stable target id.
     * @param endpointId - selected LAN, frp TCP, or STCP alias.
     * @param operationId - caller operation id for duplicate connect suppression.
     * @returns authenticated connection snapshot.
     */
    connect(targetId: string, endpointId: string, operationId: string): Promise<RemoteSnapshot>;
    /** Read public identity, pin new targets, and attach using only an SSH alias.
     * @param sshAlias - reviewed OpenSSH alias. @param instanceKey - Companion key, normally default.
     * @param operationId - caller operation id.
     * @returns authenticated attachment state; existing identity pins are never replaced.
     */
    quickConnect(sshAlias: string, instanceKey: string, operationId: string): Promise<RemoteSnapshot>;
    private checkAvailable;
    private attach;
    /** @param connectionId - attachment to release. @returns idle or unchanged state. */
    disconnect(connectionId: string): Promise<RemoteSnapshot>;
    /** @param connectionId - active attachment. @returns one-use, short-lived local URL. */
    createOpenTicket(connectionId: string): string;
    /** @param signal - stream cancellation. @returns latest state followed by changes. */
    watch(signal: AbortSignal): AsyncIterable<RemoteSnapshot>;
    /** Release local resources on Host plugin disposal. */
    dispose(): Promise<void>;
    private publish;
    private attempt;
    private lost;
    private release;
    private failurePhase;
    private failureReason;
}
//# sourceMappingURL=manager.d.ts.map
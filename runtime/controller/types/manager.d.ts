import { LOCAL_AUTH_REQUIRED, type RemoteErrorCode } from './errors.ts';
import { TargetStore } from './store.ts';
import { type EndpointRef, type RemoteInspection, type RemoteSnapshot, type RemoteTarget, type ServiceOperationState } from './types.ts';
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
    /**
     * Read-only preflight for one endpoint. It never saves a target and never starts a service,
     * so a first-time alias can be inspected before anything is pinned.
     * @param ref - saved target or first-time SSH alias.
     * @param operationId - caller operation id, validated but never persisted.
     * @returns capability, service and layered diagnostic summary.
     */
    inspectEndpoint(ref: EndpointRef, operationId: string): Promise<RemoteInspection>;
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
    serviceAction(ref: EndpointRef, action: 'start' | 'stop' | 'restart', operationId: string, issuedAt: string, registrationRevision: string, expectedInstanceId?: string): Promise<ServiceOperationState>;
    /**
     * Read one previously submitted action's receipt. This never submits a new action.
     * @param ref - endpoint the receipt belongs to.
     * @param operationId - the id used when the action was submitted.
     */
    getServiceOperation(ref: EndpointRef, operationId: string): Promise<ServiceOperationState>;
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
    refreshAuthentication(connectionId: string, operationId: string): Promise<RemoteSnapshot>;
    private checkAvailable;
    /** @returns the saved target and alias for an endpoint reference. */
    private resolve;
    private control;
    private serviceState;
    private operationFromReceipt;
    /** Read the public instance identity over `--identity`; never fetches a launch credential. */
    private identityOnly;
    private attach;
    /** @param connectionId - attachment to release. @returns idle or unchanged state. */
    disconnect(connectionId: string): Promise<RemoteSnapshot>;
    /** @param connectionId - active attachment. @returns one-use, short-lived local URL. */
    createOpenTicket(connectionId: string): string;
    /**
     * Record that a browser page asked for access without a usable local Cookie.
     * A single unauthenticated scan never marks the remote service as stopped and never closes
     * another authenticated page's WebSocket.
     * @param code - fixed code reported by the proxy.
     */
    noteAccessWarning(code: RemoteErrorCode): void;
    /** @param signal - stream cancellation. @returns latest state followed by changes. */
    watch(signal: AbortSignal): AsyncIterable<RemoteSnapshot>;
    /** Release local resources on Host plugin disposal. */
    dispose(): Promise<void>;
    private publish;
    /**
     * Publish only while `active` is still the current attachment.
     * A late result from a replaced or disconnected connection is dropped instead of
     * overwriting the new target's state.
     */
    private publishFor;
    private assertDescriptor;
    private assertIdentity;
    private attempt;
    /** Re-read the real service state after an action whose outcome is not certain. */
    private reconcileAfterAction;
    /** Wait for a started or restarted service to become really ready again. */
    private waitForReady;
    private lost;
    private release;
    private codeFor;
    private failureChecks;
    private failurePhase;
    private failureReason;
}
/** Re-exported so the Host plugin can surface the local-authorization code without importing the proxy. */
export { LOCAL_AUTH_REQUIRED };
//# sourceMappingURL=manager.d.ts.map
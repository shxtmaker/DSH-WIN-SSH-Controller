import { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { EndpointRef, RemoteInspection, RemoteSnapshot, RemoteTarget, ServiceOperationState } from './types.ts';
export type { EndpointRef, RemoteCheck, RemoteEndpoint, RemoteIdentity, RemoteInspection, RemotePhase, RemoteServiceState, RemoteSnapshot, RemoteTarget, ServiceOperationState } from './types.ts';
declare module '@deepseek-ai/cordis' {
    interface Context {
        /** Desktop-owned remote workspace attachment. */
        remoteWorkspace: RemoteWorkspaceController;
    }
}
/** Host-side helper location; SSH receives this path as a fixed command. */
export interface Config {
    /** Absolute Linux path to the restricted SSH descriptor helper. */
    readonly helperPath: string;
}
/** Authenticated Remote methods for the local management page. */
export default class RemoteWorkspaceController extends TypertRemoteService {
    static Config: z<Config>;
    private readonly manager;
    /** @param ctx - Desktop Host Context. @param config - reviewed helper path. */
    constructor(ctx: Context, config: Config);
    /**
     * Read configured remote attachment targets.
     * @returns all non-secret target records.
     */
    listTargets(): Promise<RemoteTarget[]>;
    /** Read selectable aliases from the user's OpenSSH configuration.
     * @returns literal Host names without credentials or SSH configuration content.
     */
    listAliases(): Promise<string[]>;
    /** Discover, save and connect a target through strict OpenSSH verification.
     * @param sshAlias - configured SSH alias. @param instanceKey - Companion key.
     * @param operationId - idempotency key for this connection intent.
     * @returns authenticated connection state.
     */
    quickConnect(sshAlias: string, instanceKey: string, operationId: string): Promise<RemoteSnapshot>;
    /**
     * Persist one complete target without credentials.
     * @param target - complete non-secret record.
     * @returns saved target records.
     */
    saveTarget(target: RemoteTarget): Promise<RemoteTarget[]>;
    /**
     * Attach one target over a reviewed SSH alias.
     * @param targetId - stable target id.
     * @param endpointId - chosen LAN, TCP, or STCP endpoint.
     * @param operationId - idempotency key for this connect intent.
     * @returns connection state after authentication and event readiness.
     */
    connect(targetId: string, endpointId: string, operationId: string): Promise<RemoteSnapshot>;
    /**
     * Read the local attachment state.
     * @returns current local connection state without credentials.
     */
    getState(): RemoteSnapshot;
    /**
     * Release local resources owned by one attachment.
     * @param connectionId - active local attachment.
     * @returns new state.
     */
    disconnect(connectionId: string): Promise<RemoteSnapshot>;
    /**
     * Issue a Browser ticket for the authenticated attachment.
     * @param connectionId - ready local attachment.
     * @returns one-use, short-lived local Browser URL.
     */
    createOpenTicket(connectionId: string): string;
    /**
     * Read-only preflight for a saved target or a first-time SSH alias.
     * Never saves a target and never starts a remote service.
     * @param ref - mutually exclusive endpoint reference.
     * @param operationId - idempotency key for this inspection.
     * @returns capability, service and layered diagnostic summary.
     */
    inspectEndpoint(ref: EndpointRef, operationId: string): Promise<RemoteInspection>;
    /**
     * Submit exactly one restricted service action against the active attachment.
     * @param ref - endpoint the action applies to.
     * @param action - start, stop or restart.
     * @param operationId - idempotency key, reused when asking for the result.
     * @param issuedAt - ISO timestamp of the intent.
     * @param registrationRevision - revision the caller observed.
     * @param expectedInstanceId - pinned instance id, when known.
     * @returns the operation state, including a possible outcome-unknown.
     */
    serviceAction(ref: EndpointRef, action: 'start' | 'stop' | 'restart', operationId: string, issuedAt: string, registrationRevision: string, expectedInstanceId?: string): Promise<ServiceOperationState>;
    /**
     * Read a previously submitted action's result. Never submits a new action.
     * @param ref - endpoint the receipt belongs to.
     * @param operationId - the id used when the action was submitted.
     * @returns the recorded operation state.
     */
    getServiceOperation(ref: EndpointRef, operationId: string): Promise<ServiceOperationState>;
    /**
     * Re-authenticate the active attachment without touching the remote service.
     * @param connectionId - active attachment.
     * @param operationId - idempotency key for this refresh.
     * @returns the new snapshot.
     */
    refreshAuthentication(connectionId: string, operationId: string): Promise<RemoteSnapshot>;
    /**
     * Observe attachment state until the caller cancels its stream.
     * @param signal - Remote stream lifetime.
     * @returns current state and later changes.
     */
    watch(signal: AbortSignal): AsyncIterable<RemoteSnapshot>;
}
//# sourceMappingURL=index.d.ts.map
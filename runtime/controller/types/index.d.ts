import { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { RemoteSnapshot, RemoteTarget } from './types.ts';
export type { RemoteEndpoint, RemoteIdentity, RemotePhase, RemoteSnapshot, RemoteTarget } from './types.ts';
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
     * Observe attachment state until the caller cancels its stream.
     * @param signal - Remote stream lifetime.
     * @returns current state and later changes.
     */
    watch(signal: AbortSignal): AsyncIterable<RemoteSnapshot>;
}
//# sourceMappingURL=index.d.ts.map
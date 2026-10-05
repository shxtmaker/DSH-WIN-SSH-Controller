/** Non-secret target records and observable local connection state. */
/** One reviewed OpenSSH alias reaching the same target by a particular path. */
export interface RemoteEndpoint {
    readonly id: string;
    readonly kind: 'lan' | 'frp-tcp' | 'stcp';
    readonly sshAlias: string;
}
/** Persisted target identity; transient frp or visitor ports are never identity. */
export interface RemoteTarget {
    readonly id: string;
    readonly name: string;
    readonly instanceKey: string;
    readonly instanceId: string;
    readonly profile: string;
    readonly workspaceHint: string;
    readonly remotePort: number;
    readonly endpoints: readonly RemoteEndpoint[];
}
/** Phases published to the management page without credentials or process details. */
export type RemotePhase = 'idle' | 'ssh-auth' | 'discovering' | 'forwarding' | 'authenticating' | 'app-ready' | 'disconnected' | 'reconnecting' | 'identity-mismatch' | 'auth-required' | 'error';
/** One connection generation's public facts. */
export interface RemoteSnapshot {
    readonly phase: RemotePhase;
    readonly connectionId?: string | undefined;
    readonly targetId?: string;
    readonly endpointId?: string;
    readonly hostName?: string;
    readonly instanceId?: string;
    readonly bootId?: string;
    readonly profile?: string;
    readonly workspaceHint?: string;
    readonly generation: number;
    readonly reason?: string;
}
/** The constrained SSH helper response, kept only on the Host. */
export interface RemoteDescriptor {
    readonly protocolVersion: 1;
    readonly instanceId: string;
    readonly bootId: string;
    readonly instanceKey: string;
    readonly profile: string;
    readonly workspaceHint: string;
    readonly port: number;
    readonly launchUrl: string;
}
/** Authenticated Companion identity with no credential fields. */
export interface RemoteIdentity {
    readonly protocolVersion: 1;
    readonly instanceId: string;
    readonly bootId: string;
    readonly instanceKey: string;
    readonly profile: string;
    readonly workspaceHint: string;
    readonly version: string;
    readonly capabilities: readonly string[];
}
//# sourceMappingURL=types.d.ts.map
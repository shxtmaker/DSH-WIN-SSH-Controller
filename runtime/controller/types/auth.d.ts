import type { RemoteDescriptor, RemoteIdentity } from './types.ts';
/** Accept only the configured loopback Harness launch URL and extract its transient token. */
export declare function launchToken(value: string, remotePort: number): string;
/** Exchange a launch token for a Host-only browser Cookie, without redirects. */
export declare function authenticate(port: number, remotePort: number, descriptor: RemoteDescriptor): Promise<string>;
/** Read Companion identity through Harness's authenticated /api transport. */
export declare function readIdentity(port: number, remotePort: number, cookie: string): Promise<RemoteIdentity>;
/** Open the actual Typert event stream and wait for its first ready frame. */
export declare function probeEventStream(port: number, remotePort: number, cookie: string): Promise<void>;
//# sourceMappingURL=auth.d.ts.map
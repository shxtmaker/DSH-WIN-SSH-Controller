import { type RemoteErrorCode } from './errors.ts';
/** Live proxy-owned HTTP server, session Cookie, tickets, and sockets. */
export declare class AuthProxy {
    private upstreamPort;
    private readonly remotePort;
    private upstreamCookie;
    private readonly onError?;
    private readonly server;
    private readonly sockets;
    private readonly ticketValues;
    private readonly cookieName;
    private readonly cookieValue;
    private portValue;
    private closed;
    private paused;
    /** Codes already reported for this instance, so one scan cannot produce endless notices. */
    private readonly reported;
    /**
     * @param upstreamPort - this plugin's SSH local-forward port.
     * @param remotePort - approved Harness authority port.
     * @param upstreamCookie - Host-only remote session Cookie.
     * @param onError - bounded notification for errors this proxy generated itself. Each fixed
     *   code is reported at most once per instance, so an unauthenticated loopback scan cannot
     *   produce an unbounded stream of events and cannot affect other authenticated pages.
     */
    constructor(upstreamPort: number, remotePort: number, upstreamCookie: string, onError?: ((code: RemoteErrorCode) => void) | undefined);
    /** @returns the bound local origin after start. */
    get origin(): string;
    /** Bind only loopback on an OS-assigned port. */
    start(): Promise<void>;
    /** @returns a 30-second, one-use fragment URL; the remote token is absent. */
    openTicket(): string;
    /** Keep the Browser origin while severing the old, unauthenticated transport. */
    pause(): void;
    /** Resume only after SSH discovery, token exchange, identity, and event checks pass. */
    resume(upstreamPort: number, upstreamCookie: string): void;
    /** Revoke sessions, tickets, and every owned transport without touching SSH or Harness. */
    stop(): Promise<void>;
    private trusted;
    private authenticated;
    /** @param code - fixed code to report once per proxy instance. */
    private report;
    private reject;
    /**
     * Refuse a request that carries no usable local authorization.
     *
     * An HTML navigation gets the static recovery page, still under 401. Anything else keeps a
     * plain error: an API or write call must never be answered with a 200 or with login HTML.
     */
    private unauthorized;
    private handle;
    private requestHeaders;
    private proxyHttp;
    private upgrade;
}
//# sourceMappingURL=proxy.d.ts.map
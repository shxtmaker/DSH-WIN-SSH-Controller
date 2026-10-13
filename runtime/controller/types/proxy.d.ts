/** Local authorization is missing or does not match the live proxy instance. */
export declare const LOCAL_AUTH_REQUIRED = "LOCAL_AUTH_REQUIRED";
/** Live proxy-owned HTTP server, session Cookie, tickets, and sockets. */
export declare class AuthProxy {
    private upstreamPort;
    private readonly remotePort;
    private upstreamCookie;
    private readonly server;
    private readonly sockets;
    private readonly ticketValues;
    private readonly cookieName;
    private readonly cookieValue;
    private portValue;
    private closed;
    private paused;
    /**
     * @param upstreamPort - this plugin's SSH local-forward port.
     * @param remotePort - approved Harness authority port.
     * @param upstreamCookie - Host-only remote session Cookie.
     */
    constructor(upstreamPort: number, remotePort: number, upstreamCookie: string);
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
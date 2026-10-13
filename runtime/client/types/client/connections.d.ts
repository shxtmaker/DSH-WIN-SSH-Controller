/** Desktop connection management page and persistent remote-location indicator. */
import { type ReactNode } from 'react';
import type { PropsLocale, PropsRuntime, InjectFace } from '@deepseek-ai/dsh-client-ui-slots';
import type { RemoteSnapshot, RemoteTarget, ServiceOperationState } from 'dsh-win-ssh-controller-source/types';
/** One restricted service action the remote helper accepts. */
export type ServiceAction = 'start' | 'stop' | 'restart';
/** Result of the most recent user-initiated open; an API success never proves the page loaded. */
export interface OpenRequest {
    /** Fixed outcome of the attempt; a failed ticket creation never renders as an opened page. */
    readonly status: 'requested' | 'failed';
    /** Short-lived ticket URL, offered as an explicit link as well as through `window.open`. */
    readonly url?: string | undefined;
    /** When the ticket was issued, so the page can present it as short-lived. */
    readonly issuedAt: number;
}
/** State shared by the management page and always-visible location indicator. */
export interface ViewState {
    readonly targets: readonly RemoteTarget[];
    readonly connection: RemoteSnapshot;
    readonly busy: boolean;
    readonly aliases: readonly string[];
    readonly aliasWarning?: boolean | undefined;
    readonly hostRestartRequired?: boolean | undefined;
    readonly error?: string | undefined;
    /** Whether a local session is selected; without one the system browser is the primary entry. */
    readonly localSession: boolean;
    /** Most recent service operation; the Host snapshot is authoritative when it carries one. */
    readonly serviceOperation?: ServiceOperationState | undefined;
    /** Result of the most recent user-initiated open. */
    readonly openRequest?: OpenRequest | undefined;
}
/** UI actions use only the local Host's authenticated Remote control surface. */
export interface RemoteWorkspaceFace {
    getSnapshot: () => ViewState;
    subscribe: (listener: () => void) => () => void;
    refresh: () => Promise<void>;
    save: (target: RemoteTarget) => Promise<void>;
    quickConnect: (sshAlias: string, instanceKey: string) => Promise<void>;
    connect: (targetId: string, endpointId: string) => Promise<void>;
    disconnect: () => Promise<void>;
    open: () => Promise<void>;
    /** Open the ticket URL in the system browser; never requires a local session. */
    openInSystemBrowser: () => Promise<void>;
    /** Request a fresh ticket after the previous one expired. */
    regenerateTicket: () => Promise<void>;
    /** Renew the remote authentication explicitly; never restarts the remote service. */
    renewAuthentication: () => Promise<void>;
    /** Submit exactly one restricted service action. */
    serviceAction: (action: ServiceAction) => Promise<void>;
    /** Read a pending operation's result; never submits an action. */
    readServiceOperation: () => Promise<void>;
    fail: (message: string) => void;
}
type PageProps = PropsRuntime<'main'> & PropsLocale<'remoteWorkspace'> & InjectFace<RemoteWorkspaceFace>;
type IndicatorProps = PropsLocale<'remoteWorkspace'> & InjectFace<RemoteWorkspaceFace>;
/** Render target configuration and one-connection actions in the main pane. */
export declare function ConnectionsPage({ t, getSnapshot, subscribe, refresh, save, quickConnect, connect, disconnect, open, openInSystemBrowser, regenerateTicket, renewAuthentication, serviceAction, readServiceOperation, }: PageProps): ReactNode;
/** Keep the actual execution host and remote workspace visible over the local shell. */
export declare function RemoteIndicator({ t, getSnapshot, subscribe }: IndicatorProps): ReactNode;
export {};
//# sourceMappingURL=connections.d.ts.map
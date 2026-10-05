/** Desktop connection management page and persistent remote-location indicator. */
import { type ReactNode } from 'react';
import type { PropsLocale, PropsRuntime, InjectFace } from '@deepseek-ai/dsh-client-ui-slots';
import type { RemoteSnapshot, RemoteTarget } from 'dsh-win-ssh-controller-source/types';
/** State shared by the management page and always-visible location indicator. */
export interface ViewState {
    readonly targets: readonly RemoteTarget[];
    readonly connection: RemoteSnapshot;
    readonly busy: boolean;
    readonly error?: string | undefined;
}
/** UI actions use only the local Host's authenticated Remote control surface. */
export interface RemoteWorkspaceFace {
    getSnapshot: () => ViewState;
    subscribe: (listener: () => void) => () => void;
    refresh: () => Promise<void>;
    save: (target: RemoteTarget) => Promise<void>;
    connect: (targetId: string, endpointId: string) => Promise<void>;
    disconnect: () => Promise<void>;
    open: () => Promise<void>;
    fail: (message: string) => void;
}
type PageProps = PropsRuntime<'main'> & PropsLocale<'remoteWorkspace'> & InjectFace<RemoteWorkspaceFace>;
type IndicatorProps = PropsLocale<'remoteWorkspace'> & InjectFace<RemoteWorkspaceFace>;
/** Render target configuration and one-connection actions in the main pane. */
export declare function ConnectionsPage({ t, getSnapshot, subscribe, refresh, save, connect, disconnect, open, fail }: PageProps): ReactNode;
/** Keep the actual execution host and remote workspace visible over the local shell. */
export declare function RemoteIndicator({ t, getSnapshot, subscribe }: IndicatorProps): ReactNode;
export {};
//# sourceMappingURL=connections.d.ts.map
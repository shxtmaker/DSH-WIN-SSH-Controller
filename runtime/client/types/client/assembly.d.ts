/** Mount the generated Host contract before registering its dependent page. */
import type { Context } from '@deepseek-ai/cordis';
export type {} from 'dsh-win-ssh-controller-source/remote';
import { type RemoteWorkspaceKey } from './locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        'remoteWorkspace': RemoteWorkspaceKey;
    }
}
/** Only the Remote base service is injected here; the namespace is mounted before UI activation. */
export declare const inject: string[];
/** @param ctx - Client module context. @returns contract disposer after the UI effects unwind. */
export declare function apply(ctx: Context): Promise<() => Promise<void>>;
//# sourceMappingURL=assembly.d.ts.map
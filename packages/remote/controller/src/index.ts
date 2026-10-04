/** Local Desktop Host control plane for one attached remote Harness. */
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type {} from '@deepseek-ai/dsh-app-boot'
import { ConnectionManager } from './manager.ts'
import { TargetStore } from './store.ts'
import type { RemoteSnapshot, RemoteTarget } from './types.ts'

export type { RemoteEndpoint, RemoteIdentity, RemotePhase, RemoteSnapshot, RemoteTarget } from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Desktop-owned remote workspace attachment. */
    remoteWorkspace: RemoteWorkspaceController
  }
}

/** Host-side helper location; SSH receives this path as a fixed command. */
export interface Config {
  /** Absolute Linux path to the restricted SSH descriptor helper. */
  readonly helperPath: string
}

/** Authenticated Remote methods for the local management page. */
export default class RemoteWorkspaceController extends TypertRemoteService {
  static Config: z<Config> = z.object({ helperPath: z.string().required() })
  private readonly manager: ConnectionManager

  /** @param ctx - Desktop Host Context. @param config - reviewed helper path. */
  constructor(ctx: Context, config: Config) {
    super(ctx, 'remoteWorkspace', { namespace: 'remoteWorkspace' })
    this.manager = new ConnectionManager(
      new TargetStore(join(ctx.profileContext.home, 'remote-workspace', 'targets.json')),
      config.helperPath,
    )
    ctx.effect(() => () => this.manager.dispose(), 'remote-workspace: local resource cleanup')
  }

  /**
   * Read configured remote attachment targets.
   * @returns all non-secret target records.
   */
  @Remote
  listTargets(): Promise<RemoteTarget[]> { return this.manager.listTargets() }

  /**
   * Persist one complete target without credentials.
   * @param target - complete non-secret record.
   * @returns saved target records.
   */
  @Remote
  saveTarget(target: RemoteTarget): Promise<RemoteTarget[]> { return this.manager.saveTarget(target) }

  /**
   * Attach one target over a reviewed SSH alias.
   * @param targetId - stable target id.
   * @param endpointId - chosen LAN, TCP, or STCP endpoint.
   * @param operationId - idempotency key for this connect intent.
   * @returns connection state after authentication and event readiness.
   */
  @Remote
  connect(targetId: string, endpointId: string, operationId: string): Promise<RemoteSnapshot> {
    return this.manager.connect(targetId, endpointId, operationId)
  }

  /**
   * Read the local attachment state.
   * @returns current local connection state without credentials.
   */
  @Remote
  getState(): RemoteSnapshot { return this.manager.getState() }

  /**
   * Release local resources owned by one attachment.
   * @param connectionId - active local attachment.
   * @returns new state.
   */
  @Remote
  disconnect(connectionId: string): Promise<RemoteSnapshot> { return this.manager.disconnect(connectionId) }

  /**
   * Issue a Browser ticket for the authenticated attachment.
   * @param connectionId - ready local attachment.
   * @returns one-use, short-lived local Browser URL.
   */
  @Remote
  createOpenTicket(connectionId: string): string { return this.manager.createOpenTicket(connectionId) }

  /**
   * Observe attachment state until the caller cancels its stream.
   * @param signal - Remote stream lifetime.
   * @returns current state and later changes.
   */
  @Remote({ mode: 'stream' })
  watch(signal: AbortSignal): AsyncIterable<RemoteSnapshot> { return this.manager.watch(signal) }
}

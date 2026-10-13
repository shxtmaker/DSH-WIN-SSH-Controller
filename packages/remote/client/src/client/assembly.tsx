/** Mount the generated Host contract before registering its dependent page. */
import type { Context } from '@deepseek-ai/cordis'
import remoteWorkspaceContribution from '@harness-remote/controller/remote'
export type {} from '@harness-remote/controller/remote'
import type {} from '@deepseek-ai/dsh-api-gateway/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-browser/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import { randomUUID } from '@deepseek-ai/dsh-util-crypto'
import type { RemoteSnapshot, RemoteTarget } from '@harness-remote/controller/types'
import { ConnectionsPage, RemoteIndicator, type RemoteWorkspaceFace, type ServiceAction, type ViewState } from './connections.tsx'
import { en, zh, type RemoteWorkspaceKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { 'remoteWorkspace': RemoteWorkspaceKey }
}

const PANEL = 'remote-workspace' as MainPanelId
const INITIAL: RemoteSnapshot = { phase: 'idle', generation: 0, diagnostics: [] }

/** Identify only missing automation methods on the local Host, without classifying remote HTTP failures. */
function missingAutomationRoute(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /^client api: remoteWorkspace\/(listAliases|quickConnect) failed: transport failure for \/api\/remoteWorkspace\/\1: HTTP 404$/u.test(message)
}

class ViewController implements RemoteWorkspaceFace {
  private state: ViewState = { targets: [], aliases: [], connection: INITIAL, busy: false, localSession: false }
  private readonly listeners = new Set<() => void>()

  constructor(private readonly ctx: Context) {}

  getSnapshot = (): ViewState => this.state
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  private publish(state: ViewState): void {
    // The local Session decides which open entry point is primary, so it is read on every change.
    this.state = { ...state, localSession: this.selectedSession() !== undefined }
    for (const listener of this.listeners) listener()
  }

  fail = (message: string): void => { this.publish({ ...this.state, error: message }) }

  private async action(run: () => Promise<void>): Promise<void> {
    if (this.state.busy) return
    this.publish({ ...this.state, busy: true, error: undefined })
    try { await run() } catch (error) {
      if (missingAutomationRoute(error)) this.publish({ ...this.state, hostRestartRequired: true, error: undefined })
      else this.fail(error instanceof Error ? error.message : String(error))
    } finally { this.publish({ ...this.state, busy: false }) }
  }

  refresh = async (): Promise<void> => this.action(async () => {
    const targets = await this.ctx.remote.remoteWorkspace.listTargets()
    if (!targets.ok) throw targets.error
    const connection = await this.ctx.remote.remoteWorkspace.getState()
    if (!connection.ok) throw connection.error
    this.publish({ ...this.state, targets: targets.value, connection: connection.value,
      serviceOperation: connection.value.serviceOperation ?? this.state.serviceOperation })
    // A reload only ever reads an operation that is still running; it never submits the action again.
    await this.readServiceOperation()
    const aliases = await this.ctx.remote.remoteWorkspace.listAliases()
    if (!aliases.ok && missingAutomationRoute(aliases.error)) throw aliases.error
    this.publish({ ...this.state, aliases: aliases.ok ? aliases.value : [], aliasWarning: aliases.ok ? undefined : true,
      hostRestartRequired: aliases.ok ? false : this.state.hostRestartRequired })
  })

  quickConnect = async (sshAlias: string, instanceKey: string): Promise<void> => this.action(async () => {
    if (this.state.hostRestartRequired) return
    const result = await this.ctx.remote.remoteWorkspace.quickConnect(sshAlias.trim(), instanceKey.trim(), randomUUID())
    const targets = await this.ctx.remote.remoteWorkspace.listTargets()
    if (targets.ok) this.publish({ ...this.state, targets: targets.value })
    if (!result.ok) throw result.error
    this.publish({ ...this.state, connection: result.value })
    if (this.selectedSession() !== undefined) await this.openReady()
  })

  save = async (target: RemoteTarget): Promise<void> => this.action(async () => {
    const result = await this.ctx.remote.remoteWorkspace.saveTarget(target)
    if (!result.ok) throw result.error
    this.publish({ ...this.state, targets: result.value })
  })

  connect = async (targetId: string, endpointId: string): Promise<void> => this.action(async () => {
    const result = await this.ctx.remote.remoteWorkspace.connect(targetId, endpointId, randomUUID())
    if (!result.ok) throw result.error
    this.publish({ ...this.state, connection: result.value })
    if (this.selectedSession() !== undefined) await this.openReady()
  })

  disconnect = async (): Promise<void> => this.action(async () => {
    const id = this.state.connection.connectionId
    if (id === undefined) return
    const result = await this.ctx.remote.remoteWorkspace.disconnect(id)
    if (!result.ok) throw result.error
    this.publish({ ...this.state, connection: result.value })
  })

  open = async (): Promise<void> => this.action(() => this.openReady())

  /**
   * Open the authenticated workspace in the system browser.
   *
   * This never needs a local Session, because it does not touch the Sidebar, so it stays available
   * when no session is selected. It reuses the one-use ticket and the existing
   * `window.open(url, '_blank', 'noopener,noreferrer')` path that alpha.2 already routes to Desktop
   * `shell.openExternal`; no renderer capability and no shell command is added. The connection id
   * and generation are re-checked before and after the asynchronous ticket request, and a success
   * only ever means the open was requested.
   */
  openInSystemBrowser = async (): Promise<void> => this.action(async () => {
    const connection = this.state.connection
    const id = connection.connectionId
    if (id === undefined) throw new Error('remote-workspace: no active connection')
    const generation = connection.generation
    const result = await this.ctx.remote.remoteWorkspace.createOpenTicket(id)
    if (!result.ok) throw result.error
    if (this.state.connection.connectionId !== id || this.state.connection.generation !== generation) {
      throw new Error('remote-workspace: CONNECTION_CHANGED')
    }
    if (typeof result.value !== 'string' || !/^https?:\/\//u.test(result.value)) {
      throw new Error('remote-workspace: the local Host returned no usable open ticket')
    }
    // `noopener` makes the browser return null even on success, so the page always offers the
    // explicit link and never claims the remote page loaded.
    window.open(result.value, '_blank', 'noopener,noreferrer')
    this.publish({ ...this.state, openRequest: { status: 'requested', url: result.value, issuedAt: Date.now() } })
  })

  /** Replace an expired ticket with a fresh one through the same controlled path. */
  regenerateTicket = async (): Promise<void> => {
    this.publish({ ...this.state, openRequest: undefined })
    await this.openInSystemBrowser()
  }

  /** Explicit re-authentication; it never restarts the remote service and never replays a request. */
  renewAuthentication = async (): Promise<void> => this.action(async () => {
    const id = this.state.connection.connectionId
    if (id === undefined) throw new Error('remote-workspace: no active connection')
    const result = await this.ctx.remote.remoteWorkspace.refreshAuthentication(id, randomUUID())
    if (!result.ok) throw result.error
    this.publish({ ...this.state, connection: result.value })
  })

  /** Submit exactly one restricted service action; a page reload never re-submits it. */
  serviceAction = async (action: ServiceAction): Promise<void> => this.action(async () => {
    const connection = this.state.connection
    const id = connection.connectionId
    if (id === undefined) throw new Error('remote-workspace: no active connection')
    const generation = connection.generation
    const operationId = randomUUID()
    const result = await this.ctx.remote.remoteWorkspace.serviceAction(this.endpointRef(connection), action,
      operationId, new Date().toISOString(), this.registrationRevision(connection), connection.instanceId)
    if (this.state.connection.connectionId !== id || this.state.connection.generation !== generation) {
      throw new Error('remote-workspace: CONNECTION_CHANGED')
    }
    if (!result.ok) throw result.error
    this.publish({ ...this.state, serviceOperation: result.value })
  })

  /** Read a submitted operation's result. This never submits a new action. */
  readServiceOperation = async (): Promise<void> => {
    const connection = this.state.connection
    const operation = this.state.serviceOperation ?? connection.serviceOperation
    if (operation?.operationId === undefined) return
    if (operation.phase !== 'submitting' && operation.phase !== 'waiting') return
    const result = await this.ctx.remote.remoteWorkspace
      .getServiceOperation(this.endpointRef(connection), operation.operationId)
    if (!result.ok) return
    this.publish({ ...this.state, serviceOperation: result.value })
  }

  /** Endpoint reference of the active attachment; a saved target keeps its reviewed route. */
  private endpointRef(connection: RemoteSnapshot): { targetId: string; endpointId: string } | { sshAlias: string; instanceKey: string } {
    if (connection.targetId !== undefined && connection.endpointId !== undefined) {
      return { targetId: connection.targetId, endpointId: connection.endpointId }
    }
    return { sshAlias: connection.hostName ?? '', instanceKey: 'default' }
  }

  /**
   * Registration revision the caller observed.
   *
   * The Host publishes the authoritative revision on the service state it read from the remote
   * helper's `status`; a write action must echo that exact value or the helper answers
   * `REGISTRATION_STALE`. When the helper never reported one, the page sends a bounded
   * placeholder instead of inventing a value, and the remote rejects the action rather than
   * executing anything.
   */
  private registrationRevision(connection: RemoteSnapshot): string {
    const published = connection.service?.registrationRevision
      ?? (connection as { registrationRevision?: unknown }).registrationRevision
    return typeof published === 'string' && /^[A-Za-z0-9_-]{1,64}$/u.test(published) ? published : 'unobserved'
  }

  private selectedSession(): string | undefined { return this.ctx.uiSession.adapter.current.getSnapshot().key }

  private async openReady(): Promise<void> {
    const sessionId = this.selectedSession()
    if (sessionId === undefined) throw new Error('remote-workspace: NO_SESSION')
    const id = this.state.connection.connectionId
    if (id === undefined) throw new Error('remote-workspace: no active connection')
    const generation = this.state.connection.generation
    const previousPanel = this.ctx.layout.panelInfo.getSnapshot().activePanelId
    this.ctx.layout.selectPanel(null)
    try {
      // The global connection page hides the Sidebar. Yield to React before issuing an intent to its session store.
      await new Promise<void>(resolve => setTimeout(resolve, 0))
      if (this.selectedSession() !== sessionId) throw new Error('remote-workspace: SESSION_CHANGED')
      if (this.ctx.sidebarRight.mounted.getSnapshot() !== sessionId) throw new Error('remote-workspace: SIDEBAR_NOT_READY')
      const result = await this.ctx.remote.remoteWorkspace.createOpenTicket(id)
      if (!result.ok) throw result.error
      if (this.selectedSession() !== sessionId || this.ctx.sidebarRight.mounted.getSnapshot() !== sessionId) {
        throw new Error('remote-workspace: SESSION_CHANGED')
      }
      // The ticket belongs to one connection generation; a replaced connection must not open it.
      if (this.state.connection.connectionId !== id || this.state.connection.generation !== generation
        || this.state.connection.phase !== 'app-ready') {
        throw new Error('remote-workspace: CONNECTION_CHANGED')
      }
      this.ctx.sidebarRight.openTab('browser', { params: { url: result.value } })
    } catch (error) {
      if (this.selectedSession() === sessionId && this.ctx.layout.panelInfo.getSnapshot().activePanelId === null) {
        this.ctx.layout.selectPanel(previousPanel)
      }
      throw error
    }
  }

  observe(connection: RemoteSnapshot): void {
    // A ticket belongs to one connection generation; a replaced connection invalidates the link.
    const same = this.state.connection.connectionId === connection.connectionId
      && this.state.connection.generation === connection.generation
    this.publish({ ...this.state, connection,
      serviceOperation: connection.serviceOperation ?? this.state.serviceOperation,
      ...(same ? {} : { openRequest: undefined }) })
  }
}

/** Only the Remote base service is injected here; the namespace is mounted before UI activation. */
export const inject = ['remote']

/** @param ctx - Client module context. @returns contract disposer after the UI effects unwind. */
export async function apply(ctx: Context): Promise<() => Promise<void>> {
  const release = await ctx.remote.$mount(remoteWorkspaceContribution)
  if (!('dshDesktop' in globalThis)) return release
  ctx.inject(['remote.remoteWorkspace', 'slots', 'locale', 'layout', 'sidebarRight', 'uiSession'], (scope) => {
    scope.effect(() => scope.locale.register('remoteWorkspace', { en, zh }), 'remote-workspace: copy')
    const t = scope.locale.bind('remoteWorkspace')
    const view = new ViewController(scope)
    const stream = scope.remote.$stream<RemoteSnapshot>({
      name: 'remote workspace state', open: signal => scope.remote.remoteWorkspace.watch(signal),
      ended: () => new Error('remote workspace state stream ended'),
      carrierFailed: () =>{  view.observe({ ...view.getSnapshot().connection, phase: 'disconnected', reason: 'local Host connection lost' }) },
    })
    scope.effect(() => () => stream.dispose(), 'remote-workspace: state stream')
    void (async () => {
      for await (const frame of stream) { view.observe(frame.value); frame.accept() }
    })().catch((error: unknown) => { view.fail(error instanceof Error ? error.message : String(error)) })
    scope.slots.inject('main', () => scope.slots.register({
      name: 'main', key: PANEL, locale: 'remoteWorkspace', inject: () => view,
    }, ConnectionsPage))
    scope.slots.inject('sidebar.panellist', () => scope.slots.register({
      name: 'sidebar.panellist', id: PANEL, order: 15, label: () => t('panel'), locale: 'remoteWorkspace',
    }, ({ size }: { size: number }) => <span style={{ fontSize: size }}>⇄</span>))
    scope.slots.inject('shell.overlay', () => scope.slots.register({
      name: 'shell.overlay', id: 'remote-workspace.location', locale: 'remoteWorkspace', inject: () => view,
    }, RemoteIndicator))
  })
  return async () => { await release() }
}

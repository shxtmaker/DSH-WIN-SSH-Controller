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
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import { randomUUID } from '@deepseek-ai/dsh-util-crypto'
import type { RemoteSnapshot, RemoteTarget } from '@harness-remote/controller/types'
import { ConnectionsPage, RemoteIndicator, type RemoteWorkspaceFace, type ViewState } from './connections.tsx'
import { en, zh, type RemoteWorkspaceKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { 'remoteWorkspace': RemoteWorkspaceKey }
}

const PANEL = 'remote-workspace' as MainPanelId
const INITIAL: RemoteSnapshot = { phase: 'idle', generation: 0 }

/** Identify only missing automation methods on the local Host, without classifying remote HTTP failures. */
function missingAutomationRoute(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /^client api: remoteWorkspace\/(listAliases|quickConnect) failed: transport failure for \/api\/remoteWorkspace\/\1: HTTP 404$/u.test(message)
}

class ViewController implements RemoteWorkspaceFace {
  private state: ViewState = { targets: [], aliases: [], connection: INITIAL, busy: false }
  private readonly listeners = new Set<() => void>()

  constructor(private readonly ctx: Context) {}

  getSnapshot = (): ViewState => this.state
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  private publish(state: ViewState): void {
    this.state = state
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
    this.publish({ ...this.state, targets: targets.value, connection: connection.value })
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
    if (this.ctx.sidebarRight.mounted.getSnapshot() !== undefined) await this.openReady()
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
    if (this.ctx.sidebarRight.mounted.getSnapshot() !== undefined) await this.openReady()
  })

  disconnect = async (): Promise<void> => this.action(async () => {
    const id = this.state.connection.connectionId
    if (id === undefined) return
    const result = await this.ctx.remote.remoteWorkspace.disconnect(id)
    if (!result.ok) throw result.error
    this.publish({ ...this.state, connection: result.value })
  })

  open = async (): Promise<void> => this.action(() => this.openReady())

  private async openReady(): Promise<void> {
    if (this.ctx.sidebarRight.mounted.getSnapshot() === undefined) throw new Error('remote-workspace: NO_SESSION')
    const id = this.state.connection.connectionId
    if (id === undefined) throw new Error('remote-workspace: no active connection')
    const result = await this.ctx.remote.remoteWorkspace.createOpenTicket(id)
    if (!result.ok) throw result.error
    this.ctx.layout.selectPanel(null)
    this.ctx.sidebarRight.openTab('browser', { params: { url: result.value } })
  }

  observe(connection: RemoteSnapshot): void { this.publish({ ...this.state, connection }) }
}

/** Only the Remote base service is injected here; the namespace is mounted before UI activation. */
export const inject = ['remote']

/** @param ctx - Client module context. @returns contract disposer after the UI effects unwind. */
export async function apply(ctx: Context): Promise<() => Promise<void>> {
  const release = await ctx.remote.$mount(remoteWorkspaceContribution)
  if (!('dshDesktop' in globalThis)) return release
  ctx.inject(['remote.remoteWorkspace', 'slots', 'locale', 'layout', 'sidebarRight'], (scope) => {
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

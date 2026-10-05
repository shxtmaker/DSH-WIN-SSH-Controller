/** Desktop connection management page and persistent remote-location indicator. */
import { useEffect, useId, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { PropsLocale, PropsRuntime, InjectFace } from '@deepseek-ai/dsh-client-ui-slots'
import type { RemoteSnapshot, RemoteTarget } from '@harness-remote/controller/types'
import type { RemoteWorkspaceKey } from './locales.ts'

/** State shared by the management page and always-visible location indicator. */
export interface ViewState {
  readonly targets: readonly RemoteTarget[]
  readonly connection: RemoteSnapshot
  readonly busy: boolean
  readonly aliases: readonly string[]
  readonly aliasWarning?: boolean | undefined
  readonly hostRestartRequired?: boolean | undefined
  readonly error?: string | undefined
}

/** UI actions use only the local Host's authenticated Remote control surface. */
export interface RemoteWorkspaceFace {
  getSnapshot: () => ViewState
  subscribe: (listener: () => void) => () => void
  refresh: () => Promise<void>
  save: (target: RemoteTarget) => Promise<void>
  quickConnect: (sshAlias: string, instanceKey: string) => Promise<void>
  connect: (targetId: string, endpointId: string) => Promise<void>
  disconnect: () => Promise<void>
  open: () => Promise<void>
  fail: (message: string) => void
}

type PageProps = PropsRuntime<'main'> & PropsLocale<'remoteWorkspace'> & InjectFace<RemoteWorkspaceFace>
type IndicatorProps = PropsLocale<'remoteWorkspace'> & InjectFace<RemoteWorkspaceFace>

interface Form {
  readonly id: string
  readonly name: string
  readonly instanceKey: string
  readonly instanceId: string
  readonly profile: string
  readonly workspaceHint: string
  readonly remotePort: string
  readonly lan: string
  readonly tcp: string
  readonly stcp: string
}

const EMPTY: Form = { id: '', name: '', instanceKey: 'default', instanceId: '', profile: '',
  workspaceHint: '', remotePort: '3080', lan: '', tcp: '', stcp: '' }

const PHASES: Record<RemoteSnapshot['phase'], RemoteWorkspaceKey> = {
  idle: 'phaseIdle', 'ssh-auth': 'phaseSsh', discovering: 'phaseDiscovering', forwarding: 'phaseForwarding',
  authenticating: 'phaseAuthenticating', 'app-ready': 'phaseReady', disconnected: 'phaseDisconnected',
  reconnecting: 'phaseReconnecting', 'identity-mismatch': 'phaseMismatch', 'auth-required': 'phaseAuthRequired', error: 'phaseError',
}
const ERRORS: Record<string, RemoteWorkspaceKey> = {
  'remote-workspace: SSH_HOST_KEY': 'errorHostKey', 'remote-workspace: SSH_AUTH': 'errorAuth',
  'remote-workspace: SSH_ALIAS': 'errorAlias', 'remote-workspace: SSH_UNREACHABLE': 'errorUnreachable',
  'remote-workspace: SSH_HELPER': 'errorHelper', 'remote-workspace: NO_SESSION': 'noSession',
  'remote-workspace: SESSION_CHANGED': 'sessionChanged', 'remote-workspace: SIDEBAR_NOT_READY': 'sidebarNotReady',
  'remote-workspace: CONNECTION_CHANGED': 'connectionChanged',
}
const INPUT = { padding: 9, borderRadius: 6, border: '1px solid #888', background: 'transparent', color: 'inherit', minWidth: 0 }
const BUTTON = { padding: '8px 14px', borderRadius: 6, border: '1px solid #888', cursor: 'pointer' }

function Help({ label, text, help }: { label: string; text: string; help: string }): ReactNode {
  const [shown, setShown] = useState(false)
  const id = useId()
  return <span style={{ display: 'block' }}>
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>{label}
      <button type="button" aria-label={`${help}: ${label}`} aria-expanded={shown} aria-controls={id}
        onClick={(event) => { event.preventDefault(); setShown(!shown) }}
        onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); setShown(false) } }}
        style={{ width: 19, height: 19, padding: 0, lineHeight: '17px', borderRadius: '50%', border: '1px solid currentColor',
          color: 'inherit', background: 'transparent', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>?</button>
    </span>
    <span id={id} role="note" hidden={!shown}
      style={{ display: shown ? 'block' : undefined, fontSize: 13, fontWeight: 400, lineHeight: 1.6, marginTop: shown ? 8 : 0 }}>{text}</span>
  </span>
}

function fromTarget(target: RemoteTarget): Form {
  return { id: target.id, name: target.name, instanceKey: target.instanceKey,
    instanceId: target.instanceId, profile: target.profile, workspaceHint: target.workspaceHint,
    remotePort: String(target.remotePort), lan: target.endpoints.find(item => item.kind === 'lan')?.sshAlias ?? '',
    tcp: target.endpoints.find(item => item.kind === 'frp-tcp')?.sshAlias ?? '',
    stcp: target.endpoints.find(item => item.kind === 'stcp')?.sshAlias ?? '' }
}

function toTarget(form: Form): RemoteTarget {
  const endpoints: RemoteTarget['endpoints'][number][] = []
  if (form.lan.trim()) endpoints.push({ id: 'lan', kind: 'lan', sshAlias: form.lan.trim() })
  if (form.tcp.trim()) endpoints.push({ id: 'frp-tcp', kind: 'frp-tcp', sshAlias: form.tcp.trim() })
  if (form.stcp.trim()) endpoints.push({ id: 'stcp', kind: 'stcp', sshAlias: form.stcp.trim() })
  return { id: form.id.trim(), name: form.name.trim(), instanceKey: form.instanceKey.trim(),
    instanceId: form.instanceId.trim(), profile: form.profile.trim(), workspaceHint: form.workspaceHint.trim(),
    remotePort: Number(form.remotePort), endpoints }
}

interface ConnectionChoice {
  readonly value: string
  readonly label: string
  readonly searchText: string
}

/** Filter visible choices without changing the selected connection or initiating a connection. */
function SearchableConnectionList({ label, searchLabel, empty, noMatches, placeholder, allowEmpty = false,
  selectedLabel, choices, value, disabled, onSelect }: {
  readonly label: string
  readonly searchLabel: string
  readonly empty: string
  readonly noMatches: string
  readonly placeholder: string
  readonly allowEmpty?: boolean
  readonly selectedLabel?: string
  readonly choices: readonly ConnectionChoice[]
  readonly value: string
  readonly disabled: boolean
  readonly onSelect: (value: string) => void
}): ReactNode {
  const [query, setQuery] = useState('')
  const search = query.trim().toLowerCase()
  const visible = choices.filter(choice => choice.searchText.toLowerCase().includes(search))
  const chosen = choices.find(choice => choice.value === value)
  return <div style={{ display: 'grid', gap: 8, minWidth: 0 }}>
    <span>{label}</span>
    <input type="search" aria-label={searchLabel} placeholder={searchLabel} value={query} disabled={disabled}
      onChange={(event) => { setQuery(event.target.value) }}
      onKeyDown={(event) => { if (event.key === 'Enter') event.preventDefault() }} style={{ ...INPUT, width: '100%', boxSizing: 'border-box' }} />
    <select size={4} aria-label={label} value={visible.some(choice => choice.value === value) ? value : ''}
      disabled={disabled} onChange={(event) => { onSelect(event.target.value) }}
      onKeyDown={(event) => { if (event.key === 'Enter') event.preventDefault() }}
      style={{ ...INPUT, width: '100%', boxSizing: 'border-box' }}>
      <option value="" disabled={!allowEmpty}>{placeholder}</option>
      {visible.map(choice => <option value={choice.value} key={choice.value}>{choice.label}</option>)}
    </select>
    {selectedLabel && chosen && <p role="status" style={{ margin: 0, fontSize: 13, overflowWrap: 'anywhere' }}>{selectedLabel}: {chosen.label}</p>}
    {choices.length === 0 && <p role="status" style={{ margin: 0, fontSize: 13 }}>{empty}</p>}
    {choices.length > 0 && visible.length === 0 && <p role="status" style={{ margin: 0, fontSize: 13 }}>{noMatches}</p>}
  </div>
}

/** Render target configuration and one-connection actions in the main pane. */
export function ConnectionsPage({
  t, getSnapshot, subscribe, refresh, save, quickConnect, connect, disconnect, open,
}: PageProps): ReactNode {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const [selected, setSelected] = useState<string | undefined>(undefined)
  const [form, setForm] = useState<Form>(EMPTY)
  const [endpoint, setEndpoint] = useState('')
  const [alias, setAlias] = useState('')
  const [instanceKey, setInstanceKey] = useState('default')
  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => {
    if (state.aliases.length === 1) setAlias(current => current || state.aliases[0] || '')
  }, [state.aliases])
  useEffect(() => {
    const id = state.connection.targetId
    const target = state.targets.find(item => item.id === id)
    if (target !== undefined) {
      setSelected(target.id); setForm(fromTarget(target)); setEndpoint(state.connection.endpointId ?? target.endpoints[0]?.id ?? '')
    }
  }, [state.connection.targetId, state.targets])
  useEffect(() => {
    if (selected === undefined && state.targets.length > 0) {
      const target = state.targets[0]
      if (target === undefined) return
      setSelected(target.id); setForm(fromTarget(target)); setEndpoint(target.endpoints[0]?.id ?? '')
    }
  }, [selected, state.targets])
  const chosen = state.targets.find(item => item.id === selected)
  const endpoints = chosen?.endpoints ?? toTarget(form).endpoints
  const errorText = (message: string): string => {
    const key = ERRORS[message]
    return key === undefined ? message : t(key)
  }
  const field = (key: keyof Form, label: string, help: RemoteWorkspaceKey): ReactNode => (
    <label style={{ display: 'grid', gap: 6 }} key={key}><Help label={label} text={t(help)} help={t('help')} />
      <input value={form[key]} onChange={(event) => { setForm({ ...form, [key]: event.target.value }) }}
        disabled={state.busy || !!state.connection.connectionId} style={INPUT} />
    </label>
  )
  return <section style={{ padding: 24, maxWidth: 780, width: '100%', boxSizing: 'border-box', display: 'grid', alignContent: 'start', gap: 20, overflowY: 'auto' }}>
    <header><h1><Help label={t('title')} text={t('helpTitle')} help={t('help')} /></h1><p>{t('intro')}</p></header>
    <section style={{ display: 'grid', gap: 12, padding: 18, border: '1px solid #888', borderRadius: 8 }}>
      <h2 style={{ margin: 0, fontSize: 18 }}>{t('quick')}</h2>
      <form onSubmit={(event) => {
        event.preventDefault()
        if (!state.busy && !state.hostRestartRequired && !state.connection.connectionId && alias.trim()) {
          void quickConnect(alias, instanceKey)
        }
      }} style={{ display: 'grid', gap: 12 }}>
        <SearchableConnectionList label={t('aliasList')} searchLabel={t('searchAliases')} empty={t('noAliases')}
          noMatches={t('noConnectionMatches')} placeholder={t('chooseAlias')} value={alias}
          disabled={state.busy || !!state.connection.connectionId}
          choices={state.aliases.map(item => ({ value: item, label: item, searchText: item }))} onSelect={setAlias} />
        <label style={{ display: 'grid', gap: 6 }}><Help label={t('alias')} text={t('helpAlias')} help={t('help')} />
          <input value={alias} required placeholder={t('aliasPlaceholder')} autoComplete="off"
            disabled={state.busy || !!state.connection.connectionId} onChange={(event) => { setAlias(event.target.value) }} style={INPUT} />
        </label>
        <details><summary style={{ cursor: 'pointer' }}>{t('advanced')}</summary>
          <label style={{ display: 'grid', gap: 6, marginTop: 12 }}><Help label={t('instanceKey')} text={t('helpInstanceKey')} help={t('help')} />
            <input value={instanceKey} required disabled={state.busy || !!state.connection.connectionId}
              onChange={(event) => { setInstanceKey(event.target.value) }} style={INPUT} />
          </label>
        </details>
        <p style={{ margin: 0, fontSize: 13 }}>{t('quickHint')}</p>
        {state.hostRestartRequired && <p role="alert">{t('restartRequired')}</p>}
        {!state.hostRestartRequired && state.aliasWarning && <p role="status">{t('aliasWarning')}</p>}
        <button type="submit" disabled={state.busy || state.hostRestartRequired || !alias.trim() || !instanceKey.trim() || !!state.connection.connectionId}
          style={{ ...BUTTON, justifySelf: 'start' }}>{state.busy ? t('connecting') : t('quickConnect')}</button>
      </form>
    </section>
    <SearchableConnectionList label={t('saved')} searchLabel={t('searchTargets')} empty={t('noTargets')}
      selectedLabel={t('currentTarget')}
      noMatches={t('noConnectionMatches')} placeholder={t('newTarget')} allowEmpty value={selected ?? ''}
      disabled={state.busy || !!state.connection.connectionId}
      choices={state.targets.map(target => ({ value: target.id,
        label: `${target.name} · ${target.endpoints.map(item => item.sshAlias).join(', ')}`,
        searchText: [target.name, target.id, target.profile, target.workspaceHint, ...target.endpoints.map(item => item.sshAlias)].join(' '),
      }))} onSelect={(value) => {
        setSelected(value)
        const found = state.targets.find(item => item.id === value)
        setForm(found === undefined ? EMPTY : fromTarget(found))
        setEndpoint(found?.endpoints[0]?.id ?? '')
      }} />
    <details><summary style={{ cursor: 'pointer' }}>{t('manual')}</summary>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12, margin: '14px 0' }}>
        {field('id', t('targetId'), 'helpTargetId')}{field('name', t('name'), 'helpName')}{field('instanceKey', t('instanceKey'), 'helpInstanceKey')}
        {field('instanceId', t('instanceId'), 'helpIdentity')}{field('profile', t('profile'), 'helpProfile')}{field('workspaceHint', t('workspace'), 'helpWorkspace')}
        {field('remotePort', t('port'), 'helpPort')}{field('lan', t('lan'), 'helpRoutes')}{field('tcp', t('tcp'), 'helpRoutes')}{field('stcp', t('stcp'), 'helpRoutes')}
      </div>
      <button type="button" style={BUTTON} disabled={state.busy || !!state.connection.connectionId} onClick={() => { void save(toTarget(form)) }}>{t('save')}</button>
    </details>
    <section aria-live="polite" style={{ padding: 16, border: '1px solid #888', borderRadius: 8 }}>
      <h2 style={{ fontSize: 18 }}>{t('status')}: {t(PHASES[state.connection.phase])}</h2>
      <p>{state.connection.hostName ?? t('inactive')} · {state.connection.profile ?? '—'} · {state.connection.workspaceHint ?? '—'}</p>
      {state.error && <p role="alert">{t('error')}: {errorText(state.error)}</p>}
      {state.connection.reason && <p>{errorText(state.connection.reason)}</p>}
      <label><Help label={t('endpoint')} text={t('helpRoutes')} help={t('help')} />
        <select value={endpoint} disabled={state.busy || !!state.connection.connectionId} style={INPUT}
          onChange={(event) => { setEndpoint(event.target.value) }}>
          <option value="">—</option>
          {endpoints.map(item => <option value={item.id} key={item.id}>{item.kind}: {item.sshAlias}</option>)}
        </select>
      </label>{' '}
      <button type="button" style={BUTTON} disabled={state.busy || !selected || !endpoint || !!state.connection.connectionId}
        onClick={() => { if (selected) void connect(selected, endpoint) }}>{t('connect')}</button>{' '}
      <button type="button" style={BUTTON} disabled={state.busy || !state.connection.connectionId}
        onClick={() => { void disconnect() }}>{t('disconnect')}</button>{' '}
      <button type="button" style={BUTTON} disabled={state.busy || state.connection.phase !== 'app-ready'}
        onClick={() => { void open() }}>{t('open')}</button>{' '}
      <button type="button" style={BUTTON} disabled={state.busy} onClick={() => { void refresh() }}>{t('refresh')}</button>
      {state.connection.phase === 'app-ready' && <p>{t('readyHint')}</p>}
    </section>
  </section>
}

/** Keep the actual execution host and remote workspace visible over the local shell. */
export function RemoteIndicator({ t, getSnapshot, subscribe }: IndicatorProps): ReactNode {
  const { connection } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  if (connection.phase === 'idle') return null
  return <div aria-live="polite" style={{ position: 'fixed', top: 8, right: 16, zIndex: 10000,
    padding: '5px 9px', borderRadius: 6, background: '#163447', color: 'white', pointerEvents: 'none',
    maxWidth: '50vw', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>
    {t('location')}: {connection.hostName} / {connection.profile} / {connection.workspaceHint} ({t(PHASES[connection.phase])})
  </div>
}

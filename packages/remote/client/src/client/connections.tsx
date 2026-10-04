/** Desktop connection management page and persistent remote-location indicator. */
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { PropsLocale, PropsRuntime, InjectFace } from '@deepseek-ai/dsh-client-ui-slots'
import type { RemoteSnapshot, RemoteTarget } from '@harness-remote/controller/types'

/** State shared by the management page and always-visible location indicator. */
export interface ViewState {
  readonly targets: readonly RemoteTarget[]
  readonly connection: RemoteSnapshot
  readonly busy: boolean
  readonly error?: string | undefined
}

/** UI actions use only the local Host's authenticated Remote control surface. */
export interface RemoteWorkspaceFace {
  getSnapshot: () => ViewState
  subscribe: (listener: () => void) => () => void
  refresh: () => Promise<void>
  save: (target: RemoteTarget) => Promise<void>
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

/** Render target configuration and one-connection actions in the main pane. */
export function ConnectionsPage({ t, getSnapshot, subscribe, refresh, save, connect, disconnect, open, fail }: PageProps): ReactNode {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const [selected, setSelected] = useState('')
  const [form, setForm] = useState<Form>(EMPTY)
  const [endpoint, setEndpoint] = useState('')
  useEffect(() => { void refresh() }, [refresh])
  const chosen = state.targets.find(item => item.id === selected)
  const endpoints = chosen?.endpoints ?? toTarget(form).endpoints
  const field = (key: keyof Form, label: string): ReactNode => (
    <label style={{ display: 'grid', gap: 4 }} key={key}>{label}
      <input value={form[key]} onChange={(event) => { setForm({ ...form, [key]: event.target.value }) }}
        style={{ padding: 7, borderRadius: 6, border: '1px solid #888' }} />
    </label>
  )
  return <section style={{ padding: 24, maxWidth: 780, display: 'grid', gap: 20, overflowY: 'auto' }}>
    <header><h1>{t('title')}</h1><p>{t('intro')}</p></header>
    <label>{t('saved')}{' '}
      <select value={selected} onChange={(event) => {
        const value = event.target.value
        setSelected(value)
        const found = state.targets.find(item => item.id === value)
        setForm(found === undefined ? EMPTY : fromTarget(found))
        setEndpoint(found?.endpoints[0]?.id ?? '')
      }}>
        <option value="">{t('newTarget')}</option>
        {state.targets.map(target => <option value={target.id} key={target.id}>{target.name}</option>)}
      </select>
    </label>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
      {field('id', t('targetId'))}{field('name', t('name'))}{field('instanceKey', t('instanceKey'))}
      {field('instanceId', t('instanceId'))}{field('profile', t('profile'))}{field('workspaceHint', t('workspace'))}
      {field('remotePort', t('port'))}{field('lan', t('lan'))}{field('tcp', t('tcp'))}{field('stcp', t('stcp'))}
    </div>
    <div><button type="button" disabled={state.busy} onClick={() => { void save(toTarget(form)) }}>{t('save')}</button>{' '}
      <button type="button" disabled={state.busy} onClick={() => { void refresh() }}>{t('refresh')}</button></div>
    <section aria-live="polite" style={{ padding: 16, border: '1px solid #888', borderRadius: 8 }}>
      <h2>{t('status')}: {state.connection.phase}</h2>
      <p>{state.connection.hostName ?? t('inactive')} · {state.connection.profile ?? '—'} · {state.connection.workspaceHint ?? '—'}</p>
      {state.connection.reason && <p>{state.connection.reason}</p>}
      <label>{t('endpoint')}{' '}
        <select value={endpoint} onChange={(event) => { setEndpoint(event.target.value) }}>
          <option value="">—</option>
          {endpoints.map(item => <option value={item.id} key={item.id}>{item.kind}: {item.sshAlias}</option>)}
        </select>
      </label>{' '}
      <button type="button" disabled={state.busy || !selected || !endpoint || state.connection.phase === 'app-ready'}
        onClick={() => { void connect(selected, endpoint) }}>{t('connect')}</button>{' '}
      <button type="button" disabled={state.busy || !state.connection.connectionId}
        onClick={() => { void disconnect() }}>{t('disconnect')}</button>{' '}
      <button type="button" disabled={state.busy || state.connection.phase !== 'app-ready'}
        onClick={() => { void open().catch(() =>{  fail(t('noSession')) }) }}>{t('open')}</button>
    </section>
    {state.error && <p role="alert">{t('error')}: {state.error}</p>}
  </section>
}

/** Keep the actual execution host and remote workspace visible over the local shell. */
export function RemoteIndicator({ t, getSnapshot, subscribe }: IndicatorProps): ReactNode {
  const { connection } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  if (connection.phase === 'idle') return null
  return <div aria-live="polite" style={{ position: 'fixed', top: 8, right: 16, zIndex: 10000,
    padding: '5px 9px', borderRadius: 6, background: '#163447', color: 'white', pointerEvents: 'none',
    maxWidth: '50vw', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>
    {t('location')}: {connection.hostName} / {connection.profile} / {connection.workspaceHint} ({connection.phase})
  </div>
}

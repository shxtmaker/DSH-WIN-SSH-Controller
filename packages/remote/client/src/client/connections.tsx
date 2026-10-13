/** Desktop connection management page and persistent remote-location indicator. */
import { useEffect, useId, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { PropsLocale, PropsRuntime, InjectFace } from '@deepseek-ai/dsh-client-ui-slots'
import type { CheckName, CheckState, RemoteCapabilities, RemoteCheck, RemoteErrorCode, RemoteServiceState,
  RemoteSnapshot, RemoteTarget, ServiceOperationPhase, ServiceOperationState } from '@harness-remote/controller/types'
import type { RemoteWorkspaceKey } from './locales.ts'
import styles from './connections.module.css'

/** One restricted service action the remote helper accepts. */
export type ServiceAction = 'start' | 'stop' | 'restart'

/** Result of the most recent user-initiated open; an API success never proves the page loaded. */
export interface OpenRequest {
  /** Fixed outcome of the attempt; a failed ticket creation never renders as an opened page. */
  readonly status: 'requested' | 'failed'
  /** Short-lived ticket URL, offered as an explicit link as well as through `window.open`. */
  readonly url?: string | undefined
  /** When the ticket was issued, so the page can present it as short-lived. */
  readonly issuedAt: number
}

/** State shared by the management page and always-visible location indicator. */
export interface ViewState {
  readonly targets: readonly RemoteTarget[]
  readonly connection: RemoteSnapshot
  readonly busy: boolean
  readonly aliases: readonly string[]
  readonly aliasWarning?: boolean | undefined
  readonly hostRestartRequired?: boolean | undefined
  readonly error?: string | undefined
  /** Whether a local session is selected; without one the system browser is the primary entry. */
  readonly localSession: boolean
  /** Most recent service operation; the Host snapshot is authoritative when it carries one. */
  readonly serviceOperation?: ServiceOperationState | undefined
  /** Result of the most recent user-initiated open. */
  readonly openRequest?: OpenRequest | undefined
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
  /** Open the ticket URL in the system browser; never requires a local session. */
  openInSystemBrowser: () => Promise<void>
  /** Request a fresh ticket after the previous one expired. */
  regenerateTicket: () => Promise<void>
  /** Renew the remote authentication explicitly; never restarts the remote service. */
  renewAuthentication: () => Promise<void>
  /** Submit exactly one restricted service action. */
  serviceAction: (action: ServiceAction) => Promise<void>
  /** Read a pending operation's result; never submits an action. */
  readServiceOperation: () => Promise<void>
  fail: (message: string) => void
}

type PageProps = PropsRuntime<'main'> & PropsLocale<'remoteWorkspace'> & InjectFace<RemoteWorkspaceFace>
type IndicatorProps = PropsLocale<'remoteWorkspace'> & InjectFace<RemoteWorkspaceFace>
type Translate = (key: RemoteWorkspaceKey) => string

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

/** How long a one-time ticket stays valid; after that the page asks for a new one. */
const TICKET_LIFETIME_MS = 120_000

const PHASES: Record<RemoteSnapshot['phase'], RemoteWorkspaceKey> = {
  idle: 'phaseIdle', 'ssh-auth': 'phaseSsh', checking: 'phaseChecking', discovering: 'phaseDiscovering',
  forwarding: 'phaseForwarding', authenticating: 'phaseAuthenticating', verifying: 'phaseVerifying',
  'app-ready': 'phaseReady', disconnected: 'phaseDisconnected', reconnecting: 'phaseReconnecting',
  'identity-mismatch': 'phaseMismatch', 'auth-required': 'phaseAuthRequired',
  'service-stopped': 'phaseServiceStopped', error: 'phaseError',
}
const ERRORS: Record<string, RemoteWorkspaceKey> = {
  'remote-workspace: SSH_HOST_KEY': 'errorHostKey', 'remote-workspace: SSH_AUTH': 'errorAuth',
  'remote-workspace: SSH_ALIAS': 'errorAlias', 'remote-workspace: SSH_UNREACHABLE': 'errorUnreachable',
  'remote-workspace: SSH_HELPER': 'errorHelper', 'remote-workspace: NO_SESSION': 'noSession',
  'remote-workspace: SESSION_CHANGED': 'sessionChanged', 'remote-workspace: SIDEBAR_NOT_READY': 'sidebarNotReady',
  'remote-workspace: CONNECTION_CHANGED': 'connectionChanged',
}

/** Every named check in report order, so the detail list is stable across snapshots. */
const CHECKS: readonly { readonly name: CheckName; readonly label: RemoteWorkspaceKey }[] = [
  { name: 'ssh', label: 'checkSsh' }, { name: 'helper', label: 'checkHelper' },
  { name: 'service', label: 'checkService' }, { name: 'descriptor', label: 'checkDescriptor' },
  { name: 'listener', label: 'checkListener' }, { name: 'identity', label: 'checkIdentity' },
  { name: 'authentication', label: 'checkAuthentication' }, { name: 'events', label: 'checkEvents' },
  { name: 'application', label: 'checkApplication' },
]

const CHECK_LABEL: Record<CheckState, RemoteWorkspaceKey> = {
  unknown: 'stateUnknown', checking: 'stateChecking', ok: 'stateOk', failed: 'stateFailed',
  unsupported: 'stateUnsupported',
}
/** Distinct treatment per state; `unknown` is neutral and never shares the healthy class. */
const CHECK_TONE: Record<CheckState, string | undefined> = {
  unknown: styles.stateUnknown, checking: styles.stateChecking, ok: styles.stateOk,
  failed: styles.stateFailed, unsupported: styles.stateUnsupported,
}

const CAPABILITY_MODE: Record<RemoteCapabilities['mode'], RemoteWorkspaceKey> = {
  'systemd-user': 'modeSystemd', unsupported: 'modeUnsupported', unregistered: 'modeUnregistered',
}
const SERVICE_STATE: Record<RemoteServiceState['state'], RemoteWorkspaceKey> = {
  unknown: 'serviceUnknown', inactive: 'serviceInactive', activating: 'serviceActivating',
  active: 'serviceActive', deactivating: 'serviceDeactivating', failed: 'serviceFailed',
}
const OPERATION_LABEL: Record<ServiceOperationPhase, RemoteWorkspaceKey> = {
  idle: 'opStateIdle', submitting: 'opStateSubmitting', waiting: 'opStateWaiting',
  completed: 'opStateCompleted', failed: 'opStateFailed', 'outcome-unknown': 'opStateUnknown',
}
const OPERATION_TEXT: Record<ServiceOperationPhase, RemoteWorkspaceKey> = {
  idle: 'operationIdle', submitting: 'operationSubmitting', waiting: 'operationWaiting',
  completed: 'operationCompleted', failed: 'operationFailed', 'outcome-unknown': 'operationOutcomeUnknown',
}
/** Only `completed` is success; `failed` and `outcome-unknown` keep their own treatment. */
const OPERATION_TONE: Record<ServiceOperationPhase, string | undefined> = {
  idle: styles.opProgress, submitting: styles.opProgress, waiting: styles.opProgress,
  completed: styles.opCompleted, failed: styles.opFailed, 'outcome-unknown': styles.opUnknown,
}

/** Fixed code to explanation. Display only: the page never branches on localized text. */
const CODE_TEXT: Record<RemoteErrorCode, RemoteWorkspaceKey> = {
  SSH_UNAVAILABLE: 'codeSshUnavailable', SSH_AUTH_FAILED: 'codeSshAuthFailed',
  HOST_KEY_REJECTED: 'codeHostKeyRejected', SSH_TIMEOUT: 'codeSshTimeout',
  HELPER_NOT_FOUND: 'codeHelperNotFound', HELPER_UNSAFE: 'codeHelperUnsafe',
  HELPER_BAD_CONFIG: 'codeHelperBadConfig', CONTROL_UNSUPPORTED: 'codeControlUnsupported',
  SERVICE_UNREGISTERED: 'codeServiceUnregistered', SERVICE_STOPPED: 'codeServiceStopped',
  SERVICE_FAILED: 'codeServiceFailed', USER_MANAGER_UNAVAILABLE: 'codeUserManagerUnavailable',
  DESCRIPTOR_MISSING: 'codeDescriptorMissing', DESCRIPTOR_INVALID: 'codeDescriptorInvalid',
  DESCRIPTOR_STALE: 'codeDescriptorStale', UNSUPPORTED_WEB_TRANSPORT: 'codeUnsupportedWebTransport',
  LOCAL_AUTH_REQUIRED: 'codeLocalAuthRequired', UPSTREAM_AUTH_REQUIRED: 'codeUpstreamAuthRequired',
  IDENTITY_MISMATCH: 'codeIdentityMismatch', APPLICATION_NOT_READY: 'codeApplicationNotReady',
  UPSTREAM_UNREACHABLE: 'codeUpstreamUnreachable', REGISTRATION_STALE: 'codeRegistrationStale',
  OPERATION_CONFLICT: 'codeOperationConflict', OPERATION_EXPIRED: 'codeOperationExpired',
  OUTCOME_UNKNOWN: 'codeOutcomeUnknown', BAD_INPUT: 'codeBadInput', CONFIG_REQUIRED: 'codeConfigRequired',
  UNSAFE_PATH: 'codeUnsafePath', UNSAFE_FILE: 'codeUnsafeFile', LINUX_REQUIRED: 'codeLinuxRequired',
  CONTROL_FAILED: 'codeControlFailed', FORBIDDEN: 'codeForbidden', NOT_FOUND: 'codeNotFound',
  PROXY_PAUSED: 'codeProxyPaused',
}

/** Read one named check; a snapshot from an older Host may carry no diagnostics at all. */
function checkOf(connection: RemoteSnapshot, name: CheckName): RemoteCheck | undefined {
  return (connection.diagnostics ?? []).find(check => check.name === name)
}

function Help({ label, text, help }: { label: string; text: string; help: string }): ReactNode {
  const [shown, setShown] = useState(false)
  const id = useId()
  return <span style={{ display: 'block' }}>
    <span className={styles.helpLabel}>{label}
      <button type="button" aria-label={`${help}: ${label}`} aria-expanded={shown} aria-controls={id}
        onClick={(event) => { event.preventDefault(); setShown(!shown) }}
        onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); setShown(false) } }}
        className={styles.helpButton}>?</button>
    </span>
    <span id={id} role="note" hidden={!shown} className={styles.helpText}>{text}</span>
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
  return <div className={styles.choices}>
    <span>{label}</span>
    <input type="search" aria-label={searchLabel} placeholder={searchLabel} value={query} disabled={disabled}
      onChange={(event) => { setQuery(event.target.value) }}
      onKeyDown={(event) => { if (event.key === 'Enter') event.preventDefault() }} />
    <select size={4} aria-label={label} value={visible.some(choice => choice.value === value) ? value : ''}
      disabled={disabled} onChange={(event) => { onSelect(event.target.value) }}
      onKeyDown={(event) => { if (event.key === 'Enter') event.preventDefault() }}>
      <option value="" disabled={!allowEmpty}>{placeholder}</option>
      {visible.map(choice => <option value={choice.value} key={choice.value}>{choice.label}</option>)}
    </select>
    {selectedLabel && chosen && <p role="status" className={styles.hint}>{selectedLabel}: {chosen.label}</p>}
    {choices.length === 0 && <p role="status" className={styles.hint}>{empty}</p>}
    {choices.length > 0 && visible.length === 0 && <p role="status" className={styles.hint}>{noMatches}</p>}
  </div>
}

/** One label and value pair inside the capability and service facts. */
function Fact({ label, value }: { label: string; value: string }): ReactNode {
  return <div className={styles.fact}><dt>{label}</dt><dd>{value}</dd></div>
}

/** Expandable per-layer check detail; `unknown` keeps its own neutral treatment. */
function Diagnostics({ t, connection }: { t: Translate; connection: RemoteSnapshot }): ReactNode {
  const checks = connection.diagnostics ?? []
  return <details className={styles.details} data-diagnostics={checks.length}>
    <summary>{t('diagnostics')}</summary>
    <p className={styles.hint}>{t('diagnosticsHint')}</p>
    <ul className={styles.checks}>
      {CHECKS.map(({ name, label }) => {
        const check = checkOf(connection, name)
        const state: CheckState = check?.state ?? 'unknown'
        const code = check?.code
        return <li className={styles.check} key={name} data-check={name} data-state={state}>
          <span className={styles.checkName}>{t(label)}</span>
          <span className={`${styles.checkState} ${CHECK_TONE[state] ?? ''}`} data-state={state}>{t(CHECK_LABEL[state])}</span>
          {code !== undefined && <code className={styles.checkCode}>{code}</code>}
          {code !== undefined && <span className={styles.checkText}>{t(CODE_TEXT[code])}</span>}
          {state === 'unknown' && <span className={styles.checkText}>{t('stateUnknownNote')}</span>}
          {state === 'unsupported' && <span className={styles.checkText}>{t('stateUnsupportedNote')}</span>}
        </li>
      })}
    </ul>
  </details>
}

/** Capability, service facts, restricted action buttons and the latest operation receipt. */
function ServiceSection({ t, connection, operation, busy, pending, setPending, submit }: {
  readonly t: Translate
  readonly connection: RemoteSnapshot
  readonly operation: ServiceOperationState | undefined
  readonly busy: boolean
  readonly pending: ServiceAction | undefined
  readonly setPending: (action: ServiceAction | undefined) => void
  readonly submit: (action: ServiceAction) => void
}): ReactNode {
  const helper = checkOf(connection, 'helper')
  const capabilities = connection.capabilities
  const service = connection.service
  const actions = capabilities?.actions ?? []
  // An old helper is a documented limitation: manual instructions replace the buttons entirely.
  const manual = helper?.state === 'unsupported' && helper.code === 'CONTROL_UNSUPPORTED'
  const managed = capabilities?.mode === 'systemd-user' && service?.registered === true
  const state = service?.state ?? 'unknown'
  const canStart = managed && actions.includes('start') && state !== 'active' && state !== 'activating'
    && state !== 'deactivating'
  const canStop = managed && actions.includes('stop') && (state === 'active' || state === 'activating')
  const canRestart = managed && actions.includes('restart') && state === 'active'
  const target = connection.hostName ?? connection.targetId ?? t('inactive')
  return <div className={styles.service}>
    <div className={styles.block}>
      <h3 className={styles.blockTitle}>{t('capability')}</h3>
      {capabilities === undefined
        ? <p className={styles.hint}>{t('stateUnknownNote')}</p>
        : <dl className={styles.facts}>
          <Fact label={t('helperVersion')} value={capabilities.helperVersion} />
          <Fact label={t('controlVersion')} value={String(capabilities.controlVersion)} />
          <Fact label={t('controlMode')} value={t(CAPABILITY_MODE[capabilities.mode])} />
          <Fact label={t('capabilityActions')}
            value={capabilities.actions.length === 0 ? t('noActions') : capabilities.actions.join(', ')} />
        </dl>}
    </div>
    <div className={styles.block}>
      <h3 className={styles.blockTitle}>{t('service')}</h3>
      {service === undefined
        ? <p className={styles.hint}>{t('stateUnknownNote')}</p>
        : <dl className={styles.facts}>
          <Fact label={t('serviceUnit')} value={service.unit} />
          <Fact label={t('serviceStateLabel')} value={t(SERVICE_STATE[service.state])} />
          <Fact label={t('serviceRegistered')} value={t(service.registered ? 'registered' : 'unregistered')} />
        </dl>}
    </div>
    {manual
      ? <div className={styles.manual} data-manual-start="true">
        <p role="status" className={styles.blockTitle}>{t('manualStartTitle')}</p>
        <p className={styles.hint}>{t('manualStartText')}</p>
      </div>
      : <div className={styles.actions} data-service-actions="true">
        {canStart && <button type="button" disabled={busy} data-action="start"
          onClick={() => { submit('start') }}>{t('serviceStart')}</button>}
        {canStop && <button type="button" disabled={busy} data-action="stop"
          onClick={() => { setPending('stop') }}>{t('serviceStop')}</button>}
        {canRestart && <button type="button" disabled={busy} data-action="restart"
          onClick={() => { setPending('restart') }}>{t('serviceRestart')}</button>}
        {!canStart && !canStop && !canRestart && <p className={styles.hint}>{t('stateUnknownNote')}</p>}
      </div>}
    <p className={styles.hint}>{t('serviceActionHint')}</p>
    {pending !== undefined && <div className={styles.confirm} role="alertdialog" data-confirm={pending}
      aria-label={t(pending === 'stop' ? 'confirmStopTitle' : 'confirmRestartTitle')}>
      <p className={styles.blockTitle}>{t(pending === 'stop' ? 'confirmStopTitle' : 'confirmRestartTitle')}</p>
      <p className={styles.hint}>{t('confirmTarget')}: {target} · {t('serviceUnit')}: {service?.unit ?? '—'}</p>
      <p className={styles.notice}>{t(pending === 'stop' ? 'confirmImpact' : 'confirmRestartImpact')}</p>
      <div className={styles.actions}>
        <button type="button" className={styles.primary} disabled={busy} data-confirm-accept={pending}
          onClick={() => { setPending(undefined); submit(pending) }}>{t('confirmAccept')}</button>
        <button type="button" disabled={busy} onClick={() => { setPending(undefined) }}>{t('confirmCancel')}</button>
      </div>
    </div>}
    {operation !== undefined && operation.phase !== 'idle' && <div
      className={`${styles.operation} ${OPERATION_TONE[operation.phase] ?? ''}`} data-phase={operation.phase}
      role={operation.phase === 'failed' || operation.phase === 'outcome-unknown' ? 'alert' : 'status'}>
      <p className={styles.blockTitle}>{t('operation')}: {t(OPERATION_LABEL[operation.phase])}</p>
      <p className={styles.hint}>{t(OPERATION_TEXT[operation.phase])}</p>
      <p className={styles.hint}>{t('operationAction')}: {operation.action ?? '—'} · {t('operationId')}: {operation.operationId ?? '—'}</p>
      {operation.code !== undefined && <p className={styles.hint}>{t('codeLabel')}: {operation.code} · {t(CODE_TEXT[operation.code])}</p>}
    </div>}
  </div>
}

/** Render target configuration and one-connection actions in the main pane. */
export function ConnectionsPage({
  t, getSnapshot, subscribe, refresh, save, quickConnect, connect, disconnect, open, openInSystemBrowser,
  regenerateTicket, renewAuthentication, serviceAction, readServiceOperation,
}: PageProps): ReactNode {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const [selected, setSelected] = useState<string | undefined>(undefined)
  const [form, setForm] = useState<Form>(EMPTY)
  const [endpoint, setEndpoint] = useState('')
  const [alias, setAlias] = useState('')
  const [instanceKey, setInstanceKey] = useState('default')
  const [pending, setPending] = useState<ServiceAction | undefined>(undefined)
  useEffect(() => { void refresh() }, [refresh])
  // Reading a pending receipt is safe on every mount and never resubmits the action.
  useEffect(() => { void readServiceOperation() }, [readServiceOperation])
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
  const connection = state.connection
  const authentication = checkOf(connection, 'authentication')
  const authenticationCode = connection.accessWarning
    ?? (authentication?.state === 'failed' ? authentication.code : undefined)
  const errorText = (message: string): string => {
    const key = ERRORS[message]
    return key === undefined ? message : t(key)
  }
  const field = (key: keyof Form, label: string, help: RemoteWorkspaceKey): ReactNode => (
    <label className={styles.field} key={key}><Help label={label} text={t(help)} help={t('help')} />
      <input value={form[key]} onChange={(event) => { setForm({ ...form, [key]: event.target.value }) }}
        disabled={state.busy || !!connection.connectionId} />
    </label>
  )
  const operation = state.serviceOperation ?? connection.serviceOperation
  const ticket = state.openRequest
  const ticketExpired = ticket?.url !== undefined && Date.now() - ticket.issuedAt > TICKET_LIFETIME_MS
  return <section className={styles.page}><div className={styles.content}>
    <header><h1><Help label={t('title')} text={t('helpTitle')} help={t('help')} /></h1><p className={styles.intro}>{t('intro')}</p></header>
    <section className={styles.card}>
      <h2>{t('quick')}</h2>
      <form onSubmit={(event) => {
        event.preventDefault()
        if (!state.busy && !state.hostRestartRequired && !connection.connectionId && alias.trim()) {
          void quickConnect(alias, instanceKey)
        }
      }} className={styles.form}>
        <SearchableConnectionList label={t('aliasList')} searchLabel={t('searchAliases')} empty={t('noAliases')}
          noMatches={t('noConnectionMatches')} placeholder={t('chooseAlias')} value={alias}
          disabled={state.busy || !!connection.connectionId}
          choices={state.aliases.map(item => ({ value: item, label: item, searchText: item }))} onSelect={setAlias} />
        <label className={styles.field}><Help label={t('alias')} text={t('helpAlias')} help={t('help')} />
          <input value={alias} required placeholder={t('aliasPlaceholder')} autoComplete="off"
            disabled={state.busy || !!connection.connectionId} onChange={(event) => { setAlias(event.target.value) }} />
        </label>
        <details><summary>{t('advanced')}</summary>
          <label className={styles.advancedField}><Help label={t('instanceKey')} text={t('helpInstanceKey')} help={t('help')} />
            <input value={instanceKey} required disabled={state.busy || !!connection.connectionId}
              onChange={(event) => { setInstanceKey(event.target.value) }} />
          </label>
        </details>
        <p className={styles.hint}>{t('quickHint')}</p>
        {state.hostRestartRequired && <p role="alert" className={styles.notice}>{t('restartRequired')}</p>}
        {!state.hostRestartRequired && state.aliasWarning && <p role="status" className={styles.hint}>{t('aliasWarning')}</p>}
        <button type="submit" disabled={state.busy || state.hostRestartRequired || !alias.trim() || !instanceKey.trim() || !!connection.connectionId}
          className={styles.primary}>{state.busy ? t('connecting') : t('quickConnect')}</button>
      </form>
    </section>
    <SearchableConnectionList label={t('saved')} searchLabel={t('searchTargets')} empty={t('noTargets')}
      selectedLabel={t('currentTarget')}
      noMatches={t('noConnectionMatches')} placeholder={t('newTarget')} allowEmpty value={selected ?? ''}
      disabled={state.busy || !!connection.connectionId}
      choices={state.targets.map(target => ({ value: target.id,
        label: `${target.name} · ${target.endpoints.map(item => item.sshAlias).join(', ')}`,
        searchText: [target.name, target.id, target.profile, target.workspaceHint, ...target.endpoints.map(item => item.sshAlias)].join(' '),
      }))} onSelect={(value) => {
        setSelected(value)
        const found = state.targets.find(item => item.id === value)
        setForm(found === undefined ? EMPTY : fromTarget(found))
        setEndpoint(found?.endpoints[0]?.id ?? '')
      }} />
    <details><summary>{t('manual')}</summary>
      <div className={styles.fields}>
        {field('id', t('targetId'), 'helpTargetId')}{field('name', t('name'), 'helpName')}{field('instanceKey', t('instanceKey'), 'helpInstanceKey')}
        {field('instanceId', t('instanceId'), 'helpIdentity')}{field('profile', t('profile'), 'helpProfile')}{field('workspaceHint', t('workspace'), 'helpWorkspace')}
        {field('remotePort', t('port'), 'helpPort')}{field('lan', t('lan'), 'helpRoutes')}{field('tcp', t('tcp'), 'helpRoutes')}{field('stcp', t('stcp'), 'helpRoutes')}
      </div>
      <button type="button" disabled={state.busy || !!connection.connectionId} onClick={() => { void save(toTarget(form)) }}>{t('save')}</button>
    </details>
    <section aria-live="polite" className={styles.card}>
      <h2>{t('status')}: {t(PHASES[connection.phase])}</h2>
      <p className={styles.hint}>{connection.hostName ?? t('inactive')} · {connection.profile ?? '—'} · {connection.workspaceHint ?? '—'}</p>
      {state.error && <p role="alert" className={styles.notice}>{t('error')}: {errorText(state.error)}</p>}
      {connection.reason && <p className={styles.hint}>{errorText(connection.reason)}</p>}
      <div className={styles.actions}>
        <label className={styles.field}><Help label={t('endpoint')} text={t('helpRoutes')} help={t('help')} />
          <select value={endpoint} disabled={state.busy || !!connection.connectionId}
            onChange={(event) => { setEndpoint(event.target.value) }}>
            <option value="">—</option>
            {endpoints.map(item => <option value={item.id} key={item.id}>{item.kind}: {item.sshAlias}</option>)}
          </select>
        </label>
        <button type="button" className={styles.primary} disabled={state.busy || !selected || !endpoint || !!connection.connectionId}
          onClick={() => { if (selected) void connect(selected, endpoint) }}>{t('connect')}</button>
        <button type="button" disabled={state.busy || !connection.connectionId}
          onClick={() => { void disconnect() }}>{t('disconnect')}</button>
        <button type="button" disabled={state.busy || connection.phase !== 'app-ready'}
          onClick={() => { void open() }}>{t('open')}</button>
        <button type="button" className={state.localSession ? undefined : styles.primary} data-entry="system"
          disabled={state.busy || connection.connectionId === undefined}
          onClick={() => { void openInSystemBrowser() }}>{t('openSystem')}</button>
        <button type="button" disabled={state.busy} onClick={() => { void refresh() }}>{t('refresh')}</button>
      </div>
      {connection.phase === 'app-ready' && <p className={styles.hint}>{t('readyHint')}</p>}
      {!state.localSession && <p className={styles.hint}>{t('openSystemPrimary')}</p>}
      <p className={styles.hint}>{t('openSystemHint')}</p>
      {ticket !== undefined && <div className={styles.ticket} data-open-status={ticket.status}>
        <p role="status" className={styles.hint}>{t('openRequested')} · {t('openRequestedHint')}</p>
        {ticket.url !== undefined && <p className={styles.hint}>{t('openTicketLink')}
          <a className={styles.ticketLink} href={ticket.url} target="_blank" rel="noopener noreferrer">{ticket.url}</a>
        </p>}
        <p className={styles.hint}>{ticketExpired ? t('openTicketExpired') : t('openTicketNote')}</p>
        <button type="button" disabled={state.busy} onClick={() => { void regenerateTicket() }}>{t('openRegenerate')}</button>
      </div>}
      {authenticationCode === 'UPSTREAM_AUTH_REQUIRED' && <div className={styles.block} data-auth="upstream">
        <p className={styles.blockTitle}>{t('authTitle')}</p>
        <p className={styles.hint}>{t('authText')}</p>
        <button type="button" disabled={state.busy || connection.connectionId === undefined}
          onClick={() => { void renewAuthentication() }}>{t('authRefresh')}</button>
      </div>}
      {authenticationCode === 'LOCAL_AUTH_REQUIRED' && <div className={styles.block} data-auth="local">
        <p className={styles.blockTitle}>{t('authLocalTitle')}</p>
        <p className={styles.hint}>{t('authLocalText')}</p>
      </div>}
      <Diagnostics t={t} connection={connection} />
      <ServiceSection t={t} connection={connection} operation={operation} busy={state.busy} pending={pending}
        setPending={setPending} submit={(action) => { void serviceAction(action) }} />
    </section>
  </div></section>
}

/** Keep the actual execution host and remote workspace visible over the local shell. */
export function RemoteIndicator({ t, getSnapshot, subscribe }: IndicatorProps): ReactNode {
  const { connection } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  if (connection.phase === 'idle') return null
  return <div aria-live="polite" className={styles.indicator}>
    {t('location')}: {connection.hostName} / {connection.profile} / {connection.workspaceHint} ({t(PHASES[connection.phase])})
  </div>
}

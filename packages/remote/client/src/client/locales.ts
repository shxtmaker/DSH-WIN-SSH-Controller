/** Localized copy for the Desktop remote-workspace page. */
export const zh = {
  panel: '远程工作区', title: '远程工作区', intro: '连接你控制的 Linux Harness 实例。',
  saved: '已保存目标', newTarget: '新建目标', targetId: '目标 ID', name: '主机名称',
  instanceKey: '实例键', instanceId: '预期实例 ID', profile: '远端 profile', workspace: '远端工作区',
  port: '远端 Web 端口', lan: '局域网 SSH alias', tcp: 'frp TCP SSH alias', stcp: 'STCP visitor SSH alias',
  save: '保存目标', connect: '连接', disconnect: '断开', open: '打开远程工作区',
  endpoint: '连接入口', status: '连接状态', noTargets: '先保存一个目标。',
  noSession: '请先选择一个本机会话，以在侧栏中打开远端页面。',
  reconnect: '重新连接', refresh: '刷新', error: '操作失败',
  location: '当前执行位置', inactive: '未连接',
} as const

/** English fallback dictionary. */
export const en: Record<keyof typeof zh, string> = {
  panel: 'Remote Workspace', title: 'Remote Workspace', intro: 'Connect a Linux Harness instance you control.',
  saved: 'Saved target', newTarget: 'New target', targetId: 'Target ID', name: 'Host name',
  instanceKey: 'Instance key', instanceId: 'Expected instance ID', profile: 'Remote profile', workspace: 'Remote workspace',
  port: 'Remote Web port', lan: 'LAN SSH alias', tcp: 'frp TCP SSH alias', stcp: 'STCP visitor SSH alias',
  save: 'Save target', connect: 'Connect', disconnect: 'Disconnect', open: 'Open remote workspace',
  endpoint: 'Connection endpoint', status: 'Connection state', noTargets: 'Save a target first.',
  noSession: 'Select a local session first to open the remote page in the sidebar.',
  reconnect: 'Reconnect', refresh: 'Refresh', error: 'Operation failed',
  location: 'Execution location', inactive: 'Disconnected',
}

/** Dictionary key used by typed slots. */
export type RemoteWorkspaceKey = keyof typeof zh

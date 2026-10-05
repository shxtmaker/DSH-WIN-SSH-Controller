/** Localized copy for the Desktop remote-workspace page. */
export declare const zh: {
    readonly panel: "远程工作区";
    readonly title: "远程工作区";
    readonly intro: "连接你控制的 Linux Harness 实例。";
    readonly saved: "已保存目标";
    readonly newTarget: "新建目标";
    readonly targetId: "目标 ID";
    readonly name: "主机名称";
    readonly instanceKey: "实例键";
    readonly instanceId: "预期实例 ID";
    readonly profile: "远端 profile";
    readonly workspace: "远端工作区";
    readonly port: "远端 Web 端口";
    readonly lan: "局域网 SSH alias";
    readonly tcp: "frp TCP SSH alias";
    readonly stcp: "STCP visitor SSH alias";
    readonly save: "保存目标";
    readonly connect: "连接";
    readonly disconnect: "断开";
    readonly open: "打开远程工作区";
    readonly endpoint: "连接入口";
    readonly status: "连接状态";
    readonly noTargets: "先保存一个目标。";
    readonly noSession: "请先选择一个本机会话，以在侧栏中打开远端页面。";
    readonly reconnect: "重新连接";
    readonly refresh: "刷新";
    readonly error: "操作失败";
    readonly location: "当前执行位置";
    readonly inactive: "未连接";
};
/** English fallback dictionary. */
export declare const en: Record<keyof typeof zh, string>;
/** Dictionary key used by typed slots. */
export type RemoteWorkspaceKey = keyof typeof zh;
//# sourceMappingURL=locales.d.ts.map
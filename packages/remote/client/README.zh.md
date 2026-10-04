---
description: "管理 Desktop 的远端 Harness 附着，并在 Browser 侧栏打开其完整 Web 页面。"
kind: "package-reference"
---

# @harness-remote/client

[English](README.md) | 中文

## 概述

从 Desktop 外壳管理唯一活动的远端附着。页面保存非敏感目标、选择已核对的 SSH alias、显示连接阶段，并在 Browser 中打开远端 Harness Web 页面。连接活动期间，位置标识持续显示远端主机和工作区。本机 Desktop Host 保持可用。

## 目录

- [使用本包](#use-this-package)
- [了解实现](#understand-the-implementation)
- [延伸阅读](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

workspace bundle 挂载 Host 入口；Desktop 加载 Client 模块后提供页面。

### 最小配置

```yaml
- name: '@harness-remote/client'
```

此插件不接受配置字段。它需要 controller 生成的 `remoteWorkspace` 合约，以及本地 Browser 和右侧 Sidebar 服务。

-----

<a id="understand-the-implementation"></a>
## 了解实现

<details>
<summary>实现细节</summary>

`assembly.tsx` 在注册 UI slots 前挂载生成的 Remote 合约。`connections.tsx` 呈现管理页和位置标识。Host 入口为空操作，不创建第二个 Host 运行时。

</details>

-----

<a id="further-exploration"></a>
## 延伸阅读

- [远程包组](../README.zh.md) — controller 和 bundle。
- [侧栏 Browser](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/client/ui-sidebar-browser/README.zh.md) — tab 归属和原生 guest 行为。

-----

<a id="model-experience"></a>
## 模型体验

无。此 Client 页面不注册提示词、工具或 Session event。

#### KV Cache 影响

无；打开远端 Web 页面本身不会提交模型请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

以下限制影响 Desktop 界面：

- 打开远端页面需要先选中一个本机会话，因为 Browser tab 属于右侧 Sidebar 的 Session 布局。
- 此包不提供 Desktop 以外的独立 Web 管理界面；远端 Harness 页面仍使用现有完整 Web Client。
- 此版本尚未完成已安装 Desktop 中 Browser guest 加载的实机验收。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作背景</summary>

无。

</details>

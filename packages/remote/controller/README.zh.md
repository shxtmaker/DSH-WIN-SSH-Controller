---
description: "通过 OpenSSH 附着一个 Linux Harness Web 实例，并提供本地认证 Browser 代理。"
kind: "package-reference"
---

# @harness-remote/controller

[English](README.md) | 中文

## 概述

从 Desktop 附着一个已批准的 Linux Harness 实例，不改变原有 Host。控制器通过固定 SSH helper 发现实例，在 Harness 认证后再次核对身份，并打开 loopback Browser 代理。它仅存储非敏感目标信息。断开时只关闭本插件拥有的进程和端口。

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

workspace bundle 在 Desktop Host 中挂载此服务。

一键连接只需已配置的 SSH 别名和通常为 `default` 的实例键。服务通过 `--identity` 读取公开身份，生成本机目标 ID，保存远端 profile、工作区和 Web 端口。相同别名与实例键的已有记录保留原身份绑定。本机 SSH 配置及受限 `Include` 文件中的具体别名作为输入建议，SSH 配置正文不会返回页面。

### 最小配置

```yaml
- name: '@harness-remote/controller'
  config:
    helperPath: /usr/local/bin/dsh-remote-info
```

| 字段 | 默认值 | 含义 |
|---|---|---|
| `helperPath` | 必填 | 经已核对 SSH alias 到达的固定 Linux helper 绝对路径。 |

-----

<a id="understand-the-implementation"></a>
## 了解实现

<details>
<summary>实现细节</summary>

`ConnectionManager` 拥有一个附着代次。`ssh.ts` 拥有 OpenSSH 子进程，`auth.ts` 核对已认证的远端身份，`proxy.ts` 拥有本地票据、Cookie、HTTP 和 WebSocket 传输。`store.ts` 在持久化目标前拒绝凭据字段。

</details>

-----

<a id="further-exploration"></a>
## 延伸阅读

- [远程包组](../README.zh.md) — 附着链路的其他部分。
- [实施状态](../../../docs/implementation-status.zh.md) — 构建和实机验收证据。

-----

<a id="model-experience"></a>
## 模型体验

无。此 Host 控制器不注册提示词、工具或模型请求内容。

#### KV Cache 影响

无；模型请求在附着的远端 Harness 中运行，此控制器不改写它们。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

此附着控制器有以下约束：

- 同时只允许一个活动远端附着；一键连接通过已核对主机密钥的 SSH 读取并绑定稳定的实例身份。
- 控制器要求 Linux Companion 可达，不安装、重启或管理 SSH、frp 或远端 Harness。
- 只有 SSH 发现、Harness Cookie 认证、实时身份核对和事件流就绪全部成功后才能打开 Browser。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作背景</summary>

无。

</details>

---
description: "同时挂载远程工作区控制器与 Client 页面的 Desktop profile 层。"
kind: "package-bundle"
---

# @harness-remote/workspace

[English](README.md) | 中文

## 概述

为 Desktop profile 加入远程工作区连接控件。此 bundle 作为一个可选层插入 controller 和 client 行，不替换内置 Host 或 Web 业务插件。解析该层时，本地必须具备 controller 和 client 包。Desktop 运行时版本应与包的 `0.2.0-rc.2` peer 匹配。

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

Desktop 初始化 profile 且完全退出后，由其自带的 `dsh plugin --profile desktop` 命令加入此 bundle。同一次 add 操作应提供本地 controller 和 client tarball；源码工作区的隔离 tarball 解析已经通过，实际 Desktop 中的安装尚未运行。

### 获得的能力

`cordis.patch.yml` 插入 `remote-workspace-controller` 和 `remote-workspace-client`。前者拥有 SSH、认证与本地代理；后者加入 Desktop 页面和 Browser 打开操作。

-----

<a id="understand-the-implementation"></a>
## 了解实现

<details>
<summary>实现细节</summary>

此 bundle 的 patch 只有两条 insert 行，没有可执行行为。controller 行指定固定 helper 路径，操作者须使其与远端 Linux wrapper 一致。client 行仅在 Desktop Client 模块加载处生效。

</details>

-----

<a id="further-exploration"></a>
## 延伸阅读

- [远程包组](../README.zh.md) — 此层插入的包。
- [Desktop 运行时](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/apps/desktop/README.zh.md) — profile 初始化与内置 CLI。

-----

<a id="model-experience"></a>
## 模型体验

间接影响；现有远端 Harness 插件拥有提示词、工具和模型请求。

#### KV Cache 影响

此 patch 不改变模型文本或缓存键；任何缓存影响由远端插件行为决定。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

以下限制适用于 profile 组合：

- 此 bundle 不安装或配置远端 Companion、SSH alias 或 frp 路由。
- 默认 helper 路径必须与操作者安装的受限 Linux wrapper 一致。
- 此版本尚未完成已安装 Desktop 中的激活实机验收。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作背景</summary>

无。

</details>

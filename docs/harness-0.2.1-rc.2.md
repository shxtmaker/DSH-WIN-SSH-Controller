# Harness 0.2.1-rc.2 兼容升级

> 本文记录升级提交 `230fccd` 的本地验证。推送前的最终检查及安装包哈希见 [main 交付检查](main-publication-preflight.json)。

日期：2026-10-21。插件候选版本：`0.2.0-alpha.2`。

## 基线

本次升级基于 `preview/plan-b-0.2.0-alpha.1` 的 `fb8c88d2aef7e22a36f496ae1fe0aa9cad896ac4`。本地分支为 `codex/harness-0.2.1-rc.2`。

Harness 从 `dsh-v0.2.1-alpha.2`（`d743267388641bc76f17c45ce8b4c231aed1d32c`）升级到 [dsh-v0.2.1-rc.2](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.2.1-rc.2)（`687f282e8625c6b8d11ff58211a90524be2e4317`）。构建使用 Node.js `24.19.0` 和 pnpm `11.28.5`。

两端的发现协议与管理协议继续使用版本 `1`。`docs/control-contract.json` 未改变，两端 SHA-256 均为 `2849b077a752cda02ef324feaeb968a9dd6b01a6ccbaf07bcedd7a8ec74f486d`。

## 上游变更与适配

- Client 打包器改为接收包目录；构建配置使用 `import.meta.dirname`，并根据新版生成器重新生成 Host 与 Client 的 Typert 元数据。
- 新版浏览器平台共享 `zod`。隔离浏览器验证加载实际 Zod，而不替换验证器；安装验证检查 Client 与 Host 的方法元数据一致。
- Harness 网关新增 `remoteAccess` 依赖，Loader 验证组合已包含该真实服务。控制端仍使用浏览器 Cookie 打开完整 Web 工作区，并实测签名 Cookie 交换、身份读取和事件流就绪；未把独立 API `/connect` 身份用于浏览器页面。
- 构建仅编译本项目及其必要依赖，避免以整个上游 Host 测试程序集作为插件构建入口。
- 根包、三个独立包和 Git 运行文件均已更新。新增能力、分层诊断、服务操作回执、双打开入口和显式重新认证继续保留。

## 验证

| 检查 | 结果 |
| --- | --- |
| 全新固定提交目录构建、类型编译和打包 | PASS |
| 项目、协议与篡改拒绝回归 | PASS：18 项，512MB 堆限制 |
| Harness 集成测试 | PASS：5 个文件，32 项 |
| 安装包 Client 浏览器测试 | PASS：123 项断言 |
| 浅色、深色原生样式和 390px 布局 | PASS |
| Windows 发行版 CLI 隔离 Git 安装 | PASS |
| Windows 发行版 CLI 三个独立包安装与真实 Loader 验证 | PASS |
| 安装后的真实 Loader、认证 HTTP、未认证拒绝、Client 工厂 | PASS |
| 三个安装包的 SHA-256、角色隔离和 Git 运行文件一致性 | PASS |

浏览器测试使用本地固定 Host 响应。Harness 集成测试使用真实传输与授权服务、测试身份和空闲事件源。上述结果不代表已安装 Desktop 的实机交互、Linux 远程 SSH 或 frp 验收。

## 构建与证据

Windows 准备目录显式禁用自动 CRLF 转换，使固定上游补丁可重复应用。Git 运行文件校验使用 Buffer 等值比较，篡改时只报告文件路径，避免构造大段二进制差异。

命令、结果范围、安装包哈希见 [机器可读记录](harness-0.2.1-rc.2.json)。原始验证输出位于 [证据目录](evidence/harness-0.2.1-rc.2)。当前安装文件及校验清单位于 `dist/remote/`，安装步骤见 [INSTALL.md](INSTALL.md)。

## 交付范围

本次完成本地源码、构建、安装包与隔离兼容验证。远程分支推送、正式 Release、生产安装、真实 SSH/LAN/WAN/frp、已安装 Desktop 操作及真实模型调用均为 `NOT_RUN`。历史实机记录不能替代本候选版本的验证。

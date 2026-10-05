# DSH-WIN-SSH-Controller

DeepSeek Harness SSH 远程工作区控制端。

在 Windows 或 macOS 的 Harness Desktop 中管理 SSH 连接，核对远端实例身份，并通过本地认证代理打开 Linux Harness 的完整 Web 页面。

## 安装文件

在 Harness Desktop 的插件管理器中选择 Git 仓库安装，填入以下地址：

```text
https://github.com/shxtmaker/DSH-WIN-SSH-Controller
```

Git 安装包包含控制端、连接页面和组合包配置，安装时无需构建 Harness。安装与更新步骤见[安装与使用说明](docs/INSTALL.md)。

也可使用三个独立安装包：

- [harness-remote-controller-0.1.0.tgz](dist/remote/harness-remote-controller-0.1.0.tgz)
- [harness-remote-client-0.1.0.tgz](dist/remote/harness-remote-client-0.1.0.tgz)
- [harness-remote-workspace-0.1.0.tgz](dist/remote/harness-remote-workspace-0.1.0.tgz)

安装包版本为 0.1.0，适用于 Harness 0.2.0-rc.2。校验值见 [SHA256SUMS.txt](dist/remote/SHA256SUMS.txt)。在仓库根目录执行 node scripts/verify-artifacts.mjs 即可验证。

## 使用

按 [安装与使用说明](docs/INSTALL.md) 配置本端，再与 [DSH-WIN-SSH-Agent](http://192.168.3.100:3300/lqy/DSH-WIN-SSH-Agent) 配合使用。两侧通过协议版本 1 通信。

## 源码与构建

源码位于 packages/remote/。本项目可以单独克隆、构建和打包。构建从固定的 Harness 提交准备依赖环境，无需克隆另一端项目。命令见 [构建说明](docs/BUILD.md)。

本项目包含 controller、client 和 workspace 三个安装包。 迁移说明见 [原项目迁移](docs/MIGRATION.md)，两侧通信字段见 [协议说明](docs/PROTOCOL.md)，验证记录见 [验证状态](docs/implementation-status.zh.md)。

## 许可证

采用 [MIT License](LICENSE)，保留 DeepSeek Harness 的许可证及版权声明。

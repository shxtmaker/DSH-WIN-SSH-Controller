# 控制端安装与使用

控制端运行于 DeepSeek Harness Desktop，提供远程工作区连接页、系统 OpenSSH 连接和本地认证代理。远程工作区中的文件读写、模型调用、命令执行和会话存储由被控端 Harness 处理。

## 环境要求

安装包版本为 0.1.0，适用于 DeepSeek Harness 0.2.0-rc.2。使用 Desktop 自带的 dsh 核对版本。本机需要 Windows 或 macOS、系统 OpenSSH，以及已核对主机密钥且可以无交互登录的 SSH alias。被控端需按 [被控端说明](http://192.168.3.100:3300/lqy/DSH-WIN-SSH-Agent) 安装并配置 Companion。

## 安装

### 从 Git 仓库安装

在 Harness Desktop 的插件管理器中选择 Git 仓库安装，填入：

```text
https://github.com/shxtmaker/DSH-WIN-SSH-Controller
```

该方式安装 `dsh-win-ssh-controller-source`。包内包含控制端服务、远程连接页面、Typert 通信契约和组合包配置，无需另外安装三个 `.tgz` 文件，也无需运行源码构建。

若此前出现“这个包没有声明组合包，不能作为插件管理”，重新提交上述地址安装即可。仍命中旧缓存时，在地址末尾附加修复提交 SHA：`https://github.com/shxtmaker/DSH-WIN-SSH-Controller#<commit-sha>`。

使用命令行时，先完全退出 Desktop，再使用 Desktop 自带的同版本 `dsh` 执行：

```powershell
dsh plugin --profile desktop add https://github.com/shxtmaker/DSH-WIN-SSH-Controller
dsh plugin --profile desktop list
```

Git 安装与独立安装包安装选择一种方式。切换方式时，在退出 Desktop 后先卸载原安装方式，避免同一 profile 重复启用控制端服务。

### 从独立安装包安装

先启动 Desktop 以初始化 desktop profile，再完全退出。使用 Desktop 安装目录 resources/runtime/cli/bin/dsh.cmd，或从 Desktop 的“Manage dsh Command…”菜单注册的同版本 dsh。

在仓库根目录核对安装文件：

```powershell
node scripts/verify-artifacts.mjs
dsh --version
dsh plugin --profile desktop add file:./dist/remote/harness-remote-controller-0.1.0.tgz file:./dist/remote/harness-remote-client-0.1.0.tgz file:./dist/remote/harness-remote-workspace-0.1.0.tgz
dsh plugin --profile desktop list
```

同一次安装须提供三个本地文件。npm 全局安装的 dsh 不用于管理 Desktop profile。macOS 使用 Desktop 自带的 dsh 和相同的插件安装命令。

## SSH 入口与身份

可参考 [Windows SSH 示例](../configs/ssh_config.windows.example) 或 [macOS SSH 示例](../configs/ssh_config.macos.example) 配置 LAN、frp TCP、STCP visitor 的 SSH alias。先通过独立可信渠道核对主机密钥，再确认无交互登录。

读取被控端公开身份：

```powershell
'{"protocolVersion":1,"instanceKey":"default"}' | ssh harness-lan /usr/local/bin/dsh-remote-info --identity
```

默认固定 helperPath 是 /usr/local/bin/dsh-remote-info，须与被控端安装位置一致。进入 Desktop 的“远程工作区”页，填写 instanceKey、instanceId、profile、workspaceHint、remotePort，以及实际使用的 SSH alias。remotePort 使用身份输出的 port。

## 连接与断开

选择目标和入口后点击“连接”。实例身份、认证和事件流均就绪后显示 app-ready。先选中一个本机会话，再点击“打开远程工作区”，完整远端 Web 在 Browser 侧栏打开。

连接中断时，本地代理暂停转发并尝试重新附着。重新认证和身份核对通过后恢复转发。断开只释放本插件的本地端口、Cookie 和 SSH 进程；远端 Harness 继续运行。

## 卸载

先断开连接并完全退出 Desktop，再执行：

Git 安装：

```powershell
dsh plugin --profile desktop remove dsh-win-ssh-controller-source
```

独立安装包安装：

```powershell
dsh plugin --profile desktop remove @harness-remote/workspace @harness-remote/client @harness-remote/controller
```

目标记录保留于对应 DSH_HOME 的 remote-workspace/targets.json。安装失败时恢复 profile 原有插件清单。保留已核对的主机密钥和现有 SSH、frp 配置。

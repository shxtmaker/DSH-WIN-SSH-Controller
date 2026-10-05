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

安装或升级完成后，完全退出 DeepSeek Harness（包括托盘进程），再重新打开。仅刷新页面不会重新加载本机服务接口。

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

## 一键连接

进入 Desktop 的“远程工作区”页，在“SSH 别名”中选择或输入已配置的别名，然后点击“一键连接”。程序会读取本机 `~/.ssh/config` 及其 `Include` 文件中的具体 `Host` 名称；仅有一个别名时自动填入。未列出的别名仍可直接输入。用户名、地址、密钥和跳板机沿用系统 OpenSSH 配置。

远端使用默认实例键 `default` 时，只需一个 SSH 别名。自定义实例键在“高级选项”中填写。程序通过固定 helper 的 `--identity` 模式自动读取实例 ID、profile、工作区和 Web 端口，生成目标 ID 并保存目标，然后建立隧道、完成远端认证和身份核对。再次使用相同别名和实例键时复用已有目标，不覆盖已保存的身份。

页面标题及必要字段标题旁的圆圈问号可点击展开帮助，再次点击或按 Esc 收起。SSH 主机密钥、无交互认证、连接入口不可达及 Agent 配置问题会显示对应处理提示。

被控端需安装 Agent，并配置可执行的 `/usr/local/bin/dsh-remote-info`。若 helper 安装在其他位置，修改本插件的 `helperPath`。首次 SSH 登录仍须通过可信渠道核对主机密钥；一键连接不会自动接受未知密钥，也不会保存密码、私钥或启动 token。

### 自动连接提示 HTTP 404

如果升级后页面显示一键连接，但 `remoteWorkspace/quickConnect` 或 `remoteWorkspace/listAliases` 返回 HTTP 404，先完全退出 DeepSeek Harness（包括托盘进程）后重新打开。运行中的 Host 可能仍保留升级前的接口；刷新页面不能完成服务更新。新版页面检测到该情况时会显示重启提示并暂停一键连接，已保存目标的手动连接仍可使用。

若完整重启后仍有提示，确认 desktop profile 中仅启用了当前安装方式，再更新到最新提交并完整重启。

### SSH helper 无法执行

Agent 安装完成后，还需要配置 SSH 使用的 helper 入口。控制端默认执行 `/usr/local/bin/dsh-remote-info`；该文件不存在、无法执行或未设置 Agent 所需环境变量时，自动连接会停止。Shell 的 126、127 退出状态分别表示无法执行、命令不存在，页面会提示检查 helper。

无法使用 sudo 时，可将 Agent 的 wrapper 安装到运行 Harness 的 Linux 账号的 `~/.local/bin/dsh-remote-info`，只允许该账号修改和执行。按 Agent 安装说明填写实际 `DSH_HOME`、允许实例键和已安装 helper 的绝对路径。随后在本机 desktop profile 的 `cordis.patch.yml` 中添加控制端覆盖配置，例如：

```yaml
- id: remote-workspace-controller
  config:
    helperPath: /home/harness/.local/bin/dsh-remote-info
```

将示例账号改为实际 Linux 账号。`helperPath` 使用远端绝对路径；已有控制端覆盖条目时修改该条目，避免重复 ID。重新加载插件配置后，使用公开身份读取命令验证 wrapper；不要将含 `launchUrl` 的完整描述复制到聊天或日志。

## 手动配置

需要维护 LAN、frp TCP 或 STCP 多个入口时，展开“手动配置目标”。各入口必须指向同一个实例。可以通过以下命令读取公开身份，填写目标后保存：

```powershell
'{"protocolVersion":1,"instanceKey":"default"}' | ssh harness-lan /usr/local/bin/dsh-remote-info --identity
```

`instanceKey`、`instanceId`、`profile`、`workspaceHint`、`remotePort` 须与身份输出一致。`remotePort` 是 Web 端口，不是 SSH 端口。已保存实例身份变化时连接会停止，请核对被控端是否重装或更换后再修改记录。

## 连接与断开

已保存目标自动选择第一个入口，选择目标后可直接点击“连接”。实例身份、认证和事件流均就绪后显示“已连接”。已有选中的本机会话时，一键连接和已保存目标连接会自动在 Browser 侧栏打开完整远端 Web；没有本机会话时保留连接，选择一个会话后点击“打开远程工作区”。

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

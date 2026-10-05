# 验证状态

本项目来自 DSH-WIN-SSH 的固定提交，记录见 source-baseline.json。该文件同时声明 Harness 构建提交。协议版本为 1，插件版本为 0.1.0。

当前拆分验证的实际结果见 [verification.json](verification.json)。构建、自动测试、模拟链路和实机验收分别记录。

2026-10-05 已修复 Git 仓库直接安装时的 `not-bundle` 错误。Git 根包包含控制端运行入口、连接页面及组合包配置，Host 与 Client 的包标识和 Typert 契约保持一致。Windows 真实 Git 安装与 WSL 发行版 CLI 安装均通过；安装后的真实 Loader 组合、认证 HTTP 状态查询、未认证访问拒绝和 Client 模块工厂契约检查通过。项目回归 7 项、原有代理与 Loader 回归 4 项通过。

上述 Git 安装修复的验证记录位于 `docs/evidence/git-install-*.txt`。该次修复未修改业务源码与三个独立安装包。已安装 Desktop 的视觉交互、实机 SSH 和 frp 业务验收仍为 `notRun`。

2026-10-05 的自动连接迭代已修改业务源码并重新生成三个独立安装包和 Git 根包运行文件。默认仅输入 SSH 别名，实例身份、profile、工作区与端口自动读取；已有身份绑定继续校验。必要标题旁的圆圈问号支持点击帮助和 Esc 收起。详细结果见 [自动连接验证](automation-verification.json)，本次已安装 Desktop 与实机 SSH/frp 检查未执行。

双机 Desktop/Linux 业务链路、真实 frp 恢复和实机资源清理状态为 notRun。

2026-10-05 的连接选择列表迭代复用现有 SSH 别名读取接口和目标文件，新增可见列表、搜索框及当前目标提示。筛选不改变已选连接，键盘选择和搜索不会发起连接。实现与验证记录见 [连接列表验证](searchable-connections-verification.json)。本次仅向 GitHub 与 Gitea 的 `codex/searchable-ssh-connections` 分支提交，插件版本保持 0.1.0；本次安装后 Desktop 交互、真实 SSH/frp 和 macOS 验收未执行。

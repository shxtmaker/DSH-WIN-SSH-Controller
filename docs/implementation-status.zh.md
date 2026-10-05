# 验证状态

本项目来自 DSH-WIN-SSH 的固定提交，记录见 source-baseline.json。该文件同时声明 Harness 构建提交。协议版本为 1，插件版本为 0.1.0。

当前拆分验证的实际结果见 [verification.json](verification.json)。构建、自动测试、模拟链路和实机验收分别记录。

2026-10-05 已修复 Git 仓库直接安装时的 `not-bundle` 错误。Git 根包包含控制端运行入口、连接页面及组合包配置，Host 与 Client 的包标识和 Typert 契约保持一致。Windows 真实 Git 安装与 WSL 发行版 CLI 安装均通过；安装后的真实 Loader 组合、认证 HTTP 状态查询、未认证访问拒绝和 Client 模块工厂契约检查通过。项目回归 7 项、原有代理与 Loader 回归 4 项通过。

验证记录位于 `docs/evidence/git-install-*.txt`。业务源码与原有三个独立安装包未修改。已安装 Desktop 的视觉交互、实机 SSH 和 frp 业务验收仍为 `notRun`。

双机 Desktop/Linux 业务链路、真实 frp 恢复和实机资源清理状态为 notRun。

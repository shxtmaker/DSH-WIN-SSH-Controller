# 从源码构建

需要 Git、Node.js 24 和 Corepack。固定上游使用 pnpm 11.7.0，提交由 source-baseline.json 声明。构建脚本只使用当前项目源码和固定上游，不读取另一端项目。

## 准备与构建

在当前项目根目录按顺序执行。PowerShell 和 Bash 使用相同的命令：

```text
node scripts/verify-project.mjs
node --test tests/project.test.mjs
node scripts/prepare-upstream.mjs
node scripts/build.mjs
node scripts/test-integration.mjs
node scripts/verify-artifacts.mjs out/remote
node scripts/test-git-install.mjs --harness /absolute/path/to/built-harness
```

每条命令成功后再继续。准备脚本只接受 .build/ 下尚不存在的目标目录。已有目录会被保留。新准备目录使用 node scripts/prepare-upstream.mjs .build/upstream-2；后续构建和集成检查使用 --workspace .build/upstream-2。

已有本地 Harness Git 对象库时，可使用 node scripts/prepare-upstream.mjs --source /absolute/path/to/harness-clone。该选项仍核对固定提交，不复制来源工作区的未提交修改。

构建安装固定锁文件依赖，并生成本端的安装包。控制端编译 Harness Host 类型依赖、controller、client 和 bundle，生成 Typert 通信代码，再仅打包本端运行入口与 Client 界面。 网络不可用且 pnpm 缓存完整时，可以使用 node scripts/build.mjs --offline。

## 输出与重复打包

新产物位于 out/remote/，含安装包、SHA256SUMS.txt、配置示例和中文安装说明。仓库中的 dist/remote/ 为已校验的安装文件；构建不会覆盖它。

打包成功后，脚本从校验过的三个安装包生成根目录的 `runtime/`、`cordis.patch.yml`、运行依赖和 Client 元数据。Git 包以一个 Host 组件提供控制端服务，并通过同一包的 Client 元数据加载连接页面。生成过程将原组件包名统一为 Git 根包名，保持 Host、Client、Typert 元数据和类型声明一致。业务源码与独立安装包不因该步骤改写。

发布业务源码变更时，将审查后的新安装包及校验清单同步至 `dist/remote/`，再执行 `verify:project` 检查运行文件一致性。`node scripts/sync-git-package.mjs` 可从现有 `dist/remote/` 重建 Git 入口。Git 安装不执行构建生命周期脚本。

源码修改后，需要重新准备新的构建目录。构建目录内的源码是准备时复制的快照。对同一快照可直接重复运行 build；已有完整构建输出时，可用 node scripts/build.mjs --pack-only 仅重新打包。

## 检查

test 检查本端源码、构建补丁和安装包隔离，并验证破损包、额外包和错误校验清单被拒绝。test:integration 在本项目构建目录运行认证代理和真实 Loader 组合测试。

`test-git-install.mjs` 在临时 profile 中执行真实 Git 安装，验证组合包识别、运行入口、Typert 导出及 Client 模块，并通过 Harness 的运行时解析器与真实 Loader 加载安装后的控制端。认证 HTTP 状态查询及未认证访问拒绝均纳入检查。Client 模块工厂在隔离环境执行，检查其模块身份与挂载契约是否和 Host 一致。临时测试目录在结束时清理。

测试接受 `--harness /path/to/built-harness`，或 `--installation /path/to/isolated-cli-installation`。后者的独立目录须由 pnpm 安装 `@deepseek-ai/dsh@0.2.0-rc.2`；测试额外使用 `react@18.3.1` 执行 Client 模块工厂。此模式调用发行版 `dsh plugin add`，并检查 profile 已选中组合包。`--spec` 可指定远程 Git URL 和提交，用于推送后的复验。上述检查不包含已安装 Desktop 的视觉交互或实机 SSH/frp 业务验收。

本地构建和模拟代理测试不能代替 Desktop 与 Linux 双机业务验收。完整上游文档站点校验不属于本项目的最小构建入口。

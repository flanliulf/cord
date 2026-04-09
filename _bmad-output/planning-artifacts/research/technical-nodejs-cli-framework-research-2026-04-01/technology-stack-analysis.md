# Technology Stack Analysis

## CLI 框架核心候选方案

本研究评估了 Node.js 生态中 5 个主流 CLI 框架，按市场份额和社区活跃度排序：

### 1. Commander.js — 行业标杆

| 维度 | 数据 |
|------|------|
| **最新版本** | v14.0.3 |
| **GitHub Stars** | ~27k |
| **npm 周下载量** | ~180M+（Node.js CLI 框架中最高） |
| **TypeScript 支持** | ✅ 内置类型声明（自 v9 起） |
| **零依赖** | ✅ 无运行时依赖 |
| **许可证** | MIT |

**核心特性：**
- 链式 API 设计（`.command().option().action()`），学习曲线极低
- 子命令支持：内联子命令 + 独立可执行子命令（`command-subcommand` 模式）
- 自动生成帮助信息，支持自定义帮助分组
- `.requiredOption()` 必需选项、可变参数选项（variadic）、否定布尔选项（`--no-*`）
- 生命周期钩子（hooks）：`preAction`、`postAction`、`preSubcommand`
- CommonJS / ESM / TypeScript 三模式支持
- 1,491+ commits，维护者 TJ Holowaychuk 持续活跃

**知名用户：** Vite、create-vue、webpack-cli、Vue CLI、Nuxt CLI

_Source: [GitHub - tj/commander.js](https://github.com/tj/commander.js), [npm registry](https://registry.npmjs.org/commander/latest)_

### 2. Yargs — 功能最丰富

| 维度 | 数据 |
|------|------|
| **最新版本** | v18.0.0 |
| **GitHub Stars** | ~11.5k |
| **npm 周下载量** | ~100M+ |
| **TypeScript 支持** | 🟡 通过 `@types/yargs` 社区类型 |
| **依赖数** | 较多（cliui、escalade、get-caller-file、require-directory、string-width、y18n、yargs-parser） |
| **许可证** | MIT |

**核心特性：**
- 声明式命令定义 + 链式配置
- 自动帮助菜单生成 + Shell 自动补全（Bash/Zsh）
- 内置国际化支持（y18n）
- 复杂参数解析：数组、对象、否定、coerce 类型转换
- Deno 完整支持（v16+）
- 浏览器构建版本可用

**知名用户：** Mocha、NYC、ESLint（部分）、React Native CLI

_Source: [GitHub - yargs/yargs](https://github.com/yargs/yargs), [npm registry](https://registry.npmjs.org/yargs/latest)_

### 3. Clipanion — 类型安全先锋

| 维度 | 数据 |
|------|------|
| **最新版本** | v4.0.0-rc.4（仍为 RC 状态） |
| **GitHub Stars** | ~1.2k |
| **npm 依赖者** | ~74.6k |
| **TypeScript 支持** | ✅ 原生 TypeScript（98.6% TS 代码） |
| **零运行时依赖** | ✅ |
| **许可证** | MIT |

**核心特性：**
- 基于 class 的命令定义（`extends Command`），TypeScript 装饰器风格
- 嵌套命令支持（如 `yarn workspaces list`）
- 透明选项代理（无需 `--` 分隔符）
- Typanion 验证器集成（类型安全的参数校验）
- 状态机驱动的命令解析（从命令定义生成优化的状态机）
- 自动生成美观帮助页面

**知名用户：** Yarn Berry（v2+）——这是 Clipanion 的核心使用场景

_Source: [GitHub - arcanis/clipanion](https://github.com/arcanis/clipanion), [npm registry](https://registry.npmjs.org/clipanion/latest)_

### 4. oclif — 企业级框架

| 维度 | 数据 |
|------|------|
| **最新版本** | v4.x |
| **GitHub Stars** | ~9.5k |
| **TypeScript 支持** | ✅ 原生 TypeScript（94.4% TS 代码） |
| **Node.js 要求** | Node 18+ |
| **维护者** | Salesforce |
| **许可证** | MIT |

**核心特性：**
- CLI 脚手架生成器 + 插件系统
- 跨平台打包（macOS、Windows、Debian）
- AWS S3 分发集成
- 自动 README 文档生成
- 完整的 CLI 生命周期管理

**知名用户：** Salesforce CLI、Heroku CLI

**⚠️ 评估结论：** oclif 面向大型企业 CLI（100+ 命令、插件生态），对 CORD 的轻量级场景明显过重。引入后会增加大量样板代码和构建复杂度。

_Source: [GitHub - oclif/oclif](https://github.com/oclif/oclif)_

### 5. citty — 新生代轻量级

| 维度 | 数据 |
|------|------|
| **最新版本** | v0.2.1（尚未 v1） |
| **维护者** | UnJS 团队 |
| **TypeScript 支持** | ✅ 原生 TypeScript |
| **零依赖** | ✅ |
| **许可证** | MIT |

**核心特性：**
- 极简 API，对象式命令定义
- UnJS 生态集成（Nuxt 3、Nitro）
- 轻量级，启动速度快

**⚠️ 评估结论：** 版本号未达 v1，API 稳定性存疑。社区规模和文档成熟度远不及 commander/yargs。目前更适合 UnJS 生态内部使用。

_Source: [npm registry](https://registry.npmjs.org/citty/latest)_

---

## 终端输出与格式化工具

| 工具 | 版本 | 用途 | 特点 |
|------|------|------|------|
| **picocolors** | v1.1.1 | 终端颜色 | 最轻量（零依赖、~2x chalk 性能）、Node.js 核心项目采用 |
| **chalk** | v5.6.2 | 终端颜色 | 功能最全（RGB、256色、嵌套样式），ESM-only（v5+） |
| **kleur** | v4.x | 终端颜色 | 轻量、链式/嵌套 API、CJS+ESM |
| **ora** | v9.3.0 | 终端 spinner | 优雅加载动画，ESM-only |
| **listr2** | v8.x | 任务列表 | 多任务并行进度展示，支持嵌套 |
| **cli-table3** | v0.6.x | 表格输出 | Unicode 表格渲染，列宽自适应 |

**趋势判断：** picocolors 正在取代 chalk 成为新项目的首选颜色库。Vite、PostCSS、Browserslist 等高流量项目已迁移至 picocolors。原因：零依赖、体积更小（~3KB vs chalk 的 ~45KB）、CJS+ESM 双模式支持、性能优势约 2 倍。

_Source: [npm registry](https://registry.npmjs.org/picocolors/latest), [npm registry](https://registry.npmjs.org/chalk/latest), [npm registry](https://registry.npmjs.org/ora/latest)_

---

## 交互式提示工具

| 工具 | 版本 | 特点 | 适用场景 |
|------|------|------|---------|
| **@inquirer/prompts** | v8.3.2 | 模块化重构、TypeScript 原生、按需导入 | 复杂多步配置向导 |
| **@clack/prompts** | v1.2.0 | 美观 UI、极简 API、spinner 集成 | 引导式初始化流程（如 `create-*` 工具） |
| **prompts** | v2.4.x | 轻量、可编程、JSON 式问题定义 | 简单确认/输入场景 |

**趋势判断：** `@clack/prompts` 是 2024-2026 年增长最快的交互式提示库，其设计灵感来自 `create-svelte`，以美观的 UI 和极简的 API 著称。对于 CORD 的 `npx cord init` 配置向导场景，@clack/prompts 的 `intro()`→`text()`→`select()`→`confirm()`→`outro()` 流式体验是最佳匹配。

_Source: [npm registry](https://registry.npmjs.org/@inquirer/prompts/latest), [npm registry](https://registry.npmjs.org/@clack/prompts/latest)_

---

## 构建与分发工具链

| 工具 | 用途 | 与 CORD 的关联 |
|------|------|---------------|
| **tsup** | TypeScript 打包（基于 esbuild） | 快速构建、CJS+ESM 双输出、tree-shaking |
| **tsx** | TypeScript 直接执行 | 开发阶段无需编译即可运行 TS |
| **unbuild** | UnJS 构建工具 | 自动推断配置、适合库/CLI 分发 |
| **pkg / @vercel/ncc** | 单文件打包 | 可将 CLI 打包为独立可执行文件 |

**CORD 上下文：** TR2 已确定使用 TypeScript + better-sqlite3。CLI 构建链需要兼容原生 C++ 绑定模块（better-sqlite3 使用 N-API）。tsup 是当前 TypeScript CLI 项目的首选构建工具，支持 external 配置排除原生模块。

---

## 技术采用趋势总结

| 趋势方向 | 描述 |
|---------|------|
| **Commander 持续统治** | 周下载量 180M+ 远超其他竞品，Vite/Vue/Nuxt 等新一代工具持续选择 Commander |
| **TypeScript-first 成为标配** | Commander v14、Clipanion v4 均内置类型；Yargs 仍依赖社区 @types |
| **轻量化替代** | picocolors 替代 chalk、citty 替代重量级框架——"less is more" 趋势明显 |
| **@clack/prompts 崛起** | 取代传统 inquirer 成为初始化向导场景首选 |
| **ESM 迁移加速** | chalk v5、ora v9 已 ESM-only；Commander 保持 CJS+ESM 双模式兼容 |
| **npx 零安装体验** | 用户期望 `npx <tool>` 即用即走，冷启动速度成为关键体验指标 |

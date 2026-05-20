# Core Architectural Decisions

## Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- D1: Zod 数据验证 — 影响所有入口层和 Service 层
- D2: 版本号 + 增量 SQL 迁移 — 影响存储层和版本升级
- D3: 自定义 Error 类层级 — 影响全局错误处理
- D5: 按架构层组织目录 — 影响项目初始化

**Important Decisions (Shape Architecture):**
- D4: 自研轻量 Logger — 影响调试和运维体验
- D6: YAML + JSON Schema 配置 — 影响用户配置体验
- D7: GitHub Actions CI/CD — 影响发布流程
- D8: 80%+ 代码覆盖率 — 影响测试策略

**Deferred Decisions (Post-MVP):**
- RESTful API 层设计（v0.5）
- Embedding 增强引擎配置（v0.5）
- 团队协作/共享图谱传输协议（v1.0）

## Data Architecture

**D1. 数据验证策略：Zod Schema**

- **决策：** 在 Service 层使用 Zod 定义 schema，所有输入（CLI 参数、MCP Tool 参数、扫描产出）统一验证
- **版本：** Zod v3.x（当前稳定版）
- **理由：** 与 MCP Tools 的 `inputSchema`（JSON Schema 格式）天然兼容；CORD 有多个入口（CLI / MCP / 未来 REST），统一验证层价值高；TypeScript 类型推断一流
- **影响范围：** Service 层、CLI 入口层、MCP Server 层
- **实现要点：**
  - 定义 `src/schemas/` 目录存放所有 Zod schema
  - CLI 参数验证、MCP Tool inputSchema、Service 层输入验证共享同一套 schema
  - Zod schema 可通过 `zod-to-json-schema` 转换为 MCP Tools 所需的 JSON Schema
  - 由字面量常量构造枚举 schema 时，必须保留字面量联合类型，禁止通过 `[string, ...string[]]` 等宽化写法喂给 `z.enum(...)`；同时至少补一条类型层断言测试，防止编译期契约退化
  - 对路径型 CLI 输入，验证责任包含两步：先对原始路径文本做 `trim()` 等标准化，再归一化到 project-relative POSIX path，最后做 schema 校验；若归一化结果落到 projectRoot 外，必须在入口层直接返回 `ConfigError`
  - project-root 路径契约的跨平台回归必须覆盖 win32 语义：至少包含跨盘符路径（如 `D:\outside.json`）与 UNC 路径（如 `\\server\share\outside.json`）；若 `relative(projectRoot, input)` 结果仍为绝对路径，必须视为 projectRoot 外路径并在 `serviceFactory()` 前拒绝

**D2. 数据迁移策略：版本号 + 增量 SQL 脚本**

- **决策：** 使用 `schema_migrations` 历史表追踪已执行迁移，应用启动时查询已执行版本后按序执行待执行脚本（支持审计和部分回滚，比单值 schema_version 更灵活）
- **理由：** CORD 是嵌入式本地数据库，不需要 ORM 级别的迁移框架；用户手动添加的关系必须保留，排除按需重建方案
- **影响范围：** Repository 层、应用启动流程
- **实现要点：**
  - `src/repositories/migrations/` 目录存放有序编号的 SQL 脚本（`001-initial-schema.sql`、`002-add-index.sql`...，kebab-case 命名）
  - 应用启动时 Repository 层自动检测并执行待执行的迁移
  - 迁移在事务中执行，失败可回滚
  - 迁移中的列新增、索引创建、数据回填等子步骤必须分别保持独立幂等；禁止因某个工件已存在而提前结束迁移，导致其他仍可能缺失的工件无法补建
  - 迁移回归测试除标准旧库升级外，还必须覆盖“部分迁移数据库”场景（如列已存在但索引缺失），确保启动后可自愈到完整目标 schema
  - v0.1 pre-release 阶段允许直接重写 baseline migration；为兼容早期旧 v1 baseline，已通过 `003-fix-v1-baseline` 补齐约束/索引自愈迁移；首个稳定 release 后切换为只增不改的增量迁移模式
  - 图谱批量写入（documents / relations / sync_states）必须先在事务外收敛可持久化 workset；事务内仅执行完整写入计划，若发现端点映射或计划失配必须抛错回滚，禁止用普通 `return` 提前结束 transaction callback
  - 对明确承诺“查看当前状态”的 `status` / 健康检查命令，持久化存储不存在时必须返回未初始化或空状态；禁止为读取创建数据库、目录或隐式执行迁移
  - 状态/健康检查对外展示的统计字段必须来自单次 transaction snapshot 或等价一致快照；禁止混用数组读取和后续独立 count 查询形成混合口径
  - `query` / `impact` 的历史只读副作用统一治理仍由 TODO-028 跟踪；在统一治理完成前，至少不得让新的 status / 健康检查命令继续复制初始化副作用模式
  - `cord status` 展示当前已执行迁移版本数及最新版本号

## Error Handling & Logging

**D3. 错误处理模式：自定义 Error 类层级**

- **决策：** `CordError` 基类 → `ScanError` / `QueryError` / `ConfigError` / `StorageError` / `AdapterError` 等子类
- **理由：** 简单务实，与 Node.js 生态习惯一致；CLI 和 MCP 两个入口需要将错误转化为用户可理解的消息；自定义 Error 携带 `code` + `suggestion` 字段满足 NFR19
- **影响范围：** 全局，所有模块
- **实现要点：**
  - `CordError` 基类包含 `code: string`、`suggestion: string`、`context: Record<string, unknown>`
  - CLI 入口层：捕获 CordError，用 chalk 格式化输出错误信息和修复建议
  - Commander CLI 若包含 async action，真实入口必须暴露 async `runCli()` 并 `await program.parseAsync(process.argv)`；entrypoint 守卫负责 Promise rejection 兜底
  - 参数解析错误、业务 `ConfigError` 和 runtime error 的退出码映射必须在真实 CLI 入口层统一处理，并由入口级测试覆盖
  - 任何会触发默认 Service / Repository 初始化的 CLI 命令，必须先完成输入校验与路径归一化，再创建 Service；纯输入错误不得先产生目录、数据库或连接副作用
  - project-root 路径契约的回归测试必须覆盖带前后空白的项目外相对/绝对路径输入，确保 `serviceFactory()` 前稳定返回 `ConfigError`
  - 若默认 Service 持有可关闭的 Repository / 连接资源，Service 必须转发 `close()` 等生命周期方法，确保入口层 `finally` 能真正释放资源
  - `finally` / cleanup 中的 `close()`、`dispose()`、`release()` 属于 best-effort；清理失败不得覆盖成功输出、原始错误 payload 或 exit code，若需暴露只能作为附加诊断信息
  - MCP 入口层：捕获 CordError，转换为 MCP 标准错误响应格式
  - 错误码命名规范：`CORD_SCAN_001`、`CORD_QUERY_001` 等

**D4. 日志策略：自研轻量 Logger**

- **决策：** 自研 debug/info/warn/error 四级 Logger，CLI 用 chalk 着色输出，MCP 通过 stderr
- **理由：** CORD 是 CLI 工具，日志面向终端输出（用户可读），不需要结构化 JSON；chalk v5+ 纯 ESM，与项目 ESM-first 一致
- **影响范围：** 全局，所有模块
- **实现要点：**
  - `src/utils/logger.ts` 提供统一 Logger
  - 四个级别：`debug`（默认隐藏）、`info`、`warn`、`error`
  - `CORD_DEBUG=1` 或 `--verbose` 启用 debug 级别输出
  - MCP Server 模式下日志输出到 stderr（避免污染 stdout 的 JSON-RPC 通信）

## Project Structure & Module Organization

**D5. 目录结构策略：按架构层分（Layered）**

- **决策：** 顶层按架构层组织，层内按功能域细分
- **理由：** CORD 的核心架构特征是「双入口共享 Service 层」，按层分组最直观体现此设计
- **影响范围：** 项目初始化、所有开发活动
- **目录结构：**

```
src/
├── cli/                    # L3 CLI 入口层（薄壳）
│   ├── commands/           # Commander.js 命令定义
│   │   ├── init.ts
│   │   ├── scan.ts
│   │   ├── query.ts
│   │   ├── impact.ts
│   │   ├── export.ts
│   │   └── status.ts
│   └── index.ts            # CLI 入口
├── mcp/                    # L3 MCP Server 入口层（薄壳）
│   ├── tools/              # MCP Tool 定义
│   │   ├── analyze-impact.ts
│   │   ├── query-relations.ts
│   │   ├── sync-docs.ts
│   │   ├── init-graph.ts
│   │   ├── add-relation.ts      # FR18/FR20 关系管理
│   │   ├── remove-relation.ts   # FR19/FR20 关系管理
│   │   └── deprecate-relation.ts # FR19/FR20 关系管理
│   └── server.ts           # MCP Server 入口
├── services/               # L2 Service 层（核心业务逻辑）
│   ├── init-service.ts
│   ├── scan-service.ts
│   ├── query-service.ts
│   ├── impact-service.ts
│   ├── relation-service.ts
│   ├── export-service.ts
│   └── status-service.ts
├── repositories/           # L1 Repository 层（数据访问）
│   ├── sqlite-graph-repository.ts # IGraphRepository 的 SQLite 实现
│   └── migrations/         # SQL 迁移脚本
├── scanner/                # 扫描引擎（策略模式）
│   ├── pipeline.ts         # remark 处理管道
│   ├── rules/              # 规则引擎策略
│   └── types.ts
├── adapters/               # 框架适配层（可插拔）
│   ├── framework/          # IFrameworkAdapter 接口 + 基类
│   │   ├── interfaces.ts
│   │   ├── abstract-base.ts
│   │   └── bmad/           # BMAD 适配模块
│   └── ide/                # IDE 适配层
│       ├── interfaces.ts
│       ├── claude-code.ts
│       ├── cursor.ts
│       ├── vscode-copilot.ts
│       └── codex-cli.ts
├── schemas/                # Zod schema 定义
├── utils/                  # 公共工具
│   ├── logger.ts
│   ├── errors.ts           # CordError 类层级
│   └── config-loader.ts    # 配置加载
└── types/                  # 全局类型定义
    ├── relations.ts        # 9 种关系类型
    ├── documents.ts
    └── graph.ts
```

## Configuration Management

**D6. 配置文件格式：YAML + JSON 双格式 + JSON Schema**

- **决策：** 同时支持 `cord.config.yaml`（推荐）和 `cord.config.json` 两种配置格式，加载优先级 YAML > JSON（同时存在时 YAML 优先）。提供 JSON Schema 供 IDE 验证和自动补全
- **理由：** CORD 用户群体（BMAD/Superpowers 用户）大量使用 YAML（frontmatter），YAML 为推荐格式；同时支持 JSON 格式以适配偏好 JSON 的开发者和自动化工具链。gray-matter 已在依赖中可复用 YAML 解析；JSON 使用 Node.js 内置 `JSON.parse` 零额外依赖
- **影响范围：** `cord init` 生成流程、配置加载模块
- **实现要点：**
  - `cord init` 默认生成 `cord.config.yaml` + `.cord/` 数据目录（可通过 `--format json` 生成 `cord.config.json`）
  - 配置加载策略：按 `cord.config.yaml` → `cord.config.json` 顺序检测，找到第一个即停止
  - JSON Schema 发布到 schemastore.org（后期），本地通过 YAML 文件头 `# yaml-language-server: $schema=...` 或 JSON `"$schema"` 字段引用
  - 配置项（9 项，对齐 PRD cord.config schema）：`projectName`（项目显示名，供导出快照等面向用户的输出优先使用，缺失时由调用方回退到项目根目录名）、`framework`（框架类型）、`ide`（IDE 类型）、`scanPaths`（扫描路径）、`excludePaths`（排除路径）、`confidenceThreshold`（影响分析最低置信度阈值，默认 0.50）、`relationTypes`（关系类型启用/禁用配置，9 个内置类型默认全部启用）、`adapters`（启用的框架适配模块）、`updateStrategies`（Story 4.3 引入：按文档类别配置更新策略，键为 docType，值为 `'auto' | 'suggest' | 'log_only'`，字段可整体省略，未命中类别统一回退到 `suggest`，允许自定义 docType 键）；所有配置项均可选，`cord init` 自动生成合理默认值
  - `cord init` 生成配置模板时，必须包含 `updateStrategies` 注释示例块，至少覆盖 `prd: auto`、`story: suggest`、`technical-research: log_only`
  - 对用户可见输出字段（例如快照中的 `project`）如需引入新的配置来源，必须先完成产品/架构裁决并将字段纳入 schema，再进入代码实现与测试；禁止以临时 fallback 逻辑替代未裁决契约

## CI/CD & Quality Gates

**D7. CI/CD 工作流：GitHub Actions**

- **决策：** GitHub Actions 作为唯一 CI/CD 平台
- **理由：** CORD 是 GitHub 开源项目，与 semantic-release / npm provenance 原生集成
- **影响范围：** 发布流程、PR 质量门禁
- **实现要点：**
  - PR 检查：lint + type-check + test + coverage
  - 发布流程：semantic-release 为唯一发布 owner（自动化版本 + npm publish + GitHub Release）
  - Release workflow 权限：必须同时声明 `permissions.id-token: write`（npm provenance OIDC）和 `permissions.contents: write`（GitHub Release / tags 创建）；显式声明任意权限时，未声明权限收缩为 `none`
  - 跨平台矩阵：ubuntu / macos / windows（better-sqlite3 native addon 验证）
  - npm provenance 从第一天启用
  - 发布工具版本约束：升级 `semantic-release` / `@semantic-release/*` 后，必须核对 lockfile 中 `engines.node`，并确保 release workflow 的 `actions/setup-node` 版本满足要求；CI/cross-platform 可按运行需求独立选择 Node 基线
  - semantic-release 提交版本变更时，`@semantic-release/git` 的 `assets` 必须包含 `CHANGELOG.md`、`package.json`、`package-lock.json`，避免 `npm ci` 因 lockfile 漂移失败
  - Release workflow 应显式依赖 CI 质量门禁成功（`workflow_run`、同工作流 `needs` 或等效机制）；若暂不串联，必须记录为工程加固 TODO/豁免
  - Release workflow 应配置 `concurrency` 串行化发布任务，通常按 workflow + ref 分组且 `cancel-in-progress: false`
  - 避免用宽泛 `contains(head_commit.message, '[skip ci]')` 跳过 release；如需跳过，必须窄化到 semantic-release 版本提交或 bot actor
  - PR 模板中的质量门禁必须写成可执行命令，覆盖率校验使用项目实际脚本（当前为 `npm run test:coverage`）

**D8. 代码覆盖率目标：80%+**

- **决策：** 整体行覆盖率 ≥ 80%，核心 Service 层和 Scanner 引擎要求更高
- **理由：** MVP 阶段务实为主，核心引擎高标准，入口层薄壳可宽松
- **影响范围：** 测试策略、CI 质量门禁
- **分级要求：**
  - Service 层 + Scanner 引擎：≥ 90%（核心业务逻辑）
  - Repository 层：≥ 85%（数据访问关键路径）
  - CLI / MCP 入口层：≥ 70%（薄壳，主要是参数转发）
  - Adapters 层：≥ 80%（适配逻辑需可靠）
  - 测试 helper、fixture、in-memory repository 若生成时间戳、递增序列或其他单调数据，必须使用“固定基准值 + 数值偏移”而非字符串拼接；相关回归至少覆盖一条跨位数边界（如 9→10），避免测试基础设施先于业务断言失效

## Decision Impact Analysis

**Implementation Sequence:**

1. D5 目录结构 → 项目骨架搭建（第一个 Story）
2. D3 Error 类 + D4 Logger → 基础设施层（所有模块依赖）
3. D1 Zod Schema → 数据验证层（Service 层依赖）
4. D2 数据迁移 → 存储层初始化（Repository 依赖）
5. D6 配置管理 → `cord init` 功能实现
6. D7 CI/CD → 首次发布前就绪
7. D8 覆盖率 → CI 质量门禁配置

**Cross-Component Dependencies:**

- D1 (Zod) ↔ D3 (Error): 验证失败时抛出 `CordError` 子类，两者需协同设计
- D5 (目录结构) → D1/D2/D3/D4: 目录结构决定了其他所有模块的物理位置
- D6 (YAML 配置) ↔ D1 (Zod): 配置文件加载后通过 Zod schema 验证
- D7 (CI/CD) ↔ D8 (覆盖率): CI 流水线集成覆盖率检查门禁

---

## D9. AGENTS.md 为 NFR12 零侵入的 appendable 例外文件

- **决策：** `AGENTS.md` 是 Copilot 与 Codex CLI 的共享指令文件，被显式声明为 NFR12 零侵入策略的 appendable 例外共享文件。
- **理由：** `AGENTS.md` 不属于任一 IDE 专属配置（如 `.vscode/settings.json`、`.claude/settings.json`），而是 Copilot + Codex CLI 两个 IDE 共同依赖的共享文件。如果对其强制当作严格零侵入文件（不允许修改），两个 IDE 适配器将无法协同写入，导致 FR31 交付无法完成。
- **影响范围：** IDE 适配器层、InitService 层、测试策略
- **实现要点：**
  - **create-if-absent**：`AGENTS.md` 不存在时创建，写入 CORD 所需内容
  - **preserve-if-exists**：`AGENTS.md` 已存在时保留原内容，以 `<!-- CORD:START -->...<!-- CORD:END -->` 注释边界追加 CORD 专属配置段
  - **explicit-conflict**：格式不兼容时，返回 `AGENTS_MD_CONFLICT` 结构化错误，不自动覆盖（非 TTY 场景同样适用）
  - SHA-256 零侵入校验分为两类：居正不变（所有其他 IDE 专属配置文件） vs CORD 注释段外不变（`AGENTS.md`）
  - 此决策与 `04-implementation-patterns-consistency-rules.md` P18、`project-context.md` IDE 适配器模式章节、Story 5.3 共享文件处理契约互为镜像（Rule Document Registry 同步已完成）

---

## D10. 生命周期重绑定策略：双向唯一最优，歧义降级为 delete + add

- **决策：** 增量扫描在根据 `contentHash`、路径、basename 等弱身份信号推断 rename / move 时，只能在 stored 侧与 current 侧均形成唯一最优匹配的前提下复用既有 `docId`；任何并列或多候选歧义一律降级为 delete + add。
- **理由：** 图谱节点身份正确性高于“稳定但任意”的路径复用。若用 FIFO、数组顺序或字典序强行打破并列，虽然结果确定，但可能把错误 `docId` 绑定到错误路径，破坏 sync state 与关系图的一致性。
- **影响范围：** `src/scanner/lifecycle-detector.ts`、`ScanService` 的增量消费路径、生命周期回归测试策略
- **实现要点：**
  - 可使用同目录、同 basename、basename 编辑距离、路径距离等语义信号构造评分
  - **禁止**使用 FIFO `shift()`、数组顺序或字典序 tiebreaker 作为最终身份绑定依据
  - 未形成双向唯一最优匹配时，保留 unmatched stored/current，并在上层表现为 delete + add
  - 测试必须成对覆盖“存在稳定语义信号时可消歧”与“真正歧义时降级”两类场景
  - 此决策与 `_bmad-output/project-context.md` 的 `CR-SCAN-01`、`04-implementation-patterns-consistency-rules.md` 的 `P31` 互为镜像（Rule Document Registry 同步已完成）

  ---

  ## D11. 多跳查询遍历语义与性能验收必须分离输出过滤、避免无关坏边解析，并命中真实热路径

  - **决策：** 所有基于关系图的多跳查询必须把“可扩展边”与“可输出边”分离建模；当一条边既不输出也不继续扩展时，必须在解析端点前跳过。若结果契约是“受影响文档集合”而非通用关系列表，必须直接建模定向传播语义，在扩展前应用状态/置信度/方向约束，并按文档去重且排除 source self。涉及扩展性 AC 的性能测试必须证明规模差异进入被测热路径；若内存索引、fixture 或 mock 无法代表真实查询成本，必须补真实 repository 路径验证。
  - **理由：** 把输出过滤直接用于 BFS / DFS 裁剪，会漏报经非匹配中间边可达的深层结果；对无关边过早解析端点，会让坏数据阻断本应成功的过滤查询；若把受影响文档分析实现为“通用双向查询 + 后过滤”，会误报上游文档、放大低置信路径、副作用性地把 source self 回写进结果，并让文档计数失真；只扩大图总量却不改变实际访问局部子图，会对性能 AC 产生假阳性。
  - **影响范围：** `QueryService`、`ImpactService`、后续关系图遍历服务、查询与性能回归测试策略
  - **实现要点：**
    - `type`、标签等过滤只控制输出；可扩展边由 `includeDeprecated`、方向、深度、状态等路径语义决定
    - 在遍历循环中先计算 `hopDistance`、`shouldOutput`、`shouldExpand`；当 `!shouldOutput && !shouldExpand` 时直接跳过，不解析 relation 端点
    - 对 impact / affected-doc 类分析，禁止先执行通用双向查询再后过滤；路径级资格（如 `status`、`confidence`、方向）必须在扩展前判断
    - 若结果基数按文档而非关系命中统计，必须按 impacted document 聚合去重；source self 不得回流进结果；多路径命中同一文档时如需保留关系元数据，必须定义稳定候选优先级
    - 测试必须成对覆盖“经非匹配中间边仍可命中深层匹配关系”与“非匹配缺失端点边不阻断过滤查询”
    - impact / affected-doc 回归测试还必须覆盖：反向边不误报、低置信桥接边不继续扩展、自环/回源环不回写源文档、多路径命中同一文档只计一次
    - 性能验收必须至少有一条用例让规模差异进入实际热路径；必要时增加真实 repository 路径验证，而不只依赖内存索引 benchmark
    - 环境敏感但不影响运行时正确性的 benchmark 抖动可记录为 CR TODO，不得替代热路径验证
  - **镜像同步：** 此决策与 `_bmad-output/project-context.md` 的 `CR-QUERY-05`、`CR-QUERY-06`、`CR-QUERY-07`、`CR-PERF-01` 以及 `04-implementation-patterns-consistency-rules.md` 的 `P36`、`P37`、`P38`、`P39` 互为镜像（Rule Document Registry 同步已完成）

## D12. 收敛保护与来源优先级必须在“真实人工路径”和“前置裁剪阶段”同时成立

- **决策：** 当关系图存在“人工修正覆盖自动结果”的业务语义时，人工修正必须落成扫描保护可识别的持久化信号；同时，任何进入持久化前的关系去重或候选裁剪，都必须先比较业务来源优先级，再比较 `confidence` 等次级指标。
- **理由：** 如果人工修正只停留在调用层语义，而没有落成统一持久化信号，增量扫描和 rebuild 保护路径会误删或恢复用户已经修正过的关系；如果前置 dedupe 先按 `confidence` 裁剪，同批次更高优先级的 `framework_preset` / `manual` 候选会在进入最终写入逻辑前被提前淘汰，导致全局来源优先级失效。
- **影响范围：** `RelationService`、`ScanService`、关系来源优先级函数、增量扫描/重建保护逻辑、相关单元与集成回归测试
- **实现要点：**
  - 对外暴露“人工修正”能力的 service 必须把人工语义写成跨流程可复用的持久化信号（如 `source='manual'` 或等价标记），禁止只依赖调用约定或局部临时状态
  - 删边保护、写回冲突处理、rebuild 警告等路径必须使用同一套人工修正判定标准，避免保护逻辑分叉
- 对同一业务键的候选关系，前置 dedupe / merge 必须先比较来源优先级，仅在同来源内再比较 `confidence`
- 前置裁剪与最终持久化必须共享同一 priority 函数或等价实现，禁止两套规则漂移
- 测试必须覆盖两类真实风险：自动关系经手动修正后再次扫描仍被保留；同批次中低优先级候选 `confidence` 更高时，最终仍保留高优先级候选
- **镜像同步：** 此决策与 `_bmad-output/project-context.md` 的 `CR-SCAN-02`、`CR-SCAN-03` 以及 `04-implementation-patterns-consistency-rules.md` 的 `P42`、`P43` 互为镜像（Rule Document Registry 同步已完成）

## D13. MCP Tool 的共享 I/O 契约以 CLI JSON DTO 为最终真源

- **决策：** 对同一业务能力同时暴露 CLI `--json` 与 MCP Tool 时，`src/mcp/tools/schemas.ts` 中的命名 Zod input/output schema 必须直接镜像现有 CLI JSON / Service DTO；MCP 层不得自行裁剪字段、改名或额外发明平行 DTO。
- **理由：** Epic 5 的 NFR13 要求 CLI 与 MCP 对相同输入返回语义一致的输出。如果把 MCP Tool 当作“更轻量的包装”另起字段子集，会让 `query_relations` 的 `depth` / `hopDistance`、`analyze_impact` 的 `severity` / `hopDistance`、`init_graph` 的 `durationMs` 等既有契约再次漂移，并把 `sync_docs` 的建议语义拆成第二套不稳定映射。
- **影响范围：** `src/mcp/tools/schemas.ts`、4 个核心 MCP Tools、CLI JSON 契约测试、后续 Story 5.2 新增 Tool 的 schema 冻结策略
- **实现要点：**
  - `query_relations` 继续复用 `depth` 输入，并保留 `relationId`、`hopDistance` 输出
  - `analyze_impact` 保留 `severity`、`hopDistance`，不退化为纯文本建议列表
  - `init_graph` 直接镜像 `ScanResult`，输出字段名固定为 `durationMs`
  - `sync_docs.reason` 直接取 `AnalyzeImpactResult.suggestedAction`，`action` 仅由 `updateStrategy` 推导
  - schema 回归测试必须冻结已有 4 个 Tool 的 input/output JSON Schema，避免 Story 5.2 继续扩展时破坏既有合同
- **镜像同步：** 此决策与 `_bmad-output/project-context.md` 的 `CR-MCP-01` 以及 `04-implementation-patterns-consistency-rules.md` 的 `P44` 互为镜像（Rule Document Registry 同步已完成）

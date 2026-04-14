---
Epic: 1
Scope: epic
Round: 1
Date: 2026-04-13
Model Used: GPT-5.4 (gpt-5.4)
Type: Story Review Summary
Stories Reviewed: 5
---

## 审查结论

首轮审查。共审查 Epic 1 下 5 个 Story。审查层状态：3/3 层完成。

- 通过：0 个
- 有条件通过：1 个
- 硬阻塞：4 个

总体判断：**Epic 1 当前不适合直接进入开发。** Story 顺序和大体职责划分已经接近可实施状态，但基础契约仍在关键位置漂移：依赖版本与配置文件形式未收敛、MCP 入口骨架不完整、SQLite 迁移模型没有唯一答案、CI/CD 与覆盖率门禁的完成标准也未闭环。建议先处理 4 个硬阻塞 Story，再交给开发代理实施。

## 审查范围

- Story 文件：
  - `_bmad-output/implementation-artifacts/stories/1-1-project-initialization-and-directory-structure.md`
  - `_bmad-output/implementation-artifacts/stories/1-2-corderror-error-handling-and-logger-system.md`
  - `_bmad-output/implementation-artifacts/stories/1-3-zod-validation-layer-and-core-type-definitions.md`
  - `_bmad-output/implementation-artifacts/stories/1-4-sqlite-storage-layer-and-data-migration.md`
  - `_bmad-output/implementation-artifacts/stories/1-5-ci-cd-pipeline-and-quality-gates.md`
- 对照基准：
  - `_bmad-output/project-context.md`
  - `_bmad-output/planning-artifacts/epics/epic-1工程就绪开发者可开始编写功能代码.md`（已分片，本次以 Epic 1 分片文件为准）
  - `_bmad-output/planning-artifacts/architecture/03-core-architectural-decisions.md`
  - `_bmad-output/planning-artifacts/architecture/04-implementation-patterns-consistency-rules.md`
  - `_bmad-output/planning-artifacts/architecture/05-project-structure-boundaries.md`
- 审查维度：
  - 结构完整性
  - AC 可测性
  - 与 Epic 一致性
  - 与架构文档一致性
  - Story 间冲突与依赖
  - 任务拆分合理性
  - 交互/认证/安全/性能口径
  - 跨 Epic 共享契约

## 新发现

### 1. [高] Story 1.1 / 1.2 将终端着色契约从 chalk 漂移到 picocolors
- **来源**：consistency+contract
- **分类**：patch
- **涉及 Story**：1-1, 1-2
- **证据** - Story 1.1 的依赖清单仍把 `picocolors` 列为核心依赖；Story 1.2 的 AC、Task 3.4 和 Logger 实现说明继续要求 `picocolors`；但 `project-context.md` 与 D3/D4 已统一锁定 `chalk v5+`。
- **影响** - 如果按当前文档实施，Epic 1 会在最基础的 CLI/MCP 输出契约上落地错误依赖，后续错误格式化、日志着色和导入示例都会持续偏离全局规则。
- **建议** - 统一把 Story 1.1 和 1.2 中所有 `picocolors` 改为 `chalk`，同步修正文档里的依赖表、AC、任务、示例代码和导入排序说明。

### 2. [高] Story 1.1 / 1.3 继续保留 Zod v4 分支，破坏 schema 层唯一前提
- **来源**：consistency+contract
- **分类**：patch
- **涉及 Story**：1-1, 1-3
- **证据** - Story 1.1 允许在 `zod@^3.24` 与 `zod@^4.3` 之间选择；Story 1.3 继续保留“如果 Story 1.1 选择了 Zod v4.x”的实现分支；而 `project-context.md` 与 D1 已锁定 Zod v3.x。
- **影响** - Schema API、`zod-to-json-schema` 兼容性和错误封装语义都失去唯一答案，开发代理无法按单一标准完成 Story 1.1 和 1.3。
- **建议** - 将 Epic 1 所有 Zod 版本描述收敛为 `v3.x`，删除 Story 1.1 与 1.3 中的 v4 分支说明。

### 3. [高] Story 1.1 任务未把 `src/mcp/server.ts` 作为必交付入口，双入口骨架不完整
- **来源**：structure+consistency+contract
- **分类**：patch
- **涉及 Story**：1-1
- **证据** - Task 2 只要求创建 `src/mcp/index.ts`；但 `tsup.config.ts` 示例、`03-core-architectural-decisions.md` 和 `05-project-structure-boundaries.md` 都把 `src/mcp/server.ts` 定义为 MCP Server 正式入口。
- **影响** - 双入口共享 Service 的基础骨架在 Story 1.1 就已缺口，后续 Logger/MCP/CI 相关 Story 会建立在不完整入口结构上。
- **建议** - 在 AC 与 Task 中显式增加 `src/mcp/server.ts` 最小薄壳入口；`src/mcp/index.ts` 仅保留为门面文件。

### 4. [高] Story 1.4 在 `schema_version` 与 `schema_migrations` 之间没有单一迁移状态模型
- **来源**：structure+consistency+contract
- **分类**：decision_needed
- **涉及 Story**：1-4
- **证据** - AC #5 规定 runner 要“检测 `schema_version` 并按序执行待执行迁移”；Dev Notes 的 SQL 示例却创建 `schema_migrations(version, applied_at)` 历史表。
- **影响** - 迁移 runner、回滚策略、后续 schema 状态查询和测试设计都没有唯一实现方向，Story 1.4 不能直接进入开发。
- **建议** - 先裁决迁移状态模型：要么坚持单值 `schema_version`，要么改为历史表 `schema_migrations`；随后同步修正 AC、任务、Dev Notes 和架构文档。

### 5. [高] 迁移脚本命名 `001_initial.sql` 与 `001-initial-schema.sql` 在基线与 Story 1.4 之间冲突
- **来源**：consistency+contract
- **分类**：decision_needed
- **涉及 Story**：1-4
- **证据** - `project-context.md` 与 `03-core-architectural-decisions.md` 使用 `001_initial.sql` / `002_add_index.sql`；`05-project-structure-boundaries.md`、`epics.md` 与 Story 1.4 使用 `001-initial-schema.sql`。
- **影响** - 迁移脚本命名没有单一契约，未来迁移扫描、脚本排序和文档引用都会继续分叉。
- **建议** - 选定唯一迁移命名规则，并按 Rule Document Registry 同步更新 `_bmad-output/project-context.md`、`03-core-architectural-decisions.md`、`04-implementation-patterns-consistency-rules.md` 及相关 Story 文档。

### 6. [高] Story 1.3 的验证错误映射既允许“对应子类”又在示例中固定 `ConfigError`
- **来源**：structure+consistency
- **分类**：decision_needed
- **涉及 Story**：1-3
- **证据** - AC #6 写的是“抛出 CordError 子类（ConfigError 或对应子类）”；但示例 helper 固定 `throw new ConfigError(...)`，没有给出 config、scan、query、impact 等场景的明确映射规则。
- **影响** - D3 错误层级失去稳定边界，开发与测试都无法判断不同 schema 失败时应归属于哪一类错误。
- **建议** - 明确错误映射策略并写死到 AC、Dev Notes 与测试要求中，例如“所有 schema 解析失败统一为 ConfigError”或“按输入域映射到固定子类”。

### 7. [高] Story 1.5 允许 release workflow 以“占位”完成，和工程就绪目标不兼容
- **来源**：structure+consistency+contract
- **分类**：patch
- **涉及 Story**：1-5
- **证据** - AC #2 允许 `.github/workflows/release.yml` “可暂为占位”；但 D7 已把 `semantic-release + npm publish + GitHub Release` 定义为正式 CI/CD 方案，`project-context.md` 还要求 npm provenance 从第一天启用。
- **影响** - Epic 1 可能在没有可执行发布链路的情况下被标记完成，与“工程就绪”目标直接冲突。
- **建议** - 删除“可暂为占位”表述，把最小可执行 release workflow 的必备元素写清楚：触发条件、权限、semantic-release、npm publish、GitHub Release 和 provenance。

### 8. [高] Story 1.5 把 D8 分层覆盖率门禁降格为“后续细化”，与基线未对齐
- **来源**：contract
- **分类**：decision_needed
- **涉及 Story**：1-5
- **证据** - Story 1.5 虽复述了 D8 的分层阈值，但又写“CI 门禁当前阶段设整体 >= 80%，后续根据分层目标细化”；而 D8 与 `project-context.md` 已给出分层门禁目标。
- **影响** - 开发与 CI 实施无法判断 Epic 1 应只校验总覆盖率，还是同步执行 Service/Repository/CLI/MCP 的分层阈值。
- **建议** - 先决定 Epic 1 是否允许分阶段放宽覆盖率策略；若允许，需同步修订 D8 与 `project-context.md`；若不允许，就删除“后续细化”的降级语句。

### 9. [中] Story 1.5 的 AC7 依赖远端 push 成功且弱化 AC1 检查链，无法在 Story 级闭环验收
- **来源**：structure+consistency+contract
- **分类**：patch
- **涉及 Story**：1-5
- **证据** - AC #7 写成“本地推送代码后 CI 管道可成功执行（至少 lint + test 通过）”；这既依赖 GitHub Actions 远端结果，又把 AC #1 的 `lint -> type-check -> test -> coverage` 缩水成“至少 lint + test”。Tasks 也只覆盖本地命令和 YAML 语法。
- **影响** - Story 1.5 的完成标准不可在文档层闭环，也会把既定的质量门禁口径向下回退。
- **建议** - 将 AC #7 改为本地可验证的工作流契约与命令链，例如要求 `lint + type-check + test --coverage` 通过，并把真实 Actions run 改为额外验收证据而非 Story 完成前置条件。

### 10. [中] Story 1.1 仍保留被禁止的 ESLint 配置分支，和全局 flat-config 契约不一致
- **来源**：consistency+contract
- **分类**：patch
- **涉及 Story**：1-1
- **证据** - Story 1.1 同时保留 ESLint 9 + `.eslintrc.cjs`、ESLint 10 + `eslint.config.ts` 等路径；`project-context.md` 已要求 flat config，并固定为 `eslint.config.js`。
- **影响** - 初始化 Story 可能产出多个互斥 lint 配置方案，直接影响后续 Story 1.5 的 CI 实施口径。
- **建议** - 收敛为单一 flat-config 方案；若团队想改用 `eslint.config.ts`，必须先同步更新基线规则文件。

## 逐篇审查结论

### Story 1.1: 项目初始化与目录结构搭建

**结论：硬阻塞**

**优点**
- 已覆盖项目骨架、构建、测试、lint、fixtures 和门面文件等基础交付面。
- Story 顺序与 Epic 1 的依赖链基本合理，适合作为后续 Story 的起点。

**关键问题**
1. **基础依赖与配置契约未收敛** — `chalk/picocolors`、Zod 主版本、ESLint 配置形式同时出现互斥方案，无法形成单一实施标准。
2. **MCP 入口文件缺失** — 任务没有把 `src/mcp/server.ts` 作为必交付入口，双入口骨架不完整。

**建议动作**
- 先把依赖与配置方案收敛为唯一选项，再补齐 `src/mcp/server.ts` 的 AC 与任务。

### Story 1.2: CordError 错误处理体系与 Logger 日志系统

**结论：硬阻塞**

**优点**
- CordError 层级、Logger 四级模型和 CLI/MCP 输出分流方向是对的。
- 单元测试范围定义比较具体，具备可实施基础。

**关键问题**
1. **颜色库仍沿用错误契约** — 文档仍以 `picocolors` 为前提，与全局 `chalk` 规则冲突。
2. **入口职责边界仍不够清晰** — Logger 文档仍倾向自行探测 CLI/MCP 模式，容易把入口层职责下沉到 utils。

**建议动作**
- 与 Story 1.1 一起统一为 `chalk`，并把运行模式改成由 CLI/MCP 入口显式注入。

### Story 1.3: Zod 统一验证层与核心类型定义

**结论：有条件通过**

**优点**
- 类型层与 schema 层拆分清晰，并提前考虑了 JSON Schema 导出能力。
- 整体交付面与后续 MCP Tool 输入验证的演进方向一致。

**关键问题**
1. **Zod 前提依赖于上游未收敛决策** — 仍保留 v4 分支描述。
2. **错误映射规则不唯一** — AC 允许“对应子类”，示例却固定 `ConfigError`。
3. **示例导入违背门面规则** — helper 示例直接导入 `../utils/errors.js`。

**建议动作**
- 在 Story 1.1 的版本收敛后，明确错误映射策略，并把示例导入改为通过 `src/utils/index.ts` 门面。

### Story 1.4: SQLite 存储层与数据迁移机制

**结论：硬阻塞**

**优点**
- Repository、mapper、migration runner 和测试范围拆分较清楚。
- sync 模式、WAL、snake_case ↔ camelCase 边界总体符合架构方向。

**关键问题**
1. **迁移状态模型不唯一** — `schema_version` 与 `schema_migrations` 并存。
2. **迁移脚本命名规则未定** — 下划线和连字符两套规则同时存在。

**建议动作**
- 先完成迁移模型与命名规范裁决，再统一 Story 1.4、Epic 与规则文档后进入开发。

### Story 1.5: CI/CD 管道与质量门禁

**结论：硬阻塞**

**优点**
- GitHub Actions 工作流、Issue 模板和 PR 模板的大体文件位置与结构文档一致。
- 覆盖率、release、cross-platform 与 provenance 都已进入设计视野，没有遗漏关键功能域。

**关键问题**
1. **release workflow 可以“占位”** — 不满足工程就绪要求。
2. **AC7 不可在 Story 级闭环验证** — 依赖远端 push 成功且弱化质量门禁链路。
3. **覆盖率门禁口径漂移** — D8 已有分层阈值，Story 却写成后续细化。

**建议动作**
- 重写 release 与验收标准，先固定 coverage policy，再把 CI Story 定义成可在文档层直接验收的最小可执行工作流。

## 通过项
- Epic 1 的 Story 顺序 `1.1 -> 1.2 -> 1.3 -> 1.4 -> 1.5` 基本合理，未发现明显循环依赖。
- Story 1.4 对 Repository 同步模式、mapper 转换边界和 WAL 方向的定义总体符合 P1 / P8 / P13。
- Story 1.5 对 `.github/workflows/`、`.github/ISSUE_TEMPLATE/` 与 `.github/PULL_REQUEST_TEMPLATE.md` 的文件落点基本对齐结构文档。
- 已知既有问题，非本次单一 Story 引入：`tests/fixtures/sample-project/` 与 `sample-projects/` 在基线文档间未统一，建议作为文档统一项单独处理。

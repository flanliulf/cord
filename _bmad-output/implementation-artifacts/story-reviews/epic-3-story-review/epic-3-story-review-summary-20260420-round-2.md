---
Epic: 3
Scope: epic
Round: 2
Date: 2026-04-20
Model Used: GPT-5.4 (gpt-5.4)
Type: Story Review Summary
Stories Reviewed: 5
---

## 审查结论

第 2 轮复审。共审查 Epic 3 下 5 个 Story。审查层状态：3/3 层完成。

- 通过：0 个
- 有条件通过：2 个
- 硬阻塞：3 个

总体判断：round-1 的 7 条 P1 修订中，4 条已实质闭合，3 条属于“修订不完整仍遗留”；同时本轮识别出 2 条由修订引入的新一致性问题。Epic 3 相比首轮明显收敛，但仍不建议进入开发，需先补齐 3.3、3.4、3.5 的剩余核心契约，再做下一轮复审。

## 审查范围

- Story 文件：
  - `3-1-queryservice-relation-query-one-hop-and-type-filter.md`
  - `3-2-multi-hop-relation-traversal.md`
  - `3-3-impactservice-change-impact-analysis.md`
  - `3-4-json-snapshot-export.md`
  - `3-5-statusservice-health-check.md`
- 对照基准：
  - `_bmad-output/project-context.md`
  - `_bmad-output/planning-artifacts/prd.md`
  - `_bmad-output/planning-artifacts/epics/epic-3关系查询影响分析与数据导出.md`
  - `_bmad-output/planning-artifacts/architecture/03-core-architectural-decisions.md`
  - `_bmad-output/planning-artifacts/architecture/04-implementation-patterns-consistency-rules.md`
  - `_bmad-output/implementation-artifacts/stories/1-2-corderror-error-handling-and-logger-system.md`
  - `_bmad-output/implementation-artifacts/stories/1-4-sqlite-storage-layer-and-data-migration.md`
- 审查维度：
  - 结构完整性
  - AC 可测性
  - 与 Epic 一致性
  - 与架构文档一致性
  - Story 间冲突与依赖
  - 任务拆分合理性
  - 交互/认证/安全/性能口径
  - 跨 Epic 共享契约

## 上轮问题回顾

### 已修复
1. Round 1 / Finding #6 — Story 3.5 缺少 FR5 的配置状态展示
   - `StatusResult` 已新增 `configFilePath`、`framework`、`scanPaths`、`excludePaths`、`confidenceThreshold`，AC 2 和 Task 1 也已补入配置状态展示要求。
   - 验证结果：原先“完全没有配置状态字段”的缺口已关闭。

2. Round 1 / Finding #7 — Story 3.1 错误契约弱化，缺少 `code` + `suggestion`
   - AC 8 已改为 `QueryError extends CordError` 且要求 `code` 与 `suggestion`，Task 4 也加入了字段验证。
   - 验证结果：原先 AC 层面对 NFR19 的直接回归已修复。

3. Round 1 / Finding #10 — Story 3.3 丢失“置信度阈值可配置”约束
   - AC 4 已补回“可通过配置调整”，并新增 `ImpactInput.confidenceThreshold?`。
   - 验证结果：原先“硬编码 0.50 也可过 AC”的缺口已关闭。

4. Round 1 / Finding #5 — Story 3.5 的 danglingEdges 与 CASCADE 模型冲突
   - `danglingEdges` 现已被明确标注为防御性完整性检查，正常分支预期返回 0。
   - 验证结果：该项已从潜在阻塞降为已解释的防御性检查，不再构成本轮阻塞。

### 仍为非阻塞待办
1. Round 1 / Finding #8 — Story 3.1 的“目标文档路径”字段与双向查询语义冲突
   - 维持既有评估结论。当前 Story 仍未把字段改为中性命名或补充方向字段，但该问题暂不阻断本轮继续收敛主契约。

2. Round 1 / Finding #9 — Story 3.2 多跳结果去重与最短跳数规则未闭合
   - 维持既有评估结论。该问题仍存在，但在本轮仍属于可通过补充 AC/测试解决的非阻塞待办。

3. Round 1 / Finding #11 — Story 3.4 导出输入与 CLI 行为口径未闭合
   - 维持既有评估结论。默认文件名、覆盖策略和 stdout/文件写入关系仍未闭合，但当前优先级仍低于共享仓储契约和版本语义问题。

## 新发现

### 1. [高] 上轮遗留 - 3.3 固定三跳边界仍未形成可验收且统一的 QueryService 契约
- **来源**：structure+consistency+contract
- **分类**：patch
- **涉及 Story**：3-3
- **证据** - Story 3.3 新增了“v0.1 固定三跳、不对外暴露 depth”的裁决，但该约束只存在于 Dev Notes，AC 与 Tasks 仍未把三跳边界和禁止暴露 depth 写成显式验收条件；同时 3.3 写成复用 `QueryService.query()` 的多跳能力，而 3.2 仍以 `queryMultiHop` 形态描述多跳入口。
- **影响** - 上轮“影响分析边界未定义”的核心缺口并未真正闭合，且当前 QueryService 的共享入口再次出现分裂，实现者无法确定 3.3 该复用哪一个稳定接口。
- **建议** - 在 [3-3-impactservice-change-impact-analysis.md] 中把“内部固定 3 跳、CLI 不暴露 depth、测试覆盖该边界”提升为 AC 与任务；同时与 [3-2-multi-hop-relation-traversal.md] 对齐单一的多跳服务入口名称和参数对象。

### 2. [高] 上轮遗留 - 3.4 的 getAllRelations 扩展未同步到 1.4 源仓储契约
- **来源**：consistency+contract
- **分类**：patch
- **涉及 Story**：3-4
- **证据** - Story 3.4 通过 Task 0 和 Dev Notes 正式引入了 `IGraphRepository.getAllRelations()`，但 Story 1.4 的 AC、任务与接口代码块仍未同步该方法。
- **影响** - 当前文档集中出现两个版本的 IGraphRepository 契约。若不回写上游来源 Story，导出链路依赖的共享接口仍只是下游单方声明，无法形成稳定设计基线。
- **建议** - 将 `getAllRelations()` 同步补入 [1-4-sqlite-storage-layer-and-data-migration.md] 的 AC、任务和接口设计，再在 [3-4-json-snapshot-export.md] 中保留“依赖该共享接口”的引用关系。

### 3. [高] 上轮遗留 - 3.5 的 migrationVersion 仍未满足 D2 的双字段迁移状态要求
- **来源**：consistency+contract
- **分类**：patch
- **涉及 Story**：3-5
- **证据** - Story 3.5 将 `schemaVersion` 改为 `migrationVersion`，但 D2 仍要求 `cord status` 同时展示“当前已执行迁移版本数及最新版本号”。当前 Story 只保留一个 `migrationVersion:number` 字段，也未在共享仓储契约中定义迁移状态读取出口。
- **影响** - 修订只消除了名称冲突，没有补齐架构要求；status 依然无法完整表达迁移状态，且实现时可能被迫绕过共享仓储边界直接读取 `schema_migrations`。
- **建议** - 在 [3-5-statusservice-health-check.md] 中将迁移状态改为双字段结构，例如 `appliedMigrationCount` 与 `latestMigrationVersion`；并同步在 [1-4-sqlite-storage-layer-and-data-migration.md] 中补充对应读取能力。

### 4. [高] 上轮遗留 - 3.5 的过时关系判定仍缺少时间归一与 camelCase 边界约束
- **来源**：structure+contract
- **分类**：patch
- **涉及 Story**：3-5
- **证据** - Story 3.5 现在明确使用 `lastObservedMtimeMs` 与 `relation.created_at / relations.created_at` 比较，但前者是毫秒 `number`，后者在 Story 1.4 schema 中是 `TEXT` 时间戳；同时 Service 层语义里仍泄漏了数据库 snake_case 列名。
- **影响** - 当前 stale relation 判定没有统一可执行算法，开发者可能做出不同的时间解析和字段映射，导致结果不稳定且不可测。
- **建议** - 在 [3-5-statusservice-health-check.md] 中明确：Repository 先输出 camelCase 的 `relation.createdAt`，再由 Service 使用 `Date.parse(relation.createdAt)` 或等价方式统一到 UTC 毫秒后与 `lastObservedMtimeMs` 比较，并补充测试样例。

### 5. [中][新] 3.1 新增错误处理说明仍残留旧路径、旧构造签名和 picocolors 约定
- **来源**：consistency+contract
- **分类**：patch
- **涉及 Story**：3-1
- **证据** - Story 3.1 的 AC 已补上 QueryError 的 `code` 与 `suggestion`，但新增说明仍把 CordError 写成 `src/errors/cord-error.ts`、继续示例化为位置参数 `super(message, code, suggestion)`、错误码示例未对齐 `CORD_QUERY_NNN` 规范，同时架构约束里依然建议 CLI 使用 `picocolors`。
- **影响** - 开发实现会被拉回到已废弃的共享基线，导致错误类路径、构造签名、错误码规范和 CLI 着色四处同时漂移。
- **建议** - 将 [3-1-queryservice-relation-query-one-hop-and-type-filter.md] 的错误处理与 CLI 着色说明整体回收到 [1-2-corderror-error-handling-and-logger-system.md] 的真实共享契约：路径改为 `src/utils/errors.ts`，构造改为对象参数，错误码示例改为 `CORD_QUERY_001` 形态，颜色库统一为 `chalk`。

### 6. [中][新] 3.4 将 project 字段来源指向了不存在的配置项
- **来源**：consistency+contract
- **分类**：patch
- **涉及 Story**：3-4
- **证据** - Story 3.4 的新裁决写明 `project` 字段优先读取“配置文件中的项目名”，但 D6 与 PRD 的配置 schema 并不存在 `project` 或 `projectName` 配置项。
- **影响** - 该来源约束没有上游文档支撑，会迫使实现者自行扩展配置 schema 或临时忽略 Story 说明，从而制造新的文档漂移。
- **建议** - 若 v0.1 不扩展配置 schema，则在 [3-4-json-snapshot-export.md] 中将 `project` 字段来源统一收敛为项目根目录名；若确需从配置读取，则必须先同步更新 PRD、D6 和相关 Story。

## 逐篇审查结论

### Story 3.1: QueryService 关系查询（一跳 + 类型过滤）

**结论：有条件通过**

**优点**
- AC 已恢复 `QueryError`、`code`、`suggestion` 的核心错误契约。
- 查询主能力边界仍然清晰，一跳查询与类型过滤未出现新的功能性回退。

**关键问题**
1. **错误与 CLI 示例仍残留旧共享基线** — 旧路径、旧构造签名、旧颜色库约定仍未同步到当前架构规范。

**建议动作**
- 在 [3-1-queryservice-relation-query-one-hop-and-type-filter.md] 中统一回收旧示例，完全对齐 [1-2-corderror-error-handling-and-logger-system.md] 与全局 chalk 约束。

### Story 3.2: 多跳关系遍历

**结论：有条件通过**

**优点**
- Story 3.2 仍然保持清晰的依赖位置，能够支撑查询与影响分析链路。
- BFS 与深度限制的总体方向未出现新回退。

**关注点**
- 多跳结果去重与最短跳数规则仍属非阻塞待办，且本轮继续影响 3.3 的入口统一性。

### Story 3.3: ImpactService 变更影响分析

**结论：硬阻塞**

**优点**
- `confidenceThreshold` 的可配置约束已经补回。
- 固定三跳的设计方向使影响分析边界开始收敛。

**关键问题**
1. **固定三跳只停留在 Dev Notes** — AC/任务仍无法验证该边界。
2. **共享 QueryService 入口再次分裂** — 与 Story 3.2 的多跳入口描述不一致。

**建议动作**
- 在 [3-3-impactservice-change-impact-analysis.md] 中将三跳边界与内部调用方式提升为 AC，并和 [3-2-multi-hop-relation-traversal.md] 对齐单一服务入口。

### Story 3.4: JSON 快照导出

**结论：硬阻塞**

**优点**
- 已做出“通过 `getAllRelations()` 正式扩展共享仓储接口”的裁决。
- 导出结构与 P10 方向保持一致，没有回退到 Service 层临时拼接方案。

**关键问题**
1. **共享仓储接口只在下游 Story 声明** — `getAllRelations()` 尚未回写到 Story 1.4 源契约。
2. **project 来源引入了不存在的配置项** — 新裁决缺少上游 schema 支撑。

**建议动作**
- 先同步修订 [1-4-sqlite-storage-layer-and-data-migration.md] 的共享仓储接口，再回收 [3-4-json-snapshot-export.md] 中对 project 来源的表述。

### Story 3.5: StatusService 健康检查

**结论：硬阻塞**

**优点**
- 已明确区分导出快照 `schemaVersion` 与 status 侧迁移状态的概念。
- 已补入配置状态与近似 stale relation 判定方向，较首轮明显收敛。

**关键问题**
1. **迁移状态仍是半闭合** — 只保留了一个 `migrationVersion`，未满足 D2 的双字段要求。
2. **过时关系算法仍不可直接执行** — 时间单位、格式与层边界没有统一。

**建议动作**
- 在 [3-5-statusservice-health-check.md] 中补齐迁移状态双字段结构，并明确时间归一规则与 Repository/Service 边界。

## 通过项
- round-1 中关于错误契约、置信度可配置、配置状态展示、danglingEdges 防御性说明这四类核心修订已产生实质进展。
- Epic 3 的总体能力链路仍保持稳定，没有出现新的 Story 排序或功能范围回退。
- 所有本轮阻塞项都集中在文档契约闭环层，尚未扩散成更多新的设计方向分叉。

## 结论
- **结论**：不通过
- **阻塞项**：3.3 固定三跳边界未进入可验收契约；3.4 的 `getAllRelations()` 未同步到 1.4 源契约且 `project` 来源失真；3.5 的迁移状态和 stale relation 判定仍未闭合；3.1 新增说明仍残留旧错误与 CLI 基线。
- **建议**：先完成本轮 6 条发现的文档修订，再执行第 3 轮复审；其中优先顺序建议为 3.5 → 3.4 → 3.3 → 3.1。
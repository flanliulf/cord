---
Epic: 3
Scope: epic
Round: 2
Date: 2026-04-20
Model Used: Claude Opus 4.6 (claude-opus-4.6)
Review Source: epic-3-story-review-summary-20260420-round-2.md
Review Model: GPT-5.4 (gpt-5.4)
Type: Story Review Evaluation
---

## 评估总结

GPT-5.4 对 Epic 3 的第 2 轮复审质量继续保持高水平。审查准确识别了 round-1 修订后的 4 项已闭合改进，并发现了 4 条上轮遗留未完全闭合项和 2 条新引入的一致性问题，合计 6 条新发现。经独立交叉验证，6 条发现全部确认有效（0 误报）：4 条确认为 P1 阻塞项，2 条降级为 P2 后续改善跟踪。上轮问题回顾部分的判定也全部准确。相比首轮，Epic 3 已明显收敛——阻塞项从 7 条缩减至 4 条，且全部集中在文档契约闭合层面。

## 上轮问题回顾确认

### Round 1 / Finding #6 — Story 3.5 缺少 FR5 的配置状态展示：已确认修复

已验证 Story 3.5 的 `StatusResult` 接口现包含 `configFilePath`、`framework`、`scanPaths`、`excludePaths`、`confidenceThreshold` 五个配置状态字段，AC 2 也已补入"CORD 配置状态"展示要求。FR5 的配置侧缺口确已闭合。

### Round 1 / Finding #7 — Story 3.1 错误契约弱化：已确认修复

已验证 Story 3.1 AC 8 现明确要求 `QueryError extends CordError`，包含 `code` 和 `suggestion`，符合 NFR19 格式。Task 4 也补入了字段验证。AC 层面对 D3/NFR19 的直接回归已修复。

### Round 1 / Finding #10 — Story 3.3 丢失"置信度阈值可配置"：已确认修复

已验证 Story 3.3 AC 4 现包含"可通过配置调整，优先级：显式输入 > 配置文件 > 默认 0.50"，`ImpactInput` 接口也新增了 `confidenceThreshold?: number` 可选字段。与 Epic/PRD FR11/D6 的一致性已恢复。

### Round 1 / Finding #5 — Story 3.5 danglingEdges 与 CASCADE 冲突：已确认修复

已验证 Story 3.5 `StatusResult` 中 `danglingEdges` 字段现标注为"防御性完整性检查，正常分支预期返回 0"，语义已明确。该项不再构成阻塞。

### 历史非阻塞待办

1. **Round 1 / Finding #8 — "目标文档路径"字段与双向语义冲突**：确认仍为非阻塞。Story 3.1 AC 2 仍使用"目标文档路径"措辞，但该问题不阻断当前主契约收敛，维持 P2。
2. **Round 1 / Finding #9 — 多跳结果去重规则未闭合**：确认仍为非阻塞。Story 3.2 仍未明确去重单位，但 BFS 核心方向正确，维持 P2。
3. **Round 1 / Finding #11 — 导出输入与 CLI 行为口径未闭合**：确认仍为非阻塞。默认文件名、覆盖策略仍未定义，维持 P2。

## 发现 #1 评估

### 审查原文

> **[高] 上轮遗留 - 3.3 固定三跳边界仍未形成可验收且统一的 QueryService 契约**
> - 来源：structure+consistency+contract
> - 分类：patch
> - 涉及 Story：3-3
> - 证据 - Story 3.3 新增了"v0.1 固定三跳、不对外暴露 depth"的裁决，但该约束只存在于 Dev Notes，AC 与 Tasks 仍未把三跳边界和禁止暴露 depth 写成显式验收条件；同时 3.3 写成复用 `QueryService.query()` 的多跳能力，而 3.2 仍以 `queryMultiHop` 形态描述多跳入口。
> - 影响 - 上轮"影响分析边界未定义"的核心缺口并未真正闭合，且当前 QueryService 的共享入口再次出现分裂，实现者无法确定 3.3 该复用哪一个稳定接口。
> - 建议 - 在 [3-3-impactservice-change-impact-analysis.md] 中把"内部固定 3 跳、CLI 不暴露 depth、测试覆盖该边界"提升为 AC 与任务；同时与 [3-2-multi-hop-relation-traversal.md] 对齐单一的多跳服务入口名称和参数对象。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 已验证 Story 3.3 的 Dev Notes "遍历深度裁决（v0.1）" 章节确实写明"v0.1 固定三跳，暗定不对外暴露 `depth` 参数"，但 AC 1-8 没有任何一条提及"三跳"或"禁止暴露 depth"。此外，Dev Notes 写"复用 `QueryService.query()` 的多跳 BFS 逻辑（Story 3.2）"，而 Story 3.2 的 Dev Notes 中多跳入口是 `queryMultiHop(input: QueryInput & { depth: number })`——两处入口名称和参数结构确实不一致。
**严重性判断**：合理 — 三跳边界是 round-1 Finding #1（P1）的核心修订对象。修订只停留在 Dev Notes 而未进入 AC，意味着验收测试仍然无法覆盖该边界约束，round-1 的根本问题并未真正闭合。三来源命中（structure+consistency+contract）进一步增强了可信度。
**修订建议**：可行 — 将三跳固定提升为 AC（如新增 AC 条目"影响分析内部固定三跳遍历深度，v0.1 不对外暴露 depth 参数"），同时统一 3.2/3.3 的多跳入口描述。
**误报评估**：非误报 — AC 文本和 Dev Notes 已逐段比对，"只在 Dev Notes 未进入 AC"的判断准确。

## 发现 #2 评估

### 审查原文

> **[高] 上轮遗留 - 3.4 的 getAllRelations 扩展未同步到 1.4 源仓储契约**
> - 来源：consistency+contract
> - 分类：patch
> - 涉及 Story：3-4
> - 证据 - Story 3.4 通过 Task 0 和 Dev Notes 正式引入了 `IGraphRepository.getAllRelations()`，但 Story 1.4 的 AC、任务与接口代码块仍未同步该方法。
> - 影响 - 当前文档集中出现两个版本的 IGraphRepository 契约。若不回写上游来源 Story，导出链路依赖的共享接口仍只是下游单方声明，无法形成稳定设计基线。
> - 建议 - 将 `getAllRelations()` 同步补入 [1-4-sqlite-storage-layer-and-data-migration.md] 的 AC、任务和接口设计，再在 [3-4-json-snapshot-export.md] 中保留"依赖该共享接口"的引用关系。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 已验证 Story 1.4 的 IGraphRepository 接口定义确实没有 `getAllRelations()` 方法（有 `getAllDocuments()` 但关系侧缺失等价方法），而 Story 3.4 的 Task 0 明确写"在 `IGraphRepository` 接口中添加 `getAllRelations(): RelationEdge[]` 方法"、Dev Notes 也写了"正式扩展 IGraphRepository 添加 `getAllRelations()` 方法"。两份文档对同一接口的描述不一致，确实存在契约分裂。
**严重性判断**：合理 — Story 1.4 是 IGraphRepository 的权威定义来源。下游 Story 单方声明接口扩展而上游未同步，会在团队协作中造成混淆——开发者读 1.4 认为接口不含该方法，读 3.4 又发现需要。如果 Story 1.4 已经交付实现，还需要确认是新增方法还是修改既有接口。
**修订建议**：可行 — 将 `getAllRelations(): RelationEdge[]` 同步补入 Story 1.4 的接口定义、AC 和 Task 中。由于 1.4 可能已经完成开发（Status 未标注），修订应注明这是后续 Story 追加的接口扩展需求。
**误报评估**：非误报 — Story 1.4 接口定义已完整读取确认，确实缺失 `getAllRelations()`。

## 发现 #3 评估

### 审查原文

> **[高] 上轮遗留 - 3.5 的 migrationVersion 仍未满足 D2 的双字段迁移状态要求**
> - 来源：consistency+contract
> - 分类：patch
> - 涉及 Story：3-5
> - 证据 - Story 3.5 将 `schemaVersion` 改为 `migrationVersion`，但 D2 仍要求 `cord status` 同时展示"当前已执行迁移版本数及最新版本号"。当前 Story 只保留一个 `migrationVersion:number` 字段，也未在共享仓储契约中定义迁移状态读取出口。
> - 影响 - 修订只消除了名称冲突，没有补齐架构要求；status 依然无法完整表达迁移状态，且实现时可能被迫绕过共享仓储边界直接读取 `schema_migrations`。
> - 建议 - 在 [3-5-statusservice-health-check.md] 中将迁移状态改为双字段结构，例如 `appliedMigrationCount` 与 `latestMigrationVersion`；并同步在 [1-4-sqlite-storage-layer-and-data-migration.md] 中补充对应读取能力。

### 评估结论：⚠️ 有效但降级 — 建议纳入后续改善跟踪（P2）

### 评估分析

**问题描述准确性**：基本准确 — D2 原文"`cord status` 展示当前已执行迁移版本数及最新版本号"确实暗示了两个维度的信息。但需注意 D2 原文是"版本数及最新版本号"，而当前 `schema_migrations` 表结构中 version 是 INTEGER PRIMARY KEY（递增整数），因此"已执行迁移版本数"（COUNT）与"最新版本号"（MAX(version)）在语义上高度关联——如果迁移从 1 开始连续编号，两者值几乎等价。
**严重性判断**：偏高 — 审查将此标为[高]，但对于 v0.1 初始版本，`schema_migrations` 的迁移脚本从 001 开始连续编号（D2 实现要点），此时迁移版本数 = 最新版本号。单个 `migrationVersion` 字段（存储 MAX(version)）在当前阶段已能充分表达 D2 要求的两个维度。双字段拆分是面向未来的改进，但不构成当前阻塞。关于"共享仓储契约中未定义迁移状态读取出口"的观察是正确的——StatusService 确实需要某种方式从 Repository 层获取迁移信息。但这可通过 migration runner 暴露的查询方法解决，不一定需要扩展 IGraphRepository 本身。
**修订建议**：可行但非阻塞 — 建议在 Story 3.5 的 Dev Notes 中补充 `migrationVersion` 的具体读取路径（如 migration runner 的查询方法），但双字段拆分可延后至迁移策略变更时再处理。
**误报评估**：非误报 — D2 的双维度要求客观存在，但当前单字段在 v0.1 连续编号场景下已满足实质需求。

## 发现 #4 评估

### 审查原文

> **[高] 上轮遗留 - 3.5 的过时关系判定仍缺少时间归一与 camelCase 边界约束**
> - 来源：structure+contract
> - 分类：patch
> - 涉及 Story：3-5
> - 证据 - Story 3.5 现在明确使用 `lastObservedMtimeMs` 与 `relation.created_at / relations.created_at` 比较，但前者是毫秒 `number`，后者在 Story 1.4 schema 中是 `TEXT` 时间戳；同时 Service 层语义里仍泄漏了数据库 snake_case 列名。
> - 影响 - 当前 stale relation 判定没有统一可执行算法，开发者可能做出不同的时间解析和字段映射，导致结果不稳定且不可测。
> - 建议 - 在 [3-5-statusservice-health-check.md] 中明确：Repository 先输出 camelCase 的 `relation.createdAt`，再由 Service 使用 `Date.parse(relation.createdAt)` 或等价方式统一到 UTC 毫秒后与 `lastObservedMtimeMs` 比较，并补充测试样例。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 已验证三处不一致：(1) Story 3.5 过时关系判定口径写"报告关联文档的 `lastObservedMtimeMs`（最近一次扫描观测值）新于该关系的 `created_at`"——此处 `created_at` 是 snake_case 数据库列名；(2) Story 1.4 的 relations 表 schema 中 `created_at` 类型为 `TEXT NOT NULL DEFAULT (datetime('now'))`，输出是 SQLite datetime 字符串（如 `2026-04-20 10:00:00`），而 `lastObservedMtimeMs` 是毫秒级 `number`；(3) Story 1.4 的 mappers.ts 负责 snake_case → camelCase 转换（Task 3），Service 层应使用 `createdAt` 而非 `created_at`。
**严重性判断**：合理 — 类型不匹配（TEXT vs number）和命名规范泄漏（snake_case 在 Service 层）是两个独立但叠加的问题。如果不明确归一算法，实现者可能用 `new Date(createdAt).getTime()` 或 `Date.parse()` 或其他方式，且 SQLite datetime 默认不含时区信息，都会影响比较结果的正确性和测试稳定性。
**修订建议**：可行 — 将 AC 3 中的 `created_at` 改为 `createdAt`（camelCase，经 mapper 转换后），并明确时间归一算法：`Date.parse(relation.createdAt)` 统一到 UTC 毫秒后与 `lastObservedMtimeMs` 比较。
**误报评估**：非误报 — 类型不匹配和命名规范泄漏已从 Story 1.4 schema 和 3.5 AC 原文交叉确认。

## 发现 #5 评估

### 审查原文

> **[中][新] 3.1 新增错误处理说明仍残留旧路径、旧构造签名和 picocolors 约定**
> - 来源：consistency+contract
> - 分类：patch
> - 涉及 Story：3-1
> - 证据 - Story 3.1 的 AC 已补上 QueryError 的 `code` 与 `suggestion`，但新增说明仍把 CordError 写成 `src/errors/cord-error.ts`、继续示例化为位置参数 `super(message, code, suggestion)`、错误码示例未对齐 `CORD_QUERY_NNN` 规范，同时架构约束里依然建议 CLI 使用 `picocolors`。
> - 影响 - 开发实现会被拉回到已废弃的共享基线，导致错误类路径、构造签名、错误码规范和 CLI 着色四处同时漂移。
> - 建议 - 将 [3-1-queryservice-relation-query-one-hop-and-type-filter.md] 的错误处理与 CLI 着色说明整体回收到 [1-2-corderror-error-handling-and-logger-system.md] 的真实共享契约：路径改为 `src/utils/errors.ts`，构造改为对象参数，错误码示例改为 `CORD_QUERY_001` 形态，颜色库统一为 `chalk`。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 已逐项交叉验证全部四处漂移：
1. **路径漂移**：Story 3.1 Dev Notes 写"CordError 基类已在 Story 1.2 中定义 (`src/errors/cord-error.ts`)"，而 Story 1.2 实际定义为 `src/utils/errors.ts`。
2. **构造签名漂移**：Story 3.1 示例为 `constructor(message: string, code: string, suggestion: string)` + `super(message, code, suggestion)`（位置参数），而 Story 1.2 和 D3 定义的 CordError 使用单一对象参数 `constructor(params: { message, code, suggestion, context?, cause? })`。
3. **错误码漂移**：Story 3.1 示例 `QUERY_DOC_NOT_FOUND`，而 Story 1.2/D3 规范为 `CORD_{MODULE}_{NNN}` 格式（如 `CORD_QUERY_001`）。
4. **颜色库漂移**：Story 3.1 架构约束写"CLI 表格输出建议使用 picocolors 着色"，而 Story 1.2、D3、D4 全部指定使用 chalk。

**严重性判断**：合理 — 四处同时漂移到已废弃的共享基线，会导致实现者在开发 3.1 时按错误的约定编码，后续所有依赖错误处理的 Story（3.2-3.5）也可能继承相同错误。审查标为[中]，但鉴于四处同时偏离的累积影响，P1 判定更合适。
**修订建议**：可行 — 四处修正都是文本替换级别的改动：路径改为 `src/utils/errors.ts`，构造改为对象参数形式，错误码改为 `CORD_QUERY_001`，颜色库改为 chalk。
**误报评估**：非误报 — Story 1.2、D3、D4 原文已逐份确认，四处漂移全部成立。

## 发现 #6 评估

### 审查原文

> **[中][新] 3.4 将 project 字段来源指向了不存在的配置项**
> - 来源：consistency+contract
> - 分类：patch
> - 涉及 Story：3-4
> - 证据 - Story 3.4 的新裁决写明 `project` 字段优先读取"配置文件中的项目名"，但 D6 与 PRD 的配置 schema 并不存在 `project` 或 `projectName` 配置项。
> - 影响 - 该来源约束没有上游文档支撑，会迫使实现者自行扩展配置 schema 或临时忽略 Story 说明，从而制造新的文档漂移。
> - 建议 - 若 v0.1 不扩展配置 schema，则在 [3-4-json-snapshot-export.md] 中将 `project` 字段来源统一收敛为项目根目录名；若确需从配置读取，则必须先同步更新 PRD、D6 和相关 Story。

### 评估结论：⚠️ 有效但降级 — 建议纳入后续改善跟踪（P2）

### 评估分析

**问题描述准确性**：准确 — 已验证 D6 定义的 7 项配置（framework, ide, scanPaths, excludePaths, confidenceThreshold, relationTypes, adapters）中确实不包含 `project` 或 `projectName`。Story 3.4 Dev Notes 写"`project` 字段来源：优先读取配置文件中的项目名，如酵出则用项目根目录名"（注：原文有错别字"如酵出"应为"如缺失"），引用了一个不存在的配置项。
**严重性判断**：偏高 — 审查标为[中]，实际影响有限。`project` 是导出 JSON 中的一个展示性字段，不影响核心功能。即使 Story 中的描述不精确，开发者也可以合理降级为"使用项目根目录名"作为默认行为。这不是架构不一致，而是 Story 内的一个小幅表述错误。
**修订建议**：可行 — 将 `project` 字段来源简化为"使用项目根目录名（`path.basename(projectRoot)`）"，删除对不存在配置项的引用即可。
**误报评估**：非误报 — 配置项列表已确认不含 `project`/`projectName`，但实际影响程度不构成阻塞。

## 整体评估结论

### 需要修订（阻塞进入开发）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|------------|------|
| 1 | 3.3 三跳边界仍未进入 AC（上轮遗留） | [高] | P1 | AC 需补充三跳固定约束和入口统一 |
| 2 | 3.4 getAllRelations 未同步到 1.4（上轮遗留） | [高] | P1 | 需回写 IGraphRepository 源契约 |
| 4 | 3.5 过时关系时间归一和 camelCase 约束缺失（上轮遗留） | [高] | P1 | 需统一时间类型和字段命名规范 |
| 5 | 3.1 错误处理四处漂移到旧基线（新发现） | [中] | P1 | 路径/构造/错误码/颜色库全需对齐 |

### 建议纳入后续改善跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|------------|------|
| 3 | 3.5 migrationVersion 单字段 vs D2 双维度（上轮遗留） | [高] | P2 | v0.1 连续编号场景下单字段已满足 |
| 6 | 3.4 project 字段引用不存在的配置项（新发现） | [中] | P2 | 改为使用项目根目录名即可 |

### 可忽略（误报）

| # | 发现 | 原始严重性 | 忽略理由 |
|---|------|----------|---------|
| — | 无 | — | 本轮审查未发现误报 |

### 评估决定

**整体结论**：需修订后再审

4 条 P1 发现分布在 4 个 Story 中（3-1: 1 条, 3-3: 1 条, 3-4: 1 条, 3-5: 1 条），均为文档契约闭合问题，修订工作量较首轮显著缩小。建议按以下优先级修订：(1) 发现 #5（3.1 错误处理四处漂移）——改动量最小，纯文本替换；(2) 发现 #1（3.3 三跳边界提升至 AC）——需新增 AC 条目并统一入口；(3) 发现 #2（3.4 getAllRelations 回写 1.4）——需跨 Story 同步；(4) 发现 #4（3.5 时间归一）——需明确算法并修正 AC 措辞。P2 项可在修订过程中顺带处理。修订完成后提交第 3 轮复审。

---

## 修订执行记录

### 修订执行记录
- **Date**: 2026-04-20
- **Model Used**: Claude Sonnet 4.6
- **Fix Items**: 4

#### 修订项 #1: Story 3.1 错误处理四处漂移到旧基线（发现 #5）
- **文件**: `_bmad-output/implementation-artifacts/stories/3-1-queryservice-relation-query-one-hop-and-type-filter.md`
- **章节**: Dev Notes → 错误处理约束 + 架构约束
- **修改摘要**:
  1. 路径：`src/errors/cord-error.ts` → `src/utils/errors.ts`（与 Story 1.2 AC 1 对齐）
  2. 构造签名：`constructor(message, code, suggestion)` + `super(message, code, suggestion)` → 对象参数 `constructor(params: { message, code, suggestion, context? })` + `super(params)`（与 Story 1.2 D3 对齐）
  3. 错误码示例：`QUERY_DOC_NOT_FOUND` → `CORD_QUERY_001`（与 Story 1.2 `CORD_{MODULE}_{NNN}` 规范对齐）
  4. 颜色库：架构约束中 `picocolors` → `chalk`（与 Story 1.2 AC 6、D4 对齐）
- **状态**: 已完成

#### 修订项 #2: Story 3.3 三跳边界仍未进入 AC（发现 #1）
- **文件**: `_bmad-output/implementation-artifacts/stories/3-3-impactservice-change-impact-analysis.md`
- **章节**: AC（新增条目）+ Tasks + Dev Notes → 遍历深度裁决
- **修改摘要**:
  1. 新增 AC 9："影响分析内部固定三跳遍历深度，v0.1 不对外暴露 depth 参数；测试必须验证三跳边界（超出三跳的间接节点不应出现在结果中）"
  2. Task 4 补充三跳边界验证要求
  3. Dev Notes 遍历深度裁决章节：多跳入口统一改为 `queryService.queryMultiHop({ docPath, depth: 3 })`（与 Story 3.2 `queryMultiHop` 入口对齐），删除对 `QueryService.query()` 的混用描述
- **状态**: 已完成

#### 修订项 #3: Story 1.4 IGraphRepository 未包含 getAllRelations（发现 #2）
- **文件**: `_bmad-output/implementation-artifacts/stories/1-4-sqlite-storage-layer-and-data-migration.md`（主），`_bmad-output/implementation-artifacts/stories/3-4-json-snapshot-export.md`（从）
- **章节**: Story 1.4 → Dev Notes IGraphRepository 接口（统计区块）+ Task 1 条目；Story 3.4 → Tasks Task 0
- **修改摘要**:
  1. Story 1.4 接口定义中补充 `getAllRelations(): RelationEdge[]`（位于统计方法区块，对称已有 `getAllDocuments()`），并标注"供 Story 3.4 导出功能依赖"
  2. Story 1.4 Task 1 新增子任务 1.5：`getAllRelations(): RelationEdge[]` 全量读取方法签名
  3. Story 3.4 Task 0 措辞调整为"依赖 Story 1.4 Task 1.5 已定义的接口，确认 SqliteGraphRepository 实现已覆盖该方法"，不再重复声明接口扩展
- **状态**: 已完成

#### 修订项 #4: Story 3.5 过时关系时间归一和 camelCase 约束（发现 #4）
- **文件**: `_bmad-output/implementation-artifacts/stories/3-5-statusservice-health-check.md`
- **章节**: AC 3 + Dev Notes → 过时关系判定口径
- **修改摘要**:
  1. AC 3：`created_at` → `createdAt`（经 Story 1.4 mappers.ts 转换后的 camelCase 字段）；补充时间归一算法——"必须先将 `createdAt`（SQLite datetime TEXT）通过 `Date.parse(relation.createdAt)` 归一到 UTC 毫秒再与 `lastObservedMtimeMs` 比较"
  2. Dev Notes 判定口径章节：补充"字段命名规范"小项——Service 层应使用 `createdAt`（camelCase），禁止泄漏 snake_case `created_at`；补充 SQLite datetime 无时区的注意事项（写入时须以 UTC 存储）；"数据来源"中 `relations.created_at` → `RelationEdge.createdAt`
- **状态**: 已完成

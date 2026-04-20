---
Epic: 2
Scope: epic
Round: 2
Date: 2026-04-15
Model Used: Claude Opus 4.6 (github-copilot)
Review Source: epic-2-story-review-summary-20260415-round-2.md
Review Model: GPT-5.4 (github-copilot)
Type: Story Review Evaluation
---

## 评估总结

本次评估针对 GPT-5.4 对 Epic 2 全部 6 个 Story 的第 2 轮复审结果（9 条新发现）进行逐条验证，同时对"上轮问题回顾"中的修复确认和遗留状态进行交叉核实。整体审查质量依然较高，复审准确地追踪了第 1 轮 12 条发现的修复闭合度，并精准识别了"半修复后新暴露的边界问题"。9 条新发现中，6 条确认有效需修订，2 条有效但建议降级为后续改善跟踪，1 条部分有效但严重性偏高。本轮无误报。从第 1 轮到第 2 轮，Epic 2 的核心阻塞从"基础契约完全缺失"收窄为"共享契约残留缝隙 + 跨 Epic 前置依赖未同步"，进展方向正确但仍需一轮修订。

## 上轮问题回顾确认

### Round 1 / Finding #2 — 适配器解析与 Generic fallback 选择契约缺失：已确认修复

Story 2.1 已补充完整的 Adapter Resolution 契约（显式指定 > 自动检测 > generic 兜底），resolveAdapter 伪代码、registry 顺序和 Task 5.4 测试覆盖均已到位。本轮未再发现此问题的残留。

### Round 1 / Finding #3 — 文档分类与预设规则未进入扫描执行链路：已确认修复

Story 2.5 已新增 `resolveAdapter → docType classify → preset merge → merge/dedupe` 主链路（Task 1.2–1.6），基础执行链路闭合。但增量路径对此链路的继承问题已作为本轮新发现 #6 处理。

### Round 1 / Finding #4 — 关系来源 auto_scan 与 framework_preset 契约冲突：已确认修复

Story 2.2 DiscoveredRelation 已增加 `source: RelationSource` 字段，Story 2.5 AC #4 已区分两种来源标记，字段级冲突闭合。但 provenance 在 dedupe 与 rebuild 语义上的保留规则已转入本轮新发现 #4 处理。

### Round 1 / Finding #7 — rebuild 与增量事务边界未定义完整：已确认修复

Story 2.5/2.6 均已建立两阶段事务契约（事务外计算 + 事务内短写），rebuild 采用同事务内 DELETE ALL + INSERT ALL 原子替换。基本骨架闭合。但事务入口泄漏问题已转入本轮新发现 #5 处理。

### Round 1 / Finding #11 — Markdown 链接支持从相对+绝对退化为仅相对：已确认修复

Story 2.2 markdown-link-rule 已恢复支持相对路径和绝对路径，Dev Notes 明确写出了两种路径的解析策略。本轮未再发现此问题的残留。

### 历史非阻塞待办

- Round 1 / Finding #6（排除路径 .cord 口径）：确认仍为非阻塞。Story 2.4 Dev Notes 默认配置已包含 `.cord/`，AC 和 Task 的不一致属于文档同步问题，不影响实现方向。
- Round 1 / Finding #12（CLI JSON/退出码/性能测试粒度）：确认仍为非阻塞。任务粒度不足是追踪问题而非设计缺陷。
- FR40/FR41 预设路径与用户覆盖优先级：确认仍为非阻塞，属于任务闭环不足。

## 发现 #1 评估

### 审查原文

> **[高][上轮遗留] Story 2.3 的 v0.1 文档类型收敛仍未同步到 AC、Task 与 Epic 验收口径**
> - 来源：structure+consistency
> - 分类：patch
> - 涉及 Story：2-3
> - 证据 - Story 2.3 的 Dev Notes 已声明 v0.1 仅支持 16 种 Markdown 文档类型，但 Story 2.3 的 AC、Task 与 Epic 2 中对应验收表述仍要求 18 种文档类型。
> - 影响 - 测试范围与实现范围无法稳定对齐，首轮发现 #1 只能算部分闭合。
> - 建议 - 将 Story 2.3 与 Epic 2 的 AC、Task、测试口径同步收敛为 v0.1 仅支持 16 种 Markdown 文档类型；若坚持 18 种，则必须回补 YAML 发现、解析和测试链路。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 经交叉验证，Story 2.3 AC #2 仍写"定义 18 种 BMAD 文档类型"，Task 1 仍写"定义 18 种 BMAD 文档类型"，AC #6 测试仍要求"18 种文档类型识别"。而 Dev Notes 已在表格中明确标注 #6 和 #18 为 "⏳ v0.2"，并声明"v0.1 仅支持 Markdown 文档类型（16 种）"。Epic 2 Story 2.3 AC 也仍写"18 种 BMAD 文档类型"。AC/Task/Epic 与 Dev Notes 确实存在两套真相。
**严重性判断**：合理 — 这是第 1 轮发现 #1 的直接延续。Dev Notes 层面已完成收敛，但验收标准层面未同步意味着测试和 QA 仍按 18 种类型验收，必然与实现产生矛盾。
**修订建议**：可行 — 将 Story 2.3 AC #2 改为"定义 16 种 v0.1 Markdown BMAD 文档类型"，Task 1 同步修改，AC #6 测试改为"16 种文档类型识别"，Epic 2 Story 2.3 AC 同步。修改量小且方向已确定。
**误报评估**：非误报 — AC/Task/Epic 仍写 18，Dev Notes 写 16，矛盾清晰可见。

## 发现 #2 评估

### 审查原文

> **[中][新] Story 2.3 的多个 BMAD 文档类型 glob 仍无法命中当前仓库真实样本**
> - 来源：structure+consistency+contract
> - 分类：patch
> - 涉及 Story：2-3
> - 证据 - `architecture`、`validation-report`、`distillate` 仍使用前缀型 glob，但当前仓库对应真实样本分别是 `03-core-architectural-decisions.md`、`prd-validation-report.md`、`product-brief-cord-distillate.md`，并不匹配这些模式。
> - 影响 - BmadFrameworkAdapter 可能在 CORD 自身样本上漏识别关键 BMAD 文档类型，削弱"开箱即用"的验收可信度。
> - 建议 - 把模式改为目录型或包含式匹配，并把真实文件名加入 fixture 或回归测试。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 经交叉验证：(1) Story 2.3 `architecture` 类型 glob 为 `**/architecture*.md`，但当前仓库中的实际文件是 `03-core-architectural-decisions.md` 和 `04-implementation-patterns-consistency-rules.md`，均不以 `architecture` 开头，无法被该 glob 命中。(2) `validation-report` 的 glob 为 `**/validation*.md`，实际文件是 `prd-validation-report.md`，不以 `validation` 开头。(3) `distillate` 的 glob 为 `**/distillat*.md`，实际文件是 `product-brief-cord-distillate.md`，不以 `distillat` 开头。三者均为前缀匹配的失败案例。
**严重性判断**：偏低 — 审查标为 [中]，但考虑到 Story 2.3 Dev Notes 明确写到"CORD 项目自身就是 BMAD 项目……作为真实 BMAD 文档类型样本"，如果核心类型在自身仓库上都无法命中，说明 glob 设计存在根本性缺陷。建议升级为 P1，因为这直接影响 BMAD 适配器的核心价值承诺——"开箱即用"。
**修订建议**：可行 — 将 glob 改为包含式匹配（如 `architecture` 改为 `**/*architecture*.md` 或改用目录匹配 `**/architecture/**/*.md`），并将当前仓库的真实文件名加入测试 fixture。
**误报评估**：非误报 — 三种文档类型的 glob 与当前仓库真实文件名的不匹配已通过目录结构验证。

## 发现 #3 评估

### 审查原文

> **[高][上轮遗留] Story 2.4 的 relationTypes 与 configSchema 共享契约仍未闭合，示例还重新引入了无效关系键**
> - 来源：structure+consistency+contract
> - 分类：patch
> - 涉及 Story：2-4、1-3
> - 证据 - Story 2.4 已把 relationTypes 收敛为固定 9 类关系的启用/禁用配置，但 Story 1.3 的 CordConfig 仍是任意键扩展；Story 2.4 也未显式绑定共享 configSchema，而且示例重新写入了不在 9 类基线中的 `depends_on`。
> - 影响 - 配置层、类型层和 schema 层会继续出现两套真相，开发实现容易回退到私有 schema、类型断言或无效键配置。
> - 建议 - 在 2.4 中明确复用共享 configSchema，并引入本 Story 的桥接约束；同时将示例键收敛到 9 类基线关系，并将 1.3 的类型签名继续标记为未闭合前置依赖。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 经交叉验证：(1) Story 1.3 CordConfig 仍定义 `relationTypes?: Record<string, unknown>;  // 自定义关系类型扩展`，类型签名和注释均未收敛。(2) Story 2.4 AC #3 已收敛为"其中 `relationTypes` 为已有 9 类关系的启用/禁用配置，不支持扩展新类型"，方向正确。(3) 但 Story 2.4 Dev Notes 示例中确实写了 `depends_on: { enabled: false }`，而 `depends_on` 不在 Story 1.3 定义的 9 种关系类型（RELATION_TYPES）中。(4) Story 2.4 未在 AC 或 Task 中显式声明复用 `src/schemas/config.ts` 的 `configSchema`。四个问题点均验证成立。
**严重性判断**：合理 — 这是第 1 轮发现 #5 的直接延续。v0.1 只有 9 种固定关系类型，示例中出现无效键会直接误导实现者。跨 Epic 的 CordConfig 类型签名不收敛是阻塞项——Story 2.4 的 Zod 验证无法对齐 Story 1.3 的弱类型定义。
**修订建议**：可行 — (1) 修正示例中的 `depends_on` 为 9 类中的有效键。(2) 在 Story 2.4 Task 或 Dev Notes 中显式声明"复用 `src/schemas/config.ts` 的 `configSchema`"。(3) 将 Story 1.3 CordConfig.relationTypes 的类型签名收敛标记为 Epic 1 未闭合的前置依赖。其中 (1)(2) 属于 Story 2.4 内部可完成的修订，(3) 需要跨 Epic 协调。
**误报评估**：非误报 — 示例中的无效键和跨 Epic 类型签名不一致均为客观事实。

## 发现 #4 评估

### 审查原文

> **[高][新] Story 2.5 的来源模型在去重与 rebuild 语义上仍不闭合**
> - 来源：consistency+contract
> - 分类：patch
> - 涉及 Story：2-5、1-3、1-4
> - 证据 - Story 2.5 已补 auto_scan 与 framework_preset 的来源区分，但 merge/dedupe 仍按 `sourceDoc + targetDoc + relationType` 去重，source 不在键内；同时 rebuild 采用全量删除后重写入，没有定义 manual 边的保留策略。
> - 影响 - 当扫描规则与预设规则命中同一关系，或后续存在 manual 边时，图谱会丢失 provenance 或误删用户手工关系。
> - 建议 - 明确 ScanService 只重建 scan-managed 边；为同一关系跨 source 的保留策略补充契约，或把 source 纳入去重和重建语义。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 经交叉验证：(1) Story 2.5 Task 1.6 写"同 (sourceDoc, targetDoc, relationType) 保留高置信度"，source 确实不在去重键内。(2) Story 1.4 SQL schema 定义了唯一索引 `idx_relations_unique_pair ON relations(source_doc_id, target_doc_id, relation_type)`，也不含 source 列——这意味着同一对文档间同类型的关系只能存一条，无论来源是 auto_scan 还是 framework_preset。(3) Story 2.5 Task 1.8 rebuild 为"同事务内 DELETE ALL + INSERT ALL"，确实没有区分 manual 边的保留策略。三个问题点均验证成立。
**严重性判断**：合理 — 这是一个涉及数据完整性的设计问题。v0.1 暂时没有 manual 关系的创建入口（Epic 3–4），但数据库 schema 已预留了 `source = 'manual'` 的可能性。更重要的是，同一关系 auto_scan 和 framework_preset 的去重行为直接影响 provenance 追溯能力。
**修订建议**：可行 — (1) 去重策略：当 auto_scan 和 framework_preset 同时命中同一 (source, target, type)，按当前"高置信度优先"保留一条是合理的 v0.1 策略，但需在文档中显式声明此行为和 source 记录规则（保留最终获胜的 source）。(2) rebuild 策略：v0.1 仅重建 `source IN ('auto_scan', 'framework_preset')` 的边，保留 `manual` 边。这需要 Task 1.8 的 DELETE 改为条件删除。
**误报评估**：非误报 — 去重键不含 source、唯一索引不含 source、rebuild 无条件删除均为客观事实。

## 发现 #5 评估

### 审查原文

> **[高][新] Story 2.5 与 2.6 的两阶段事务伪码仍直接泄漏底层 db，绕过 IGraphRepository**
> - 来源：contract+consistency
> - 分类：patch
> - 涉及 Story：2-5、2-6、1-4
> - 证据 - 2.5 和 2.6 都新增了两阶段事务契约，但事务伪码仍直接调用 `db.transaction`，而 project-context 与 Story 1.4 都要求 Service 仅通过 IGraphRepository 获取事务能力。
> - 影响 - Service 层会被迫依赖具体 SQLite 实现或数据库句柄，破坏依赖注入、测试替身和错误封装边界。
> - 建议 - 统一把 `repo.transaction` 设为 Service 可见的唯一事务入口；若批量写入能力不足，应先补 1.4 的 Repository 接口。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 经交叉验证：(1) Story 2.5 Dev Notes 两阶段事务伪代码写的是 `db.transaction(() => { ... })();`，直接使用 `db` 句柄。(2) Story 2.6 增量扫描流程阶段 2 也写 `db.transaction(() => { ... })();`。(3) Story 1.4 IGraphRepository 接口已定义 `transaction<T>(fn: () => T): T`，这正是 Service 应使用的事务入口。(4) project-context.md P7 要求"Service 层通过构造函数注入 IGraphRepository，不直接引用 SqliteGraphRepository"——直接使用 `db.transaction` 违反此约束。
**严重性判断**：合理 — 这是架构边界违反问题。如果伪代码中的 `db.transaction` 被实现者照搬，Service 层将直接依赖 better-sqlite3 的 Database 对象，破坏 P7 依赖注入原则，导致 Service 单元测试无法用 mock Repository 替身。
**修订建议**：可行 — 将伪代码中的 `db.transaction(() => { ... })();` 统一改为 `repo.transaction(() => { ... })`。Story 1.4 已提供 `transaction<T>(fn: () => T): T` 接口，无需扩展。修改量仅为两处伪代码的替换。
**误报评估**：非误报 — 伪代码使用 `db.transaction` 与 IGraphRepository 提供的 `transaction()` 方法的矛盾为客观事实。

## 发现 #6 评估

### 审查原文

> **[高][新] 冷启动与增量扫描的数据流仍不一致，2.6 未显式继承 2.5 的完整构建链路**
> - 来源：consistency+contract
> - 分类：patch
> - 涉及 Story：2-5、2-6、2-2、1-4
> - 证据 - Story 2.5 已确立 `pipeline.process -> docType classify -> preset merge -> merge/dedupe` 的完整流程，并应消费 ScanPipelineResult；但 2.6 的增量路径只写到对 modified 和 added 文档执行 `pipeline.process`，未显式继承完整子链路，也未说明 modified 文档旧关系如何替换。
> - 影响 - 增量扫描可能丢失 framework_preset 刷新、warning 聚合和 dedupe 口径，还可能因旧关系未替换而产生唯一键冲突或冷启动/增量结果不等价。
> - 建议 - 在 2.6 中明确复用 2.5 的完整构建子链路，并定义 modified 文档旧生成关系的替换策略；同时将 2.5 明确改为消费 ScanPipelineResult。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 经交叉验证：(1) Story 2.5 Task 1.3 定义了完整链路 `loadConfig → resolveAdapter → discoverDocuments → pipeline.process → docType classify → preset merge → merge/dedupe → 事务写入`。(2) Story 2.6 增量扫描流程步骤 5 仅写"对 modified + added 文档执行 pipeline.process → 产出写入计划"，没有提及 docType classify、preset merge 和 merge/dedupe。(3) Story 2.6 未定义 modified 文档旧关系的替换策略——是删除旧边再插入新边，还是 upsert？(4) Story 2.5 流程步骤 4 写 `pipeline.process(filePath) → ParsedDocument + DiscoveredRelation[]`，但 Story 2.2 定义的 ScanPipelineResult 包含 `{ document, relations, warnings }`，两者形状不完全对齐。
**严重性判断**：合理 — 冷启动和增量扫描结果不等价是数据一致性问题。如果增量路径跳过了 preset merge 和 dedupe，那么增量扫描后的图谱将缺少 framework_preset 关系，与 rebuild 后的图谱不一致，violates NFR18 的同等性隐含要求。
**修订建议**：可行 — (1) 在 Story 2.6 步骤 5 中明确"对 modified + added 文档执行与冷启动相同的完整构建子链路（pipeline.process → docType classify → preset merge → merge/dedupe）"。(2) 定义旧关系替换策略：事务内先删除 modified 文档的旧 scan-managed 边 (`source IN ('auto_scan', 'framework_preset')`)，再插入新边。(3) Story 2.5 步骤 4 应明确消费 ScanPipelineResult 结构（含 warnings）。
**误报评估**：非误报 — 增量路径缺少 classify/preset/dedupe 步骤和旧关系替换策略均可从 Story 文档中直接验证。

## 发现 #7 评估

### 审查原文

> **[高][上轮遗留] Story 2.6 的 lastObservedMtimeMs 仍未落到 Story 1.4 的共享 SyncState 与 schema 契约**
> - 来源：consistency+contract
> - 分类：patch
> - 涉及 Story：2-6、1-4
> - 证据 - Story 2.6 已把 `lastObservedMtimeMs` 设为增量比较和持久化的核心版本令牌，但 Story 1.4 的 SyncState、同步状态 Repository 接口和 sync_states 表结构仍只有 `lastScannedAt`。
> - 影响 - 增量扫描无法在不偏离 1.4 共享契约的前提下合法持久化和读取版本令牌，开发者只能临时扩表或错误复用 `lastScannedAt`。
> - 建议 - 把 `lastObservedMtimeMs` 正式前置到 1.4 的 SyncState、Repository 契约和 SQL 迁移中，再让 2.6 仅引用该基线。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 经交叉验证：(1) Story 2.6 Dev Notes 定义了 `StoredDocRecord.lastObservedMtimeMs: number`，并在检测策略中写明"变更检测：`current.mtimeMs !== stored.lastObservedMtimeMs`"。(2) Story 1.4 SyncState 接口仅有 `lastScannedAt: string`（ISO 8601），无 `lastObservedMtimeMs`。(3) Story 1.4 SQL schema `sync_states` 表仅有 `last_scanned_at TEXT`，无 `last_observed_mtime_ms` 列。(4) Story 2.6 Dev Notes 明确写到 `lastObservedMtimeMs` 与 `lastScannedAt` "语义不同"，但没有定义该字段如何落到持久层。
**严重性判断**：合理 — 这是第 1 轮发现 #8 的直接延续。增量扫描的正确性完全依赖变更检测，而变更检测的核心字段在共享契约中不存在，这是硬阻塞——实现者要么非法扩展 1.4 的 schema，要么错误复用 `lastScannedAt`。
**修订建议**：可行 — 需要跨 Epic 修订：(1) Story 1.4 SyncState 接口添加 `lastObservedMtimeMs: number`。(2) sync_states 表添加 `last_observed_mtime_ms INTEGER` 列（可作为 002 迁移脚本或合并到 001 中，取决于 Epic 1 是否已实现）。(3) IGraphRepository.upsertSyncState 签名无需变化（接受 SyncState 对象）。修订跨 Epic 但影响面可控。
**误报评估**：非误报 — SyncState 接口和 SQL schema 均缺少 `lastObservedMtimeMs` 为客观事实。

## 发现 #8 评估

### 审查原文

> **[高][上轮遗留] Story 2.6 的 rename 与 delete 验收语义仍未与 docId 和级联删除模型收敛**
> - 来源：structure+consistency+contract
> - 分类：patch
> - 涉及 Story：2-6、1-3、1-4
> - 证据 - 2.6 的 Dev Notes 已把重命名/移动收敛为只更新 `documents.path`，删除依赖 `deleteDocument(docId)` 和级联删边；但 AC 仍要求"更新相关关系边"和"清理孤立节点"，与 1.3 / 1.4 的 docId 建边和外键级联模型形成两套真相。
> - 影响 - 实现与验收会沿着不同语义前进：一类实现会额外重写关系边或尝试做未定义的孤立节点清理，另一类实现会按 docId 和外键级联处理，结果无法统一验收。
> - 建议 - 将 2.6 和 Epic 2 的 AC 明确改写为：rename/move 只更新 `documents.path`；delete 依赖外键级联清理关联关系。若确需 orphan prune，应单独定义判定规则和 Repository 能力。

### 评估结论：⚠️ 有效但降级 — 建议纳入后续改善跟踪（P2）

### 评估分析

**问题描述准确性**：基本准确 — 经交叉验证：(1) Story 2.6 AC #3 写"更新图谱中的文档路径和相关关系边"，AC #5 写"清理孤立节点和失效关系边"。(2) Story 2.6 Dev Notes 架构约束明确写"重命名/移动只更新 `documents.path`，关系边按 `docId` 建立无需修改"。(3) Story 1.4 SQL schema 关系表有 `ON DELETE CASCADE`，删除文档会自动级联删除关系边。AC 与 Dev Notes/架构约束确实存在措辞不一致。
**严重性判断**：偏高 — 虽然 AC 和 Dev Notes 措辞不一致是事实，但 Dev Notes 和架构约束已经给出了明确的实现指引（"关系边按 docId 建立无需修改"、" `ON DELETE CASCADE`"），有经验的开发者不会因 AC 的"更新相关关系边"措辞而额外重写关系边。AC 中的"清理孤立节点"确实是一个未定义行为（什么是"孤立节点"？没有任何关系边的文档？还是无文件对应的图谱记录？），但这更属于措辞优化而非设计冲突。
**修订建议**：可行但非必要 — 将 AC #3 改为"更新图谱中的文档路径（关系边按 docId 建立，无需修改）"、AC #5 改为"删除对应文档记录，关联关系边通过外键级联自动清理"，确实更精确。但当前 Dev Notes 已提供足够的实现指引，不构成进入开发的硬阻塞。建议降级为 P2 后续改善。
**误报评估**：非误报 — AC 与 Dev Notes 的措辞差异是事实，但影响面有限。

## 发现 #9 评估

### 审查原文

> **[中][新] Story 2.6 的生命周期分类与无变更快返口径仍不稳定，且当前快照契约会抵消性能目标**
> - 来源：structure+contract
> - 分类：patch
> - 涉及 Story：2-6
> - 证据 - Story 2.6 仍将 `renamed` 和 `moved` 拆成两个结果，但没有给出清晰的分类边界；Task 3.1 仍写"无 mtime 变化时直接返回"，而 Dev Notes 又要求先构建含 `contentHash` 的 CurrentFileSnapshot，并在 detectLifecycle 全部 unchanged 后才早退。
> - 影响 - rename/move 测试口径会分裂；而无变更路径在当前契约下仍需全量计算 contentHash，很难稳定满足 p95 小于 100ms 的目标。
> - 建议 - 补充 rename 与 move 的判定矩阵，或改为单一 pathChanged 事件；同时将快照契约拆为 mtime 预筛选和候选文件再算 contentHash 的两层策略，并把早退条件改写为 detectLifecycle 全部 unchanged。

### 评估结论：⚠️ 有效但降级 — 建议纳入后续改善跟踪（P2）

### 评估分析

**问题描述准确性**：基本准确 — 经交叉验证：(1) Story 2.6 LifecycleResult 确实将 `renamed` 和 `moved` 拆为两个字段，但未定义区分规则（同目录内路径变化 = rename? 跨目录 = move?）。(2) Task 3.1 写"无 mtime 变化时直接返回"，而增量流程步骤 2 要求对每个文件收集 `fs.statSync + contentHash → CurrentFileSnapshot[]`——全量 contentHash 计算确实与无变更快返（p95 < 100ms）存在性能张力。(3) 但增量流程步骤 6 写"无变更（LifecycleResult 全部 unchanged）：早期返回，跳过事务"，说明 Dev Notes 内部已有早退概念。
**严重性判断**：偏高 — (1) rename/move 区分问题：v0.1 两者的处理逻辑完全相同（都是 `updateDocument(docId, { path: newPath })`），分不分开不影响功能正确性，只影响日志和统计的精细度，属 P3。(2) 性能问题：当前流程确实要求先算全量 contentHash 才能进入 lifecycle detection，但可以通过 mtime 预筛选优化——先检查所有 mtimeMs 是否与 stored 匹配，全部匹配则直接快返，无需计算 contentHash。这是实现层面的优化策略，Story 文档中的"早期返回"概念已覆盖此方向，只是表述不够精确。
**修订建议**：可行但非必要 — (1) rename/move 合并为单一 `pathChanged` 在 v0.1 是合理简化，但分开也不阻塞。(2) 性能优化（mtime 预筛选 → 跳过 contentHash）是实现细节，可在开发阶段优化而非 Story 设计阶段强制定义。建议降级为 P2。
**误报评估**：非误报 — 问题存在但严重性从 [中] 降至 P2 改善项。

## 整体评估结论

### 需要修订（阻塞进入开发）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|------------|------|
| 1 | v0.1 文档类型 16 种未同步到 AC/Task/Epic | [高] | P1 | AC 仍写 18，Dev Notes 写 16 |
| 2 | BMAD glob 无法命中当前仓库真实样本 | [中] | P1 | 三种类型前缀 glob 失败 |
| 3 | relationTypes 与 configSchema 共享契约未闭合 | [高] | P1 | 无效键 + 跨 Epic 类型不一致 |
| 4 | 去重与 rebuild 对 source/manual 边未闭合 | [高] | P1 | 去重键和 rebuild 均忽略 source |
| 5 | 事务伪码泄漏底层 db，绕过 IGraphRepository | [高] | P1 | 两处伪代码违反 P7 |
| 6 | 增量路径未继承冷启动完整构建链路 | [高] | P1 | 缺 classify/preset/dedupe/旧边替换 |
| 7 | lastObservedMtimeMs 未落到 1.4 共享契约 | [高] | P1 | SyncState 和 SQL schema 均缺字段 |

### 建议纳入后续改善跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|------------|------|
| 8 | rename/delete AC 措辞与 docId/cascade 不一致 | [高] | P2 | Dev Notes 已有正确指引 |
| 9 | rename/move 分类边界和无变更快返性能 | [中] | P2 | 实现层面可优化 |

### 可忽略（误报）

| # | 发现 | 原始严重性 | 忽略理由 |
|---|------|----------|---------|
| — | — | — | 本轮无误报 |

### 评估决定

**整体结论**：需修订后再审

7 项 P1 阻塞项可归为三个修订批次：(A) Story 2.3 口径统一 + glob 修正（#1、#2）；(B) 跨 Story/Epic 共享契约收敛——configSchema 绑定、source provenance/rebuild 策略、事务入口、增量链路继承（#3–#6）；(C) 跨 Epic 前置依赖——Story 1.4 SyncState 扩展（#7）。建议修订完成后提交第 3 轮复审，重点验证 B 批次的闭合度。

## 修订执行记录

### 修订执行记录
- **Date**: 2026-04-15
- **Model Used**: Claude Opus 4.6 (github-copilot)
- **Fix Items**: 10

#### 修订项 #1: v0.1 文档类型 16 种未同步到 Story 2.3 AC/Task（发现 #1）
- **文件**: `_bmad-output/implementation-artifacts/stories/2-3-bmad-framework-adapter-module.md`
- **章节**: AC #2, #6 + Task 1
- **修改摘要**: AC #2 从"18 种 BMAD 文档类型"改为"16 种 v0.1 Markdown BMAD 文档类型（YAML 类型延至 v0.2）"；AC #6 测试从"覆盖率 ≥ 80%"改为"16 种 v0.1 文档类型识别 + 预设规则匹配 + 框架检测逻辑，覆盖率 ≥ 80%"；Task 1 描述同步收敛为 16 种
- **状态**: 已完成

#### 修订项 #2: v0.1 文档类型 16 种未同步到 Epic 2 AC（发现 #1）
- **文件**: `_bmad-output/planning-artifacts/epics/epic-2文档扫描与关系图谱构建.md`
- **章节**: Epic 描述 + Story 2.3 AC
- **修改摘要**: Epic 描述从"18 种文档类型"改为"16 种 v0.1 Markdown 文档类型"；Story 2.3 AC 中 doc-types "18 种"改为"16 种 v0.1 Markdown"；测试 AC "18 种"改为"16 种 v0.1"
- **状态**: 已完成

#### 修订项 #3: BMAD glob 无法命中当前仓库真实样本（发现 #2）
- **文件**: `_bmad-output/implementation-artifacts/stories/2-3-bmad-framework-adapter-module.md`
- **章节**: Dev Notes > 18 种 BMAD 文档类型表格
- **修改摘要**: `architecture` glob 从 `**/architecture*.md` 改为 `**/*architecture*.md`, `**/architecture/**/*.md`（双模式匹配）；`validation-report` 从 `**/validation*.md` 改为 `**/*validation*.md`；`distillate` 从 `**/distillat*.md` 改为 `**/*distillat*.md`。三种类型均改为包含式匹配，确保命中当前仓库真实文件名
- **状态**: 已完成

#### 修订项 #4: relationTypes 示例无效键修正（发现 #3）
- **文件**: `_bmad-output/implementation-artifacts/stories/2-4-config-loading-and-document-scope.md`
- **章节**: Dev Notes > relationTypes 语义说明 > 示例配置
- **修改摘要**: 示例中不在 9 类基线关系中的 `depends_on` 改为有效键 `deprecated`
- **状态**: 已完成

#### 修订项 #5: 显式复用 configSchema（发现 #3）
- **文件**: `_bmad-output/implementation-artifacts/stories/2-4-config-loading-and-document-scope.md`
- **章节**: Tasks > Task 1.2
- **修改摘要**: Task 1.2 从"Zod schema 验证"改为"复用 `src/schemas/config.ts` 的 `configSchema` 进行 Zod schema 验证（与 Story 1.3 共享 schema，禁止创建私有 schema）"
- **状态**: 已完成

#### 修订项 #6: 去重策略显式声明 source 保留 + rebuild 保留 manual 边（发现 #4）
- **文件**: `_bmad-output/implementation-artifacts/stories/2-5-scanservice-cold-start-scan-and-graph-write.md`
- **章节**: Dev Notes > 数据流说明 + Task 1.8 + 两阶段事务伪代码
- **修改摘要**: (1) 数据流说明补充"保留该记录的原始 source 值（不合并、不覆盖）"和 rebuild 范围说明（仅重建 scan-managed 边，保留 manual 边）。(2) Task 1.8 从"DELETE ALL + INSERT ALL"改为"条件删除 `source IN ('auto_scan', 'framework_preset')` + INSERT ALL（保留 manual 边）"。(3) 两阶段事务说明同步修改。
- **状态**: 已完成

#### 修订项 #7: 事务伪代码改用 repo.transaction（发现 #5 — Story 2-5）
- **文件**: `_bmad-output/implementation-artifacts/stories/2-5-scanservice-cold-start-scan-and-graph-write.md`
- **章节**: Dev Notes > 两阶段事务契约 > 伪代码
- **修改摘要**: 伪代码从 `db.transaction(() => { ... })();` 改为 `repo.transaction(() => { ... });`，符合 P7 依赖注入原则和 Story 1.4 IGraphRepository.transaction 接口；rebuild 逻辑改为 `repo.deleteRelationsBySource([...]) + repo.deleteAllDocuments()`
- **状态**: 已完成

#### 修订项 #8: 事务伪代码改用 repo.transaction + 增量链路继承（发现 #5 + #6 — Story 2-6）
- **文件**: `_bmad-output/implementation-artifacts/stories/2-6-incremental-scan-and-document-lifecycle-detection.md`
- **章节**: Dev Notes > 增量扫描流程
- **修改摘要**: (1) 阶段 2 事务入口从 `db.transaction(() => { ... })();` 改为 `repo.transaction(() => { ... });`。(2) 阶段 1 步骤 5 从"执行 pipeline.process → 产出写入计划"改为"执行与冷启动相同的完整构建子链路：pipeline.process → docType classify → preset merge → merge/dedupe"。(3) 阶段 2 新增步骤 9"处理 modified 文档旧关系替换：先删除旧 scan-managed 边，再插入新边"。(4) 新增数据一致性保证说明。
- **状态**: 已完成

#### 修订项 #9: SyncState 接口扩展 lastObservedMtimeMs（发现 #7 — 跨 Epic）
- **文件**: `_bmad-output/implementation-artifacts/stories/1-4-sqlite-storage-layer-and-data-migration.md`
- **章节**: Dev Notes > IGraphRepository 接口 > SyncState
- **修改摘要**: SyncState 接口新增 `lastObservedMtimeMs: number` 字段，注释说明用途（增量扫描变更检测，Story 2.6 依赖）
- **状态**: 已完成

#### 修订项 #10: sync_states SQL schema 扩展 last_observed_mtime_ms（发现 #7 — 跨 Epic）
- **文件**: `_bmad-output/implementation-artifacts/stories/1-4-sqlite-storage-layer-and-data-migration.md`
- **章节**: Dev Notes > 001-initial-schema.sql > sync_states 表
- **修改摘要**: sync_states 表新增 `last_observed_mtime_ms INTEGER` 列（可空，带注释），在 001 初始 schema 中直接定义而非单独迁移脚本，因为 Epic 1 尚未实现
- **状态**: 已完成

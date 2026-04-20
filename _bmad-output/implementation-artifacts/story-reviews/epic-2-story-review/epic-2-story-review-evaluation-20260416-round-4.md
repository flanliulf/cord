---
Epic: 2
Scope: epic
Round: 4
Date: 2026-04-16
Model Used: Claude Opus 4.6 (github-copilot)
Review Source: epic-2-story-review-summary-20260416-round-4.md
Review Model: GPT-5.4 (github-copilot)
Type: Story Review Evaluation
---

## 评估总结

Round 4 审查质量整体高于前三轮——审查者已从"Story 内部自相矛盾"的表层问题上移到"跨 Story / 跨架构层的共享边界收敛"这一更深层面，6 条发现均指向真实的设计缺口。经逐条交叉验证，5 条确认为 P1 阻塞项，1 条（Finding #4 rebuild 与 D2 冲突）因上下文误读降级为 P2。本轮无误报。审查者对阻塞点的收敛判断（4 组共享边界问题）准确，修订建议具有可操作性。Epic 2 仍需修订后再审。

## 上轮问题回顾确认

### R3 #1 rebuild 自相矛盾：已确认修复

审查者确认 Story 2.5 已把 `--rebuild` 改为 `deleteAllDocuments()` + 全量重建，内部自相矛盾已消除。Story 1.4 也已补入 `deleteAllDocuments(): void`。交叉核对 Story 2.5 Dev Notes 与 Story 1.4 接口定义，修复到位。

### R3 #3 glob 护栏进入 AC：已确认修复

Story 2.3 AC #6 与 Task 6 已加入正例命中 + 反例排除测试要求。交叉核对 Story 2.3 文档，修复到位。

### R3 #4 SyncState.status deleted 移除：已确认修复

Story 1.4 `SyncState.status` 已收敛为 `'synced' | 'modified'`，SQL schema 注释同步更新。交叉核对 Story 1.4 接口定义与 SQL schema，修复到位。

### R3 #5 ScanPipelineResult/warnings 消费：已确认修复

Story 2.5 步骤 4 和 Story 2.6 步骤 5/5b 均已切换到 `ScanPipelineResult { document, relations, warnings }` 并聚合 warnings。交叉核对两份 Story 文档，修复到位。

### R3 #2 effectiveScanPaths owner（遗留）：确认仍未解决

审查者判断正确——Story 2.4 写出了公式但 owner/时序仍未在 2.5 主链中落位。已转入本轮 Finding #1 继续追踪。

### R3 #4 SyncState 写回对齐（遗留）：确认仍未解决

审查者判断正确——2.6 的写回对象仍不满足 1.4 的完整 SyncState 契约。已转入本轮 Finding #6 继续追踪。

### 历史非阻塞待办

1. **contentHash 预计算成本**：Story 2.6 的无变更快返仍在早退前全量计算 contentHash。维持 P2 非阻塞，后续优化 NFR6 时处理。
2. **rename/delete AC 旧措辞**：Epic 2 和 Story 2.6 的 AC 仍沿用旧的"更新关系边/清理孤立节点"措辞。Dev Notes 已提供正确实现口径，维持非阻塞文案债务。

## 发现 #1 评估

### 审查原文

> **[高][新] `effectiveScanPaths` 的 owner、执行时序与 IDE 预设来源仍未闭合**
> - 来源：structure+consistency+contract
> - 分类：patch
> - 涉及 Story：2-4、2-5、2-1、2-3
> - 证据 - Story 2.4 已把 effectiveScanPaths 公式写入 Dev Notes，并声明由 ScanService 负责；但 Story 2.5 的主链仍是 `loadConfig -> resolveAdapter -> discoverDocuments(projectRoot, config)`，两阶段事务契约里也没有单独的路径合成步骤。与此同时，Story 2.1 的适配器接口仍把文件发现职责定义为 adapter 基于 scanPaths / excludePaths 递归遍历，Story 2.4 的 FR40 / FR41 又承诺要覆盖 framework 与 IDE 预设路径以及"用户覆盖预设"，但公式里只出现 framework adapter 路径来源，没有独立的 IDE 预设提供方。
> - 影响 - effectiveScanPaths 现在仍然是半成品契约。Story 2.3 的 glob 护栏因此仍没有稳定承载点，FR38/FR40/FR41 在 config-loader、adapter 和 ScanService 之间仍可能出现分叉实现。
> - 建议 - 二选一统一边界：要么把 effectiveScanPaths 明确前置到 ScanService；要么彻底收回 adapter/discoverDocuments 契约。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 交叉核对确认：Story 2.4 Dev Notes `effectiveScanPaths 计算契约` 声明 "设计决策：effectiveScanPaths 的计算逻辑位于 ScanService.scan() 方法中"，但 Story 2.5 主流程步骤 3 仍写为 `adapter.discoverDocuments(projectRoot, config) → filePaths[]`，无独立路径合成步骤。Story 2.1 `IFrameworkAdapter.discoverDocuments(projectRoot, config): string[]` 仍定义为 adapter 独立执行文件发现。IDE 预设来源在 effectiveScanPaths 公式中确实缺失。

**严重性判断**：合理 — 路径计算是扫描链路的第一个关键步骤，owner 不明确会导致 Story 2.3 glob 护栏无着陆点、FR40/FR41 无法验收。

**修订建议**：可行 — 两种方案均可执行。推荐方案一（ScanService 前置合成），因为与 Story 2.4 已有表述方向一致。

**误报评估**：非误报 — 四份 Story 文档中路径职责确实存在分歧。

## 发现 #2 评估

### 审查原文

> **[高][上轮遗留] `relationTypes` 仍是假契约：共享 schema 未收敛，执行链路也没有统一过滤点**
> - 来源：consistency+contract
> - 分类：patch
> - 涉及 Story：2-4、2-5、1-3
> - 证据 - Story 2.4 AC #3 已把 relationTypes 定义为固定 9 类关系的启用/禁用配置；但 Story 1.3 仍把 relationTypes 定义为 `Record<string, unknown>` 的"自定义关系类型扩展"。Story 2.5 主链没有任何统一步骤去对两类关系应用 enabled/disabled 过滤。
> - 影响 - 当前文档同时承诺了两套互不兼容的真相。
> - 建议 - 先把 Story 1.3 与架构 D6 的 relationTypes 基线收敛为固定 9 类 enable/disable schema，再让 Story 2.4 复用；同时在 Story 2.5 明确增加统一过滤步骤。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 交叉核对确认：Story 1.3 `CordConfig.relationTypes` 类型签名为 `Record<string, unknown>`，注释写"自定义关系类型扩展"；Story 2.4 Dev Notes 却写"产品语义为「对已有 9 类关系的启用/禁用配置」，不支持扩展新关系类型"，并给出 `{ enabled: true/false }` 示例。两者类型签名与产品语义直接矛盾。Story 2.5 主流程 7 步中确实无 relationTypes 过滤步骤。

**严重性判断**：合理 — schema 层面的类型定义矛盾会直接影响实现者对 configSchema 的设计和消费方式，属于 AC 不可测级别问题。

**修订建议**：可行 — Story 2.4 已经注明"该修订属于 Epic 1 范围"，说明设计者已意识到需要回溯修改 Story 1.3。收敛路径清晰。

**误报评估**：非误报 — Story 1.3 与 Story 2.4 的类型签名直接矛盾，有明确文本证据。

## 发现 #3 评估

### 审查原文

> **[高][新] Story 2.5 的来源口径仍在 Epic / Story 两层保持两套真相**
> - 来源：structure+consistency
> - 分类：patch
> - 涉及 Story：2-5、2-6
> - 证据 - Story 2.5 AC #4 已明确区分 auto_scan 与 framework_preset 两种来源；但 Epic 2 对 Story 2.5 的 AC 仍写"每条关系记录来源为自动扫描"。
> - 影响 - framework preset 关系在 Story 层被要求实现，在 Epic 层却像是"不合规产物"。
> - 建议 - 同步改写 Epic 2 的 Story 2.5 验收口径。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 交叉核对确认：Epic 2 Story 2.5 AC 原文为"每条关系记录来源为'自动扫描'（FR21）"，Story 2.5 自身 AC #4 原文为"scan rule 产出的关系来源标记为 `auto_scan`，adapter preset rule 产出的关系来源标记为 `framework_preset`（FR21 + Story 1.3 RelationSource 三值契约）"。两层 AC 直接矛盾。

**严重性判断**：合理 — Epic AC 是验收基准文档，Story AC 与 Epic AC 矛盾会导致验收歧义。虽然修复简单（同步 Epic 2 措辞），但在修复前属于 AC 不可测。

**修订建议**：可行 — 仅需同步改写 Epic 2 的一行 AC 文案，工作量极小。

**误报评估**：非误报 — Epic 2 与 Story 2.5 的 AC 文本直接矛盾。

## 发现 #4 评估

### 审查原文

> **[高][新] Story 2.5 的 v0.1 全量 rebuild 现在与架构 D2"手动关系必须保留"直接冲突**
> - 来源：consistency+contract
> - 分类：decision_needed
> - 涉及 Story：2-5、1-4
> - 证据 - Story 2.5 已把 --rebuild 改为 deleteAllDocuments() + 全量重建，并明确"v0.1 不保留 manual 边"；但架构文档 D2 仍写明"用户手动添加的关系必须保留，排除按需重建方案"。
> - 影响 - Round 3 修订把冲突上移到了架构层。后续 Epic 4 一旦引入 manual 关系，会立刻重新变成数据保留风险。
> - 建议 - 做一次显式决策：要么把 D2 收窄，要么撤回 Story 2.5 的表述。

### 评估结论：⚠️ 有效但降级 — 建议纳入后续改善跟踪（P2）

### 评估分析

**问题描述准确性**：基本准确 — 审查者引用的 D2 原文正确，Story 2.5 的 rebuild 描述也正确。但审查者忽略了 D2 的语境限定：D2 标题为"数据迁移策略：版本号 + 增量 SQL 脚本"，完整理由是"CORD 是嵌入式本地数据库，不需要 ORM 级别的迁移框架；用户手动添加的关系必须保留，**排除按需重建方案**"。这里"按需重建方案"指的是用 rebuild-from-source 替代 versioned migration 的**数据库迁移策略**，而非 `cord scan --rebuild` 的扫描重建语义。

**严重性判断**：偏高 — D2 的约束域是 schema migration，不是 scan rebuild。此外 v0.1 不存在 manual 边（Epic 4 范畴），Story 2.5 已明确标注"v0.1 不保留 manual 边（Epic 4 实现手动关系后再细化 rebuild 策略，届时可引入基于 source 的条件删除或 upsert 模式）"，forward-looking 风险已被显式标记。建议从 P1 降为 P2。

**修订建议**：可行但非必要 — 可以在 D2 添加一句澄清注释（"此约束针对 schema migration 策略，不约束 scan --rebuild 行为"），但不应阻塞开发。

**误报评估**：非误报 — D2 措辞确实存在被过度解读的空间，值得澄清。但不构成硬阻塞。

## 发现 #5 评估

### 审查原文

> **[高][新] Story 2.6 对 modified 文档使用 `deleteRelationsByDocId(docId)` 仍会误删未修改文档的入边**
> - 来源：structure+consistency+contract
> - 分类：patch
> - 涉及 Story：2-6、1-4
> - 证据 - Story 2.6 步骤 9 直接对 modified 文档执行 `deleteRelationsByDocId(docId)`。Story 1.4 只给 getRelationsByDocId() 定义了方向参数，deleteRelationsByDocId() 却没有方向约束。
> - 影响 - 增量扫描会把来自未修改文档的 inbound relations 一起删掉，破坏增量与冷启动的结果等价性。
> - 建议 - 先在 Story 1.4 增补定向删除契约，再让 Story 2.6 改写步骤 9。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 交叉核对确认：Story 1.4 接口中 `deleteRelationsByDocId(docId: string): void` 无方向参数，而 `getRelationsByDocId(docId: string, direction?: 'source' | 'target' | 'both'): RelationEdge[]` 有方向参数。Story 2.6 步骤 9a 写"repo.deleteRelationsByDocId(docId) 删除旧关系边（v0.1 无 manual 边，等价于全量替换）"——这里的"全量替换"实际上是双向全量删除，而非仅删除该文档作为 source 的 outgoing 关系。

**严重性判断**：合理 — 这是一个数据完整性问题。假设文档 B→A 的关系存在且 B 未修改，当 A 被 modified 时：步骤 9a 会删除 B→A（因为 A 是 target），但步骤 5 仅重扫 A，不会恢复 B→A 关系。最终增量扫描结果缺失 B→A，与冷启动结果不等价。P1 数据完整性风险完全成立。

**修订建议**：可行 — 在 Story 1.4 为 deleteRelationsByDocId 增加 `direction` 参数（与 getRelationsByDocId 对齐），Story 2.6 步骤 9a 改为 `deleteRelationsByDocId(docId, 'source')` 仅删除 outgoing 关系。

**误报评估**：非误报 — 接口契约缺陷与数据完整性风险均可从文档文本直接推导。

## 发现 #6 评估

### 审查原文

> **[高][上轮遗留] Story 2.6 的 `sync_state` 写回仍未满足 Story 1.4 的完整 `SyncState` 契约**
> - 来源：structure+consistency+contract
> - 分类：patch
> - 涉及 Story：2-6、1-4
> - 证据 - Story 1.4 的 SyncState 仍要求全字段存在，upsertSyncState() 接收完整对象；但 Story 2.6 步骤 11 中，added/modified 分支缺少 lastScannedAt，renamed/moved 分支更只写 docId + lastObservedMtimeMs。LifecycleResult 载荷也没有提供缺失字段的来源。
> - 影响 - 无法在不发明"部分 upsert"隐式语义的前提下满足 1.4 的 Repository 契约。
> - 建议 - 要么写入完整 SyncState 对象，要么先在 1.4 新增 patch 型接口。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 交叉核对确认：Story 1.4 `upsertSyncState(state: SyncState): void`，`SyncState` 接口要求 `{ docId, lastScannedAt, lastObservedMtimeMs, contentHash, status }` 全部字段。Story 2.6 步骤 11：
- added: `{ docId, status: 'synced', lastObservedMtimeMs, contentHash }` — 缺 `lastScannedAt`
- modified: 同上 — 缺 `lastScannedAt`
- renamed/moved: `{ docId, lastObservedMtimeMs }` — 缺 `lastScannedAt`、`contentHash`、`status`

`LifecycleResult.renamed/moved` 载荷为 `{ oldPath, newPath, docId }`，确实不携带 hash 与时间戳。

**严重性判断**：合理 — 接口契约要求完整对象但调用方只提供部分字段，实现者必须私自决定缺失字段来源，属于 AC 不可测。

**修订建议**：可行 — 推荐方案一（补全 Story 2.6 写入完整 SyncState），因为 `lastScannedAt` 可用当前扫描时间戳（`new Date().toISOString()`），renamed/moved 的 `contentHash` 和 `status` 可从 StoredDocRecord 继承。

**误报评估**：非误报 — 字段缺失可从文档文本直接验证。

## 整体评估结论

### 需要修订（阻塞进入开发）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|------------|------|
| 1 | effectiveScanPaths owner/时序/IDE 来源 | [高] | P1 | 路径职责跨 4 Story 分裂 |
| 2 | relationTypes 共享 schema 未收敛 | [高] | P1 | Story 1.3 与 2.4 类型签名矛盾 |
| 3 | Epic/Story 来源口径两套真相 | [高] | P1 | Epic 2 AC 与 Story 2.5 AC 矛盾 |
| 5 | deleteRelationsByDocId 误删入边 | [高] | P1 | 增量扫描数据完整性风险 |
| 6 | SyncState 写回字段不完整 | [高] | P1 | 接口契约无法满足 |

### 建议纳入后续改善跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|------------|------|
| 4 | rebuild 与 D2 措辞冲突 | [高] | P2 | D2 语境为迁移策略，非 scan rebuild |

### 可忽略（误报）

无。

### 评估决定

**整体结论**：需修订后再审

建议按以下优先级执行修订：(1) 收敛 effectiveScanPaths owner（#1）→ (2) 对齐 relationTypes schema（#2）→ (3) 同步 Epic 2 来源 AC（#3）→ (4) 补全 deleteRelationsByDocId 方向参数（#5）→ (5) 完善 SyncState 写回（#6）→ (6) 可选澄清 D2 scope（#4）。完成后提交第 5 轮复审。

## 修订执行记录

### 修订执行记录
- **Date**: 2026-04-16
- **Model Used**: Claude Sonnet 4.6 (github-copilot)
- **Fix Items**: 8

#### 修订项 #1: Story 2-5 主链插入 computeEffectiveScanPaths 步骤（发现 #1 — A1）
- **文件**: `_bmad-output/implementation-artifacts/stories/2-5-scanservice-cold-start-scan-and-graph-write.md`
- **章节**: Tasks > Task 1.3 + Dev Notes > ScanService 流程
- **修改摘要**: (1) Task 1.3 在 `resolveAdapter` 和 `discoverDocuments` 之间显式插入 `computeEffectiveScanPaths`。(2) 主链步骤 3 前新增步骤 2b：`computeEffectiveScanPaths(config, adapter) → { scanPaths, excludePaths }`，并注明依据 Story 2.4 契约。(3) 步骤 3 改为 `adapter.discoverDocuments(projectRoot, scanPaths, excludePaths)`，接收预计算路径。
- **状态**: 已完成

#### 修订项 #2: Story 2-1 discoverDocuments 签名改为接收预计算路径（发现 #1 — A2）
- **文件**: `_bmad-output/implementation-artifacts/stories/2-1-framework-adapter-interface-and-generic-fallback.md`
- **章节**: Dev Notes > IFrameworkAdapter 接口设计
- **修改摘要**: `discoverDocuments` 签名从 `(projectRoot: string, config: CordConfig): string[]` 改为 `(projectRoot: string, scanPaths: string[], excludePaths: string[]): string[]`，新增注释说明路径由 ScanService.computeEffectiveScanPaths() 预计算传入，adapter 不再直接消费 CordConfig 决定扫描范围。
- **状态**: 已完成

#### 修订项 #3: Story 2-4 effectiveScanPaths 公式补入 IDE 预设来源（发现 #1 — A3）
- **文件**: `_bmad-output/implementation-artifacts/stories/2-4-config-loading-and-document-scope.md`
- **章节**: Dev Notes > effectiveScanPaths 计算契约
- **修改摘要**: 原步骤 2「框架预设追加」明确为"已解析框架 adapter 的 getScanPaths"；步骤 3 新增"IDE 预设追加：config.ide 已配置时通过 IDE adapter 的 getScanPaths 追加，未配置时跳过"；原步骤 3-5 顺移为 4-6，排除优先级中"框架预设"扩展为"框架/IDE 预设"。IDE 预设路径来源缺口闭合。
- **状态**: 已完成

#### 修订项 #4: Story 1-3 CordConfig.relationTypes 类型签名收敛（发现 #2 — B1）
- **文件**: `_bmad-output/implementation-artifacts/stories/1-3-zod-validation-layer-and-core-type-definitions.md`
- **章节**: Dev Notes > CordConfig 类型
- **修改摘要**: `relationTypes` 从 `Record<string, unknown>` + 注释"自定义关系类型扩展"改为 `Partial<Record<RelationType, { enabled: boolean }>>` + 注释"已有 9 类关系的启用/禁用配置（不支持扩展新类型），与 Story 2.4 的 relationTypes 语义对齐"。消除了 Story 1.3 与 Story 2.4 之间的类型签名矛盾。
- **状态**: 已完成

#### 修订项 #5: Epic 2 Story 2.5 AC 来源口径同步（发现 #3 — C1）
- **文件**: `_bmad-output/planning-artifacts/epics/epic-2文档扫描与关系图谱构建.md`
- **章节**: Story 2.5 Acceptance Criteria
- **修改摘要**: 将"每条关系记录来源为'自动扫描'（FR21）"改为"scan rule 产出的关系来源标记为 `auto_scan`，adapter preset rule 产出的关系来源标记为 `framework_preset`（FR21 + RelationSource 三值契约）"，与 Story 2.5 自身 AC #4 完全对齐。
- **状态**: 已完成

#### 修订项 #6: Story 1-4 deleteRelationsByDocId 增加 direction 参数（发现 #5 — D1）
- **文件**: `_bmad-output/implementation-artifacts/stories/1-4-sqlite-storage-layer-and-data-migration.md`
- **章节**: Dev Notes > IGraphRepository 接口 > 关系边操作
- **修改摘要**: `deleteRelationsByDocId(docId: string): void` 改为 `deleteRelationsByDocId(docId: string, direction?: 'source' | 'target' | 'both'): void`，与 `getRelationsByDocId` 的 direction 参数对齐，新增注释说明默认 'both'，增量扫描 modified 文档时使用 'source' 仅删 outgoing 边。
- **状态**: 已完成

#### 修订项 #7: Story 2-6 步骤 9a 指定 source 方向（发现 #5 — D2）
- **文件**: `_bmad-output/implementation-artifacts/stories/2-6-incremental-scan-and-document-lifecycle-detection.md`
- **章节**: Dev Notes > 增量扫描流程 > 阶段 2 事务内步骤 9
- **修改摘要**: 步骤 9a 从 `repo.deleteRelationsByDocId(docId)` 改为 `repo.deleteRelationsByDocId(docId, 'source')`，新增说明"指定 'source' 方向确保仅删除该文档作为 sourceDoc 的边，不影响其他文档指向本文档的 inbound 边"，移除误导性的"v0.1 无 manual 边，等价于全量替换"注释。
- **状态**: 已完成

#### 修订项 #8: Story 2-6 步骤 11 补全 SyncState 全字段（发现 #6 — E1）
- **文件**: `_bmad-output/implementation-artifacts/stories/2-6-incremental-scan-and-document-lifecycle-detection.md`
- **章节**: Dev Notes > 增量扫描流程 > 阶段 2 事务内步骤 11
- **修改摘要**: 步骤 11 四路径均补全 Story 1.4 SyncState 所需的全部字段：added/modified 补入 `lastScannedAt: new Date().toISOString()`；renamed/moved 从 StoredDocRecord 继承 contentHash 和 status，更新 lastScannedAt 和 lastObservedMtimeMs；deleted 维持"cascade 已清除"说明。满足 `upsertSyncState(state: SyncState)` 全字段契约，消除了"部分 upsert 隐式语义"歧义。
- **状态**: 已完成

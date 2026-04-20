---
Epic: 2
Scope: epic
Round: 8
Date: 2026-04-17
Model Used: Claude Opus 4.6 (github-copilot)
Review Source: epic-2-story-review-summary-20260417-round-8.md
Review Model: GPT-5.4 (github-copilot)
Type: Story Review Evaluation
---

## 评估总结

第 8 轮审查共 2 条发现（均 [中]），经逐条交叉验证，**2 条均有效但降级为 P2**，无 P1，无误报。**Epic 2 可以进入开发。**

R7 的 2 条 P1 已全部确认修复关闭：Story 2.6 的数据一致性说明已正确限定为 modified/added 路径等价 + rename/move v0.1 path-only 豁免，Epic 2 父级 AC 也已同步。本轮 2 条新发现均为局部契约完善类问题——异常文档跳过的结果形状未在共享类型中预定义、renamed/moved 伪代码的字段名歧义——两者的行为意图在 AC 和任务列表中已明确，实现者（按 Story 依赖链顺序开发）可在 Story 2.2 实现阶段自然解决，不构成阻塞。

经过 8 轮 review-evaluate 迭代，Epic 2 的核心阻塞线（effectiveScanPaths owner、relationTypes 闭环、discovery/build 链路复用、rename/move 范围收束、SyncState 写回、Epic-Story AC 对齐）已全部关闭。P1 趋势：5→5→3→3→2→0，Epic 2 可直接进入开发。

## 上轮问题回顾确认

### Round 7 / Finding #1 — Story 2.6 数据一致性说明的无条件等价断言：已确认修复

Story 2.6 数据一致性说明原文现为：「对于 modified/added 文档，增量路径复用冷启动的完整构建子链路（步骤 5），确保 framework_preset 关系被正确刷新，满足 `cord scan --rebuild` 与增量扫描在 **modified/added 路径上**的结果等价。rename/move 在 v0.1 仅更新 `documents.path`，不保证路径敏感的 docType 与 preset 关系同步（延至 v0.2）。」等价断言已正确限定为 modified/added 场景，rename/move 豁免已显式声明。该问题关闭。

### Round 7 / Finding #2 — Epic 2 父级 AC 未同步 v0.1 path-only 范围：已确认修复

Epic 2 中 Story 2.6 的 rename AC 原文现为：「检测到文档重命名时，更新图谱中的文档路径（v0.1：仅更新路径；路径敏感的 docType 重分类与 preset 关系刷新延至 v0.2）」。与 Story 2.6 AC 3 的 v0.1 path-only 约束完全对齐。该问题关闭。

### 历史非阻塞待办

1. **IDE preset provider 缺失**（R5#2）：维持 P2。`config.ide` 为空时链路正常执行，v0.1 无功能影响。
2. **inbound `framework_preset` 边 modified-only 刷新**（R5#5）：维持 P2。仅修改内容不改路径时 preset 边稳定。
3. **无变更快返前全量计算 `contentHash`**：维持 P2。性能优化项。
4. **project-context 中 BMAD 文档类型 18 vs 16 口径差异**（R8 新增 P2）：建议后续与 Story 2.3 的 v0.1 范围同步。

## 发现 #1 评估

### 审查原文

> **[中][新] 异常文档"跳过"语义尚未进入 ScanPipelineResult 共享契约**
> - 来源：contract
> - 分类：patch
> - 涉及 Story：2-2、2-5
> - 证据 - Story 2.2 的 AC 8 要求异常文档跳过并记录 WARNING（编码错误/非 Markdown/超大 > 1MB）；但 Story 2.2 中 `ScanPipelineResult` 仍被定义为必含 `document` 的结构 `{ document, relations, warnings }`。与此同时，Story 2.5 的主流程将每次 `pipeline.process` 结果直接送入 `docType classify`、`warnings` 聚合和写入计划，没有说明 skipped 分支如何表示。
> - 影响 - 当前文档没有定义异常文档跳过时的结果形状。实现者无法判断 `pipeline.process` 应返回 warning-only 结果、null/union、还是抛异常再由 ScanService 捕获，容易把本应跳过的文件继续送入 classify 和写入计划，或自行发明未文档化的分支。
> - 建议 - 将 2.2 与 2.5 的边界显式写成可跳过的结果契约：要么将 `pipeline.process` 定义为成功/跳过二元结果，跳过分支只返回 warnings；要么把跳过判定前移为独立预检步骤，并在 2.5 明确只有成功解析的结果才进入 `docType classify` 和写入计划。

### 评估结论：⚠️ 有效但降级 — 建议纳入后续改善跟踪（P2）

### 评估分析

**问题描述准确性**：基本准确 — 经交叉验证，`ScanPipelineResult` 的类型定义确实为 `{ document: ParsedDocument; relations: DiscoveredRelation[]; warnings: string[] }`，`document` 字段无可选标记。Story 2.5 主流程步骤 4 将 `pipeline.process` 结果直接送入步骤 5 docType classify，未提及跳过分支。共享类型契约确实存在空缺。

**严重性判断**：偏高，降级为 P2 — 审查标记 [中] 并以此构成硬阻塞，但以下因素使其不满足 P1（阻塞进入开发）的定义：
1. **行为 AC 已明确**：Story 2.2 AC 8 明确定义「跳过并记录 WARNING」，行为需求不模糊。
2. **任务列表已显式覆盖**：Story 2.2 Task 5 逐条列出三种异常场景（5.1 文件大小、5.2 非 .md、5.3 编码错误）的处理方式。实现者按任务列表开发不会遗漏跳过行为。
3. **依赖链保证顺序**：Story 2.5 依赖 Story 2.2 完成。Story 2.2 的实现者在编写 `pipeline.process` API 时必须做出跳过形状的设计选择（null/union/pre-check），该选择成为 Story 2.5 实现的实际消费契约。
4. **预检分流可行**：三种异常场景中，文件大小（5.1）和扩展名（5.2）可在调用 `pipeline.process` 之前过滤掉，仅编码错误（5.3）需在 pipeline 内部处理。实现者有明确的自然分界点。

类型定义的空缺值得补充（建议后续将 `ScanPipelineResult` 改为 `ScanPipelineResult | null` 或添加 `skipped: boolean` 字段），但不阻塞开发。

**修订建议**：可行但非必要 — 审查提出的两种修订方案（二元结果 / 预检前移）均可行。建议在 Story 2.2 开发时由实现者一并确定，作为 P2 跟踪项。

**误报评估**：非误报 — 类型定义确实存在空缺，但影响被依赖链和任务列表充分缓解。

## 发现 #2 评估

### 审查原文

> **[中][新] `LifecycleResult` 的 renamed/moved 输出字段与 SyncState 写回示例不一致**
> - 来源：contract
> - 分类：patch
> - 涉及 Story：2-6
> - 证据 - Story 2.6 中 `LifecycleResult.renamed/moved` 已被定义为包含 `currentMtimeMs` 的结果项；但同一文档步骤 11 的 renamed/moved `SyncState` 写回示例仍使用 `lastObservedMtimeMs: current.mtimeMs`。Story 1.4 又明确 `SyncState.lastObservedMtimeMs` 是增量扫描依赖字段，而 Story 2.6 自己也要求步骤 11 满足 Story 1.4 的全字段契约。
> - 影响 - 实现者无法从现有文档判断 renamed/moved 分支究竟应直接消费 `LifecycleResult.currentMtimeMs`，还是额外维护一个 current snapshot lookup 再读取 `current.mtimeMs`。按现文案实现，需要自行猜测字段映射，容易导致 `lastObservedMtimeMs` 写错或遗漏。
> - 建议 - 将 Story 2.6 步骤 11 与 `LifecycleResult` 契约对齐：要么直接写明 renamed/moved 使用 `currentMtimeMs` 写回 `lastObservedMtimeMs`；要么补充一个显式的 current snapshot lookup 契约，并统一字段名。

### 评估结论：⚠️ 有效但降级 — 建议纳入后续改善跟踪（P2）

### 评估分析

**问题描述准确性**：基本准确 — 经交叉验证，`LifecycleResult.renamed` 的类型定义为 `{ oldPath: string; newPath: string; docId: string; currentMtimeMs: number }[]`，字段名为 `currentMtimeMs`。步骤 11 renamed/moved 写回示例为 `lastObservedMtimeMs: current.mtimeMs`，其中 `current` 变量指代不明——如果 `current` 是 `LifecycleResult.renamed[i]`，正确访问路径应为 `current.currentMtimeMs` 而非 `current.mtimeMs`（该类型没有 `mtimeMs` 字段）。如果 `current` 指代 `CurrentFileSnapshot`，则需要额外的 lookup 逻辑，步骤 11 未描述。

**严重性判断**：偏高，降级为 P2 — 审查标记 [中] 并以此构成硬阻塞，但以下因素使其不满足 P1 定义：
1. **数据来源无歧义**：`LifecycleResult.renamed[i].currentMtimeMs` 明确包含所需数据，实现者阅读类型定义即可确定写入值。
2. **语义意图清晰**：步骤 11 的伪代码虽然变量名不精确，但 `lastObservedMtimeMs: <当前文件的 mtimeMs>` 的语义是显然的——将当前文件的修改时间写入 SyncState。
3. **单 Story 内部问题**：该不一致完全在 Story 2.6 内部，不涉及跨 Story 契约。实现者在开发 Story 2.6 时，类型定义和伪代码在同一文件中，可自然对齐。
4. **伪代码本质为示意**：Story spec 中的伪代码并非编译通过的代码，变量命名的精确性要求应低于类型定义。

建议后续将步骤 11 改为 `lastObservedMtimeMs: item.currentMtimeMs`（使用 LifecycleResult 迭代变量），消除歧义。但不阻塞开发。

**修订建议**：可行但非必要 — 改一个变量名即可，工作量极小。建议作为 P2 跟踪项。

**误报评估**：非误报 — 变量名不匹配客观存在，但影响程度有限。

## 整体评估结论

### 需要修订（阻塞进入开发）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|------------|------|
| — | （本轮无 P1） | — | — | — |

### 建议纳入后续改善跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|------------|------|
| 1 | ScanPipelineResult 跳过形状未预定义 | [中] | P2 | AC+任务已覆盖，依赖链保证对齐 |
| 2 | renamed/moved 伪代码字段名歧义 | [中] | P2 | 类型定义已含数据，语义清晰 |

历史 P2 待办（跨轮次延续）：
- IDE preset provider 缺失（R5#2）
- inbound `framework_preset` 边 modified-only 刷新（R5#5）
- 无变更快返前全量 `contentHash` 计算
- project-context BMAD 文档类型 18 vs 16 口径差异（R8 新增）

### 可忽略（误报）

| # | 发现 | 原始严重性 | 忽略理由 |
|---|------|----------|---------|
| — | （本轮无误报） | — | — |

### 评估决定

**整体结论**：可直接进入开发

经过 8 轮 SR review-evaluate 迭代，Epic 2 的所有 P0/P1 阻塞项已全部关闭。本轮 2 条新发现均为契约完善类改进（P2），行为需求已在 AC 和任务列表中明确，实现者按 Story 依赖链顺序开发可自然解决。Epic 2 可进入开发阶段。

**P1 收敛趋势**：R1=5 → R2=5 → R3=5 → R4=5 → R5=3 → R6=3 → R7=2 → **R8=0**

---

## 修订执行记录

- **Date**: 2026-04-17
- **Model Used**: Claude Sonnet 4.6 (github-copilot)
- **Fix Items**: 0（本轮无 P1，Epic 2 已通过 SR 审查，可进入开发）

本轮 2 条发现均为 P2（非阻塞），不满足"需要修订"条件，无文档修改操作。

**P2 跟踪项**（不修订，留待后续版本）：

| # | 发现 | 说明 |
|---|------|------|
| R8-#1 | ScanPipelineResult 跳过形状未预定义 | Story 2.2 实现阶段由实现者确定 null/union/pre-check 形状 |
| R8-#2 | renamed/moved 伪代码字段名歧义（`current.mtimeMs` 应为 `item.currentMtimeMs`） | 开发 Story 2.6 时参照 LifecycleResult 类型定义即可对齐 |

---

## P2 补充修订记录（用户额外请求）

- **Date**: 2026-04-17
- **Model Used**: Claude Sonnet 4.6 (github-copilot)
- **Fix Items**: 2 条 P2 补充说明/修正（3 处文档修改）

#### P2 修订项 #1：Story 2.2 `ScanPipelineResult` 补入跳过契约说明（R8-P2-#1）

- **文件**: `_bmad-output/implementation-artifacts/stories/2-2-scan-engine-core-pipeline-remark-ast-and-rules.md`
- **章节**: Dev Notes > 类型定义 > `ScanPipelineResult`
- **修改摘要**: 在类型定义后新增 JSDoc 注释，明确 `pipeline.process` 返回 `ScanPipelineResult | null`；预检方案：大小/扩展名在调用前预检（Task 5.1/5.2），编码错误在内部 try-catch 返回 null（Task 5.3）；null 结果跳过，不进入 docType classify 和写入计划。
- **状态**: 已完成

#### P2 修订项 #2：Story 2.5 步骤 4 补入跳过分支说明（R8-P2-#1 联动）

- **文件**: `_bmad-output/implementation-artifacts/stories/2-5-scanservice-cold-start-scan-and-graph-write.md`
- **章节**: Dev Notes > ScanService 流程 > 步骤 4
- **修改摘要**: 步骤 4 展开为三条分支：预检（大小/扩展名）→ 跳过推 warnings；`pipeline.process` 返回 null → 跳过推 warnings；返回非 null → 进入后续 classify 链路。消除实现者对跳过场景的猜测空间。
- **状态**: 已完成

#### P2 修订项 #3：Story 2.6 步骤 11 字段名对齐 `LifecycleResult`（R8-P2-#2）

- **文件**: `_bmad-output/implementation-artifacts/stories/2-6-incremental-scan-and-document-lifecycle-detection.md`
- **章节**: 增量扫描流程 > 阶段 2 步骤 11 > renamed/moved 写回
- **修改摘要**: `lastObservedMtimeMs: current.mtimeMs` → `lastObservedMtimeMs: item.currentMtimeMs`，并补注释说明 `item` 为迭代 `LifecycleResult.renamed/moved` 的当前元素，`currentMtimeMs` 字段与类型定义对齐，消除变量名歧义。
- **状态**: 已完成

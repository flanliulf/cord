---
Epic: 2
Scope: epic
Round: 6
Date: 2026-04-16
Model Used: Claude Opus 4.6 (github-copilot)
Review Source: epic-2-story-review-summary-20260416-round-6.md
Review Model: GPT-5.4 (github-copilot)
Type: Story Review Evaluation
---

## 评估总结

第 6 轮审查共 3 条发现，全部标记为 [高]。经逐条交叉验证，**3 条全部确认有效（P1）**，无降级、无误报。审查质量继续保持高水准——每条发现均准确定位到 Story 文档原文，证据链清晰，修订建议具体可行。

与第 5 轮对比，阻塞面从 3 P1 + 2 P2 缩减为 3 P1 + 0 新增 P2。其中 2 条为上轮遗留的收窄变体（effectiveScanPaths 链路复用、`relationTypes` 过滤闭环），1 条为新发现的 AC-实现矛盾（rename/move 路径敏感刷新）。R5/Finding #4（SyncState 写回数据来源缺口）确认已修复关闭。阻塞面虽收敛但核心问题仍未关闭，需修订后再审。

## 上轮问题回顾确认

### Round 5 / Finding #4 — renamed/moved `SyncState` 写回数据来源缺口：已确认修复

Story 2.6 的 `StoredDocRecord` 现已包含 `status: 'synced' | 'modified'` 字段，`LifecycleResult.renamed/moved` 已新增 `currentMtimeMs: number` 字段。步骤 11 的 renamed/moved 分支完整写回：`upsertSyncState({ docId, lastScannedAt: new Date().toISOString(), lastObservedMtimeMs: current.mtimeMs, contentHash: stored.contentHash, status: stored.status })`，所有字段均有明确数据来源，该问题不再构成阻塞。

### Round 5 / Finding #1 — `effectiveScanPaths` 冷启动/增量入口残留不一致：仍为遗留

Story 2.6 阶段 1 步骤 1 仍使用 `discoverDocuments(effectiveScanPaths, excludePaths)` 而非 Story 2.1 接口的 `discoverDocuments(projectRoot, scanPaths, excludePaths)`，且缺少 `loadConfig → resolveAdapter → computeEffectiveScanPaths` 显式前置链路。本轮以 Finding #1 继续追踪。

### Round 5 / Finding #3 — `relationTypes` 过期文案 + 执行链无过滤步骤：仍为遗留

Story 2.4/D6 的旧口径已清理，Story 2.5 主流程和任务列表已补入 `relationTypes` 过滤。但 Story 2.5 的两阶段契约摘要和 Story 2.6 步骤 5 的显式步骤列表仍未包含该过滤步骤。本轮以 Finding #2 继续追踪。

### 历史非阻塞待办

1. **IDE preset provider 缺失**：维持 P2。`config.ide` 为空时链路正常执行（Story 2.4 明确"未配置时跳过"），v0.1 范围内无功能影响。
2. **inbound `framework_preset` 边增量刷新（modified-only 场景）**：维持 P2。仅修改内容不改路径时，`docType` 由文件名模式决定不受影响，preset 边稳定。注：rename/move 变体已升级为本轮 Finding #3 新阻塞。
3. **Story 2.6 无变更快返前全量计算 `contentHash`**：维持 P2。性能优化项，不影响功能正确性。
4. **Epic 2 / Story 2.6 的 rename/delete AC 旧措辞**：维持文案债务。

## 发现 #1 评估

### 审查原文

> **[高][上轮遗留] Story 2.6 仍未显式复用 2.5 的完整前置发现链路**
> - 来源：structure+consistency
> - 分类：patch
> - 涉及 Story：2-1、2-5、2-6
> - 证据 - Story 2.1 已将 `discoverDocuments` 收敛为 `discoverDocuments(projectRoot, scanPaths, excludePaths)`，Story 2.5 也已明确冷启动主链为 `loadConfig -> resolveAdapter -> computeEffectiveScanPaths -> adapter.discoverDocuments(projectRoot, scanPaths, excludePaths)`；但 Story 2.6 的阶段 1 仍从 `discoverDocuments(effectiveScanPaths, excludePaths)` 直接起步，未显式复用同一条前置发现链路。
> - 影响 - 增量路径仍像是在定义一条裁剪版 discovery 入口，而不是复用冷启动的同一 owner 与同一顺序。实现时容易绕过 `projectRoot`、adapter resolution 或 `effectiveScanPaths` 的唯一落点，导致冷启动与增量扫描候选文件集合不再稳定等价。
> - 建议 - 将 Story 2.6 的阶段 1 直接改写为"复用 Story 2.5 的步骤 1-3"，至少显式写出 `loadConfig(projectRoot) -> resolveAdapter(config, projectRoot) -> computeEffectiveScanPaths(config, adapter) -> adapter.discoverDocuments(projectRoot, scanPaths, excludePaths)`。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 经交叉验证，Story 2.6 增量扫描流程阶段 1 步骤 1 原文为 `discoverDocuments(effectiveScanPaths, excludePaths) → 当前文件路径`。该签名与 Story 2.1 的接口定义 `discoverDocuments(projectRoot: string, scanPaths: string[], excludePaths: string[]): string[]` 不匹配：缺少 `projectRoot` 参数，且将 `effectiveScanPaths` 作为单一参数传入而非拆分为 `scanPaths` + `excludePaths`。同时步骤 1 之前缺少 `loadConfig → resolveAdapter → computeEffectiveScanPaths` 显式前置步骤。

**严重性判断**：合理 — 接口签名不匹配是硬一致性缺陷。虽然 Story 2.6 是 ScanService 的增量扩展（Task 2），理论上应共享 `scan()` 方法的前置步骤，但规格文档中增量流程被表述为独立的阶段 1-2 序列，与冷启动流程物理分离。实现者阅读 2.6 文档时极可能按字面意思实现，绕过冷启动的完整前置链路。

**修订建议**：可行 — 将 Story 2.6 阶段 1 显式改写为"复用 Story 2.5 步骤 1-3"并写出完整链路，工作量极小且能从根源消除歧义。

**误报评估**：非误报 — 接口签名的不匹配是客观事实，可在源文档中逐字验证。

## 发现 #2 评估

### 审查原文

> **[高][上轮遗留] `relationTypes` 过滤仍未进入 2.5 阶段契约与 2.6 完整构建子链路**
> - 来源：structure+consistency
> - 分类：patch
> - 涉及 Story：2-5、2-6
> - 证据 - Story 2.5 的 Task 1.3 与主流程 7c 已补入 `relationTypes` 过滤，说明 schema 层和主链层已经对齐；但 Story 2.5 的两阶段事务"阶段 1"仍只声明 `pipeline.process + docType classify + preset merge + merge/dedupe`，Story 2.6 的步骤 5 也仍把"与冷启动相同的完整构建子链路"显式写到 `merge/dedupe` 为止。
> - 影响 - `relationTypes` 目前已经不再是 2.4 / 1.3 / D6 的口径问题，而是最后一段执行闭环问题。若阶段契约与增量复用链路不显式纳入该步骤，禁用关系类型不会进入写入计划这一 AC 语义仍无法端到端稳定验证。
> - 建议 - 把 `relationTypes` 过滤补入 Story 2.5 的阶段 1 产物定义，并在 Story 2.6 步骤 5 明确声明"复用 Story 2.5 的完整构建链路"，或至少显式补出该过滤步骤。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 经交叉验证，Story 2.5 的两阶段事务契约阶段 1 摘要原文为 `loadConfig、resolveAdapter、computeEffectiveScanPaths、discoverDocuments / pipeline.process / docType classify + preset merge + merge/dedupe / 产出：完整的写入计划`，确实在 `merge/dedupe` 之后直接跳到"产出"，未列出 `relationTypes 过滤`。Story 2.6 步骤 5 原文的显式链路为 `pipeline.process → ... → docType classify → preset merge → merge/dedupe`，也在 `merge/dedupe` 处截止。虽然 Story 2.5 主流程步骤 7c 和 Task 1.6b 已明确包含 `relationTypes` 过滤，但这两个关键摘要位置均遗漏了该步骤。

**严重性判断**：合理（borderline P1/P2） — 严格来说，Story 2.5 的 Task 1.3 和主流程已明确列出完整链路（含 `relationTypes 过滤`），实现者按任务列表开发不会遗漏。但两阶段契约和 Story 2.6 步骤 5 是跨 Story 引用的核心参考点，阅读这些摘要的开发者（尤其是负责 2.6 的开发者）可能仅依赖摘要而非回读 2.5 的完整任务列表。考虑到 Story 2.6 步骤 5 的括号注释"复用 Story 2.5 定义的完整链路"在语义上已暗含全部步骤，但显式列表的截止位置构成了可测量的遗漏风险。维持 P1 — 修复成本极低（各补一个步骤名称），而遗漏后果是增量路径跳过 `relationTypes` 过滤。

**修订建议**：可行 — 在 Story 2.5 两阶段契约的阶段 1 列表中 `merge/dedupe` 后补入 `relationTypes 过滤`，在 Story 2.6 步骤 5 的显式步骤列表中同样补入。工作量极小。

**误报评估**：非误报 — 两处显式步骤列表的遗漏可在源文档中逐字验证。

## 发现 #3 评估

### 审查原文

> **[高][新] rename/move 仍被建模为仅更新 path，路径敏感关系刷新无法保证**
> - 来源：structure+consistency+contract
> - 分类：patch
> - 涉及 Story：2-3、2-5、2-6
> - 证据 - Story 2.6 的 AC 3 要求"检测到文档重命名时，更新图谱中的文档路径和相关关系边"，但阶段 2 的步骤 8 仍定义为 `repo.updateDocument(docId, { path: newPath })` 且注明"关系边按 docId 建立，无需修改"；与此同时，Story 2.3 的 docType 定义与 preset rules 本身都依赖路径模式，Story 2.5 的冷启动完整链路也明确包含 `docType classify` 与 `preset merge`。
> - 影响 - rename 或 move 会改变路径命中结果，从而影响 docType、相对路径解析以及 `framework_preset` 关系。2.6 当前只更新 `documents.path`，不会重算这些路径敏感结果，既与 AC 3 的"更新相关关系边"冲突，也无法保证增量结果与冷启动或 rebuild 等价。
> - 建议 - 将 renamed/moved 纳入与 modified/added 相同的完整重建子链路，至少对受影响文档重算 docType 和相关关系；如果 v0.1 暂不支持，就必须把 Story 2.6 的 AC 与事务说明显式收缩为"仅支持不会改变 docType 或入边的 rename/move"。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 经交叉验证存在以下客观矛盾：
1. Story 2.6 AC 3 原文：「检测到文档重命名时，更新图谱中的文档路径**和相关关系边**」
2. Story 2.6 步骤 8 原文：`repo.updateDocument(docId, { path: newPath })`，注明「关系边按 docId 建立，**无需修改**」
3. Story 2.3 的 docType 通过路径模式 glob 匹配（如 `**/prd*.md`、`**/brainstorming*.md`），路径变更可能导致 docType 重分类
4. Story 2.5 冷启动链路明确包含 `docType classify → preset merge`，产出的 `framework_preset` 关系依赖 docType

AC 声明"更新关系边"与步骤说明"无需修改"构成直接矛盾。路径敏感的 docType 和 preset 规则使得 rename/move 在理论上需要重算关系。

**严重性判断**：合理 — 三层来源（structure+consistency+contract）命中，AC 与实现步骤的直接矛盾是不可忽视的规格缺陷。实际影响取决于 rename/move 是否改变 docType：同类目录内的重命名（如 `prd.md → prd-v2.md`）通常不改变 docType，但跨目录移动（如从 `planning-artifacts/` 到 `brainstorming/`）会。v0.1 中此场景虽不频繁，但 AC 的承诺范围无条件覆盖了所有 rename/move 情况。

**修订建议**：可行 — 审查提出的两条修订路径都是可行的：（1）扩展实现——将 renamed/moved 纳入 modified/added 相同的完整重建子链路；（2）收缩 AC——显式声明 v0.1 仅支持不改变 docType 的 rename/move，路径敏感刷新延至 v0.2。推荐路径（2），因为全面刷新的实现复杂度较高（需处理级联删边+重建），且 v0.1 的 rename/move 检测本身是基于 content_hash 的启发式匹配，将其定位为"路径更新 + 最小一致性保证"更符合 MVP 定位。

**误报评估**：非误报 — AC 3 与步骤 8 的矛盾可在源文档中逐字验证，路径敏感 docType 规则见 Story 2.3 文档类型表。

## 整体评估结论

### 需要修订（阻塞进入开发）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|------------|------|
| 1 | Story 2.6 未显式复用 2.5 完整前置发现链路 | [高] | P1 | 接口签名不匹配+缺显式前置步骤 |
| 2 | `relationTypes` 过滤未入阶段契约与增量子链路 | [高] | P1 | 两处摘要遗漏，修复成本极低 |
| 3 | rename/move 仅更新 path，AC 与实现矛盾 | [高] | P1 | AC 收缩或实现扩展二选一 |

### 建议纳入后续改善跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|------------|------|
| — | （本轮无新增 P2） | — | — | — |

历史 P2 待办（跨轮次延续）：
- IDE preset provider 缺失（R5#2）
- inbound `framework_preset` 边 modified-only 刷新（R5#5）
- 无变更快返前全量 `contentHash` 计算
- rename/delete AC 旧措辞

### 可忽略（误报）

| # | 发现 | 原始严重性 | 忽略理由 |
|---|------|----------|---------|
| — | （本轮无误报） | — | — |

### 评估决定

**整体结论**：需修订后再审

修订建议：
1. **Finding #1 + #2 可合并修订**：将 Story 2.6 阶段 1 改写为显式复用 Story 2.5 步骤 1-3（含完整签名），并在 Story 2.5 两阶段契约和 Story 2.6 步骤 5 的显式列表中补入 `relationTypes 过滤`。工作量极小，属于文档对齐类修订。
2. **Finding #3 需产品决策**：推荐收缩 AC 3 范围——显式声明 v0.1 的 rename/move 仅更新 `documents.path`，不保证路径敏感的 docType 和 preset 关系刷新（延至 v0.2 全面路径感知的 rename/move 支持）。对应调整步骤 8 注释与架构约束说明，消除 AC-实现矛盾。

**趋势观察**：P1 阻塞数 R3=5 → R4=5 → R5=3 → R6=3。Finding #1/#2 是连续多轮的文档对齐残留，本轮修复难度已降至最低（逐字补入即可）；Finding #3 是新发现但有明确的 AC 收缩路径。预计下一轮可收敛至 0-1 P1。

---

## 修订执行记录

- **Date**: 2026-04-16
- **Model Used**: Claude Sonnet 4.6 (github-copilot)
- **Fix Items**: 3 条 P1（5 处文档修改）

#### 修订项 #1：Story 2.6 补入完整前置发现链路（Finding #1）

- **文件**: `_bmad-output/implementation-artifacts/stories/2-6-incremental-scan-and-document-lifecycle-detection.md`
- **章节**: 增量扫描流程（两阶段事务契约）> 阶段 1 步骤 1
- **修改摘要**: 将 `discoverDocuments(effectiveScanPaths, excludePaths)` 展开为完整四步链路 `loadConfig(projectRoot) → resolveAdapter(config, projectRoot) → computeEffectiveScanPaths(config, adapter) → adapter.discoverDocuments(projectRoot, scanPaths, excludePaths)`，并加注"复用 Story 2.5 步骤 1-3，冷启动与增量共享同一前置发现链路"。接口签名现与 Story 2.1 `discoverDocuments(projectRoot, scanPaths, excludePaths)` 一致。
- **状态**: 已完成

#### 修订项 #2：两处摘要补入 `relationTypes 过滤`（Finding #2）

- **文件**: `_bmad-output/implementation-artifacts/stories/2-5-scanservice-cold-start-scan-and-graph-write.md`
- **章节**: 两阶段事务契约 > 阶段 1
- **修改摘要**: `docType classify + preset merge + merge/dedupe` → `docType classify + preset merge + merge/dedupe + relationTypes 过滤`
- **状态**: 已完成

- **文件**: `_bmad-output/implementation-artifacts/stories/2-6-incremental-scan-and-document-lifecycle-detection.md`
- **章节**: 增量扫描流程 > 阶段 1 步骤 5 显式链路
- **修改摘要**: `→ docType classify → preset merge → merge/dedupe` → `→ docType classify → preset merge → merge/dedupe → relationTypes 过滤`
- **状态**: 已完成

#### 修订项 #3：AC 3/4 + 步骤 8 收缩至 v0.1 约束（Finding #3）

- **文件**: `_bmad-output/implementation-artifacts/stories/2-6-incremental-scan-and-document-lifecycle-detection.md`
- **章节**: Acceptance Criteria + 阶段 2 步骤 8
- **修改摘要**:
  - AC 3：`更新图谱中的文档路径和相关关系边` → `更新图谱中的文档路径（v0.1：仅更新 documents.path；路径敏感的 docType 重分类与 preset 关系刷新延至 v0.2）`
  - AC 4：`更新文档路径` → `更新文档路径（v0.1 约束同 AC 3）`
  - 步骤 8 注释：`关系边按 docId 建立，无需修改` → `v0.1 约束：仅更新 documents.path，不重算 docType 或 preset 关系；路径敏感刷新延至 v0.2`
- **状态**: 已完成

---
Epic: 2
Scope: epic
Round: 7
Date: 2026-04-17
Model Used: Claude Opus 4.6 (github-copilot)
Review Source: epic-2-story-review-summary-20260416-round-7.md
Review Model: GPT-5.4 (github-copilot)
Type: Story Review Evaluation
---

## 评估总结

第 7 轮审查共 2 条发现（1 条 [高]、1 条 [中]），经逐条交叉验证，**2 条全部确认有效**：1 条维持 P1，1 条维持 P1（原 [中] 升级）。无降级、无误报。

本轮审查质量延续了前几轮的高水准——证据引用精确到文档原文，修订建议具体可行。与第 6 轮对比，阻塞面从 3 P1 大幅缩减为 2 P1，其中 R6/Finding #1（discovery 链路复用）和 R6/Finding #2（`relationTypes` 阶段契约闭环）均已确认修复关闭。剩余 2 条 P1 本质上是 R6/Finding #3（rename/move AC 矛盾）的最后收尾——Story 2.6 内部的无条件"结果等价"表述需加限定，Epic 2 的父级 AC 需同步到 v0.1 path-only 范围。两处修订均为逐句文案对齐，工作量极小。

## 上轮问题回顾确认

### Round 6 / Finding #1 — Story 2.6 未显式复用 Story 2.5 完整前置发现链路：已确认修复

Story 2.6 阶段 1 步骤 1 原文现为：`loadConfig(projectRoot) → resolveAdapter(config, projectRoot) → computeEffectiveScanPaths(config, adapter) → adapter.discoverDocuments(projectRoot, scanPaths, excludePaths) → 当前文件路径`，并注明「复用 Story 2.5 步骤 1-3，冷启动与增量共享同一前置发现链路」。`discoverDocuments` 签名与 Story 2.1 接口定义完全一致（`projectRoot, scanPaths, excludePaths` 三参数），前置步骤显式包含 `loadConfig → resolveAdapter → computeEffectiveScanPaths`。该问题关闭。

### Round 6 / Finding #2 — `relationTypes` 过滤仍未进入 Story 2.5 阶段契约与 Story 2.6 完整构建子链路：已确认修复

Story 2.5 两阶段事务的阶段 1 摘要原文现为：`docType classify + preset merge + merge/dedupe + relationTypes 过滤`，已补入 `relationTypes 过滤`。Story 2.6 步骤 5 的显式链路原文现为：`pipeline.process → ... → docType classify → preset merge → merge/dedupe → relationTypes 过滤`，也已补入。任务列表、主流程、阶段契约和增量复用链路四个层面已完全对齐。该问题关闭。

### Round 6 / Finding #3 — rename/move AC 与实现矛盾：部分修复，收窄为本轮遗留

Story 2.6 的 AC 3/4 已收缩为 v0.1 path-only 语义（AC 3 原文：「更新图谱中的文档路径（v0.1：仅更新 `documents.path`；路径敏感的 docType 重分类与 preset 关系刷新延至 v0.2）」），步骤 8 也已加注 v0.1 约束说明。AC-步骤直接矛盾已消除。但 Story 2.6 正文其余位置的无条件"结果等价"表述和 Epic 2 父级 AC 仍未同步，以本轮 Finding #1、#2 继续追踪。

### 历史非阻塞待办

1. **IDE preset provider 缺失**（R5#2）：维持 P2。`config.ide` 为空时链路正常执行，v0.1 范围内无功能影响。
2. **inbound `framework_preset` 边 modified-only 刷新**（R5#5）：维持 P2。仅修改内容不改路径时，`docType` 由文件名模式决定不受影响，preset 边稳定。
3. **无变更快返前全量计算 `contentHash`**：维持 P2。性能优化项，不影响功能正确性。

## 发现 #1 评估

### 审查原文

> **[高][上轮遗留] Story 2.6 仍同时保留 v0.1 path-only 范围与未限定的结果等价承诺**
> - 来源：structure+consistency+contract
> - 分类：patch
> - 涉及 Story：2-3、2-5、2-6
> - 证据 - Story 2.6 的 AC 3/4 与步骤 8 已明确把 rename/move 收缩为 v0.1 仅更新 `documents.path`，路径敏感的 docType 重分类与 preset 关系刷新延至 v0.2；但同一文档的步骤 5 注释仍写"确保增量与冷启动结果等价"，数据一致性说明也仍写"确保 `framework_preset` 关系在增量扫描时也被正确刷新，满足 `cord scan --rebuild` 与增量扫描结果等价"。而 Story 2.3 的 docType / preset rules 仍是路径敏感的，Story 2.5 的冷启动与 rebuild 基线也继续包含 `docType classify` 与 `preset merge`。
> - 影响 - Story 2.6 现在已经用 AC 和步骤 8 收紧了 rename/move 范围，但正文其余位置仍对整个增量路径给出无条件的关系刷新和结果等价承诺。实现者和后续审查者无法仅凭正文判断 rename/move 是否被排除在这些承诺之外，范围口径仍未真正闭合。
> - 建议 - 将"结果等价"和"`framework_preset` 刷新"说明明确限定为 modified/added 复用 Story 2.5 完整构建子链路的场景；同时补一句 rename/move 在 v0.1 不保证路径敏感的 docType 与 preset 关系同步。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：基本准确 — 经交叉验证，Story 2.6 步骤 5 原文为「对 **modified + added** 文档执行与冷启动相同的完整构建子链路...（复用 Story 2.5 定义的完整链路，确保增量与冷启动结果等价）」。严格来说，步骤 5 的主语已限定为「modified + added 文档」，因此其括号注释"确保增量与冷启动结果等价"可合理解读为仅针对 modified/added 路径的等价承诺。**但**文档末尾的数据一致性说明原文为：「增量路径与冷启动路径使用相同的构建子链路（步骤 5），确保 framework_preset 关系在增量扫描时也被正确刷新，满足 `cord scan --rebuild` 与增量扫描结果等价的隐含要求」——此处「rebuild 与增量扫描结果等价」是对**整个增量扫描结果**的无条件断言，并非仅限 modified/added。由于 rebuild 会对所有文档（含被 rename/move 的文档）走完整 pipeline（包括 docType classify + preset merge），而增量路径的 rename/move 仅更新 path，两者结果在路径敏感场景下不等价。

**严重性判断**：合理 — 数据一致性说明是实现者判断系统行为保证的关键参考点。一个可测试的等价断言如果在已知场景下为假，会直接误导测试用例设计和回归验证。三层来源命中（structure+consistency+contract）进一步佐证了该发现的跨维度一致性问题。

**修订建议**：可行 — 将数据一致性说明的等价断言限定为「对 modified/added 文档，增量路径与冷启动/rebuild 结果等价」，并补充「rename/move 在 v0.1 仅更新 path，不保证路径敏感的 docType 与 preset 关系同步（延至 v0.2）」。步骤 5 的括号注释可选择性收紧措辞，但因其主语已限定为 modified/added，改动优先级较低。修订工作量极小（改一段话）。

**误报评估**：非误报 — 数据一致性说明中的无条件等价断言可在源文档中逐字验证，且与 AC 3/4 和步骤 8 的 v0.1 path-only 约束存在客观矛盾。

## 发现 #2 评估

### 审查原文

> **[中][上轮遗留] Epic 2 的 Story 2.6 验收基线仍未同步到 v0.1 path-only 范围**
> - 来源：structure+consistency+contract
> - 分类：patch
> - 涉及 Story：2-6
> - 证据 - Epic 2 中 Story 2.6 的 AC 仍写"检测到文档重命名时，更新图谱中的文档路径和相关关系边"；而 Story 2.6 正文的 AC 3/4 与步骤 8 已统一收缩为 v0.1 仅更新 `documents.path`，路径敏感的 docType 与 preset 关系刷新延至 v0.2。
> - 影响 - Epic 与 Story 之间仍保留双重验收口径。若不统一，后续评估、AC 审计和开发排期会继续把 v0.2 的路径敏感刷新误记为 v0.1 的已交付范围。
> - 建议 - 同步更新 Epic 2 中 Story 2.6 的 AC，使其与 Story 2.6 正文和步骤 8 一致；或者回撤 Story 2.6 的范围收缩，二者必须二选一收口。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 经交叉验证，Epic 2 中 Story 2.6 的 AC 原文为「检测到文档重命名时，更新图谱中的文档路径**和相关关系边**」，而 Story 2.6 的 AC 3 原文为「更新图谱中的文档路径（v0.1：仅更新 `documents.path`；路径敏感的 docType 重分类与 preset 关系刷新延至 v0.2）」。Epic 承诺「更新相关关系边」，Story 明确不更新——两者构成直接的范围矛盾。

**严重性判断**：合理（原 [中] 升级为 P1） — 审查标记为 [中]，但在 BMAD 工作流中，Epic AC 是验收审计（Acceptance Auditor）的直接对照基准。如果 Epic AC 仍承诺「更新关系边」而 Story 明确不交付，AC 审计会将 Story 2.6 标记为不合规，导致验收流程混乱。此外，项目 CLAUDE.md 的 Rule Document Registry 明确要求「两份文档内容互为镜像，任何一处规则变更必须同时更新另一处」。Epic 与 Story 的 AC 范围不一致属于 AC 不可测（Epic AC 的验收标准在 v0.1 无法满足），满足 P1 定义。升级理由：fix-cost 极低（Epic 中补一个括号注释），但不修复会持续产生审计噪声。

**修订建议**：可行 — 同步 Epic 2 中 Story 2.6 的 AC 为「检测到文档重命名时，更新图谱中的文档路径（v0.1：仅更新路径；路径敏感关系刷新延至 v0.2）」，与 Story 2.6 AC 3 对齐。工作量极小（改一行）。

**误报评估**：非误报 — Epic AC 与 Story AC 的措辞差异可在源文档中逐字验证。

## 整体评估结论

### 需要修订（阻塞进入开发）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|------------|------|
| 1 | Story 2.6 数据一致性说明的无条件等价断言 | [高] | P1 | 限定为 modified/added 场景 |
| 2 | Epic 2 父级 AC 未同步 v0.1 path-only | [中] | P1 | Epic AC 补括号注释对齐 Story |

### 建议纳入后续改善跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|------------|------|
| — | （本轮无新增 P2） | — | — | — |

历史 P2 待办（跨轮次延续）：
- IDE preset provider 缺失（R5#2）
- inbound `framework_preset` 边 modified-only 刷新（R5#5）
- 无变更快返前全量 `contentHash` 计算

### 可忽略（误报）

| # | 发现 | 原始严重性 | 忽略理由 |
|---|------|----------|---------|
| — | （本轮无误报） | — | — |

### 评估决定

**整体结论**：需修订后再审

两条 P1 均为文案对齐类修订，工作量极小：（1）Story 2.6 数据一致性说明补加 rename/move 除外的限定语；（2）Epic 2 的 Story 2.6 AC 补加 v0.1 path-only 括号注释。预计修订后下一轮可收敛至 0 P1，Epic 2 可进入开发。

**趋势观察**：P1 阻塞数 R3=5 → R4=5 → R5=3 → R6=3 → R7=2。剩余 2 条 P1 本质是同一问题（rename/move 范围收束）的最后两处文案对齐，已不涉及架构或接口设计层面的变更。

---

## 修订执行记录

- **Date**: 2026-04-17
- **Model Used**: Claude Sonnet 4.6 (github-copilot)
- **Fix Items**: 2 条 P1（2 处文档修改）

#### 修订项 #1：Story 2.6 数据一致性说明补加 rename/move 除外限定（Finding #1）

- **文件**: `_bmad-output/implementation-artifacts/stories/2-6-incremental-scan-and-document-lifecycle-detection.md`
- **章节**: 增量扫描流程 > 数据一致性保证
- **修改摘要**: 将无条件等价断言「增量路径与冷启动路径使用相同的构建子链路...满足 `cord scan --rebuild` 与增量扫描结果等价的隐含要求」改为明确限定范围：「对于 modified/added 文档，增量路径复用冷启动的完整构建子链路（步骤 5），确保 framework_preset 关系被正确刷新，满足 `cord scan --rebuild` 与增量扫描在 modified/added 路径上的结果等价。rename/move 在 v0.1 仅更新 `documents.path`，不保证路径敏感的 docType 与 preset 关系同步（延至 v0.2）。」
- **状态**: 已完成

#### 修订项 #2：Epic 2 父级 AC 补入 v0.1 path-only 约束（Finding #2）

- **文件**: `_bmad-output/planning-artifacts/epics/epic-2文档扫描与关系图谱构建.md`
- **章节**: Story 2.6 验收标准
- **修改摘要**: `检测到文档重命名时，更新图谱中的文档路径和相关关系边` → `检测到文档重命名时，更新图谱中的文档路径（v0.1：仅更新路径；路径敏感的 docType 重分类与 preset 关系刷新延至 v0.2）`，与 Story 2.6 AC 3 对齐，消除 Epic-Story 双重验收口径。
- **状态**: 已完成

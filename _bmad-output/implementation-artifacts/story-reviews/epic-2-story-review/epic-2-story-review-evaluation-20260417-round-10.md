---
Epic: 2
Scope: epic
Round: 10
Date: 2026-04-17
Model Used: Claude Opus 4.6 (github-copilot)
Review Source: epic-2-story-review-summary-20260417-round-10.md
Review Model: GPT-5.4 (github-copilot)
Type: Story Review Evaluation
---

## 评估总结

第 10 轮审查为复审，共 1 条新发现（[中]，来源 structure+consistency，分类 patch）。经源文档交叉验证，**该发现有效，确认为 P1**。R9 评估中登记的 5 条 P2 修订中，4 条已确认修复关闭，1 条（IDE preset v0.1 范围）被审查从 P2 升级为本轮 patch，这一升级判断合理。

核心问题：Story 2.4 的 v0.1 IDE 范围说明只落在 Dev Notes 的 `effectiveScanPaths` 规则 #3 中，但 AC 5/7 仍无条件要求系统管辖 AI IDE 指令规范文档并支持 IDE 预设路径，Task 3 仍为「框架/IDE 预设路径集成」，Epic 2 父级 Story 2.4 的验收口径也未同步。经源文档原文交叉验证，四处文档确实存在矛盾信号——Dev Notes 说跳过，AC 说交付。AC 是正式验收标准，当 AC 与 Dev Notes 矛盾时，开发者和测试者会按 AC 行事，导致过度实现或误判缺陷。

该问题自 R5 起以 P2 持续跟踪，经多轮修订仅将说明写入 Dev Notes 但未同步到 AC/Tasks/Epic，形成了同一文档内的矛盾信号——这比完全未提及更容易误导。审查将其从 P2 升级为 patch 的判断合理，本轮确认为 P1。

## 上轮问题回顾确认

### Round 9 修订项 — project-context 的 BMAD 18 vs 16 口径差异：已确认修复

审查声称 `project-context.md` 已改为「18 种总类型，v0.1 仅实现 Markdown 16 种，YAML 2 种延至 v0.2」，与 Story 2.3 和 Epic 2 的 v0.1 范围一致。审查验证结论可信（此项无争议）。该问题关闭。

### Round 9 修订项 — Story 2.5 skipped warnings 的聚合通路：已确认修复

审查声称 Story 2.5 步骤 4 的预检跳过与编码错误跳过均已追加到 `allWarnings[]`，步骤 7b 明确 `allResults.flatMap(r => r.warnings)` 合并到同一数组，步骤 9 返回 `ScanResult.warnings: allWarnings`。warnings 单一路径已闭合。审查验证结论可信。该问题关闭。

### Round 9 修订项 — Story 2.6 inbound framework_preset 边约束：已确认修复

审查声称 Story 2.6 架构约束已明确 v0.1 增量扫描仅刷新 modified/added 文档的 outgoing 关系边，docType 变化导致的 preset 偏差通过 `cord scan --rebuild` 修复。该说明与 v0.1 path-only 边界一致。该问题关闭。

### Round 9 修订项 — Story 2.6 contentHash 性能说明：已确认修复

审查声称 Story 2.6 已补充 v0.1 性能说明，明确先完整计算 `contentHash`，懒计算优化延至 v0.2，与 PRD NFR6 条件口径可共存。审查验证结论可信。该问题关闭。

### Round 8/9 已关闭项 — currentMtimeMs 写回映射：持续关闭

审查确认 Story 2.6 步骤 11 持续保持 `lastObservedMtimeMs: item.currentMtimeMs`，无回归。该问题持续关闭。

### 历史非阻塞待办

1. **IDE preset provider 缺失**（R5#2）：本轮被审查从 P2 **升级为 patch**（见新发现 #1 评估）。升级理由成立。
2. **inbound `framework_preset` 边 modified-only 刷新**（R5#5）：本轮已确认修复关闭（见上方 R9 修订项）。
3. **无变更快返前全量计算 `contentHash`**：本轮已确认修复关闭（见上方 R9 修订项）。
4. **project-context BMAD 文档类型 18 vs 16 口径差异**（R8）：本轮已确认修复关闭（见上方 R9 修订项）。
5. **skipped warning owner 聚合通路收紧**（R9）：本轮已确认修复关闭（见上方 R9 修订项）。

## 发现 #1 评估

### 审查原文

> **[中][新] Story 2.4 的 IDE 预设 v0.1 范围只写进 Dev Notes，AC 与任务仍把 IDE 预设视为当前交付**
> - 来源：structure+consistency
> - 分类：patch
> - 涉及 Story：2-4
> - 证据 - Story 2.4 的 effectiveScanPaths 规则 #3 已新增说明：`config.ide` 已配置时理论上通过 IDE adapter 追加路径，但 v0.1 中 IDE adapter 属 Epic 5，`config.ide` 默认为空，因此默认路径始终跳过。与此同时，同一文件的 AC 5/7 仍无条件要求系统管辖 AI IDE 指令规范文档，并支持已支持框架和 IDE 的预设文档路径；Task 3 也仍是"框架/IDE 预设路径集成"。Epic 2 父级 Story 2.4 的验收标准保持相同口径，未同步这条 v0.1 范围说明。
> - 影响 - 默认分支的说明性歧义虽已缩小，但 `config.ide` 非空时在 v0.1 到底应忽略、报错还是实际接入 IDE provider 仍无统一验收口径。开发者可能因此过度实现 Epic 5 能力，或测试者按当前 AC 把未实现的 IDE provider 误判为缺失交付。
> - 建议 - 将 Story 2.4 的 AC 5/7、Task 3，以及 Epic 2 父级 Story 2.4 的验收标准统一收口到同一 v0.1 语义：要么明确"`ide` 只是 schema 预留字段，非空分支延至 Epic 5，不属于本 Story 验收范围"；要么明确"非空 `config.ide` 在 v0.1 的处理策略（忽略/报错/空 provider）"，三处文档必须保持一致。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 经源文档原文交叉验证，四处文档矛盾客观存在：

| 文档位置 | 原文 | IDE v0.1 范围限制 |
|----------|------|-------------------|
| Story 2.4 AC 5 | 「包括框架产出文档、**AI IDE 指令规范文档**、用户文档（FR38）」 | ❌ 无限制 |
| Story 2.4 AC 7 | 「支持已支持框架**和 IDE** 的预设文档路径（FR40）」 | ❌ 无限制 |
| Story 2.4 Task 3 | 「**框架/IDE** 预设路径集成 (AC: #5, #7, #8)」 | ❌ 无限制 |
| Story 2.4 Dev Notes 规则 #3 | 「v0.1：IDE adapter 属 Epic 5 范围，尚未实现；v0.1 中 `config.ide` 默认为空，此步骤始终跳过」 | ✅ 已限制 |
| Epic 2 Story 2.4 AC | 「支持已支持框架**和 IDE 的预设文档路径**配置（FR40）」 | ❌ 无限制 |

AC 是正式验收标准——开发者判断交付范围、测试者编写用例均以 AC 为准。当 AC 无条件要求 IDE preset 支持，而 Dev Notes 说跳过时，同一文档内产生矛盾信号。这比「完全未提及 v0.1 限制」更容易误导，因为看了 Dev Notes 的开发者与只看 AC 的测试者会对同一 Story 有不同的验收预期。

**严重性判断**：合理 — 审查标记 [中] 并从 P2 升级为 patch。此升级的核心依据是：该问题自 R5 以来以 P2 持续跟踪，经多轮修订仅将说明写入 Dev Notes 但始终未同步到 AC/Tasks/Epic。当前状态比 R5 时更糟——R5 时 AC 和 Dev Notes 都没有 v0.1 IDE 范围说明（一致的沉默），现在 Dev Notes 有说明但 AC 没有（不一致的矛盾）。升级判断成立，确认 P1。

**修订建议**：可行 — 审查提出的两种修订路径均可行：
1. 在 AC 5/7 中添加 v0.1 范围括号说明（如「AI IDE 指令规范文档（v0.1：IDE adapter 延至 Epic 5，仅通过 scanPaths 手动包含）」），Task 3 改为「框架预设路径集成（IDE 预设延至 Epic 5）」，Epic 2 父级 AC 同步
2. 或者在 AC 5/7 中定义 `config.ide` 非空时的 v0.1 处理策略（如忽略并记录 WARNING），三处文档保持一致

两种方案均为文档说明修订，修改量小，不涉及架构变更。

**误报评估**：非误报 — 四处文档的矛盾信号客观存在，源文档原文已确认。

## 整体评估结论

### 需要修订（阻塞进入开发）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|------------|------|
| 1 | IDE preset v0.1 范围未同步到 AC/Tasks/Epic | [中] | P1 | AC 与 Dev Notes 矛盾，需统一验收口径 |

### 建议纳入后续改善跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|------------|------|
| — | （本轮无需降级的发现） | — | — | — |

历史 P2 待办（跨轮次延续）：
- 编码错误 warning owner 表述偏简写（R10 审查关注点，未构成 patch）

注：R5-R9 累积的其他 P2 项（inbound framework_preset 边、contentHash 性能、18 vs 16 口径、skipped warning 聚合通路）均已在本轮确认修复关闭。IDE preset provider（R5#2）已升级为本轮 P1。

### 可忽略（误报）

| # | 发现 | 原始严重性 | 忽略理由 |
|---|------|----------|---------|
| — | （本轮无误报） | — | — |

### 评估决定

**整体结论**：需修订后再审

Story 2.4 的 AC 5/7、Task 3 与 Epic 2 父级 Story 2.4 验收口径需要与 Dev Notes 的 v0.1 IDE 范围说明同步。修订范围明确（4 处文档说明对齐），不涉及架构变更。建议修订后提交第 11 轮 reviewer 确认闭合。

**P1 收敛趋势**：R1=5 → R2=5 → R3=5 → R4=5 → R5=3 → R6=3 → R7=2 → R8=0 → R9=0 → **R10=1**（R5 P2 升级为 P1）

---

## 修订执行记录

- **执行日期**：2026-04-17
- **执行模型**：Claude Sonnet 4.6 (github-copilot)
- **P1 修订项**：1 条（发现 #1：IDE preset v0.1 范围未同步到 AC/Tasks/Epic）
- **P2 修订项**：0 条

### 修订明细

| # | 文件 | 位置 | 改动说明 |
|---|------|------|---------|
| 1 | `stories/2-4-config-loading-and-document-scope.md` | AC 5 | 在「AI IDE 指令规范文档」后追加 v0.1 括注：IDE adapter 预设路径属 Epic 5 范围，v0.1 通过手动配置 scanPaths 包含 |
| 2 | `stories/2-4-config-loading-and-document-scope.md` | AC 7 | 改为「支持已支持框架的预设文档路径」，追加 v0.1 括注：仅支持框架预设路径，IDE 预设延至 Epic 5，config.ide 存在时 v0.1 始终跳过 |
| 3 | `stories/2-4-config-loading-and-document-scope.md` | Task 3 | 「框架/IDE 预设路径集成」→「框架预设路径集成（IDE 预设路径延至 Epic 5）」 |
| 4 | `epics/epic-2文档扫描与关系图谱构建.md` | Story 2.4 AC FR40 行 | 改为「支持已支持框架的预设文档路径配置」，追加 v0.1 括注与 AC 7 保持一致 |

### 修订后状态

- Story 2.4 AC 5/7、Task 3 与 Epic 2 父级 AC 均已同步 v0.1 IDE 范围限制
- Dev Notes rule #3（R9 已修）与 AC/Tasks/Epic 四处文档现无矛盾信号
- 所有修订为纯文档说明追加，未涉及架构变更

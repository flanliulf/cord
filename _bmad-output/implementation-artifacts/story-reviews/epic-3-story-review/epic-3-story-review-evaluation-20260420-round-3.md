---
Epic: 3
Scope: epic
Round: 3
Date: 2026-04-20
Model Used: Claude Opus 4.6 (claude-opus-4.6)
Review Source: epic-3-story-review-summary-20260420-round-3.md
Review Model: GPT-5.4 (gpt-5.4)
Type: Story Review Evaluation
---

## 评估总结

GPT-5.4 对 Epic 3 的第 3 轮复审继续保持高质量。审查准确确认了 round-2 的 2 条 P1 修复已闭合（3.1 错误处理漂移、1.4/3.4 共享仓储契约），并识别出 2 条新发现：1 条由 round-2 修订引入的新缺陷（Task 4 测试口径与 AC 矛盾），1 条上轮遗留深层未闭合（UTC 时间格式缺上游契约）。经独立交叉验证，2 条发现均确认有效（0 误报）：1 条确认为 P1 阻塞项，1 条降级为 P2 后续改善。Epic 3 已高度收敛——从首轮 7 条 P1 缩减至仅 1 条真正阻塞项。

## 上轮问题回顾确认

### Round 2 / Finding #5 — 3.1 错误处理四处漂移到旧基线：已确认修复

已逐项验证全部四处修正：
1. **路径**：Story 3.1 现写 `src/utils/errors.ts`（与 Story 1.2 一致）✅
2. **构造签名**：`QueryError` 现使用对象参数 `constructor(params: { message, code, suggestion, context? })` ✅
3. **错误码**：示例改为 `CORD_QUERY_001`（符合 `CORD_{MODULE}_{NNN}` 规范）✅
4. **颜色库**：架构约束现写"chalk 着色（D4 规范）"✅

### Round 2 / Finding #2 — 3.4 getAllRelations 未同步到 1.4 源仓储契约：已确认修复

已验证 Story 1.4 的 IGraphRepository 接口代码块现包含 `getAllRelations(): RelationEdge[]` 方法（位于"统计"区块），Task 1.5 也已补入该方法签名。Story 3.4 Task 0 保留了依赖关系引用。上下游共享接口的契约分裂已消除。

### Round 2 / Finding #1 — 3.3 三跳边界提升至 AC：部分修复，衍生新问题

AC 9 已新增"固定三跳深度，v0.1 不对外暴露 `depth` 参数；测试必须验证三跳边界"，Dev Notes 也统一为 `queryMultiHop({ docPath, depth: 3 })`。核心设计裁决已进入 AC。但 Task 4 的测试口径描述引入了新矛盾——详见本轮发现 #1。

### Round 2 / Finding #4 — 3.5 过时关系时间归一和 camelCase 约束：部分修复，深层未闭合

camelCase 边界已修正（AC 3 使用 `createdAt`），`Date.parse()` 归一算法已写入 AC 和 Dev Notes。但 UTC 时间格式的上游保证仍未建立——详见本轮发现 #2。

### 历史非阻塞待办

1. **Round 1 / Finding #8 — "目标文档路径"字段语义**：确认仍为非阻塞，维持 P2。
2. **Round 1 / Finding #9 — 多跳结果去重规则**：确认仍为非阻塞，维持 P2。
3. **Round 1 / Finding #11 — 导出 CLI 行为口径**：确认仍为非阻塞，维持 P2。
4. **Round 2 / Finding #3 — migrationVersion 单字段**：确认仍为非阻塞，维持 P2。
5. **Round 2 / Finding #6 — project 字段引用不存在的配置项**：确认仍为非阻塞，维持 P2。

## 发现 #1 评估

### 审查原文

> **[高][新] 3.3 的三跳边界测试口径被 Task 4 写反，导致 round-2 修订未真正闭合**
> - 来源：structure+consistency+contract
> - 分类：patch
> - 涉及 Story：3-3
> - 证据 - Story 3.3 的 AC 9 和 Dev Notes 已明确"固定三跳，超过三跳的节点不返回"，也统一为复用 `queryMultiHop({ docPath, depth: 3 })`；但 Task 4 仍写成"接近和超过边界的节点均不应得到结果"，这会把合法的三跳内结果也当成负例。
> - 影响 - round-2 想关闭的三跳边界问题被测试任务文本重新打开：实现者可能为了过测而错误排除 3 跳结果，导致影响分析范围再次收缩。
> - 建议 - 在 [3-3-impactservice-change-impact-analysis.md] 中将 Task 4 改为同时验证"1-3 跳结果保留、4 跳及以上排除"，并用明确夹具区分恰好 3 跳与超过 3 跳两类样例。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 已逐字对照 AC 9 和 Task 4 的措辞。AC 9 写"超过三跳的间接节点不应出现在结果中"（即 hop 4+ 排除，hop 1-3 保留）。而 Task 4 写"接近和超过边界的节点均不应得到结果"——"接近边界"自然理解为恰好 3 跳的节点，"超过边界"为 4 跳及以上，两者"均不应得到结果"意味着 hop 3 也被排除。这与 AC 9 的"仅排除超过三跳"直接矛盾。三来源命中（structure+consistency+contract）进一步增强可信度。
**严重性判断**：合理 — Task 是开发者实现测试的直接指引。如果 Task 口径与 AC 矛盾，实现者要么在 AC 和 Task 之间困惑，要么按 Task 写出错误的测试逻辑，把合法的 3 跳结果也排除掉。这直接影响影响分析的功能正确性，是 P1 阻塞项。
**修订建议**：可行 — 将 Task 4 改为"必须包含三跳边界验证：1-3 跳结果保留、4 跳及以上排除；测试夹具应区分恰好 3 跳（正例）与恰好 4 跳（负例）两类样例"，语义与 AC 9 完全对齐。改动量极小（一句话修正）。
**误报评估**：非误报 — AC 9 与 Task 4 原文已逐字比对，"接近和超过边界的节点均不应得到结果"与"超过三跳的间接节点不应出现"确实存在语义矛盾。

## 发现 #2 评估

### 审查原文

> **[高] 3.5 的过时关系时间归一仍缺稳定的 UTC 上游契约**
> - 来源：consistency+contract
> - 分类：patch
> - 涉及 Story：3-5
> - 证据 - Story 3.5 现在要求通过 `Date.parse(relation.createdAt)` 将 `createdAt` 归一到 UTC 毫秒后与 `lastObservedMtimeMs` 比较；但 Story 1.4 上游仍将 `relations.created_at` 定义为 SQLite `datetime('now')` 生成的无时区 TEXT，尚未保证 Repository 输出的是带稳定 UTC 语义的时间格式。
> - 影响 - 即使 camelCase 与算法描述已修正，stale relation 判定结果仍会受运行环境时区影响，导致健康检查不可复现，也说明 round-2 的时间归一修订只完成了表层闭合。
> - 建议 - 将时间格式契约上提到 [1-4-sqlite-storage-layer-and-data-migration.md]：明确 Repository 输出带 `Z` 的 ISO 8601 或 epoch ms；[3-5-statusservice-health-check.md] 只消费该稳定格式，不直接对原始 SQLite datetime TEXT 做 UTC 假设。

### 评估结论：⚠️ 有效但降级 — 建议纳入后续改善跟踪（P2）

### 评估分析

**问题描述准确性**：基本准确 — 已验证 Story 1.4 schema 中 `created_at TEXT NOT NULL DEFAULT (datetime('now'))` 确实不含时区标识符，生成格式为 `YYYY-MM-DD HH:MM:SS`。Story 3.5 依赖 `Date.parse(relation.createdAt)` 做归一。审查正确指出了上游时间格式缺乏显式 UTC 保证的问题。

但需要补充两个关键上下文：
1. **SQLite `datetime('now')` 的文档语义**：SQLite 官方文档明确 `datetime('now')` 返回 UTC 时间（"The 'now' argument to date and time functions ... **is always in UTC**"）。因此数据库层面的存储语义实际上是 UTC，只是字符串格式没有显式 `Z` 后缀。
2. **Node.js `Date.parse()` 对无时区字符串的行为**：ECMA-262 规定无时区的日期时间字符串的解析行为是实现定义的（implementation-defined），V8 引擎（Node.js 使用）对 `YYYY-MM-DD HH:MM:SS` 格式会将其作为本地时间解析。这确实会导致偏差——如果运行环境时区非 UTC，`Date.parse('2026-04-20 10:00:00')` 会偏移若干小时。

**严重性判断**：偏高 — 审查标为[高]，但实际阻塞程度有限，原因如下：(1) Story 3.5 Dev Notes 已明确标注"注意 SQLite datetime 默认无时区，需确保写入时均以 UTC 存储"，开发者已被提醒；(2) Story 1.4 的 mapper 层（Task 3）负责输出转换，修复可以局限在 mapper 中追加 `Z` 后缀或使用 `datetime('now') || 'Z'`，不需要修改 schema；(3) 该问题仅影响 stale relation 的判定精度，核心功能正确性不受影响——即使有几小时偏移，过时关系的判定本身就是近似方案（v0.1 裁决）。将上游时间格式契约固化是好实践，但对 v0.1 而言属于改善项而非阻塞。

**修订建议**：可行 — 两种方案均可实现：(a) 在 Story 1.4 mapper 的 `createdAt` 输出中追加 `Z` 后缀（如 `row.created_at + 'Z'`）；(b) 在 schema 中用 `datetime('now') || 'Z'` 替换 `datetime('now')`。但推荐方案 (a)——改在 mapper 层修正输出格式，对 schema 无侵入。
**误报评估**：非误报 — `Date.parse()` 对无时区字符串的解析确实存在 V8 实现级别的歧义。但考虑到 stale relation 本身是近似方案、Dev Notes 已有提醒、以及修复路径简单且可在 mapper 层闭合，不构成阻塞进入开发的条件。

## 整体评估结论

### 需要修订（阻塞进入开发）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|------------|------|
| 1 | 3.3 Task 4 测试口径与 AC 9 矛盾 | [高] | P1 | 一句话修正，将"接近"改为正例 |

### 建议纳入后续改善跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|------------|------|
| 2 | 3.5 UTC 时间格式缺上游契约 | [高] | P2 | mapper 层追加 `Z` 后缀即可闭合 |

### 可忽略（误报）

| # | 发现 | 原始严重性 | 忽略理由 |
|---|------|----------|---------|
| — | 无 | — | 本轮审查未发现误报 |

### 评估决定

**整体结论**：需修订后再审（仅 1 条 P1）

本轮仅剩 1 条 P1 阻塞项（Story 3.3 Task 4 的测试口径措辞），修订工作量极小（一句话文本替换）。建议立即修正 Task 4 措辞，使其与 AC 9 的"1-3 跳保留、4 跳排除"语义完全对齐。P2 项（UTC 时间格式）可在开发阶段由实现者在 mapper 层一并处理。修订完成后可快速通过第 4 轮复审，Epic 3 已接近 ready-for-dev 状态。

---

## 修订执行记录

### 修订执行记录
- **Date**: 2026-04-20
- **Model Used**: Claude Sonnet 4.6
- **Fix Items**: 1

#### 修订项 #1: Story 3.3 Task 4 测试口径与 AC 9 矛盾（发现 #1）
- **文件**: `_bmad-output/implementation-artifacts/stories/3-3-impactservice-change-impact-analysis.md`
- **章节**: Tasks / Subtasks → Task 4
- **修改摘要**: 将旧措辞"接近和超过边界的节点均不应得到结果"改为"1-3 跳结果应保留（正例），4 跳及以上应排除（负例）；测试夹具须区分"恰好 3 跳"与"恰好 4 跳"两类样例，不得把合法的 3 跳结果计为负例"。与 AC 9"超过三跳的间接节点不应出现在结果中"的语义完全对齐，消除因"接近边界"措辞导致的歧义
- **状态**: 已完成

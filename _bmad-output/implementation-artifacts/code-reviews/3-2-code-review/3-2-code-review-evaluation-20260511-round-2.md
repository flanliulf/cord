---
Story: 3-2
Round: 2
Date: 2026-05-11
Model Used: GitHub Copilot (model not exposed)
Review Source: 3-2-code-review-summary-20260511-round-2.md
Review Model: GitHub Copilot (model not exposed)
Type: Code Review Evaluation
---

## 评估总结

对 Story 3-2 的第 2 轮 CR 代码审查结果（复审）进行逐条评估。本轮审查确认 Round 1 的 2 个 P1 问题已完成修复，同时提出 1 个新的中优先级 patch 项：`type` 过滤查询仍会解析非目标类型坏边，可能被无关关系端点阻断。经代码与测试独立验证，新发现确认有效，建议修复后进入下一轮复审。

---

## 上轮问题回顾确认

### Round 1 / Finding #1 — `type` 过滤截断 BFS 遍历路径：已修复

`src/services/query-service.ts:51-54` 现在只按 `includeDeprecated` 过滤可遍历边，不再在 BFS 取边阶段应用 `validatedInput.type`。`src/services/query-service.ts:60-79` 解析相关文档后，仅在 `src/services/query-service.ts:63-74` 写入结果时应用 `type` 过滤，并仍可在 `hopDistance < validatedInput.depth` 时扩展队列。该结构确认消除了 Round 1 中“非匹配中间边阻断深层匹配关系”的原问题。

测试侧，`tests/unit/services/query-service.test.ts:402-421` 新增 `does not let type filtering block deeper matches reachable through non-matching edges`，覆盖从 `docs/a.md` 以 `depth: 3` + `type: sync_required` 查询时，经非匹配边抵达 `rel-c-d` 的场景。

### Round 1 / Finding #2 — 200→2000 文档性能退化测试未让数据规模进入三跳查询热路径：已修复到可接受水平

`tests/unit/services/query-service.test.ts:280-312` 新增 `createSqliteLinearGraphService`，通过真实 `SqliteGraphRepository` 构建 200 / 2000 文档线性图。`tests/unit/services/query-service.test.ts:636-651` 新增 SQLite 仓储路径的 200→2000 三跳性能退化验证，覆盖真实 `getRelationsByDocId` 查询路径。

该修复解决了 Round 1 评估中“仅有 indexed in-memory adjacency lookup，无法证明真实仓储查询路径”的主要缺口。审查中提到 SQLite p95 比例性能测试仍可能有环境敏感性；这属于后续 benchmark 稳定性风险，不影响本轮确认 Round 1 原阻塞项已处理。

### 历史 CR TODO（非阻塞）

| # | 发现 | 状态 | 评估意见 |
|---|------|------|---------|
| R2-TODO-1 | SQLite p95 比例性能测试存在环境敏感性 | CR TODO / 非阻塞 | 同意维持为非阻塞观察项；当前测试已覆盖 SQLite 仓储路径并通过，若 CI 后续出现抖动，再补 `EXPLAIN QUERY PLAN` / 索引使用断言或迁移独立 benchmark。 |

---

## 发现 #1 评估

### 审查原文

> **[中][新] `type` 过滤查询仍会解析非目标类型坏边，可能被无关关系端点阻断**
> - 来源：blind+edge
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：准确**

`src/services/query-service.ts:51-54` 获取 active traversable edges 后，`src/services/query-service.ts:56-60` 对每条未见过的关系立即调用 `resolveRelatedDocument(current.docId, relation)`。类型匹配判断发生在 `src/services/query-service.ts:63`，也就是端点解析之后。

因此，在 `depth: 1` 且指定 `type` 的查询中，某条非匹配类型关系不会输出，也不会因为 `hopDistance < validatedInput.depth` 而继续扩展；但当前实现仍会先解析它的另一端文档。如果这条非匹配关系指向缺失文档，`src/services/query-service.ts:86-98` 会抛出 `CORD_QUERY_002`，从而阻断本可返回的匹配类型关系结果。

现有测试还没有覆盖这个边界。`tests/unit/services/query-service.test.ts:402-421` 覆盖的是“非匹配中间边不能阻断深层匹配关系”，但其中所有端点都存在；`tests/unit/services/query-service.test.ts:481-501` 覆盖缺失端点错误，但缺失边本身是查询需要处理的关系。缺少“同一源文档存在匹配有效边 + 非匹配缺失端点边，`depth: 1 + type` 应跳过非匹配坏边”的回归测试。

**严重性判断：合理**

原始严重性为 [中] 合理。该问题会让按类型过滤的一跳查询被无关坏边阻断，属于可见功能缺陷；但触发条件需要图谱中存在非匹配类型的缺失端点关系，范围比普通查询缺失端点错误更窄，因此不提升为 P0。由于它会导致本应成功的过滤查询失败，评估为 P1 阻塞交付。

**修复建议：可行**

审查建议可行。可以先计算 `hopDistance`、`shouldOutput = validatedInput.type === undefined || relation.relationType === validatedInput.type` 和 `shouldExpand = hopDistance < validatedInput.depth`。当 `!shouldOutput && !shouldExpand` 时，该边既不需要输出，也不需要扩展，应在解析端点前直接跳过。这样不会破坏 Round 1 的修复：当 `depth > 1` 且非匹配边仍需要用于扩展时，`shouldExpand` 为 true，仍会解析端点并入队。

建议同时补充回归测试：同一源文档有一条匹配类型有效边，以及一条非匹配类型但端点缺失的边；执行 `depth: 1` + `type` 查询时应返回匹配边，不应抛出 `CORD_QUERY_002`。

**误报评估：非误报**

不是误报。该发现由 blind+edge 双来源命中，且当前代码顺序清楚显示端点解析发生在类型过滤判断之前；触发条件虽窄，但行为风险真实存在。

---

## 整体评估结论

### 需要修复（阻塞交付）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 1 | `type` 过滤查询被非目标类型坏边阻断 | [中] | **P1** | `depth: 1 + type` 下非匹配坏边无需输出或扩展，不应先解析端点并阻断匹配结果。 |

### 建议纳入 CR TODO 跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| - | SQLite p95 比例性能测试环境敏感性 | [低] | **P2** | 当前不是本轮阻塞项；若 CI 后续抖动，再补查询计划/索引断言或迁移 benchmark。 |

### 可忽略（误报）

| # | 发现 | 原始严重性 | 忽略理由 |
|---|------|----------|---------|
| - | 无 | - | 本轮未发现误报。 |

### 评估决定

- **上轮 Finding #1（`type` 过滤截断 BFS 遍历路径）**：确认已修复，新增 `depth + type` 深层匹配测试覆盖原问题。
- **上轮 Finding #2（200→2000 性能退化测试未覆盖真实增长查询路径）**：确认已修复到可接受水平，SQLite 仓储路径性能验证已补充；环境敏感性作为非阻塞观察项保留。
- **发现 #1（`type` 过滤查询被非目标类型坏边阻断）**：确认有效，需调整端点解析前的跳过逻辑，并补充 `depth: 1 + type + 非匹配缺失端点边` 回归测试后复审。

## 修复执行记录

### 修复执行记录
- **Date**: 2026-05-11
- **Model Used**: GPT-5.4
- **Fix Items**: 1

#### 条目 1：`type` 过滤查询被非目标类型坏边阻断
- **涉及文件**: src/services/query-service.ts；tests/unit/services/query-service.test.ts
- **修改说明**: 在 QueryService 中将 `hopDistance`、`shouldOutput` 和 `shouldExpand` 的判断前置；对于既不需要输出也不需要扩展的非匹配边，在解析端点前直接跳过，避免 `depth: 1 + type` 查询被无关坏边触发 `CORD_QUERY_002`。同时新增回归测试，覆盖“匹配有效边 + 非匹配缺失端点边”并存时，过滤查询应返回匹配边而非抛错的场景。
- **结果**: 已修复

#### 验证记录
- `npx vitest run tests/unit/services/query-service.test.ts`：15/15 通过
- `npm test`：302/302 通过
- `npm run type-check`：通过
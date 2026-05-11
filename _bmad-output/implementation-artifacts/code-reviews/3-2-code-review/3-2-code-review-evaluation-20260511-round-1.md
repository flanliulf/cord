---
Story: 3-2
Round: 1
Date: 2026-05-11
Model Used: GitHub Copilot (model not exposed)
Review Source: 3-2-code-review-summary-20260511-round-1.md
Review Model: GitHub Copilot (model not exposed)
Type: Code Review Evaluation
---

## 评估总结

对 Story 3-2 的第 1 轮 CR 代码审查结果（首轮）进行逐条评估。本轮审查提出 2 个中优先级 patch 项：`type` 过滤影响 BFS 深层遍历，以及 200→2000 文档性能退化测试未覆盖随规模增长的三跳热路径。经代码与 Story 验收标准独立验证，2 条发现均确认有效，建议修复后进入复审。

---

## 发现 #1 评估

### 审查原文

> **[中] `type` 过滤会截断 BFS 遍历路径，导致深层匹配关系漏报**
> - 来源：edge
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：准确**

`src/services/query-service.ts:51-54` 在取得当前节点关系后立即按 `validatedInput.type` 过滤，随后 `src/services/query-service.ts:56-77` 只遍历过滤后的 `relatedEdges` 并基于这些边扩展队列。因此当路径形如 A --references--> B --sync_required--> C，查询 A、`depth: 2`、`type: sync_required` 时，A-B 这条非匹配边会先被过滤掉，B 不会入队，B-C 的匹配关系也无法被发现。

该行为也与既有类型过滤语义不一致。Story 3.1 的 AC3 写明 `--type` 是“按关系类型过滤结果”，并在 Dev Notes 中将步骤描述为“可选关系类型过滤”；这更支持“结果输出过滤”语义，而不是“遍历路径过滤”语义。Story 3.2 的多跳目标是查询二跳、三跳间接关联关系，当前实现会在组合 `depth` 与 `type` 时漏掉经非匹配中间边可达的深层匹配关系。

**严重性判断：合理**

原始严重性为 [中] 合理。该问题会导致合法查询返回不完整结果，属于功能缺陷；但影响范围限定在 `depth > 1` 且指定 `type` 的组合场景，不是全量查询不可用，因此评估为 P1 阻塞交付而非 P0。

**修复建议：可行**

审查建议“遍历用边过滤”和“结果输出过滤”分离是可行的。BFS 扩展应基于 active / includeDeprecated 语义下可遍历的边；只有向 `relations` 写入结果时应用 `type` 过滤。同时应新增覆盖 `depth + type` 的单元测试，验证非匹配中间边不阻断深层匹配关系。

**误报评估：非误报**

不是误报。代码路径和 Story 3.1 的结果过滤语义可以直接支撑该结论。

---

## 发现 #2 评估

### 审查原文

> **[中] 200→2000 文档性能退化测试未让数据规模进入三跳查询热路径**
> - 来源：blind+edge+auditor
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：准确**

Story 3.2 的 AC5 明确要求“200→2000 文档性能退化不超过 10%”。当前测试在 `tests/unit/services/query-service.test.ts:248-259` 通过 `createLinearGraphService(documentCount)` 生成线性链路，并在 `tests/unit/services/query-service.test.ts:542-548` 分别构造 200 与 2000 文档后，从 `docs/0.md` 以 `depth: 3` 测量。

由于 `depth: 3` 从链首最多只访问 doc-0 到 doc-3 附近的关系，200 与 2000 文档之间新增的大量节点不进入本次三跳遍历热路径。测试仓储还在构造期维护 `relationsByDocId` 索引，`getRelationsByDocId` 直接按当前 docId 取局部边；因此该用例更像是在验证“常数大小局部子图”的查询稳定性，而不是验证三跳范围内节点数或边数随整体数据规模增长时的 NFR7。

SQLite 仓储层 `src/repositories/sqlite-graph-repository.ts:135-153` 使用 `source_doc_id = ? OR target_doc_id = ?` 查询，迁移脚本中也存在 `source_doc_id` / `target_doc_id` 索引；这说明真实仓储可能在稀疏局部查询中同样表现稳定。但这不能消除测试缺口：当前 AC5 的测试数据没有让规模差异进入被测查询路径，无法充分证明 200→2000 文档扩展场景。

**严重性判断：合理**

原始严重性为 [中] 合理。该问题不是直接的运行时功能错误，但它削弱了 AC5 / NFR7 的验收可信度，属于质量门禁缺口。由于 Story 3.2 明确将性能退化验证列为 AC，评估为 P1，需要在交付前修复测试设计。

**修复建议：可行**

审查建议可行。可以补充一个三跳范围内节点数或边数随数据规模增长的性能用例，例如让起点三跳内的分支数随 200 / 2000 规模扩大，或增加基于 SQLite 仓储的集成性能验证，覆盖真实 `getRelationsByDocId` 查询成本与索引行为。建议保留现有稀疏线性用例作为补充，但不能让它成为 AC5 的唯一证据。

**误报评估：非误报**

不是误报。该发现由 blind+edge+auditor 三层同时命中，且代码结构、测试构造方式和 AC5 文本相互印证。

---

## 整体评估结论

### 需要修复（阻塞交付）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 1 | `type` 过滤截断 BFS 遍历路径 | [中] | **P1** | `type` 应过滤输出结果，不应阻断经非匹配边到达深层匹配关系。 |
| 2 | 200→2000 性能退化测试未覆盖增长热路径 | [中] | **P1** | 当前用例无法充分证明 Story 3.2 AC5 / NFR7 的扩展性目标。 |

### 建议纳入 CR TODO 跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| - | 无 | - | - | 本轮 2 条发现均应在当前 Story 修复，不建议延后。 |

### 可忽略（误报）

| # | 发现 | 原始严重性 | 忽略理由 |
|---|------|----------|---------|
| - | 无 | - | 本轮未发现误报。 |

### 评估决定

- **发现 #1（`type` 过滤截断 BFS 遍历路径）**：确认有效，需调整 QueryService 的 BFS 过滤顺序，并补充 `depth + type` 组合测试后复审。
- **发现 #2（性能退化测试未覆盖增长热路径）**：确认有效，需补充能让三跳热路径随规模增长的性能验证，或增加 SQLite 仓储层集成性能验证后复审。

## 修复执行记录

### 修复执行记录
- **Date**: 2026-05-11
- **Model Used**: GPT-5.4
- **Fix Items**: 2

#### 条目 1：`type` 过滤截断 BFS 遍历路径
- **涉及文件**: src/services/query-service.ts；tests/unit/services/query-service.test.ts
- **修改说明**: 将 QueryService 的 `type` 过滤从 BFS 遍历阶段移到结果写出阶段；遍历队列仅受 `includeDeprecated` 影响，确保经非匹配中间边仍可到达深层匹配关系。新增 `depth + type` 组合测试，覆盖 A → B → C → D 链路中经非匹配边抵达深层 `sync_required` 关系的场景。
- **结果**: 已修复

#### 条目 2：200→2000 文档性能退化测试未覆盖真实增长查询路径
- **涉及文件**: tests/unit/services/query-service.test.ts
- **修改说明**: 保留原 indexed in-memory 邻接索引基准作为补充，同时新增基于 SQLite 仓储的 200→2000 文档性能验证，直接通过真实 `getRelationsByDocId` 查询路径测量三跳遍历在表规模扩大时的 p95 退化。
- **结果**: 已修复

#### 验证记录
- `npx vitest run tests/unit/services/query-service.test.ts`：14/14 通过
- `npm test`：301/301 通过
- `npm run type-check`：通过
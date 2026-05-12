---
Story: 3-3
Round: 1
Date: 2026-05-11
Model Used: GitHub Copilot (unspecified)
Review Source: 3-3-code-review-summary-20260511-round-1.md
Review Model: GitHub Copilot (unspecified)
Type: Code Review Evaluation
---

## 评估总结

对 Story 3-3 的第 1 轮 CR 代码审查结果（首轮）进行逐条评估。本轮审查提出 3 个新发现，均指向 ImpactService 影响分析的传播方向、路径过滤和结果去重语义。经独立代码验证，3 条发现均准确且非误报，建议作为阻塞交付问题修复后再进入最终通过。

---

## 发现 #1 评估

### 审查原文

> **[中] 影响分析复用双向遍历，可能把上游文档误报为受影响文档**
> - 来源：edge
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：准确**

ImpactService 当前直接复用 QueryService 的三跳查询结果：[src/services/impact-service.ts:81-88](../../../../src/services/impact-service.ts#L81-L88)。QueryService 遍历时通过 `getRelationsByDocId(current.docId, 'both')` 双向取边，并在 `resolveRelatedDocument()` 中把当前节点另一端作为输出目标：[src/services/query-service.ts:52](../../../../src/services/query-service.ts#L52)、[src/services/query-service.ts:69-74](../../../../src/services/query-service.ts#L69-L74)、[src/services/query-service.ts:98-99](../../../../src/services/query-service.ts#L98-L99)。因此当变更文档位于某条关系的 target 端时，查询会把 source 端也作为 `targetPath` 输出给 ImpactService。

关系类型本身带有方向语义，例如 `sync_required` 定义为“源文档更新后目标文档必须同步更新”，`derived_from` 定义为“目标文档从源文档派生而来”：[src/types/relations.ts:9](../../../../src/types/relations.ts#L9)、[src/types/relations.ts:21](../../../../src/types/relations.ts#L21)。Story AC 要求 `cord impact <doc>` 返回“受影响文档路径、关系类型、传播行为类型、建议动作”，属于变更影响分析而不是无方向相邻关系查询：[_bmad-output/implementation-artifacts/stories/3-3-impactservice-change-impact-analysis.md:14](../../../stories/3-3-impactservice-change-impact-analysis.md#L14)。审查指出“至少区分传播方向”成立。

**严重性判断：合理**

原始严重性为中等合理。该问题会把上游或反向端点纳入影响结果，直接污染 FR15 / FR17 的核心输出；评估后按 P1 处理，因为它会导致用户和后续 MCP/Hook 消费者基于错误影响范围采取动作。

**修复建议：可行**

建议为 ImpactService 引入 impact 专用有向遍历，或扩展 QueryService 输入以显式表达方向/传播语义。需要注意的是，“只沿 sourceDocId -> targetDocId”可修复 `sync_required` / `sync_suggested` 等典型下游传播误报，但最终实现最好把关系类型的传播方向作为显式策略处理，避免 `context_for` 等类型的业务语义被过度简化。

**误报评估：非误报**

该行为可由现有双向遍历代码直接推出，且现有测试未覆盖“起点位于 target 端时不得返回 source 端”的反向场景。

---

## 发现 #2 评估

### 审查原文

> **[中] 低置信度关系仍会参与三跳扩展，导致低可信路径后的高置信节点进入影响结果**
> - 来源：edge
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：准确**

ImpactService 将 `confidenceThreshold` 应用于 `traversal.relations` 的最终输出过滤：[src/services/impact-service.ts:87](../../../../src/services/impact-service.ts#L87)。但 QueryService 在 BFS 阶段只按 `includeDeprecated` / `status` 过滤可遍历边，不知道 ImpactService 的阈值：[src/services/query-service.ts:52-53](../../../../src/services/query-service.ts#L52-L53)。当低置信边连接到下一层高置信边时，低置信边虽然最终不会输出，却仍可能通过 `queue.push()` 扩展到后续节点：[src/services/query-service.ts:85-87](../../../../src/services/query-service.ts#L85-L87)。

Story AC4 明确要求影响分析默认过滤置信度大于等于 0.50 的关系，且可通过配置调整：[_bmad-output/implementation-artifacts/stories/3-3-impactservice-change-impact-analysis.md:16](../../../stories/3-3-impactservice-change-impact-analysis.md#L16)。架构规则也强调 BFS/DFS 需要区分“可扩展边”和“可输出边”，可扩展边由路径语义决定，而不能简单由最终输出过滤替代：[_bmad-output/planning-artifacts/architecture/04-implementation-patterns-consistency-rules.md:526-531](../../../../planning-artifacts/architecture/04-implementation-patterns-consistency-rules.md#L526-L531)。对影响分析来说，置信度阈值属于路径可信度语义，低于阈值的边不应继续扩展影响路径。

**严重性判断：合理**

原始严重性为中等合理。该问题会产生“穿过低可信关系后的高可信节点”误报，使用户误以为存在可靠影响路径；评估后按 P1 处理，因为它违反 AC4 的过滤语义并影响核心结果可信度。

**修复建议：可行**

建议在 ImpactService 的遍历阶段同时应用 `status === 'active'` 与 `confidence >= confidenceThreshold`，低于阈值的关系既不输出也不扩展。若继续复用 QueryService，应扩展 QueryService 的遍历输入，使 ImpactService 能传入路径级过滤条件，而不是仅对返回结果做二次过滤。

**误报评估：非误报**

现有测试只验证低置信一跳不会出现在最终输出：[tests/unit/services/impact-service.test.ts:231](../../../../tests/unit/services/impact-service.test.ts#L231)，未验证“低置信一跳 + 高置信二跳”场景，因此无法防止该缺陷回归。

---

## 发现 #3 评估

### 审查原文

> **[中] 同一受影响文档经多条关系或路径到达时会重复输出并膨胀 totalCount**
> - 来源：blind+edge
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：准确**

ImpactService 当前对 QueryService 返回的关系执行 `filter -> map -> sort`，没有按受影响文档去重：[src/services/impact-service.ts:87-88](../../../../src/services/impact-service.ts#L87-L88)。`totalCount` 直接取 `impactedDocs.length`：[src/services/impact-service.ts:93](../../../../src/services/impact-service.ts#L93)。QueryService 只用 `seenRelationIds` 去重关系 ID，而不是去重目标文档：[src/services/query-service.ts:38](../../../../src/services/query-service.ts#L38)、[src/services/query-service.ts:56-57](../../../../src/services/query-service.ts#L56-L57)。`visitedDocIds` 只限制重复扩展，不阻止同一文档通过另一条关系再次被输出：[src/services/query-service.ts:85-87](../../../../src/services/query-service.ts#L85-L87)。

因此同一目标文档若由两条关系命中，或通过两条不同路径抵达，会在 `impactedDocs` 中重复出现，`totalCount` 也会变成关系命中数而非受影响文档数。Story AC2 使用的是“受影响文档路径”而非“受影响关系记录”，因此审查判断成立：[_bmad-output/implementation-artifacts/stories/3-3-impactservice-change-impact-analysis.md:14](../../../stories/3-3-impactservice-change-impact-analysis.md#L14)。

**严重性判断：合理**

原始严重性为中等合理。重复输出会放大影响范围、误导 CLI 表格/JSON 消费者，并可能触发重复同步提示；评估后按 P1 处理，因为它影响用户可见结果和自动化消费者行为。

**修复建议：可行**

按 `docPath` 去重是可行修复。重复命中时建议保留最高严重程度，其次保留更短 `hopDistance`，再按更高 `confidence` 或稳定排序规则决策；如后续需要保留多条关系上下文，可新增聚合字段，但 v0.1 至少应保证每个受影响文档只输出一次且 `totalCount` 与文档数一致。

**误报评估：非误报**

现有测试覆盖总数和排序，但 fixture 未包含同一目标文档多关系或多路径命中的样例：[tests/unit/services/impact-service.test.ts:175](../../../../tests/unit/services/impact-service.test.ts#L175)、[tests/unit/services/impact-service.test.ts:217](../../../../tests/unit/services/impact-service.test.ts#L217)、[tests/unit/services/impact-service.test.ts:320](../../../../tests/unit/services/impact-service.test.ts#L320)、[tests/unit/services/impact-service.test.ts:348](../../../../tests/unit/services/impact-service.test.ts#L348)。

---

## 整体评估结论

### 需要修复（阻塞交付）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 1 | 双向遍历导致上游文档误报 | [中] | **P1** | 影响分析必须区分传播方向，否则核心结果会包含反向端点。 |
| 2 | 低置信边仍参与路径扩展 | [中] | **P1** | 低于阈值的路径不应继续传播，否则会产生低可信路径后的误报。 |
| 3 | 同一受影响文档重复输出并膨胀 totalCount | [中] | **P1** | 影响结果应按受影响文档集合表达，不能把关系数误作文档数。 |

### 建议纳入 CR TODO 跟踪（非阻塞）

无。本轮 3 条发现均为当前 Story 核心语义缺陷，不建议降级为非阻塞 TODO。

### 可忽略（误报）

无。本轮未发现误报。

### 评估决定

- **发现 #1（双向遍历导致上游文档误报）**：确认有效，需修复。修复时应显式建模 ImpactService 的传播方向，至少不能复用无差别双向遍历作为影响路径。
- **发现 #2（低置信边仍参与路径扩展）**：确认有效，需修复。`confidenceThreshold` 应参与影响路径扩展裁剪，而不是只过滤最终输出。
- **发现 #3（同一受影响文档重复输出并膨胀 totalCount）**：确认有效，需修复。结果需要按受影响文档去重，并补充多关系/多路径命中测试。
- **总体决定**：本轮 CR 发现客观成立，建议修复 3 个 P1 问题并补齐对应回归测试后，再发起下一轮 CR 复审。

## 修复执行记录

### 修复执行记录
- **Date**: 2026-05-11
- **Model Used**: GPT-5.4
- **Fix Items**: 3

#### 修复项 1：双向遍历导致上游文档误报
- **涉及文件**: `src/services/impact-service.ts`, `tests/unit/services/impact-service.test.ts`
- **处理方式**: 移除 ImpactService 对无方向 `QueryService.query()` 结果的复用，改为在服务内部实现固定三跳的有向 BFS，只沿 `sourceDocId -> targetDocId` 传播，并保持缺失源文档/缺失端点的 `CORD_QUERY_001` / `CORD_QUERY_002` 错误契约。
- **结果**: 已修复；新增“起点只出现在 target 端时不得返回上游 source 端”的回归测试并通过。

#### 修复项 2：低置信边仍参与路径扩展
- **涉及文件**: `src/services/impact-service.ts`, `tests/unit/services/impact-service.test.ts`
- **处理方式**: 将 `status === 'active'` 与 `confidence >= confidenceThreshold` 前移到“可扩展边”判定，低于阈值或已 deprecated 的关系既不输出，也不参与后续 BFS 扩展。
- **结果**: 已修复；新增“低置信一跳 + 高置信二跳”穿透场景回归测试并通过。

#### 修复项 3：同一受影响文档重复输出并膨胀 totalCount
- **涉及文件**: `src/services/impact-service.ts`, `tests/unit/services/impact-service.test.ts`
- **处理方式**: 按 `docPath` 聚合 Impact 结果，重复命中时按“更高严重程度 → 更短 `hopDistance` → 更高 `confidence`”保留最佳命中，并让 `totalCount` 反映去重后的受影响文档数。
- **结果**: 已修复；新增“同一文档被多条路径命中时仅输出一次”的回归测试并通过。

#### 验证记录
- `npx vitest run tests/unit/services/impact-service.test.ts`
- `npx vitest run tests/unit/services/impact-service.test.ts tests/unit/cli/commands/impact.test.ts tests/integration/cli/impact.test.ts && npm run lint && npm run type-check`
- `npm test`
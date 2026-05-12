---
Story: 3-3
Round: 1
Date: 2026-05-11
Model Used: GitHub Copilot (unspecified)
Type: Code Review Summary
---

## 审查结论

首轮审查。三层审查全部完成（Blind Hunter / Edge Case Hunter / Acceptance Auditor 均成功，失败层：无）。`npm test`、`npm run lint`、`npm run build`、`npm run type-check` 均通过；Acceptance Auditor 未发现 AC 覆盖缺口。但本轮发现 3 个影响分析核心语义相关的中风险问题，均属于修复方案明确的 `patch` 桶，建议修复后再进入最终通过。

## 新发现

### 1. [中] 影响分析复用双向遍历，可能把上游文档误报为受影响文档

- **来源**：edge
- **分类**：patch

- **证据**
  - `src/services/query-service.ts:52` 通过 `getRelationsByDocId(current.docId, 'both')` 双向取边；`src/services/impact-service.ts:81-88` 直接复用 `query()` 的 `relations` 生成影响结果。
  - `src/types/relations.ts:7-23` 对 `sync_required` / `sync_suggested` 的语义描述是“源文档更新后目标文档...”，因此影响分析应至少区分传播方向。

- **影响**
  - 当变更文档处于关系 target 端时，当前实现会把 source 端也作为 `impactedDocs` 输出，造成上游文档误报和错误建议动作。
  - 这会污染 `cord impact <doc>` 的核心结果，并影响后续 MCP/Hook 自动同步提示。

- **建议**
  - 为 ImpactService 使用有方向的下游遍历，至少从起点只沿 `sourceDocId -> targetDocId` 的传播方向扩展。
  - 若仍需复用 QueryService，建议扩展查询输入支持 direction，或在 ImpactService 内实现 impact 专用 BFS。
  - 补充测试：构造 `source -> changedDoc` 的 `sync_required` 关系，断言 changedDoc 的影响分析不返回 source。

### 2. [中] 低置信度关系仍会参与三跳扩展，导致低可信路径后的高置信节点进入影响结果

- **来源**：edge
- **分类**：patch

- **证据**
  - `src/services/query-service.ts:52-66` 的遍历阶段只过滤 deprecated，不接收 impact 的 `confidenceThreshold`。
  - `src/services/impact-service.ts:86-88` 只在遍历完成后过滤输出项；低置信边虽不会输出，但仍可能作为路径继续扩展。

- **影响**
  - 示例：A->B 置信度 0.49、B->C 置信度 0.95。对 A 做影响分析时，B 被过滤，但 C 仍可能被输出，实际结果穿过了应被阈值排除的低可信路径。
  - 这削弱 AC4 的过滤语义，可能把“低可信关系之后的高可信节点”误报为真实影响。

- **建议**
  - 在 impact 遍历过程中同时应用 `status === 'active'` 与 `confidence >= threshold`，低于阈值的关系既不输出也不扩展。
  - 补充测试：低置信一跳 + 高置信二跳的样例，断言二跳节点不出现在结果中。

### 3. [中] 同一受影响文档经多条关系或路径到达时会重复输出并膨胀 totalCount

- **来源**：blind+edge
- **分类**：patch

- **证据**
  - `src/services/impact-service.ts:86-93` 对 `traversal.relations` 只执行 `filter -> map -> sort`，没有按 `docPath` 去重。
  - `totalCount` 直接取 `impactedDocs.length`，因此重复关系或重复路径会把关系数误计为受影响文档数。

- **影响**
  - 同一目标文档通过多条关系或多条路径到达时，CLI 表格和 JSON 会重复列出该文档，用户看到的影响范围被放大。
  - 自动化消费者可能对同一文档重复提示或重复执行后续同步动作。

- **建议**
  - 按 `docPath` 对结果去重；重复命中时保留最高严重程度，其次保留更短 `hopDistance`，必要时聚合 relationType/propagationType 作为元数据。
  - 补充测试：同一目标文档由两条关系命中，断言只输出一次且 `totalCount === 1`。

## 验证摘要

- `npm test` ✅ 通过（316 / 316）
- `npm run lint` ✅ 通过
- `npm run build` ✅ 通过
- `npm run type-check` ✅ 通过
- 定向复核：
  - 三层审查输入来自 Story File List 对应的 13 个实现/测试文件，以及 Story/sprint 状态文件的当前工作区 diff。
  - Acceptance Auditor 对 AC-1 至 AC-10 判定为覆盖，无新增验收缺口。
  - Blind Hunter 提出的未知 `relationType` 崩溃风险已复核为误报：SQLite schema 和 repository mapper 均有枚举白名单校验，已归入 `dismiss`，不作为新发现输出。

## 通过项

- ImpactService 已实现三跳影响分析入口、置信度阈值参数、deprecated 状态过滤、建议动作映射与严重程度排序。
- CLI `cord impact <doc>` 已支持默认表格输出、`--json`、显式 `--confidence-threshold`，并覆盖基本错误路径。
- 单元测试与集成测试覆盖正常分析、空影响、阈值优先级、传播行为建议映射、deprecated 状态过滤和三跳边界。
- 本轮无 `defer` 桶既有问题。

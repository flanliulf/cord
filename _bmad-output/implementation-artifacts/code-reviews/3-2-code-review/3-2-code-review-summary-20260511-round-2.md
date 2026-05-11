---
Story: 3-2
Round: 2
Date: 2026-05-11
Model Used: GitHub Copilot (model not exposed)
Type: Code Review Summary
---

## 审查结论

本轮为复审。Round 1 的 2 个 P1 问题均已按评估记录完成修复：`type` 过滤不再阻断 BFS 深层遍历，性能验证也新增 SQLite 仓储路径覆盖。当前 `npx vitest run tests/unit/services/query-service.test.ts`、`npm test`、`npm run lint`、`npm run build` 均通过。但复审发现 1 个新的中优先级边界问题：`type` 过滤查询仍会解析非目标类型坏边，可能被无关关系端点阻断。建议修复后再进入下一轮复审，本轮不建议直接通过。

## 上轮问题回顾

### 已修复

1. Round 1 / Finding #1 — `type` 过滤截断 BFS 遍历路径
   - 修复位置：`src/services/query-service.ts:51-77`
   - 修复方式：BFS 遍历阶段只按 `includeDeprecated` 过滤可遍历边，`type` 过滤移动到写入 `relations` 前，非匹配中间边不再阻断深层匹配关系。
   - 验证结果：`tests/unit/services/query-service.test.ts` 新增 `does not let type filtering block deeper matches reachable through non-matching edges`；相关测试 14/14 通过。

2. Round 1 / Finding #2 — 200→2000 文档性能退化测试未让数据规模进入三跳查询热路径
   - 修复位置：`tests/unit/services/query-service.test.ts:280-328,636-651`
   - 修复方式：保留 indexed in-memory adjacency lookup 基准，并新增基于 `SqliteGraphRepository` 的 200→2000 文档三跳性能验证，覆盖真实 `getRelationsByDocId` 查询路径。
   - 验证结果：相关测试 14/14 通过，全量测试 301/301 通过。

### 仍为非阻塞待办

1. SQLite p95 比例性能测试存在环境敏感性
   - 维持本轮评估结论：非阻塞风险。当前测试通过；后续若 CI 发生偶发抖动，可补充 `EXPLAIN QUERY PLAN` / 索引使用断言，或迁移到独立 benchmark 流程。

## 新发现

### 1. [中][新] `type` 过滤查询仍会解析非目标类型坏边，可能被无关关系端点阻断

- **来源**：blind+edge
- **分类**：patch

- **证据**
  - `src/services/query-service.ts:51-64` 先取得 active traversable edges，随后在循环内立即调用 `resolveRelatedDocument(current.docId, relation)`，之后才判断 `validatedInput.type === undefined || relation.relationType === validatedInput.type`。
  - 对 `depth: 1` 且指定 `type` 的查询而言，非匹配类型关系既不会输出，也不会继续扩展；但当前实现仍会解析这类边的目标文档。如果该非匹配边存在缺失端点，查询会抛出 `CORD_QUERY_002`，阻断本可返回的匹配结果。

- **影响**
  - 这是 Round 1 修复后引入的边界回归风险：为支持跨非匹配边的深层遍历，代码扩大了端点解析范围，但没有区分“需要输出/扩展的边”和“无需处理的非匹配叶子边”。在存在图谱坏数据或自定义仓储实现时，过滤查询可能被无关坏边影响。

- **建议**
  - 在解析目标文档前先计算是否需要处理该边，例如：`shouldOutput = type 未指定或类型匹配`，`shouldExpand = hopDistance < validatedInput.depth`。
  - 当 `!shouldOutput && !shouldExpand` 时直接跳过，不调用 `resolveRelatedDocument`。
  - 补充回归测试：同一源文档存在一条匹配类型的有效边，以及一条非匹配类型但端点缺失的边；`depth: 1 + type` 查询应返回匹配边，不应被非匹配坏边阻断。

## 验证摘要

- `npx vitest run tests/unit/services/query-service.test.ts` ✅ 通过（14 / 14）
- `npm test` ✅ 通过（301 / 301）
- `npm run lint` ✅ 通过
- `npm run build` ✅ 通过
- 额外复核：
  - Round 1 Finding #1 的修复路径已覆盖 `type` 过滤与 BFS 遍历分离。
  - Round 1 Finding #2 的修复路径已新增 SQLite 仓储性能验证。
  - 新发现基于静态复核确认，未执行独立复现脚本。

## 通过项

- AC1-AC3：`depth` schema、CLI 参数转发、BFS 遍历与 `hopDistance` 输出均保持有效。
- AC4：三跳 p95 < 5ms 的 in-memory 性能基准通过。
- AC5：200→2000 文档退化测试已扩展到 SQLite 仓储路径，并在本轮验证通过。
- AC6：BFS 正确性、深度限制、环路处理、`depth + type` 组合与性能基准均有测试覆盖。
- 历史修复持续有效：Round 1 的两个确认问题均未复现为原问题。

## 结论

- **结论：不通过**
- **阻塞项**：1 个中优先级新 patch 项（`type` 过滤查询被非目标类型坏边阻断）
- **建议**：修复新发现并补充对应回归测试后，执行 Round 3 复审。

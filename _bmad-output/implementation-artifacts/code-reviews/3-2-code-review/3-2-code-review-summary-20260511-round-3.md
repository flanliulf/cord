---
Story: 3-2
Round: 3
Date: 2026-05-11
Model Used: GitHub Copilot (model not exposed)
Type: Code Review Summary
---

## 审查结论

本轮为复审。Round 2 的 P1 问题已完成修复：`QueryService` 现在先计算 `hopDistance`、`shouldOutput` 和 `shouldExpand`，对于既不需要输出也不需要扩展的非匹配边，会在解析端点前跳过；对应回归测试已补充。当前 `npx vitest run tests/unit/services/query-service.test.ts`、`npm test`、`npm run lint`、`npm run build` 均通过。本轮未发现新的阻塞项或中高优先级问题，建议通过。

## 上轮问题回顾

### 已修复

1. Round 1 / Finding #1 — `type` 过滤截断 BFS 遍历路径
   - 修复位置：`src/services/query-service.ts:51-86`
   - 修复方式：BFS 遍历阶段不再按 `type` 截断可遍历边，`type` 仅控制是否写入输出结果，非匹配中间边仍可用于深层遍历。
   - 验证结果：`tests/unit/services/query-service.test.ts` 覆盖 `depth + type` 深层匹配场景；相关测试通过。

2. Round 1 / Finding #2 — 200→2000 文档性能退化测试未让数据规模进入三跳查询热路径
   - 修复位置：`tests/unit/services/query-service.test.ts:280-328,680-695`
   - 修复方式：保留 indexed in-memory adjacency lookup 基准，并新增基于 `SqliteGraphRepository` 的 200→2000 文档三跳性能验证，覆盖真实 repository 查询路径。
   - 验证结果：相关服务测试 15/15 通过，全量测试 302/302 通过。

3. Round 2 / Finding #1 — `type` 过滤查询被非目标类型坏边阻断
   - 修复位置：`src/services/query-service.ts:59-70`、`tests/unit/services/query-service.test.ts:402-444`
   - 修复方式：在解析端点前计算 `shouldOutput` 与 `shouldExpand`；当非匹配边既不会输出也不会继续扩展时，先标记 seen 并跳过，避免无关坏边触发 `CORD_QUERY_002`。
   - 验证结果：新增 `ignores non-matching broken edges when the query neither outputs nor expands them` 测试；相关服务测试 15/15 通过。

### 仍为非阻塞待办

1. SQLite p95 比例性能测试存在环境敏感性
   - 维持既有评估结论：CR TODO / 非阻塞。当前本轮验证通过；后续若 CI 抖动，可补 `EXPLAIN QUERY PLAN` / 索引使用断言，或迁移到独立 benchmark 流程。

2. SQLite 测试 helper 构造失败路径的清理可进一步加固
   - 维持本轮评估结论：非阻塞。该风险仅影响测试 seed 阶段抛错时的临时资源清理，不影响 Story 3.2 运行时行为或 AC 满足；后续可在创建 repository 后立即注册 disposable 或用 try/finally 包住 seed。

## 新发现

本轮未发现新的阻塞项或中高优先级问题。

## 验证摘要

- `npx vitest run tests/unit/services/query-service.test.ts` ✅ 通过（15 / 15）
- `npm test` ✅ 通过（302 / 302）
- `npm run lint` ✅ 通过
- `npm run build` ✅ 通过
- 额外复核：
  - Round 1 的 `type` 深层遍历修复仍有效。
  - Round 1 的 SQLite 仓储性能验证仍有效。
  - Round 2 的非匹配坏边跳过逻辑已按评估建议实现并有回归测试。

## 通过项

- AC1-AC3：`depth` schema、CLI 参数转发、BFS 遍历与 `hopDistance` 输出均满足。
- AC4：三跳 p95 < 5ms 的 in-memory 性能基准通过。
- AC5：200→2000 文档退化验证覆盖 indexed in-memory 与 SQLite repository 两条路径，并在本轮测试通过。
- AC6：BFS 正确性、深度限制、环路处理、`depth + type` 组合、非匹配坏边跳过与性能基准均有测试覆盖。
- 三层审查状态：Blind Hunter、Edge Case Hunter、Acceptance Auditor 均完成；无失败审查层。

## 结论

- **结论：通过**
- **阻塞项**：无
- **建议**：可进入 CR evaluation / finalizer；非阻塞测试稳健性建议可按 CR TODO 后续跟踪。

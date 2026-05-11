---
Story: 3-2
Round: 1
Date: 2026-05-11
Model Used: GitHub Copilot (model not exposed)
Type: Code Review Summary
---

## 审查结论

首轮审查。三层审查均完成（Edge Case Hunter 首次调用失败后重试成功）。`npm test`、`npm run lint`、`npm run build` 均通过，但本轮发现 2 个中优先级 patch 项：一个可能导致多跳 `type` 查询漏报深层匹配关系，另一个使 NFR7 性能退化验证存在假阳性风险。建议修复后进入下一轮复审，本轮不建议直接通过。

## 新发现

### 1. [中] `type` 过滤会截断 BFS 遍历路径，导致深层匹配关系漏报

- **来源**：edge
- **分类**：patch

- **证据**
  - `src/services/query-service.ts:51-56` 先对 `relatedEdges` 应用 `validatedInput.type` 过滤，然后才进入 BFS 循环处理关系。若从起点到深层目标必须先经过一个非匹配类型关系，该边会被过滤掉，队列不会扩展到下一节点。
  - 现有测试覆盖了 depth、环路、BFS 顺序，但没有覆盖 `depth > 1` 且指定 `type` 时跨非匹配边到达匹配边的场景。

- **影响**
  - 多跳查询在组合使用 `--depth` 与 `--type` 时可能漏报实际可达的深层关系，破坏查询结果完整性。

- **建议**
  - 将“遍历用边过滤”和“结果输出过滤”分离：BFS 扩展应使用可遍历的 active 边，只有写入 `relations` 时应用 `type` 过滤。
  - 补充 `depth + type` 组合测试：例如 A --references--> B --sync_required--> C，从 A 查询 `--depth 2 --type sync_required` 应返回 B-C 关系。

### 2. [中] 200→2000 文档性能退化测试未让数据规模进入三跳查询热路径

- **来源**：blind+edge+auditor
- **分类**：patch

- **证据**
  - `tests/unit/services/query-service.test.ts:248-258` 的 `createLinearGraphService` 构造稀疏线性链路。
  - `tests/unit/services/query-service.test.ts:542-549` 从 `docs/0.md` 以 `depth: 3` 查询，实际只访问前三跳附近的边；200 与 2000 文档的规模差异主要落在未遍历区域。

- **影响**
  - AC5 / NFR7 要求验证 200→2000 文档性能退化不超过 10%，但当前测试可能在规模没有进入查询热路径的情况下通过，不能充分证明扩展性目标。

- **建议**
  - 补充更能代表 2000 文档关系图的性能用例，使三跳范围内的节点数或边数随数据规模增长。
  - 或增加 SQLite 仓储层集成性能验证，覆盖真实 `getRelationsByDocId` 查询成本。

## 验证摘要

- `npm test` ✅ 通过（30 个测试文件 / 299 个测试）
- `npm run lint` ✅ 通过
- `npm run build` ✅ 通过
- 定向复现：未执行独立复现脚本；基于 diff、源码和现有测试结构完成静态复核。

## 通过项

- `src/schemas/query-input.ts` 已将 `depth` 限制为整数 1~3，并默认 1。
- `src/cli/commands/query.ts` 已支持 `--depth <depth>` 并将 `hopDistance` 输出到文本表格和 JSON 结果。
- `src/services/query-service.ts` 已实现基于队列的 BFS，并为输出关系标注 `hopDistance`。
- 现有测试覆盖一跳默认行为、深度限制、环路去重、CLI 参数转发和基础性能门槛。

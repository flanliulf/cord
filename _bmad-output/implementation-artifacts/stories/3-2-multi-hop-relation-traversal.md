# Story 3.2: 多跳关系遍历

Status: done

## Story

As a 用户，
I want 查询指定文档的二跳、三跳间接关联关系，
So that 我可以了解更深层的文档依赖链路。

## Acceptance Criteria (AC)

1. **Given** Story 3.1 一跳查询就绪 **When** 多跳查询 **Then** QueryService 支持 `--depth <N>` 参数（1/2/3 跳，默认 1）（FR16）
2. **Given** 多跳实现 **When** 算法 **Then** 使用 BFS 算法，结果按距离排序
3. **Given** 结果 **When** 检查 **Then** 标注每条关系的跳数距离
4. **Given** 性能 **When** 三跳遍历 **Then** p95 < 5ms（NFR2）
5. **Given** 可扩展性 **When** 200→2000 文档 **Then** 性能退化不超过 10%（NFR7）
6. **Given** 实现完毕 **When** 测试 **Then** BFS 正确性 + 深度限制 + 环路处理 + 性能基准

## Tasks / Subtasks

- [x] Task 1: 扩展 QueryService BFS 遍历 (AC: #1, #2, #3)
- [x] Task 2: 环路检测（visited set）
- [x] Task 3: 更新 CLI query 命令支持 --depth
- [x] Task 4: 编写测试 (AC: #4, #5, #6)

## Dev Notes

### BFS 遍历实现

```typescript
queryMultiHop(input: QueryInput & { depth: number }): MultiHopResult {
  const visited = new Set<string>();
  const queue: { docId: string; depth: number }[] = [{ docId: startDocId, depth: 0 }];
  const results: RelationWithDepth[] = [];
  while (queue.length > 0) {
    const { docId, depth } = queue.shift()!;
    if (depth >= maxDepth || visited.has(docId)) continue;
    visited.add(docId);
    const relations = this.repo.getRelationsByDocId(docId, 'both');
    for (const rel of relations) {
      results.push({ ...rel, hopDistance: depth + 1 });
      queue.push({ docId: rel.targetDocId === docId ? rel.sourceDocId : rel.targetDocId, depth: depth + 1 });
    }
  }
  return { startDocId, maxDepth, relations: results, visitedDocIds: [...visited] };
}
```

### 架构约束

- BFS 使用 Repository 同步 API，无需 async
- 环路通过 visited set 处理

### Project Structure Notes

- `src/services/query-service.ts` — 扩展

### References

- [Source: prd.md#FR16] — 多跳遍历
- [Source: prd.md#NFR2, NFR7] — 性能
- [Source: epics.md#Story 3.2] — 验收标准

## Dev Agent Record

### Agent Model Used
- GPT-5.4

### Implementation Plan
- 在 QueryService 中引入 BFS 队列遍历、visited 文档集合与 seen relation 集合，保证多跳结果按距离输出并避免环路重复展开。
- 在 query 输入 schema 与 CLI 命令中加入 `depth`（1~3，默认 1），并把 `hopDistance` 纳入文本/JSON 输出契约。
- 用单元测试覆盖 BFS 正确性、深度限制、环路处理、三跳 p95 和 200→2000 文档的相对性能退化。

### Debug Log References
- `npx vitest run tests/unit/services/query-service.test.ts tests/unit/cli/commands/query.test.ts`
- `npx vitest run tests/unit/services/query-service.test.ts tests/unit/cli/commands/query.test.ts tests/unit/schemas/query-input.test.ts`
- `npm test`
- `npm run lint`
- `npm run type-check`

### Completion Notes List
- 实现 QueryService 多跳 BFS 遍历，支持 `depth` 1~3 且默认 1 跳，为每条关系返回 `hopDistance`。
- 使用 visited 文档集合和 seen relation 集合处理环路与重复边，保留按 BFS 距离输出的结果顺序。
- 更新 CLI `query` 命令支持 `--depth`，并在表格输出中新增 `hopDistance` 列。
- 新增并更新 query 相关单元测试与性能基准，验证深度限制、环路处理、p95 < 5ms 与 200→2000 文档退化 <= 10%。

### File List
- src/schemas/query-input.ts
- src/services/query-service.ts
- src/cli/commands/query.ts
- tests/unit/services/query-service.test.ts
- tests/unit/cli/commands/query.test.ts
- tests/unit/schemas/query-input.test.ts
- tests/unit/cli/index.test.ts
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/stories/3-2-multi-hop-relation-traversal.md

## Change Log

- 2026-05-11: 实现多跳 BFS 查询、CLI `--depth`、`hopDistance` 输出及对应测试与性能基准。

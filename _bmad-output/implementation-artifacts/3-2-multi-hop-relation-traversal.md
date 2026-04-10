# Story 3.2: 多跳关系遍历

Status: ready-for-dev

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

- [ ] Task 1: 扩展 QueryService BFS 遍历 (AC: #1, #2, #3)
- [ ] Task 2: 环路检测（visited set）
- [ ] Task 3: 更新 CLI query 命令支持 --depth
- [ ] Task 4: 编写测试 (AC: #4, #5, #6)

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
### Debug Log References
### Completion Notes List
### File List

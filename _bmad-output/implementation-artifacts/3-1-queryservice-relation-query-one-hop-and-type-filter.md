# Story 3.1: QueryService 关系查询（一跳 + 类型过滤）

Status: ready-for-dev

## Story

As a 用户，
I want 通过 `cord query <doc>` 查询指定文档的所有关联关系，
So that 我可以了解某份文档与哪些其他文档有关联、关系类型是什么。

## Acceptance Criteria (AC)

1. **Given** 已有关系图谱 **When** 执行查询 **Then** `src/services/query-service.ts` 实现一跳关系查询（FR13）
2. **Given** 查询结果 **When** 检查内容 **Then** 包含：目标文档路径、关系类型、置信度、来源
3. **Given** --type flag **When** 传入 **Then** 按关系类型过滤结果（FR14）
4. **Given** CLI 命令 **When** 实现 **Then** `src/cli/commands/query.ts` 薄壳命令
5. **Given** 默认输出 **When** 检查 **Then** 人类可读表格格式
6. **Given** --json **When** 传入 **Then** 机器可读 JSON
7. **Given** 性能 **When** 测量 **Then** 一跳查询 p95 < 1ms（NFR1）
8. **Given** 文档不存在 **When** 查询 **Then** 明确错误信息（NFR19）
9. **Given** 实现完毕 **When** 测试 **Then** 覆盖正常查询 + 类型过滤 + 空结果 + 文档不存在

## Tasks / Subtasks

- [ ] Task 1: 实现 QueryService (AC: #1, #2, #3)
- [ ] Task 2: 实现 CLI 命令 (AC: #4, #5, #6, #8)
- [ ] Task 3: 更新 index.ts
- [ ] Task 4: 编写测试 (AC: #7, #9)

## Dev Notes

### QueryService 设计

```typescript
export class QueryService {
  constructor(private readonly repo: IGraphRepository) {}
  query(input: QueryInput): QueryResult {
    // 1. 查找文档 → 不存在抛 QueryError
    // 2. repo.getRelationsByDocId(docId, 'both')
    // 3. 可选类型过滤
    // 4. 返回 QueryResult
  }
}
```

### 架构约束

- **P7**: 构造函数注入 IGraphRepository
- **P11**: 输入 QueryInput（Zod 推导），输出 QueryResult
- **P12**: CLI 薄壳
- CLI 表格输出建议使用 picocolors 着色

### Project Structure Notes

- `src/services/query-service.ts`
- `src/cli/commands/query.ts`

### References

- [Source: prd.md#FR13-FR14] — 查询需求
- [Source: prd.md#NFR1, NFR19] — 性能和错误格式
- [Source: epics.md#Story 3.1] — 验收标准

## Dev Agent Record

### Agent Model Used
### Debug Log References
### Completion Notes List
### File List

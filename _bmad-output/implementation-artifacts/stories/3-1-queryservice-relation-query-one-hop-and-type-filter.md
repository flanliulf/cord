# Story 3.1: QueryService 关系查询（一跳 + 类型过滤）

Status: ready-for-dev

## Story

As a 用户，
I want 通过 `cord query <doc>` 查询指定文档的所有关联关系，
So that 我可以了解某份文档与哪些其他文档有关联、关系类型是什么。

## Acceptance Criteria (AC)

1. **Given** 已有关系图谱 **When** 执行查询 **Then** `src/services/query-service.ts` 实现一跳关系查询（FR13）
2. **Given** 查询结果 **When** 检查内容 **Then** 包含：`relationId`、目标文档路径、关系类型、置信度、来源、status（`relationId` 作为后续 `remove_relation` / `deprecate_relation` 操作的句柄，FR20 先查后改路径依赖）
3. **Given** --type flag **When** 传入 **Then** 按关系类型过滤结果（FR14）
4. **Given** CLI 命令 **When** 实现 **Then** `src/cli/commands/query.ts` 薄壳命令
5. **Given** 默认输出 **When** 检查 **Then** 人类可读表格格式
6. **Given** --json **When** 传入 **Then** 机器可读 JSON
7. **Given** 性能 **When** 测量 **Then** 一跳查询 p95 < 1ms（NFR1）
8. **Given** 文档不存在 **When** 查询 **Then** 抛出 `QueryError extends CordError`，包含错误码（`code`）和建议操作（`suggestion`），符合 NFR19 的 `[错误码] 错误描述 → 建议操作` 格式
9. **Given** 默认查询 **When** 执行 **Then** 只返回 `status='active'` 的关系，过滤所有 `status='deprecated'` 的关系
10. **Given** `--include-deprecated` flag **When** 传入 **Then** 同时返回 `status='deprecated'` 的关系（含 status 字段标注）
11. **Given** 实现完毕 **When** 测试 **Then** 覆盖正常查询 + 类型过滤 + 空结果 + 文档不存在（含 `code`/`suggestion` 字段验证）+ deprecated 关系默认被过滤 + `--include-deprecated` 可见

## Tasks / Subtasks

- [ ] Task 1: 实现 QueryService (AC: #1, #2, #3, #9, #10)
  - [ ] 1.1 QueryInput 中增加可选 `includeDeprecated?: boolean`（默认 false）
  - [ ] 1.2 默认查询结果过滤 `status='deprecated'` 的关系；`includeDeprecated=true` 时包含全量关系
- [ ] Task 2: 实现 CLI 命令 (AC: #4, #5, #6, #8, #10)
  - [ ] 2.1 `cord query` 新增 `--include-deprecated` flag，传递给 QueryInput
- [ ] Task 3: 更新 index.ts
- [ ] Task 4: 编写测试 (AC: #7, #11)，测试须验证 `QueryError` 携带有效 `code` 和 `suggestion` 字段

## Dev Notes

### QueryService 设计

```typescript
// QueryResultItem — 单条查询结果（发现#1 裁决：补 relationId 供 remove/deprecate 使用）
export interface QueryResultItem {
  relationId: string;       // 供 remove_relation / deprecate_relation 操作的句柄
  targetPath: string;
  relationType: RelationType;
  confidence: number;
  source: 'auto_scan' | 'manual' | 'framework_preset';
  status: 'active' | 'deprecated';
}

// CLI --json 输出 / MCP QueryRelationsResult 共享包裹层（NFR13 CLI/MCP parity，与 Story 5.1 QueryRelationsResult 对齐）
export interface QueryRelationsOutput {
  relations: QueryResultItem[];
  totalCount: number;
}

export class QueryService {
  constructor(private readonly repo: IGraphRepository) {}
  query(input: QueryInput): QueryRelationsOutput {
    // 1. 查找文档 → 不存在抛 QueryError
    // 2. repo.getRelationsByDocId(docId, 'both')
    // 3. 默认过滤 status='deprecated' 关系（除非 input.includeDeprecated=true）
    // 4. 可选关系类型过滤
    // 5. 返回 QueryRelationsOutput { relations: QueryResultItem[], totalCount }
  }
}

// QueryInput 增加 deprecated 控制开关
export interface QueryInput {
  docPath: string;
  type?: RelationType;           // 按关系类型过滤
  includeDeprecated?: boolean;   // 默认 false，过滤 status='deprecated' 的关系
}
```

### deprecated 读侧语义裁决（发现#2 裁决）

**策略：默认过滤 `status='deprecated'` + `includeDeprecated` 开关。**

- 大多数查询/影响分析场景期望只看活跃关系，deprecated 静默过滤不产生噪音
- 用户主动传入 `--include-deprecated`（CLI）或 `includeDeprecated: true`（Service）时返回全量关系，含 status 字段标注
- 关系导出（`cord export`）场景应始终包含 deprecated 关系（完整快照）

此语义同样适用于 Story 3.3 ImpactService：影响分析默认不计入 `status='deprecated'` 的关系。

### 错误处理约束（NFR19 + D3）

文档不存在时必须抛出 `QueryError`（继承自 `CordError`），携带：
- `code: string` — 错误码，遵循 `CORD_{MODULE}_{NNN}` 规范，例如 `CORD_QUERY_001`
- `suggestion: string` — 建议操作，例如 `"请先运行 cord scan 确认文档路径"`

格式要求：`[错误码] 错误描述 → 建议操作`（NFR19），禁止使用普通 `Error` 或裸字符串替代。

```typescript
// CordError 基类已在 Story 1.2 中定义 (src/utils/errors.ts)
export class QueryError extends CordError {
  constructor(params: { message: string; code: string; suggestion: string; context?: Record<string, unknown> }) {
    super(params);
  }
}
```

### 架构约束

- **P7**: 构造函数注入 IGraphRepository
- **P11**: 输入 QueryInput（Zod 推导），输出 QueryResult
- **P12**: CLI 薄壳
- CLI 表格输出使用 chalk 着色（D4 规范，与 Logger 颜色方案一致）

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

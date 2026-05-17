# Story 5.2: MCP Tools 关系管理能力

Status: done

## Story

As a AI Agent（通过 AI IDE），
I want 通过 MCP Tools 添加、移除或标记关系为 deprecated，
So that 用户可以通过自然语言对话让我修正文档关系。

## Acceptance Criteria (AC)

1. **Given** Story 5.1 MCP Server 和 Epic 4 RelationService 就绪 **When** 扩展 Tools **Then** 注册 add_relation、remove_relation、deprecate_relation（FR20）
2. **Given** Tools **When** 操作 **Then** 暴露原子化 CRUD，并通过显式 Zod input schema 定义各 Tool 的对外契约
3. **Given** 职责边界 **When** 检查 **Then** CORD 提供操作接口，AI IDE 负责意图解析（FR20）
4. **Given** 新增 Tools **When** 检查已有 **Then** 不影响已有 4 个 Tool schema（NFR10）
5. **Given** 实现完毕 **When** 测试 **Then** MCP 添加/移除/deprecated + 结果验证
6. **Given** 3 个关系管理 Tools **When** 检查输入模型 **Then** 使用如下共享 Zod schema：`add_relation` 接收业务三元组 `{ sourcePath, targetPath, relationType }`；`remove_relation` 和 `deprecate_relation` 接收 `{ relationId }`，与 Story 4.1 RelationService 签名保持一致（NFR10）
7. **Given** 3 个关系管理 Tools **When** 检查输出模型 **Then** 每个 Tool 返回在 `src/mcp/tools/schemas.ts` 中定义的命名 DTO：`add_relation` 返回 `AddRelationResult`（含新建 relationId）；`remove_relation` 返回 `RemoveRelationResult`；`deprecate_relation` 返回 `DeprecateRelationResult`；new Tool 不影响已有 3 个 Tool 的 output schema（NFR10）

## Tasks / Subtasks

- [x] Task 1: 实现 3 个关系管理 Tools (AC: #1, #2, #3, #6)
  - [x] 1.1 `src/mcp/tools/add-relation.ts`
  - [x] 1.2 `src/mcp/tools/remove-relation.ts`
  - [x] 1.3 `src/mcp/tools/deprecate-relation.ts`
  - [x] 1.4 定义并导出 3 个 Tools 的共享 Zod input schema（AC: #6）
  - [x] 1.5 在 `src/mcp/tools/schemas.ts` 中导出 3 个 Tools 的命名 output schema（AddRelationResult、RemoveRelationResult、DeprecateRelationResult）（AC: #7）
- [x] Task 2: 注册到 MCP Server (AC: #4)
- [x] Task 3: 编写测试 (AC: #5, #6, #7)

## Dev Notes

### 新增 Tools 命名

| Tool | 描述 |
|------|------|
| add_relation | 添加文档关系 |
| remove_relation | 移除文档关系 |
| deprecate_relation | 标记关系为 deprecated |

每个 Tool 调用 RelationService 对应方法。

### MCP 层输入 Schema 契约（发现#1 裁决）

关系管理 Tool 在 MCP 入口层使用以下共享 Zod schema（**统一入参类型**，不在实现中临时裁决）：

```typescript
// src/mcp/tools/add-relation.ts
const AddRelationInput = z.object({
  sourcePath: z.string().describe('源文档路径'),
  targetPath: z.string().describe('目标文档路径'),
  relationType: RelationTypeSchema.describe('关系类型'),
});

// src/mcp/tools/remove-relation.ts
const RemoveRelationInput = z.object({
  relationId: z.string().describe('要移除关系的 ID'),
});

// src/mcp/tools/deprecate-relation.ts
const DeprecateRelationInput = z.object({
  relationId: z.string().describe('要标记为 deprecated 关系的 ID'),
});
```

**裁决依据**：
- `add_relation` 使用业务三元组（sourcePath + targetPath + relationType），因为新增关系时尚无 relationId
- `remove_relation` / `deprecate_relation` 使用 `relationId`，与 Story 4.1 RelationService 签名（`RemoveRelationInput`、`DeprecateRelationInput`）保持一致
- AI IDE 端使用业务语义调用 `add_relation`，使用 `relationId` 操作已有关系

### MCP Tool Output Schema（发现#3 裁决，延续 5.1 schemas.ts）

3 个关系管理 Tool 的命名 outputSchema 同样在 `src/mcp/tools/schemas.ts` 统一定义并导出：

```typescript
// add_relation — 输出 DTO
export const AddRelationResult = z.object({
  relationId: z.string(),
  sourcePath: z.string(),
  targetPath: z.string(),
  relationType: RelationTypeSchema,
  source: z.literal('manual'),
  status: z.literal('active'),
});

// remove_relation — 输出 DTO
export const RemoveRelationResult = z.object({
  success: z.literal(true),
  relationId: z.string().describe('已物理删除的 relationId'),
});

// deprecate_relation — 输出 DTO
export const DeprecateRelationResult = z.object({
  relationId: z.string(),
  status: z.literal('deprecated'),
  relationType: RelationTypeSchema.describe('保留原始关系类型不变'),
});
```

### Project Structure Notes

- `src/mcp/tools/add-relation.ts`
- `src/mcp/tools/remove-relation.ts`
- `src/mcp/tools/deprecate-relation.ts`

### References

- [Source: prd.md#FR20] — MCP 关系管理
- [Source: prd.md#NFR10] — schema 稳定性
- [Source: epics.md#Story 5.2] — 验收标准

## Dev Agent Record

### Agent Model Used
- GPT-5 Codex
### Debug Log References
- `npm test -- tests/unit/mcp/schemas.test.ts`
- `npm test -- tests/integration/mcp/server.test.ts`
- `npm run type-check`
- `npm test -- tests/unit/mcp/server.test.ts tests/unit/mcp/schemas.test.ts tests/integration/mcp/server.test.ts`
- `npm run lint`
- `npm run build`
- `npm test`
- `npm test -- tests/unit/services/query-service.test.ts`
### Completion Notes List
- 为 MCP runtime 注入 `RelationService`，并在 server 中注册 `add_relation`、`remove_relation`、`deprecate_relation` 三个写操作 tools，保持现有 4 个只读 tool 的注册与契约不变。
- 在 `src/mcp/tools/schemas.ts` 统一定义 3 个关系管理 tools 的共享输入 schema 与命名输出 DTO，并同步导出 JSON Schema，满足 Story 5.2 的 MCP I/O 契约要求。
- 新增 `src/mcp/tools/add-relation.ts`、`remove-relation.ts`、`deprecate-relation.ts`，均保持 MCP 薄壳模式：参数校验/路径归一化后调用 `RelationService`，再返回结构化 DTO。
- 补充 MCP schema 稳定性测试和集成测试，覆盖 7 个 tools 的注册面、`add_relation`/`remove_relation`/`deprecate_relation` 端到端调用，以及新增关系的结果校验、deprecated 状态校验、删除后的查询校验。
- Story 范围验证已通过：MCP 相关单测/集成测试、`type-check`、`lint`、`build` 全部通过；全量 `npm test` 仍仅受既有 `tests/unit/services/query-service.test.ts:677` 三跳性能基准抖动影响，单独重跑该文件通过。
### File List
- src/mcp/server.ts
- src/mcp/tools/add-relation.ts
- src/mcp/tools/remove-relation.ts
- src/mcp/tools/deprecate-relation.ts
- src/mcp/tools/index.ts
- src/mcp/tools/schemas.ts
- tests/integration/mcp/server.test.ts
- tests/unit/mcp/schemas.test.ts
- _bmad-output/implementation-artifacts/stories/5-2-mcp-tools-relation-management.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

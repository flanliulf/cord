# Story 5.2: MCP Tools 关系管理能力

Status: ready-for-dev

## Story

As a AI Agent（通过 AI IDE），
I want 通过 MCP Tools 添加、移除或标记关系为 deprecated，
So that 用户可以通过自然语言对话让我修正文档关系。

## Acceptance Criteria (AC)

1. **Given** Story 5.1 MCP Server 和 Epic 4 RelationService 就绪 **When** 扩展 Tools **Then** 注册 add_relation、remove_relation、deprecate_relation（FR20）
2. **Given** Tools **When** 操作 **Then** 暴露原子化 CRUD
3. **Given** 职责边界 **When** 检查 **Then** CORD 提供操作接口，AI IDE 负责意图解析（FR20）
4. **Given** 新增 Tools **When** 检查已有 **Then** 不影响已有 4 个 Tool schema（NFR10）
5. **Given** 实现完毕 **When** 测试 **Then** MCP 添加/移除/deprecated + 结果验证

## Tasks / Subtasks

- [ ] Task 1: 实现 3 个关系管理 Tools (AC: #1, #2, #3)
  - [ ] 1.1 `src/mcp/tools/add-relation.ts`
  - [ ] 1.2 `src/mcp/tools/remove-relation.ts`
  - [ ] 1.3 `src/mcp/tools/deprecate-relation.ts`
- [ ] Task 2: 注册到 MCP Server (AC: #4)
- [ ] Task 3: 编写测试 (AC: #5)

## Dev Notes

### 新增 Tools 命名

| Tool | 描述 |
|------|------|
| add_relation | 添加文档关系 |
| remove_relation | 移除文档关系 |
| deprecate_relation | 标记关系为 deprecated |

每个 Tool 调用 RelationService 对应方法。

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
### Debug Log References
### Completion Notes List
### File List

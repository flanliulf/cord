# Story 5.1: MCP Server 核心与 4 个 Tools

Status: ready-for-dev

## Story

As a AI Agent（通过 AI IDE），
I want 通过 MCP Server 调用 CORD 的核心能力，
So that 我可以在用户的开发流程中自动执行影响分析、关系查询等操作。

## Acceptance Criteria (AC)

1. **Given** Epic 2-4 Service 层就绪 **When** 实现 MCP Server **Then** `src/mcp/server.ts` 使用 TS SDK v1.x + Stdio Transport
2. **Given** MCP Server **When** 注册 Tools **Then** 4 个 Tools：analyze_impact、query_relations、init_graph、sync_docs
3. **Given** 每个 Tool **When** 检查 schema **Then** inputSchema 从 Zod schema 自动导出为 JSON Schema
4. **Given** MCP Server **When** 运行 **Then** 作为长驻进程运行（FR32）
5. **Given** 性能 **When** 测量 **Then** Tool 调用 p95 < 50ms（NFR4）
6. **Given** CLI vs MCP **When** 比较 **Then** 相同输入返回语义一致的输出（NFR13）
7. **Given** SIGTERM **When** 接收 **Then** ≤ 2 秒内优雅退出（NFR17）
8. **Given** 新增 Tool **When** 检查 **Then** 已有 4 个 Tool 的 schema 不变（NFR10）
9. **Given** 日志 **When** 输出 **Then** 所有输出到 stderr
10. **Given** 实现完毕 **When** 测试 **Then** 4 个 Tool 端到端 + SIGTERM 退出 + 输入验证失败

## Tasks / Subtasks

- [ ] Task 1: 实现 MCP Server 入口 (AC: #1, #4, #7, #9)
  - [ ] 1.1 `src/mcp/server.ts` — Stdio Transport + 优雅退出
- [ ] Task 2: 实现 4 个 Tools (AC: #2, #3)
  - [ ] 2.1 `src/mcp/tools/analyze-impact.ts`
  - [ ] 2.2 `src/mcp/tools/query-relations.ts`
  - [ ] 2.3 `src/mcp/tools/init-graph.ts`
  - [ ] 2.4 `src/mcp/tools/sync-docs.ts`
- [ ] Task 3: Zod → JSON Schema 自动导出 (AC: #3)
- [ ] Task 4: 更新 index.ts
- [ ] Task 5: 编写测试 (AC: #5, #6, #8, #10)

## Dev Notes

### MCP SDK 使用

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
```

- **包名**: `@modelcontextprotocol/sdk`（不是 @anthropic-ai/mcp-sdk）
- Tool 名使用 snake_case（P4）：analyze_impact、query_relations、init_graph、sync_docs
- 参数名使用 camelCase（P4）

### 优雅退出

```typescript
process.on('SIGTERM', async () => {
  // 1. 关闭 SQLite 连接
  // 2. Flush 日志
  // 3. process.exit(0)
  // 超时 2 秒后强制退出
});
```

### 架构约束

- MCP 层是**薄壳**——验证输入 → 调用 Service → 格式化输出
- 所有日志走 stderr
- Tool inputSchema 从 Zod 导出，保证与 CLI 一致

### Project Structure Notes

- `src/mcp/server.ts`
- `src/mcp/tools/analyze-impact.ts`
- `src/mcp/tools/query-relations.ts`
- `src/mcp/tools/init-graph.ts`
- `src/mcp/tools/sync-docs.ts`

### References

- [Source: prd.md#FR28, FR32] — MCP Server 需求
- [Source: prd.md#NFR4, NFR10, NFR13, NFR17] — 性能和可靠性
- [Source: architecture/implementation-patterns-consistency-rules.md#P4] — MCP 命名
- [Source: epics.md#Story 5.1] — 验收标准

## Dev Agent Record

### Agent Model Used
### Debug Log References
### Completion Notes List
### File List

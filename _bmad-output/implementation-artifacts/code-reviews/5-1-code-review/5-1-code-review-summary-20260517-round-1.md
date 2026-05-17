---
Story: 5-1
Round: 1
Date: 2026-05-17
Model Used: GPT-5 Codex (gpt-5-codex)
Type: Code Review Summary
---

## 审查结论

首轮审查。由于当前环境没有独立 Agent 调度工具，本轮按 `bmenhance-cr-01-reviewer` 降级为串行审查模式，分别覆盖 Blind Hunter、Edge Case Hunter、Acceptance Auditor 三个视角。`npm run type-check`、目标 MCP 测试、`npm run lint`、`npm run build`、全量 `npm test` 均通过；定向 CLI vs MCP 语义比较通过。未发现阻塞问题，建议通过。

## 新发现

### 1. [低] Story 内 DTO 示例与已固化的 CLI/MCP 共享 DTO 规则仍存在文档漂移

- **来源**：auditor
- **分类**：defer

- **证据**
  - `_bmad-output/implementation-artifacts/stories/5-1-mcp-server-core-and-4-tools.md:72-79` 的 `QueryRelationsInput` 示例仍未包含 `depth`。
  - `_bmad-output/implementation-artifacts/stories/5-1-mcp-server-core-and-4-tools.md:137-169` 的 output 示例仍包含 `AnalyzeImpactResult.reason`、`InitGraphResult.duration`，并缺少 `severity` / `hopDistance` / `durationMs` 等当前契约字段。
  - 当前实现已按新的共享 DTO 规则收口：`src/mcp/tools/schemas.ts:17-92` 导出 4 个 tool 的命名 input/output schema，其中 `query_relations.depth`、`query_relations.hopDistance`、`analyze_impact.severity`、`analyze_impact.hopDistance`、`init_graph.durationMs` 均已存在。
  - Rule Document Registry 镜像文档已写入新规则：`_bmad-output/project-context.md:166-170`、`_bmad-output/planning-artifacts/architecture/03-core-architectural-decisions.md:280-288`、`_bmad-output/planning-artifacts/architecture/04-implementation-patterns-consistency-rules.md:463-471`。

- **影响**
  - 不影响当前运行时代码、schema 导出或测试结果；但后续 Story 5.2 或 CR fixer 若回读 Story 5.1 的旧代码块，可能误以为 `duration` / `reason` 等旧字段仍是目标契约，从而再次引入 DTO 漂移。

- **建议**
  - 不作为本轮阻塞项处理。后续如允许修改 Story 文档，可把 Story 5.1 内旧 DTO 示例同步为 `src/mcp/tools/schemas.ts` 与 CR-MCP-01/P44 的当前字段集合。

## 验证摘要

- `npm run type-check` ✅ 通过（`tsc --noEmit`）
- `npm test -- tests/integration/mcp/server.test.ts tests/unit/mcp/server.test.ts tests/unit/mcp/schemas.test.ts` ✅ 通过（3 files / 8 tests）
- `npm run lint` ✅ 通过（`eslint .`）
- `npm run build` ✅ 通过（`tsup` 生成 `dist/cli/index.js` 与 `dist/mcp/server.js`）
- `npm test` ✅ 通过（43 files / 388 tests）
- 定向 CLI vs MCP 语义比较 ✅ 通过
  - `query_relations`：同一 fixture 上 CLI `cord query --json` 与 MCP `query_relations.structuredContent` JSON 完全相等。
  - `analyze_impact`：同一 fixture 上 CLI `cord impact --json` 与 MCP `analyze_impact.structuredContent` JSON 完全相等。
  - `init_graph`：MCP output 字段与 CLI `scan --json` 字段同构，均为 `documentsFound`、`relationsDiscovered`、`warnings`、`durationMs`。

## 通过项

- AC1 / AC4：`src/mcp/server.ts:5-6` 使用 MCP SDK v1.x 的 `McpServer` 与 `StdioServerTransport`，`src/mcp/server.ts:104-112` 提供 stdio transport 启动路径。
- AC2：`src/mcp/server.ts:78-81` 注册 `analyze_impact`、`query_relations`、`init_graph`、`sync_docs` 4 个 tool。
- AC3 / AC8：`src/mcp/tools/schemas.ts:17-119` 统一导出命名 Zod schema、JSON Schema 与 `MCP_TOOL_SCHEMAS`；`tests/unit/mcp/schemas.test.ts:55-110` 冻结 4 个 tool 的 input/output schema surface。
- AC5：`tests/integration/mcp/server.test.ts:229-253` 覆盖 fixture read path 的 p95 < 50ms。
- AC6：定向 CLI/MCP 比较确认 `query_relations` 与 `analyze_impact` 语义一致；`src/mcp/tools/query-relations.ts:28-33`、`src/mcp/tools/analyze-impact.ts:28-31` 直接调用对应 service 并返回原 DTO。
- AC7：`src/mcp/server.ts:115-177` 覆盖 SIGTERM/SIGINT 优雅退出与 2 秒超时；`tests/unit/mcp/server.test.ts:44-87` 覆盖成功退出和超时强退。
- AC9：MCP server 日志使用 `console.error`，`src/mcp/server.ts:142-160`、`src/mcp/server.ts:194-216` 未向 stdout 输出日志；`src/utils/logger.ts:67-72` 在 mcp mode 下把 info/warn/debug 路由到 stderr。
- AC10：`tests/integration/mcp/server.test.ts:61-205` 覆盖 4 个 tool 端到端与输入验证失败；SIGTERM 由 `tests/unit/mcp/server.test.ts:44-87` 覆盖。
- AC11：`tests/integration/mcp/server.test.ts:207-227` 覆盖多个并发只读 tool 调用独立返回。

## 结论

- **结论：通过**
- **阻塞项**：0
- **非阻塞项**：1
- **建议**：不需要 CR fixer 处理源码；可在后续文档整理中同步 Story 5.1 内的旧 DTO 示例，避免后续 Story 读取旧契约。

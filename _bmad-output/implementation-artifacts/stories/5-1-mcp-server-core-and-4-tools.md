# Story 5.1: MCP Server 核心与 4 个 Tools

Status: ready-for-dev

## Story

As a AI Agent（通过 AI IDE），
I want 通过 MCP Server 调用 CORD 的核心能力，
So that 我可以在用户的开发流程中自动执行影响分析、关系查询等操作。

## Acceptance Criteria (AC)

1. **Given** Epic 2-4 Service 层就绪 **When** 实现 MCP Server **Then** `src/mcp/server.ts` 使用 TS SDK v1.x + Stdio Transport
2. **Given** MCP Server **When** 注册 Tools **Then** 4 个 Tools：analyze_impact、query_relations、init_graph、sync_docs
3. **Given** 每个 Tool **When** 检查 schema **Then** inputSchema 和 outputSchema 均从命名 Zod schema 自动导出为 JSON Schema，并在 `src/mcp/tools/schemas.ts` 统一导出（NFR10 同时适用于 input 和 output）
4. **Given** MCP Server **When** 运行 **Then** 作为长驻进程运行（FR32）
5. **Given** 性能 **When** 测量 **Then** Tool 调用 p95 < 50ms（NFR4）
6. **Given** CLI vs MCP **When** 比较 **Then** 相同输入返回语义一致的输出（NFR13）
7. **Given** SIGTERM **When** 接收 **Then** ≤ 2 秒内优雅退出（NFR17）
8. **Given** 新增 Tool **When** 检查 **Then** 已有 4 个 Tool 的 input schema 和 output schema 均不变（NFR10 同时约束 input 和 output）
9. **Given** 日志 **When** 输出 **Then** 所有输出到 stderr
10. **Given** 实现完毕 **When** 测试 **Then** 4 个 Tool 端到端 + SIGTERM 退出 + 输入验证失败
11. **Given** MCP Server 长驻运行 **When** 同时收到多个并发只读 Tool 调用（如同时调用 analyze_impact 和 query_relations） **Then** 每个调用独立返回结果，无共享状态干扰（承接 FR32「并发查询请求」契约）

## Tasks / Subtasks

- [ ] Task 1: 实现 MCP Server 入口 (AC: #1, #4, #7, #9)
  - [ ] 1.1 `src/mcp/server.ts` — Stdio Transport + 优雅退出
- [ ] Task 2: 实现 4 个 Tools (AC: #2, #3)
  - [ ] 2.1 `src/mcp/tools/analyze-impact.ts`
  - [ ] 2.2 `src/mcp/tools/query-relations.ts`
  - [ ] 2.3 `src/mcp/tools/init-graph.ts`
  - [ ] 2.4 `src/mcp/tools/sync-docs.ts` — 只读建议 Tool，**单文档输入**（发现#2 裁决），直接调用 ImpactService.analyzeImpact() 现有签名，返回建议动作列表，不执行任何文档写入
- [ ] Task 3: Zod → JSON Schema 自动导出 (AC: #3)
- [ ] Task 4: 更新 index.ts
- [ ] Task 5: 编写测试 (AC: #5, #6, #8, #10, #11)

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
- Tool inputSchema 和 outputSchema 均从命名 Zod schema 导出，保证与 CLI 一致

### QueryRelationsInput 命名 Schema（发现#1 裁决）

`query_relations` Tool 的输入命名 schema，保证 CLI 和 MCP 两端语义一致（NFR13）：

```typescript
// 统一在 src/mcp/tools/schemas.ts 导出
export const QueryRelationsInput = z.object({
  docPath: z.string().describe('查询文档路径'),
  type: RelationTypeSchema.optional().describe('按关系类型过滤（FR14）'),
  includeDeprecated: z.boolean().optional().default(false).describe('是否包含 deprecated 状态的关系'),
});
```

**CLI/MCP 字段对齐约定**：
- CLI `--type` flag 对应 `QueryRelationsInput.type`
- CLI `--include-deprecated` flag 对应 `QueryRelationsInput.includeDeprecated`
- MCP 返回结果字段顺序与 CLI `--json` 输出字段顺序完全一致

### sync_docs Tool 契约（发现#3 裁决）

`sync_docs` 是**只读建议 Tool**，不执行任何文档写入或编排，与 Epic 4 Story 4.3 已裁定的 `updateStrategy` 元数据只读决策保持一致。

**发现#2 裁决：缩回单文档**，直接复用 ImpactService 现有签名，无需新增 facade。

**Service owner**: ImpactService（Story 3.3）

**输入 schema**：
```typescript
const SyncDocsInput = z.object({
  filePath: z.string().describe('已变更的文档路径（单文档）'),
});
```

**输出 schema**：
```typescript
const SyncDocsResult = z.object({
  suggestions: z.array(z.object({
    targetPath: z.string(),
    action: z.enum(['update', 'review', 'log_only']),
    updateStrategy: z.enum(['auto', 'suggest', 'log_only']),
    reason: z.string(),
  })),
  affectedCount: z.number(),
});
```

**Service 映射**：直接调用 `ImpactService.analyzeImpact({ docPath: input.filePath })` 并将结果转换为 SyncDocsResult。

**`AnalyzeImpactResult` → `SyncDocsResult` 字段映射规则**（发现#1 裁决）：

| AnalyzeImpactResult 字段 | SyncDocsResult 字段 | 推导规则 |
|---|---|---|
| `updateStrategy: 'auto'` | `action: 'update'` | 自动同步 → 建议执行更新 |
| `updateStrategy: 'suggest'` | `action: 'review'` | 建议同步 → 建议审阅 |
| `updateStrategy: 'log_only'` | `action: 'log_only'` | 仅记录 → 仅记录 |

> `SyncDocsResult` 保留 `updateStrategy` 字段（原始元数据）与 `action` 字段（推导动作）同时返回，方便调用方对照原始语义。

**边界约定**：
- 不调用任何写入操作
- Skills 场景中多文档触发时，MCP Host 按文件依次调用 `sync_docs`
- 与 Story 5.5「同步建议」 Skills 场景一一对应

### MCP Tool Output Schema（发现#3 裁决）

全部 4 个 Tool 的命名 outputSchema 统一在 `src/mcp/tools/schemas.ts` 定义并导出，NFR10 同时约束 input 和 output（含 Story 5.1 + 5.2 共 7 个 Tool）。

```typescript
// analyze_impact — 输出 DTO（字段与 Story 3.3 ImpactResult canonical 结构对齐，NFR13）
export const AnalyzeImpactResult = z.object({
  impactedDocs: z.array(z.object({
    docPath: z.string(),
    relationType: RelationTypeSchema,
    propagationType: z.enum(['sync_required','must_consistent','lifecycle_bound','contains','sync_suggested','derived_from','context_for','references','deprecated']),  // FR17
    suggestedAction: z.string(),                                          // FR17 parity 字段：人读建议（CLI/MCP 展示）
    updateStrategy: z.enum(['auto', 'suggest', 'log_only']),              // Story 4.3 元数据字段：机器决策
    confidence: z.number(),
    reason: z.string(),
  })),
  totalCount: z.number(),
});

// query_relations — 输出 DTO（含 relationId，供 remove/deprecate 操作使用）
export const QueryRelationsResult = z.object({
  relations: z.array(z.object({
    relationId: z.string(),
    targetPath: z.string(),
    relationType: RelationTypeSchema,
    confidence: z.number(),
    source: z.enum(['auto_scan', 'manual', 'framework_preset']),
    status: z.enum(['active', 'deprecated']),
  })),
  totalCount: z.number(),
});

// init_graph — 输出 DTO（字段与 Story 2.5 ScanResult canonical 结构对齐，NFR13）
export const InitGraphResult = z.object({
  documentsFound: z.number(),       // 对齐 ScanResult.documentsFound
  relationsDiscovered: z.number(),  // 对齐 ScanResult.relationsDiscovered
  warnings: z.array(z.string()),    // 对齐 ScanResult.warnings
  duration: z.number().describe('扫描耗时（ms）'),
});

// sync_docs — 输出 DTO（单文档）
export const SyncDocsResult = z.object({
  suggestions: z.array(z.object({
    targetPath: z.string(),
    action: z.enum(['update', 'review', 'log_only']),
    updateStrategy: z.enum(['auto', 'suggest', 'log_only']),
    reason: z.string(),
  })),
  affectedCount: z.number(),
});
```

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

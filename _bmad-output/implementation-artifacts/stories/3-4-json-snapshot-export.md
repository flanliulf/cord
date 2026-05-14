# Story 3.4: JSON 快照导出

Status: done

## Story

As a 用户，
I want 通过 `cord export` 将完整关系图谱导出为 JSON 快照文件，
So that 我可以将图谱快照提交到 git 供团队审阅。

## Acceptance Criteria (AC)

1. **Given** 已有图谱 **When** 导出 **Then** `src/services/export-service.ts` 实现 JSON 快照导出（FR26）
2. **Given** 导出格式 **When** 检查 **Then** 包含 `schemaVersion: "1.0"`（NFR14）
3. **Given** 导出格式 **When** 检查 **Then** 包含 exportedAt（ISO 8601）、project、documents、relations
4. **Given** JSON 格式 **When** 检查 **Then** camelCase 字段，null 值保留（P10）
5. **Given** CLI **When** 实现 **Then** `src/cli/commands/export.ts` 命令
6. **Given** 输出位置 **When** 默认 **Then** 输出到项目根目录
7. **Given** 实现完毕 **When** 测试 **Then** 格式验证 + schemaVersion + 空图谱导出

## Tasks / Subtasks

- [x] Task 0: 前置骨架 — 依赖 Story 1.4 `IGraphRepository` 接口中的 `getAllRelations(): RelationEdge[]` 方法（已在 Story 1.4 Task 1.5 中定义），确认 Story 1.4 的 `SqliteGraphRepository` 实现类已覆盖该方法（`SELECT * FROM relations` 等价逻辑）
- [x] Task 1: 实现 ExportService (AC: #1, #2, #3, #4)
- [x] Task 2: 实现 CLI 命令 (AC: #5, #6)
- [x] Task 3: 编写测试 (AC: #7)

## Dev Notes

### 导出格式

```json
{
  "schemaVersion": "1.0",
  "exportedAt": "2026-04-09T10:00:00Z",
  "project": "cord-project-name",
  "documents": [...],
  "relations": [...]
}
```

### 全量关系数据来源裁决

**裁决：正式扩展 IGraphRepository 添加 `getAllRelations()` 方法。**

- `IGraphRepository.getAllRelations(): RelationEdge[]` — 全量读取所有关系边，对称已有的 `getAllDocuments()`
- 该方法应在 Story 1.4 的 `SqliteGraphRepository` 中实现，即：`SELECT * FROM relations`
- ExportService 级联调用：`repo.getAllDocuments()` + `repo.getAllRelations()`，禁止在 Service 层自行拼接或变相全表扫描
- `project` 字段来源：优先读取配置文件中的项目名，如酵出则用项目根目录名

### Project Structure Notes

- `src/services/export-service.ts`
- `src/cli/commands/export.ts`

### References

- [Source: architecture/implementation-patterns-consistency-rules.md#P10] — JSON 格式
- [Source: prd.md#FR26, NFR14] — 导出需求
- [Source: epics.md#Story 3.4] — 验收标准

## Dev Agent Record

### Agent Model Used
- GPT-5.4

### Implementation Plan
- 先用单元测试锁定导出快照结构，包括 `schemaVersion`、`exportedAt`、`project`、`documents`、`relations` 以及 null 值保留行为。
- 服务层只消费 `IGraphRepository.getAllDocuments()` 与 `getAllRelations()`，并在序列化前做稳定排序，保证快照适合 git 审阅。
- CLI 保持薄壳，负责参数校验、默认输出路径、结果展示与错误映射，再通过聚焦测试、lint、type-check 和全量测试回归验证。

### Debug Log References
- `npx vitest run tests/unit/services/export-service.test.ts tests/unit/cli/commands/export.test.ts tests/unit/cli/index.test.ts`
- `npm run type-check`
- `npm run lint`
- `npm test`

### Completion Notes List
- 确认 Story 1.4 已提供 `IGraphRepository.getAllRelations()` 与 `SqliteGraphRepository` 中的 `SELECT * FROM relations` 实现，导出服务直接复用共享仓储接口。
- 新增 `ExportService` 与导出输入 schema，生成 `schemaVersion: "1.0"` 的 JSON 快照，包含 ISO 8601 `exportedAt`、项目名、全量文档与关系，并保留 null 值和 camelCase 字段。
- 新增 `cord export` CLI 薄壳命令，支持默认输出到项目根目录 `cord-snapshot.json`、`--output <path>` 自定义导出路径以及 `--json` 输出模式。
- 补齐导出服务与 CLI 单元测试，覆盖格式验证、schemaVersion、空图谱导出、默认输出路径、参数转发与错误路径，并通过 lint、type-check 与全量测试回归验证。

### File List
- src/schemas/export-input.ts
- src/schemas/index.ts
- src/services/export-service.ts
- src/services/index.ts
- src/cli/commands/export.ts
- src/cli/commands/index.ts
- src/cli/index.ts
- tests/unit/services/export-service.test.ts
- tests/unit/cli/commands/export.test.ts
- tests/unit/cli/index.test.ts
- _bmad-output/implementation-artifacts/stories/3-4-json-snapshot-export.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

## Change Log

- 2026-05-12: 实现 `ExportService`、`cord export` CLI、导出输入校验与对应单元测试，并完成 lint、type-check、全量测试验证。

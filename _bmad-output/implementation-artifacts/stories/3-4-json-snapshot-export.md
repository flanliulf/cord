# Story 3.4: JSON 快照导出

Status: ready-for-dev

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

- [ ] Task 0: 前置骨架 — 依赖 Story 1.4 `IGraphRepository` 接口中的 `getAllRelations(): RelationEdge[]` 方法（已在 Story 1.4 Task 1.5 中定义），确认 Story 1.4 的 `SqliteGraphRepository` 实现类已覆盖该方法（`SELECT * FROM relations` 等价逻辑）
- [ ] Task 1: 实现 ExportService (AC: #1, #2, #3, #4)
- [ ] Task 2: 实现 CLI 命令 (AC: #5, #6)
- [ ] Task 3: 编写测试 (AC: #7)

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
### Debug Log References
### Completion Notes List
### File List

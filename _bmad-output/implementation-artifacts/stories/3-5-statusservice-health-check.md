# Story 3.5: StatusService 健康检查

Status: ready-for-dev

## Story

As a 用户，
I want 通过 `cord status` 查看当前项目的 CORD 配置状态和图谱健康信息，
So that 我可以了解图谱的整体状况。

## Acceptance Criteria (AC)

1. **Given** 已有配置和图谱 **When** 健康检查 **Then** `src/services/status-service.ts` 实现（FR5）
2. **Given** 输出 **When** 检查 **Then** 包含：文档总数、关系总数、按类型分布、最后扫描时间
3. **Given** 过时关系 **When** 检测 **Then** 报告关联文档 mtime 新于关系创建时间
4. **Given** 不一致 **When** 检测 **Then** 报告孤立节点、悬空关系边
5. **Given** schema 版本 **When** 显示 **Then** 显示当前版本号
6. **Given** CLI **When** 实现 **Then** `src/cli/commands/status.ts` 仪表盘式摘要
7. **Given** --json **When** 传入 **Then** JSON 输出
8. **Given** 实现完毕 **When** 测试 **Then** 正常检查 + 有过时关系 + 空图谱

## Tasks / Subtasks

- [ ] Task 1: 实现 StatusService (AC: #1, #2, #3, #4, #5)
- [ ] Task 2: 实现 CLI 命令 (AC: #6, #7)
- [ ] Task 3: 编写测试 (AC: #8)

## Dev Notes

### StatusService 输出

```typescript
interface StatusResult {
  documentCount: number;
  relationCount: number;
  relationsByType: Record<string, number>;
  lastScanTime: string | null;
  schemaVersion: number;
  staleRelations: number;
  orphanedNodes: number;
  danglingEdges: number;
}
```

### Project Structure Notes

- `src/services/status-service.ts`
- `src/cli/commands/status.ts`

### References

- [Source: prd.md#FR5] — 健康检查需求
- [Source: epics.md#Story 3.5] — 验收标准

## Dev Agent Record

### Agent Model Used
### Debug Log References
### Completion Notes List
### File List

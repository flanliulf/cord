# Story 2.6: 增量扫描与文档生命周期检测

Status: ready-for-dev

## Story

As a 用户，
I want 增量扫描只处理变更的文档，并自动检测重命名/移动/删除的文档，
So that 日常使用中扫描速度极快，且图谱自动保持与文件系统同步。

## Acceptance Criteria (AC)

1. **Given** Story 2.5 冷启动扫描就绪 **When** 增量扫描 **Then** 仅处理 mtime 变更的文档（FR7）
2. **Given** 生命周期检测 **When** 实现 **Then** `src/scanner/lifecycle-detector.ts` 对比文件系统快照与图谱记录
3. **Given** 文档重命名 **When** 检测到 **Then** 更新图谱中的文档路径和相关关系边
4. **Given** 文档移动 **When** 检测到 **Then** 更新文档路径
5. **Given** 文档删除 **When** 检测到 **Then** 清理孤立节点和失效关系边（FR8）
6. **Given** cord scan **When** 执行 **Then** 自动判断冷启动 vs 增量扫描
7. **Given** 无变更 **When** 增量扫描 **Then** p95 < 100ms（NFR6）
8. **Given** 实现完毕 **When** 运行测试 **Then** 覆盖增量扫描 + 生命周期检测 + 无变更快速返回

## Tasks / Subtasks

- [ ] Task 1: 实现 lifecycle-detector.ts (AC: #2, #3, #4, #5)
  - [ ] 1.1 对比文件系统与图谱记录
  - [ ] 1.2 重命名检测（相同 content_hash，不同路径）
  - [ ] 1.3 移动检测
  - [ ] 1.4 删除检测和清理
- [ ] Task 2: 扩展 ScanService 增量模式 (AC: #1, #6)
  - [ ] 2.1 检测图谱是否已有数据 → 自动选择模式
  - [ ] 2.2 对比 mtime 确定变更文档
  - [ ] 2.3 仅处理变更文档
- [ ] Task 3: 无变更优化 (AC: #7)
  - [ ] 3.1 早期返回：无 mtime 变化时直接返回
- [ ] Task 4: 编写测试 (AC: #8)

## Dev Notes

### 生命周期检测逻辑

```typescript
interface LifecycleResult {
  renamed: { oldPath: string; newPath: string }[];
  moved: { oldPath: string; newPath: string }[];
  deleted: string[];
  modified: string[];
  unchanged: string[];
  added: string[];
}
```

- **重命名检测**：content_hash 相同但路径不同的文档对
- **mtime 比较**：`fs.statSync(path).mtimeMs` vs `sync_states.last_scanned_at`
- **content hash**：`crypto.createHash('sha256').update(content).digest('hex')`

### 增量扫描流程

```
1. 获取当前文件系统中的所有文档路径
2. 获取图谱中的所有文档记录
3. lifecycle-detector 对比 → LifecycleResult
4. 处理删除：repo.deleteDocument + cascade
5. 处理重命名/移动：repo.updateDocument(path)
6. 处理变更/新增：pipeline.process → repo 写入
7. 无变更：早期返回
```

### 架构约束

- 增量扫描也在事务中执行（NFR15）
- lifecycle-detector 是纯函数模块，不直接操作 Repository

### Project Structure Notes

- `src/scanner/lifecycle-detector.ts`
- `src/services/scan-service.ts` — 扩展增量模式

### References

- [Source: prd.md#FR7, FR8] — 增量扫描需求
- [Source: prd.md#NFR6] — 无变更性能要求
- [Source: epics.md#Story 2.6] — 验收标准来源

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

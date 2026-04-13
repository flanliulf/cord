# Story 4.2: 收敛保护机制与来源优先级

Status: ready-for-dev

## Story

As a 用户，
I want 增量扫描时系统保护我手动修正过的关系，
So that 自动扫描不会覆盖我的手动修正，图谱准确度随使用自然收敛。

## Acceptance Criteria (AC)

1. **Given** Story 4.1 关系管理和 Story 2.6 增量扫描就绪 **When** 增量扫描 **Then** 手动添加的关系不被自动删除（FR22）
2. **Given** 增量扫描 **When** 检查 deprecated **Then** 手动标记为 deprecated 的关系不被自动恢复（FR22）
3. **Given** 优先级规则 **When** 冲突 **Then** 手动修正 > 框架预设 > 自动扫描发现（FR22）
4. **Given** 关系来源 **When** 区分 **Then** 三种类型：auto_scan / manual / framework_preset
5. **Given** 扩展性 **When** 新增传播类型 **Then** 已有数据无需迁移（NFR9）
6. **Given** 实现完毕 **When** 测试 **Then** 手动关系增量扫描保持 + deprecated 不恢复 + 优先级冲突

## Tasks / Subtasks

- [ ] Task 1: 扩展 ScanService 收敛保护逻辑 (AC: #1, #2, #3)
  - [ ] 1.1 增量扫描前获取所有 manual 来源关系
  - [ ] 1.2 扫描写入时跳过已有 manual 或 deprecated 关系
  - [ ] 1.3 优先级冲突解决
- [ ] Task 2: 来源类型标记 (AC: #4)
- [ ] Task 3: 编写测试 (AC: #5, #6)

## Dev Notes

### 收敛保护逻辑

```
增量扫描写入关系时：
1. 检查是否已存在相同 source+target+type 的关系
2. 如果存在且来源为 manual → 跳过（不覆盖）
3. 如果存在且来源为 framework_preset → 仅当新发现来源也是 framework_preset 或 manual 时更新
4. 如果存在且来源为 auto_scan → 可覆盖
5. 如果关系被标记为 deprecated 且来源为 manual → 不恢复
```

### Project Structure Notes

- `src/services/scan-service.ts` — 扩展收敛保护

### References

- [Source: prd.md#FR22] — 收敛保护
- [Source: prd.md#NFR9] — 传播类型扩展性
- [Source: epics.md#Story 4.2] — 验收标准

## Dev Agent Record

### Agent Model Used
### Debug Log References
### Completion Notes List
### File List

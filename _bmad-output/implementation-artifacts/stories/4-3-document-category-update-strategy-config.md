# Story 4.3: 文档类别更新策略配置

Status: ready-for-dev

## Story

As a 用户，
I want 按文档类别配置不同的更新策略，
So that 关键文档变更时自动触发同步，而参考文档只记录不触发。

## Acceptance Criteria (AC)

1. **Given** Story 4.1 关系管理就绪 **When** 配置策略 **Then** 支持三种策略：自动更新 / 生成建议后人工确认 / 仅记录不触发（FR23）
2. **Given** 策略配置 **When** cord.config **Then** 可按文档类别配置
3. **Given** 未配置 **When** 默认 **Then** 默认策略：生成建议后人工确认
4. **Given** 影响分析 **When** 结果 **Then** 体现对应文档的更新策略
5. **Given** 实现完毕 **When** 测试 **Then** 三种策略生效 + 默认回退 + 配置覆盖

## Tasks / Subtasks

- [ ] Task 1: 扩展 configSchema 添加 updateStrategies 配置 (AC: #1, #2, #3)
- [ ] Task 2: 扩展 ImpactService 输出策略信息 (AC: #4)
- [ ] Task 3: 编写测试 (AC: #5)

## Dev Notes

### 更新策略类型

```typescript
type UpdateStrategy = 'auto' | 'suggest' | 'log_only';

// cord.config.yaml 示例
// updateStrategies:
//   prd: auto
//   architecture: auto
//   story: suggest
//   technical-research: log_only
```

默认策略：`suggest`（生成建议后人工确认）

### Project Structure Notes

- `src/schemas/config.ts` — 扩展 updateStrategies
- `src/services/impact-service.ts` — 输出策略

### References

- [Source: prd.md#FR23] — 更新策略
- [Source: epics.md#Story 4.3] — 验收标准

## Dev Agent Record

### Agent Model Used
### Debug Log References
### Completion Notes List
### File List

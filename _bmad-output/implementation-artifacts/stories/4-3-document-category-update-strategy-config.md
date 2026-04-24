# Story 4.3: 文档类别更新策略配置

Status: ready-for-dev

## Story

As a 用户，
I want 按文档类别配置不同的更新策略，
So that 影响分析结果能体现对应文档的更新策略元数据，支持后续编排决策（v0.1 仅返回策略，不自动触发同步执行）。

## Acceptance Criteria (AC)

1. **Given** Story 4.1 关系管理就绪 **When** 配置策略 **Then** 支持三种策略：自动更新 / 生成建议后人工确认 / 仅记录不触发（FR23）
2. **Given** 策略配置 **When** cord.config **Then** 可按文档类别配置
3. **Given** 未配置 **When** 默认 **Then** 默认策略：生成建议后人工确认
4. **Given** 影响分析 **When** 结果 **Then** 体现对应文档的更新策略
5. **Given** 实现完毕 **When** 测试 **Then** 三种策略生效 + 默认回退 + 配置覆盖

## Tasks / Subtasks

- [ ] Task 1: 扩展 configSchema 添加 updateStrategies 配置 (AC: #1, #2, #3)
  - [ ] 1.1 在 `src/schemas/config.ts` 中新增 `updateStrategies` 字段（键域、默认值、未知 key 处理）
  - [ ] 1.2 同步更新 `CordConfig` TypeScript 类型定义（若使用 Zod z.infer 则自动推导，否则手动同步）
  - [ ] 1.3 更新 `cord init` 模板，加入 `updateStrategies` 示例配置块
  - [ ] 1.4 同步更新规则文档（Rule Document Registry 强制同步三份：`project-context.md`、`04-implementation-patterns-consistency-rules.md` **及** `03-core-architectural-decisions.md` 中的配置字段清单）
- [ ] Task 2: 扩展 ImpactService 输出策略信息 (AC: #4)
- [ ] Task 3: 编写测试 (AC: #5)

## Dev Notes

### v0.1 交付边界裁决（发现#5 裁决）

本 Story 的交付范围是**策略元数据**，不是自动编排执行：
- `ImpactService` 在影响分析结果中附带每个文档的 `updateStrategy` 字段（只读输出）
- `updateStrategy` 是**机器决策元数据**，与 `ImpactedDoc.suggestedAction`（人读建parity 字段）并存；两者语义不重叠，分别服务不同消费方（跡踪#1 裁决）
- v0.1 不实现自动触发同步、不实现 orchestration 逻辑；自动执行编排属于后续版本范畴

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

`updateStrategies` 字段规范：
- **键域**：任意 `docType` 字符串（与 Story 1.3 中的 docType 枚举对应，允许自定义扩展）
- **未知 key**：宽容处理，回退到默认策略 `suggest`，记录 debug 日志但不报错
- **缺省值**：整个 `updateStrategies` 字段可缺失，效果等同于所有类别使用 `suggest`

### v0.1 已知限制：跨类别 rename/move 后策略可能使用旧类别（发现#9 说明）

Story 2.6 v0.1 约束：rename/move 仅更新 `documents.path`，不重算 `docType`。当文档跨类别移动时（例如从 `story/` 移至 `prd/`），`docType` 不会立即更新，影响分析结果中的策略解析可能仍使用旧 docType 对应的策略。

**缓解方案**：执行 `--rebuild` 后 docType 重新计算，策略与类别恢复一致。

建议补充测试用例：验证 rename/move 场景下策略解析行为符合上述已知限制说明。

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

# Story 3.3: ImpactService 变更影响分析

Status: ready-for-dev

## Story

As a 用户，
I want 通过 `cord impact <doc>` 获取文档变更的完整影响分析，
So that 我可以在修改文档前了解哪些关联文档会受到影响，以及应该采取什么动作。

## Acceptance Criteria (AC)

1. **Given** Story 3.2 多跳遍历就绪 **When** 实现影响分析 **Then** `src/services/impact-service.ts` 实现变更影响分析（FR15）
2. **Given** 结果 **When** 检查内容 **Then** 包含：受影响文档路径、关系类型、传播行为类型、建议动作（FR17）
3. **Given** 建议动作 **When** 生成 **Then** 根据传播行为类型自动推导（sync_required → "需要同步更新"、context_for → "仅供参考"）
4. **Given** 过滤 **When** 默认 **Then** 过滤置信度 ≥ 0.50 的关系（FR11），可通过配置调整，优先级：显式输入 > 配置文件 > 默认 0.50
5. **Given** CLI **When** 实现 **Then** `src/cli/commands/impact.ts` 薄壳命令
6. **Given** 输出 **When** 默认 **Then** 人类可读表格（按影响严重程度排序）
7. **Given** --json **When** 传入 **Then** JSON 输出
8. **Given** 实现完毕 **When** 测试 **Then** 覆盖正常分析 + 置信度过滤 + 空影响 + 各传播行为建议
9. **Given** 内部遍历 **When** 执行影响分析 **Then** 固定三跳深度，v0.1 不对外暴露 `depth` 参数；测试必须验证三跳边界（即居瓴超过三跳的间接节点不应出现在结果中）

## Tasks / Subtasks

- [ ] Task 1: 实现 ImpactService (AC: #1, #2, #3, #4)
- [ ] Task 2: 建议动作映射表
- [ ] Task 3: 实现 CLI 命令 (AC: #5, #6, #7)
- [ ] Task 4: 编写测试 (AC: #8, #9)，必须包含三跳边界验证：1-3 跳结果应保留（正例），4 跳及以上应排除（负例）；测试夹具须区分"恰好 3 跳"与"恰好 4 跳"两类样例，不得把合法的 3 跳结果计为负例

## Dev Notes

### 传播行为 → 建议动作映射

| 传播行为类型 | 建议动作 | 严重程度 |
|-------------|---------|---------|
| sync_required | 需要同步更新 | critical |
| must_consistent | 必须保持一致 | critical |
| lifecycle_bound | 检查生命周期影响 | high |
| contains | 检查包含内容 | medium |
| sync_suggested | 建议同步更新 | medium |
| derived_from | 检查源文档变更 | low |
| context_for | 仅供参考 | info |
| references | 仅供参考 | info |
| deprecated | 已废弃，忽略 | none |

### ImpactService 设计

```typescript
export class ImpactService {
  constructor(
    private readonly repo: IGraphRepository,
    private readonly queryService: QueryService,
  ) {}
  analyzeImpact(input: ImpactInput): ImpactResult { ... }
}

// 输入类型
export interface ImpactInput {
  docPath: string;
  /**
   * 置信度阈值过滤。优先级：显式输入 > 配置文件（D6 confidenceThreshold） > 默认 0.50（FR11）
   */
  confidenceThreshold?: number;  // v0.1 可选，不传则读配置文件字段
}
```

### 遍历深度裁决（v0.1）

**v0.1 固定三跳，暗定不对外暴露 `depth` 参数。**

- ImpactService 复用 Story 3.2 的 `queryService.queryMultiHop(input: QueryInput & { depth: number })` 入口
- 调用时内部传入 `depth: 3`：`queryService.queryMultiHop({ docPath, depth: 3 })`
- v0.1 不对外暴露 `depth` 参数，`ImpactInput` 中不包含 `depth` 字段
- 与 Story 3.2 `--depth` 的关系：多跳入口均使用 `queryMultiHop`，不混用 `query()`
- 后续版本如需对外开放深度控制，扩展 ImpactInput 添加可选 `depth` 字段即可

### Project Structure Notes

- `src/services/impact-service.ts`
- `src/cli/commands/impact.ts`

### References

- [Source: prd.md#FR15-FR17] — 影响分析需求
- [Source: prd.md#FR10] — 传播行为类型
- [Source: epics.md#Story 3.3] — 验收标准

## Dev Agent Record

### Agent Model Used
### Debug Log References
### Completion Notes List
### File List

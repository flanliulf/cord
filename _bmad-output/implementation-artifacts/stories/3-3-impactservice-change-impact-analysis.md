# Story 3.3: ImpactService 变更影响分析

Status: done

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
8. **Given** 遍历 **When** 执行影响分析 **Then** 默认过滤 `status='deprecated'` 的关系，deprecated 关系不计入影响路径、不产生建议动作
9. **Given** 实现完毕 **When** 测试 **Then** 覆盖正常分析 + 置信度过滤 + 空影响 + 各传播行为建议 + deprecated 关系不出现在影响结果中
10. **Given** 内部遍历 **When** 执行影响分析 **Then** 固定三跳深度，v0.1 不对外暴露 `depth` 参数；测试必须验证三跳边界（即居瓴超过三跳的间接节点不应出现在结果中）

## Tasks / Subtasks

- [x] Task 1: 实现 ImpactService (AC: #1, #2, #3, #4, #8)
  - [x] 1.1 遍历时过滤 `status='deprecated'` 的关系（不计入影响路径）
- [x] Task 2: 建议动作映射表
- [x] Task 3: 实现 CLI 命令 (AC: #5, #6, #7)
- [x] Task 4: 编写测试 (AC: #9, #10)，必须包含三跳边界验证：1-3 跳结果应保留（正例），4 跳及以上应排除（负例）；测试夹具须区分"恰好 3 跳"与"恰好 4 跳"两类样例，不得把合法的 3 跳结果计为负例

## Dev Notes

### deprecated 读侧语义裁决（发现#2 裁决）

**ImpactService 默认过滤 `status='deprecated'` 的关系，不将其计入影响范围。**

理由：用户手动将某条关系标记为 deprecated，明确表达"此关系不再有传播意义"。影响分析若继续把 deprecated 关系当活跃边处理（如 `sync_required + status=deprecated` → 输出"需要同步更新"），会直接违背用户意图。

传播行为映射表的 `deprecated relationType` 行（"已废弃，忽略"）描述的是**枚举值含义**，不影响此决策——`status='deprecated'` 的 `sync_required` 关系仍然在表中被映射为 critical，但在遍历起点就应被过滤掉，不进入映射逻辑。

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
// ImpactedDoc — 单条影响分析结果（FR17：传播行为类型 + 建议动作）
// 此结构为 canonical source；Story 5.1 AnalyzeImpactResult 与本结构对齐（NFR13）
// 共 5 个字段，其中 suggestedAction 为人读建parity 字段，updateStrategy 为机器决策元数据
// （跡踪#1 裁决：两字段并存，语义不重叠，分别服务不同消费方）
export interface ImpactedDoc {
  docPath: string;
  relationType: RelationType;
  propagationType: PropagationType;  // FR17 要求：sync_required / context_for 等
  suggestedAction: string;           // FR17 parity 字段：由传播行为映射表推导（人读建CLI/MCP 展示用）
  updateStrategy: UpdateStrategy;    // Story 4.3 元数据字段：'auto' | 'suggest' | 'log_only'（机器决策用）
  confidence: number;
  reason: string;
}

export interface ImpactResult {
  impactedDocs: ImpactedDoc[];
  totalCount: number;
}

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
- GPT-5.4

### Implementation Plan
- 先将 impact 输入契约收敛为 `docPath + confidenceThreshold`，并固定服务内部三跳遍历，不对外暴露 `depth`。
- 复用现有 `QueryService.query()` 的 BFS 遍历结果，叠加置信度过滤、deprecated 关系过滤、建议动作映射与严重程度排序，生成影响分析输出。
- 以单元测试锁定服务语义，再补 CLI 薄壳与输出测试，最后运行 story 所需的窄测试与回归验证。

### Debug Log References
- `npx vitest run tests/unit/schemas/impact-input.test.ts tests/unit/schemas/json-schema.test.ts tests/unit/services/impact-service.test.ts tests/unit/cli/commands/impact.test.ts tests/unit/cli/index.test.ts tests/integration/cli/impact.test.ts`
- `npx vitest run tests/unit/cli/commands/query.test.ts tests/unit/cli/commands/impact.test.ts && npm run lint && npm run type-check`
- `npm test`
- `npm run lint`
- `npm run type-check`

### Completion Notes List
- 新增 `ImpactService`，复用现有三跳 BFS 查询结果，叠加置信度阈值、deprecated 状态过滤、建议动作映射与严重程度排序，输出结构化影响分析结果。
- 新增 `cord impact <doc>` CLI 薄壳命令，支持 `--confidence-threshold`、默认表格输出与 `--json` 序列化，并在 service 初始化前完成路径归一化与输入校验。
- 将 impact 输入 schema 收敛到 `docPath + confidenceThreshold` 契约，保持 v0.1 固定三跳且不对外暴露 `depth` 参数。
- 补齐 impact 相关单元测试与真实 SQLite CLI 集成测试，覆盖正常分析、阈值优先级、空影响、传播行为建议映射、deprecated 状态过滤和三跳边界。
- 后续基于 rules-extractor 的跨命令复查，补修 `query` CLI 在 project-root 边界检查前缺少 `trim()` 的残留问题，并新增 whitespace-padded 项目外相对/绝对路径回归测试，确保 `query` 与 `impact` 的入口契约保持一致。

### File List
- src/schemas/impact-input.ts
- src/services/impact-service.ts
- src/services/index.ts
- src/cli/commands/query.ts
- src/cli/commands/impact.ts
- src/cli/commands/index.ts
- src/cli/index.ts
- tests/unit/cli/commands/query.test.ts
- tests/unit/schemas/impact-input.test.ts
- tests/unit/schemas/json-schema.test.ts
- tests/unit/services/impact-service.test.ts
- tests/unit/cli/commands/impact.test.ts
- tests/unit/cli/index.test.ts
- tests/integration/cli/impact.test.ts
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/stories/3-3-impactservice-change-impact-analysis.md

## Change Log

- 2026-05-11: 实现 ImpactService、`cord impact` CLI、impact 输入契约收敛，以及对应单元/集成测试。
- 2026-05-12: 追加修复 `query` CLI 的路径归一化顺序，确保带前后空白的项目外路径在 `serviceFactory()` 前稳定返回 `ConfigError`，并补齐对应回归测试。

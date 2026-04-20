---
Epic: 3
Scope: epic
Round: 3
Date: 2026-04-20
Model Used: GPT-5.4 (gpt-5.4)
Type: Story Review Summary
Stories Reviewed: 5
---

## 审查结论

第 3 轮复审。共审查 Epic 3 下 5 个 Story。审查层状态：3/3 层完成。

- 通过：0 个
- 有条件通过：3 个
- 硬阻塞：2 个

总体判断：round-2 的 4 个 P1 修订中，3.1 和 1.4/3.4 的共享契约已基本闭合；当前仅剩 2 个阻塞点，分别集中在 3.3 的边界测试口径冲突，以及 3.5 的 UTC 时间语义仍未上提为稳定存储契约。Epic 3 已明显收敛，但在这两项修复前仍不建议进入开发。

## 审查范围

- Story 文件：
  - `3-1-queryservice-relation-query-one-hop-and-type-filter.md`
  - `3-2-multi-hop-relation-traversal.md`
  - `3-3-impactservice-change-impact-analysis.md`
  - `3-4-json-snapshot-export.md`
  - `3-5-statusservice-health-check.md`
  - `1-2-corderror-error-handling-and-logger-system.md`
  - `1-4-sqlite-storage-layer-and-data-migration.md`
- 对照基准：
  - `_bmad-output/project-context.md`
  - `_bmad-output/planning-artifacts/prd.md`
  - `_bmad-output/planning-artifacts/epics/epic-3关系查询影响分析与数据导出.md`
  - `_bmad-output/planning-artifacts/architecture/03-core-architectural-decisions.md`
  - `_bmad-output/planning-artifacts/architecture/04-implementation-patterns-consistency-rules.md`
- 审查维度：
  - 结构完整性
  - AC 可测性
  - 与 Epic 一致性
  - 与架构文档一致性
  - Story 间冲突与依赖
  - 任务拆分合理性
  - 交互/认证/安全/性能口径
  - 跨 Epic 共享契约

## 上轮问题回顾

### 已修复
1. Round 2 / Finding #5 — 3.1 错误处理四处漂移到旧基线
   - `src/errors/cord-error.ts` 已回收到 `src/utils/errors.ts`；QueryError 示例已改为对象参数构造；错误码示例回到 `CORD_QUERY_001`；CLI 着色说明统一改为 `chalk`。
   - 验证结果：3.1 已重新与 Story 1.2、D3/D4 和 project-context 保持一致。

2. Round 2 / Finding #2 — 3.4 的 `getAllRelations()` 未同步到 1.4 源仓储契约
   - Story 1.4 的 Task 1.5 和 IGraphRepository 接口代码块已补入 `getAllRelations(): RelationEdge[]`；Story 3.4 的 Task 0 也已改为依赖 Story 1.4 已定义接口。
   - 验证结果：共享仓储接口的主干契约已回写到上游来源 Story，原先“仅下游单方声明”的缺口已关闭。

### 仍为非阻塞待办
1. Round 1 / Finding #8 — 3.1 “目标文档路径”字段在双向查询下语义仍偏窄
   - 维持既有评估结论。

2. Round 1 / Finding #9 — 3.2 多跳结果去重与最短跳数规则仍未闭合
   - 维持既有评估结论。

3. Round 1 / Finding #11 — 3.4 默认文件名、覆盖策略和 CLI 输出行为仍未细化
   - 维持既有评估结论。

4. Round 2 / Finding #3 — 3.5 `migrationVersion` 单字段与 D2 的双维度迁移状态仍属后续改善项
   - 维持既有评估结论。

5. Round 2 / Finding #6 — 3.4 `project` 字段来源仍引用不存在的配置项
   - 维持既有评估结论。

## 新发现

### 1. [高][新] 3.3 的三跳边界测试口径被 Task 4 写反，导致 round-2 修订未真正闭合
- **来源**：structure+consistency+contract
- **分类**：patch
- **涉及 Story**：3-3
- **证据** - Story 3.3 的 AC 9 和 Dev Notes 已明确“固定三跳，超过三跳的节点不返回”，也统一为复用 `queryMultiHop({ docPath, depth: 3 })`；但 Task 4 仍写成“接近和超过边界的节点均不应得到结果”，这会把合法的三跳内结果也当成负例。
- **影响** - round-2 想关闭的三跳边界问题被测试任务文本重新打开：实现者可能为了过测而错误排除 3 跳结果，导致影响分析范围再次收缩。
- **建议** - 在 [3-3-impactservice-change-impact-analysis.md] 中将 Task 4 改为同时验证“1-3 跳结果保留、4 跳及以上排除”，并用明确夹具区分恰好 3 跳与超过 3 跳两类样例。

### 2. [高] 3.5 的过时关系时间归一仍缺稳定的 UTC 上游契约
- **来源**：consistency+contract
- **分类**：patch
- **涉及 Story**：3-5
- **证据** - Story 3.5 现在要求通过 `Date.parse(relation.createdAt)` 将 `createdAt` 归一到 UTC 毫秒后与 `lastObservedMtimeMs` 比较；但 Story 1.4 上游仍将 `relations.created_at` 定义为 SQLite `datetime('now')` 生成的无时区 TEXT，尚未保证 Repository 输出的是带稳定 UTC 语义的时间格式。
- **影响** - 即使 camelCase 与算法描述已修正，stale relation 判定结果仍会受运行环境时区影响，导致健康检查不可复现，也说明 round-2 的时间归一修订只完成了表层闭合。
- **建议** - 将时间格式契约上提到 [1-4-sqlite-storage-layer-and-data-migration.md]：明确 Repository 输出带 `Z` 的 ISO 8601 或 epoch ms；[3-5-statusservice-health-check.md] 只消费该稳定格式，不直接对原始 SQLite datetime TEXT 做 UTC 假设。

## 逐篇审查结论

### Story 3.1: QueryService 关系查询（一跳 + 类型过滤）

**结论：有条件通过**

**优点**
- 错误处理与 CLI 着色说明已重新对齐共享基线。
- 一跳查询、类型过滤和 JSON 输出主能力未出现新回退。

**关注点**
- “目标文档路径”在双向查询下的语义仍偏窄，但当前维持为非阻塞待办。

### Story 3.2: 多跳关系遍历

**结论：有条件通过**

**优点**
- 多跳入口 `queryMultiHop` 继续作为 Epic 3 的统一多跳能力基线。
- BFS 与深度控制方向稳定，没有新的契约回退。

**关注点**
- 结果去重与最短跳数规则仍未闭合，继续维持为非阻塞待办。

### Story 3.3: ImpactService 变更影响分析

**结论：硬阻塞**

**优点**
- 固定三跳边界已经进入 AC。
- 多跳入口已和 3.2 对齐为 `queryMultiHop`，没有继续混用 `query()`。

**关键问题**
1. **Task 4 把边界测试口径写反** — AC/Dev Notes 与测试任务相互矛盾，导致三跳边界修订未真正闭合。

**建议动作**
- 先修正 [3-3-impactservice-change-impact-analysis.md] 中 Task 4 的测试口径，再进入下一轮复审。

### Story 3.4: JSON 快照导出

**结论：有条件通过**

**优点**
- `getAllRelations()` 已回写到 Story 1.4，上下游共享接口已基本收敛。
- ExportService 继续通过 `getAllDocuments()` + `getAllRelations()` 取数的方向明确。

**关注点**
- `project` 字段来源、默认文件名和覆盖策略仍属非阻塞待办。

### Story 3.5: StatusService 健康检查

**结论：硬阻塞**

**优点**
- `createdAt` camelCase 边界与比较算法方向已补入 Story。
- 配置状态输出与防御性 `danglingEdges` 说明保持稳定。

**关键问题**
1. **UTC 语义缺少上游存储契约支撑** — 当前 `Date.parse(relation.createdAt)` 的做法仍依赖上游未承诺的时间格式。

**建议动作**
- 在 [1-4-sqlite-storage-layer-and-data-migration.md] 中先明确 Repository 输出的稳定时间格式，再回到 [3-5-statusservice-health-check.md] 收口 stale relation 判定。

## 通过项
- round-2 的共享错误处理修订已完全闭合，3.1 不再残留旧路径、旧构造签名或旧颜色库基线。
- `getAllRelations()` 已进入 Story 1.4 的任务和接口设计，3.4 不再是唯一的接口扩展声明来源。
- Epic 3 的主要收敛工作现在只剩 2 个阻塞点，说明文档体系已接近可开发状态。

## 结论
- **结论**：不通过
- **阻塞项**：3.3 的 Task 4 三跳边界测试口径与 AC/Dev Notes 冲突；3.5 的 stale relation UTC 时间语义仍缺少 Story 1.4 上游存储契约支撑。
- **建议**：优先顺序建议为 1. 修正 3.3 的 Task 4；2. 在 1.4 上提稳定时间格式契约并同步 3.5；完成后进入第 4 轮复审。
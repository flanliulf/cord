---
Epic: 4
Scope: epic
Round: 3
Date: 2026-04-23
Model Used: GPT-5.4 (gpt-5.4)
Type: Story Review Summary
Stories Reviewed: 3
---

# Epic 4 Story 设计审查总结

## 审查结论

第 3 轮复审。共审查 Epic 4 下 3 个 Story。审查层状态：3/3 层完成。

- 通过：0 个
- 有条件通过：1 个
- 硬阻塞：2 个

总体判断：round-2 之后，Epic 4 的本地 Story 修订已经明显收敛，写侧语义、读侧语义、父 Epic 口径和 rebuild/manual warning 的 owner 都已补齐。但阻塞项并未真正消失，而是收缩到了更具体的“共享源契约仍在教授旧做法”这一层：`status` 模型仍未同步回 1.3/1.4 的源类型与持久化契约；`excludeSources` 删边升级仍未同步回 1.4/2.6 的源接口与流程文档；rebuild/manual warning 虽在 4.2 中正式化，但 2.5 的 scan CLI 源 Story 仍保留旧签名与旧流程。Epic 4 仍不建议进入开发。

## 审查范围

- Story 文件：
  - `4-1-relationservice-manual-add-and-remove-relations.md`
  - `4-2-convergence-protection-and-source-priority.md`
  - `4-3-document-category-update-strategy-config.md`
- 对照基准：
  - `_bmad-output/project-context.md`
  - `_bmad-output/planning-artifacts/prd.md`
  - `_bmad-output/planning-artifacts/epics/epic-4关系管理与图谱修正.md`
  - `_bmad-output/planning-artifacts/architecture/03-core-architectural-decisions.md`
  - `_bmad-output/planning-artifacts/architecture/04-implementation-patterns-consistency-rules.md`
  - `_bmad-output/implementation-artifacts/stories/1-3-zod-validation-layer-and-core-type-definitions.md`
  - `_bmad-output/implementation-artifacts/stories/1-4-sqlite-storage-layer-and-data-migration.md`
  - `_bmad-output/implementation-artifacts/stories/2-5-scanservice-cold-start-scan-and-graph-write.md`
  - `_bmad-output/implementation-artifacts/stories/2-6-incremental-scan-and-document-lifecycle-detection.md`
  - `_bmad-output/implementation-artifacts/stories/3-1-queryservice-relation-query-one-hop-and-type-filter.md`
  - `_bmad-output/implementation-artifacts/stories/3-3-impactservice-change-impact-analysis.md`
  - `_bmad-output/implementation-artifacts/stories/5-2-mcp-tools-relation-management.md`
  - `_bmad-output/implementation-artifacts/story-reviews/epic-4-story-review/epic-4-story-review-summary-20260420-round-2.md`
  - `_bmad-output/implementation-artifacts/story-reviews/epic-4-story-review/epic-4-story-review-evaluation-20260421-round-2.md`
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

1. Round 2 / Finding #2 — QueryService 与 ImpactService 缺少 `status='deprecated'` 读侧语义
   - Story 3.1 已新增 `status` 输出字段、默认过滤规则和 `--include-deprecated` 开关；Story 3.3 已新增默认过滤 deprecated 关系的影响分析规则。
   - 验证结果：写侧 `status` 模型与 Query/Impact 读侧规则已经在消费端闭合，这条问题已关闭。

2. Round 2 / Finding #5 — 父 Epic 保留修订前的旧验收口径
   - Epic 4 父文档已同步 4.1 的硬删除/状态位语义、4.2 的 manual outgoing 边保护与 rebuild warning、4.3 的 metadata-only 边界。
   - 验证结果：父 Epic 与子 Story 的主口径已对齐，这条问题已关闭。

3. Round 2 / Finding #6 — 4.3 的 Task 1.4 缺少 `03-core-architectural-decisions.md`
   - Story 4.3 的 Task 1.4 已显式改为 Rule Document Registry 三文档同步，包含 `project-context.md`、`04-implementation-patterns-consistency-rules.md` 和 `03-core-architectural-decisions.md`。
   - 验证结果：Story 4.3 本地任务范围已补全，这条 Story 级问题已关闭。

### 部分修复但仍未闭合

1. Round 2 / Finding #1 — `status` 模型未同步到 1.3/1.4 共享契约
   - Story 4.1 已补入 migration、mapper 和接口升级任务。
   - 验证结果：4.1 本地修订已到位，但 1.3 的 `RelationEdge` / relation schema 与 1.4 的 `relations` 表 / `IGraphRepository` 源契约文档仍保持旧模型，因此根契约仍未真正闭合。

2. Round 2 / Finding #3 — `excludeSources` 删边修复未回写到 1.4 / 2.6 源契约
   - Story 4.2 已把 `excludeSources` 升级为正式 Task，并明确覆盖 Story 2.6 的删边契约。
   - 验证结果：4.2 本地说明已经充足，但 1.4 的接口定义和 2.6 的流程伪代码仍然教授旧签名 / 旧调用，因此共享源契约仍未真正闭合。

3. Round 2 / Finding #4 — rebuild/manual warning 没有 AC/Task/CLI owner
   - Story 4.2 已新增 AC #7/#8/#9、Task 3 和 CLI owner 说明。
   - 验证结果：4.2 本地 owner 已明确，但 2.5 的 scan CLI 源 Story 仍只定义 `--rebuild` 和 `--json`，没有 `--force`、manual 关系检测或确认流程，因此根契约仍未真正闭合。

## 新发现

### 1. 【中】【新】Rule Document Registry 镜像文档仍未实际同步 `updateStrategies` 配置字段

- **来源**：consistency+contract
- **分类**：patch
- **涉及 Story**：4-3
- **证据** - Story 4.3 的 Task 1.4 已要求同步三份规则文档，但 `_bmad-output/project-context.md` 与 `03-core-architectural-decisions.md` 仍将 cord.config 描述为 7 项配置，`04-implementation-patterns-consistency-rules.md` 也尚未承载 `updateStrategies` 的镜像规则。
- **影响** - Story 4.3 本地设计虽已修正，但 Rule Document Registry 的真实镜像仍未落地；后续代理或开发者读取全局规则文档时，仍可能基于旧的 7 字段配置基线理解 `cord.config`。
- **建议** - 不要只保留“后续实现时同步规则文档”的任务说明，应直接把 `updateStrategies` 实际同步进 `project-context.md`、`03-core-architectural-decisions.md` 和 `04-implementation-patterns-consistency-rules.md`，使镜像文档在本轮修订后立即一致。

## 逐篇审查结论

### Story 4.1: RelationService 手动添加与移除关系

#### 4.1 结论

硬阻塞

#### 4.1 优点

- `removeRelation` 的硬删除语义、`deprecateRelation` 的独立 `status` 状态位模型，以及对象入参规范已经在本 Story 内部闭合。
- migration、mapper 与持久化任务已经被正式写进 Tasks，不再只是 Dev Notes 提及。

#### 4.1 关键问题

1. **`status` 模型只在 4.1 本地 Story 中闭合，1.3 / 1.4 的源类型和持久化契约仍未同步**。
2. **下游 Query / Impact 虽已消费 `status`，但共享源 Story 仍保留旧 `RelationEdge` / `relations` 表模型，会继续制造实现基线漂移**。

#### 4.1 建议动作

- 将 `status` 字段实际同步回 Story 1.3 的 `RelationEdge` / relation schema，以及 Story 1.4 的 `relations` 表、`IGraphRepository` 和 mapper 源契约文档。
- 在完成源契约同步后，再将 4.1 视为真正 ready-for-dev。

### Story 4.2: 收敛保护机制与来源优先级

#### 4.2 结论

硬阻塞

#### 4.2 优点

- `source` 文档被修改时 manual outgoing 边保留、deprecated 关系不恢复、来源优先级、rebuild warning / `--force` / CLI owner 已在本 Story 内部形成正式 AC + Tasks + Dev Notes 闭环。
- `excludeSources` 已被提升为正式接口升级任务，不再只是非正式说明。

#### 4.2 关键问题

1. **`excludeSources` 的真正源接口仍未回写到 Story 1.4，Story 2.6 仍保留旧删边调用**。
2. **rebuild/manual warning 的真正源 CLI Story 仍未回写到 Story 2.5，scan 命令的基线设计仍是旧签名 / 旧流程**。

#### 4.2 建议动作

- 将 `deleteRelationsByDocId(..., { excludeSources })` 明确同步进 Story 1.4 和 Story 2.6 的源契约文档。
- 将 `--force`、manual 关系检测与确认流程明确同步进 Story 2.5 的 scan CLI 设计与 Tasks。

### Story 4.3: 文档类别更新策略配置

#### 4.3 结论

有条件通过

#### 4.3 优点

- 本 Story 已稳定收敛为 metadata-only 的 v0.1 范围，不再混入自动编排执行承诺。
- Task 1.4 已把 Rule Document Registry 的三文档同步范围补齐。

#### 4.3 关键问题

1. **Task 已补齐，但 Rule Document Registry 的镜像文档还没有被实际同步，当前全局规则基线仍是旧的 7 字段配置口径**。

#### 4.3 建议动作

- 直接同步 `project-context.md`、`03-core-architectural-decisions.md` 和 `04-implementation-patterns-consistency-rules.md` 的配置字段清单与规则说明。
- 文档镜像落地后，4.3 可视为通过。

## 通过项

- Story 3.1 与 Story 3.3 已明确 `status='deprecated'` 的读侧行为，默认过滤 + 显式开关 / 影响分析过滤规则已经闭合。
- Story 4.1 已在本地 Story 内完整区分硬删除与 deprecated 状态位，不再复用 `relationType='deprecated'` 表达手动废弃。
- Story 4.2 已在本地 Story 内明确 manual outgoing 边保护、rebuild warning / `--force`、CLI owner 与测试要求。
- Epic 4 父文档已同步子 Story 的主要边界，不再保留 auto-trigger 或旧 remove/history 口径。
- Story 4.3 已收敛为 metadata-only 的 v0.1 设计，并补齐了 Rule Document Registry 的任务级同步范围。

## 结论

- **结论**：不通过
- **阻塞项**：`status` 模型尚未真正同步回 1.3 / 1.4 源契约；`excludeSources` 尚未真正同步回 1.4 / 2.6 源契约；rebuild/manual warning 尚未真正同步回 2.5 scan CLI 源契约。
- **建议**：先把共享源 Story 和规则镜像文档同步到与 4.1 / 4.2 / 4.3 一致，再进行第 4 轮复审。

---
Epic: 4
Scope: epic
Round: 4
Date: 2026-04-23
Model Used: GPT-5.4 (gpt-5.4)
Type: Story Review Summary
Stories Reviewed: 3
---

# Epic 4 Story 设计审查总结

## 审查结论

第 4 轮复审。共审查 Epic 4 下 3 个 Story。审查层状态：3/3 层完成。

- 通过：3 个
- 有条件通过：0 个
- 硬阻塞：0 个

总体判断：round-3 评估要求同步的四类源契约已经全部真实落地到共享源 Story 和规则镜像文档中。`status` 模型、`excludeSources` 删边契约、scan CLI 的 `--force` 预留点，以及 `updateStrategies` 的 Rule Document Registry 镜像均已闭合。本轮未发现新的阻塞项或中高优先级问题。Epic 4 已可进入开发。

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
  - `_bmad-output/implementation-artifacts/story-reviews/epic-4-story-review/epic-4-story-review-summary-20260423-round-3.md`
  - `_bmad-output/implementation-artifacts/story-reviews/epic-4-story-review/epic-4-story-review-evaluation-20260423-round-3.md`
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

1. Round 3 / Finding #1 — Rule Document Registry 镜像文档未实际同步 `updateStrategies`
   - `project-context.md`、`03-core-architectural-decisions.md` 和 `04-implementation-patterns-consistency-rules.md` 均已同步 `updateStrategies` 为第 8 项配置字段，并补齐默认值与未知 key 处理规则。
   - 验证结果：规则镜像文档已闭合，这条问题已关闭。

2. Round 3 / Finding #2 — `status` 模型未同步到 1.3 / 1.4 共享契约
   - Story 1.3 已在 `RelationEdge` 与 relation schema 任务中承接 `status: 'active' | 'deprecated'`；Story 1.4 已在 `relations` 表和 Repository 契约中承接 `status` 字段。
   - 验证结果：写侧和源契约已经闭合，这条问题已关闭。

3. Round 3 / Finding #3 — `excludeSources` 未同步到 1.4 / 2.6 源契约
   - Story 1.4 已升级 `deleteRelationsByDocId` 签名；Story 2.6 已将步骤 9a 更新为 `deleteRelationsByDocId(docId, 'source', { excludeSources: ['manual'] })` 并写明依赖。
   - 验证结果：manual 边保护的删除端契约已经闭合，这条问题已关闭。

4. Round 3 / Finding #4 — rebuild/manual warning 未同步到 2.5 scan CLI 源 Story
   - Story 2.5 已将 `--force`、manual 关系检测预留点和 scan CLI 的扩展参数写入 AC、Tasks 与 CLI 设计代码块。
   - 验证结果：scan CLI 的源 Story 已与 4.2 的 warning/confirm 边界一致，这条问题已关闭。

## 新发现

本轮未发现新的阻塞项或中高优先级问题。

## 逐篇审查结论

### Story 4.1: RelationService 手动添加与移除关系

#### 4.1 结论

通过

#### 4.1 优点

- `deprecateRelation` 通过独立 `status` 状态位表达废弃、`removeRelation` 保持硬删除、历史仅对 `status='active'` 生效，写侧语义稳定且可执行。
- 1.3 / 1.4 源契约已同步 `status`，本 Story 不再依赖局部约定完成实现。

#### 4.1 关注点

- 无阻塞或中高优先级残留问题。

### Story 4.2: 收敛保护机制与来源优先级

#### 4.2 结论

通过

#### 4.2 优点

- manual outgoing 边保护、deprecated 不恢复、来源优先级、rebuild warning / `--force` / CLI owner 已形成完整闭环。
- `excludeSources` 已同时落在 1.4 的接口契约、2.6 的删边流程和 4.2 的实现任务中，不再存在共享源契约断裂。

#### 4.2 关注点

- `ScanService.getManualRelationsCount()` 目前主要由 Dev Notes 指向，实施时应按该接口边界落地，但这不构成设计阻塞。

### Story 4.3: 文档类别更新策略配置

#### 4.3 结论

通过

#### 4.3 优点

- 本 Story 已稳定收敛为 metadata-only 的 v0.1 范围，不再混入自动编排执行承诺。
- `updateStrategies` 已同时写入 Story、全局规则文档和架构镜像文档，配置基线一致。

#### 4.3 关注点

- Task 2 仍偏概括，实施时需要结合 Dev Notes 将 `ImpactService` 输出策略元数据的具体步骤拆细，但这不构成阻塞。

## 通过项

- QueryService 与 ImpactService 对 `status='deprecated'` 的读侧语义已稳定闭合，默认过滤规则与显式开关一致。
- Epic 4 父文档与 4.1 / 4.2 / 4.3 子 Story 的主口径一致，不再存在旧的 auto-trigger 或旧 remove/history 表述。
- Story 1.3 / 1.4 / 2.5 / 2.6 这些共享源 Story 已同步 Epic 4 引入的关键契约升级，先前的 P1 已全部关闭。
- Rule Document Registry 的三份镜像文档已同步 `updateStrategies`，不再存在“Task 已要求但全局规则仍是旧基线”的漂移。
- 低优先级文档清晰度改进仍可后续优化：例如将 2.6 的新删边调用、4.2 的查询接口、4.3 的输出步骤拆成更显式的子任务，以减少实现时回读 Dev Notes 的成本。

## 结论

- **结论**：通过
- **阻塞项**：无
- **建议**：Epic 4 可进入开发；若希望进一步降低实现时的阅读成本，可在后续修订中把少量 Dev Notes 级提示提升为更显式的 Task 子项。

---
Epic: 4
Scope: epic
Round: 1
Date: 2026-04-20
Model Used: GPT-5.4 (gpt-5.4)
Type: Story Review Summary
Stories Reviewed: 3
---

# Epic 4 Story 设计审查总结

## 审查结论

首轮审查。共审查 Epic 4 下 3 个 Story。审查层状态：3/3 层完成。

- 通过：0 个
- 有条件通过：0 个
- 硬阻塞：3 个

总体判断：Epic 4 的产品目标和 Story 拆分方向基本清楚，但共享契约与上游扫描/配置/影响分析边界尚未闭合。当前最核心的阻塞集中在三条主线上：一是“手动 deprecated / remove / history”这一组关系修正语义尚未落到可执行数据模型；二是 manual 关系在增量扫描和 rebuild 路径上的保留规则仍与 Epic 2/架构基线冲突；三是 updateStrategies 的执行边界与 ImpactService 输出契约尚未定义清楚。Epic 4 目前不建议进入开发。

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
  - `_bmad-output/implementation-artifacts/stories/3-3-impactservice-change-impact-analysis.md`
  - `_bmad-output/implementation-artifacts/stories/5-2-mcp-tools-relation-management.md`
- 审查维度：
  - 结构完整性
  - AC 可测性
  - 与 Epic 一致性
  - 与架构文档一致性
  - Story 间冲突与依赖
  - 任务拆分合理性
  - 交互/认证/安全/性能口径
  - 跨 Epic 共享契约

## 新发现

### 1. [高] 手动 deprecated 缺少可执行的抑制模型

- **来源**：structure+consistency+contract
- **分类**：decision_needed
- **涉及 Story**：4-1、4-2
- **证据** - Story 4.1 只定义了 `deprecateRelation()`，Story 4.2 又要求“手动标记为 deprecated 的关系不被自动恢复”；但共享契约里只有 `relationType`、`source` 和 `metadata`。若把 `relationType` 直接改成 `deprecated`，原始关系类型就丢失，后续 auto_scan 重新发现原关系时不会命中同一 `source+target+type`；若改用 `metadata` 标记，Story 1.3 和 Story 1.4 里又没有相应 schema 与持久化契约。
- **影响** - FR22 的“手动标记为 deprecated 的关系不被自动恢复”当前没有稳定实现路径，也无法写出不依赖实现者主观补脑的验收测试。
- **建议** - 在 Epic 4 中先统一 deprecated 的数据模型：要么引入 tombstone / suppressedRelationType 一类的显式抑制记录，要么定义保留原 relationType 的状态位模型；并同步改写 Story 4.1 的 Dev Notes、Story 4.2 的冲突规则和测试要求。

### 2. [高] removeRelation 与可追溯历史记录契约相互冲突

- **来源**：structure+contract
- **分类**：decision_needed
- **涉及 Story**：4-1
- **证据** - Story 4.1 的 AC 要求“修改关系时检查历史”，Dev Notes 又把历史放到 `relation.metadata.history`；但 Task 1.2 同时把 `removeRelation()` 定义为删除关系。当前存储契约没有独立审计表或墓碑表，硬删除后就不存在可承载历史的 live relation。
- **影响** - FR21 在 remove 路径上无法稳定满足；实现者要么静默放弃“删除也可追溯”，要么私自发明独立审计模型，导致实现分叉。
- **建议** - 先做语义裁决：要么明确 remove 是不保留历史的硬删除，并把 FR21 收窄为对保留中的关系生效；要么为 remove 引入独立审计或墓碑记录，再同步更新 AC、Tasks 和测试口径。

### 3. [高] 4.2 的 manual 保护与 2.6 的删边流程没有闭合

- **来源**：structure+consistency+contract
- **分类**：decision_needed
- **涉及 Story**：4-2
- **证据** - Story 4.2 只写了“增量扫描前获取 manual 来源关系”和“写入时跳过已有 manual 或 deprecated 关系”；但 Story 2.6 在 modified 文档事务内仍会先执行 `deleteRelationsByDocId(docId, 'source')`。对于 `sourceDoc` 正好被修改的 manual outgoing 边，冲突判定前就已被删除。
- **影响** - FR22 的“手动添加的关系不被自动删除”在最常见的 modified 场景下不成立，用户刚修好的关系会在下一次增量扫描中被清掉。
- **建议** - 在 Story 4.2 中明确替换 2.6 的删除契约：要么删除前排除 manual / manual-deprecated 边，要么先快照后同事务回放；同时新增一条“source 文档被修改时 manual outgoing 边仍保留”的测试要求。

### 4. [高] Epic 4 引入 manual 关系后，rebuild 边界仍未与上游契约统一

- **来源**：contract
- **分类**：decision_needed
- **涉及 Story**：4-2、4-3、epic-4
- **证据** - Story 2.5 明确 v0.1 的 `--rebuild` 通过 `deleteAllDocuments()` 级联清除全部关系和同步状态，并注明“v0.1 不保留 manual 边，Epic 4 再细化”；但 D2 / project-context 同时把“用户手动添加的关系必须保留”列为架构基线。Epic 4 当前 4.1-4.3 没有任何 Story 回收 rebuild 语义。
- **影响** - 一旦 Epic 4 真正落地 manual 关系，一次 rebuild 就可能直接抹掉用户手工修正和历史记录；反过来，如果实现选择强行保留 manual，又会与 NFR18 的重建口径冲突。
- **建议** - 在 Epic 4 内补一条显式决策并同步到架构文档：要么禁止存在 manual 数据时执行 rebuild，要么把 manual 修正存入独立层并在 rebuild 后回放，要么明确 NFR18 只约束自动发现图谱而不包含 manual 状态。

### 5. [高] 4.3 的“自动触发同步”需求与当前任务/输出契约不一致

- **来源**：structure+consistency+contract
- **分类**：decision_needed
- **涉及 Story**：4-3
- **证据** - Story 4.3 的业务目标是“关键文档变更时自动触发同步，而参考文档只记录不触发”，但 AC 和 Tasks 实际只覆盖三种策略配置以及“ImpactService 输出策略信息”。文档没有定义 `updateStrategy` 是纯展示字段、是否覆盖 Story 3.3 既有的 `suggestedAction`、还是会驱动后续 `sync_docs` 执行。
- **影响** - 同一 Story 内部已经存在“自动执行”与“仅输出策略”的边界冲突。实现者无法判断本 Story 要交付的是一套决策元数据，还是带编排含义的自动行为。
- **建议** - 先在 Story 4.3 中做边界裁决。若 v0.1 只返回策略不自动执行，就把 Story 目标改写为“影响分析结果体现策略”；若要自动执行，则应拆出独立 orchestration Story，并明确 owner 不在 CLI/MCP 薄壳层。

### 6. [中] updateStrategies 只改 configSchema 会导致共享配置契约漂移

- **来源**：consistency+contract
- **分类**：patch
- **涉及 Story**：4-3
- **证据** - Story 4.3 的 Task 1 只写“扩展 `configSchema` 添加 `updateStrategies`”，但 Story 1.3 的 `CordConfig`、D6 和 project-context 仍都把全局配置口径定义为 7 项字段。文档也没有定义未知 key 的处理策略以及 Rule Document Registry 所要求的同步更新范围。
- **影响** - `configSchema`、TypeScript 类型、`cord init` 模板和架构规则文档会立即分叉，后续实现容易只改一层不改共享契约。
- **建议** - 在 Story 4.3 中补充对 `src/types/config.ts`、初始化模板和规则文档同步更新的任务，并写清 `updateStrategies` 的键域、默认值和未知 key 处理方式。

### 7. [中] 4.1 缺少面向 Service/MCP 的共享输入契约

- **来源**：consistency+contract
- **分类**：patch
- **涉及 Story**：4-1
- **证据** - Story 4.1 的 RelationService 草图仍使用 `removeRelation(relationId: string)`、`deprecateRelation(relationId: string)` 等标量入参，也没有新增 add/remove/deprecate relation 的共享 Zod schema 或输入类型任务；但 P11 明确要求 Service 方法采用单对象入参与共享 schema，Story 5.2 又要求 MCP Tools 直接调用这些方法。
- **影响** - 当前接口既不满足全局签名规范，也没有定义 `relationId` 与业务键之间的对外契约，MCP Tool 很容易被迫泄露存储层标识或在入口层拼装业务查找逻辑。
- **建议** - 为 Story 4.1 补充共享输入 schema / type 任务，统一采用对象入参，并明确对外操作是基于 `relationId` 还是 `sourcePath + targetPath + relationType` 这组业务键。

### 8. [中] 4.2 将 NFR9 挂为验收项，但当前任务并未承接关系类型扩展契约

- **来源**：structure+consistency
- **分类**：patch
- **涉及 Story**：4-2
- **证据** - Story 4.2 的 AC #5 要求“新增传播行为类型时已有数据无需迁移”，但 4.2 的任务只改 ScanService 收敛逻辑和来源优先级；与此同时 Story 1.3 与 project-context 仍把 `relationType` 定义为固定 9 类，不支持扩展新类型。
- **影响** - AC #5 既没有对应实现任务，也没有与共享类型契约闭合，完成判定会变得主观。
- **建议** - 要么把 NFR9 从 Story 4.2 挪回类型/存储演进相关 Story，要么在 4.2 中显式补齐 relationType 扩展契约、schema 和查询兼容任务。

### 9. [中] 按文档类别应用更新策略会受到 2.6 path-only rename/move 限制影响

- **来源**：consistency+contract
- **分类**：patch
- **涉及 Story**：4-3
- **证据** - Story 4.3 的 `updateStrategies` 以 `prd`、`architecture`、`story` 等类别为键，但 Story 2.6 明确 v0.1 的 rename/move 仅更新 `documents.path`，不重算 `docType` 或路径敏感 preset 关系。4.3 没说明策略解析是依赖持久化 `docType`、当前 path 还是运行时重分类。
- **影响** - 跨类别重命名或移动后，impact 结果可能继续使用过期策略，出现“文档已经变类，但策略仍按旧类执行”的假象。
- **建议** - 在 Story 4.3 中明确 v0.1 的策略解析口径，并补一条 rename/move 场景测试；若暂不解决，应明确写出“需 rebuild 后策略才与类别一致”的限制。

## 逐篇审查结论

### Story 4.1: RelationService 手动添加与移除关系

#### 4.1 结论

硬阻塞

#### 4.1 优点

- 手动添加、移除、deprecated、来源标记、历史、存在性校验和测试范围都已进入 AC，产品目标并不空泛。
- RelationService 独立成 Story，本身符合按 Service 能力分层的方向。

#### 4.1 关键问题

1. **remove 与 history 没有同一套可执行数据模型** — 当前既想硬删除，又想在同一 relation 上保留可检查历史，文档没有定义独立审计或墓碑机制。
2. **对外输入契约未闭合** — Service 草图仍是标量参数，没有共享 schema，也没有说明 `relationId` 是否应该暴露给 MCP 层。

#### 4.1 建议动作

- 先补齐 remove / deprecated / history 的统一数据模型，再细化 RelationService 方法草图。
- 同步新增共享输入 schema / type，确保后续 Story 5.2 可以直接复用。

### Story 4.2: 收敛保护机制与来源优先级

#### 4.2 结论

硬阻塞

#### 4.2 优点

- `manual > framework_preset > auto_scan` 的优先级方向明确，且与 PRD FR22 保持一致。
- Story 4.2 明确依赖 Story 4.1 与 Story 2.6，没有把 unrelated 能力混进来。

#### 4.2 关键问题

1. **manual 边会在冲突判断前被 2.6 的删边步骤清掉** — 当前 AC 和任务没有真正接住 modified 场景下的保护需求。
2. **deprecated 保护没有抑制锚点** — 现有 `source+target+type` 规则无法阻止原关系被重新写回。
3. **rebuild 语义仍悬空** — Epic 4 真正引入 manual 关系后，2.5 的 `--rebuild` 口径会立刻成为真实数据保留风险。

#### 4.2 建议动作

- 把 2.6 的删边流程与 4.2 的保护逻辑一起改写成同一套事务规则。
- 明确 deprecated 的数据模型和 rebuild 的手工关系处理策略，再回写到 Epic 和相关 Story。

### Story 4.3: 文档类别更新策略配置

#### 4.3 结论

硬阻塞

#### 4.3 优点

- 三种策略、默认回退和“按文档类别配置”的业务意图清楚，且与 FR23 对齐。
- 把策略配置与影响分析结果联动放在同一 Story，产品视角上是完整的闭环。

#### 4.3 关键问题

1. **“自动触发同步”与“只输出策略”边界冲突** — 当前 Story 目标、AC 和 Tasks 没有落到同一交付范围。
2. **共享配置契约未同步** — 只扩展 `configSchema`，未覆盖 `CordConfig`、初始化模板和架构规则文档。
3. **类别解析会受 2.6 的 path-only rename/move 约束影响** — 当前没有写清策略何时可信。

#### 4.3 建议动作

- 先明确本 Story 是“只产生策略元数据”还是“触发自动同步执行”。
- 将 `updateStrategies` 的共享配置契约、未知 key 处理和 rename/move 限制一并写入 Story 与规则文档。

## 通过项

- FR21 的三值来源契约在 PRD、Story 1.3、Story 2.5 和 Story 4.2 之间保持一致，当前没有再引入第四种来源值。
- Epic 4 与 Story 5.2 的分层边界总体清楚：Epic 4 聚焦 Service / Scan / Config 侧能力，MCP Tool 暴露放在后续 Epic 承接。
- 三个 Story 都包含了测试任务，说明作者有把验收落到可验证交付物的意识。
- Story 4.3 已把默认策略明确为 `suggest`，这一点在产品口径上是稳定的。

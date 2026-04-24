---
Epic: 4
Scope: epic
Round: 2
Date: 2026-04-20
Model Used: GPT-5.4 (gpt-5.4)
Type: Story Review Summary
Stories Reviewed: 3
---

# Epic 4 Story 设计审查总结

## 审查结论

第 2 轮复审。共审查 Epic 4 下 3 个 Story。审查层状态：3/3 层完成。

- 通过：0 个
- 有条件通过：1 个
- 硬阻塞：2 个

总体判断：round-1 的局部修订大多已经写入 4.1-4.3，但核心阻塞还没有真正闭合到共享契约层。当前最重要的残留问题有四条：一是 status 模型只在 Epic 4 本地 Story 中成立，尚未同步到 1.3/1.4 的类型与持久化边界；二是 QueryService / ImpactService 仍按旧的 `relationType=deprecated` 语义读取关系，未定义 `status='deprecated'` 的读侧规则；三是 manual 边保护与 rebuild warning 的修复还没有真正回写到 2.5/2.6 和 CLI 入口契约；四是父 Epic 与 Rule Document Registry 的同步仍不完整。Epic 4 仍不建议进入开发。

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
  - `_bmad-output/implementation-artifacts/story-reviews/epic-4-story-review/epic-4-story-review-summary-20260420-round-1.md`
  - `_bmad-output/implementation-artifacts/story-reviews/epic-4-story-review/epic-4-story-review-evaluation-20260420-round-1.md`
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

1. Round 1 / Finding #2 — `removeRelation` 与历史记录边界冲突
   - Story 4.1 已明确 `removeRelation` 为硬删除，不保留历史；FR21 历史只适用于保留中的 active 关系。
   - 验证结果：AC、Tasks 与 Dev Notes 已对齐，这一局部语义冲突已关闭。

2. Round 1 / Finding #7 — 4.1 缺少对象入参与共享输入契约
   - Story 4.1 已把 `removeRelation` / `deprecateRelation` 改为 `RemoveRelationInput` / `DeprecateRelationInput` 对象入参。
   - 验证结果：P11 的“单对象入参”要求在 4.1 本地 Story 中已落实。

3. Round 1 / Finding #8 — 4.2 的 NFR9 口径过度暗示类型扩展实现
   - Story 4.2 已把 AC #5 收窄为“本 Story 不破坏 NFR9 的非回归验证”。
   - 验证结果：4.2 不再虚假承诺 relationType 扩展能力，这条问题已关闭。

4. Round 1 / Finding #9 — rename/move 场景下的策略解析限制未说明
   - Story 4.3 Dev Notes 已新增 v0.1 已知限制说明，并指出 `--rebuild` 是恢复策略与类别一致性的缓解方案。
   - 验证结果：作为 v0.1 边界说明，这条问题已关闭。

5. Round 1 / Finding #5 — 4.3 子 Story 内部的“自动触发同步 vs 只输出策略”冲突
   - Story 4.3 本文已改为“只输出 updateStrategy 元数据，不自动触发同步执行”。
   - 验证结果：子 Story 内部边界已经收口；但父 Epic 尚未同步，本轮另列为残留问题。

## 新发现

### 1. [高] status 模型尚未同步到 1.3/1.4 的共享类型与持久化契约（上轮遗留）

- **来源**：structure+consistency+contract
- **分类**：patch
- **涉及 Story**：4-1
- **证据** - Story 4.1 已引入 `status: 'active' | 'deprecated'`，并要求 deprecated 保留原 `relationType`；但 Story 1.3 的 `RelationEdge` 仍无 status 字段，Story 1.4 的 `relations` 表仍无 status 列，Repository 接口与迁移脚本也没有承接这一模型。
- **影响** - 手动 deprecated 状态无法形成稳定持久化契约，关系导出、查询和重启后的行为都可能退回到旧模型，round-1 对 Finding #1 的修复实际上没有真正闭合。
- **建议** - 把 status 一次性同步到 Story 1.3 类型与 schema、Story 1.4 的 Repository 接口、relations 表 migration、mapper 与测试说明；不要只在 4.1 本地 Story 中描述新模型。

### 2. [高] QueryService 与 ImpactService 仍未定义 `status='deprecated'` 的读侧语义（新发现）

- **来源**：consistency+contract
- **分类**：decision_needed
- **涉及 Story**：epic-4
- **证据** - Story 3.1 的查询结果仍只包含目标路径、关系类型、置信度和来源，没有 status 字段或过滤规则；Story 3.3 仍只把 `relationType=deprecated` 映射为“已废弃，忽略”，没有定义 `status='deprecated'` 的关系在 traversal、输出和建议动作中该如何处理。
- **影响** - 一个被手动 deprecated 的 `sync_required` 或 `references` 边，仍可能在 query / impact 中按活跃边返回。关系管理写侧和读侧会直接相互矛盾。
- **建议** - 先裁决读侧规则：要么默认过滤 `status='deprecated'` 并提供 `includeDeprecated` 开关，要么显式返回 status 并规定查询/影响分析如何解释；随后同步更新 Story 3.1、Story 3.3 以及相应 CLI / JSON / MCP 契约。

### 3. [高] excludeSources 删边修复仍未回写到 1.4 与 2.6 的源契约（上轮遗留）

- **来源**：consistency+contract
- **分类**：patch
- **涉及 Story**：4-2
- **证据** - Story 4.2 已要求把 `deleteRelationsByDocId(docId, 'source')` 改为带 `excludeSources: ['manual']` 的排除式删除；但 Story 2.6 的步骤 9a 仍是旧调用，Story 1.4 的 IGraphRepository 也仍只有旧签名。当前 manual 保护修复只停留在 4.2 自身文本。
- **影响** - modified source 文档场景下的 manual outgoing 边保护仍没有真正闭合到共享执行契约，开发者仍可能按旧的删边接口落地。
- **建议** - 将 `excludeSources` 明确同步到 Story 1.4 接口与 Story 2.6 步骤 9a，同时补出旧签名废弃或升级说明，避免“4.2 写了新规则，但 2.6 还在教旧做法”。

### 4. [高] rebuild/manual warning 方案只有 Dev Notes 裁决，没有 AC、Tasks 和 CLI owner（上轮遗留）

- **来源**：structure+consistency+contract
- **分类**：patch
- **涉及 Story**：4-2
- **证据** - Story 4.2 已裁定：存在 manual 关系时，`--rebuild` 前必须警告并确认，或通过 `--force` 跳过；但 4.2 的 AC/Tasks 仍只覆盖增量扫描保护，Story 2.5 的 AC、Task 1.8 和 CLI 设计也仍是旧的无条件 `deleteAllDocuments()` + `--rebuild` / `--json` 模式。
- **影响** - 当前 rebuild/manual 方案仍没有明确 owner，极易在实现阶段被遗漏，或被错误塞进 Service 层 / CLI 层任一侧，最终继续出现 manual 边被静默清空的风险。
- **建议** - 明确把 warning / confirm / `--force` 的 owner 归到 Story 2.5 的 scan CLI 边界，或拆出单独 Story；至少要补齐 AC、Tasks、测试和 scan.ts 入口契约。

### 5. [中] 父 Epic 仍保留修订前的旧验收口径（上轮遗留）

- **来源**：structure+consistency
- **分类**：patch
- **涉及 Story**：epic-4
- **证据** - 子 Story 已把 4.3 收敛为“只返回 updateStrategy 元数据，不自动执行同步”，但父 Epic 4 仍写“关键文档变更时自动触发同步”；同时父 Epic 的 4.1/4.2 也没有承接 remove/history 适用范围收窄与 modified source 文档 manual outgoing 边保护等修订结果。
- **影响** - 父级验收源与子 Story 设计仍不一致，后续实现与验收会继续反复出现“到底按哪份文档为准”的争议。
- **建议** - 把 round-1 已接受的边界裁决同步回 Epic 4 父文档，至少更新 4.1、4.2、4.3 的 Acceptance Criteria 与 So that 口径。

### 6. [中] `updateStrategies` 的规则文档同步任务仍漏掉 03 核心架构决策文档（上轮遗留）

- **来源**：consistency+contract
- **分类**：patch
- **涉及 Story**：4-3
- **证据** - Story 4.3 的 Task 1.4 只要求同步 `project-context.md` 和 `04-implementation-patterns-consistency-rules.md`；但 Rule Document Registry 明确还要求同步 `03-core-architectural-decisions.md`。当前任务仍未覆盖完整镜像集。
- **影响** - `updateStrategies` 会继续处于“Story 已新增，但 03 仍按旧七字段模型描述配置基线”的漂移状态，后续代理读取不同规则文档时会看到不同边界。
- **建议** - 将 `03-core-architectural-decisions.md` 显式加入 Task 1.4，并在 Dev Notes 里注明这是 Registry 的强制同步项，而不是可选补充。

## 逐篇审查结论

### Story 4.1: RelationService 手动添加与移除关系

#### 4.1 结论

硬阻塞

#### 4.1 优点

- `removeRelation` 的硬删除语义、历史适用范围和对象入参规范已经在本 Story 内部闭合。
- deprecated 不再粗暴改写 `relationType`，方向上比 round-1 更接近可执行的数据模型。

#### 4.1 关键问题

1. **status 模型只修到了本地 Story，没有落到共享类型与持久化边界**。
2. **status 模型的读侧语义没有一起闭合**，下游 query / impact 仍按旧模型消费关系。

#### 4.1 建议动作

- 把 status 一次性同步到 Story 1.3、Story 1.4 以及对应迁移/mapper 设计。
- 明确 QueryService / ImpactService 如何读取、过滤或展示 `status='deprecated'` 的关系。

### Story 4.2: 收敛保护机制与来源优先级

#### 4.2 结论

硬阻塞

#### 4.2 优点

- `source` 文档被修改时 manual outgoing 边保留这一关键场景，已在本 Story 的 AC / Tasks / Dev Notes 中同时落文。
- NFR9 已被收窄为非回归验证，不再虚假扩张到 relationType 体系重构。

#### 4.2 关键问题

1. **excludeSources 删边修复仍未同步到 1.4 / 2.6 的真正源契约**。
2. **rebuild/manual warning 方案没有明确 owner 和入口层任务**。

#### 4.2 建议动作

- 将 `excludeSources` 和新删边语义同步更新到 Story 1.4 与 Story 2.6。
- 明确 rebuild warning / confirm / `--force` 的 owner，并补齐 AC、Tasks 和 CLI 契约。

### Story 4.3: 文档类别更新策略配置

#### 4.3 结论

有条件通过

#### 4.3 优点

- 子 Story 内部已经把 v0.1 范围收敛为“只输出策略元数据，不自动执行同步”，核心边界比 round-1 清晰。
- `updateStrategies` 的键域、默认值、未知 key 和 rename/move 限制都已补进 Dev Notes。

#### 4.3 关键问题

1. **Rule Document Registry 的同步范围仍不完整**，Task 1.4 漏掉了 03 核心架构决策文档。
2. **父 Epic 仍保留旧的 auto-trigger 口径**，导致上位验收源未同步。

#### 4.3 建议动作

- 把 `03-core-architectural-decisions.md` 加入同步任务。
- 将父 Epic 4 的 4.3 口径同步为 metadata-only 的 v0.1 范围。

## 通过项

- `removeRelation` 的硬删除语义与 FR21 的历史边界已经在 Story 4.1 内部闭合。
- Story 4.1 的对象入参形式已符合 P11 的单对象入参规范。
- Story 4.2 已把 modified source 文档的 manual outgoing 边保护写进 AC、Tasks 和 Dev Notes，不再只停留在口头说明。
- Story 4.2 已把 NFR9 收窄为非回归验证，不再错误承诺 relationType 扩展实现。
- Story 4.3 已明确 v0.1 不做 orchestration，只输出 `updateStrategy` 元数据。
- Story 4.3 已写明 rename/move 跨类别后的已知限制及 `--rebuild` 缓解方式。

## 结论

- **结论**：不通过
- **阻塞项**：status 模型未同步到 1.3/1.4 持久化边界；Query / Impact 仍无 `status='deprecated'` 读侧语义；excludeSources 删边修复未同步到 1.4/2.6；rebuild/manual warning 没有明确 owner 和 CLI 契约。
- **建议**：先完成共享类型/存储/读取侧的 status 闭环，再同步 2.5 / 2.6 / 父 Epic / Rule Document Registry 文档，然后再进行第 3 轮复审。

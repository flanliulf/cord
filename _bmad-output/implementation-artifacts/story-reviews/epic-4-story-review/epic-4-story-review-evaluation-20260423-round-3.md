---
Epic: 4
Scope: epic
Round: 3
Date: 2026-04-23
Model Used: Claude Opus 4.6 (claude-opus-4-dot-6)
Review Source: epic-4-story-review-summary-20260423-round-3.md
Review Model: GPT-5.4 (gpt-5.4)
Type: Story Review Evaluation
---

## 评估总结

本次对 GPT-5.4 第 3 轮复审结果的独立评估结论：审查质量保持稳定，4 条发现（3 条 round-2 遗留升级 + 1 条新发现）中 **0 条误报**，3 条确认为 P1 阻塞项，1 条降级为 P2 后续改善项。Round-2 的 3 条核心修复（QueryService/ImpactService 读侧 deprecated 语义、父 Epic 同步、Story 4.3 Task 1.4 三文档同步范围）已全部确认到位。

本轮评估特别需要**纠正一个 round-2 评估中的判断**：我曾建议"将 status 模型变更集中在 Story 4.1 而非回溯 1.3/1.4"，这一建议建立在"Epic 1 已实现"的隐含假设上。但事实核查发现，Story 1.3、1.4、2.5、2.6 当前状态均为 `ready-for-dev`，**没有任何相关 Story 已开始实现**——这意味着所有共享源 Story 都仍是开发权威来源，必须保持契约一致。Round-3 审查"共享源 Story 仍在教授旧做法"的论点完全成立，且严重性高于我 round-2 时的判断。

## 上轮问题回顾确认

### Round 2 / Finding #2 — QueryService 与 ImpactService 缺少 status='deprecated' 读侧语义：已确认修复

Story 3.1 已新增 AC#9/#10、`includeDeprecated` 字段、`--include-deprecated` flag 和 status 字段输出；Story 3.3 已新增 AC#8、Dev Notes 中的"deprecated 读侧语义裁决"段落明确策略为"默认过滤 + includeDeprecated 开关"。读侧契约闭环已完成。

### Round 2 / Finding #5 — 父 Epic 保留旧验收口径：已确认修复

Epic 4 父文档已同步：4.1 包含"deprecated 操作保留原 relationType，通过独立的 status: 'deprecated' 状态位标记"和"修改历史仅对 status='active' 有效"；4.2 包含"source 文档被修改时其 manual outgoing 边仍然保留"和 rebuild warning/`--force` 行为；4.3 已改为"影响分析结果中体现对应文档的更新策略元数据（只读输出，v0.1 不自动执行编排）"。父 Epic 与子 Story 的主口径已对齐。

### Round 2 / Finding #6 — 4.3 的 Task 1.4 缺少 03-core-architectural-decisions.md：已确认修复

Story 4.3 Task 1.4 已扩列为"Rule Document Registry 强制同步三份：project-context.md、04-implementation-patterns-consistency-rules.md、03-core-architectural-decisions.md"。任务范围已完整。

### Round 2 / Finding #1 / #3 / #4 — 共享源契约同步：未完全修复

Round-2 评估中我对这三条的修订建议偏向"在 Epic 4 内补齐任务"，但事实核查显示 Story 1.3/1.4/2.5/2.6 均为 `ready-for-dev`，未实现。在此前提下，源 Story 文档保留旧契约会直接误导未来的实现者。Round-3 把这三条升级为"未真正闭合"是正确的，本轮评估同样确认其为 P1。详见下方逐条评估。

### 历史非阻塞待办

Round-2 评估中降级为 P2 的两项中：#5 父 Epic 旧口径已确认修复；#6 Task 1.4 同步范围已确认修复。无遗留的非阻塞待办。

## 发现 #1 评估

### 审查原文

> **【中】【新】Rule Document Registry 镜像文档仍未实际同步 `updateStrategies` 配置字段**
> - 来源：consistency+contract
> - 分类：patch
> - 涉及 Story：4-3
> - 证据 - Story 4.3 的 Task 1.4 已要求同步三份规则文档，但 `_bmad-output/project-context.md` 与 `03-core-architectural-decisions.md` 仍将 cord.config 描述为 7 项配置，`04-implementation-patterns-consistency-rules.md` 也尚未承载 `updateStrategies` 的镜像规则。
> - 影响 - Story 4.3 本地设计虽已修正，但 Rule Document Registry 的真实镜像仍未落地；后续代理或开发者读取全局规则文档时，仍可能基于旧的 7 字段配置基线理解 `cord.config`。
> - 建议 - 不要只保留"后续实现时同步规则文档"的任务说明，应直接把 `updateStrategies` 实际同步进 `project-context.md`、`03-core-architectural-decisions.md` 和 `04-implementation-patterns-consistency-rules.md`，使镜像文档在本轮修订后立即一致。

### 评估结论：⚠️ 有效但降级 — 建议纳入后续改善跟踪（P2）

### 评估分析

**问题描述准确性**：准确 — 事实核查确认三份规则文档（project-context.md、03-core-architectural-decisions.md、04-implementation-patterns-consistency-rules.md）均未提及 `updateStrategies`，仍按旧的 7 字段 CordConfig 基线描述。Story 4.3 Task 1.4 是"计划同步"而非"已同步"。
**严重性判断**：合理 — 标为[中]恰当。这是规划阶段（Story 文档已定义）与镜像同步阶段（规则文档未更新）之间的时序窗口问题。下游代理在此窗口内读取规则文档可能产生认知偏差。
**修订建议**：可行但需权衡 — 审查建议"立即同步规则文档而非保留任务说明"。这涉及一个工作流哲学选择：(1) 严格做法：Story 文档变更必须同步规则文档，本轮立即同步；(2) 宽松做法：规则文档同步随 Story 实施一起完成，Task 1.4 已锁定要求。两种做法均可。考虑到 Story 4.3 尚未进入实施且 Task 1.4 已正式承接，可在 Fix 阶段一并同步即可，不必要求审查阶段独立完成。
**误报评估**：非误报 — 三份规则文档的现状与审查描述完全一致。
**降级理由**：与下面三条 P1 相比，此条不阻塞开发——开发者实施 Story 4.3 时 Task 1.4 会强制同步；不像源 Story 契约不一致会导致 Story 4.1/4.2 实施时基础类型/接口已经按错误模型固化。

## 发现 #2 评估（部分修复升级项）

### 审查原文

> **Round 2 / Finding #1 — `status` 模型未同步到 1.3/1.4 共享契约：部分修复但仍未闭合**
> - Story 4.1 已补入 migration、mapper 和接口升级任务。
> - 验证结果：4.1 本地修订已到位，但 1.3 的 `RelationEdge` / relation schema 与 1.4 的 `relations` 表 / `IGraphRepository` 源契约文档仍保持旧模型，因此根契约仍未真正闭合。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 事实核查确认 Story 4.1 Task 1 已补齐迁移和 mapper 任务（1.3 新增数据库 migration、1.4 更新 SQLite row ↔ RelationEdge mapper），但 Story 1.3 的 `RelationEdge` 类型定义和 Story 1.4 的 `relations` 表 schema 与 IGraphRepository 接口源文档仍保留旧模型。
**严重性判断**：合理 — 鉴于 Story 1.3、1.4 当前状态均为 `ready-for-dev`，开发者实施 1.3/1.4 时会按其当前 spec 实现旧模型，待实施 4.1 时才发现冲突，可能导致返工或基线漂移。在 round-2 评估中我倾向于"通过 4.1 任务补齐"，但前提是 Epic 1 已实现；事实并非如此，因此本轮升级为 P1 阻塞是正确的。
**修订建议**：可行 — 推荐做法：将 `status: 'active' | 'deprecated'` 字段及其默认值同步进 Story 1.3 的 `RelationEdge` 类型与 Zod schema、Story 1.4 的 relations 表 SQL 与 mapper 段落。Story 4.1 Task 1.3/1.4 的 migration 任务可保留作为执行实施的具体步骤，但源契约必须先在 1.3/1.4 spec 中正式存在。
**误报评估**：非误报 — 已通过对比 Story 1.3/1.4 与 4.1 的当前文档完全确认。
**对 round-2 评估的修正说明**：我在 round-2 评估中提出"是否需要回溯修改已完成 Story 的 spec，取决于项目策略"——这一假设建立在 Epic 1 已实现的前提上。事实核查显示 1.3/1.4 也是 ready-for-dev，因此该假设不成立。Round-3 审查的判断更准确。

## 发现 #3 评估（部分修复升级项）

### 审查原文

> **Round 2 / Finding #3 — `excludeSources` 删边修复未回写到 1.4 / 2.6 源契约：部分修复但仍未闭合**
> - Story 4.2 已把 `excludeSources` 升级为正式 Task，并明确覆盖 Story 2.6 的删边契约。
> - 验证结果：4.2 本地说明已经充足，但 1.4 的接口定义和 2.6 的流程伪代码仍然教授旧签名 / 旧调用，因此共享源契约仍未真正闭合。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — Story 4.2 已将 `excludeSources` 接口升级提升为正式 Task 1.2，但 Story 1.4 的 `IGraphRepository.deleteRelationsByDocId` 签名仍是 `(docId: string, direction?: 'source' | 'target' | 'both'): void`，无 `excludeSources` 参数；Story 2.6 步骤 9a 仍是 `repo.deleteRelationsByDocId(docId, 'source')` 旧调用。
**严重性判断**：合理 — Story 1.4 和 2.6 均为 `ready-for-dev`，未实施。开发者实施 1.4 时会按当前接口签名实现，实施 2.6 时会按旧调用执行，待 4.2 实施时 manual 保护逻辑无处落地。这是真实的实施时序风险。
**修订建议**：可行 — 推荐：(1) 将 `IGraphRepository.deleteRelationsByDocId` 签名升级为 `(docId: string, direction?: '...', options?: { excludeSources?: RelationSource[] }): void` 同步进 Story 1.4 的接口设计；(2) 将 Story 2.6 步骤 9a 更新为带 `excludeSources` 的新调用，并在 Dev Notes 中说明这是 Epic 4 所需的 manual 保护机制。
**误报评估**：非误报 — 已通过 Story 1.4 接口段落和 Story 2.6 流程伪代码完全确认。

## 发现 #4 评估（部分修复升级项）

### 审查原文

> **Round 2 / Finding #4 — rebuild/manual warning 没有 AC/Task/CLI owner：部分修复但仍未闭合**
> - Story 4.2 已新增 AC #7/#8/#9、Task 3 和 CLI owner 说明。
> - 验证结果：4.2 本地 owner 已明确，但 2.5 的 scan CLI 源 Story 仍只定义 `--rebuild` 和 `--json`，没有 `--force`、manual 关系检测或确认流程，因此根契约仍未真正闭合。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — Story 4.2 已正式承接 rebuild warning 行为（AC #7/#8、Task 3.1-3.4），但 Story 2.5 的 CLI 设计段落仍保留旧的 `scanCommand.option('--rebuild', ...)`+`option('--json', ...)` 两参数模式，没有 `--force` option，也没有 manual 关系检测前置流程。
**严重性判断**：合理 — Story 2.5 是 scan CLI 的源 Story，处于 `ready-for-dev` 状态。开发者实施 2.5 时会按当前 CLI 设计实现，遗漏 `--force` 和检测逻辑；等 4.2 实施时需要回头修改 2.5 的 CLI 入口，造成实施依赖混乱。
**修订建议**：可行 — 推荐：在 Story 2.5 的 CLI 设计段落补充 `--force` option 和"v0.1 manual 关系检测预留点"说明，并在 Dev Notes 中标注实际检测逻辑由 Story 4.2 Task 3 实现。这样 2.5 的入口契约一开始就为 4.2 的扩展留好接口。
**误报评估**：非误报 — Story 2.5 CLI 设计段落与 4.2 AC/Task 对比完全确认。

## 整体评估结论

### 需要修订（阻塞进入开发）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|------------|------|
| 2 | status 模型未同步到 1.3/1.4 源契约 | （部分修复升级）| P1 | 1.3/1.4 仍 ready-for-dev，源契约必须一致 |
| 3 | excludeSources 未同步到 1.4/2.6 源契约 | （部分修复升级）| P1 | IGraphRepository 签名未变更，2.6 调用未更新 |
| 4 | rebuild warning 未同步到 2.5 scan CLI 源 | （部分修复升级）| P1 | 2.5 CLI 缺 `--force` 和检测逻辑预留 |

### 建议纳入后续改善跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|------------|------|
| 1 | Rule Document Registry 镜像未同步 updateStrategies | [中] | P2 | Task 1.4 已正式承接，Fix 阶段一并完成 |

### 可忽略（误报）

| # | 发现 | 原始严重性 | 忽略理由 |
|---|------|----------|---------|
| — | （无误报） | — | — |

### 评估决定

**整体结论**：需修订后再审

Epic 4 的本地 Story 修订已经稳定收敛，三个 P1 阻塞项可归纳为同一类问题：**共享源 Story 文档（1.3/1.4/2.5/2.6）需回写 Epic 4 引入的契约升级**。由于这些源 Story 均为 `ready-for-dev` 状态，未来的实施方会以源 Story spec 为权威，源契约不一致会导致实施返工和基线漂移。建议：(1) 直接修订 Story 1.3 增加 `status` 字段；(2) 修订 Story 1.4 增加 `status` 列、升级 `deleteRelationsByDocId` 签名；(3) 修订 Story 2.6 更新步骤 9a 调用；(4) 修订 Story 2.5 CLI 增加 `--force` option 和检测预留点。完成后进行第 4 轮复审。Rule Document Registry 镜像同步可在 Fix 阶段顺带完成。

---

## 修订执行记录

- **Date**: 2026-04-23
- **Model Used**: Claude Sonnet 4.6
- **Fix Items**: 4（P1×3 + P2×1）

#### 修订项 #1: status 模型同步到 Story 1.3 源契约（发现 #2，P1）

- **文件**: `_bmad-output/implementation-artifacts/stories/1-3-zod-validation-layer-and-core-type-definitions.md`
- **章节**: Dev Notes › RelationEdge 类型；Tasks › Task 2
- **修改摘要**:
  - `RelationEdge` 接口新增 `status: 'active' | 'deprecated'` 字段，注释说明默认 'active'，Story 4.1 引入
  - Task 2.2 描述补充 `status: z.enum(['active', 'deprecated']).default('active')` 字段说明
  - Task 2.3 描述澄清初始 7 项，`updateStrategies` 第 8 项由 Story 4.3 扩展
- **状态**: 已完成

#### 修订项 #2: status 列 + deleteRelationsByDocId 签名升级到 Story 1.4 源契约（发现 #2 + #3，P1）

- **文件**: `_bmad-output/implementation-artifacts/stories/1-4-sqlite-storage-layer-and-data-migration.md`
- **章节**: Dev Notes › IGraphRepository 接口设计；001-initial-schema.sql 核心表
- **修改摘要**:
  - `relations` 表 SQL 新增 `status TEXT NOT NULL DEFAULT 'active'` 列（Story 4.1 引入的状态位），并新增 `idx_relations_status` 索引
  - `IGraphRepository.deleteRelationsByDocId` 签名升级：加入 `options?: { excludeSources?: RelationSource[] }` 可选参数；注释说明 `excludeSources` 跳过指定来源边，Story 4.2 manual 保护机制依赖
- **状态**: 已完成

#### 修订项 #3: Story 2.6 步骤 9a 更新为 excludeSources 调用（发现 #3，P1）

- **文件**: `_bmad-output/implementation-artifacts/stories/2-6-incremental-scan-and-document-lifecycle-detection.md`
- **章节**: Dev Notes › 增量扫描流程（两阶段事务契约）阶段 2；架构约束
- **修改摘要**:
  - 步骤 9a 从 `repo.deleteRelationsByDocId(docId, 'source')` 更新为 `repo.deleteRelationsByDocId(docId, 'source', { excludeSources: ['manual'] })`，注释说明保留 manual 边（Story 4.2 依赖）
  - 架构约束新增 **excludeSources 依赖** 条目：说明步骤 9a 依赖 Story 1.4 接口已支持 `options?.excludeSources`，Story 4.2 Task 1.4 执行该接口升级
  - 将原 **v0.1 inbound preset 边约束** 更新措辞，明确"非-manual outgoing 关系边"
- **状态**: 已完成

#### 修订项 #4: Story 2.5 CLI 添加 --force option 和 manual 检测预留点（发现 #4，P1）

- **文件**: `_bmad-output/implementation-artifacts/stories/2-5-scanservice-cold-start-scan-and-graph-write.md`
- **章节**: AC；Tasks › Task 2；Dev Notes › CLI 薄壳模式
- **修改摘要**:
  - AC#10 补充 `--force` flag 说明：存在 manual 边时提示确认或使用 `--force` 跳过（实际检测逻辑由 Story 4.2 Task 3 实现，v0.1 接口预留）
  - Task 2.1 描述补充 `--force` 解析
  - CLI 薄壳代码块新增 `.option('--force', '跳过 manual 关系确认...')` 声明，并在 action 注释中标注 **[v0.1 manual 关系检测预留点]**（实际逻辑由 Story 4.2 Task 3 实现，ScanService.getManualRelationsCount() + CLI 交互）
- **状态**: 已完成

#### 修订项 #5（P2）: Rule Document Registry 三份规则文档同步 updateStrategies（发现 #1，P2）

- **文件**:
  - `_bmad-output/planning-artifacts/architecture/03-core-architectural-decisions.md`
  - `_bmad-output/project-context.md`
  - `_bmad-output/planning-artifacts/architecture/04-implementation-patterns-consistency-rules.md`
- **章节**: D6 配置管理（03、project-context）；新增 P17 配置字段规则（04）
- **修改摘要**:
  - `03-core-architectural-decisions.md` D6：配置项从"7 项"更新为"8 项"，补充 `updateStrategies`（Story 4.3 引入，键为 docType，值为 'auto' | 'suggest' | 'log_only'，缺省 suggest）
  - `project-context.md` D6：新增"配置字段基线（8 项）"条目，列出初始 7 项 + updateStrategies，并说明未知 key 宽容处理
  - `04-implementation-patterns-consistency-rules.md`：新增 **P17. CordConfig 配置字段重要规则**，含 8 字段表格 + `UpdateStrategy` 类型定义和未知 key 处理规则
- **状态**: 已完成

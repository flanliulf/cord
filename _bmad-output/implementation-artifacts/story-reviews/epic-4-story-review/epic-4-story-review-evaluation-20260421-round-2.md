---
Epic: 4
Scope: epic
Round: 2
Date: 2026-04-21
Model Used: Claude Opus 4.6 (claude-opus-4-dot-6)
Review Source: epic-4-story-review-summary-20260420-round-2.md
Review Model: GPT-5.4 (gpt-5.4)
Type: Story Review Evaluation
---

## 评估总结

本次对 GPT-5.4 第 2 轮复审结果的独立评估结论：审查质量持续稳定，6 条新发现中 **0 条误报**，4 条确认为 P1 阻塞项，2 条降级为 P2 后续改善项。5 条上轮修复项均已确认关闭。复审精准地识别出 round-1 修订的「本地闭合但共享契约未同步」问题——status 模型只在 4.1 本地成立但未落到 1.3/1.4 持久化层、excludeSources 只在 4.2 Dev Notes 提及但未正式升级 1.4 接口、rebuild warning 有设计但无任何 Story 正式接住——这些发现均为真实的跨 Story 契约断裂，已通过交叉验证确认。Finding #2（读侧 deprecated 语义缺失）是本轮最有价值的新发现，直接补完了 round-1 评估遗漏的下游影响链。

## 上轮问题回顾确认

### Round 1 / Finding #2 — removeRelation 与历史记录边界冲突：已确认修复

Story 4.1 AC#2 已明确 `removeRelation` 为"物理删除关系记录（硬删除），无历史保留"；AC#4 已收窄为"对保留中（status='active'）的关系记录修改历史"。Dev Notes 也清楚写出"FR21 的历史追溯仅对活跃关系有效，不覆盖 remove 路径"。AC、Tasks 与 Dev Notes 三层对齐，语义冲突已关闭。

### Round 1 / Finding #7 — 4.1 缺少对象入参与共享输入契约：已确认修复

Story 4.1 Dev Notes 已定义 `RemoveRelationInput { relationId: string }` 和 `DeprecateRelationInput { relationId: string }`，所有 RelationService 方法均使用对象入参。P11 合规问题已关闭。

### Round 1 / Finding #8 — 4.2 的 NFR9 口径过度暗示类型扩展实现：已确认修复

Story 4.2 AC#5 已改写为"本 Story 实现不破坏新增 relationType 时已有数据无需迁移即可正常查询的保证（NFR9 非回归验证）"。措辞准确描述为非回归约束而非功能交付，已关闭。

### Round 1 / Finding #9 — rename/move 场景下的策略解析限制未说明：已确认修复

Story 4.3 Dev Notes 已新增"v0.1 已知限制"段落，明确写出跨类别 rename/move 后策略可能使用旧类别、`--rebuild` 为缓解方案、并建议补充测试用例。已关闭。

### Round 1 / Finding #5 — 4.3 内部"自动触发 vs 只输出策略"冲突：已确认修复

Story 4.3 "So that" 已改为"影响分析结果能体现对应文档的更新策略元数据，支持后续编排决策（v0.1 仅返回策略，不自动触发同步执行）"。Dev Notes 有专门的"v0.1 交付边界裁决"段落。子 Story 内部边界已闭合。（注：父 Epic 未同步，本轮 Finding #5 另行跟踪。）

### 历史非阻塞待办

Round 1 评估中降级为 P2 的 3 条待办（#6 配置契约同步、#8 NFR9 AC 措辞、#9 rename/move 限制）已在本轮修订中全部闭合，不再需要跟踪。

## 发现 #1 评估

### 审查原文

> **[高] status 模型尚未同步到 1.3/1.4 的共享类型与持久化契约（上轮遗留）**
> - 来源：structure+consistency+contract
> - 分类：patch
> - 涉及 Story：4-1
> - 证据 - Story 4.1 已引入 `status: 'active' | 'deprecated'`，并要求 deprecated 保留原 `relationType`；但 Story 1.3 的 `RelationEdge` 仍无 status 字段，Story 1.4 的 `relations` 表仍无 status 列，Repository 接口与迁移脚本也没有承接这一模型。
> - 影响 - 手动 deprecated 状态无法形成稳定持久化契约，关系导出、查询和重启后的行为都可能退回到旧模型，round-1 对 Finding #1 的修复实际上没有真正闭合。
> - 建议 - 把 status 一次性同步到 Story 1.3 类型与 schema、Story 1.4 的 Repository 接口、relations 表 migration、mapper 与测试说明；不要只在 4.1 本地 Story 中描述新模型。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：基本准确 — 经验证，Story 1.3 的 `RelationEdge` 接口确实无 `status` 字段（仍为原始的 `id/sourceDocId/targetDocId/relationType/confidence/source/metadata/createdAt/updatedAt`）；Story 1.4 的 `relations` 表 SQL 也无 `status` 列；IGraphRepository 接口也未变更。不过需注意一个细微处：Story 4.1 Task 1.2 已写明"更新 Story 1.3 的 Zod schema 和 `IGraphRepository` 接口以支持 status 字段"，说明 4.1 的作者意识到了跨 Story 类型同步的需要，并将其列为正式任务。审查的核心论点仍然成立——Task 1.2 覆盖了类型层，但**缺少以下关键环节**：(1) 无迁移脚本任务（`relations` 表需新增 `status TEXT NOT NULL DEFAULT 'active'` 列）；(2) 无 mapper 层更新任务（SQLite row ↔ RelationEdge 映射）。
**严重性判断**：合理 — 缺少迁移脚本意味着已有数据库无法承载 `status` 字段，这直接影响 deprecated 功能的可用性。标为[高]恰当。
**修订建议**：可行 — 在 Story 4.1 Task 1 中补充迁移脚本子任务（如 `1.3 新增 migration 为 relations 表添加 status 列`）和 mapper 更新任务即可。是否需要同步修改 Story 1.3/1.4 的文档本身，取决于项目的 Story 文档更新策略——若 Epic 1 已实现，更合理的做法是在 4.1 中补充完整的迁移和映射任务，而不是回溯修改已完成 Story 的 spec。
**误报评估**：非误报 — 持久化层缺失已通过 SQL schema 和 IGraphRepository 接口完全确认。Task 1.2 的存在降低了风险但未消除迁移和映射的遗漏。

## 发现 #2 评估

### 审查原文

> **[高] QueryService 与 ImpactService 仍未定义 `status='deprecated'` 的读侧语义（新发现）**
> - 来源：consistency+contract
> - 分类：decision_needed
> - 涉及 Story：epic-4
> - 证据 - Story 3.1 的查询结果仍只包含目标路径、关系类型、置信度和来源，没有 status 字段或过滤规则；Story 3.3 仍只把 `relationType=deprecated` 映射为"已废弃，忽略"，没有定义 `status='deprecated'` 的关系在 traversal、输出和建议动作中该如何处理。
> - 影响 - 一个被手动 deprecated 的 `sync_required` 或 `references` 边，仍可能在 query / impact 中按活跃边返回。关系管理写侧和读侧会直接相互矛盾。
> - 建议 - 先裁决读侧规则：要么默认过滤 `status='deprecated'` 并提供 `includeDeprecated` 开关，要么显式返回 status 并规定查询/影响分析如何解释；随后同步更新 Story 3.1、Story 3.3 以及相应 CLI / JSON / MCP 契约。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 已验证 Story 3.1 QueryService 的查询结果和 Story 3.3 ImpactService 的传播行为映射表均无 `status` 字段的处理逻辑。特别是 Story 3.3 的映射表仍将 `relationType=deprecated`（关系类型枚举值）映射为"已废弃，忽略"，但对 `status='deprecated'`（状态标记）的 `sync_required` 或 `must_consistent` 关系没有任何规则。这意味着一条 `relationType=sync_required, status='deprecated'` 的关系会被 ImpactService 按活跃的 `sync_required` 处理，输出"需要同步更新 / critical"，完全与用户手动废弃该关系的意图矛盾。
**严重性判断**：合理 — 这是 status 模型引入后的**必然下游缺口**。round-1 聚焦于写侧数据模型，本轮精准地补完了读侧影响链。写侧 deprecated 但读侧仍当活跃处理，等于 deprecated 操作对用户来说没有实际效果。标为[高]恰当。
**修订建议**：可行 — 推荐"默认过滤 + `includeDeprecated` 开关"方案。理由：(1) 大多数查询/影响分析场景期望只看活跃关系；(2) 导出和管理场景需要看全量（含 deprecated）；(3) 这与行业标准的软删除读侧处理一致。具体影响：Story 3.1 需在 QueryInput 中增加可选 `includeDeprecated` 布尔字段并在查询后过滤；Story 3.3 同理。
**误报评估**：非误报 — 由 Story 3.1/3.3 的设计文档和 4.1 引入的 status 模型交叉验证确认，属于写侧-读侧契约断裂。

## 发现 #3 评估

### 审查原文

> **[高] excludeSources 删边修复仍未回写到 1.4 与 2.6 的源契约（上轮遗留）**
> - 来源：consistency+contract
> - 分类：patch
> - 涉及 Story：4-2
> - 证据 - Story 4.2 已要求把 `deleteRelationsByDocId(docId, 'source')` 改为带 `excludeSources: ['manual']` 的排除式删除；但 Story 2.6 的步骤 9a 仍是旧调用，Story 1.4 的 IGraphRepository 也仍只有旧签名。当前 manual 保护修复只停留在 4.2 自身文本。
> - 影响 - modified source 文档场景下的 manual outgoing 边保护仍没有真正闭合到共享执行契约，开发者仍可能按旧的删边接口落地。
> - 建议 - 将 `excludeSources` 明确同步到 Story 1.4 接口与 Story 2.6 步骤 9a，同时补出旧签名废弃或升级说明，避免"4.2 写了新规则，但 2.6 还在教旧做法"。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：基本准确 — 经验证，Story 1.4 IGraphRepository 的 `deleteRelationsByDocId` 签名仍为 `deleteRelationsByDocId(docId: string, direction?: 'source' | 'target' | 'both'): void`，无 `excludeSources` 参数；Story 2.6 步骤 9a 仍写 `repo.deleteRelationsByDocId(docId, 'source')`。不过需注意两个缓解因素：(1) Story 4.2 Task 1.2 已明确标注为"**覆盖 Story 2.6 删边契约**"，开发者阅读 4.2 时能获知覆盖意图；(2) Story 4.2 Dev Notes 已写明"IGraphRepository 的 `deleteRelationsByDocId` 操作需要支持 `excludeSources` 可选参数（Story 1.4 库层接口升级）"。审查的核心风险仍然成立——IGraphRepository 的接口变更是 Dev Notes 级别的提及而非正式 Task，开发者容易遗漏。
**严重性判断**：合理 — 接口签名变更是 API 契约级操作，Dev Notes 的非正式提及不足以保证执行。标为[高]恰当。
**修订建议**：可行 — 推荐在 Story 4.2 中将 IGraphRepository 接口升级提升为正式子任务（如 `Task 1.4: 升级 IGraphRepository.deleteRelationsByDocId 签名，新增可选 excludeSources 参数`）。对于 Story 2.6 文档本身，由于 4.2 Task 1.2 已标注为"覆盖"，可视为后续 Story 对早期 Story 的设计升级，不强制要求回溯修改 2.6 文档。
**误报评估**：非误报 — IGraphRepository 签名未变更和 Dev Notes 级别提及均为客观事实。4.2 部分意识到了问题但形式化程度不足。

## 发现 #4 评估

### 审查原文

> **[高] rebuild/manual warning 方案只有 Dev Notes 裁决，没有 AC、Tasks 和 CLI owner（上轮遗留）**
> - 来源：structure+consistency+contract
> - 分类：patch
> - 涉及 Story：4-2
> - 证据 - Story 4.2 已裁定：存在 manual 关系时，`--rebuild` 前必须警告并确认，或通过 `--force` 跳过；但 4.2 的 AC/Tasks 仍只覆盖增量扫描保护，Story 2.5 的 AC、Task 1.8 和 CLI 设计也仍是旧的无条件 `deleteAllDocuments()` + `--rebuild` / `--json` 模式。
> - 影响 - 当前 rebuild/manual 方案仍没有明确 owner，极易在实现阶段被遗漏，或被错误塞进 Service 层 / CLI 层任一侧，最终继续出现 manual 边被静默清空的风险。
> - 建议 - 明确把 warning / confirm / `--force` 的 owner 归到 Story 2.5 的 scan CLI 边界，或拆出单独 Story；至少要补齐 AC、Tasks、测试和 scan.ts 入口契约。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 已验证 Story 4.2 的 AC（#1-#7）全部聚焦在增量扫描保护逻辑上，没有任何 AC 涉及 rebuild 场景；Story 4.2 的 Tasks（1-3）也仅覆盖 ScanService 收敛逻辑和增量扫描测试。rebuild 的 warning/confirm/`--force` 行为仅存在于 Dev Notes 的"关键设计决策"段落中。同时 Story 2.5 的 CLI 设计（`scan.ts`）仍只有 `--rebuild` 和 `--json` 两个 option，无 `--force` 且无 manual 关系检测逻辑。
**严重性判断**：合理 — 一项功能如果只有 Dev Notes 描述而无 AC 和 Task 承接，在实现阶段被遗漏的概率极高。考虑到 manual 边被 rebuild 静默清空是数据丢失风险（D2 架构基线明确要求"用户手动添加的关系必须保留"），标为[高]完全恰当。
**修订建议**：可行 — 推荐将 warning 能力归属到 Story 4.2（因为 manual 保护的 domain knowledge 在这里），具体做法：(1) 新增 AC："Given rebuild When manual 关系存在 Then 警告并要求确认"；(2) 新增 Task："实现 rebuild 前 manual 关系检测与 `--force` 跳过确认"；(3) 在 Dev Notes 中明确 CLI 层为 owner（scan 命令添加 `--force` option）。若不想扩大 4.2 范围，也可拆为独立 Story。
**误报评估**：非误报 — AC/Task 缺失和 CLI 签名未变更均为直接可验证的文档事实。

## 发现 #5 评估

### 审查原文

> **[中] 父 Epic 仍保留修订前的旧验收口径（上轮遗留）**
> - 来源：structure+consistency
> - 分类：patch
> - 涉及 Story：epic-4
> - 证据 - 子 Story 已把 4.3 收敛为"只返回 updateStrategy 元数据，不自动执行同步"，但父 Epic 4 仍写"关键文档变更时自动触发同步"；同时父 Epic 的 4.1/4.2 也没有承接 remove/history 适用范围收窄与 modified source 文档 manual outgoing 边保护等修订结果。
> - 影响 - 父级验收源与子 Story 设计仍不一致，后续实现与验收会继续反复出现"到底按哪份文档为准"的争议。
> - 建议 - 把 round-1 已接受的边界裁决同步回 Epic 4 父文档，至少更新 4.1、4.2、4.3 的 Acceptance Criteria 与 So that 口径。

### 评估结论：⚠️ 有效但降级 — 建议纳入后续改善跟踪（P2）

### 评估分析

**问题描述准确性**：准确 — 已验证 Epic 4 父文档 Story 4.3 部分仍写"关键文档（如 PRD）变更时自动触发同步"，与子 Story 4.3 已收敛的 metadata-only 范围不一致。Epic 4 中 4.1/4.2 的 AC 也未反映 remove 硬删除语义、history 适用范围收窄和 modified source 文档保护等修订。
**严重性判断**：偏高 — 在 BMAD 工作流中，**子 Story spec 是开发的权威来源**，Epic 是规划级文档。开发者实现时以 Story spec 为准，不会因 Epic 的旧口径产生实现偏差。父 Epic 同步是文档卫生问题而非设计缺陷。降级至 P2。
**修订建议**：可行 — 将 round-1/round-2 的裁决结果同步到 Epic 4 父文档即可。建议在本轮 SR Fix 阶段顺带完成。
**误报评估**：非误报 — Epic 与 Story 的不一致是客观事实，但对实际开发的阻塞程度有限。

## 发现 #6 评估

### 审查原文

> **[中] `updateStrategies` 的规则文档同步任务仍漏掉 03 核心架构决策文档（上轮遗留）**
> - 来源：consistency+contract
> - 分类：patch
> - 涉及 Story：4-3
> - 证据 - Story 4.3 的 Task 1.4 只要求同步 `project-context.md` 和 `04-implementation-patterns-consistency-rules.md`；但 Rule Document Registry 明确还要求同步 `03-core-architectural-decisions.md`。当前任务仍未覆盖完整镜像集。
> - 影响 - `updateStrategies` 会继续处于"Story 已新增，但 03 仍按旧七字段模型描述配置基线"的漂移状态，后续代理读取不同规则文档时会看到不同边界。
> - 建议 - 将 `03-core-architectural-decisions.md` 显式加入 Task 1.4，并在 Dev Notes 里注明这是 Registry 的强制同步项，而不是可选补充。

### 评估结论：⚠️ 有效但降级 — 建议纳入后续改善跟踪（P2）

### 评估分析

**问题描述准确性**：准确 — 已验证 Story 4.3 Task 1.4 只列出了 `project-context.md` 和 `04-implementation-patterns-consistency-rules.md` 两个文档，而 Rule Document Registry（定义于 CLAUDE.md）明确要求三个文档同步：project-context.md、04-implementation-patterns-consistency-rules.md、**和 03-core-architectural-decisions.md**。遗漏第三个文档是事实。
**严重性判断**：合理 — 标为[中]恰当。这是 Task 清单的遗漏项，修复成本极低（在 Task 1.4 中添加一个文件名）。不构成设计级阻塞。
**修订建议**：可行 — 直接在 Task 1.4 中追加 `03-core-architectural-decisions.md` 即可。这是最小化的 patch 操作。
**误报评估**：非误报 — Rule Document Registry 的三文档同步要求与 Task 1.4 的两文档覆盖范围对比即可确认。

## 整体评估结论

### 需要修订（阻塞进入开发）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|------------|------|
| 1 | status 模型未同步到 1.3/1.4 持久化契约 | [高] | P1 | 缺迁移脚本和 mapper 任务 |
| 2 | Query/Impact 无 status='deprecated' 读侧语义 | [高] | P1 | 写侧-读侧契约断裂，deprecated 实际无效 |
| 3 | excludeSources 未正式升级为 1.4 接口 Task | [高] | P1 | Dev Notes 级提及不足以保证执行 |
| 4 | rebuild/manual warning 无 AC/Task/CLI owner | [高] | P1 | 数据丢失风险功能无正式承接 |

### 建议纳入后续改善跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|------------|------|
| 5 | 父 Epic 保留旧验收口径 | [中] | P2 | 文档卫生，子 Story 是开发权威来源 |
| 6 | Task 1.4 同步范围缺少 03 文档 | [中] | P2 | 追加一个文件名即可 |

### 可忽略（误报）

| # | 发现 | 原始严重性 | 忽略理由 |
|---|------|----------|---------|
| — | （无误报） | — | — |

### 评估决定

**整体结论**：需修订后再审

Epic 4 仍有 4 个 P1 级阻塞项。核心问题可归纳为两条主线：**(1) status 模型的闭合**——需补齐迁移脚本、mapper 任务，并裁决 QueryService/ImpactService 的读侧 deprecated 过滤规则；**(2) 跨 Story 契约的形式化**——将 excludeSources 接口升级和 rebuild warning 从 Dev Notes 提级为正式 Task，明确 owner。建议先完成这两条主线的修订，再进行第 3 轮复审。

## 修订执行记录

### 修订执行记录
- **Date**: 2026-04-21
- **Model Used**: Claude Sonnet 4.6
- **Fix Items**: 6（P1 × 4 + P2 × 2）

#### 修订项 #1: status 模型未同步到 1.3/1.4 持久化契约（发现#1）
- **文件**: `_bmad-output/implementation-artifacts/stories/4-1-relationservice-manual-add-and-remove-relations.md`
- **章节**: Tasks
- **修改摘要**:
  - Task 1 标题从"扩展 RelationEdge 类型定义"改为"扩展 RelationEdge 类型与持久化契约"
  - 新增 Task 1.3：新增数据库 migration，为 `relations` 表添加 `status TEXT NOT NULL DEFAULT 'active'` 列（兼容已有数据，存量记录默认 'active'）
  - 新增 Task 1.4：更新 SQLite row ↔ RelationEdge mapper，确保 status 字段读写正确映射
- **状态**: 已完成

#### 修订项 #2: QueryService 无 status='deprecated' 读侧语义（发现#2）
- **文件**: `_bmad-output/implementation-artifacts/stories/3-1-queryservice-relation-query-one-hop-and-type-filter.md`
- **章节**: AC、Tasks、Dev Notes
- **修改摘要**:
  - AC#2 在查询结果字段中补充 `status` 字段
  - 新增 AC#9：默认查询只返回 `status='active'` 的关系
  - 新增 AC#10：`--include-deprecated` flag 时同时返回 deprecated 关系
  - AC#11（原AC#9）更新测试要求，增加 deprecated 默认过滤和 `--include-deprecated` 可见场景
  - Tasks 改写：Task 1 增加 1.1/1.2 子任务（QueryInput 新增 `includeDeprecated` 字段，默认过滤 deprecated 关系）；Task 2 增加 2.1 子任务（CLI 新增 `--include-deprecated` flag）
  - Dev Notes 新增 QueryInput 类型定义（含 `includeDeprecated?: boolean`）和"deprecated 读侧语义裁决"说明段落
- **状态**: 已完成

#### 修订项 #3: ImpactService 无 status='deprecated' 读侧语义（发现#2）
- **文件**: `_bmad-output/implementation-artifacts/stories/3-3-impactservice-change-impact-analysis.md`
- **章节**: AC、Tasks、Dev Notes
- **修改摘要**:
  - 新增 AC#8：影响分析遍历时默认过滤 `status='deprecated'` 的关系，不计入影响路径
  - AC#9（原AC#8）测试要求补充"deprecated 关系不出现在影响结果中"场景
  - Tasks Task 1 增加 1.1 子任务（遍历时过滤 deprecated 关系）
  - Dev Notes 新增"deprecated 读侧语义裁决"段落，明确 ImpactService 默认过滤策略及与传播行为映射表 deprecated 行的关系
- **状态**: 已完成

#### 修订项 #4: excludeSources 接口升级未正式提级为 Task（发现#3）
- **文件**: `_bmad-output/implementation-artifacts/stories/4-2-convergence-protection-and-source-priority.md`
- **章节**: Tasks
- **修改摘要**:
  - Task 1 新增正式子任务 1.4：**升级 IGraphRepository 接口**，为 `deleteRelationsByDocId` 新增可选参数 `options?: { excludeSources?: RelationSource[] }`，明确这是正式接口变更（非 Dev Notes 提及），需同步更新 Story 1.4 的 repository 实现和接口签名
- **状态**: 已完成

#### 修订项 #5: rebuild/manual warning 无 AC/Task/CLI owner（发现#4）
- **文件**: `_bmad-output/implementation-artifacts/stories/4-2-convergence-protection-and-source-priority.md`
- **章节**: AC、Tasks、Dev Notes
- **修改摘要**:
  - 新增 AC#7：`cord scan --rebuild` 时若存在 manual 关系，必须输出警告并要求用户确认
  - 新增 AC#8：`cord scan --rebuild --force` 跳过确认，仍提示已删除 manual 关系数量
  - AC#9（原AC#7）测试要求补充 rebuild 警告确认和 `--force` 跳过场景
  - 新增 Task 3（完整实现 rebuild 前 manual 关系警告与确认）含 4 个子任务，明确 CLI owner 在 `src/cli/commands/scan.ts`
  - Task 4（原Task 3）补充 4.5/4.6 子测试
  - Dev Notes 在 rebuild 裁决段落末尾补充"CLI owner 明确"说明（ScanService 提供查询接口，CLI 层负责警告/确认逻辑）
- **状态**: 已完成

#### 修订项 #6: Task 1.4 同步范围缺少 03 架构决策文档（发现#6，P2）
- **文件**: `_bmad-output/implementation-artifacts/stories/4-3-document-category-update-strategy-config.md`
- **章节**: Tasks
- **修改摘要**:
  - Task 1.4 措辞从"同步更新规则文档（project-context.md 及 04-...）"改为"Rule Document Registry 强制同步三份：project-context.md、04-...  **及** 03-core-architectural-decisions.md"，并注明这是 Registry 的强制同步项
- **状态**: 已完成

#### 补充：Epic 4 父文档同步（发现#5，P2）
- **文件**: `_bmad-output/planning-artifacts/epics/epic-4关系管理与图谱修正.md`
- **章节**: Story 4.1/4.2/4.3 的 Acceptance Criteria + So that
- **修改摘要**:
  - Story 4.1 AC：补充 removeRelation（硬删除）与 deprecateRelation（status 状态位，保留 relationType）的语义区分；历史记录限定为 status='active' 关系
  - Story 4.2 AC：补充 source 文档修改后 manual outgoing 边保留、rebuild warning/confirm/--force 行为；NFR9 改为非回归验证措辞
  - Story 4.3 So that：从"关键文档变更时自动触发同步"改为"影响分析结果能体现策略元数据，v0.1 仅返回策略"；AC 对应更新为"体现对应文档的更新策略元数据（只读输出，v0.1 不自动执行编排）"
- **状态**: 已完成

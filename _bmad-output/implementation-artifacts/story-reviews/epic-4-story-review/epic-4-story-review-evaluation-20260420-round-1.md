---
Epic: 4
Scope: epic
Round: 1
Date: 2026-04-20
Model Used: Claude Opus 4.6 (claude-opus-4-dot-6)
Review Source: epic-4-story-review-summary-20260420-round-1.md
Review Model: GPT-5.4 (gpt-5.4)
Type: Story Review Evaluation
---

## 评估总结

本次对 GPT-5.4 首轮审查结果的独立评估结论：审查质量整体很高，9 条发现中 **0 条误报**，6 条确认为 P1 阻塞项，3 条降级为 P2 后续改善项。审查准确抓住了 Epic 4 最核心的三条主线问题——deprecated/remove 数据模型缺失、manual 保护与 2.6 删边流程断裂、rebuild 语义悬空——这些问题均已通过交叉验证确认为真实设计缺陷。Story 4.3 的"自动触发 vs 只输出策略"边界冲突和 P11 签名合规也属于必须修订的阻塞项。整体而言，Epic 4 当前不具备进入开发的条件，需先完成语义裁决和 Story 修订。

## 发现 #1 评估

### 审查原文

> **[高] 手动 deprecated 缺少可执行的抑制模型**
> - 来源：structure+consistency+contract
> - 分类：decision_needed
> - 涉及 Story：4-1、4-2
> - 证据 - Story 4.1 只定义了 `deprecateRelation()`，Story 4.2 又要求"手动标记为 deprecated 的关系不被自动恢复"；但共享契约里只有 `relationType`、`source` 和 `metadata`。若把 `relationType` 直接改成 `deprecated`，原始关系类型就丢失，后续 auto_scan 重新发现原关系时不会命中同一 `source+target+type`；若改用 `metadata` 标记，Story 1.3 和 Story 1.4 里又没有相应 schema 与持久化契约。
> - 影响 - FR22 的"手动标记为 deprecated 的关系不被自动恢复"当前没有稳定实现路径，也无法写出不依赖实现者主观补脑的验收测试。
> - 建议 - 在 Epic 4 中先统一 deprecated 的数据模型：要么引入 tombstone / suppressedRelationType 一类的显式抑制记录，要么定义保留原 relationType 的状态位模型；并同步改写 Story 4.1 的 Dev Notes、Story 4.2 的冲突规则和测试要求。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 经验证，Story 1.3 中 `deprecated` 确实是 9 种 `RelationType` 之一（枚举值），而非关系的状态标记。若 `deprecateRelation()` 将 `relationType` 改为 `deprecated`，原始类型信息丢失；Story 4.2 的收敛逻辑依赖 `source+target+type` 三元组做匹配，类型改变后 auto_scan 产生的原始类型关系将无法与 deprecated 记录匹配，保护逻辑失效。
**严重性判断**：合理 — 这是数据模型级缺陷，直接阻塞 FR22 的可执行性，标为[高]恰当。
**修订建议**：可行 — tombstone 机制或状态位模型均为成熟方案。建议优先采用状态位模型（如新增 `status: 'active' | 'deprecated'` 字段保留原 `relationType`），与现有 schema 的侵入性最小。
**误报评估**：非误报 — 通过阅读 Story 1.3 的 `RelationEdge` 定义和 `RELATION_TYPES` 枚举已完全确认。

## 发现 #2 评估

### 审查原文

> **[高] removeRelation 与可追溯历史记录契约相互冲突**
> - 来源：structure+contract
> - 分类：decision_needed
> - 涉及 Story：4-1
> - 证据 - Story 4.1 的 AC 要求"修改关系时检查历史"，Dev Notes 又把历史放到 `relation.metadata.history`；但 Task 1.2 同时把 `removeRelation()` 定义为删除关系。当前存储契约没有独立审计表或墓碑表，硬删除后就不存在可承载历史的 live relation。
> - 影响 - FR21 在 remove 路径上无法稳定满足；实现者要么静默放弃"删除也可追溯"，要么私自发明独立审计模型，导致实现分叉。
> - 建议 - 先做语义裁决：要么明确 remove 是不保留历史的硬删除，并把 FR21 收窄为对保留中的关系生效；要么为 remove 引入独立审计或墓碑记录，再同步更新 AC、Tasks 和测试口径。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：基本准确 — 审查的核心论点成立：`removeRelation()` 是硬删除，删除后 `metadata.history` 随之消亡，FR21 的历史追溯在 remove 路径上确实断裂。但需注意一个细微处：Story 4.1 AC#4 原文为"Given 修改关系 When 检查历史 Then 记录修改历史"，这里"修改"可以被解读为仅适用于 deprecate 等状态变更，不一定覆盖 remove。然而 FR21 的原文"记录关系的来源和修改历史"并未限定为仅活跃关系，语义边界确实需要裁决。
**严重性判断**：合理 — remove 语义（硬删除 vs 软删除 vs 审计记录）是数据模型的基础决策，未裁决会导致实现分叉。标为[高]恰当。
**修订建议**：可行 — 两种方案（收窄 FR21 适用范围 / 引入审计记录）均可行。结合发现 #1 的状态位模型，建议统一在一次数据模型设计中一并解决 deprecated 和 remove 的语义。
**误报评估**：非误报 — 确实存在语义歧义，需要显式裁决。

## 发现 #3 评估

### 审查原文

> **[高] 4.2 的 manual 保护与 2.6 的删边流程没有闭合**
> - 来源：structure+consistency+contract
> - 分类：decision_needed
> - 涉及 Story：4-2
> - 证据 - Story 4.2 只写了"增量扫描前获取 manual 来源关系"和"写入时跳过已有 manual 或 deprecated 关系"；但 Story 2.6 在 modified 文档事务内仍会先执行 `deleteRelationsByDocId(docId, 'source')`。对于 `sourceDoc` 正好被修改的 manual outgoing 边，冲突判定前就已被删除。
> - 影响 - FR22 的"手动添加的关系不被自动删除"在最常见的 modified 场景下不成立，用户刚修好的关系会在下一次增量扫描中被清掉。
> - 建议 - 在 Story 4.2 中明确替换 2.6 的删除契约：要么删除前排除 manual / manual-deprecated 边，要么先快照后同事务回放；同时新增一条"source 文档被修改时 manual outgoing 边仍保留"的测试要求。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 已验证 Story 2.6 的增量扫描流程步骤 9a 明确为 `repo.deleteRelationsByDocId(docId, 'source')`，该操作不区分 `source` 字段值（auto_scan/manual/framework_preset），会无差别删除所有 outgoing 边。而 Story 4.2 的 Task 1.1 是"增量扫描前获取所有 manual 来源关系"，Task 1.2 是"扫描写入时跳过"——但写入跳过发生在步骤 9b 的 INSERT 阶段，此时 manual 边已在步骤 9a 的 DELETE 阶段被清除。这是一个时序性的逻辑漏洞，非常致命。
**严重性判断**：合理，甚至可以上调至 P0 — 这是 FR22 核心保护需求在最常见场景（modified 文档）下的失效。用户修正的手动关系在下一次增量扫描后丢失，直接破坏产品核心价值。
**修订建议**：可行 — 审查建议的两种方案（排除式删除 / 快照回放）均为标准做法。推荐排除式方案：将 2.6 步骤 9a 改为 `deleteRelationsByDocId(docId, 'source', { excludeSources: ['manual'] })`，侵入性最小。
**误报评估**：非误报 — 通过 Story 2.6 的伪代码和 Story 4.2 的任务描述完全确认，属于 cross-Story 契约断裂。

## 发现 #4 评估

### 审查原文

> **[高] Epic 4 引入 manual 关系后，rebuild 边界仍未与上游契约统一**
> - 来源：contract
> - 分类：decision_needed
> - 涉及 Story：4-2、4-3、epic-4
> - 证据 - Story 2.5 明确 v0.1 的 `--rebuild` 通过 `deleteAllDocuments()` 级联清除全部关系和同步状态，并注明"v0.1 不保留 manual 边，Epic 4 再细化"；但 D2 / project-context 同时把"用户手动添加的关系必须保留"列为架构基线。Epic 4 当前 4.1-4.3 没有任何 Story 回收 rebuild 语义。
> - 影响 - 一旦 Epic 4 真正落地 manual 关系，一次 rebuild 就可能直接抹掉用户手工修正和历史记录；反过来，如果实现选择强行保留 manual，又会与 NFR18 的重建口径冲突。
> - 建议 - 在 Epic 4 内补一条显式决策并同步到架构文档：要么禁止存在 manual 数据时执行 rebuild，要么把 manual 修正存入独立层并在 rebuild 后回放，要么明确 NFR18 只约束自动发现图谱而不包含 manual 状态。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 已验证以下事实链：(1) Story 2.5 明确写有"v0.1 不保留 manual 边，Epic 4 再细化"；(2) D2 架构决策明确写有"用户手动添加的关系必须保留，排除按需重建方案"；(3) NFR18 要求"重建后图谱与全量扫描结果一致"。三者之间存在真实矛盾——D2 说必须保留 manual，NFR18 说重建结果要与全量扫描一致（全量扫描不产生 manual 边），Story 2.5 把决策踢给 Epic 4 但 Epic 4 未接住。
**严重性判断**：合理 — D2 是架构基线级决策，NFR18 是非功能性需求，二者冲突需要在 Story 设计阶段裁决而非留给开发者。标为[高]恰当。
**修订建议**：可行 — 审查提供的三种方案均有合理性。推荐方案三"NFR18 只约束自动发现图谱"配合"rebuild 前警告并备份 manual 边"，既保持 D2 的 manual 保留承诺，又不过度复杂化 rebuild 流程。
**误报评估**：非误报 — 已确认 Story 2.5 中有明确的延迟标记，而 Epic 4 的三个 Story 均未承接。

## 发现 #5 评估

### 审查原文

> **[高] 4.3 的"自动触发同步"需求与当前任务/输出契约不一致**
> - 来源：structure+consistency+contract
> - 分类：decision_needed
> - 涉及 Story：4-3
> - 证据 - Story 4.3 的业务目标是"关键文档变更时自动触发同步，而参考文档只记录不触发"，但 AC 和 Tasks 实际只覆盖三种策略配置以及"ImpactService 输出策略信息"。文档没有定义 `updateStrategy` 是纯展示字段、是否覆盖 Story 3.3 既有的 `suggestedAction`、还是会驱动后续 `sync_docs` 执行。
> - 影响 - 同一 Story 内部已经存在"自动执行"与"仅输出策略"的边界冲突。实现者无法判断本 Story 要交付的是一套决策元数据，还是带编排含义的自动行为。
> - 建议 - 先在 Story 4.3 中做边界裁决。若 v0.1 只返回策略不自动执行，就把 Story 目标改写为"影响分析结果体现策略"；若要自动执行，则应拆出独立 orchestration Story，并明确 owner 不在 CLI/MCP 薄壳层。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 已验证：Story 4.3 的 "So that" 子句写的是"关键文档变更时自动触发同步，而参考文档只记录不触发"，但 AC 只覆盖策略配置和 ImpactService 输出策略信息，没有任何与"自动触发"相关的任务或 AC。FR23 原文"用户可以按文档类别配置不同的更新策略（自动更新 / 生成建议后人工确认 / 仅记录不触发）"也只是配置能力，不是编排能力。Story 目标与交付内容之间确实存在断裂。
**严重性判断**：合理 — Story 的业务目标与实际 AC/Tasks 的范围不一致，这会导致验收标准模糊，开发者无法确定交付边界。标为[高]恰当。
**修订建议**：可行 — 审查建议的两条路径（收窄目标 / 拆出 orchestration Story）均为标准做法。考虑到 v0.1 的范围控制和 ImpactService 的只读特性，推荐收窄目标为"影响分析结果体现策略元数据"，将自动执行编排延至后续版本。
**误报评估**：非误报 — 同一 Story 内"So that"与 AC/Tasks 的不一致是直接可验证的文档矛盾。

## 发现 #6 评估

### 审查原文

> **[中] updateStrategies 只改 configSchema 会导致共享配置契约漂移**
> - 来源：consistency+contract
> - 分类：patch
> - 涉及 Story：4-3
> - 证据 - Story 4.3 的 Task 1 只写"扩展 `configSchema` 添加 `updateStrategies`"，但 Story 1.3 的 `CordConfig`、D6 和 project-context 仍都把全局配置口径定义为 7 项字段。文档也没有定义未知 key 的处理策略以及 Rule Document Registry 所要求的同步更新范围。
> - 影响 - `configSchema`、TypeScript 类型、`cord init` 模板和架构规则文档会立即分叉，后续实现容易只改一层不改共享契约。
> - 建议 - 在 Story 4.3 中补充对 `src/types/config.ts`、初始化模板和规则文档同步更新的任务，并写清 `updateStrategies` 的键域、默认值和未知 key 处理方式。

### 评估结论：⚠️ 有效但降级 — 建议纳入后续改善跟踪（P2）

### 评估分析

**问题描述准确性**：基本准确 — Story 4.3 Task 1 确实只提及 `configSchema` 扩展，未显式列出 TypeScript 类型、init 模板和规则文档的同步更新任务。不过需注意：若 Story 1.3 最终采用 P11 规范（TypeScript 类型由 Zod schema `z.infer` 推导），则 configSchema 的更新会自动同步到类型层，漂移风险主要存在于 init 模板和架构文档层面。
**严重性判断**：偏高 — 这本质上是一个 Story 任务完整性问题而非数据模型缺陷。补齐几个同步任务即可解决，不构成架构级阻塞。降级至 P2。
**修订建议**：可行 — 在 Story 4.3 的 Tasks 中补充"更新 CordConfig 类型定义"、"更新 cord init 模板"和"同步规则文档"即可。建议在修订 #5（4.3 边界裁决）时一并处理。
**误报评估**：非误报 — 任务遗漏是客观存在的，但影响程度有限。

## 发现 #7 评估

### 审查原文

> **[中] 4.1 缺少面向 Service/MCP 的共享输入契约**
> - 来源：consistency+contract
> - 分类：patch
> - 涉及 Story：4-1
> - 证据 - Story 4.1 的 RelationService 草图仍使用 `removeRelation(relationId: string)`、`deprecateRelation(relationId: string)` 等标量入参，也没有新增 add/remove/deprecate relation 的共享 Zod schema 或输入类型任务；但 P11 明确要求 Service 方法采用单对象入参与共享 schema，Story 5.2 又要求 MCP Tools 直接调用这些方法。
> - 影响 - 当前接口既不满足全局签名规范，也没有定义 `relationId` 与业务键之间的对外契约，MCP Tool 很容易被迫泄露存储层标识或在入口层拼装业务查找逻辑。
> - 建议 - 为 Story 4.1 补充共享输入 schema / type 任务，统一采用对象入参，并明确对外操作是基于 `relationId` 还是 `sourcePath + targetPath + relationType` 这组业务键。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 已验证 Story 4.1 Dev Notes 中 `removeRelation(relationId: string)` 和 `deprecateRelation(relationId: string)` 确实使用标量参数，直接违反 P11（"输入：单一对象参数，类型由 Zod schema 推导"）。同时 `addRelation` 虽然使用了 `AddRelationInput` 对象，但 remove 和 deprecate 未遵循同一规范。
**严重性判断**：偏低，应上调至 P1 — P11 是全局一致性规则，Dev Notes 作为实现指导直接违反了该规则，会误导开发者。且 Story 5.2 的 MCP Tool 层依赖这些接口签名，签名不规范会传播到 API 边界。这比"中"更严重。
**修订建议**：可行 — 将所有 RelationService 方法统一为对象入参（如 `RemoveRelationInput`、`DeprecateRelationInput`），同时明确操作键是 `relationId` 还是业务三元组。建议在修订 #1/#2（数据模型裁决）时一并处理。
**误报评估**：非误报 — P11 违规可直接对照代码和规则文档确认。

## 发现 #8 评估

### 审查原文

> **[中] 4.2 将 NFR9 挂为验收项，但当前任务并未承接关系类型扩展契约**
> - 来源：structure+consistency
> - 分类：patch
> - 涉及 Story：4-2
> - 证据 - Story 4.2 的 AC #5 要求"新增传播行为类型时已有数据无需迁移"，但 4.2 的任务只改 ScanService 收敛逻辑和来源优先级；与此同时 Story 1.3 与 project-context 仍把 `relationType` 定义为固定 9 类，不支持扩展新类型。
> - 影响 - AC #5 既没有对应实现任务，也没有与共享类型契约闭合，完成判定会变得主观。
> - 建议 - 要么把 NFR9 从 Story 4.2 挪回类型/存储演进相关 Story，要么在 4.2 中显式补齐 relationType 扩展契约、schema 和查询兼容任务。

### 评估结论：⚠️ 有效但降级 — 建议纳入后续改善跟踪（P2）

### 评估分析

**问题描述准确性**：基本准确 — AC#5 引用 NFR9 但无对应实现任务确实是事实。不过需要区分：NFR9 是一个**非功能性约束**（"新增类型时无需迁移"），而非一个需要主动实现的功能。作为 AC 出现时，其本意更可能是"验证当前实现不破坏 NFR9"（非回归约束），而非"在本 Story 中实现类型扩展"。
**严重性判断**：偏高 — 如果将 AC#5 理解为非回归验证约束，则它不需要独立实现任务，只需在测试中验证即可。Story 4.2 的收敛逻辑本身不引入新的关系类型，只是操作 source 优先级，因此 NFR9 在此处更像是一个"不破坏"保证。降级至 P2。
**修订建议**：可行 — 建议将 AC#5 的措辞改为"本 Story 实现不破坏 NFR9 的类型扩展性保证"，或将其移至更合适的 Story。无需为此补齐完整的类型扩展实现。
**误报评估**：非误报 — AC 与 Tasks 的闭合问题客观存在，但严重性可降级。

## 发现 #9 评估

### 审查原文

> **[中] 按文档类别应用更新策略会受到 2.6 path-only rename/move 限制影响**
> - 来源：consistency+contract
> - 分类：patch
> - 涉及 Story：4-3
> - 证据 - Story 4.3 的 `updateStrategies` 以 `prd`、`architecture`、`story` 等类别为键，但 Story 2.6 明确 v0.1 的 rename/move 仅更新 `documents.path`，不重算 `docType` 或路径敏感 preset 关系。4.3 没说明策略解析是依赖持久化 `docType`、当前 path 还是运行时重分类。
> - 影响 - 跨类别重命名或移动后，impact 结果可能继续使用过期策略，出现"文档已经变类，但策略仍按旧类执行"的假象。
> - 建议 - 在 Story 4.3 中明确 v0.1 的策略解析口径，并补一条 rename/move 场景测试；若暂不解决，应明确写出"需 rebuild 后策略才与类别一致"的限制。

### 评估结论：⚠️ 有效但降级 — 建议纳入后续改善跟踪（P2）

### 评估分析

**问题描述准确性**：准确 — 已验证 Story 2.6 明确写有 "v0.1 约束：仅更新 documents.path，不重算 docType 或 preset 关系"。Story 4.3 未说明策略解析使用的 docType 来源，确实存在跨类别 rename/move 后的策略失效风险。
**严重性判断**：合理 — 标为[中]恰当。这是 v0.1 已知限制的跨 Story 延伸影响，不是 Story 4.3 引入的新问题。跨类别 rename/move 在 v0.1 中本身就是一个"已知不完美"的场景（需 rebuild 修复），策略失效是该限制的自然推论。
**修订建议**：可行 — 在 Story 4.3 Dev Notes 中补充一条 v0.1 限制说明（"跨类别 rename/move 后需 rebuild 以刷新策略"）和一条 rename 场景的边界测试即可。侵入性很小。
**误报评估**：非误报 — 策略解析口径确实未指定，但属于已知限制的附带影响，不需要作为阻塞项。

## 整体评估结论

### 需要修订（阻塞进入开发）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|------------|------|
| 1 | 手动 deprecated 缺少可执行的抑制模型 | [高] | P1 | 数据模型缺失，FR22 不可执行 |
| 2 | removeRelation 与可追溯历史记录契约相互冲突 | [高] | P1 | remove 语义未裁决，FR21 边界模糊 |
| 3 | 4.2 的 manual 保护与 2.6 的删边流程没有闭合 | [高] | P1 | modified 场景下保护逻辑失效 |
| 4 | Epic 4 引入 manual 关系后 rebuild 边界未统一 | [高] | P1 | D2 与 NFR18 冲突未解决 |
| 5 | 4.3 自动触发同步与任务/输出契约不一致 | [高] | P1 | Story 目标与 AC/Tasks 断裂 |
| 7 | 4.1 缺少面向 Service/MCP 的共享输入契约 | [中] | P1 | 直接违反 P11 全局规则 |

### 建议纳入后续改善跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|------------|------|
| 6 | updateStrategies 共享配置契约漂移 | [中] | P2 | 补齐同步任务即可，修订 #5 时顺带处理 |
| 8 | NFR9 AC 与任务未闭合 | [中] | P2 | 改为非回归约束措辞即可 |
| 9 | rename/move 场景策略解析口径未明确 | [中] | P2 | v0.1 已知限制的延伸，补声明即可 |

### 可忽略（误报）

| # | 发现 | 原始严重性 | 忽略理由 |
|---|------|----------|---------|
| — | （无误报） | — | — |

### 评估决定

**整体结论**：需修订后再审

Epic 4 存在 6 个 P1 级阻塞项，核心问题集中在：(1) deprecated/remove/history 数据模型需要先做一次统一的语义裁决；(2) Story 4.2 与 Story 2.6 的删边-保护时序必须闭合；(3) rebuild 的 manual 关系处理策略需要在 D2/NFR18 之间做出明确取舍；(4) Story 4.3 的交付边界需收窄到策略元数据。建议先完成数据模型和语义裁决，再修订三个 Story 文档，最后执行复审。

## 修订执行记录

### 修订执行记录
- **Date**: 2026-04-20
- **Model Used**: Claude Sonnet 4.6
- **Fix Items**: 9（P1 × 6 + P2 × 3）

#### 修订项 #1: 手动 deprecated 缺少可执行的抑制模型（发现#1）
- **文件**: `_bmad-output/implementation-artifacts/stories/4-1-relationservice-manual-add-and-remove-relations.md`
- **章节**: AC、Tasks、Dev Notes
- **修改摘要**:
  - AC#2 拆分 removeRelation（硬删除）与 deprecateRelation（保留原 relationType + 新增 status 字段）的语义
  - AC#4 明确历史记录仅对 status='active' 关系有效，remove 路径不保留历史
  - AC#8 新增"deprecated 状态保留原 relationType 验证"的测试要求
  - Tasks 新增 Task 1（扩展 RelationEdge 类型定义），增加状态位字段 `status: 'active' | 'deprecated'`
  - Dev Notes 新增"RelationEdge 状态位模型"章节，说明 deprecated 不改变 relationType 字段
- **状态**: 已完成

#### 修订项 #2: removeRelation 与可追溯历史记录契约相互冲突（发现#2）
- **文件**: `_bmad-output/implementation-artifacts/stories/4-1-relationservice-manual-add-and-remove-relations.md`
- **章节**: AC#4、Dev Notes
- **修改摘要**:
  - AC#4 措辞修改为"对**保留中**（status='active'）的关系记录修改历史；removeRelation 为硬删除，不保留历史记录"
  - Dev Notes 新增"remove 语义裁决"章节，明确 FR21 历史追溯的适用范围，并说明未来审计能力的演进路径
- **状态**: 已完成

#### 修订项 #3: 4.1 缺少面向 Service/MCP 的共享输入契约（发现#7，P11 违反）
- **文件**: `_bmad-output/implementation-artifacts/stories/4-1-relationservice-manual-add-and-remove-relations.md`
- **章节**: Tasks、Dev Notes
- **修改摘要**:
  - Tasks 2.2/2.3 明确使用 `RemoveRelationInput`、`DeprecateRelationInput` 对象入参
  - Dev Notes RelationService 设计代码示例统一为对象入参格式，移除标量参数 `(relationId: string)`
  - 新增 `RemoveRelationInput` 和 `DeprecateRelationInput` 接口定义
- **状态**: 已完成

#### 修订项 #4: 4.2 的 manual 保护与 2.6 的删边流程没有闭合（发现#3）
- **文件**: `_bmad-output/implementation-artifacts/stories/4-2-convergence-protection-and-source-priority.md`
- **章节**: AC、Tasks、Dev Notes
- **修改摘要**:
  - AC 新增条目#6："source 文档被修改时 manual outgoing 边仍然保留，不被删除"
  - AC#7 测试要求新增"source 文档修改后 manual 边保留"场景
  - Task 1.2 明确：覆盖 Story 2.6 删边契约，改为 `deleteRelationsByDocId(docId, 'source', { excludeSources: ['manual'] })`，修改地点在 scan-service.ts
  - Task 3.4 新增测试"source 文档被修改时，manual outgoing 边不被删除"
  - Dev Notes 新增"关键设计决策：manual 保护时序修复"章节，包含伪代码对比和 IGraphRepository 接口升级说明
- **状态**: 已完成

#### 修订项 #5: Epic 4 引入 manual 关系后 rebuild 边界仍未与上游契约统一（发现#4）
- **文件**: `_bmad-output/implementation-artifacts/stories/4-2-convergence-protection-and-source-priority.md`
- **章节**: Dev Notes
- **修改摘要**:
  - Dev Notes 新增"关键设计决策：rebuild 与 manual 边的处理方案"章节
  - 明确裁决：NFR18 仅约束自动发现的关系图谱，不包含 manual 状态（解决 D2 与 NFR18 的冲突）
  - 明确 rebuild 前警告行为：检测到 manual 边时输出警告并要求用户确认
  - 说明 manual 关系备份/回放属于后续版本范畴
- **状态**: 已完成

#### 修订项 #6: 4.3 的"自动触发同步"需求与当前任务/输出契约不一致（发现#5）
- **文件**: `_bmad-output/implementation-artifacts/stories/4-3-document-category-update-strategy-config.md`
- **章节**: Story（So that 子句）、Dev Notes
- **修改摘要**:
  - Story "So that" 子句从"关键文档变更时自动触发同步"改写为"影响分析结果能体现对应文档的更新策略元数据，支持后续编排决策（v0.1 仅返回策略，不自动触发同步执行）"
  - Dev Notes 新增"v0.1 交付边界裁决"章节，明确 ImpactService 只输出策略元数据，不实现 orchestration
- **状态**: 已完成

#### 修订项 #7: updateStrategies 只改 configSchema 会导致共享配置契约漂移（发现#6，P2）
- **文件**: `_bmad-output/implementation-artifacts/stories/4-3-document-category-update-strategy-config.md`
- **章节**: Tasks、Dev Notes
- **修改摘要**:
  - Task 1 拆分为 4 个子任务：configSchema 扩展、CordConfig 类型同步、cord init 模板更新、规则文档同步
  - Dev Notes 补充 `updateStrategies` 字段规范（键域、未知 key 处理、缺省值语义）
- **状态**: 已完成

#### 修订项 #8: 4.2 将 NFR9 挂为验收项但当前任务并未承接关系类型扩展契约（发现#8，P2）
- **文件**: `_bmad-output/implementation-artifacts/stories/4-2-convergence-protection-and-source-priority.md`
- **章节**: AC#5
- **修改摘要**:
  - AC#5 措辞从"已有数据无需迁移（NFR9）"改为"本 Story 实现不破坏新增 relationType 时已有数据无需迁移即可正常查询的保证（NFR9 非回归验证）"，明确为非回归约束而非独立功能实现
- **状态**: 已完成

#### 修订项 #9: 按文档类别应用更新策略会受到 2.6 path-only rename/move 限制影响（发现#9，P2）
- **文件**: `_bmad-output/implementation-artifacts/stories/4-3-document-category-update-strategy-config.md`
- **章节**: Dev Notes
- **修改摘要**:
  - Dev Notes 新增"v0.1 已知限制：跨类别 rename/move 后策略可能使用旧类别"章节
  - 说明 Story 2.6 的 path-only 更新约束导致 docType 不重算，以及 `--rebuild` 作为缓解方案
  - 建议补充 rename/move 场景的边界测试用例
- **状态**: 已完成

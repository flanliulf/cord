---
Epic: 2
Scope: epic
Round: 5
Date: 2026-04-16
Model Used: Claude Opus 4.6 (github-copilot)
Review Source: epic-2-story-review-summary-20260416-round-5.md
Review Model: GPT-5.4 (github-copilot)
Type: Story Review Evaluation
---

## 评估总结

Round 5 审查质量延续了 Round 4 的高水准，审查者已从表层矛盾收敛到"跨 Story 共享契约的端到端可执行性"这一更深层面。5 条发现中 3 条确认为 P1 阻塞项，1 条降级为 P2（IDE preset provider），1 条降级为 P2（inbound preset 边刷新）。本轮无误报。审查者对阻塞点的收敛判断基本准确，但对 IDE preset provider 和 inbound preset 边问题的严重性存在过度评估——前者可通过 v0.1 范围约束安全延迟，后者在 preset 规则语义框架下影响面有限。Epic 2 仍需修订后再审，但阻塞面已进一步收窄。

## 上轮问题回顾确认

### R4 #3 Epic/Story 来源口径漂移：已确认修复

审查者确认 Epic 2 中 Story 2.5 的 AC 已同步为 `auto_scan` + `framework_preset` 双来源。交叉核对 Epic 2 文档，Story 2.5 AC 原文为"scan rule 产出的关系来源标记为 `auto_scan`，adapter preset rule 产出的关系来源标记为 `framework_preset`（FR21 + RelationSource 三值契约）"。修复到位。

### R4 #5 deleteRelationsByDocId 无方向双向删边：已确认修复

审查者确认 Story 1.4 `deleteRelationsByDocId()` 已加入 `direction` 参数，Story 2.6 步骤 9a 已改为 `deleteRelationsByDocId(docId, 'source')`。交叉核对两份文档：Story 1.4 接口现为 `deleteRelationsByDocId(docId: string, direction?: 'source' | 'target' | 'both'): void`，注释明确写"增量扫描重建 modified 文档关系时使用 'source'"；Story 2.6 步骤 9a 为"repo.deleteRelationsByDocId(docId, 'source') 仅删除 outgoing 关系边"。修复到位。

### R4 #1 effectiveScanPaths owner/时序（遗留）：确认部分改善，仍未完全闭合

审查者判断正确——ScanService 已接手主 owner（Story 2.5 步骤 2b 已加入 `computeEffectiveScanPaths`），但 Story 2.4 仍保留旧时序描述，Story 2.6 增量入口仍未同步。已转入本轮 Finding #1。

### R4 #2 relationTypes 共享契约（遗留）：确认 schema 层已修复，执行链仍缺

审查者判断正确——Story 1.3 `CordConfig.relationTypes` 类型签名已收敛为 `Partial<Record<RelationType, { enabled: boolean }>>`，但 Story 2.4/D6 旧口径和 Story 2.5 执行链仍未跟上。已转入本轮 Finding #3。

### R4 #6 SyncState 写回（遗留）：确认字段表面补齐，数据来源仍缺

审查者判断正确——Story 2.6 步骤 11 已写出完整字段，但 renamed/moved 分支的数据来源仍有缺口。已转入本轮 Finding #4。

### 历史非阻塞待办

1. **R4 #4 rebuild 与 D2 措辞冲突**：继续维持 P2。D2 语境为迁移策略，不约束 scan rebuild（Round 4 评估已降级）。
2. **contentHash 预计算成本**：Story 2.6 无变更快返仍在早退前全量计算 contentHash。继续维持 P2。
3. **rename/delete AC 旧措辞**：继续维持非阻塞文案债务。

## 发现 #1 评估

### 审查原文

> **[高][上轮遗留] `effectiveScanPaths` 契约仍未在冷启动与增量路径中完全闭合**
> - 来源：structure+consistency+contract
> - 分类：patch
> - 涉及 Story：2-1、2-4、2-5、2-6
> - 证据 - Story 2.5 主流程已经加入 `computeEffectiveScanPaths` 并前移到 `discoverDocuments` 之前，Story 2.1 的 `discoverDocuments` 也已改成接收预计算路径；但 Story 2.4 仍保留"位于 Story 2.5 步骤 3 之后"的旧时序说明，Story 2.5 的两阶段事务阶段 1 仍未把 `computeEffectiveScanPaths` 纳入阶段列表，Story 2.6 的阶段 1 又仍沿用旧的无参 `discoverDocuments()` 入口。
> - 影响 - `effectiveScanPaths` 已经基本有 owner，但还没有形成贯穿冷启动与增量路径的单一入口契约。2.3 的 glob 护栏因此仍没有完全稳定的落点。
> - 建议 - 把 Story 2.4、2.5、2.6 全部统一到同一个时序。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 交叉核对确认：(1) Story 2.5 主流程步骤 2b 已有 `computeEffectiveScanPaths(config, adapter)`，步骤 3 已改为 `adapter.discoverDocuments(projectRoot, scanPaths, excludePaths)`；(2) Story 2.1 接口已改为 `discoverDocuments(projectRoot: string, scanPaths: string[], excludePaths: string[]): string[]`；(3) Story 2.4 Dev Notes 仍写"effectiveScanPaths 的计算逻辑位于 ScanService.scan() 方法中（**Story 2.5 步骤 3 之后**）"——与实际步骤 2b（步骤 3 之前）矛盾；(4) Story 2.5 两阶段事务"阶段 1"列表仍写"loadConfig、resolveAdapter、discoverDocuments"，未纳入 `computeEffectiveScanPaths`；(5) Story 2.6 阶段 1 步骤 1 仍写 `adapter.discoverDocuments() → 当前文件路径`，未接入预计算路径。

**严重性判断**：合理 — 三处残留不一致会导致增量路径与冷启动路径使用不同的文件发现入口，直接影响结果等价性承诺。

**修订建议**：可行 — 三处文本同步即可，无需重新设计。

**误报评估**：非误报 — 三处文本不一致均可从文档直接验证。

## 发现 #2 评估

### 审查原文

> **[高][新] IDE preset 路径支持仍依赖一个当前 Epic 中不存在的 provider 契约**
> - 来源：consistency+contract
> - 分类：decision_needed
> - 涉及 Story：2-4、2-5
> - 证据 - Story 2.4 现在要求在 `config.ide` 存在时，通过 IDE adapter 的 `getScanPaths()` / `getExcludePaths()` 追加 IDE preset 路径；但 Story 2.5 的 `computeEffectiveScanPaths(config, adapter)` 仍只接收 framework adapter，当前 Epic 中也没有定义对应的 IDE preset provider。
> - 影响 - FR40 中的 IDE preset 路径在 Epic 2 当前范围内仍没有可执行的提供方。
> - 建议 - 在 Epic 2 内做一次显式设计决策。

### 评估结论：⚠️ 有效但降级 — 建议纳入后续改善跟踪（P2）

### 评估分析

**问题描述准确性**：准确 — 交叉核对确认：Story 2.4 effectiveScanPaths 公式第 3 步写"IDE 预设追加：`config.ide` 已配置时，通过对应 IDE adapter 的 `getScanPaths(config)` 追加 IDE 特定路径"；Story 2.5 `computeEffectiveScanPaths(config, adapter)` 签名仅接收单个 framework adapter。Epic 2 的 6 个 Story（2.1-2.6）确实不包含 IDE adapter 的定义和实现。架构 D5 中 IDE adapter 目录（`src/adapters/ide/`）存在但实现在 Epic 5 范畴。

**严重性判断**：偏高 — 审查者将此标记为 [高] 并建议在 Epic 2 内做设计决策，但这忽略了两个关键事实：(1) Story 2.4 公式第 3 步已显式写明 "`config.ide` 未配置时**跳过此步骤**"，这意味着当 IDE 未配置时（v0.1 默认场景），路径计算链路完全闭合且可执行；(2) FR40 的原文是"支持已支持框架和 IDE 的预设文档路径配置"，这是渐进式能力——v0.1 支持 framework preset 已满足核心需求，IDE preset 可随 Epic 5 IDE adapter 实现后自然接入。当前 Story 2.4 的"跳过"分支设计已为此预留了清晰的扩展点，不构成硬阻塞。

**修订建议**：可行但非必要 — 建议在 Story 2.4 or 2.5 添加一句明确注释"v0.1 暂不实现 IDE preset 路径，`config.ide` 为空时自动跳过"即可，无需在 Epic 2 内新增 provider 契约或做设计决策。

**误报评估**：非误报 — 契约确实不完整，但在 v0.1 `config.ide` 默认为空的约束下不构成可执行性风险。

## 发现 #3 评估

### 审查原文

> **[高][上轮遗留] `relationTypes` 仍未形成端到端可执行契约**
> - 来源：consistency+contract
> - 分类：patch
> - 涉及 Story：1-3、2-4、2-5
> - 证据 - Story 1.3 的 `CordConfig.relationTypes` 已收敛为固定 9 类关系的启用/禁用 schema，但 Story 2.4 仍保留过期的"当前仍是 `Record<string, unknown>`、属于 Epic 1 范围"的说明，架构 D6 也仍写成"自定义关系类型扩展"。与此同时，Story 2.5 的主流程与任务仍没有任何一步去对两类关系统一应用 `relationTypes` enabled/disabled 过滤。
> - 影响 - relationTypes 目前仍停留在"schema 部分修好了，但 Story 文案和执行链都没完全跟上"。
> - 建议 - 删除过期说明，同步修正架构 D6 旧口径，并在 Story 2.5 中增加统一过滤阶段。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 交叉核对确认三处残留：(1) Story 1.3 `CordConfig.relationTypes` 已修为 `Partial<Record<RelationType, { enabled: boolean }>>`，注释写"已有 9 类关系的启用/禁用配置（不支持扩展新类型），与 Story 2.4 的 relationTypes 语义对齐"——schema 层已修复；(2) Story 2.4 Dev Notes 仍保留"⚠️ **超出范围**：Story 1.3 中 `CordConfig.relationTypes` 的 TypeScript 类型签名（当前为 `Record<string, unknown>`）需同步收敛为明确的启用/禁用 schema，该修订属于 Epic 1 范围"——这段描述已过期，因为 1.3 已经修了；(3) 架构 D6 配置项说明仍写"relationTypes（自定义关系类型扩展）"——与固定 9 类启停语义矛盾；(4) Story 2.5 主流程 9 步中无 relationTypes 过滤步骤，Task 列表也无对应任务。

**严重性判断**：合理 — 过期文案会误导实现者回退到旧设计；缺少执行过滤步骤意味着禁用的关系类型仍会进入写入计划，属于 AC 不可测。

**修订建议**：可行 — 三处文案删改 + 在 Story 2.5 步骤 7（merge/dedupe）之后增加步骤 7c（filter by relationTypes enabled/disabled）。

**误报评估**：非误报 — 三处文案残留和执行链缺口均可从文档直接验证。

## 发现 #4 评估

### 审查原文

> **[高][上轮遗留] Story 2.6 的 renamed/moved `SyncState` 写回仍缺少真实数据来源**
> - 来源：structure+consistency+contract
> - 分类：patch
> - 涉及 Story：2-6、1-4
> - 证据 - Round 4 已把步骤 11 改成写完整 `SyncState`，但 Story 2.6 当前定义的 `StoredDocRecord` 不含 `status`，`LifecycleResult.renamed/moved` 也不携带 `current/stored` 绑定；步骤 11 却仍引用 `stored.status` 和 `current.mtimeMs`。
> - 影响 - renamed/moved 分支仍无法仅凭当前契约稳定生成满足 Story 1.4 的完整 `SyncState`。
> - 建议 - 扩展 `StoredDocRecord` / `LifecycleResult` 以携带写回所需字段，或在阶段 1 显式组装完整写计划。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 交叉核对确认：(1) Story 2.6 `StoredDocRecord` 接口定义为 `{ docId, path, contentHash, lastObservedMtimeMs }`——确实不含 `status`；(2) `LifecycleResult.renamed/moved` 载荷为 `{ oldPath, newPath, docId }[]`——不携带 `current` 文件快照或 `stored` 记录的引用；(3) 步骤 11 renamed/moved 分支写 `upsertSyncState({ ..., contentHash: stored.contentHash, status: stored.status })`——引用了 `stored.status`，但这个字段在 `StoredDocRecord` 中不存在；(4) 步骤 11 还引用 `current.mtimeMs`，但 `LifecycleResult.renamed` 不携带当前文件的 `mtimeMs`。

**严重性判断**：合理 — 步骤 11 引用了数据模型中不存在的字段，实现者必须私自扩展接口或猜测数据来源。这是接口契约缺口，属于 AC 不可测。

**修订建议**：可行 — 推荐方案：(1) 在 `StoredDocRecord` 中增加 `status` 字段；(2) 在 `LifecycleResult.renamed/moved` 载荷中增加 `currentMtimeMs` 字段，或在阶段 1 步骤 4 之后为 renamed/moved 显式收集当前文件 mtimeMs。

**误报评估**：非误报 — 字段引用与数据模型的不匹配可从文档文本直接验证。

## 发现 #5 评估

### 审查原文

> **[高][新] `source` 定向删边并不能保证所有 inbound `framework_preset` 边被正确刷新**
> - 来源：consistency+contract
> - 分类：patch
> - 涉及 Story：2-5、2-6
> - 证据 - Story 2.6 现在只对 modified/added 文档复用冷启动构建子链路，并在步骤 9a 仅删除 modified 文档作为 `source` 的 outgoing 边；但 Story 2.5 的 `preset merge` 仍没有声明所有 `framework_preset` 关系都必须以当前重建文档为 source。预设示例中仍存在 `Epic -> Story` 这类天然 inbound 边场景。
> - 影响 - 如果某个 modified 文档的类型变化会影响来自未修改文档的 preset 边，当前增量写集仍不会重算这些 inbound preset relations。
> - 建议 - 二选一闭合：显式约束 preset 规则只生成以当前重建文档为 source 的边；或在 Story 2.6 中补入"受影响的 inbound preset 边也要进入重算集"。

### 评估结论：⚠️ 有效但降级 — 建议纳入后续改善跟踪（P2）

### 评估分析

**问题描述准确性**：基本准确 — 审查者正确识别了 preset 边方向性问题。但需要区分两种场景：

**场景 A（审查者关注）**：文档 A（Epic 类型）未修改，文档 B（Story 类型）被修改。preset 规则 `Epic -> Story (contains)` 生成的 A→B 边。增量扫描只重建 B 的 outgoing 边，不会重算 A→B 这条 inbound preset 边——但这恰恰不是问题，因为：
- Step 9a 只删除 B 作为 source 的边（B→* 边），不删除 A→B 边
- Step 5 对 B 执行完整构建子链路时，preset merge 会根据 B 的 docType 匹配规则生成 B 作为 source 的 preset 边
- A→B 边不被删除、也不被重建，它保持原样——这与冷启动结果一致（因为 A 内容未变，A 的 docType 未变，preset 规则生成的 A→B 边应该相同）

**场景 B（真正的风险）**：文档 B 被修改后其 docType 发生变化（如从 Story 变为 architecture），此时 A→B 的 `contains` 边应该被替换为 `context_for` 边。当前增量路径确实不会处理这种情况。但这是一个极端边缘场景——docType 由框架 glob 模式决定，通常与文件名/路径相关而非内容相关，内容修改几乎不会改变 docType。

**严重性判断**：偏高 — 场景 B 虽然理论成立，但在实际使用中几乎不会发生（docType 由文件名模式决定，不随内容变化）。且 `cord scan --rebuild` 可随时修复此类极端不一致。建议从 P1 降为 P2。

**修订建议**：可行但非必要 — 在 Story 2.5 或 2.6 添加一句注释"v0.1 增量扫描假设 modified 文档的 docType 不变化；若 docType 变化导致 preset 边不一致，可通过 --rebuild 修复"即可。完整解决方案可在后续版本中处理。

**误报评估**：非误报 — 理论上存在不等价风险，但实际影响极为有限，不应阻塞开发。

## 整体评估结论

### 需要修订（阻塞进入开发）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|------------|------|
| 1 | effectiveScanPaths 冷启动/增量入口残留不一致 | [高] | P1 | 三处文本同步即可修复 |
| 3 | relationTypes 过期文案 + 执行链无过滤步骤 | [高] | P1 | 删旧文案 + 补步骤 7c |
| 4 | renamed/moved SyncState 写回数据来源缺口 | [高] | P1 | 扩展 StoredDocRecord/LifecycleResult |

### 建议纳入后续改善跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|------------|------|
| 2 | IDE preset provider 当前 Epic 缺失 | [高] | P2 | config.ide 为空时跳过，v0.1 不阻塞 |
| 5 | inbound preset 边增量刷新不完整 | [高] | P2 | docType 由文件名决定，实际不变 |

### 可忽略（误报）

无。

### 评估决定

**整体结论**：需修订后再审

本轮 P1 阻塞项已收窄至 3 条，且均为文本同步/字段补齐类修订，不涉及架构重新设计。建议按以下顺序执行：(1) 统一 2.4/2.5/2.6 的 effectiveScanPaths 时序和入口（#1）→ (2) 清理 2.4/D6 的 relationTypes 旧口径并在 2.5 补过滤步骤（#3）→ (3) 扩展 StoredDocRecord/LifecycleResult 数据模型闭合 SyncState 写回（#4）→ (4) 可选：添加 IDE preset 和 inbound preset 边的 v0.1 范围注释（#2, #5）。完成后提交第 6 轮复审。

---

## 修订执行记录

- **执行日期**：2026-04-16
- **执行模型**：Claude Sonnet 4.6 (github-copilot)
- **执行范围**：发现 #1、#3、#4（全部 P1 项）；发现 #2、#5 跳过（P2，非阻塞）

### 发现 #1 修订（effectiveScanPaths 时序同步）

| 编号 | 文件 | 修改内容 |
|------|------|----------|
| A1 | `stories/2-4-config-loading-and-document-scope.md` | Dev Notes 设计决策说明：`步骤 3 之后` → `步骤 2b，步骤 3 之前` |
| A2 | `stories/2-5-scanservice-cold-start-scan-and-graph-write.md` | 两阶段事务阶段 1 列表：新增 `computeEffectiveScanPaths` 到 `resolveAdapter` 与 `discoverDocuments` 之间 |
| A3 | `stories/2-6-incremental-scan-and-document-lifecycle-detection.md` | 增量阶段 1 步骤 1：`adapter.discoverDocuments()` → `discoverDocuments(effectiveScanPaths, excludePaths)` |

### 发现 #3 修订（relationTypes 过期文案清理 + 执行链补全）

| 编号 | 文件 | 修改内容 |
|------|------|----------|
| B1 | `stories/2-4-config-loading-and-document-scope.md` | 删除过期"⚠️ 超出范围：Story 1.3 中 `CordConfig.relationTypes` …属于 Epic 1 范围"段落（1.3 已在 Round 4 修复） |
| B2 | `planning-artifacts/architecture/03-core-architectural-decisions.md` | 架构 D6 配置项说明：`` `relationTypes`（自定义关系类型扩展） `` → `` `relationTypes`（关系类型启用/禁用配置，9 个内置类型默认全部启用） `` |
| B3 | `stories/2-5-scanservice-cold-start-scan-and-graph-write.md` | 主流程步骤 7b 后新增步骤 7c（`relationTypes 过滤: 按 config.relationTypes 对 relations 过滤，移除 enabled: false 的类型条目`）；Task 1.3 链路补入 `→ relationTypes 过滤`；Task 列表新增子任务 1.6b |

### 发现 #4 修订（StoredDocRecord / LifecycleResult 数据模型扩展）

| 编号 | 文件 | 修改内容 |
|------|------|----------|
| C1 | `stories/2-6-incremental-scan-and-document-lifecycle-detection.md` | `StoredDocRecord` 接口新增 `status: 'synced' \| 'modified'` 字段（对应 SyncState.status，供 renamed/moved 分支写回继承） |
| C2 | `stories/2-6-incremental-scan-and-document-lifecycle-detection.md` | `LifecycleResult.renamed` 和 `moved` 载荷新增 `currentMtimeMs: number` 字段，使步骤 11 引用的 `current.mtimeMs` 有明确数据来源 |

### P2 跳过说明

- **发现 #2**（IDE preset provider 缺失）：`config.ide` 为空时已有显式跳过分支，v0.1 不阻塞，暂不修订
- **发现 #5**（inbound preset 边增量刷新）：docType 由文件名模式决定，实际不随内容变化，可通过 `--rebuild` 修复，暂不修订

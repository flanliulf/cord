---
Epic: 2
Scope: epic
Round: 3
Date: 2026-04-15
Model Used: Claude Opus 4.6 (github-copilot)
Review Source: epic-2-story-review-summary-20260415-round-3.md
Review Model: GPT-5.4 (github-copilot)
Type: Story Review Evaluation
---

## 评估总结

本次评估针对 GPT-5.4 对 Epic 2 全部 6 个 Story 的第 3 轮复审结果（6 条发现）进行逐条验证，同时对"上轮问题回顾"中的 4 项修复确认和 4 项遗留状态进行交叉核实。审查质量持续保持高水准——第 3 轮复审精准识别了"修复后暴露的更深层逻辑矛盾"：从 Round 1 的"缺少设计"到 Round 2 的"共享契约残留缝隙"，再到 Round 3 的"新设计是否真正可实现"，问题维度确实在逐轮深入。6 条发现中，5 条确认有效需修订（P1），1 条有效但建议降级为后续改善跟踪（P2）。本轮无误报。当前核心阻塞集中在三个逻辑矛盾：(1) `--rebuild` 的 `deleteAllDocuments()` 与保留 `manual` 边在级联删除模型下不可同时成立；(2) 生命周期状态 `deleted` 在硬删除 + 级联模型下无法持久化；(3) 宽放后的 glob 在无路径范围护栏的条件下会大面积误识别。

## 上轮问题回顾确认

### Round 2 / Finding #1 — 16 种 v0.1 Markdown 文档类型口径同步：已确认修复

Story 2.3 AC #2 已改为"16 种 v0.1 Markdown BMAD 文档类型"，Task 1 已同步改为"16 种 v0.1 Markdown BMAD 文档类型"，AC #6 测试已改为"16 种 v0.1 文档类型识别"。Epic 2 Story 2.3 验收口径也已同步为"16 种 v0.1 Markdown BMAD 文档类型"。AC/Task/Epic/Dev Notes 四处口径已完全一致。

### Round 2 / Finding #2 — BMAD glob 命中当前仓库真实样本：已确认修复（但衍生新问题）

`architecture` 改为 `**/*architecture*.md` + `**/architecture/**/*.md`，`validation-report` 改为 `**/*validation*.md`，`distillate` 改为 `**/*distillat*.md`。三种类型现在均为包含式匹配，可以命中当前仓库的 `03-core-architectural-decisions.md`、`prd-validation-report.md`、`product-brief-cord-distillate.md` 等真实样本。漏识别问题已关闭。但放宽后的匹配范围缺少护栏，已作为本轮新发现 #3 处理。

### Round 2 / Finding #5 — 事务入口泄漏到底层 db：已确认修复

Story 2.5 事务伪代码已改为 `repo.transaction(() => { ... })`，Story 2.6 增量扫描事务也改为 `repo.transaction(() => { ... })`。两处伪代码均通过 IGraphRepository 的 `transaction()` 方法进入事务，P7 依赖注入边界已恢复。

### Round 2 / Finding #7 — lastObservedMtimeMs 落入 Story 1.4 共享契约：已确认修复（但衍生新问题）

Story 1.4 SyncState 接口已新增 `lastObservedMtimeMs: number`（含注释"上次扫描时观测到的文件 mtimeMs"）。SQL schema `sync_states` 表已新增 `last_observed_mtime_ms INTEGER` 列。字段级缺口已关闭。但删除语义与 `deleted` 状态的生命周期一致性问题已作为本轮新发现 #4 处理。

### 仍为上轮遗留（追踪状态）

- **Round 2 / Finding #3** — `relationTypes` / `configSchema` 共享契约：Story 2.4 已在 Task 1.2 中明确"复用共享 configSchema"，示例键已修正为有效的 `deprecated`（在 9 类基线中），方向正确。但 Story 1.3 CordConfig.relationTypes 仍为 `Record<string, unknown>`，跨 Epic 类型收敛仍未完成。已纳入本轮发现 #2 的评估范围。
- **Round 2 / Finding #4** — source / rebuild 语义：文案已改为"仅重建 scan-managed 边并保留 manual 边"，但与 1.4 级联删除模型的矛盾已升级为本轮发现 #1 的核心问题。
- **Round 2 / Finding #6** — 增量继承冷启动链路：Story 2.6 步骤 5 已明确声明复用冷启动完整构建子链路（pipeline.process → docType classify → preset merge → merge/deduce）。方向性修复有效，但 ScanPipelineResult 和 warnings 传播仍未闭合，已纳入本轮发现 #5。
- **Round 2 / Finding #8 / #9** — rename/delete AC 措辞 + 无变更快返：Dev Notes 架构约束已写明"重命名/移动只更新 documents.path"和"关系边按 docId 建立无需修改"。AC 措辞未变，但 Dev Notes 提供了足够的实现指引。无变更快返的 contentHash 前置计算问题已纳入本轮发现 #6。

### 历史非阻塞待办

- Round 1 / Finding #6（排除路径 .cord 口径）：确认仍为非阻塞。审查确认未扩大成新的架构冲突。
- Round 1 / Finding #12（CLI JSON/退出码/性能与测试粒度）：确认仍为非阻塞。任务粒度可继续细化但不阻塞开发。

## 发现 #1 评估

### 审查原文

> **[高][上轮遗留] Story 2.5 的 `--rebuild` 保留 `manual` 边承诺在当前数据模型下仍不可实现**
> - 来源：structure+consistency+contract
> - 分类：patch
> - 涉及 Story：2-5、1-4
> - 证据 - Story 2.5 的 Task 1.8、数据流说明和事务伪码都已写成"仅删除 `auto_scan` / `framework_preset` 边并保留 `manual` 边"，但同一伪码仍执行 `deleteAllDocuments()`；而 Story 1.4 的 `relations` 与 `sync_states` 均通过 `documents.id` 开启 `ON DELETE CASCADE`，删除文档会把依附其上的 `manual` 边和同步状态一并删掉。与此同时，Story 2.5 伪码调用的 `deleteRelationsBySource()`、`deleteAllDocuments()` 也未在 Story 1.4 的 `IGraphRepository` 中定义。
> - 影响 - 当前设计会把"保留 `manual` 边"写成无法兑现的伪承诺。实现者要么违背 1.4 的 Repository 契约私自扩接口，要么在 `--rebuild` 时静默丢失用户手工关系和同步状态。
> - 建议 - 先统一 rebuild 模型：要么明确 `--rebuild` 会重建全部 scan-managed 文档投影且不承诺保留 `manual` 边；要么改成基于稳定 docId / path 的原位 upsert，不再删除全部 `documents`。如果保留批量 source 级删除语义，必须同步前置到 Story 1.4 的 Repository 契约。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 经交叉验证：(1) Story 2.5 事务伪代码 rebuild 分支依次执行 `repo.deleteRelationsBySource(['auto_scan', 'framework_preset'])` 和 `repo.deleteAllDocuments()`。(2) Story 1.4 SQL schema `relations` 表有 `source_doc_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE` 和 `target_doc_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE`，`sync_states` 表有 `doc_id TEXT PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE`。这意味着 `deleteAllDocuments()` 会通过级联删除清除**所有**关系边（包括 `manual`）和所有同步状态，使得先执行的 `deleteRelationsBySource()` 成为无效操作——manual 边在下一步就被级联删除了。(3) IGraphRepository 接口中没有 `deleteRelationsBySource()` 和 `deleteAllDocuments()` 方法——前者不存在，后者也不存在（只有 `deleteDocument(id: string): void` 单文档删除）。三个问题点均验证成立。

**严重性判断**：合理 — 这是 Round 2 Finding #4（source/rebuild 语义未闭合）的直接升级。Round 2 时问题是"去重键不含 source，rebuild 无条件删除"；Round 3 修订后问题变为"用条件删除替代了无条件删除，但紧接着又用 deleteAllDocuments 把所有文档和级联边一起删了"。逻辑矛盾更加明显：两步操作自相矛盾。加上 Repository 接口缺少所需方法，实现者根本无法在不扩展 IGraphRepository 的前提下完成 rebuild。

**修订建议**：可行 — 审查提出了两种清晰的解决方向：(A) 改为基于 docId/path 的原位 upsert（不删除 documents，只替换 scan-managed 边），这样级联删除不会触发，manual 边自然保留；(B) 明确 `--rebuild` 不承诺保留 manual 边（简化 v0.1 设计，在 Epic 4 manual 关系实现时再处理保留策略）。方向 A 需要扩展 IGraphRepository 增加 `deleteRelationsBySource()` 或等效批量操作；方向 B 是最小修改路径。两种方向均可行，需要产品决策。

**误报评估**：非误报 — `deleteAllDocuments()` + ON DELETE CASCADE 的逻辑矛盾可从伪代码和 SQL schema 直接推导。

## 发现 #2 评估

### 审查原文

> **[高][上轮遗留] Story 2.4 的共享配置契约仍未真正定义 `effectiveScanPaths`**
> - 来源：structure+consistency+contract
> - 分类：patch
> - 涉及 Story：2-4、1-3、2-3
> - 证据 - Story 2.4 虽已在 Task 1.2 中要求复用共享 `configSchema`，并把 `relationTypes` 文本收敛为 9 类固定关系的启用/禁用配置，但 Story 1.3 的共享类型口径仍是宽松映射；更关键的是，FR40 / FR41 在 AC #7 / #8 中要求支持 framework / IDE 预设路径和用户覆盖，却没有定义"默认项目根 + 预设路径 + 用户 scanPaths"到底是替换、追加还是分层合并。当前 `DEFAULT_CONFIG.scanPaths = ['.']` 与 Story 2.3 已放宽的 BMAD glob 组合后，会把项目根下大量非目标文档一起纳入匹配候选。
> - 影响 - 配置层仍没有单一真相。实现者可能分别在 config-loader、adapter 和扫描服务里各自决定范围合成策略，最终造成"同一份配置在不同路径下命中不同文档"的分叉实现。
> - 建议 - 在 Story 2.4 中明确一个统一的 `effectiveScanPaths` 契约，至少写清：默认值、framework / IDE preset 的注入位置、用户覆盖优先级，以及这些路径是否限定 Story 2.3 的 doc-type glob 生效范围。同时继续把 `relationTypes` 的共享 schema / 类型收敛前置到 Story 1.3。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 经交叉验证：(1) Story 2.4 AC #7 要求"支持已支持框架和 IDE 的预设文档路径配置（FR40）"，AC #8 要求"用户可通过 cord.config 自定义扩展或覆盖预设配置（FR41）"，但 Task 和 Dev Notes 中均未定义 framework preset paths、IDE preset paths 与 `DEFAULT_CONFIG.scanPaths = ['.']` 之间的组合规则——是替换、追加还是分层合并？(2) Story 2.4 的 `loadConfig()` 签名 `loadConfig(projectRoot: string): CordConfig` 只返回配置对象，不包含"有效扫描路径"的计算逻辑。(3) Story 2.1 的 `IFrameworkAdapter.getScanPaths(config)` 和 `getExcludePaths(config)` 提供了框架级路径，但谁来组合用户配置 + 框架路径 + 默认值？没有定义。(4) Story 1.3 CordConfig 仍有 `relationTypes?: Record<string, unknown>;` 和注释"自定义关系类型扩展"，与 Story 2.4 的"固定 9 类启用/禁用"语义不一致。

**严重性判断**：合理 — 路径范围是整个扫描系统的入口决策。如果 adapter、config-loader 和 ScanService 各自独立计算扫描范围，同一份配置在不同调用路径下可能产出不同的文件列表。尤其是 Story 2.3 的 BMAD glob 现在已放宽为全仓库包含式匹配（如 `**/*validation*.md`），如果没有明确的 `effectiveScanPaths` 来限定 glob 的生效范围，误识别风险将显著放大。这与发现 #3 直接联动。

**修订建议**：可行 — (1) 在 Story 2.4 中定义 `effectiveScanPaths` 的计算公式，明确组合优先级（例如：用户 scanPaths 非空时替换默认值，framework preset paths 始终追加到有效路径中，excludePaths 在最终路径上统一过滤）。(2) 将此计算逻辑放在 config-loader 或 ScanService 中（只需选定一个位置）。(3) `relationTypes` 类型收敛属于跨 Epic 前置依赖，可继续标记为 ⚠️ 但须明确"Story 1.3 实现时需同步收敛为 `Partial<Record<RelationType, { enabled: boolean }>>`"。

**误报评估**：非误报 — 路径组合规则缺失和 CordConfig 类型签名不一致均可从文档直接验证。

## 发现 #3 评估

### 审查原文

> **[高][新] Story 2.3 为修复漏识别而放宽的 glob 现在缺少范围护栏，并且没有被回归测试真正接住**
> - 来源：structure+consistency+contract
> - 分类：patch
> - 涉及 Story：2-3、2-4
> - 证据 - Story 2.3 现在已能命中当前仓库中的 `architecture`、`validation-report`、`distillate` 样本，但模式也被放宽到 `**/*validation*.md`、`**/*distillat*.md` 这类全仓库包含式匹配；在 Story 2.4 尚未收敛 `effectiveScanPaths` 的前提下，这会把技能模板、流程说明等大量非 BMAD 业务文档一起纳入候选。与此同时，Story 2.3 的 Task 6 / AC #6 仍只写"编写测试"和"16 种类型识别 + 预设规则匹配 + 检测逻辑"，并未把这些真实样本与误匹配回归用例显式写入验收。
> - 影响 - Story 2.3 已从"漏识别真实样本"转成"可能在 CORD 自身仓库上大面积误识别内部资产"。这会直接破坏"BMAD 开箱即用"的语义边界，并使后续预设关系建立在错误分类之上。
> - 建议 - 给 BMAD glob 增加目录护栏，或明确这些 glob 只对 Story 2.4 产出的 `effectiveScanPaths` 生效；同时在 Task 6 / AC #6 中补入基于当前仓库真实样本的正例与误匹配反例回归测试。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 经交叉验证：(1) Story 2.3 文档类型表中 `validation-report` glob 为 `**/*validation*.md`，`distillate` glob 为 `**/*distillat*.md`。这些是全仓库包含式匹配——任何路径下文件名含有 "validation" 或 "distillat" 的 .md 文件都会被命中。(2) Story 2.5 的 docType classify 步骤使用 `adapter.getDocumentTypes()` 的 patterns 对 **所有已发现文档** 进行匹配分类。scanPaths 默认为 `['.']`（项目根目录），意味着所有子目录的 .md 文件都是候选。(3) CORD 仓库自身的 `_bmad/` 目录下有大量模板和流程文档，其文件名可能包含 "validation" 等关键词。(4) Story 2.3 AC #6 仅写"16 种 v0.1 文档类型识别 + 预设规则匹配 + 框架检测逻辑"，未提及正例/反例回归测试。

**严重性判断**：合理 — 这是 Round 2 Finding #2（glob 漏识别）修复后的直接副作用。glob 从"过窄导致漏识别"翻转为"过宽导致误识别"。误识别的危害更隐蔽——用户不会注意到一个文档被错误分类为 `validation-report`，但预设关系会基于错误分类建立，污染图谱。此问题与发现 #2（effectiveScanPaths 未定义）直接联动：如果有路径范围限定，宽 glob 的误识别范围会被有效收窄。

**修订建议**：可行 — (1) **短期**：在 Story 2.3 Task 6 / AC #6 中补入回归测试要求，至少包含：当前仓库真实 BMAD 文件的正例命中测试 + 非 BMAD 文件（如 `_bmad/` 下的模板）的反例排除测试。(2) **中期**：与 Story 2.4 协同定义 `effectiveScanPaths` 后，明确 BMAD glob 只在有效扫描路径范围内生效。(3) 可选优化：将部分高冲突 glob 从纯文件名匹配改为"目录 + 文件名"组合匹配（如 `validation-report` 改为 `**/planning-artifacts/**/*validation*.md` 或类似限定路径模式），但这需要与 Story 2.4 的路径设计协同。

**误报评估**：非误报 — glob 宽松度和测试缺口均可从 Story 文档直接验证。

## 发现 #4 评估

### 审查原文

> **[高][新] Story 2.6 的删除路径与 `SyncState` 生命周期语义仍是两套模型**
> - 来源：structure+consistency+contract
> - 分类：patch
> - 涉及 Story：2-6、1-4
> - 证据 - Story 2.6 的事务步骤 7 已改为 `repo.deleteDocument(docId)` 并依赖级联删除关系，这与 Story 1.4 的 SQL 外键模型一致；但 Story 1.4 的 `SyncState.status` 仍保留 `deleted` 状态，Story 2.6 的步骤 11 又只写"upsert sync_states（包含更新后的 lastObservedMtimeMs）"，没有闭合 modified / renamed / deleted 路径分别要写哪些字段。更进一步，Story 2.6 的事务步骤只显式替换 modified 文档的旧 scan-managed 边，没有把 modified 文档节点自身的 `contentHash`、`title`、`docType`、`metadata` 更新写进事务写集。
> - 影响 - 目前既无法稳定定义"删除后是否还保留 `deleted` 状态"，也无法保证 modified 文档扫描后 `documents` / `sync_states` 与真实文件保持一致。实现者很容易做出只换边、不更新文档节点和同步状态的半套增量流程。
> - 建议 - 先统一生命周期模型：如果删除就是硬删除并依赖 cascade，则应撤回持久化 `deleted` 状态或改为软删除模型；同时把 modified / added / renamed / moved 路径需要写回的 `documents` 和 `sync_states` 字段清单明确写进 Story 2.6。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 经交叉验证：(1) Story 1.4 SyncState 接口定义 `status: 'synced' | 'modified' | 'deleted'`——显式包含 `deleted` 状态。(2) Story 1.4 SQL schema `sync_states` 表有 `doc_id TEXT PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE`——删除 documents 行会级联删除对应的 sync_states 行。(3) Story 2.6 步骤 7 执行 `repo.deleteDocument(docId)` + cascade——这意味着 `deleted` 状态永远无法被持久化（文档和同步状态同时被硬删除）。(4) Story 2.6 步骤 9 只写"先删除 modified 文档的旧 scan-managed 边，再插入新边"，未提及更新 modified 文档节点的 `contentHash`、`title`、`docType`、`metadata`。(5) Story 2.6 步骤 11 只写"upsert sync_states（包含更新后的 lastObservedMtimeMs）"，未区分 modified / renamed / added / deleted 各路径的写回字段。

**严重性判断**：合理 — 这里存在两个独立但相关的问题：(A) `deleted` 状态的设计矛盾——硬删除 + cascade 使得 `deleted` 状态成为死代码。这不仅是语义问题，还影响 IGraphRepository 接口的设计——`SyncState.status` 的三值定义中有一个值永远不会被使用。(B) modified 文档写集不完整——增量扫描后文档节点的元数据不更新，会导致图谱中的 `contentHash`、`docType` 等字段与实际文件脱节。两个问题都需要在进入开发前解决。

**修订建议**：可行 — (1) 对于 `deleted` 状态：v0.1 使用硬删除 + cascade 是最简洁的设计，建议将 SyncState.status 改为 `'synced' | 'modified'` 二值（移除 `deleted`），或保留三值但明确写"deleted 状态仅用于诊断目的，实际由 cascade 处理"。(2) 对于 modified 文档写集：在 Story 2.6 步骤 9 和 10 之间补入"更新 modified 文档节点：`repo.updateDocument(docId, { path, contentHash, title, docType, metadata })`"。(3) 在步骤 11 中按路径区分：added → `upsertSyncState({ status: 'synced', lastObservedMtimeMs, contentHash })`；modified → `upsertSyncState({ status: 'synced', lastObservedMtimeMs, contentHash })`；renamed/moved → `upsertSyncState({ lastObservedMtimeMs })`。

**误报评估**：非误报 — `deleted` 状态在硬删除 + cascade 模型下无法持久化是逻辑推导的必然结论，modified 写集缺失可从事务步骤中直接验证。

## 发现 #5 评估

### 审查原文

> **[高][上轮遗留] Story 2.5 / 2.6 仍未把 `ScanPipelineResult` 与 `warnings` 传播链路写实**
> - 来源：consistency+contract
> - 分类：patch
> - 涉及 Story：2-5、2-6、2-2
> - 证据 - Story 2.2 已把扫描管道返回值定义为 `ScanPipelineResult { document, relations, warnings }`；但 Story 2.5 的流程步骤 4 仍把 `pipeline.process(filePath)` 写成 `ParsedDocument + DiscoveredRelation[]`，Story 2.6 虽然声明复用 2.5 的完整构建子链路，也没有补出 modified / added 文档的 `warnings` 如何聚合到最终 `ScanResult` 与 CLI / JSON 输出。
> - 影响 - 冷启动与增量扫描会继续对同一批异常文档产生不同可见性，一部分实现会把 warning 带到结果对象和 CLI，一部分则会静默吞掉，直接破坏 Story 2.2 与 Story 2.5 之间的共享接口口径。
> - 建议 - 把 Story 2.5 的 Task 1.3、主流程和返回值统一改写为显式消费 `ScanPipelineResult`；同时在 Story 2.6 中定义 modified / added 文档的 `warnings` 汇聚与输出规则。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 经交叉验证：(1) Story 2.2 Dev Notes 明确定义了 `ScanPipelineResult { document: ParsedDocument; relations: DiscoveredRelation[]; warnings: string[]; }`。(2) Story 2.5 流程步骤 4 写 `for each filePath: pipeline.process(filePath) → ParsedDocument + DiscoveredRelation[] (source: 'auto_scan')`——返回值形状不含 `warnings`，与 Story 2.2 的 `ScanPipelineResult` 不一致。(3) Story 2.5 最终返回的 `ScanResult` 包含 `warnings` 字段，但流程中没有定义 warnings 从何处收集、如何聚合。(4) Story 2.6 步骤 5 声明复用冷启动链路但也未提及 warnings。

**严重性判断**：合理 — 这是跨 Story 共享接口的一致性问题，已经在三轮审查中持续出现。`ScanPipelineResult` 是 Story 2.2 定义的核心输出类型，如果 Story 2.5 不消费它，那么 Story 2.2 的 `warnings` 字段就是死代码。更重要的是，NFR16（异常文档跳过并记录 WARNING）的验收依赖 warnings 被传播到用户可见的输出层。

**修订建议**：可行 — (1) 将 Story 2.5 步骤 4 改为 `pipeline.process(filePath) → ScanPipelineResult`，明确接收 `{ document, relations, warnings }`。(2) 在步骤 7（merge/dedupe）之后新增步骤：`aggregate warnings: scanResults.flatMap(r => r.warnings) → allWarnings[]`。(3) 将 `allWarnings` 纳入最终 `ScanResult.warnings`。(4) Story 2.6 步骤 5 同理，增量路径的 modified / added 文档也需聚合 warnings 到最终结果。修改量小，均为文档层面的接口对齐。

**误报评估**：非误报 — 返回值形状不一致和 warnings 传播缺失均可从 Story 文档直接验证。

## 发现 #6 评估

### 审查原文

> **[中][上轮遗留] Story 2.6 的"无变更快速返回"在当前流程下仍难满足 NFR6**
> - 来源：structure+consistency+contract
> - 分类：patch
> - 涉及 Story：2-6
> - 证据 - Story 2.6 的 Task 3.1 与 AC #7 要求"无 mtime 变化时直接返回、p95 < 100ms"，但阶段 1 的步骤 2 仍要求对每个文件先收集 `fs.statSync + contentHash`，真正的早退发生在 detectLifecycle 之后。也就是说，无变更路径依旧会先对全量文档做 `contentHash` 计算；此外，`renamed` / `moved` 虽被拆成两个结果字段，但判定边界仍未定义，导致性能与行为口径都不稳定。
> - 影响 - 当前设计下，无变更扫描并不是轻量元数据检查，而是"先读全量内容再判断能否早退"，这很难在中型仓库上稳定满足 NFR6；rename / move 的模糊分类也会进一步干扰测试与调试统计。
> - 建议 - 将无变更快返拆成两阶段：先基于路径集合和 `mtimeMs` 做预筛选，只有候选变更文件再计算 `contentHash`；若 v0.1 对 rename / move 没有不同行为，也可合并成单一 `pathChanged` 语义，避免为无业务差异的分类引入额外复杂度。

### 评估结论：⚠️ 有效但降级 — 建议纳入后续改善跟踪（P2）

### 评估分析

**问题描述准确性**：基本准确 — 经交叉验证：(1) Story 2.6 增量扫描流程步骤 2 写"对每个文件收集 fs.statSync + contentHash → CurrentFileSnapshot[]"。`contentHash` 需要 `crypto.createHash('sha256').update(content).digest('hex')`——这要求读取文件完整内容。(2) 步骤 6 写"无变更（LifecycleResult 全部 unchanged）：早期返回，跳过事务"——早退发生在全量 contentHash 计算之后。(3) 对于一个 100 文件 × 50KB 的中型仓库，全量读取 + SHA256 ≈ 5MB I/O + 计算，在 macOS 上通常需要 200-500ms，远超 NFR6 的 100ms 目标。(4) `renamed` / `moved` 分为两个结果字段，但 v0.1 两者的处理完全相同："repo.updateDocument(docId, { path: newPath })"——无业务差异。

**严重性判断**：偏高 — 虽然性能问题客观存在，但有两个缓解因素：(A) **变更检测使用 mtimeMs**：`detectLifecycle()` 的核心比较是 `current.mtimeMs !== stored.lastObservedMtimeMs`——如果设计者在实现时将步骤 2 拆为两阶段（先 `fs.statSync` 收集 mtimeMs → 全部匹配则直接快返 → 仅对候选文件计算 contentHash），就可以在不修改 `detectLifecycle` 函数签名的前提下满足 NFR6。这是实现层面的优化，Story 设计层面只需在步骤 2 和步骤 6 之间增加一行"mtimeMs 预筛选"即可。(B) **rename/move 合并**：v0.1 两者行为完全相同，合并为 `pathChanged` 是合理简化，但分开也不影响功能正确性，只是增加无意义的分类复杂度。综合考虑，这更适合作为 P2 改善项——设计方向明确，修复可在实现阶段自然完成。

**修订建议**：可行但非必要 — (1) 在 Story 2.6 步骤 2 增加 mtime 预筛选说明："先对所有文件执行 `fs.statSync` → 若全部 mtimeMs 与 stored 匹配则直接快返 → 仅对 mtime 变化的文件计算 contentHash"。这是一行文档修改。(2) rename/move 合并为 `pathChanged` 在 v0.1 是合理简化，但不是硬阻塞——开发者会自然意识到两者逻辑相同。

**误报评估**：非误报 — contentHash 前置全量计算和 rename/move 无差异拆分均为客观事实，但影响面可在实现阶段自然收敛。

## 整体评估结论

### 需要修订（阻塞进入开发）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|------------|------|
| 1 | `--rebuild` deleteAllDocuments 与保留 manual 边级联冲突 | [高] | P1 | 逻辑矛盾 + Repository 接口缺方法 |
| 2 | `effectiveScanPaths` 未定义，路径合成无单一真相 | [高] | P1 | FR40/FR41 覆盖优先级缺失 |
| 3 | 宽化 glob 无范围护栏，回归测试缺失 | [高] | P1 | 误识别风险 + 验收不可执行 |
| 4 | 删除路径硬删除与 SyncState.deleted 矛盾，modified 写集不完整 | [高] | P1 | 两套生命周期模型 + 文档节点不更新 |
| 5 | ScanPipelineResult / warnings 传播链路未闭合 | [高] | P1 | 跨 Story 接口形状不一致 |

### 建议纳入后续改善跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|------------|------|
| 6 | 无变更快返需 contentHash 全量计算，rename/move 无差异拆分 | [中] | P2 | 实现阶段可自然优化 |

### 可忽略（误报）

| # | 发现 | 原始严重性 | 忽略理由 |
|---|------|----------|---------|
| — | — | — | 本轮无误报 |

### 评估决定

**整体结论**：需修订后再审

5 项 P1 阻塞项可归为两个修订批次：**批次 A（数据模型统一）**——rebuild 策略选型（upsert vs 全删重建 vs 不保留 manual 边）、生命周期模型统一（硬删除 vs 软删除）、modified 文档写集补全（#1、#4）；**批次 B（扫描范围与接口闭合）**——`effectiveScanPaths` 契约定义、BMAD glob 护栏 + 回归测试、ScanPipelineResult 接口对齐（#2、#3、#5）。建议先完成批次 A（需要产品决策的 rebuild 策略），再完成批次 B（文档层面的接口对齐），然后提交第 4 轮复审。

## 修订执行记录

### 修订执行记录
- **Date**: 2026-04-15
- **Model Used**: Claude Opus 4.6 (github-copilot)
- **Fix Items**: 9

#### 修订项 #1: rebuild 策略简化为全量重建（发现 #1）
- **文件**: `_bmad-output/implementation-artifacts/stories/2-5-scanservice-cold-start-scan-and-graph-write.md`
- **章节**: Task 1.8 + rebuild 范围说明 + 伪代码 + 两阶段事务契约
- **修改摘要**: (1) Task 1.8 从"条件删除 scan-managed 边 + INSERT ALL（保留 manual 边）"改为"`deleteAllDocuments()`（级联清除全部）+ INSERT ALL 全量重建"。(2) rebuild 范围说明从"保留 manual 边"改为"v0.1 全量重建，不保留 manual 边，Epic 4 再细化"。(3) 伪代码移除 `deleteRelationsBySource()`（该方法不在 IGraphRepository 接口中），简化为 `deleteAllDocuments()` + CASCADE。(4) 两阶段事务契约 rebuild 行同步更新。
- **状态**: 已完成

#### 修订项 #2: IGraphRepository 新增 deleteAllDocuments 方法（发现 #1）
- **文件**: `_bmad-output/implementation-artifacts/stories/1-4-sqlite-storage-layer-and-data-migration.md`
- **章节**: Dev Notes > IGraphRepository 接口
- **修改摘要**: 接口在 `deleteDocument(id)` 之后新增 `deleteAllDocuments(): void`，满足 Story 2-5 rebuild 调用需要
- **状态**: 已完成

#### 修订项 #3: SyncState.status 移除 deleted + SQL schema 同步（发现 #4）
- **文件**: `_bmad-output/implementation-artifacts/stories/1-4-sqlite-storage-layer-and-data-migration.md`
- **章节**: Dev Notes > SyncState 接口 + 001-initial-schema.sql > sync_states 表
- **修改摘要**: (1) SyncState.status 从 `'synced' | 'modified' | 'deleted'` 改为 `'synced' | 'modified'`，注释说明"v0.1 硬删除 + CASCADE，deleted 无需持久化"。(2) SQL schema status 列注释从 `synced | modified | deleted` 同步改为 `synced | modified`。v0.1 使用硬删除 + ON DELETE CASCADE，文档删除时 sync_states 行被级联清除，`deleted` 状态永远无法持久化。
- **状态**: 已完成

#### 修订项 #4: modified 文档写集补全 + step 9 对齐（发现 #4）
- **文件**: `_bmad-output/implementation-artifacts/stories/2-6-incremental-scan-and-document-lifecycle-detection.md`
- **章节**: Dev Notes > 增量扫描流程 > 阶段 2 事务内步骤 9
- **修改摘要**: 步骤 9 从"先删除 scan-managed 边再插入新边（保留 manual 边）"改为三步：(a) `repo.deleteRelationsByDocId(docId)` 删除旧关系边（v0.1 无 manual 边，等价全量替换）；(b) 插入新关系边；(c) `repo.updateDocument(docId, { path, contentHash, title, docType, metadata })` 更新文档节点元数据。解决了 modified 文档节点不更新的问题。
- **状态**: 已完成

#### 修订项 #5: 步骤 11 按路径类型分别写回 sync_states（发现 #4）
- **文件**: `_bmad-output/implementation-artifacts/stories/2-6-incremental-scan-and-document-lifecycle-detection.md`
- **章节**: Dev Notes > 增量扫描流程 > 阶段 2 事务内步骤 11
- **修改摘要**: 从"upsert sync_states（包含 lastObservedMtimeMs）"改为按四路径分别定义：added → upsertSyncState(synced + mtime + hash)；modified → 同 added；renamed/moved → upsertSyncState(mtime only)；deleted → cascade 已自动清除，无需操作。消除了各路径写回字段不明确的歧义。
- **状态**: 已完成

#### 修订项 #6: effectiveScanPaths 计算契约定义（发现 #2）
- **文件**: `_bmad-output/implementation-artifacts/stories/2-4-config-loading-and-document-scope.md`
- **章节**: Dev Notes > 新增「effectiveScanPaths 计算契约」章节
- **修改摘要**: 在 relationTypes 语义说明之后、架构约束之前新增完整章节，定义：(1) 基础路径 = config.scanPaths（默认 `['.']`）；(2) 框架预设追加（adapter.getScanPaths 追加不替换）；(3) 排除过滤（config.excludePaths + adapter.getExcludePaths 统一过滤）；(4) 优先级链（用户 > 框架 > 默认）；(5) glob 生效范围（仅在 effectiveScanPaths 候选文件上匹配）。同时声明计算逻辑位于 ScanService.scan() 中，config-loader 不依赖 adapter。
- **状态**: 已完成

#### 修订项 #7: BMAD glob 范围护栏 + 回归测试要求（发现 #3）
- **文件**: `_bmad-output/implementation-artifacts/stories/2-3-bmad-framework-adapter-module.md`
- **章节**: Dev Notes > 文档类型表 + AC #6 + Task 6
- **修改摘要**: (1) 文档类型表前新增「glob 范围护栏」说明：globs 仅在 effectiveScanPaths 候选文件上匹配，非全仓库 glob 扫描；adapter.getDocumentTypes() 的 patterns 由 ScanService 在已发现文件上逐一匹配。(2) AC #6 补入"测试须包含：真实 BMAD 文件正例命中 + `_bmad/` 模板目录误匹配反例排除"。(3) Task 6 新增三个子任务：6.1 正例测试、6.2 反例测试、6.3 覆盖率验证。
- **状态**: 已完成

#### 修订项 #8: ScanPipelineResult 接口对齐 + warnings 聚合（发现 #5 — Story 2-5）
- **文件**: `_bmad-output/implementation-artifacts/stories/2-5-scanservice-cold-start-scan-and-graph-write.md`
- **章节**: Dev Notes > ScanService 流程 > 步骤 4-9
- **修改摘要**: (1) 步骤 4 从 `pipeline.process() → ParsedDocument + DiscoveredRelation[]` 改为 `→ ScanPipelineResult { document, relations, warnings }`，与 Story 2.2 的类型定义对齐。(2) 步骤 5 从"对每个 ParsedDocument"改为"对每个 document"。(3) 新增步骤 7b：`allResults.flatMap(r => r.warnings) → allWarnings[]`。(4) 步骤 9 return 的 warnings 改为 `warnings: allWarnings`。
- **状态**: 已完成

#### 修订项 #9: 增量路径 warnings 聚合（发现 #5 — Story 2-6）
- **文件**: `_bmad-output/implementation-artifacts/stories/2-6-incremental-scan-and-document-lifecycle-detection.md`
- **章节**: Dev Notes > 增量扫描流程 > 阶段 1 步骤 5
- **修改摘要**: (1) 步骤 5 管道返回值从 `pipeline.process → docType classify → ...` 改为 `pipeline.process → ScanPipelineResult { document, relations, warnings } → docType classify → ...`。(2) 新增步骤 5b：`results.flatMap(r => r.warnings) → allWarnings[]`，纳入最终 ScanResult.warnings 返回给 CLI 输出层。确保增量路径与冷启动路径的 warnings 传播行为一致。
- **状态**: 已完成

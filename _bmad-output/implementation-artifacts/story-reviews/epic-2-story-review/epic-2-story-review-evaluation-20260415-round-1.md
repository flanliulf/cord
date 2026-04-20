---
Epic: 2
Scope: epic
Round: 1
Date: 2026-04-15
Model Used: Claude Opus 4.6 (github-copilot)
Review Source: epic-2-story-review-summary-20260414-round-1.md
Review Model: GPT-5.4 (github-copilot)
Type: Story Review Evaluation
---

## 评估总结

本次评估针对 GPT-5.4 对 Epic 2 全部 6 个 Story 的首轮设计审查结果（12 条发现）进行逐条验证。整体审查质量较高，误报率低，多数发现均有明确的文档证据支撑。12 条发现中，8 条确认有效需修订，3 条有效但建议降级为后续改善跟踪，1 条部分有效但严重性偏高、建议降级。审查准确地识别了 Epic 2 最核心的系统性问题——跨 Story 共享契约未收敛，这一判断完全成立。建议在修订后进行一轮复审以确认闭合。

## 发现 #1 评估

### 审查原文

> **[高] BMAD 文档类型范围与扫描输入契约冲突**
> - 来源：structure+consistency+contract
> - 分类：decision_needed
> - 涉及 Story：2-1、2-2、2-3
> - 证据 - Story 2.3 把 `sprint-status.yaml`、`config.yaml`、`module.yaml` 等非 Markdown 文档纳入 18 种 BMAD 文档类型，但 Story 2.1 的抽象适配器发现阶段限定为仅保留 `.md` 文件，Story 2.2 又把非 Markdown 作为跳过对象。
> - 影响 - 实现者无法判断 YAML 文档到底应被扫描、仅被识别还是完全排除，BMAD 18 种文档类型承诺无法稳定验收。
> - 建议 - 在 Story 2.1-2.3 中统一 v0.1 的文档范围。若只支持 Markdown，就移除非 Markdown 类型；若支持 YAML，就补齐发现、解析、测试和关系生成契约。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — Story 2.1 Dev Notes 明确写到"只保留 .md 文件"，Story 2.2 AC #8 写到"非 .md 文件跳过"，而 Story 2.3 的 18 种文档类型表格中 #6 `sprint-status` 匹配 `**/sprint-status*.yaml`、#18 `config` 匹配 `**/config.yaml, **/module.yaml`，三者之间确实存在不可调和的矛盾。
**严重性判断**：合理 — 这是核心功能承诺与执行链路之间的根本冲突，不解决则 BMAD 适配器的核心价值（18 种文档类型识别）无法兑现。
**修订建议**：可行 — 建议 v0.1 收敛为仅 Markdown，将 YAML 类型（#6、#18）标记为 v0.2 扩展，同时在 Story 2.3 中明确说明延期范围。这是最小成本的收敛方案。
**误报评估**：非误报 — 三份 Story 文档均有明确的白纸黑字互相矛盾。

## 发现 #2 评估

### 审查原文

> **[高] 适配器解析与 Generic fallback 选择契约缺失**
> - 来源：structure+consistency+contract
> - 分类：patch
> - 涉及 Story：2-1、2-3、2-4、2-5
> - 证据 - Story 2.1 规定 `GenericFrameworkAdapter.detectFramework()` 始终返回 `true`，Story 2.3 又定义了 BMAD 的 5 层检测策略，Story 2.4 暴露 `framework` / `adapters` 配置，但 Story 2.5 的扫描流程没有任何适配器解析与优先级定义。
> - 影响 - 具体框架适配器可能被 generic 兜底适配器吞掉，BMAD 开箱即用会退化为不确定行为。
> - 建议 - 在 Story 2.1 或 2.5 中补充统一的 adapter resolution contract，明确 config override、检测顺序、priority 规则，并规定 generic 只能最后兜底。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — Story 2.5 的 ScanService 流程为 `loadConfig → adapter.discoverDocuments → pipeline.process → repo 写入`，其中 `adapter` 是单数，没有适配器选择逻辑。Story 2.1 的 GenericFrameworkAdapter `detectFramework()` 恒真，但没有定义当 BMAD 和 Generic 同时命中时的选择规则。
**严重性判断**：合理 — v0.1 只有 generic + bmad 两个适配器，但如果不在设计阶段定义选择算法，实现者会自行发明，导致行为不可预测。这是架构层必须收敛的契约。
**修订建议**：可行 — 建议在 Story 2.1 或 2.5 中补充 adapter resolution 契约：`config.framework 显式指定 > detectFramework() 按注册顺序首个命中 > generic 兜底`。修改量不大，一个段落即可闭合。
**误报评估**：非误报 — 确实没有任何 Story 定义适配器选择算法。

## 发现 #3 评估

### 审查原文

> **[高] BMAD 文档类型分类与预设规则未进入扫描执行链路**
> - 来源：structure+consistency
> - 分类：patch
> - 涉及 Story：2-1、2-2、2-3、2-5
> - 证据 - Story 2.1 定义了 `getDocumentTypes()` 和 `getPresetRules()`，Story 2.3 也提供了 BMAD 文档类型与预设规则，但 Story 2.2 的扫描管道与 Story 2.5 的 ScanService 流程都没有文档分类、预设规则求值或结果合并阶段。
> - 影响 - `BmadFrameworkAdapter` 只能参与文档发现，无法兑现框架预设关系和文档类型识别的核心价值。
> - 建议 - 在 Story 2.2 或 2.5 中显式增加 `docType classify -> preset rule evaluate -> merge/dedupe -> source 标记` 的数据流，并补充对应测试。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — Story 2.5 ScanService 流程为 `loadConfig → discoverDocuments → pipeline.process → repo 写入`。`pipeline.process` 在 Story 2.2 中定义为 `AST → plugins → rules → DiscoveredRelation[]`，整个链路中确实没有"获取适配器的预设规则"和"分类文档类型"的步骤。适配器接口定义了 `getDocumentTypes()` 和 `getPresetRules()`，但没有消费者。
**严重性判断**：合理 — 这是 BMAD 框架适配器核心价值的兑现路径缺失。如果预设规则不进入执行链路，Story 2.3 整个 Story 的产出（预设规则和文档类型定义）就变成了死代码。
**修订建议**：可行 — 可以在 Story 2.5 的 ScanService 流程中，在 pipeline.process 之后增加 `adapter.getPresetRules() → merge/dedupe with scan results` 步骤，同时在 pipeline 输入或输出中增加 docType 分类能力。
**误报评估**：非误报 — 通过完整追踪 Story 2.1 接口定义 → Story 2.3 实现 → Story 2.2/2.5 消费路径，确认链路断裂。

## 发现 #4 评估

### 审查原文

> **[高] 关系来源 auto_scan 与 framework_preset 契约冲突**
> - 来源：structure+consistency+contract
> - 分类：patch
> - 涉及 Story：1-3、2-2、2-3、2-5
> - 证据 - Story 1.3 的 `RelationSource` 已定义 `auto_scan`、`manual`、`framework_preset` 三种来源，Story 2.3 引入了框架预设规则，但 Story 2.5 把所有关系来源统一写成 `auto_scan`，Story 2.2 的 `DiscoveredRelation` 也没有来源字段。
> - 影响 - 后续无法区分文本扫描发现和框架预设注入的边，影响冲突处理、调试和数据解释。
> - 建议 - 扫描规则生成的边写 `auto_scan`，框架预设写 `framework_preset`，并在 Story 2.2/2.5 的数据流中显式传递 `source`。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — Story 1.3 明确定义 `RelationSource = 'auto_scan' | 'manual' | 'framework_preset'`，Story 1.4 的 SQL schema `relations` 表也有 `source TEXT NOT NULL DEFAULT 'auto_scan'` 列。但 Story 2.2 的 `DiscoveredRelation` 类型只有 `ruleName` 没有 `source` 字段。Story 2.5 AC #4 明写"来源标记为 auto_scan（FR21）"，未区分框架预设来源。
**严重性判断**：合理 — 这与发现 #3 强关联。如果预设规则要进入执行链路（发现 #3 确认必须），那来源标记必须同步区分，否则整个 `RelationSource` 三值设计在 v0.1 就退化为单值。
**修订建议**：可行 — 在 Story 2.2 的 `DiscoveredRelation` 中添加 `source: RelationSource` 字段，Story 2.5 的写入逻辑根据规则来源（scan rule vs preset rule）正确标记。修改量小，与发现 #3 可合并修订。
**误报评估**：非误报 — 类型定义、SQL schema 和 Story 流程三方面均有明确证据。

## 发现 #5 评估

### 审查原文

> **[高] relationTypes 扩展语义与固定 9 类关系模型冲突**
> - 来源：consistency
> - 分类：decision_needed
> - 涉及 Story：1-3、2-4
> - 证据 - Story 2.4 和 Story 1.3 将 `relationTypes` 描述为"自定义关系类型扩展"，但 `project-context.md`、架构文档和 Epic 2 又把关系类型固定为 9 种。当前文档没有说明 `relationTypes` 是扩展新类型、筛选已有类型还是调整映射规则。
> - 影响 - 类型系统、配置系统和持久化契约会出现多套真相，开发时要么忽略 `relationTypes`，要么破坏 FR10 的稳定边界。
> - 建议 - 明确 `relationTypes` 的产品语义。若只允许配置已有 9 类关系的启用/映射/阈值，就收敛命名；若允许扩展新类型，则必须同步改写 `RelationType`、P9、FR10 和存储契约。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — Story 1.3 CordConfig 定义 `relationTypes?: Record<string, unknown>;  // 自定义关系类型扩展`，而 project-context.md P9 和 Story 1.3 同时定义 `RELATION_TYPES` 为固定 9 种 `as const`。两者之间的语义冲突是明确的：一边说可扩展，另一边说类型是固定枚举。
**严重性判断**：合理 — 如果不收敛，`relationTypes` 配置项的实现将陷入两难：运行时允许扩展会破坏 TypeScript 类型安全（`as const` 联合类型无法动态扩展），拒绝扩展则配置项形同虚设。这是产品层面需要做的设计决策。
**修订建议**：可行 — 最合理的 v0.1 路径是：`relationTypes` 不扩展新类型，而是配置现有 9 类的启用/禁用和阈值参数，命名改为 `relationConfig` 或等价表达以消除歧义。
**误报评估**：非误报 — `Record<string, unknown>` 注释"自定义关系类型扩展"与 `as const` 9 种固定类型之间的矛盾无法调和。

## 发现 #6 评估

### 审查原文

> **[高] 排除路径的硬边界与默认边界未收敛，.cord 口径不一致**
> - 来源：contract+structure
> - 分类：decision_needed
> - 涉及 Story：2-4
> - 证据 - Story 2.4 的 AC 和 Task 只列出 `src`、`node_modules`、`.git`、`dist`，但 Dev Notes 默认配置又额外加入 `.cord`；同时文档没有说明 FR39 列出的排除项是硬排除，还是用户可以通过配置重新纳入。
> - 影响 - 不同实现可能对 `src`、`dist`、`.git`、`.cord` 的可扫描性做出不同判断，直接影响安全、性能和行为一致性。
> - 建议 - 将排除规则拆为 `hardExcludedPaths` 和 `defaultExcludedPaths`，明确 `.cord` 的归属，并同步更新 Story 2.4、schema 和规则文档。

### 评估结论：⚠️ 有效但降级 — 建议纳入后续改善跟踪（P2）

### 评估分析

**问题描述准确性**：基本准确 — AC #6 确实只列出 4 项排除路径（`src/`、`node_modules/`、`.git/`、`dist/`），而 Dev Notes 的 `DEFAULT_CONFIG` 多了 `.cord/`。但 `.cord/` 是 CORD 自身的数据目录，project-context.md 安全规则部分也提到 `.cord/` 应在 `.gitignore` 中，排除它是合理且显而易见的默认行为。
**严重性判断**：偏高 — AC 与 Dev Notes 的不一致是真实的，但 `.cord/` 排除在语义上不存在争议（扫描自己的数据库目录没有意义）。核心的硬排除/默认排除的拆分建议虽然优雅，但 v0.1 仅有 4+1 项排除路径，过早引入双层排除机制属于过度设计。更实际的修订是：在 AC 和 Dev Notes 中统一 5 项默认排除路径，注释说明 `.cord/`、`.git/`、`node_modules/` 为不可覆盖项即可。
**修订建议**：可行但非必要 — 拆为 `hardExcludedPaths` / `defaultExcludedPaths` 是合理的长期方向，但 v0.1 只需在文档中补齐 `.cord/` 并标注哪些不可覆盖即可。
**误报评估**：非误报 — AC 与 Dev Notes 的不一致是事实，但严重性从 [高] 降至 [中]。

## 发现 #7 评估

### 审查原文

> **[高] rebuild 与增量事务边界未定义完整，原子性和性能目标都无法证明**
> - 来源：structure+consistency+contract
> - 分类：patch
> - 涉及 Story：2-5、2-6
> - 证据 - Story 2.5 把 `--rebuild` 写成"先清空再全量扫描"，但事务说明只覆盖写入阶段；Story 2.6 又只写"增量扫描也在事务中执行"，没有说明 async 解析、stat/hash、生命周期 diff 与同步事务的边界。
> - 影响 - 一旦在清空之后、写回之前或增量扫描中途失败，图谱会留下空库、半成品或长事务锁，无法满足 NFR15、NFR18 和 NFR6。
> - 建议 - 统一采用两阶段契约：事务外完成发现、解析和变更计划，事务内只提交短写集；`rebuild` 需明确原子替换或同事务清空+写回方案。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — Story 2.5 Task 1.3 写"事务包装保证原子性"、Task 1.4 写"--rebuild：先清空数据再全量扫描"，但没有说明清空和写入是否在同一个事务中。如果分两个事务，中间失败确实会留下空库。Story 2.6 的"增量扫描也在事务中执行"同样过于笼统——增量扫描包含文件系统 stat、content diff 和数据库写入，把所有操作放进一个事务会导致长事务锁，不放则原子性无法保证。
**严重性判断**：合理 — 数据完整性是存储系统的底线问题。NFR15 明确要求"异常中断不产生脏数据"，当前 Story 的事务描述无法证明满足此要求。
**修订建议**：可行 — 两阶段契约（事务外计算 + 事务内短写）是标准做法，且 better-sqlite3 的同步事务天然适合此模式。rebuild 可以用同一事务内 `DELETE ALL + INSERT ALL` 实现原子替换。
**误报评估**：非误报 — rebuild 和增量扫描的事务语义确实未从描述层上升到可实现的契约层。

## 发现 #8 评估

### 审查原文

> **[高] 增量扫描的快照、mtime 与 lifecycle-detector 契约缺失**
> - 来源：structure+consistency+contract
> - 分类：patch
> - 涉及 Story：2-6、1-4
> - 证据 - Story 2.6 用 `fs.statSync(path).mtimeMs` 对比 `sync_states.last_scanned_at`，但前置契约中的 `lastScannedAt` 是扫描时间而非文件版本令牌。Story 2.6 还把 `lifecycle-detector` 声明为纯函数，却没有定义它需要的输入快照结构。
> - 影响 - 增量扫描会在时间语义和模块边界上产生分叉实现，甚至把未重新扫描的脏数据误判为"无变更"。
> - 建议 - 补充 `currentFiles` 与 `storedDocs` 两类快照输入契约，并引入独立的 `lastObservedMtimeMs` 或等价版本令牌，避免直接复用 `lastScannedAt`。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — Story 1.4 定义 `SyncState.lastScannedAt` 为 ISO 8601 字符串，语义是"上次扫描此文件的时间"。Story 2.6 Dev Notes 写到"mtime 比较：`fs.statSync(path).mtimeMs` vs `sync_states.last_scanned_at`"，但 `mtimeMs` 是文件最后修改时间（epoch 毫秒），`lastScannedAt` 是扫描操作的时间——两者比较的是不同语义的时间戳。如果文件在扫描后被修改，确实能检测到变更，但假如系统时钟跳变或扫描期间文件被修改，结果不可预测。
**严重性判断**：合理 — 增量扫描的正确性完全依赖变更检测的准确性。时间语义混淆会导致漏扫或误扫，且 lifecycle-detector 作为纯函数缺少明确的输入契约（`currentFiles` 和 `storedDocs` 的数据结构）会直接影响可测性。
**修订建议**：可行 — 在 `SyncState` 中增加 `lastObservedMtimeMs: number` 字段记录上次扫描时观测到的文件 mtime，增量扫描时比较 `current mtimeMs === stored lastObservedMtimeMs`，语义上更清晰可靠。同时为 lifecycle-detector 定义明确的输入类型。
**误报评估**：非误报 — `lastScannedAt`（扫描时间）与 `mtimeMs`（文件修改时间）的语义差异是客观事实。

## 发现 #9 评估

### 审查原文

> **[高] rename、move、delete 的存储语义与 Repository API 不匹配**
> - 来源：structure+consistency+contract
> - 分类：patch
> - 涉及 Story：2-6、1-3、1-4
> - 证据 - Story 2.6 要求重命名时更新文档路径和相关关系边，并在流程中使用 `repo.updateDocument(path)`；但现有关系模型按 `docId` 建边，Repository 也只定义了 `updateDocument(id, updates)` 和 `deleteDocument(id)`。同时 rename 与 move 的判定规则也未收敛。
> - 影响 - 实现者要么引入多余的关系边重写与新 API，要么在服务层自行猜测规则，导致生命周期行为与存储模型漂移。
> - 建议 - 将契约收敛为更新 `documents.path`、按 `docId` 保持关系边；补充 `getDocumentByPath(oldPath) -> updateDocument(id, { path })` 的明确流程，并定义 rename 与 move 的判定优先级。

### 评估结论：✅ 确认有效 — 需要修订（P2 优先级）

### 评估分析

**问题描述准确性**：基本准确 — Story 2.6 Dev Notes 增量扫描流程第 5 步确实写了 `repo.updateDocument(path)`，与 Story 1.4 的 `IGraphRepository.updateDocument(id, updates)` 签名不匹配。Story 2.6 AC #3 要求"更新图谱中的文档路径和相关关系边"，但实际上关系边按 `docId`（而非路径）建立，重命名只需更新 `documents.path`，关系边无需修改——审查原文中"引入多余的关系边重写"这一担忧在现有数据模型下不会发生。
**严重性判断**：偏高 — Story 2.6 的 API 调用写法（`repo.updateDocument(path)`）确实与接口签名不一致，需要修正，但实际修复路径很清晰：`getDocumentByPath(oldPath) → updateDocument(id, { path: newPath })`，这在 Story 1.4 已提供的 API 中完全覆盖。关系边无需重写（因为按 docId 建边），降低了实际影响。rename 与 move 的区分在 v0.1 也不关键（两者处理逻辑相同：更新 path）。
**修订建议**：可行 — 修正 Story 2.6 中的伪代码使其与 IGraphRepository API 一致，并明确说明"关系边按 docId 建立，重命名/移动只需更新 documents.path"即可。
**误报评估**：非误报 — API 不匹配是事实，但严重性从 [高] 降至 [中]。

## 发现 #10 评估

### 审查原文

> **[中] 配置验证未明确复用共享 configSchema，7 项配置缺少闭环定义**
> - 来源：structure+contract
> - 分类：patch
> - 涉及 Story：1-3、2-4
> - 证据 - Epic 2 要求 Story 2.4 与 Story 1.3 的 `configSchema` 集成，但 Story 2.4 只写成"通过 Zod schema 验证"。同时 7 项配置里只有 `scanPaths`、`excludePaths`、`confidenceThreshold` 给出了默认行为，其余字段缺少类型、优先级和合并语义。
> - 影响 - 实现者容易在 loader 内复制一套私有 schema，或把剩余字段做成"可解析但不可预测"的弱契约。
> - 建议 - 在 Story 2.4 中明确必须复用 `schemas/configSchema`，并为 `framework`、`ide`、`relationTypes`、`adapters` 补齐默认行为、覆盖语义和测试矩阵。

### 评估结论：⚠️ 有效但降级 — 建议纳入后续改善跟踪（P2）

### 评估分析

**问题描述准确性**：基本准确 — Story 2.4 AC #2 确实只写"配置通过 Zod schema 验证"，没有显式说"复用 `src/schemas/config.ts` 的 `configSchema`"。但 Epic 级 AC 已写明"与 Story 1.3 的 configSchema 集成"，且 Story 2.4 Dev Notes 的架构约束引用了 D6（配置文件格式），在遵循 P6（模块通过 index.ts 导出）的前提下，复用 configSchema 是自然的实现路径。4 项配置（`framework`、`ide`、`relationTypes`、`adapters`）缺少默认行为是真实的缺陷。
**严重性判断**：合理 — [中] 级别恰当。缺少显式复用声明是文档疏漏而非设计冲突，不太可能导致实现者创建私有 schema（Epic AC 和架构约束已有足够暗示）。但 4 项配置缺少默认行为确实需要补充。
**修订建议**：可行 — 在 Story 2.4 中增加"复用 `src/schemas/config.ts` 的 `configSchema`"的显式声明，并为缺少默认行为的 4 项配置补齐说明。此项可与发现 #5（relationTypes 语义）合并修订。
**误报评估**：非误报 — 文档不够显式和 4 项配置缺少默认行为均是事实，但不阻塞开发。

## 发现 #11 评估

### 审查原文

> **[中] Markdown 链接支持从相对+绝对退化为仅相对**
> - 来源：structure+contract
> - 分类：patch
> - 涉及 Story：2-2
> - 证据 - Epic 2 明确要求 `extract-links` 支持相对路径和绝对路径的 Markdown 链接，但 Story 2.2 的 `markdown-link-rule` 实现说明只处理相对路径的 `.md` 链接。
> - 影响 - 按 Story 2.2 实现会静默漏扫绝对路径链接，Story 可"完成"，Epic 却无法通过原始验收。
> - 建议 - 统一 Epic 和 Story 口径：要么明确支持绝对路径并补充规范化规则与测试，要么在 Epic 和 Story 中同步声明延期。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — Epic 2.2 AC 明写"提取 Markdown 链接（相对路径和绝对路径）"，而 Story 2.2 Dev Notes `markdown-link-rule` 部分第二点写"只处理相对路径的 .md 文件链接"。这是 Epic → Story 拆分时的明确规格退化，不是模糊的解读差异。
**严重性判断**：合理 — 虽然标记为 [中]，但 Epic AC 与 Story 实现的直接矛盾实际上属于 P1 级问题——如果按 Story 实现，Epic 验收必然失败。建议升级优先级。要么 Story 补齐绝对路径支持（工作量不大：解析相对于项目根的路径），要么 Epic 和 Story 同步声明 v0.1 仅支持相对路径。
**修订建议**：可行 — 建议 v0.1 同时支持相对和绝对路径（均相对于项目根目录解析），在 markdown-link-rule 中增加路径规范化逻辑。如果确定延期，需同步修改 Epic AC。
**误报评估**：非误报 — Epic 与 Story 的白纸黑字矛盾。

## 发现 #12 评估

### 审查原文

> **[中] CLI JSON、退出码、性能与测试验收未被任务闭合**
> - 来源：structure+contract
> - 分类：patch
> - 涉及 Story：2-5、2-6
> - 证据 - Story 2.5/2.6 的多个 AC 仍停留在目标描述层：2.5 没有退出码映射和全局 `--json` 的落地任务，2.5/2.6 的性能指标缺少测量基线，2.6 也没有把单元、集成和异常路径测试拆开。
> - 影响 - 即使实现完成，也难以通过一致、可复现的方式验证 CLI 行为、性能目标和端到端回归。
> - 建议 - 补充全局 `--json` 输出契约、错误类型到退出码的映射、性能基线与样本规模，并把单元 / 集成 / 异常测试分别拆入任务列表。

### 评估结论：⚠️ 有效但降级 — 建议纳入后续改善跟踪（P2）

### 评估分析

**问题描述准确性**：基本准确 — Story 2.5 AC #7/8 确实列了 `--json` 和退出码要求，但 Task 列表中没有对应的独立任务。性能 AC（≥ 4 文档/秒、p95 < 100ms）也没有定义测量方法和基线数据集大小。Story 2.6 的测试也未拆分。
**严重性判断**：偏高 — 这更多是任务粒度问题而非设计缺陷。AC 本身已明确定义了行为（退出码映射是确定的：0/1/2），实现者不会困惑"做什么"，只是任务列表不够精细导致追踪困难。不构成进入开发的阻塞项。
**修订建议**：可行但非必要 — 补充任务粒度确实更好，但对于有经验的开发者，AC 已足够驱动实现。建议作为改善项而非阻塞项。
**误报评估**：非误报 — 任务粒度确实不够细，但不属于设计层面的阻塞问题。

## 整体评估结论

### 需要修订（阻塞进入开发）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|------------|------|
| 1 | BMAD 文档类型范围与扫描输入契约冲突 | [高] | P1 | v0.1 需收敛为仅 Markdown |
| 2 | 适配器解析与 Generic fallback 选择契约缺失 | [高] | P1 | 补 adapter resolution 契约 |
| 3 | 文档分类与预设规则未进入扫描执行链路 | [高] | P1 | 补预设规则消费路径 |
| 4 | 关系来源 auto_scan 与 framework_preset 冲突 | [高] | P1 | DiscoveredRelation 补 source 字段 |
| 5 | relationTypes 扩展语义与固定 9 类冲突 | [高] | P1 | 收敛为配置而非扩展 |
| 7 | rebuild 与增量事务边界未定义完整 | [高] | P1 | 补两阶段事务契约 |
| 8 | 增量扫描快照与版本令牌契约缺失 | [高] | P1 | 补 lastObservedMtimeMs |
| 11 | Markdown 链接退化为仅相对路径 | [中] | P1 | Epic 与 Story AC 直接矛盾 |

### 建议纳入后续改善跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|------------|------|
| 6 | 排除路径硬边界与默认边界未收敛 | [高] | P2 | 统一 5 项排除路径即可 |
| 9 | rename/move/delete 存储语义 API 不匹配 | [高] | P2 | 修正伪代码匹配 API 签名 |
| 10 | 配置验证未明确复用 configSchema | [中] | P2 | 补显式复用声明 |
| 12 | CLI/性能/测试任务粒度不足 | [中] | P2 | 细化任务列表 |

### 可忽略（误报）

| # | 发现 | 原始严重性 | 忽略理由 |
|---|------|----------|---------|
| — | — | — | 本轮无误报 |

### 评估决定

**整体结论**：需修订后再审

审查准确识别了 Epic 2 最核心的系统性问题：跨 Story 共享契约（适配器选择、文档类型范围、预设规则接入、关系来源、事务边界）未收敛。8 项 P1 发现中，#1–#5 高度关联，可作为一个"共享契约收敛"修订批次统一处理；#7–#8 可作为"事务与增量扫描契约"批次处理；#11 可独立修订。建议修订完成后提交复审，重点验证共享契约闭合度。

## 修订执行记录

### 修订执行记录
- **Date**: 2026-04-15
- **Model Used**: Claude Opus 4.6 (github-copilot)
- **Fix Items**: 10

#### 修订项 #1: BMAD 文档类型范围与扫描输入契约冲突（发现 #1）
- **文件**: `_bmad-output/implementation-artifacts/stories/2-3-bmad-framework-adapter-module.md`
- **章节**: Dev Notes > 18 种 BMAD 文档类型
- **修改摘要**: 新增 v0.1 范围约束说明段落；表格增加「v0.1 支持」列，#6 sprint-status（YAML）和 #18 config（YAML）标记为「⏳ v0.2」，其余 16 种 Markdown 类型标记为 ✅
- **状态**: 已完成

#### 修订项 #2: 适配器解析与 Generic fallback 选择契约缺失（发现 #2）
- **文件**: `_bmad-output/implementation-artifacts/stories/2-1-framework-adapter-interface-and-generic-fallback.md`
- **章节**: Dev Notes > 新增「Adapter Resolution 契约」段落 + Tasks
- **修改摘要**: 新增 Adapter Resolution 契约段落，定义三级优先级算法（config 显式指定 > detectFramework 自动检测 > generic 兜底），含伪代码和 registry 说明；Task 4 补充 registry 维护和 resolveAdapter 导出，Task 5 补充 adapter resolution 测试用例
- **状态**: 已完成

#### 修订项 #3: 文档分类与预设规则未进入扫描执行链路（发现 #3）
- **文件**: `_bmad-output/implementation-artifacts/stories/2-5-scanservice-cold-start-scan-and-graph-write.md`
- **章节**: Dev Notes > ScanService 流程 + Tasks
- **修改摘要**: 重写 ScanService 9 步流程，在原 pipeline.process 后插入 docType classify（步骤 5）、preset merge（步骤 6）、merge/dedupe（步骤 7）；新增数据流说明；Task 1 拆为 8 个子任务覆盖 resolveAdapter、docType classify、preset merge、merge/dedupe
- **状态**: 已完成

#### 修订项 #4: DiscoveredRelation 补 source 字段（发现 #4）
- **文件**: `_bmad-output/implementation-artifacts/stories/2-2-scan-engine-core-pipeline-remark-ast-and-rules.md`
- **章节**: Dev Notes > 扫描类型定义 > DiscoveredRelation
- **修改摘要**: `DiscoveredRelation` 接口新增 `source: RelationSource` 字段（位于 confidence 和 ruleName 之间），注释说明默认值为 `'auto_scan'`
- **状态**: 已完成

#### 修订项 #5: 扫描写入来源区分（发现 #4 延续）
- **文件**: `_bmad-output/implementation-artifacts/stories/2-5-scanservice-cold-start-scan-and-graph-write.md`
- **章节**: AC #4
- **修改摘要**: AC #4 从「来源标记为 auto_scan」改为「scan rule 产出标记 auto_scan，adapter preset rule 产出标记 framework_preset」，引用 Story 1.3 RelationSource 三值契约
- **状态**: 已完成

#### 修订项 #6: relationTypes 扩展语义与固定 9 类冲突（发现 #5）
- **文件**: `_bmad-output/implementation-artifacts/stories/2-4-config-loading-and-document-scope.md`
- **章节**: AC #3 + Dev Notes > 默认配置 + 新增「relationTypes 语义说明」
- **修改摘要**: AC #3 括号补充「其中 relationTypes 为已有 9 类关系的启用/禁用配置，不支持扩展新类型」；默认配置补充 4 项可选字段注释；新增 relationTypes 语义说明段落含配置示例；标注 Story 1-3 CordConfig 类型签名需同步收敛为「⚠️ 超出范围」
- **状态**: 已完成

#### 修订项 #7: rebuild 事务契约明确化（发现 #7 — Story 2-5 部分）
- **文件**: `_bmad-output/implementation-artifacts/stories/2-5-scanservice-cold-start-scan-and-graph-write.md`
- **章节**: Dev Notes > 新增「两阶段事务契约」段落
- **修改摘要**: 在架构约束后新增完整的两阶段事务契约说明：阶段 1（事务外）覆盖 loadConfig 到写入计划产出，阶段 2（事务内短写集）覆盖 INSERT/UPDATE 和 rebuild 的 DELETE ALL + INSERT ALL 原子替换，附 better-sqlite3 伪代码
- **状态**: 已完成

#### 修订项 #8: 增量扫描事务边界（发现 #7 — Story 2-6 部分）
- **文件**: `_bmad-output/implementation-artifacts/stories/2-6-incremental-scan-and-document-lifecycle-detection.md`
- **章节**: Dev Notes > 增量扫描流程 + 架构约束
- **修改摘要**: 重写增量扫描流程为两阶段结构（事务外 6 步 + 事务内 4 步），并在架构约束中增加「遵循两阶段事务契约」说明；修正步骤 8 的 API 调用为 `repo.updateDocument(docId, { path })` 匹配 IGraphRepository 签名，补充「关系边按 docId 建立无需修改」
- **状态**: 已完成

#### 修订项 #9: 增量扫描快照与版本令牌契约缺失（发现 #8）
- **文件**: `_bmad-output/implementation-artifacts/stories/2-6-incremental-scan-and-document-lifecycle-detection.md`
- **章节**: Dev Notes > 生命周期检测逻辑
- **修改摘要**: 全面重写为包含输入契约的结构：定义 `CurrentFileSnapshot`（path + mtimeMs + contentHash）和 `StoredDocRecord`（docId + path + contentHash + lastObservedMtimeMs）两个输入类型；LifecycleResult 各字段补充 docId；定义 `detectLifecycle()` 函数签名；变更检测改为 `mtimeMs vs lastObservedMtimeMs`（同类时间戳比较），附语义说明
- **状态**: 已完成

#### 修订项 #10: Markdown 链接退化为仅相对路径（发现 #11）
- **文件**: `_bmad-output/implementation-artifacts/stories/2-2-scan-engine-core-pipeline-remark-ast-and-rules.md`
- **章节**: Dev Notes > 规则实现要点 > markdown-link-rule
- **修改摘要**: 从「只处理相对路径」改为「同时处理相对路径和绝对路径」；补充绝对路径解析规则（以 `/` 开头则相对于项目根目录解析）；新增跳过外部链接和锚点链接的说明
- **状态**: 已完成

### ⚠️ 超出范围提醒

| 来源发现 | 涉及文件 | 修订内容 | 建议处理方式 |
|---------|---------|---------|------------|
| #5 | Story 1-3 (`1-3-zod-validation-layer-and-core-type-definitions.md`) | `CordConfig.relationTypes` 类型签名从 `Record<string, unknown>` 收敛为明确的启用/禁用 schema | 在 Epic 1 范围内单独修订 |

---
Epic: 3
Scope: epic
Round: 1
Date: 2026-04-20
Model Used: Claude Opus 4.6 (claude-opus-4.6)
Review Source: epic-3-story-review-summary-20260420-round-1.md
Review Model: GPT-5.4 (gpt-5.4)
Type: Story Review Evaluation
---

## 评估总结

GPT-5.4 对 Epic 3 的首轮审查质量较高，11 条发现均有明确的文档证据支撑，未发现误报。审查准确识别了 Story 3.3–3.5 中多处共享契约缺口和 Story 与 Epic/PRD 的一致性回归。经逐条交叉验证，7 条发现确认为 P1 阻塞项（需修订后再审），4 条降级为 P2 后续改善跟踪。总体结论：当前 Epic 3 的 5 个 Story 均不宜直接进入开发，建议先完成 P1 项的修订。

## 发现 #1 评估

### 审查原文

> **[高] Story 3.3 的"完整影响分析"缺少明确的遍历边界**
> - 来源：structure+contract
> - 分类：decision_needed
> - 涉及 Story：3-3
> - 证据 - Story 3.3 说明复用 QueryService 的多跳遍历，但没有定义默认看几跳、是否固定三跳、是否允许调用方覆盖，导致"完整影响分析"存在多种合理实现。
> - 影响 - 影响分析结果集无法收敛，测试口径无法固定，后续 CLI 与 MCP 也会出现不同实现路径。
> - 建议 - 先在 Story 3.3 中明确 v0.1 的默认遍历边界、是否开放深度参数，以及该边界与 Story 3.2 的关系，再补测试任务。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — Story 3.3 的 ImpactService 构造函数注入了 QueryService，AC 依赖 Story 3.2 多跳遍历，但 AC 和 Dev Notes 均未指定默认深度或是否在 `ImpactInput` 中暴露 `depth` 参数。"完整影响分析"在无边界约束下确实存在多种合理解读。
**严重性判断**：合理 — 遍历深度直接影响结果集大小、性能特征和验收口径，属于核心设计参数。
**修订建议**：可行 — 在 Story 3.3 中明确默认遍历深度（如"默认三跳"或"遍历全图"）、是否允许调用方覆盖、以及与 Story 3.2 `--depth` 参数的关系，是合理且必要的修订。
**误报评估**：非误报 — 已交叉确认 Story 3.3 文本和 ImpactInput 类型定义均未包含深度相关字段。

## 发现 #2 评估

### 审查原文

> **[高] Story 3.4 导出完整关系图谱缺少明确的数据来源契约**
> - 来源：contract
> - 分类：decision_needed
> - 涉及 Story：3-4
> - 证据 - Story 1.4 的 IGraphRepository 没有全量关系枚举接口，而 Story 3.4 要求导出完整 `relations` 数组，却没有说明是扩仓储接口还是在 Service 层自行遍历+去重。
> - 影响 - 实现者会被迫擅自改写共享契约或在 Service 层引入隐式全表扫描逻辑，破坏架构边界。
> - 建议 - 先做设计裁决：要么正式扩展 IGraphRepository 的全量关系读取能力，要么在 Story 中写清遍历与去重规则，并同步补足任务。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 已验证 IGraphRepository 接口仅有 `getRelationsByDocId()`、`getRelationsByType()` 等按条件查询方法，确实没有 `getAllRelations()` 全量读取接口。`getAllDocuments()` 存在但关系侧缺失等价方法。
**严重性判断**：合理 — 导出需要全量数据，缺少接口意味着实现者必须自行决定是扩展仓储还是在 Service 层拼接，这是架构层面的设计裁决。
**修订建议**：可行 — 推荐正式扩展 IGraphRepository 添加 `getAllRelations(): RelationEdge[]` 方法，这与已有 `getAllDocuments()` 对称，且对 Story 1.4 的改动最小。
**误报评估**：非误报 — 接口定义已确认缺少全量关系读取能力。

## 发现 #3 评估

### 审查原文

> **[高] Story 3.5 的 schemaVersion 含义与来源不清，且与导出语义冲突**
> - 来源：consistency+contract
> - 分类：decision_needed
> - 涉及 Story：3-5
> - 证据 - StatusResult 将 `schemaVersion` 定义为 `number`，但全局 P10 已将 `schemaVersion` 固定为导出快照里的字符串 `1.0`；同时 D2 要求 `cord status` 展示迁移状态。
> - 影响 - 同一字段名在 status 与 export 中语义冲突，开发时极易出现硬编码或错误复用，验收也无法判断应展示哪种版本号。
> - 建议 - 拆分"导出 schema 版本"和"数据库迁移版本"两个概念；若 status 需要展示数据库版本，建议改名为 `migrationVersion` 或等价字段，并定义数据来源。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 三重冲突已确认：(1) StatusResult 的 `schemaVersion: number` 类型与 P10 导出格式 `"1.0"` (string) 矛盾；(2) D2 要求 `cord status` 展示"当前已执行迁移版本数及最新版本号"（来自 `schema_migrations` 表，INTEGER 类型）；(3) 导出的 `schemaVersion` 是 JSON 快照格式版本，而 status 中应是数据库迁移版本——两者是完全不同的概念。
**严重性判断**：合理 — 字段名与类型冲突会导致跨 Story 代码复用时产生静默错误，是架构一致性问题。
**修订建议**：可行 — 拆分为 `migrationVersion`（status 中展示数据库迁移版本）和保留 `schemaVersion`（仅用于导出快照格式版本），语义清晰且改动局限于 Story 3.5。
**误报评估**：非误报 — P10、D2、StatusResult 三处定义已交叉验证，确实存在语义和类型冲突。

## 发现 #4 评估

### 审查原文

> **[高] Story 3.5 的过时关系判定缺少"当前 mtime"数据来源**
> - 来源：contract
> - 分类：decision_needed
> - 涉及 Story：3-5
> - 证据 - AC 要求在"关联文档 mtime 新于关系创建时间"时报告过时关系，但共享契约只持久化了 `lastObservedMtimeMs`，并没有定义 StatusService 如何读取当前文件系统时间戳。
> - 影响 - 若不先明确数据源，开发只能误用旧扫描状态或临时耦合文件系统，结果会产生误报/漏报，测试也无法稳定。
> - 建议 - 明确口径：是读取当前文件系统 `stat`，还是只依据最近一次扫描状态做近似判断；并将所需输入或仓储扩展写入 Story。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — 已确认 SyncState 仅存储 `lastObservedMtimeMs`（上次扫描时观测值），relations 表存储 `created_at`。AC 3 要求"关联文档 mtime 新于关系创建时间"，但"mtime"是指当前文件系统 `stat` 结果还是 `lastObservedMtimeMs`，Story 未明确。两种方案的测试策略和架构耦合度完全不同。
**严重性判断**：合理 — 如果使用文件系统 `stat`，StatusService 需要注入文件系统访问能力，打破纯数据库查询的设计预期；如果使用 `lastObservedMtimeMs`，则只能反映上次扫描时的状态，可能存在滞后。这是需要明确裁决的设计选择。
**修订建议**：可行 — 推荐方案：v0.1 使用 `lastObservedMtimeMs` 与 `relation.created_at` 比较（近似判断，避免文件系统耦合），并在 Story AC 中明确标注此为近似方案。
**误报评估**：非误报 — 数据源口径确实未在 Story 中定义。

## 发现 #5 评估

### 审查原文

> **[高] Story 3.5 的 danglingEdges 检查与现有外键级联模型冲突**
> - 来源：contract
> - 分类：decision_needed
> - 涉及 Story：3-5
> - 证据 - Story 1.4 的 schema 通过外键约束和 `ON DELETE CASCADE` 在正常路径上防止悬空关系边，但 Story 3.5 仍将 `danglingEdges` 作为常规健康项，未说明这是数据库损坏诊断还是业务健康摘要。
> - 影响 - 当前 AC 会驱动实现者编写几乎永远返回 0 的死逻辑，或者绕过仓储边界直连底层数据库做诊断，两者都不合理。
> - 建议 - 二选一：将 danglingEdges 从 v0.1 常规健康检查中移除，或明确其为底层一致性诊断并新增对应能力契约。

### 评估结论：⚠️ 有效但降级 — 建议纳入后续改善跟踪（P2）

### 评估分析

**问题描述准确性**：准确 — 已确认 relations 表的 `source_doc_id` 和 `target_doc_id` 均设置了 `ON DELETE CASCADE`，正常操作路径下不会产生悬空边。审查对"死逻辑"的判断在技术层面成立。
**严重性判断**：偏高 — 审查将此标为[高]并归入 `decision_needed`，但实际影响有限。`danglingEdges` 作为防御性完整性检查是合理的（防范 SQLite 外键未启用、数据直接导入等异常场景），即使正常返回 0 也不构成功能性问题。实现上可通过 IGraphRepository 的现有方法（遍历文档和关系做交叉引用）完成，无需绕过仓储边界。
**修订建议**：可行但非必要 — 两种方案均可行，但 v0.1 保留该检查作为防御性措施更稳妥。建议仅在 Story 中补充一句说明其为"数据完整性防御检查，正常分支预期返回 0"即可。
**误报评估**：非误报 — CASCADE 冲突客观存在，但严重性不构成阻塞。

## 发现 #6 评估

### 审查原文

> **[高] Story 3.5 没有覆盖 FR5 要求的"CORD 配置状态"**
> - 来源：consistency+contract
> - 分类：patch
> - 涉及 Story：3-5
> - 证据 - FR5 与 Epic 3 的 Story 3.5 都要求 status 展示"CORD 配置状态和图谱健康信息"，但当前 AC 与 StatusResult 只覆盖图谱健康指标，没有任何配置状态字段。
> - 影响 - 即便实现完成现有 AC，仍然只交付了 FR5 的一半能力，后续会形成破坏性输出扩展。
> - 建议 - 在 Story 3.5 中补充 configStatus 或等价输出结构，并定义配置来源，例如 framework、ide、scanPaths、confidenceThreshold、配置文件位置或初始化状态。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — FR5 原文"用户可以查看当前项目的 CORD 配置状态和健康信息"，Epic 3.5 User Story 也写"查看当前项目的 CORD 配置状态和图谱健康信息"，但 Story AC 和 `StatusResult` 接口仅包含图谱健康指标（documentCount, relationCount 等），完全缺少配置状态字段。D6 定义了 7 项配置（framework, ide, scanPaths, excludePaths, confidenceThreshold, relationTypes, adapters），均未体现在 StatusResult 中。
**严重性判断**：合理 — 缺少 FR5 一半能力是功能性缺口，不是可选改进。
**修订建议**：可行 — 在 StatusResult 中增加配置状态相关字段（如 `configFilePath`, `framework`, `scanPaths` 等），数据来源为配置加载模块。
**误报评估**：非误报 — FR5、Epic 和 Story 三处文本已交叉对照，配置状态缺口确实存在。

## 发现 #7 评估

### 审查原文

> **[高] Story 3.1 弱化了全局错误契约，未明确 CordError 的 code 与 suggestion**
> - 来源：structure+consistency
> - 分类：patch
> - 涉及 Story：3-1
> - 证据 - Epic 3 与 project-context 明确要求查询不存在文档时返回包含错误码和建议操作的统一错误格式，但 Story 3.1 的 AC 仅保留"明确错误信息（NFR19）"。
> - 影响 - 实现者可能用普通字符串错误通过验收，导致 CLI/MCP 错误格式不一致，破坏全局 `CordError` 契约。
> - 建议 - 将 AC 8 改回"错误码 + 建议操作 + `CordError` 子类"三件套，并在任务和测试中覆盖该错误路径。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — Epic 3.1 AC 原文包含"（含错误码 + 建议操作，NFR19）"，但 Story 3.1 AC 8 仅保留"明确错误信息（NFR19）"，省略了"错误码 + 建议操作"关键约束。NFR19 明确要求 `[错误码] 错误描述 → 建议操作` 格式。D3 定义了 `CordError` 基类携带 `code: string` + `suggestion: string`。P12 定义了完整错误处理流程。Story 3.1 的 Dev Notes 中虽提到 `QueryError`，但未说明需携带 `code` 和 `suggestion` 字段。
**严重性判断**：合理 — Story 3.1 是 Epic 3 的首个 Story，其错误处理模式会被 3.2-3.5 沿用。在此处弱化会导致后续 Story 全部继承相同缺陷。
**修订建议**：可行 — 将 AC 8 修正为与 Epic 一致的"错误码 + 建议操作 + CordError 子类"表述，并在 Task 和测试中补充验证 `code`/`suggestion` 字段的覆盖。
**误报评估**：非误报 — Epic 和 Story 文本已逐字对照，确认存在关键约束丢失。

## 发现 #8 评估

### 审查原文

> **[中] Story 3.1 的"目标文档路径"字段与双向查询语义冲突**
> - 来源：structure+contract
> - 分类：patch
> - 涉及 Story：3-1
> - 证据 - Dev Notes 指定通过 `getRelationsByDocId(docId, 'both')` 查询双向关系，但 AC 要求输出"目标文档路径"。对入边关系而言，原始 `target` 可能就是当前文档本身。
> - 影响 - 结果字段含义不稳定，CLI 表格与 JSON 输出在入边场景下容易失真，后续 3.2/3.3 复用时也会继承该问题。
> - 建议 - 将字段改为 `relatedDocumentPath`，或同时输出 `sourceDocPath`、`targetDocPath` 与 `direction`，并补充入边/出边测试。

### 评估结论：⚠️ 有效但降级 — 建议纳入后续改善跟踪（P2）

### 评估分析

**问题描述准确性**：准确 — `getRelationsByDocId(docId, 'both')` 返回入边和出边。对入边（B → A），如果查询 A，relation 的 `target_doc_id` 就是 A 本身，输出"目标文档路径"会显示查询文档自身的路径，语义上确实不合理。
**严重性判断**：合理 — 审查标为[中]适当。字段命名是 API 设计问题，影响下游复用但不阻塞核心功能实现。Epic AC 原文即使用"目标文档路径"措辞，因此修正需同步更新 Epic。
**修订建议**：可行 — `relatedDocumentPath` 命名中性且语义清晰，或补充 `direction` 字段区分入出边。但考虑到此修改涉及 Epic AC 同步调整，建议纳入后续改善跟踪而非本轮阻塞。
**误报评估**：非误报 — 双向查询场景下的字段语义问题客观存在。

## 发现 #9 评估

### 审查原文

> **[中] Story 3.2 没有闭合多跳结果的去重与最短跳数契约**
> - 来源：consistency+contract
> - 分类：patch
> - 涉及 Story：3-2
> - 证据 - Story 3.2 要求 BFS、按距离排序、结果带 `hopDistance`，但没有定义多路径命中时的去重单位，也没有说明是否继续保持 3.1 的查询结果字段结构。当前伪代码在出队时 visited，会产生重复入队与不稳定的 hopDistance。
> - 影响 - BFS 正确性和输出结构都无法稳定验收，后续 ImpactService 复用多跳结果时会进一步放大结果漂移。
> - 建议 - 明确"每个相关文档只保留最短跳数"或其他唯一性规则，同时固定多跳结果的字段结构和排序键。

### 评估结论：⚠️ 有效但降级 — 建议纳入后续改善跟踪（P2）

### 评估分析

**问题描述准确性**：基本准确 — 关于"去重单位未定义"的观察是正确的：Story 3.2 没有说明结果以文档为单位还是以关系为单位去重。但审查中"不稳定的 hopDistance"的说法不完全准确：标准 BFS（FIFO 队列）保证首次出队即为最短路径，因此 hopDistance 在文档维度是稳定的。重复入队只影响队列效率，不影响最终 hopDistance 正确性。
**严重性判断**：合理 — 去重规则和结果字段结构的定义确实需要补充，但不构成功能性阻塞。BFS 核心算法方向正确，优化细节可在实现时闭合。
**修订建议**：可行 — 建议在 Story 中明确"结果以文档为去重单位，保留最短 hopDistance"规则，并固定与 3.1 兼容的字段结构。
**误报评估**：非误报 — 去重规则缺失确实存在，但 BFS hopDistance 不稳定的论断有小幅偏差。

## 发现 #10 评估

### 审查原文

> **[中] Story 3.3 丢失了"置信度阈值可配置"的 Epic 与 PRD 契约**
> - 来源：consistency+contract
> - 分类：patch
> - 涉及 Story：3-3
> - 证据 - Epic 3、PRD FR11 与 D6 都要求影响分析默认阈值为 0.50 且可通过配置调整，但 Story 3.3 只写了默认过滤 ≥ 0.50，没有说明配置来源、输入参数或优先级。
> - 影响 - 当前 Story 会默许实现把 0.50 硬编码，造成 CLI、MCP 与配置系统行为脱节，后续返工成本高。
> - 建议 - 在 Story 3.3 中明确 `ImpactInput` 的阈值字段与优先级，例如"显式输入 > 配置文件 > 默认 0.50"，并补充测试。

### 评估结论：✅ 确认有效 — 需要修订（P1 优先级）

### 评估分析

**问题描述准确性**：准确 — Epic 3.3 AC 原文"影响分析默认过滤置信度 ≥ 0.50 的关系（FR11），可通过配置调整"，Story 3.3 AC 4 仅保留"默认过滤置信度 ≥ 0.50 的关系（FR11）"，省略了"可通过配置调整"。FR11 明确写"用户可通过配置调整"。D6 定义了 `confidenceThreshold` 配置项及默认值 0.50。
**严重性判断**：偏低 — 审查标为[中]，但此发现是 Story 对 Epic/PRD 的直接回归——不是措辞优化而是功能缺失。丢失可配置性会导致 ImpactInput 缺少阈值参数、配置加载模块与 ImpactService 脱节、后续引入配置时需要重构接口签名。建议提升至 P1。
**修订建议**：可行 — 在 ImpactInput 中增加可选 `confidenceThreshold` 字段，定义优先级"显式输入 > 配置文件 > 默认 0.50"，并补充匹配的 AC 和测试。
**误报评估**：非误报 — Epic、PRD、D6 三处文本已交叉对照，"可配置"约束确实丢失。

## 发现 #11 评估

### 审查原文

> **[中] Story 3.4 的导出输入与 CLI 行为口径未闭合**
> - 来源：structure+consistency+contract
> - 分类：patch
> - 涉及 Story：3-4
> - 证据 - Story 3.4 没有定义 `project` 字段来源、项目根目录解析规则、默认文件名、覆盖策略，也漏掉了全局"所有 CLI 支持 `--json`"的约束。
> - 影响 - CLI 与共享 Service 的默认值来源会分叉，导出命令无法写出稳定测试，用户也无法预期同一路径下的覆盖行为。
> - 建议 - 在 Story 3.4 中补充 `ExportInput` 或等价输入结构，定义 `projectName`、`projectRoot`、`outputPath` 与覆盖策略，并把 `--json` 约束补入 AC。

### 评估结论：⚠️ 有效但降级 — 建议纳入后续改善跟踪（P2）

### 评估分析

**问题描述准确性**：基本准确 — `project` 字段来源、默认文件名、覆盖策略确实未在 Story 中明确。但关于 `--json` 约束：Story 3.4 的输出本身就是 JSON 文件（写入磁盘），CLI 的 `--json` flag 通常用于将命令输出格式切换为 JSON；对于 export 命令而言，"输出到 stdout 的操作状态信息"才需要 `--json`，而非导出数据本身。此处审查的 `--json` 关注点部分合理但优先级不高。
**严重性判断**：偏高 — `project` 来源和覆盖策略是实现细节，开发者可在实现时合理推导（如从 `cord.config.yaml` 或目录名获取 project，默认不覆盖并提示）。这些缺失不会导致架构错误，更接近于实现规格补充。
**修订建议**：可行但非阻塞 — 补充 `ExportInput` 结构和覆盖策略是好实践，但不具备阻塞开发的紧急性。建议作为 P2 在修订时一并补充。
**误报评估**：非误报 — 输入结构和 CLI 行为口径确实存在多处未定义项。

## 整体评估结论

### 需要修订（阻塞进入开发）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|------------|------|
| 1 | 影响分析遍历边界未定义 | [高] | P1 | 需裁决默认深度和参数暴露策略 |
| 2 | 导出全量关系数据来源契约缺失 | [高] | P1 | 需扩展 IGraphRepository 或定义遍历规则 |
| 3 | schemaVersion 语义与类型冲突 | [高] | P1 | 需拆分导出版本和迁移版本两个概念 |
| 4 | 过时关系判定 mtime 数据来源未定义 | [高] | P1 | 需裁决用文件系统 stat 还是 syncState |
| 6 | FR5 配置状态展示缺口 | [高] | P1 | 需在 StatusResult 中补充配置状态字段 |
| 7 | 错误契约弱化（缺 code + suggestion） | [高] | P1 | 需与 Epic/D3/NFR19 对齐 |
| 10 | 置信度阈值可配置约束丢失 | [中] | P1 | Epic/PRD 直接回归，需补充配置优先级 |

### 建议纳入后续改善跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|------------|------|
| 5 | danglingEdges 与 CASCADE 模型冲突 | [高] | P2 | 保留为防御性检查，补充说明即可 |
| 8 | 查询结果字段与双向语义冲突 | [中] | P2 | 改为中性命名，需同步更新 Epic |
| 9 | 多跳结果去重规则未闭合 | [中] | P2 | BFS 核心正确，补充去重单位定义 |
| 11 | 导出输入与 CLI 行为口径未闭合 | [中] | P2 | 补充 ExportInput 结构和覆盖策略 |

### 可忽略（误报）

| # | 发现 | 原始严重性 | 忽略理由 |
|---|------|----------|---------|
| — | 无 | — | 本轮审查未发现误报 |

### 评估决定

**整体结论**：需修订后再审

7 条 P1 发现分布在全部 5 个 Story 中（3-1: 1 条, 3-3: 2 条, 3-4: 1 条, 3-5: 3 条），涉及共享契约缺口、Epic/PRD 一致性回归和设计裁决缺失。建议按以下优先级修订：(1) 先完成 4 条 `decision_needed` 项的设计裁决（发现 1/2/3/4）；(2) 再补齐 3 条 `patch` 项的规格修正（发现 6/7/10）；(3) P2 项可在修订过程中顺带处理。修订完成后提交复审。

---

## 修订执行记录

### 修订执行记录
- **Date**: 2026-04-20
- **Model Used**: Claude Sonnet 4.6
- **Fix Items**: 7

#### 修订项 #1: 影响分析遍历边界未定义（发现 #1）
- **文件**: `_bmad-output/implementation-artifacts/stories/3-3-impactservice-change-impact-analysis.md`
- **章节**: Dev Notes → ImpactService 设计 + 新增「遍历深度裁决」小节
- **修改摘要**: 新增 `ImpactInput` 接口定义（含可选 `confidenceThreshold` 字段）；新增「遍历深度裁决（v0.1）」章节，明确 **v0.1 固定三跳**，不对外暴露 `depth` 参数，内部调用 QueryService 时传入 `depth: 3`，并说明与 Story 3.2 `--depth` 的关系及后续扩展路径
- **状态**: 已完成

#### 修订项 #2: 导出全量关系数据来源契约缺失（发现 #2）
- **文件**: `_bmad-output/implementation-artifacts/stories/3-4-json-snapshot-export.md`
- **章节**: Tasks / Subtasks + Dev Notes → 新增「全量关系数据来源裁决」小节
- **修改摘要**: Tasks 前新增 Task 0（前置骨架：为 `IGraphRepository` 添加 `getAllRelations(): RelationEdge[]`，在 Story 1.4 的 SQLite 实现类中补充）；Dev Notes 新增裁决章节，明确 **正式扩展 IGraphRepository**，ExportService 联调 `getAllDocuments()` + `getAllRelations()`，禁止在 Service 层自行拼接；补充 `project` 字段来源说明
- **状态**: 已完成

#### 修订项 #3: schemaVersion 语义与类型冲突（发现 #3）
- **文件**: `_bmad-output/implementation-artifacts/stories/3-5-statusservice-health-check.md`
- **章节**: Dev Notes → StatusResult 接口 + AC 5
- **修改摘要**: StatusResult 中将 `schemaVersion: number` 改为 `migrationVersion: number`，并在注释中明确区分两个概念（migrationVersion = 数据库已执行 DDL 迁移数，INTEGER；schemaVersion = 导出 JSON 快照格式版本，STRING，仅用于导出）；AC 5 同步修正为"显示当前数据库已执行的迁移版本数（`migrationVersion`），来自 `schema_migrations` 表，类型为 INTEGER"；StatusResult 中 `danglingEdges` 字段补充防御性检查说明
- **状态**: 已完成

#### 修订项 #4: 过时关系判定 mtime 数据来源未定义（发现 #4）
- **文件**: `_bmad-output/implementation-artifacts/stories/3-5-statusservice-health-check.md`
- **章节**: AC 3 + Dev Notes → 新增「过时关系判定口径（v0.1 裁决）」小节
- **修改摘要**: AC 3 明确改为"报告关联文档的 `lastObservedMtimeMs`（最近一次扫描观测值）新于该关系的 `created_at` 时报告为过时（v0.1 近似方案，避免文件系统耦合）"；Dev Notes 新增裁决小节，说明 v0.1 优点（无文件系统耦合）、限制（反映上次扫描时状态）与后续升级路径（注入 `IFileSystem.statFile()`）
- **状态**: 已完成

#### 修订项 #5: FR5 配置状态展示缺口（发现 #6）
- **文件**: `_bmad-output/implementation-artifacts/stories/3-5-statusservice-health-check.md`
- **章节**: AC 2 + Task 1 + Dev Notes → StatusResult 接口
- **修改摘要**: AC 2 补充"**和** CORD 配置状态（configFilePath、framework、scanPaths、excludePaths、confidenceThreshold）（FR5）"；Task 1 注明必须覆盖图谱健康指标和 CORD 配置状态两大能力块；StatusResult 接口新增配置状态字段分区（configFilePath、framework、scanPaths、excludePaths、confidenceThreshold），数据来源为配置加载模块
- **状态**: 已完成

#### 修订项 #6: 错误契约弱化——缺 code + suggestion（发现 #7）
- **文件**: `_bmad-output/implementation-artifacts/stories/3-1-queryservice-relation-query-one-hop-and-type-filter.md`
- **章节**: AC 8 + Task 4 + Dev Notes → 新增「错误处理约束」小节
- **修改摘要**: AC 8 从"明确错误信息（NFR19）"改为"抛出 `QueryError extends CordError`，包含错误码（`code`）和建议操作（`suggestion`），符合 NFR19 的 `[错误码] 错误描述 → 建议操作` 格式"；Task 4 补充"测试须验证 `QueryError` 携带有效 `code` 和 `suggestion` 字段"；Dev Notes 新增「错误处理约束」小节，给出 `QueryError extends CordError` 示例
- **状态**: 已完成

#### 修订项 #7: 置信度阈值可配置约束丢失（发现 #10）
- **文件**: `_bmad-output/implementation-artifacts/stories/3-3-impactservice-change-impact-analysis.md`
- **章节**: AC 4 + Dev Notes → ImpactInput 接口
- **修改摘要**: AC 4 补充"可通过配置调整，优先级：显式输入 > 配置文件 > 默认 0.50"；ImpactInput 接口新增可选字段 `confidenceThreshold?: number`，注释说明三级优先级及与 D6 `confidenceThreshold` 配置项的关系
- **状态**: 已完成

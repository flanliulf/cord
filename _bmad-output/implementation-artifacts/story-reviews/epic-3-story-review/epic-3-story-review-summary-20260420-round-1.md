---
Epic: 3
Scope: epic
Round: 1
Date: 2026-04-20
Model Used: GPT-5.4 (gpt-5.4)
Type: Story Review Summary
Stories Reviewed: 5
---

## 审查结论

首轮审查。共审查 Epic 3 下 5 个 Story。审查层状态：3/3 层完成。

- 通过：0 个
- 有条件通过：2 个
- 硬阻塞：3 个

总体判断：Epic 3 的能力边界和用户价值链路基本成立，Story 顺序也与依赖关系一致；但 Story 3.3、3.4、3.5 存在多处共享契约未闭合、边界含义冲突和实现输入缺失的问题。当前不建议直接进入开发，建议先补齐影响分析、导出、状态检查三块的契约与验收口径，再推进实现。

## 审查范围

- Story 文件：
  - `3-1-queryservice-relation-query-one-hop-and-type-filter.md`
  - `3-2-multi-hop-relation-traversal.md`
  - `3-3-impactservice-change-impact-analysis.md`
  - `3-4-json-snapshot-export.md`
  - `3-5-statusservice-health-check.md`
- 对照基准：
  - `_bmad-output/project-context.md`
  - `_bmad-output/planning-artifacts/prd.md`
  - `_bmad-output/planning-artifacts/epics/epic-3关系查询影响分析与数据导出.md`
  - `_bmad-output/planning-artifacts/architecture/03-core-architectural-decisions.md`
  - `_bmad-output/planning-artifacts/architecture/04-implementation-patterns-consistency-rules.md`
  - `_bmad-output/implementation-artifacts/stories/1-4-sqlite-storage-layer-and-data-migration.md`
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

### 1. [高] Story 3.3 的“完整影响分析”缺少明确的遍历边界
- **来源**：structure+contract
- **分类**：decision_needed
- **涉及 Story**：3-3
- **证据** - Story 3.3 说明复用 QueryService 的多跳遍历，但没有定义默认看几跳、是否固定三跳、是否允许调用方覆盖，导致“完整影响分析”存在多种合理实现。
- **影响** - 影响分析结果集无法收敛，测试口径无法固定，后续 CLI 与 MCP 也会出现不同实现路径。
- **建议** - 先在 Story 3.3 中明确 v0.1 的默认遍历边界、是否开放深度参数，以及该边界与 Story 3.2 的关系，再补测试任务。

### 2. [高] Story 3.4 导出完整关系图谱缺少明确的数据来源契约
- **来源**：contract
- **分类**：decision_needed
- **涉及 Story**：3-4
- **证据** - Story 1.4 的 IGraphRepository 没有全量关系枚举接口，而 Story 3.4 要求导出完整 `relations` 数组，却没有说明是扩仓储接口还是在 Service 层自行遍历+去重。
- **影响** - 实现者会被迫擅自改写共享契约或在 Service 层引入隐式全表扫描逻辑，破坏架构边界。
- **建议** - 先做设计裁决：要么正式扩展 IGraphRepository 的全量关系读取能力，要么在 Story 中写清遍历与去重规则，并同步补足任务。

### 3. [高] Story 3.5 的 schemaVersion 含义与来源不清，且与导出语义冲突
- **来源**：consistency+contract
- **分类**：decision_needed
- **涉及 Story**：3-5
- **证据** - StatusResult 将 `schemaVersion` 定义为 `number`，但全局 P10 已将 `schemaVersion` 固定为导出快照里的字符串 `1.0`；同时 D2 要求 `cord status` 展示迁移状态。
- **影响** - 同一字段名在 status 与 export 中语义冲突，开发时极易出现硬编码或错误复用，验收也无法判断应展示哪种版本号。
- **建议** - 拆分“导出 schema 版本”和“数据库迁移版本”两个概念；若 status 需要展示数据库版本，建议改名为 `migrationVersion` 或等价字段，并定义数据来源。

### 4. [高] Story 3.5 的过时关系判定缺少“当前 mtime”数据来源
- **来源**：contract
- **分类**：decision_needed
- **涉及 Story**：3-5
- **证据** - AC 要求在“关联文档 mtime 新于关系创建时间”时报告过时关系，但共享契约只持久化了 `lastObservedMtimeMs`，并没有定义 StatusService 如何读取当前文件系统时间戳。
- **影响** - 若不先明确数据源，开发只能误用旧扫描状态或临时耦合文件系统，结果会产生误报/漏报，测试也无法稳定。
- **建议** - 明确口径：是读取当前文件系统 `stat`，还是只依据最近一次扫描状态做近似判断；并将所需输入或仓储扩展写入 Story。

### 5. [高] Story 3.5 的 danglingEdges 检查与现有外键级联模型冲突
- **来源**：contract
- **分类**：decision_needed
- **涉及 Story**：3-5
- **证据** - Story 1.4 的 schema 通过外键约束和 `ON DELETE CASCADE` 在正常路径上防止悬空关系边，但 Story 3.5 仍将 `danglingEdges` 作为常规健康项，未说明这是数据库损坏诊断还是业务健康摘要。
- **影响** - 当前 AC 会驱动实现者编写几乎永远返回 0 的死逻辑，或者绕过仓储边界直连底层数据库做诊断，两者都不合理。
- **建议** - 二选一：将 danglingEdges 从 v0.1 常规健康检查中移除，或明确其为底层一致性诊断并新增对应能力契约。

### 6. [高] Story 3.5 没有覆盖 FR5 要求的“CORD 配置状态”
- **来源**：consistency+contract
- **分类**：patch
- **涉及 Story**：3-5
- **证据** - FR5 与 Epic 3 的 Story 3.5 都要求 status 展示“CORD 配置状态和图谱健康信息”，但当前 AC 与 StatusResult 只覆盖图谱健康指标，没有任何配置状态字段。
- **影响** - 即便实现完成现有 AC，仍然只交付了 FR5 的一半能力，后续会形成破坏性输出扩展。
- **建议** - 在 Story 3.5 中补充 configStatus 或等价输出结构，并定义配置来源，例如 framework、ide、scanPaths、confidenceThreshold、配置文件位置或初始化状态。

### 7. [高] Story 3.1 弱化了全局错误契约，未明确 CordError 的 code 与 suggestion
- **来源**：structure+consistency
- **分类**：patch
- **涉及 Story**：3-1
- **证据** - Epic 3 与 project-context 明确要求查询不存在文档时返回包含错误码和建议操作的统一错误格式，但 Story 3.1 的 AC 仅保留“明确错误信息（NFR19）”。
- **影响** - 实现者可能用普通字符串错误通过验收，导致 CLI/MCP 错误格式不一致，破坏全局 `CordError` 契约。
- **建议** - 将 AC 8 改回“错误码 + 建议操作 + `CordError` 子类”三件套，并在任务和测试中覆盖该错误路径。

### 8. [中] Story 3.1 的“目标文档路径”字段与双向查询语义冲突
- **来源**：structure+contract
- **分类**：patch
- **涉及 Story**：3-1
- **证据** - Dev Notes 指定通过 `getRelationsByDocId(docId, 'both')` 查询双向关系，但 AC 要求输出“目标文档路径”。对入边关系而言，原始 `target` 可能就是当前文档本身。
- **影响** - 结果字段含义不稳定，CLI 表格与 JSON 输出在入边场景下容易失真，后续 3.2/3.3 复用时也会继承该问题。
- **建议** - 将字段改为 `relatedDocumentPath`，或同时输出 `sourceDocPath`、`targetDocPath` 与 `direction`，并补充入边/出边测试。

### 9. [中] Story 3.2 没有闭合多跳结果的去重与最短跳数契约
- **来源**：consistency+contract
- **分类**：patch
- **涉及 Story**：3-2
- **证据** - Story 3.2 要求 BFS、按距离排序、结果带 `hopDistance`，但没有定义多路径命中时的去重单位，也没有说明是否继续保持 3.1 的查询结果字段结构。当前伪代码在出队时 visited，会产生重复入队与不稳定的 hopDistance。
- **影响** - BFS 正确性和输出结构都无法稳定验收，后续 ImpactService 复用多跳结果时会进一步放大结果漂移。
- **建议** - 明确“每个相关文档只保留最短跳数”或其他唯一性规则，同时固定多跳结果的字段结构和排序键。

### 10. [中] Story 3.3 丢失了“置信度阈值可配置”的 Epic 与 PRD 契约
- **来源**：consistency+contract
- **分类**：patch
- **涉及 Story**：3-3
- **证据** - Epic 3、PRD FR11 与 D6 都要求影响分析默认阈值为 0.50 且可通过配置调整，但 Story 3.3 只写了默认过滤 ≥ 0.50，没有说明配置来源、输入参数或优先级。
- **影响** - 当前 Story 会默许实现把 0.50 硬编码，造成 CLI、MCP 与配置系统行为脱节，后续返工成本高。
- **建议** - 在 Story 3.3 中明确 `ImpactInput` 的阈值字段与优先级，例如“显式输入 > 配置文件 > 默认 0.50”，并补充测试。

### 11. [中] Story 3.4 的导出输入与 CLI 行为口径未闭合
- **来源**：structure+consistency+contract
- **分类**：patch
- **涉及 Story**：3-4
- **证据** - Story 3.4 没有定义 `project` 字段来源、项目根目录解析规则、默认文件名、覆盖策略，也漏掉了全局“所有 CLI 支持 `--json`”的约束。
- **影响** - CLI 与共享 Service 的默认值来源会分叉，导出命令无法写出稳定测试，用户也无法预期同一路径下的覆盖行为。
- **建议** - 在 Story 3.4 中补充 `ExportInput` 或等价输入结构，定义 `projectName`、`projectRoot`、`outputPath` 与覆盖策略，并把 `--json` 约束补入 AC。

## 逐篇审查结论

### Story 3.1: QueryService 关系查询（一跳 + 类型过滤）

**结论：有条件通过**

**优点**
- 一跳查询、类型过滤、CLI 表格输出与 JSON 输出的主能力边界明确。
- Service 与 CLI 的分层方向正确，保持了薄壳意图。

**关键问题**
1. **错误契约被弱化** — 缺少 `CordError` 的 `code` 与 `suggestion` 约束，和 Epic/全局规则不一致。
2. **结果字段语义不稳** — “目标文档路径”与双向查询场景冲突，入边输出会失真。

**建议动作**
- 在 [3-1-queryservice-relation-query-one-hop-and-type-filter.md] 的 AC 和 Dev Notes 中补回统一错误契约。
- 将查询结果中的路径字段改为中性命名或补充方向字段，并增加入边/出边测试说明。

### Story 3.2: 多跳关系遍历

**结论：有条件通过**

**优点**
- 依赖链条清晰，能够直接承接 Story 3.1 的查询能力扩展。
- BFS 与环路处理方向合理，具备可实现基础。

**关键问题**
1. **多路径命中规则未定义** — 去重单位、最短跳数规则与结果字段结构均未闭合。

**建议动作**
- 在 [3-2-multi-hop-relation-traversal.md] 中明确多跳结果的唯一性规则、稳定排序和与 3.1 的字段兼容关系。

### Story 3.3: ImpactService 变更影响分析

**结论：硬阻塞**

**优点**
- 已有传播行为到建议动作的映射表，领域语义基础较好。
- 复用 QueryService 的方向合理，有利于减少重复逻辑。

**关键问题**
1. **影响分析边界未定义** — “完整影响分析”没有默认遍历深度或边界说明。
2. **置信度阈值口径缺失** — 漏掉了可配置约束，无法与 Epic/PRD 对齐。

**建议动作**
- 先在 [3-3-impactservice-change-impact-analysis.md] 中明确影响分析的默认深度、是否允许覆盖、配置优先级，再进入开发。

### Story 3.4: JSON 快照导出

**结论：硬阻塞**

**优点**
- JSON 外层结构与 P10 的总体方向一致。
- 导出能力与 Epic 用户价值匹配，作为独立 Story 拆分合理。

**关键问题**
1. **全量关系数据来源未定义** — 当前共享仓储契约不足以直接支撑完整导出。
2. **导出默认行为不闭合** — `project`、根目录、文件名、覆盖策略与 `--json` 均未明确。

**建议动作**
- 先在 [3-4-json-snapshot-export.md] 中完成仓储能力与导出输入边界的裁决，再补齐 CLI 行为约束。

### Story 3.5: StatusService 健康检查

**结论：硬阻塞**

**优点**
- 健康摘要目标明确，列出了文档/关系/分布等基础指标。
- 作为 Epic 3 的收口能力是合理的产品设计。

**关键问题**
1. **FR5 缺口** — 缺少配置状态展示。
2. **版本号语义冲突** — `schemaVersion` 与导出字段重名但语义不清。
3. **过时关系判定口径缺失** — 没有“当前 mtime”数据来源。
4. **danglingEdges 边界错误** — 与外键级联模型冲突。

**建议动作**
- 在 [3-5-statusservice-health-check.md] 中先澄清 status 的配置域、版本语义、关系过时判定口径和低层完整性诊断边界，再重新评估是否 ready-for-dev。

## 通过项

- Epic 3 的 Story 排序 `3.1 → 3.2 → 3.3`，以及 `3.4 / 3.5` 并行拆分，整体依赖关系清晰。
- 五个 Story 均保留了 Service + CLI 薄壳的总体架构方向，没有直接改写双入口共享 Service 层这一核心模式。
- Story 3.3 的传播行为映射、Story 3.4 的导出结构草案、Story 3.5 的基础健康指标列表，都为后续修订提供了可复用骨架。
- 本轮未识别出适合归入 defer 桶的“既有已知问题，非本次引入”项。
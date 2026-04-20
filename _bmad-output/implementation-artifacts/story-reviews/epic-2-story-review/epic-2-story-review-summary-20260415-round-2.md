---
Epic: 2
Scope: epic
Round: 2
Date: 2026-04-15
Model Used: GPT-5.4 (github-copilot)
Type: Story Review Summary
Stories Reviewed: 6
---

## 审查结论

复审。共审查 Epic 2 下 6 个 Story。审查层状态：3/3 层完成。

- 通过：2 个
- 有条件通过：0 个
- 硬阻塞：4 个

总体判断：Epic 2 相比第 1 轮已经有实质进展，适配器解析、来源字段、两阶段事务骨架和 Markdown 链接口径这几类基础修订已经落地；但共享契约仍未完全收敛，阻塞点从“完全缺失”转成了“半闭合后仍有残留或引入新的边界问题”。当前最主要的阻塞集中在 Story 2.3 到 2.6：BMAD 文档类型口径、relationTypes 与 configSchema 的跨 Epic 契约、scan relation provenance 的去重与 rebuild 语义、增量扫描对 SyncState/Repository/性能边界的依赖仍未闭合。

## 审查范围

- Story 文件：
  - `2-1-framework-adapter-interface-and-generic-fallback.md`
  - `2-2-scan-engine-core-pipeline-remark-ast-and-rules.md`
  - `2-3-bmad-framework-adapter-module.md`
  - `2-4-config-loading-and-document-scope.md`
  - `2-5-scanservice-cold-start-scan-and-graph-write.md`
  - `2-6-incremental-scan-and-document-lifecycle-detection.md`
- 对照基准：
  - `_bmad-output/project-context.md`
  - `_bmad-output/planning-artifacts/epics/epic-2文档扫描与关系图谱构建.md`
  - `_bmad-output/planning-artifacts/architecture/03-core-architectural-decisions.md`
  - `_bmad-output/planning-artifacts/architecture/04-implementation-patterns-consistency-rules.md`
  - `_bmad-output/implementation-artifacts/stories/1-1-project-initialization-and-directory-structure.md`
  - `_bmad-output/implementation-artifacts/stories/1-2-corderror-error-handling-and-logger-system.md`
  - `_bmad-output/implementation-artifacts/stories/1-3-zod-validation-layer-and-core-type-definitions.md`
  - `_bmad-output/implementation-artifacts/stories/1-4-sqlite-storage-layer-and-data-migration.md`
- 审查维度：
  - 上轮修订闭合度
  - 与 Epic 一致性
  - 与架构文档一致性
  - Story 间共享契约
  - 事务 / 增量扫描 / provenance 边界
  - 任务与测试闭环

## 上轮问题回顾

### 已修复
1. Round 1 / Finding #2 — 适配器解析与 Generic fallback 选择契约缺失
   - 修复位置：Story 2.1 增补 Adapter Resolution 契约、registry 顺序和 resolveAdapter。
   - 验证结果：本轮未再发现 generic 抢占具体适配器的直接契约缺口。

2. Round 1 / Finding #3 — 文档分类与预设规则未进入扫描执行链路
   - 修复位置：Story 2.5 新增 resolveAdapter、docType classify、preset merge、merge/dedupe 主链路。
   - 验证结果：基础执行链路已补上；但增量路径继承和返回值形状仍有新边界问题，已转入本轮新发现。

3. Round 1 / Finding #4 — 关系来源 auto_scan 与 framework_preset 契约冲突
   - 修复位置：Story 2.2 的 DiscoveredRelation 增加 source 字段，Story 2.5 AC #4 区分 auto_scan 与 framework_preset。
   - 验证结果：字段级冲突已闭合；但 provenance 在 dedupe 和 rebuild 语义上的保留规则仍是本轮新问题。

4. Round 1 / Finding #7 — rebuild 与增量事务边界未定义完整
   - 修复位置：Story 2.5 / 2.6 增补两阶段事务契约。
   - 验证结果：事务外计算、事务内短写的基本骨架已建立；但事务入口仍泄漏到底层 db，已转入本轮新发现。

5. Round 1 / Finding #11 — Markdown 链接支持从相对+绝对退化为仅相对
   - 修复位置：Story 2.2 的 markdown-link-rule 已恢复相对路径和绝对路径支持。
   - 验证结果：本轮未再发现该项残留。

### 仍为上轮遗留
1. Round 1 / Finding #1 — BMAD 文档类型范围与扫描输入契约冲突
   - 当前状态：方向已朝 Markdown-only 收敛，但只改了 Story 2.3 Dev Notes，未同步到 AC、Task 和 Epic 验收口径。

2. Round 1 / Finding #5 — relationTypes 扩展语义与固定 9 类关系模型冲突
   - 当前状态：Story 2.4 文本已收敛为 9 类固定关系配置，但 Story 1.3 的类型签名仍未闭合，且 Story 2.4 示例重新引入了无效键。

3. Round 1 / Finding #8 — 增量扫描快照、mtime 与 lifecycle-detector 契约缺失
   - 当前状态：Story 2.6 已引入 lastObservedMtimeMs，但 Story 1.4 的 SyncState / schema 尚未同步扩展。

4. Round 1 / Finding #9 — rename、move、delete 的存储语义与 Repository API 不匹配
   - 当前状态：updateDocument(docId, { path }) 的伪代码已修正，但 rename 与 delete 的 AC 文字仍未与 docId / cascade 模型收敛。

### 仍为非阻塞待办
1. Round 1 / Finding #6 — Story 2.4 中 `.cord` 是否纳入排除清单的口径仍未统一；当前仍属文档一致性问题，未扩大为新的核心设计冲突。
2. Round 1 / Finding #12 — CLI JSON、退出码、性能与测试任务仍未细化为完整任务矩阵；目前仍主要是追踪粒度问题，而非新的共享契约冲突。
3. Story 2.4 对 FR40 / FR41 的预设路径与用户覆盖优先级仍未拆成足够具体的任务与测试；目前更像任务闭环不足，而非架构方向错误。

## 新发现

### 1. [高][上轮遗留] Story 2.3 的 v0.1 文档类型收敛仍未同步到 AC、Task 与 Epic 验收口径
- **来源**：structure+consistency
- **分类**：patch
- **涉及 Story**：2-3
- **证据** - Story 2.3 的 Dev Notes 已声明 v0.1 仅支持 16 种 Markdown 文档类型，但 Story 2.3 的 AC、Task 与 Epic 2 中对应验收表述仍要求 18 种文档类型。
- **影响** - 测试范围与实现范围无法稳定对齐，首轮发现 #1 只能算部分闭合。
- **建议** - 将 Story 2.3 与 Epic 2 的 AC、Task、测试口径同步收敛为 v0.1 仅支持 16 种 Markdown 文档类型；若坚持 18 种，则必须回补 YAML 发现、解析和测试链路。

### 2. [中][新] Story 2.3 的多个 BMAD 文档类型 glob 仍无法命中当前仓库真实样本
- **来源**：structure+consistency+contract
- **分类**：patch
- **涉及 Story**：2-3
- **证据** - `architecture`、`validation-report`、`distillate` 仍使用前缀型 glob，但当前仓库对应真实样本分别是 `03-core-architectural-decisions.md`、`prd-validation-report.md`、`product-brief-cord-distillate.md`，并不匹配这些模式。
- **影响** - BmadFrameworkAdapter 可能在 CORD 自身样本上漏识别关键 BMAD 文档类型，削弱“开箱即用”的验收可信度。
- **建议** - 把模式改为目录型或包含式匹配，并把真实文件名加入 fixture 或回归测试。

### 3. [高][上轮遗留] Story 2.4 的 relationTypes 与 configSchema 共享契约仍未闭合，示例还重新引入了无效关系键
- **来源**：structure+consistency+contract
- **分类**：patch
- **涉及 Story**：2-4、1-3
- **证据** - Story 2.4 已把 relationTypes 收敛为固定 9 类关系的启用/禁用配置，但 Story 1.3 的 CordConfig 仍是任意键扩展；Story 2.4 也未显式绑定共享 configSchema，而且示例重新写入了不在 9 类基线中的 `depends_on`。
- **影响** - 配置层、类型层和 schema 层会继续出现两套真相，开发实现容易回退到私有 schema、类型断言或无效键配置。
- **建议** - 在 2.4 中明确复用共享 configSchema，并引入本 Story 的桥接约束；同时将示例键收敛到 9 类基线关系，并将 1.3 的类型签名继续标记为未闭合前置依赖。

### 4. [高][新] Story 2.5 的来源模型在去重与 rebuild 语义上仍不闭合
- **来源**：consistency+contract
- **分类**：patch
- **涉及 Story**：2-5、1-3、1-4
- **证据** - Story 2.5 已补 auto_scan 与 framework_preset 的来源区分，但 merge/dedupe 仍按 `sourceDoc + targetDoc + relationType` 去重，source 不在键内；同时 rebuild 采用全量删除后重写入，没有定义 manual 边的保留策略。
- **影响** - 当扫描规则与预设规则命中同一关系，或后续存在 manual 边时，图谱会丢失 provenance 或误删用户手工关系。
- **建议** - 明确 ScanService 只重建 scan-managed 边；为同一关系跨 source 的保留策略补充契约，或把 source 纳入去重和重建语义。

### 5. [高][新] Story 2.5 与 2.6 的两阶段事务伪码仍直接泄漏底层 db，绕过 IGraphRepository
- **来源**：contract+consistency
- **分类**：patch
- **涉及 Story**：2-5、2-6、1-4
- **证据** - 2.5 和 2.6 都新增了两阶段事务契约，但事务伪码仍直接调用 `db.transaction`，而 project-context 与 Story 1.4 都要求 Service 仅通过 IGraphRepository 获取事务能力。
- **影响** - Service 层会被迫依赖具体 SQLite 实现或数据库句柄，破坏依赖注入、测试替身和错误封装边界。
- **建议** - 统一把 `repo.transaction` 设为 Service 可见的唯一事务入口；若批量写入能力不足，应先补 1.4 的 Repository 接口。

### 6. [高][新] 冷启动与增量扫描的数据流仍不一致，2.6 未显式继承 2.5 的完整构建链路
- **来源**：consistency+contract
- **分类**：patch
- **涉及 Story**：2-5、2-6、2-2、1-4
- **证据** - Story 2.5 已确立 `pipeline.process -> docType classify -> preset merge -> merge/dedupe` 的完整流程，并应消费 ScanPipelineResult；但 2.6 的增量路径只写到对 modified 和 added 文档执行 `pipeline.process`，未显式继承完整子链路，也未说明 modified 文档旧关系如何替换。
- **影响** - 增量扫描可能丢失 framework_preset 刷新、warning 聚合和 dedupe 口径，还可能因旧关系未替换而产生唯一键冲突或冷启动/增量结果不等价。
- **建议** - 在 2.6 中明确复用 2.5 的完整构建子链路，并定义 modified 文档旧生成关系的替换策略；同时将 2.5 明确改为消费 ScanPipelineResult。

### 7. [高][上轮遗留] Story 2.6 的 lastObservedMtimeMs 仍未落到 Story 1.4 的共享 SyncState 与 schema 契约
- **来源**：consistency+contract
- **分类**：patch
- **涉及 Story**：2-6、1-4
- **证据** - Story 2.6 已把 `lastObservedMtimeMs` 设为增量比较和持久化的核心版本令牌，但 Story 1.4 的 SyncState、同步状态 Repository 接口和 sync_states 表结构仍只有 `lastScannedAt`。
- **影响** - 增量扫描无法在不偏离 1.4 共享契约的前提下合法持久化和读取版本令牌，开发者只能临时扩表或错误复用 `lastScannedAt`。
- **建议** - 把 `lastObservedMtimeMs` 正式前置到 1.4 的 SyncState、Repository 契约和 SQL 迁移中，再让 2.6 仅引用该基线。

### 8. [高][上轮遗留] Story 2.6 的 rename 与 delete 验收语义仍未与 docId 和级联删除模型收敛
- **来源**：structure+consistency+contract
- **分类**：patch
- **涉及 Story**：2-6、1-3、1-4
- **证据** - 2.6 的 Dev Notes 已把重命名/移动收敛为只更新 `documents.path`，删除依赖 `deleteDocument(docId)` 和级联删边；但 AC 仍要求“更新相关关系边”和“清理孤立节点”，与 1.3 / 1.4 的 docId 建边和外键级联模型形成两套真相。
- **影响** - 实现与验收会沿着不同语义前进：一类实现会额外重写关系边或尝试做未定义的孤立节点清理，另一类实现会按 docId 和外键级联处理，结果无法统一验收。
- **建议** - 将 2.6 和 Epic 2 的 AC 明确改写为：rename/move 只更新 `documents.path`；delete 依赖外键级联清理关联关系。若确需 orphan prune，应单独定义判定规则和 Repository 能力。

### 9. [中][新] Story 2.6 的生命周期分类与无变更快返口径仍不稳定，且当前快照契约会抵消性能目标
- **来源**：structure+contract
- **分类**：patch
- **涉及 Story**：2-6
- **证据** - Story 2.6 仍将 `renamed` 和 `moved` 拆成两个结果，但没有给出清晰的分类边界；Task 3.1 仍写“无 mtime 变化时直接返回”，而 Dev Notes 又要求先构建含 `contentHash` 的 CurrentFileSnapshot，并在 detectLifecycle 全部 unchanged 后才早退。
- **影响** - rename/move 测试口径会分裂；而无变更路径在当前契约下仍需全量计算 contentHash，很难稳定满足 p95 小于 100ms 的目标。
- **建议** - 补充 rename 与 move 的判定矩阵，或改为单一 pathChanged 事件；同时将快照契约拆为 mtime 预筛选和候选文件再算 contentHash 的两层策略，并把早退条件改写为 detectLifecycle 全部 unchanged。

## 逐篇审查结论

### Story 2.1: 框架适配器接口与通用规则退化

**结论：通过**

**优点**
- 已补上 Adapter Resolution 契约、registry 顺序和 Generic fallback 的优先级规则。
- Task 和测试层也开始覆盖 adapter resolution 的关键场景。

**关注点**
- 当前 Story 2.1 的 adapter 选择边界已基本收敛，后续只需在实现阶段严格通过 framework index 门面落地。

### Story 2.2: 扫描引擎核心管道（remark AST + 规则引擎）

**结论：通过**

**优点**
- Markdown 链接口径已恢复为支持相对路径和绝对路径。
- DiscoveredRelation 的 source 字段已加入，和后续 ScanService 对接的基本形状成立。

**关注点**
- 本轮关于 ScanPipelineResult 的问题主要落在 Story 2.5 如何消费 2.2 的结果，而不是 2.2 本身的结构缺失。

### Story 2.3: BMAD 框架适配模块

**结论：硬阻塞**

**优点**
- 已明确 v0.1 向 Markdown-only 收敛的方向。
- 仍保留将当前仓库作为真实样本的思路，方向正确。

**关键问题**
1. **v0.1 范围未同步到验收口径** — Dev Notes、AC、Task、Epic 仍是两套真相。
2. **glob 与真实样本脱节** — architecture、validation-report、distillate 三类仍会漏识别当前仓库中的真实样本。

**建议动作**
- 先统一 Story 2.3 与 Epic 2 的验收口径，再把 BMAD 类型模式改成能命中当前真实样本的规则。

### Story 2.4: 配置加载与文档管辖范围

**结论：硬阻塞**

**优点**
- relationTypes 的产品方向已经朝“固定 9 类关系的启用/禁用配置”收敛。
- 默认配置块开始补充 framework、ide、adapters 等未指定时的行为说明。

**关键问题**
1. **跨 Epic 共享契约仍未闭合** — Story 1.3 的 CordConfig / configSchema 仍未同步收敛。
2. **示例重新引入无效键** — `depends_on` 再次打开了“可扩展新关系类型”的歧义。

**建议动作**
- 在 Story 2.4 中增加对共享 configSchema 的显式绑定和桥接策略，并修正 relationTypes 示例键集合。

### Story 2.5: ScanService 冷启动扫描与图谱写入

**结论：硬阻塞**

**优点**
- 冷启动扫描的主链路已补出 resolveAdapter、classify、preset merge 和 dedupe 的骨架。
- 两阶段事务思路比第 1 轮清晰得多。

**关键问题**
1. **source provenance 仍不闭合** — dedupe / rebuild 没有定义 manual 边和跨 source 关系的保留策略。
2. **事务实现越过 Repository** — 伪码直接使用 `db.transaction`。
3. **与 2.2 的结果契约未完全对齐** — ScanPipelineResult、warnings 聚合和 downstream 消费仍有缺口。

**建议动作**
- 先收敛 provenance 保留规则和 repo.transaction 边界，再统一 2.5 对 2.2 结果结构的消费方式。

### Story 2.6: 增量扫描与文档生命周期检测

**结论：硬阻塞**

**优点**
- 已把增量扫描改写成两阶段结构，并显式引入 lastObservedMtimeMs 方向。
- updateDocument(docId, { path }) 的调用方向已比第 1 轮更贴近现有 Repository 模型。

**关键问题**
1. **SyncState 共享基线未闭合** — lastObservedMtimeMs 仍没有落到 1.4 的正式契约。
2. **rename/delete 验收口径仍冲突** — AC 与 Dev Notes 仍是两套语义。
3. **增量路径未完全继承冷启动链路** — classify、preset merge、关系替换和 warning 聚合都未写清。
4. **性能与生命周期分类口径不稳** — rename/move 边界和无变更快返条件都未完全收敛。

**建议动作**
- 先把 2.6 依赖的 1.4 共享契约补齐，再同步修订 Epic / Story AC，并将增量路径明确声明为复用 2.5 的完整构建链路。

## 通过项

- Story 2.1 的适配器解析契约已经可作为后续实现基线继续使用。
- Story 2.2 的 Markdown 链接支持和来源字段已经恢复到可开发状态。
- Story 2.5 / 2.6 已建立“事务外计算、事务内短写”的统一骨架，这比首轮的事务描述清晰得多。
- 已知非阻塞待办：
  - Story 2.4 的 `.cord` 排除清单仍未和 AC / Task 完全统一。
  - Story 2.4 对 FR40 / FR41 的预设路径与用户覆盖优先级仍需更细的任务和测试拆分。
  - Story 2.5 的 CLI JSON、退出码、性能与端到端测试任务仍可继续细化。

## 结论

- **结论**：不通过
- **阻塞项**：Story 2.3 的文档类型口径与样本匹配、Story 2.4 的 relationTypes/configSchema 共享契约、Story 2.5 的 provenance 与事务入口边界、Story 2.6 的 SyncState / AC / 增量链路闭合
- **建议**：先按“共享契约收敛”方式集中修 Story 2.3-2.6，再进行第 3 轮复审；本轮不建议直接进入开发
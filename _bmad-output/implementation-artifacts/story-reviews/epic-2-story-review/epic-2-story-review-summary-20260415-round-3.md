---
Epic: 2
Scope: epic
Round: 3
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

总体判断：Round 2 的方向性修订已经明显落地，16 种 v0.1 口径、`repo.transaction`、`lastObservedMtimeMs`、以及“增量复用冷启动完整构建链路”的基础表述都已补进文档；但第 3 轮复审确认，当前阻塞点已经从“缺少设计”转成了“新设计是否真实可实现”。最关键的问题集中在 Story 2.4-2.6 的共享边界仍未闭合：配置范围合成语义未定义、`--rebuild` 保留 `manual` 边与 1.4 的级联删除模型互相冲突、`ScanPipelineResult` / `warnings` 仍未贯通、增量路径的 `SyncState` 生命周期与无变更快返性能口径依旧不稳。Epic 2 目前仍不建议进入开发。

## 审查范围

- Story 文件：
  - `2-1-framework-adapter-interface-and-generic-fallback.md`
  - `2-2-scan-engine-core-pipeline-remark-ast-and-rules.md`
  - `2-3-bmad-framework-adapter-module.md`
  - `2-4-config-loading-and-document-scope.md`
  - `2-5-scanservice-cold-start-scan-and-graph-write.md`
  - `2-6-incremental-scan-and-document-lifecycle-detection.md`
- 复审输入：
  - `epic-2-story-review-summary-20260415-round-2.md`
  - `epic-2-story-review-evaluation-20260415-round-2.md`
- 对照基准：
  - `_bmad-output/project-context.md`
  - `_bmad-output/planning-artifacts/epics/epic-2文档扫描与关系图谱构建.md`
  - `_bmad-output/planning-artifacts/architecture/03-core-architectural-decisions.md`
  - `_bmad-output/planning-artifacts/architecture/04-implementation-patterns-consistency-rules.md`
  - `_bmad-output/implementation-artifacts/stories/1-2-corderror-error-handling-and-logger-system.md`
  - `_bmad-output/implementation-artifacts/stories/1-3-zod-validation-layer-and-core-type-definitions.md`
  - `_bmad-output/implementation-artifacts/stories/1-4-sqlite-storage-layer-and-data-migration.md`
- 审查维度：
  - Round 2 修订闭合度
  - 与 Epic 一致性
  - 与架构文档一致性
  - Story 间共享契约
  - 配置范围 / 预设路径合成语义
  - rebuild / provenance / transaction 边界
  - 增量扫描 / `SyncState` / 性能口径
  - 任务与测试闭环

## 上轮问题回顾

### 已修复
1. Round 2 / Finding #1 — Story 2.3 的 16 种 v0.1 Markdown 文档类型口径未同步到 AC、Task 与 Epic
   - 修复位置：Story 2.3 AC #2 / AC #6 / Task 1 已改为 16 种 v0.1 Markdown 类型；Epic 2 的 Story 2.3 验收口径已同步。
   - 验证结果：本轮未再发现“Story / Epic 仍写 18 种”的直接冲突。

2. Round 2 / Finding #2 — Story 2.3 的 glob 无法命中当前仓库真实样本
   - 修复位置：`architecture`、`validation-report`、`distillate` 等模式已从前缀匹配改为更宽的包含式或目录式匹配。
   - 验证结果：原来的“命不中真实样本”问题已关闭；但这轮确认宽放后的匹配范围缺少护栏，已转化为新的误识别风险。

3. Round 2 / Finding #5 — Story 2.5 / 2.6 的事务入口泄漏到底层 `db`
   - 修复位置：两篇 Story 的事务伪码均已收敛为 `repo.transaction(...)`。
   - 验证结果：P7 级别的 Service → Repository 事务入口边界已恢复。

4. Round 2 / Finding #7 — `lastObservedMtimeMs` 未落到 Story 1.4 共享契约
   - 修复位置：Story 1.4 的 `SyncState` 接口和 `sync_states` schema 已新增 `lastObservedMtimeMs` / `last_observed_mtime_ms`。
   - 验证结果：Round 2 的字段缺失问题已关闭；但这轮发现删除语义与 `deleted` 状态的生命周期仍未统一。

### 仍为上轮遗留
1. Round 2 / Finding #3 — Story 2.4 的 `relationTypes` / `configSchema` 共享契约未闭合
   - 当前状态：Story 2.4 已显式要求复用共享 `configSchema`，示例键也已改正；但 Story 1.3 的共享类型仍是宽口径，且 FR40 / FR41 的预设路径合成语义仍未写实。

2. Round 2 / Finding #4 — Story 2.5 的 source / rebuild 语义未闭合
   - 当前状态：文案已改为“仅重建 scan-managed 边并保留 `manual` 边”，但与 1.4 的 `documents` / `relations` / `sync_states` 级联删除模型仍冲突。

3. Round 2 / Finding #6 — Story 2.6 未完整继承冷启动构建链路
   - 当前状态：Story 2.6 已明确声明 modified / added 路径复用 Story 2.5 的完整构建子链路；但 `ScanPipelineResult`、`warnings` 聚合和 modified 文档节点写回仍未闭合。

4. Round 2 / Finding #8 / #9 — Story 2.6 的 rename / delete / 无变更快返口径仍不稳
   - 当前状态：docId 方向已写进 Dev Notes，但 AC 文字、`SyncState` 生命周期和全量 `contentHash` 前置计算仍未完全收敛。

### 仍为非阻塞待办
1. Round 1 / Finding #6 — Story 2.4 的 `.cord` 排除路径仍主要是 AC / Task / Dev Notes 之间的文档同步问题，暂未扩大成新的架构冲突。
2. Round 1 / Finding #12 — Story 2.5 的 CLI JSON、退出码、性能与测试任务粒度仍可继续细化，但不构成本轮新的核心阻塞。

## 新发现

### 1. [高][上轮遗留] Story 2.5 的 `--rebuild` 保留 `manual` 边承诺在当前数据模型下仍不可实现
- **来源**：structure+consistency+contract
- **分类**：patch
- **涉及 Story**：2-5、1-4
- **证据** - Story 2.5 的 Task 1.8、数据流说明和事务伪码都已写成“仅删除 `auto_scan` / `framework_preset` 边并保留 `manual` 边”，但同一伪码仍执行 `deleteAllDocuments()`；而 Story 1.4 的 `relations` 与 `sync_states` 均通过 `documents.id` 开启 `ON DELETE CASCADE`，删除文档会把依附其上的 `manual` 边和同步状态一并删掉。与此同时，Story 2.5 伪码调用的 `deleteRelationsBySource()`、`deleteAllDocuments()` 也未在 Story 1.4 的 `IGraphRepository` 中定义。
- **影响** - 当前设计会把“保留 `manual` 边”写成无法兑现的伪承诺。实现者要么违背 1.4 的 Repository 契约私自扩接口，要么在 `--rebuild` 时静默丢失用户手工关系和同步状态。
- **建议** - 先统一 rebuild 模型：要么明确 `--rebuild` 会重建全部 scan-managed 文档投影且不承诺保留 `manual` 边；要么改成基于稳定 docId / path 的原位 upsert，不再删除全部 `documents`。如果保留批量 source 级删除语义，必须同步前置到 Story 1.4 的 Repository 契约。

### 2. [高][上轮遗留] Story 2.4 的共享配置契约仍未真正定义 `effectiveScanPaths`
- **来源**：structure+consistency+contract
- **分类**：patch
- **涉及 Story**：2-4、1-3、2-3
- **证据** - Story 2.4 虽已在 Task 1.2 中要求复用共享 `configSchema`，并把 `relationTypes` 文本收敛为 9 类固定关系的启用/禁用配置，但 Story 1.3 的共享类型口径仍是宽松映射；更关键的是，FR40 / FR41 在 AC #7 / #8 中要求支持 framework / IDE 预设路径和用户覆盖，却没有定义“默认项目根 + 预设路径 + 用户 scanPaths”到底是替换、追加还是分层合并。当前 `DEFAULT_CONFIG.scanPaths = ['.']` 与 Story 2.3 已放宽的 BMAD glob 组合后，会把项目根下大量非目标文档一起纳入匹配候选。
- **影响** - 配置层仍没有单一真相。实现者可能分别在 config-loader、adapter 和扫描服务里各自决定范围合成策略，最终造成“同一份配置在不同路径下命中不同文档”的分叉实现。
- **建议** - 在 Story 2.4 中明确一个统一的 `effectiveScanPaths` 契约，至少写清：默认值、framework / IDE preset 的注入位置、用户覆盖优先级，以及这些路径是否限定 Story 2.3 的 doc-type glob 生效范围。同时继续把 `relationTypes` 的共享 schema / 类型收敛前置到 Story 1.3。

### 3. [高][新] Story 2.3 为修复漏识别而放宽的 glob 现在缺少范围护栏，并且没有被回归测试真正接住
- **来源**：structure+consistency+contract
- **分类**：patch
- **涉及 Story**：2-3、2-4
- **证据** - Story 2.3 现在已能命中当前仓库中的 `architecture`、`validation-report`、`distillate` 样本，但模式也被放宽到 `**/*validation*.md`、`**/*distillat*.md` 这类全仓库包含式匹配；在 Story 2.4 尚未收敛 `effectiveScanPaths` 的前提下，这会把技能模板、流程说明等大量非 BMAD 业务文档一起纳入候选。与此同时，Story 2.3 的 Task 6 / AC #6 仍只写“编写测试”和“16 种类型识别 + 预设规则匹配 + 检测逻辑”，并未把这些真实样本与误匹配回归用例显式写入验收。
- **影响** - Story 2.3 已从“漏识别真实样本”转成“可能在 CORD 自身仓库上大面积误识别内部资产”。这会直接破坏“BMAD 开箱即用”的语义边界，并使后续预设关系建立在错误分类之上。
- **建议** - 给 BMAD glob 增加目录护栏，或明确这些 glob 只对 Story 2.4 产出的 `effectiveScanPaths` 生效；同时在 Task 6 / AC #6 中补入基于当前仓库真实样本的正例与误匹配反例回归测试。

### 4. [高][新] Story 2.6 的删除路径与 `SyncState` 生命周期语义仍是两套模型
- **来源**：structure+consistency+contract
- **分类**：patch
- **涉及 Story**：2-6、1-4
- **证据** - Story 2.6 的事务步骤 7 已改为 `repo.deleteDocument(docId)` 并依赖级联删除关系，这与 Story 1.4 的 SQL 外键模型一致；但 Story 1.4 的 `SyncState.status` 仍保留 `deleted` 状态，Story 2.6 的步骤 11 又只写“upsert sync_states（包含更新后的 lastObservedMtimeMs）”，没有闭合 modified / renamed / deleted 路径分别要写哪些字段。更进一步，Story 2.6 的事务步骤只显式替换 modified 文档的旧 scan-managed 边，没有把 modified 文档节点自身的 `contentHash`、`title`、`docType`、`metadata` 更新写进事务写集。
- **影响** - 目前既无法稳定定义“删除后是否还保留 `deleted` 状态”，也无法保证 modified 文档扫描后 `documents` / `sync_states` 与真实文件保持一致。实现者很容易做出只换边、不更新文档节点和同步状态的半套增量流程。
- **建议** - 先统一生命周期模型：如果删除就是硬删除并依赖 cascade，则应撤回持久化 `deleted` 状态或改为软删除模型；同时把 modified / added / renamed / moved 路径需要写回的 `documents` 和 `sync_states` 字段清单明确写进 Story 2.6。

### 5. [高][上轮遗留] Story 2.5 / 2.6 仍未把 `ScanPipelineResult` 与 `warnings` 传播链路写实
- **来源**：consistency+contract
- **分类**：patch
- **涉及 Story**：2-5、2-6、2-2
- **证据** - Story 2.2 已把扫描管道返回值定义为 `ScanPipelineResult { document, relations, warnings }`；但 Story 2.5 的流程步骤 4 仍把 `pipeline.process(filePath)` 写成 `ParsedDocument + DiscoveredRelation[]`，Story 2.6 虽然声明复用 2.5 的完整构建子链路，也没有补出 modified / added 文档的 `warnings` 如何聚合到最终 `ScanResult` 与 CLI / JSON 输出。
- **影响** - 冷启动与增量扫描会继续对同一批异常文档产生不同可见性，一部分实现会把 warning 带到结果对象和 CLI，一部分则会静默吞掉，直接破坏 Story 2.2 与 Story 2.5 之间的共享接口口径。
- **建议** - 把 Story 2.5 的 Task 1.3、主流程和返回值统一改写为显式消费 `ScanPipelineResult`；同时在 Story 2.6 中定义 modified / added 文档的 `warnings` 汇聚与输出规则。

### 6. [中][上轮遗留] Story 2.6 的“无变更快速返回”在当前流程下仍难满足 NFR6
- **来源**：structure+consistency+contract
- **分类**：patch
- **涉及 Story**：2-6
- **证据** - Story 2.6 的 Task 3.1 与 AC #7 要求“无 mtime 变化时直接返回、p95 < 100ms”，但阶段 1 的步骤 2 仍要求对每个文件先收集 `fs.statSync + contentHash`，真正的早退发生在 detectLifecycle 之后。也就是说，无变更路径依旧会先对全量文档做 `contentHash` 计算；此外，`renamed` / `moved` 虽被拆成两个结果字段，但判定边界仍未定义，导致性能与行为口径都不稳定。
- **影响** - 当前设计下，无变更扫描并不是轻量元数据检查，而是“先读全量内容再判断能否早退”，这很难在中型仓库上稳定满足 NFR6；rename / move 的模糊分类也会进一步干扰测试与调试统计。
- **建议** - 将无变更快返拆成两阶段：先基于路径集合和 `mtimeMs` 做预筛选，只有候选变更文件再计算 `contentHash`；若 v0.1 对 rename / move 没有不同行为，也可合并成单一 `pathChanged` 语义，避免为无业务差异的分类引入额外复杂度。

## 逐篇审查结论

### Story 2.1: 框架适配器接口与通用规则退化

**结论：通过**

**优点**
- Adapter Resolution 契约、registry 顺序和 Generic fallback 优先级已经稳定。
- 本轮未再发现 2.1 与其余 Story 的新增共享边界冲突。

**关注点**
- 后续实现阶段只需严格通过 framework index / registry 门面落地，不要重新把选择逻辑散落到 Service 层。

### Story 2.2: 扫描引擎核心管道（remark AST + 规则引擎）

**结论：通过**

**优点**
- `ScanPipelineResult`、Markdown 链接支持和 `DiscoveredRelation.source` 的基线契约依然成立。
- 本轮问题主要落在 2.5 / 2.6 如何消费 2.2 的结果，而不是 2.2 自身的结构缺失。

**关注点**
- 进入实现前，需要确保 2.5 / 2.6 不再自行发明新的扫描返回值形状。

### Story 2.3: BMAD 框架适配模块

**结论：硬阻塞**

**优点**
- 16 种 v0.1 Markdown 文档类型口径已经同步到 Story 与 Epic 验收。
- 当前仓库中的关键 BMAD 样本已经不再被旧 glob 漏掉。

**关键问题**
1. **高召回 glob 失去范围护栏** — 修复漏识别后，`validation` / `distillate` 等模式已经扩展到全仓库匹配，但 Story 2.4 还没有定义这些模式应该只在哪些路径上生效。
2. **真实样本与误匹配回归测试缺失** — Task 6 / AC #6 还没有把“命中真实 BMAD 样本、同时避免误判内部模板文档”写成可执行验收。

**建议动作**
- 先和 Story 2.4 一起定义 `effectiveScanPaths` / 目录护栏，再把这些真实样本与反例固化进测试和验收语言。

### Story 2.4: 配置加载与文档管辖范围

**结论：硬阻塞**

**优点**
- `relationTypes` 的产品方向仍然保持在“固定 9 类关系的启用/禁用配置”。
- Task 1.2 已明确要求复用共享 `configSchema`，方向比前一轮清晰。

**关键问题**
1. **共享配置契约仍不完整** — Story 1.3 的共享类型与 Story 2.4 的收敛语义仍未完全统一。
2. **FR40 / FR41 没有单一的路径合成真相** — framework / IDE preset、默认项目根和用户 scanPaths 的覆盖优先级尚未定义。

**建议动作**
- 先补出 `effectiveScanPaths` 的统一语义，再把 `relationTypes` 的 schema / type 收敛继续前置到 Story 1.3。

### Story 2.5: ScanService 冷启动扫描与图谱写入

**结论：硬阻塞**

**优点**
- `repo.transaction` 边界已经回到正确方向。
- 冷启动完整链路的主干步骤仍然清晰，可继续作为增量路径的基线。

**关键问题**
1. **`--rebuild` 与 `manual` 边保留承诺不可同时成立** — 删除全部 `documents` 与保留 `manual` 边在 1.4 的级联删除模型下互相冲突。
2. **Repository 能力仍与伪码不一致** — rebuild 伪码需要的批量 source 级删除能力没有在 1.4 中定义。
3. **`ScanPipelineResult` / `warnings` 仍未闭合** — Story 2.5 还在使用过时的返回值形状。

**建议动作**
- 先收敛 rebuild 的真实数据模型，再同步调整 Story 1.4 的 Repository 契约和 Story 2.5 的主流程 / 返回值描述。

### Story 2.6: 增量扫描与文档生命周期检测

**结论：硬阻塞**

**优点**
- `lastObservedMtimeMs` 已经进入共享基线，增量比较方向正确。
- “modified / added 复用冷启动完整构建链路”的方向性修复已经写入 Dev Notes。

**关键问题**
1. **`SyncState` 生命周期仍未统一** — 删除语义、`deleted` 状态、modified 文档节点更新和同步状态写回仍是碎片化表述。
2. **增量路径还没有把 2.5 的结果契约真正接住** — `warnings` 聚合和 modified 文档写集不完整。
3. **无变更快返成本模型仍过高** — 当前流程仍在早退前全量计算 `contentHash`，难以稳定满足 NFR6。

**建议动作**
- 先把生命周期模型和事务写集写成唯一真相，再补无变更预筛选策略；否则增量扫描实现会继续在“只换边”与“完整更新文档节点”之间分叉。

## 通过项

- Story 2.3 与 Epic 2 的 16 种 v0.1 Markdown 文档类型口径已经同步。
- Story 2.5 / 2.6 的事务入口已统一回到 `repo.transaction(...)`。
- Story 1.4 已纳入 `lastObservedMtimeMs`，不再存在 Round 2 的字段级缺口。
- Story 2.6 已明确 modified / added 路径应复用冷启动完整构建子链路，方向性修复有效。
- 已知非阻塞待办：
  - Story 2.4 的 `.cord` 排除口径仍需和 AC / Task / Dev Notes 同步。
  - Story 2.5 的 CLI JSON、退出码和测试矩阵仍可继续细化。

## 结论
- **结论**：不通过
- **阻塞项**：Story 2.3 的 glob 范围护栏与回归测试、Story 2.4 的 `effectiveScanPaths` / 共享配置契约、Story 2.5 的 rebuild / `manual` 边 / Repository 能力闭合、Story 2.6 的 `SyncState` 生命周期 / modified 写集 / 无变更快返性能模型
- **建议**：先按“共享边界收敛”顺序集中修订 Story 2.4 → 2.5 / 1.4 → 2.6，再回到 Story 2.3 收紧 BMAD glob 与测试；完成后再进行第 4 轮复审，而不是直接进入开发
---
Epic: 2
Scope: epic
Round: 4
Date: 2026-04-16
Model Used: GPT-5.4 (github-copilot)
Type: Story Review Summary
Stories Reviewed: 6
---

## 审查结论

复审。共审查 Epic 2 下 6 个 Story。审查层状态：3/3 层完成。

- 通过：2 个
- 有条件通过：0 个
- 硬阻塞：4 个

总体判断：Round 3 已经修掉了几处“文档内部自相矛盾”的硬错误，但 Round 4 复审确认，Epic 2 仍未达到可开发状态。当前阻塞点已经进一步收敛为 4 组共享边界问题：`effectiveScanPaths` 的 owner 与执行时序尚未落位、`relationTypes` 仍是共享假契约、Story 2.5 的来源与 rebuild 口径仍和 Epic/架构基线打架、Story 2.6 的增量替换与 `SyncState` 写回仍可能破坏冷启动等价性。Epic 2 仍不建议进入开发。

## 审查范围

- Story 文件：
  - `2-1-framework-adapter-interface-and-generic-fallback.md`
  - `2-2-scan-engine-core-pipeline-remark-ast-and-rules.md`
  - `2-3-bmad-framework-adapter-module.md`
  - `2-4-config-loading-and-document-scope.md`
  - `2-5-scanservice-cold-start-scan-and-graph-write.md`
  - `2-6-incremental-scan-and-document-lifecycle-detection.md`
- 复审输入：
  - `epic-2-story-review-summary-20260415-round-3.md`
  - `epic-2-story-review-evaluation-20260415-round-3.md`
- 对照基准：
  - `_bmad-output/project-context.md`
  - `_bmad-output/planning-artifacts/epics/epic-2文档扫描与关系图谱构建.md`
  - `_bmad-output/planning-artifacts/architecture/03-core-architectural-decisions.md`
  - `_bmad-output/planning-artifacts/architecture/04-implementation-patterns-consistency-rules.md`
  - `_bmad-output/implementation-artifacts/stories/1-2-corderror-error-handling-and-logger-system.md`
  - `_bmad-output/implementation-artifacts/stories/1-3-zod-validation-layer-and-core-type-definitions.md`
  - `_bmad-output/implementation-artifacts/stories/1-4-sqlite-storage-layer-and-data-migration.md`
- 审查维度：
  - Round 3 修订闭合度
  - 与 Epic 一致性
  - 与架构基线一致性
  - Story 间共享契约
  - 路径范围与适配器边界
  - provenance / rebuild / transaction 边界
  - 增量扫描与冷启动结果等价性
  - `SyncState` / 生命周期写回契约

## 上轮问题回顾

### 已修复
1. Round 3 / Finding #1 — Story 2.5 的 rebuild 不再同时承诺“删光文档”与“保留 manual 边”
   - 修复位置：Story 2.5 已把 v0.1 `--rebuild` 改为 `deleteAllDocuments()` + 全量重建；Story 1.4 也补入 `deleteAllDocuments(): void`。
   - 验证结果：Round 3 的“同一 Story 内部自相矛盾”已关闭；但本轮确认它又和架构 D2 基线形成新冲突，已转入本轮新发现。

2. Round 3 / Finding #3 — Story 2.3 的 glob 护栏与反误匹配测试不再只停留在 Dev Notes
   - 修复位置：Story 2.3 的 AC #6 与 Task 6 已加入“正例命中 + 反例排除”测试要求。
   - 验证结果：原先“只有文案、没有验收入口”的问题已关闭；但这层护栏的执行 owner 仍未在 2.4 / 2.5 之间真正落位，已转入本轮新发现。

3. Round 3 / Finding #4 — Story 1.4 已移除 `SyncState.status = 'deleted'` 的死契约
   - 修复位置：Story 1.4 的 `SyncState.status` 已收敛为 `synced | modified`，SQL schema 注释同步更新。
   - 验证结果：Round 3 的“硬删除 + cascade 下无法持久化 deleted”问题已关闭；但 2.6 的部分写回对象仍不满足完整 `SyncState` 契约，已转入本轮遗留问题。

4. Round 3 / Finding #5 — Story 2.5 / 2.6 已显式改写为消费 `ScanPipelineResult` 并聚合 `warnings`
   - 修复位置：Story 2.5 的主流程第 4 步和 Story 2.6 的步骤 5 均已切换到 `ScanPipelineResult { document, relations, warnings }`。
   - 验证结果：Round 3 的“返回值形状完全不一致”问题已关闭；本轮未再发现 warning 通道本身的直接缺失。

### 仍为上轮遗留
1. Round 3 / Finding #2 — `effectiveScanPaths` 的范围契约虽然写入 2.4，但 owner、时序和 IDE 预设来源仍未闭合。
2. Round 3 / Finding #4 — `SyncState` 生命周期的 deleted 分支已删除，但 2.6 的写回对象仍未与 1.4 的完整接口契约对齐。

### 仍为非阻塞待办
1. Round 3 / Finding #6 — Story 2.6 的无变更快返仍在早退前全量计算 `contentHash`；该问题继续存在，但本轮仍维持 P2。
2. Story 2.6 / Epic 2 的 rename/delete AC 仍沿用旧的“更新关系边 / 清理孤立节点”措辞；因 Dev Notes 已提供正确实现口径，本轮继续视为非阻塞文案债务。

## 新发现

### 1. [高][新] `effectiveScanPaths` 的 owner、执行时序与 IDE 预设来源仍未闭合
- **来源**：structure+consistency+contract
- **分类**：patch
- **涉及 Story**：2-4、2-5、2-1、2-3
- **证据** - Story 2.4 已把 `effectiveScanPaths` 公式写入 Dev Notes，并声明由 ScanService 负责；但 Story 2.5 的主链仍是 `loadConfig -> resolveAdapter -> discoverDocuments(projectRoot, config)`，两阶段事务契约里也没有单独的路径合成步骤。与此同时，Story 2.1 的适配器接口仍把文件发现职责定义为 adapter 基于 `scanPaths` / `excludePaths` 递归遍历，Story 2.4 的 FR40 / FR41 又承诺要覆盖 framework 与 IDE 预设路径以及“用户覆盖预设”，但公式里只出现 framework adapter 路径来源，没有独立的 IDE 预设提供方。
- **影响** - `effectiveScanPaths` 现在仍然是“写出来了，但没有唯一 owner、没有正确时序、也没有完整来源集合”的半成品契约。Story 2.3 的 glob 护栏因此仍没有稳定承载点，FR38 / FR40 / FR41 在 config-loader、adapter 和 ScanService 之间仍可能出现分叉实现。
- **建议** - 二选一统一边界：要么把 `effectiveScanPaths` 明确前置到 ScanService 在 `discoverDocuments` 之前计算，并为 IDE 预设增加明确来源与测试；要么把这层责任彻底收回 adapter / discoverDocuments 契约，删除 2.4 中由 ScanService 合成路径的设计表述。

### 2. [高][上轮遗留] `relationTypes` 仍是假契约：共享 schema 未收敛，执行链路也没有统一过滤点
- **来源**：consistency+contract
- **分类**：patch
- **涉及 Story**：2-4、2-5、1-3
- **证据** - Story 2.4 AC #3 已把 `relationTypes` 定义为固定 9 类关系的启用/禁用配置，Task 1.2 也要求复用 Story 1.3 的共享 `configSchema`；但 Story 1.3 仍把 `relationTypes` 定义为 `Record<string, unknown>` 的“自定义关系类型扩展”。更进一步，Story 2.5 的主链只定义了 `pipeline.process -> docType classify -> preset merge -> merge/dedupe`，并没有写出任何统一步骤去对 `auto_scan` 与 `framework_preset` 两类关系同时应用 `relationTypes` 的 enabled/disabled 过滤。
- **影响** - 当前文档同时承诺了两套互不兼容的真相：产品语义上只能启停固定 9 类关系，类型与执行层面却仍允许任意键、且没有明确执行过滤点。实现者会在“规则层禁用”“合并后过滤”或“完全忽略配置”之间各自猜测，图谱结果无法稳定一致。
- **建议** - 先把 Story 1.3 与架构 D6 的 `relationTypes` 基线收敛为固定 9 类 enable/disable schema，再让 Story 2.4 复用；同时在 Story 2.5 明确增加统一过滤步骤，覆盖 scan results 与 preset results 两条来源。

### 3. [高][新] Story 2.5 的来源口径仍在 Epic / Story 两层保持两套真相
- **来源**：structure+consistency
- **分类**：patch
- **涉及 Story**：2-5、2-6
- **证据** - Story 2.5 AC #4 已明确区分 `auto_scan` 与 `framework_preset` 两种来源，Story 2.6 也声明增量路径复用同一条 `preset merge` 链路；但 Epic 2 对 Story 2.5 的 AC 仍写“每条关系记录来源为自动扫描”。
- **影响** - framework preset 关系在 Story 层被要求实现，在 Epic 层却仍像是“不合规产物”。这会直接导致验收断言、测试预期和后续复审结论彼此冲突。
- **建议** - 同步改写 Epic 2 的 Story 2.5 验收口径，明确 `auto_scan` 与 `framework_preset` 都是合法扫描来源，并保留获胜记录的原始 source 值。

### 4. [高][新] Story 2.5 的 v0.1 全量 rebuild 现在与架构 D2“手动关系必须保留”直接冲突
- **来源**：consistency+contract
- **分类**：decision_needed
- **涉及 Story**：2-5、1-4
- **证据** - Story 2.5 已把 `--rebuild` 改为 `deleteAllDocuments()` + 全量重建，并明确“v0.1 不保留 manual 边”；Story 1.4 也已加入 `deleteAllDocuments(): void` 来支撑这一流程。但架构文档 D2 仍写明“用户手动添加的关系必须保留，排除按需重建方案”。
- **影响** - Round 3 修订虽然消除了 Story 2.5 内部的逻辑自撞，却把冲突上移到了架构层。后续 Epic 4 一旦真正引入 manual 关系，这里会立刻重新变成真实的数据保留风险。
- **建议** - 做一次显式决策：要么把 D2 收窄为“仅约束迁移策略，不约束 scan rebuild”；要么撤回 Story 2.5 当前的“v0.1 不保留 manual 边”表述。两份文档必须同步，否则 Epic 2 仍不具备稳定基线。

### 5. [高][新] Story 2.6 对 modified 文档使用 `deleteRelationsByDocId(docId)` 仍会误删未修改文档的入边
- **来源**：structure+consistency+contract
- **分类**：patch
- **涉及 Story**：2-6、1-4
- **证据** - Story 2.6 只声明对 `modified + added` 文档复用冷启动构建子链路，但事务步骤 9 直接对 modified 文档执行 `deleteRelationsByDocId(docId)`。Story 1.4 只给 `getRelationsByDocId()` 定义了 `source|target|both` 方向参数，`deleteRelationsByDocId()` 却没有方向约束；这意味着当前共享接口表达的是“按 docId 双向删边”，而不是“只替换当前文档作为 source 的可重建关系”。
- **影响** - 增量扫描会把来自未修改文档、仍然合法的 inbound relations 一起删掉，而这些 source 文档又不会被重算，最终使增量结果小于冷启动 / rebuild 结果，破坏 2.6 自己承诺的结果等价性。
- **建议** - 先在 Story 1.4 增补能够表达“仅替换某文档 outgoing scan-managed relations”的 Repository 契约，再让 Story 2.6 依该契约改写步骤 9；在此之前，不应把 `deleteRelationsByDocId()` 写成 modified 文档的安全替换语义。

### 6. [高][上轮遗留] Story 2.6 的 `sync_state` 写回仍未满足 Story 1.4 的完整 `SyncState` 契约
- **来源**：structure+consistency+contract
- **分类**：patch
- **涉及 Story**：2-6、1-4
- **证据** - Story 1.4 的 `SyncState` 仍要求 `docId`、`lastScannedAt`、`lastObservedMtimeMs`、`contentHash`、`status` 全字段存在，`upsertSyncState()` 也仍接收完整对象；但 Story 2.6 步骤 11 中，added / modified 分支只写到 `docId + status + lastObservedMtimeMs + contentHash`，缺少 `lastScannedAt`，renamed / moved 分支更只写 `docId + lastObservedMtimeMs`。同时，`LifecycleResult.renamed/moved` 载荷本身也没有提供这些缺失字段的来源。
- **影响** - 当前设计无法在不发明“部分 upsert”隐式语义的前提下满足 1.4 的 Repository 契约。实现者要么会私自放宽接口，要么会偷偷复用旧值，导致 rename/move 之后的同步基线不可靠。
- **建议** - 要么让 Story 2.6 对 added / modified / renamed / moved 一律写入完整 `SyncState` 对象，并明确 `lastScannedAt` 与 `contentHash` 的来源；要么先回到 Story 1.4 新增 patch 型接口，再让 Story 2.6 改为调用该接口，而不是继续复用完整 upsert 语义。

## 逐篇审查结论

### Story 2.1: 框架适配器接口与通用规则退化

**结论：通过**

**优点**
- 适配器解析契约、registry 顺序和 Generic fallback 仍然稳定。
- 本轮没有发现 2.1 自身的新结构缺陷。

**关注点**
- Story 2.1 的文件发现接口已经被卷入 `effectiveScanPaths` owner 冲突，后续若修 2.4 / 2.5，需同步校正 2.1 的 discoverDocuments 职责描述。

### Story 2.2: 扫描引擎核心管道（remark AST + 规则引擎）

**结论：通过**

**优点**
- `ScanPipelineResult` 与 `warnings` 基线已被 2.5 / 2.6 正式引用。
- 本轮未再发现 2.2 自身的共享接口缺口。

**关注点**
- 2.5 / 2.6 的后续修订需要继续保持对 2.2 返回值形状的一致消费。

### Story 2.3: BMAD 框架适配模块

**结论：硬阻塞**

**优点**
- 16 种 v0.1 Markdown 文档类型口径已稳定。
- glob 护栏和误匹配测试要求已进入 AC / Task。

**关键问题**
1. **glob 护栏缺少稳定执行 owner** — 2.3 已声明“只在 `effectiveScanPaths` 候选文件上匹配”，但 2.4 / 2.5 还没有把这条边界真正接住。

**建议动作**
- 待 2.4 / 2.5 先把路径 owner 和 discoverDocuments 时序收敛后，再判断 2.3 能否真正转为通过。

### Story 2.4: 配置加载与文档管辖范围

**结论：硬阻塞**

**优点**
- `effectiveScanPaths` 终于被显式写出，不再是隐含概念。
- `relationTypes` 的产品语义仍然坚持固定 9 类开关，方向正确。

**关键问题**
1. **路径 owner 与时序未闭合** — ScanService、adapter 和 discoverDocuments 仍然共享同一段边界。
2. **FR40 / FR41 仍不完整** — IDE 预设来源和“用户覆盖预设”的精确定义缺失。
3. **`relationTypes` 仍是假契约** — 共享 schema 未收敛，执行层也没有统一过滤点。

**建议动作**
- 先统一 `effectiveScanPaths` 的 owner 与时序，再回头收敛 Story 1.3 / D6 的 `relationTypes` 基线。

### Story 2.5: ScanService 冷启动扫描与图谱写入

**结论：硬阻塞**

**优点**
- `ScanPipelineResult` / `warnings` 已接入主链。
- rebuild 不再自我矛盾，Story 内部逻辑比 round 3 前清晰。

**关键问题**
1. **来源口径仍分裂** — Epic 2 还停留在“全部关系来自自动扫描”的旧 AC。
2. **rebuild 与架构 D2 冲突** — Story 已允许 v0.1 清掉 manual 边，但架构基线仍要求保留用户手工关系。
3. **路径 owner 未落位** — 2.5 仍没有明确承接 2.4 的 `effectiveScanPaths` 契约。

**建议动作**
- 先统一 Epic / Story / 架构三层关于来源和 rebuild 的单一真相，再进入开发。

### Story 2.6: 增量扫描与文档生命周期检测

**结论：硬阻塞**

**优点**
- modified 文档节点更新已经不再缺失。
- `ScanPipelineResult` 与 `warnings` 主链已经补入。

**关键问题**
1. **modified 文档删边语义过宽** — 当前 `deleteRelationsByDocId(docId)` 会误删来自未修改文档的入边。
2. **`sync_state` 写回仍不满足 1.4 契约** — 2.6 仍在写部分对象，1.4 仍要求完整 `SyncState`。

**建议动作**
- 先补 Repository 侧“定向替换可重建关系”的契约，再统一 2.6 的完整 `SyncState` 写回模型。

## 通过项

- Story 2.5 / 1.4 已不再保留 Round 3 之前那种“内部自相矛盾”的 rebuild 契约。
- Story 2.3 的 glob 护栏与反例测试要求已经进入 AC / Task，而非停留在 Dev Notes。
- Story 1.4 已移除 `deleted` 状态死分支，`lastObservedMtimeMs` 与 `deleteAllDocuments()` 也已纳入共享基线。
- Story 2.5 / 2.6 已显式改为消费 `ScanPipelineResult` 并聚合 `warnings`。
- 已知非阻塞待办：
  - Story 2.6 / Epic 2 的 rename/delete AC 旧口径仍需文案收敛。
  - Story 2.6 的无变更快返成本模型仍需后续优化才能稳住 NFR6。

## 结论
- **结论**：不通过
- **阻塞项**：`effectiveScanPaths` owner 与执行时序、`relationTypes` 共享 schema 与统一过滤、Epic 2 / Story 2.5 的来源与 rebuild 基线冲突、Story 2.6 的删边方向与 `SyncState` 完整写回
- **建议**：先按顺序收敛 2.4 / 2.5 / 2.1 的路径边界，再同步 1.3 / D6 的 `relationTypes` 基线，随后修正 Epic 2 的 2.5 AC 与架构 D2 的 rebuild 决策，最后回到 2.6 修定向删边与完整 `SyncState` 写回；完成后再提交第 5 轮复审
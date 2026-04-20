---
Epic: 2
Scope: epic
Round: 6
Date: 2026-04-16
Model Used: GPT-5.4 (github-copilot)
Type: Story Review Summary
Stories Reviewed: 6
---

## 审查结论

复审。共审查 Epic 2 下 6 个 Story。审查层状态：3/3 层完成。

- 通过：3 个
- 有条件通过：1 个
- 硬阻塞：2 个

总体判断：Round 5 的 P1 修订已经实际关闭了一条关键阻塞线：Story 2.6 的 renamed/moved `SyncState` 写回数据来源现在已经有了可追溯载体；Story 2.4 / 架构 D6 / Story 2.5 主流程上的 `relationTypes` 旧口径也已基本同步。本轮复审确认，Epic 2 剩余阻塞已经进一步收敛到 2 个核心问题：一是 Story 2.6 的增量入口和完整构建子链路仍未真正复用 Story 2.5 的冷启动链路，导致 `effectiveScanPaths` 与 `relationTypes` 的端到端闭合仍差最后一段；二是 rename/move 仍被建模为“只更新 path”，但 Epic 2 的 docType、相对路径解析与 `framework_preset` 规则本身都是路径敏感的，这使增量结果仍不能保证与冷启动或 rebuild 等价。Epic 2 仍不建议进入开发，但阻塞面已经明显缩小。

## 审查范围

- Story 文件：
  - `2-1-framework-adapter-interface-and-generic-fallback.md`
  - `2-2-scan-engine-core-pipeline-remark-ast-and-rules.md`
  - `2-3-bmad-framework-adapter-module.md`
  - `2-4-config-loading-and-document-scope.md`
  - `2-5-scanservice-cold-start-scan-and-graph-write.md`
  - `2-6-incremental-scan-and-document-lifecycle-detection.md`
- 复审输入：
  - `epic-2-story-review-summary-20260416-round-5.md`
  - `epic-2-story-review-evaluation-20260416-round-5.md`
- 对照基准：
  - `_bmad-output/project-context.md`
  - `_bmad-output/planning-artifacts/epics/epic-2文档扫描与关系图谱构建.md`
  - `_bmad-output/planning-artifacts/architecture/03-core-architectural-decisions.md`
  - `_bmad-output/planning-artifacts/architecture/04-implementation-patterns-consistency-rules.md`
  - `_bmad-output/implementation-artifacts/stories/1-3-zod-validation-layer-and-core-type-definitions.md`
  - `_bmad-output/implementation-artifacts/stories/1-4-sqlite-storage-layer-and-data-migration.md`
- 审查维度：
  - Round 5 修订闭合度
  - 冷启动与增量路径的一致性
  - `effectiveScanPaths` / `discoverDocuments` owner
  - `relationTypes` 的端到端执行闭环
  - rename/move 生命周期契约
  - 路径敏感 docType / preset / relation 刷新边界

## 上轮问题回顾

### 已修复
1. Round 5 / Finding #4 — Story 2.6 的 renamed/moved `SyncState` 写回数据来源缺口
   - 修复位置：Story 2.6 的 `StoredDocRecord` 已新增 `status` 字段，`LifecycleResult.renamed/moved` 已新增 `currentMtimeMs` 字段。
   - 验证结果：步骤 11 需要的 `stored.status` 与当前文件 mtime 现在都有明确的数据承载结构，该问题不再单独构成本轮阻塞。

### 仍为上轮遗留
1. Round 5 / Finding #1 — `effectiveScanPaths` 冷启动/增量入口残留不一致
   - 当前状态：Story 2.4 的时序说明已修到“步骤 2b，步骤 3 之前”，Story 2.5 的阶段 1 也已补入 `computeEffectiveScanPaths`；但 Story 2.6 仍未把增量入口写成对 2.5 完整前置发现链路的显式复用。

2. Round 5 / Finding #3 — `relationTypes` 过期文案 + 执行链无过滤步骤
   - 当前状态：Story 2.4 与架构 D6 的旧口径已清理，Story 2.5 主流程和任务也已补入 `relationTypes` 过滤；但 Story 2.5 的阶段 1 契约与 Story 2.6 的“完整构建子链路”描述仍未显式包含该步骤。

### 仍为非阻塞待办
1. Round 5 / Finding #2 — IDE preset provider 当前 Epic 缺失
   - 维持 P2：`config.ide` 为空时当前链路仍可执行；建议后续仅补 v0.1 范围说明或最小 provider owner。

2. Round 5 / Finding #5 — inbound `framework_preset` 边增量刷新不完整
   - 维持 P2：针对“仅 modified 内容变化”的场景，本轮仍不升级；但与 rename/move 结合后的路径敏感变体已在本轮升级为新的阻塞项。

3. Story 2.6 无变更快返前仍全量计算 `contentHash`
   - 继续维持 P2，不作为本轮新阻塞。

4. Epic 2 / Story 2.6 的 rename/delete AC 旧措辞
   - 继续视为文案债务，除非后续再次与事务契约产生新的直接冲突。

## 新发现

### 1. [高][上轮遗留] Story 2.6 仍未显式复用 2.5 的完整前置发现链路
- **来源**：structure+consistency
- **分类**：patch
- **涉及 Story**：2-1、2-5、2-6
- **证据** - Story 2.1 已将 `discoverDocuments` 收敛为 `discoverDocuments(projectRoot, scanPaths, excludePaths)`，Story 2.5 也已明确冷启动主链为 `loadConfig -> resolveAdapter -> computeEffectiveScanPaths -> adapter.discoverDocuments(projectRoot, scanPaths, excludePaths)`；但 Story 2.6 的阶段 1 仍从 `discoverDocuments(effectiveScanPaths, excludePaths)` 直接起步，未显式复用同一条前置发现链路。
- **影响** - 增量路径仍像是在定义一条裁剪版 discovery 入口，而不是复用冷启动的同一 owner 与同一顺序。实现时容易绕过 `projectRoot`、adapter resolution 或 `effectiveScanPaths` 的唯一落点，导致冷启动与增量扫描候选文件集合不再稳定等价。
- **建议** - 将 Story 2.6 的阶段 1 直接改写为“复用 Story 2.5 的步骤 1-3”，至少显式写出 `loadConfig(projectRoot) -> resolveAdapter(config, projectRoot) -> computeEffectiveScanPaths(config, adapter) -> adapter.discoverDocuments(projectRoot, scanPaths, excludePaths)`。

### 2. [高][上轮遗留] `relationTypes` 过滤仍未进入 2.5 阶段契约与 2.6 完整构建子链路
- **来源**：structure+consistency
- **分类**：patch
- **涉及 Story**：2-5、2-6
- **证据** - Story 2.5 的 Task 1.3 与主流程 7c 已补入 `relationTypes` 过滤，说明 schema 层和主链层已经对齐；但 Story 2.5 的两阶段事务“阶段 1”仍只声明 `pipeline.process + docType classify + preset merge + merge/dedupe`，Story 2.6 的步骤 5 也仍把“与冷启动相同的完整构建子链路”显式写到 `merge/dedupe` 为止。
- **影响** - `relationTypes` 目前已经不再是 2.4 / 1.3 / D6 的口径问题，而是最后一段执行闭环问题。若阶段契约与增量复用链路不显式纳入该步骤，禁用关系类型不会进入写入计划这一 AC 语义仍无法端到端稳定验证。
- **建议** - 把 `relationTypes` 过滤补入 Story 2.5 的阶段 1 产物定义，并在 Story 2.6 步骤 5 明确声明“复用 Story 2.5 的完整构建链路”，或至少显式补出该过滤步骤。

### 3. [高][新] rename/move 仍被建模为仅更新 path，路径敏感关系刷新无法保证
- **来源**：structure+consistency+contract
- **分类**：patch
- **涉及 Story**：2-3、2-5、2-6
- **证据** - Story 2.6 的 AC 3 要求“检测到文档重命名时，更新图谱中的文档路径和相关关系边”，但阶段 2 的步骤 8 仍定义为 `repo.updateDocument(docId, { path: newPath })` 且注明“关系边按 docId 建立，无需修改”；与此同时，Story 2.3 的 docType 定义与 preset rules 本身都依赖路径模式，Story 2.5 的冷启动完整链路也明确包含 `docType classify` 与 `preset merge`。
- **影响** - rename 或 move 会改变路径命中结果，从而影响 docType、相对路径解析以及 `framework_preset` 关系。2.6 当前只更新 `documents.path`，不会重算这些路径敏感结果，既与 AC 3 的“更新相关关系边”冲突，也无法保证增量结果与冷启动或 rebuild 等价。
- **建议** - 将 renamed/moved 纳入与 modified/added 相同的完整重建子链路，至少对受影响文档重算 docType 和相关关系；如果 v0.1 暂不支持，就必须把 Story 2.6 的 AC 与事务说明显式收缩为“仅支持不会改变 docType 或入边的 rename/move”。

## 逐篇审查结论

### Story 2.1: 框架适配器接口与通用规则退化

**结论：通过**

**优点**
- `discoverDocuments` 的接口签名已经稳定收敛为只消费 ScanService 预计算路径。
- 本轮未再发现 Story 2.1 自身的结构或契约缺口。

**关注点**
- 后续仅需随 Story 2.6 的入口修订保持文案一致，不需要再回改 2.1 基线。

### Story 2.2: 扫描引擎核心管道（remark AST + 规则引擎）

**结论：通过**

**优点**
- `ScanPipelineResult`、`warnings` 与规则输出形状在冷启动和增量设计里已保持稳定。
- 本轮未发现 Story 2.2 自身的新冲突。

**关注点**
- rename/move 相关问题来自 2.6 未复用 2.2 的路径敏感规则语义，而不是 2.2 本身设计失效。

### Story 2.3: BMAD 框架适配模块

**结论：通过**

**优点**
- glob 护栏、路径模式 docType 和 preset rule 语义已经稳定明确。
- 本轮未发现 Story 2.3 自身需要新增修订的点。

**关注点**
- Story 2.6 后续需要按 2.3 的路径敏感语义刷新 rename/move 结果，避免下游实现回避这套基线。

### Story 2.4: 配置加载与文档管辖范围

**结论：有条件通过**

**优点**
- `effectiveScanPaths` 的时序说明已与 Story 2.5 主链对齐。
- `relationTypes` 的产品语义已经回到“9 类固定关系启停开关”的正确口径。

**关键问题**
1. **IDE preset 路径 owner 仍未完全落地** — 但在 v0.1 `config.ide` 为空的默认路径下，当前仅构成 P2 跟踪项。

**建议动作**
- 保持 2.4 当前主口径不再回退，只在后续补一句 v0.1 范围说明或最小 IDE provider owner 即可。

### Story 2.5: ScanService 冷启动扫描与图谱写入

**结论：硬阻塞**

**优点**
- `computeEffectiveScanPaths` 已正式进入主链和阶段 1。
- `relationTypes` 过滤已经进入任务与主流程级别说明。

**关键问题**
1. **阶段契约仍未把 `relationTypes` 过滤纳入完整写入计划定义** — 主流程修了，但事务外产物定义还没完全跟上。
2. **供 Story 2.6 复用的“完整构建链路”边界仍不够明确** — 这直接放大了增量路径的残留不一致。

**建议动作**
- 先把 2.5 的阶段 1 契约补齐为真正的唯一基线，再让 2.6 直接引用这条完整链路。

### Story 2.6: 增量扫描与文档生命周期检测

**结论：硬阻塞**

**优点**
- renamed/moved 的 `SyncState` 写回字段来源已经补齐，不再是主阻塞。
- 继续使用 `deleteRelationsByDocId(docId, 'source')` 的方向性约束是正确方向。

**关键问题**
1. **增量入口仍未显式复用冷启动 discovery 链路** — 入口定义仍停留在简化版 `discoverDocuments(...)`。
2. **rename/move 仍被建模为仅更新 path** — 无法兑现 AC 3 的“更新相关关系边”，也无法保证与冷启动或 rebuild 等价。
3. **步骤 5 的“完整构建子链路”仍漏掉 `relationTypes` 过滤** — 这使禁用关系类型在增量路径上仍缺最后一层保障。

**建议动作**
- 先把 2.6 明确改成复用 2.5 的完整前置发现链路和完整构建子链路，再重新收敛 rename/move 的真实支持范围。

## 通过项

- Story 2.6 的 renamed/moved `SyncState` 数据来源缺口已经关闭，不再保留为独立阻塞项。
- Story 2.4、Story 1.3、架构 D6 在 `relationTypes` 产品语义上已基本收敛到同一口径。
- Story 2.5 主流程与任务已经显式补入 `relationTypes` 过滤步骤。
- Story 2.1 / 2.2 / 2.3 的核心接口与基线未在本轮出现新的矛盾。
- 已知非阻塞待办：
  - IDE preset 路径 provider / owner 仍建议后续补一句 v0.1 范围说明。
  - modified-only 场景下的 inbound `framework_preset` 边刷新继续维持 P2。
  - Story 2.6 无变更快返前全量计算 `contentHash` 继续维持 P2。
  - Epic 2 / Story 2.6 的 rename/delete AC 旧措辞继续维持文案债务。

## 结论
- **结论**：不通过
- **阻塞项**：Story 2.6 未显式复用 Story 2.5 的完整 discovery / build 链路；`relationTypes` 过滤仍未闭合到阶段契约与增量子链路；rename/move 仍被建模为仅更新 path，无法保证路径敏感关系刷新正确
- **建议**：先把 Story 2.5 明确为唯一完整基线，再让 Story 2.6 显式复用该链路；随后收缩或补全 rename/move 的真实支持范围。完成后再提交下一轮 reviewer。
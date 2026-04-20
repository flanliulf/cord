---
Epic: 2
Scope: epic
Round: 5
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

总体判断：Round 4 的修订已经把 Epic / Story 2.5 的来源漂移、`deleteRelationsByDocId` 的无方向删边，以及 1.3 的 relationTypes 类型签名这些显性问题修掉了；但第 5 轮复审确认，Epic 2 仍未进入可开发状态。剩余阻塞点已经进一步收敛到 3 条共享主线：一是 `effectiveScanPaths` 虽已基本归到 ScanService，但冷启动与增量路径仍没完全同步，且 IDE preset provider 仍悬空；二是 `relationTypes` 虽已修 schema，但架构/Story 旧口径仍残留，执行链也没有统一过滤点；三是 Story 2.6 仍未完全证明增量写集与冷启动等价，尤其是 renamed/moved 的 `SyncState` 数据来源和 inbound preset 边刷新规则仍不闭合。Epic 2 仍不建议进入开发。

## 审查范围

- Story 文件：
  - `2-1-framework-adapter-interface-and-generic-fallback.md`
  - `2-2-scan-engine-core-pipeline-remark-ast-and-rules.md`
  - `2-3-bmad-framework-adapter-module.md`
  - `2-4-config-loading-and-document-scope.md`
  - `2-5-scanservice-cold-start-scan-and-graph-write.md`
  - `2-6-incremental-scan-and-document-lifecycle-detection.md`
- 复审输入：
  - `epic-2-story-review-summary-20260416-round-4.md`
  - `epic-2-story-review-evaluation-20260416-round-4.md`
- 对照基准：
  - `_bmad-output/project-context.md`
  - `_bmad-output/planning-artifacts/epics/epic-2文档扫描与关系图谱构建.md`
  - `_bmad-output/planning-artifacts/architecture/03-core-architectural-decisions.md`
  - `_bmad-output/planning-artifacts/architecture/04-implementation-patterns-consistency-rules.md`
  - `_bmad-output/implementation-artifacts/stories/1-2-corderror-error-handling-and-logger-system.md`
  - `_bmad-output/implementation-artifacts/stories/1-3-zod-validation-layer-and-core-type-definitions.md`
  - `_bmad-output/implementation-artifacts/stories/1-4-sqlite-storage-layer-and-data-migration.md`
- 审查维度：
  - Round 4 修订闭合度
  - 与 Epic 一致性
  - 与架构基线一致性
  - Story 间共享契约
  - 路径范围 owner 与调用时序
  - relationTypes 的 schema 与执行闭环
  - 增量扫描与冷启动结果等价性
  - `SyncState` / 生命周期写回契约

## 上轮问题回顾

### 已修复
1. Round 4 / Finding #3 — Epic 2 与 Story 2.5 的来源口径漂移
   - 修复位置：Epic 2 中 Story 2.5 的 AC 已同步为 `auto_scan` + `framework_preset` 双来源。
   - 验证结果：本轮未再发现 Epic / Story 在来源字段上的直接文本冲突。

2. Round 4 / Finding #5 — modified 文档使用无方向 `deleteRelationsByDocId(docId)` 会双向删边
   - 修复位置：Story 1.4 的 `deleteRelationsByDocId()` 已加入 `direction` 参数；Story 2.6 步骤 9a 已改为 `deleteRelationsByDocId(docId, 'source')`。
   - 验证结果：Round 4 的“无方向双向删边”问题已关闭；但本轮确认，framework preset 的 inbound 边刷新仍存在新的残留边界问题。

### 仍为上轮遗留
1. Round 4 / Finding #1 — `effectiveScanPaths` owner / 时序 / 来源闭合不完整
   - 当前状态：ScanService 已接手主 owner，但 2.4、2.5、2.6 之间仍有旧时序说明和入口不同步残留。

2. Round 4 / Finding #2 — `relationTypes` 共享契约未闭合
   - 当前状态：1.3 的类型签名已修复，但 2.4 与架构 D6 的旧口径仍未同步，2.5 的执行链也仍未增加统一过滤步骤。

3. Round 4 / Finding #6 — Story 2.6 的完整 `SyncState` 写回仍未完全闭合
   - 当前状态：字段表面已补齐，但 renamed/moved 分支所需的数据来源仍未在阶段 1 产物中真实闭合。

### 仍为非阻塞待办
1. Round 4 / Finding #4 — Story 2.5 rebuild 与架构 D2 的措辞冲突：继续按 round-4 evaluation 维持 P2，不作为本轮新的阻塞项。
2. Round 3 / Finding #6 — Story 2.6 的无变更快返仍在早退前全量计算 `contentHash`；本轮继续维持 P2。
3. Story 2.6 / Epic 2 的 rename/delete AC 旧措辞仍是文案债务；本轮继续维持非阻塞。

## 新发现

### 1. [高][上轮遗留] `effectiveScanPaths` 契约仍未在冷启动与增量路径中完全闭合
- **来源**：structure+consistency+contract
- **分类**：patch
- **涉及 Story**：2-1、2-4、2-5、2-6
- **证据** - Story 2.5 主流程已经加入 `computeEffectiveScanPaths` 并前移到 `discoverDocuments` 之前，Story 2.1 的 `discoverDocuments` 也已改成接收预计算路径；但 Story 2.4 仍保留“位于 Story 2.5 步骤 3 之后”的旧时序说明，Story 2.5 的两阶段事务阶段 1 仍未把 `computeEffectiveScanPaths` 纳入阶段列表，Story 2.6 的阶段 1 又仍沿用旧的无参 `discoverDocuments()` 入口。
- **影响** - `effectiveScanPaths` 已经基本有 owner，但还没有形成贯穿冷启动与增量路径的单一入口契约。2.3 的 glob 护栏因此仍没有完全稳定的落点，范围计算与文件发现边界仍可能在不同路径上再次分叉。
- **建议** - 把 Story 2.4、2.5、2.6 全部统一到同一个时序：`loadConfig -> resolveAdapter -> computeEffectiveScanPaths -> discoverDocuments`，并在 2.5 的阶段 1 / 写入计划说明里明确纳入该步骤。

### 2. [高][新] IDE preset 路径支持仍依赖一个当前 Epic 中不存在的 provider 契约
- **来源**：consistency+contract
- **分类**：decision_needed
- **涉及 Story**：2-4、2-5
- **证据** - Story 2.4 现在要求在 `config.ide` 存在时，通过 IDE adapter 的 `getScanPaths()` / `getExcludePaths()` 追加 IDE preset 路径；但 Story 2.5 的 `computeEffectiveScanPaths(config, adapter)` 仍只接收 framework adapter，当前 Epic 中也没有定义对应的 IDE preset provider。project-context 与 Epic 5 中现有的 `IIdeAdapter` 基线又是面向 IDE 配置生成，并不提供扫描范围方法。
- **影响** - FR40 中的 IDE preset 路径在 Epic 2 当前范围内仍没有可执行的提供方。实现者只能私自发明新接口、硬编码静态映射，或提前耦合未来 Epic 的概念，进一步扩大跨 Epic 边界。
- **建议** - 在 Epic 2 内做一次显式设计决策：要么定义最小 IDE preset provider 契约并纳入 `computeEffectiveScanPaths` 输入；要么把 IDE preset 路径下沉为配置表/纯函数，不直接依赖 IDE adapter 接口。

### 3. [高][上轮遗留] `relationTypes` 仍未形成端到端可执行契约
- **来源**：consistency+contract
- **分类**：patch
- **涉及 Story**：1-3、2-4、2-5
- **证据** - Story 1.3 的 `CordConfig.relationTypes` 已收敛为固定 9 类关系的启用/禁用 schema，但 Story 2.4 仍保留过期的“当前仍是 `Record<string, unknown>`、属于 Epic 1 范围”的说明，架构 D6 也仍写成“自定义关系类型扩展”。与此同时，Story 2.5 的主流程与任务仍没有任何一步去对 `auto_scan` 与 `framework_preset` 两类关系统一应用 `relationTypes` enabled/disabled 过滤。
- **影响** - relationTypes 目前仍停留在“schema 部分修好了，但 Story 文案和执行链都没完全跟上”的状态。验收时仍无法证明禁用关系类型真的不会进入写入计划。
- **建议** - 删除 Story 2.4 的过期“超出范围”说明，同步修正架构 D6 的旧口径，并在 Story 2.5 中增加统一过滤阶段，对 scan results 与 preset results 一并应用 `relationTypes`。

### 4. [高][上轮遗留] Story 2.6 的 renamed/moved `SyncState` 写回仍缺少真实数据来源
- **来源**：structure+consistency+contract
- **分类**：patch
- **涉及 Story**：2-6、1-4
- **证据** - Round 4 已把步骤 11 改成写完整 `SyncState`，但 Story 2.6 当前定义的 `StoredDocRecord` 不含 `status`，`LifecycleResult.renamed/moved` 也不携带 `current/stored` 绑定；步骤 11 却仍引用 `stored.status` 和 `current.mtimeMs`。也就是说，字段看似齐了，但构造这些字段的阶段 1 产物并没有同步补齐。
- **影响** - renamed/moved 分支仍无法仅凭当前契约稳定生成满足 Story 1.4 的完整 `SyncState`。实现者只能私自追加读取、拼接隐藏写计划或偷偷复用旧值，接口闭合度仍不足以进入开发。
- **建议** - 要么扩展 `StoredDocRecord` / `LifecycleResult` 以携带写回所需字段，要么在阶段 1 显式组装完整的 `SyncState` 写计划，再由步骤 11 直接消费该计划。

### 5. [高][新] `source` 定向删边并不能保证所有 inbound `framework_preset` 边被正确刷新
- **来源**：consistency+contract
- **分类**：patch
- **涉及 Story**：2-5、2-6
- **证据** - Story 2.6 现在只对 modified/added 文档复用冷启动构建子链路，并在步骤 9a 仅删除 modified 文档作为 `source` 的 outgoing 边；但 Story 2.5 的 `preset merge` 仍没有声明所有 `framework_preset` 关系都必须以当前重建文档为 source。预设示例中仍存在 `Epic -> Story` 这类天然 inbound 边场景。
- **影响** - 如果某个 modified 文档的类型变化会影响来自未修改文档的 preset 边，当前增量写集仍不会重算这些 inbound preset relations，最终结果可能与冷启动 / rebuild 不等价。
- **建议** - 二选一闭合即可：要么显式约束 preset 规则只生成以当前重建文档为 source 的边；要么在 Story 2.6 中补入“受 modified 文档类型影响的 inbound preset 边也要进入重算集”的规则。

## 逐篇审查结论

### Story 2.1: 框架适配器接口与通用规则退化

**结论：通过**

**优点**
- `discoverDocuments` 的签名已经跟随 round-4 修订收敛为“只消费预计算路径”，方向正确。
- 本轮没有发现 2.1 自身新的结构缺口。

**关注点**
- 仍需随着 2.4 / 2.5 / 2.6 的路径 owner 修订，保持接口说明不再回退到旧的 config 直连模式。

### Story 2.2: 扫描引擎核心管道（remark AST + 规则引擎）

**结论：通过**

**优点**
- `ScanPipelineResult` 与 `warnings` 基线已稳定进入冷启动与增量链路。
- 本轮未再发现 2.2 自身的新一致性问题。

**关注点**
- 2.5 / 2.6 后续修订仍需继续以 2.2 的输出形状为唯一基线。

### Story 2.3: BMAD 框架适配模块

**结论：硬阻塞**

**优点**
- glob 护栏与正反例测试要求已经进入 AC / Task。
- 本轮未再发现 2.3 自身新增的文档类型口径问题。

**关键问题**
1. **glob 护栏仍依赖未闭合的路径 owner** — `effectiveScanPaths` 仍未在 2.4 / 2.5 / 2.6 之间形成统一入口。

**建议动作**
- 待 `effectiveScanPaths` 和 IDE preset provider 真正闭合后，再重新判定 2.3 是否可转为通过。

### Story 2.4: 配置加载与文档管辖范围

**结论：硬阻塞**

**优点**
- `effectiveScanPaths` 的主 owner 已基本向 ScanService 收敛。
- `relationTypes` 的产品语义仍坚持固定 9 类开关，方向正确。

**关键问题**
1. **时序与 owner 仍未完全闭合** — 旧步骤号、旧说明和增量入口仍未全部跟上。
2. **IDE preset provider 仍缺失** — 当前 Epic 里还没有可执行的提供方契约。
3. **relationTypes 文案仍残留旧口径** — 2.4 自己和架构 D6 仍在回放已经修掉的旧基线。

**建议动作**
- 先统一路径 owner 与 IDE preset provider，再同步清理 2.4 和 D6 的过期 relationTypes 说明。

### Story 2.5: ScanService 冷启动扫描与图谱写入

**结论：硬阻塞**

**优点**
- `computeEffectiveScanPaths` 已被明确纳入主链。
- Epic / Story 对双来源字段的直接漂移已修复。

**关键问题**
1. **阶段 1 契约仍未完整包含路径合成** — 主流程与阶段契约仍有残留不一致。
2. **relationTypes 仍没有统一执行过滤点** — scan results 与 preset results 仍会直接进入 dedupe 和写入计划。
3. **preset merge 的 source 锚定仍不明确** — 这直接影响 2.6 能否安全只删 `source` 方向的边。

**建议动作**
- 先把阶段 1 契约补齐，并明确 preset relations 的 source 规则或受影响边重算规则，再进入开发。

### Story 2.6: 增量扫描与文档生命周期检测

**结论：硬阻塞**

**优点**
- `deleteRelationsByDocId(docId, 'source')` 已关闭最直接的双向删边问题。
- 完整 `SyncState` 写回方向已经显式写进步骤 11。

**关键问题**
1. **增量入口仍未复用 2.5 的新发现链路** — 仍保留旧 discoverDocuments 入口。
2. **renamed/moved 的完整 `SyncState` 写回没有真实数据来源** — 当前阶段 1 产物不支持步骤 11 的字段引用。
3. **inbound preset 边刷新规则仍不闭合** — 仅删 `source` 方向并不能自动保证 preset 边等价刷新。

**建议动作**
- 先让 2.6 完全复用 2.5 的入口链，再补 renamed/moved 写回计划和 inbound preset 边的重算边界。

## 通过项

- Epic 2 与 Story 2.5 的来源字段口径已经同步，不再保留 round-4 之前的直接 AC 冲突。
- Story 1.4 的 `deleteRelationsByDocId(direction)` 已经补齐，原始的双向删边问题已关闭。
- Story 1.3 的 relationTypes 类型签名已经收敛为固定 9 类启停 schema。
- Story 2.5 / 2.6 继续稳定消费 `ScanPipelineResult` 与 `warnings`。
- 已知非阻塞待办：
  - Story 2.5 rebuild 与架构 D2 的措辞范围仍建议后续澄清，但本轮继续维持 P2。
  - Story 2.6 的无变更快返仍需后续优化才能稳住 NFR6。
  - Story 2.6 / Epic 2 的 rename/delete AC 旧措辞仍待清理，但本轮继续视为文案债务。

## 结论
- **结论**：不通过
- **阻塞项**：`effectiveScanPaths` 冷启动/增量入口未完全闭合、IDE preset provider 缺失、`relationTypes` 仍未形成端到端可执行契约、Story 2.6 的 renamed/moved `SyncState` 数据来源缺失、以及 inbound `framework_preset` 边的增量刷新规则未定义
- **建议**：先按顺序收敛 2.4 / 2.5 / 2.6 的路径入口与 IDE preset provider，再同步清理 2.4 / D6 的 relationTypes 旧口径并补上 2.5 的统一过滤阶段，最后回到 2.6 明确 renamed/moved 写计划与 inbound preset 边重算规则；完成后再提交第 6 轮复审
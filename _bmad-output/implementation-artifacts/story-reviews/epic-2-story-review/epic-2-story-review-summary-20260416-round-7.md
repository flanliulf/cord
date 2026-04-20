---
Epic: 2
Scope: epic
Round: 7
Date: 2026-04-16
Model Used: GPT-5.4 (github-copilot)
Type: Story Review Summary
Stories Reviewed: 6
---

## 审查结论

复审。共审查 Epic 2 下 6 个 Story。审查层状态：3/3 层完成。

- 通过：4 个
- 有条件通过：1 个
- 硬阻塞：1 个

总体判断：Round 6 的 3 条 P1 中已有 2 条实际关闭。Story 2.6 现在已经显式复用 Story 2.5 的前置 discovery 链路，`relationTypes` 过滤也已进入 Story 2.5 的阶段契约和 Story 2.6 的完整构建子链路；因此 Story 2.5 已基本成为可复用的唯一冷启动基线。本轮剩余阻塞已进一步收敛为一类更窄的范围口径问题：Story 2.6 虽已把 rename/move 收缩为 v0.1 的 path-only 语义，但正文内部仍保留未加场景限定的“关系刷新正确 / 与 rebuild 等价”承诺，Epic 2 的父级 AC 也还没有同步到同一边界。Epic 2 已接近出清，但在这组口径冲突收束前，仍不建议进入开发。

## 审查范围

- Story 文件：
  - `2-1-framework-adapter-interface-and-generic-fallback.md`
  - `2-2-scan-engine-core-pipeline-remark-ast-and-rules.md`
  - `2-3-bmad-framework-adapter-module.md`
  - `2-4-config-loading-and-document-scope.md`
  - `2-5-scanservice-cold-start-scan-and-graph-write.md`
  - `2-6-incremental-scan-and-document-lifecycle-detection.md`
- 复审输入：
  - `epic-2-story-review-summary-20260416-round-6.md`
  - `epic-2-story-review-evaluation-20260416-round-6.md`
- 对照基准：
  - `_bmad-output/project-context.md`
  - `_bmad-output/planning-artifacts/epics/epic-2文档扫描与关系图谱构建.md`
  - `_bmad-output/planning-artifacts/architecture/03-core-architectural-decisions.md`
  - `_bmad-output/planning-artifacts/architecture/04-implementation-patterns-consistency-rules.md`
  - `_bmad-output/implementation-artifacts/stories/1-3-zod-validation-layer-and-core-type-definitions.md`
  - `_bmad-output/implementation-artifacts/stories/1-4-sqlite-storage-layer-and-data-migration.md`
- 审查维度：
  - Round 6 修订闭合度
  - 冷启动与增量 discovery / build 链路复用
  - `relationTypes` 的端到端执行闭环
  - rename/move 的 v0.1 范围边界
  - Epic 与 Story 的验收口径同步

## 上轮问题回顾

### 已修复
1. Round 6 / Finding #1 — Story 2.6 未显式复用 Story 2.5 的完整前置发现链路
   - 修复位置：Story 2.6 阶段 1 步骤 1 已展开为 `loadConfig(projectRoot) -> resolveAdapter(config, projectRoot) -> computeEffectiveScanPaths(config, adapter) -> adapter.discoverDocuments(projectRoot, scanPaths, excludePaths)`。
   - 验证结果：`discoverDocuments` 签名和前置顺序现在已经与 Story 2.1 / Story 2.5 一致，该问题关闭。

2. Round 6 / Finding #2 — `relationTypes` 过滤仍未进入 Story 2.5 阶段契约与 Story 2.6 完整构建子链路
   - 修复位置：Story 2.5 两阶段事务的阶段 1 已补入 `relationTypes 过滤`；Story 2.6 步骤 5 的显式链路也已补入同一步骤。
   - 验证结果：任务、主流程、阶段契约和增量复用链路已对齐，该问题关闭。

### 仍为上轮遗留
1. Round 6 / Finding #3 — rename/move 仍被建模为仅更新 path，路径敏感关系刷新无法保证
   - 当前状态：Story 2.6 的 AC 3/4 和步骤 8 已收缩到 v0.1 path-only 语义，但 Story 2.6 正文内部与 Epic 2 父级 AC 仍残留更宽的结果等价和关系刷新承诺，问题已从“直接对撞”收窄为“范围口径未完全收束”。

### 仍为非阻塞待办
1. Round 5 / Finding #2 — IDE preset provider 当前 Epic 缺失
   - 维持 P2：`config.ide` 为空时当前路径仍可执行；若未来要支持 `config.ide` 非空分支，仍需补一句 v0.1 范围说明或最小 provider owner。

2. Round 5 / Finding #5 — inbound `framework_preset` 边在 modified-only 场景下的增量刷新
   - 维持 P2：本轮未发现需要升级的新直接冲突。

3. Story 2.6 无变更快返前仍全量计算 `contentHash`
   - 继续维持 P2，不作为本轮新的阻塞。

## 新发现

### 1. [高][上轮遗留] Story 2.6 仍同时保留 v0.1 path-only 范围与未限定的结果等价承诺
- **来源**：structure+consistency+contract
- **分类**：patch
- **涉及 Story**：2-3、2-5、2-6
- **证据** - Story 2.6 的 AC 3/4 与步骤 8 已明确把 rename/move 收缩为 v0.1 仅更新 `documents.path`，路径敏感的 docType 重分类与 preset 关系刷新延至 v0.2；但同一文档的步骤 5 注释仍写“确保增量与冷启动结果等价”，数据一致性说明也仍写“确保 `framework_preset` 关系在增量扫描时也被正确刷新，满足 rebuild 与增量扫描结果等价”。而 Story 2.3 的 docType / preset rules 仍是路径敏感的，Story 2.5 的冷启动与 rebuild 基线也继续包含 `docType classify` 与 `preset merge`。
- **影响** - Story 2.6 现在已经用 AC 和步骤 8 收紧了 rename/move 范围，但正文其余位置仍对整个增量路径给出无条件的关系刷新和结果等价承诺。实现者和后续审查者无法仅凭正文判断 rename/move 是否被排除在这些承诺之外，范围口径仍未真正闭合。
- **建议** - 将“结果等价”和“`framework_preset` 刷新”说明明确限定为 modified/added 复用 Story 2.5 完整构建子链路的场景；同时补一句 rename/move 在 v0.1 不保证路径敏感的 docType 与 preset 关系同步。

### 2. [中][上轮遗留] Epic 2 的 Story 2.6 验收基线仍未同步到 v0.1 path-only 范围
- **来源**：structure+consistency+contract
- **分类**：patch
- **涉及 Story**：2-6
- **证据** - Epic 2 中 Story 2.6 的 AC 仍写“检测到文档重命名时，更新图谱中的文档路径和相关关系边”；而 Story 2.6 正文的 AC 3/4 与步骤 8 已统一收缩为 v0.1 仅更新 `documents.path`，路径敏感的 docType 与 preset 关系刷新延至 v0.2。
- **影响** - Epic 与 Story 之间仍保留双重验收口径。若不统一，后续评估、AC 审计和开发排期会继续把 v0.2 的路径敏感刷新误记为 v0.1 的已交付范围。
- **建议** - 同步更新 Epic 2 中 Story 2.6 的 AC，使其与 Story 2.6 正文和步骤 8 一致；或者回撤 Story 2.6 的范围收缩，二者必须二选一收口。

## 逐篇审查结论

### Story 2.1: 框架适配器接口与通用规则退化

**结论：通过**

**优点**
- `discoverDocuments` 的接口签名和 owner 说明已保持稳定。
- 本轮未发现 Story 2.1 的新结构或契约缺口。

**关注点**
- 后续只需继续作为 Story 2.5/2.6 的共享接口基线，不需要再回改。

### Story 2.2: 扫描引擎核心管道（remark AST + 规则引擎）

**结论：通过**

**优点**
- `ScanPipelineResult` 与 `warnings` 的输出形状已稳定进入冷启动和增量链路。
- 本轮未出现 Story 2.2 自身的新矛盾。

**关注点**
- 无。

### Story 2.3: BMAD 框架适配模块

**结论：通过**

**优点**
- docType 与 preset rule 的路径敏感语义保持清晰稳定。
- 本轮未发现 Story 2.3 自身需要新增修订的点。

**关注点**
- Story 2.6 的剩余问题来自对 2.3 这套基线的表述未完全收束，而不是 2.3 本身失效。

### Story 2.4: 配置加载与文档管辖范围

**结论：有条件通过**

**优点**
- `effectiveScanPaths` 的 owner 与时序已稳定闭合。
- `relationTypes` 的产品语义继续保持正确口径。

**关键问题**
1. **IDE preset 路径 provider / owner 仍未完全落地** — 但在 v0.1 `config.ide` 为空的默认路径下，当前仍仅构成 P2 跟踪项。

**建议动作**
- 后续仅需补一句 v0.1 范围说明或最小 provider owner，不影响本轮主结论。

### Story 2.5: ScanService 冷启动扫描与图谱写入

**结论：通过**

**优点**
- discovery 主链、两阶段事务契约、`relationTypes` 过滤和 rebuild 边界已经对齐。
- 现在已经足够作为 Story 2.6 的唯一冷启动复用基线。

**关注点**
- 仅保留既有的 IDE preset provider P2 观察项，不构成本轮阻塞。

### Story 2.6: 增量扫描与文档生命周期检测

**结论：硬阻塞**

**优点**
- 已显式复用 Story 2.5 的前置 discovery 链路。
- `relationTypes` 过滤和完整 `SyncState` 写回数据来源都已闭合。

**关键问题**
1. **正文内部仍混用两套范围承诺** — AC/步骤 8 已收缩为 path-only，但步骤 5 与数据一致性说明仍保留未限定的“结果等价 / preset 刷新”表述。
2. **Epic 2 的父级 AC 仍未同步** — 父级基线还在要求 rename 时更新相关关系边。

**建议动作**
- 先把 Story 2.6 正文与 Epic 2 父级 AC 收敛到同一 v0.1 范围，再提交下一轮复审。

## 通过项

- Round 6 的 discovery 链路复用问题已经关闭。
- Round 6 的 `relationTypes` 阶段契约 / 增量子链路问题已经关闭。
- Story 2.5 已基本成为可复用的唯一冷启动基线。
- Story 2.6 的 renamed/moved `SyncState` 数据来源继续保持闭合。
- 已知非阻塞待办：
  - IDE preset 路径 provider / owner 继续维持 P2。
  - modified-only 场景下的 inbound `framework_preset` 边刷新继续维持 P2。
  - Story 2.6 无变更快返前全量计算 `contentHash` 继续维持 P2。

## 结论
- **结论**：不通过
- **阻塞项**：Story 2.6 正文内部仍未把 v0.1 path-only 范围与“结果等价 / `framework_preset` 刷新”承诺收敛到同一边界；Epic 2 的 Story 2.6 父级 AC 也尚未同步到同一范围
- **建议**：先统一 Story 2.6 正文内部的范围承诺，再同步 Epic 2 的 Story 2.6 AC；完成后再提交第 8 轮 reviewer。 
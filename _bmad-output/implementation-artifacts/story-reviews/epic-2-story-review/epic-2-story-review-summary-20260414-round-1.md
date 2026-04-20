---
Epic: 2
Scope: epic
Round: 1
Date: 2026-04-14
Model Used: GPT-5.4 (github-copilot)
Type: Story Review Summary
Stories Reviewed: 6
---

## 审查结论

首轮审查。共审查 Epic 2 下 6 个 Story。审查层状态：3/3 层完成。

- 通过：0 个
- 有条件通过：1 个
- 硬阻塞：5 个

总体判断：当前 Epic 2 的 Story 设计文档不适合直接进入开发。主要问题不是单个 Story 的措辞瑕疵，而是跨 Story 的共享契约没有收敛，集中表现为适配器选择、文档类型范围、预设规则接入、关系来源、配置语义、事务边界和增量生命周期契约相互打架。建议先统一 Epic 2 的共享接口与边界，再推进实现。

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
  - 结构完整性
  - AC 可测性
  - 与 Epic 一致性
  - 与架构文档一致性
  - Story 间冲突与依赖
  - 任务拆分合理性
  - 交互 / 错误处理 / 事务 / 性能口径
  - 跨 Epic 共享契约

## 新发现

### 1. [高] BMAD 文档类型范围与扫描输入契约冲突
- **来源**：structure+consistency+contract
- **分类**：decision_needed
- **涉及 Story**：2-1、2-2、2-3
- **证据** - Story 2.3 把 `sprint-status.yaml`、`config.yaml`、`module.yaml` 等非 Markdown 文档纳入 18 种 BMAD 文档类型，但 Story 2.1 的抽象适配器发现阶段限定为仅保留 `.md` 文件，Story 2.2 又把非 Markdown 作为跳过对象。
- **影响** - 实现者无法判断 YAML 文档到底应被扫描、仅被识别还是完全排除，BMAD 18 种文档类型承诺无法稳定验收。
- **建议** - 在 Story 2.1-2.3 中统一 v0.1 的文档范围。若只支持 Markdown，就移除非 Markdown 类型；若支持 YAML，就补齐发现、解析、测试和关系生成契约。

### 2. [高] 适配器解析与 Generic fallback 选择契约缺失
- **来源**：structure+consistency+contract
- **分类**：patch
- **涉及 Story**：2-1、2-3、2-4、2-5
- **证据** - Story 2.1 规定 `GenericFrameworkAdapter.detectFramework()` 始终返回 `true`，Story 2.3 又定义了 BMAD 的 5 层检测策略，Story 2.4 暴露 `framework` / `adapters` 配置，但 Story 2.5 的扫描流程没有任何适配器解析与优先级定义。
- **影响** - 具体框架适配器可能被 generic 兜底适配器吞掉，BMAD 开箱即用会退化为不确定行为。
- **建议** - 在 Story 2.1 或 2.5 中补充统一的 adapter resolution contract，明确 config override、检测顺序、priority 规则，并规定 generic 只能最后兜底。

### 3. [高] BMAD 文档类型分类与预设规则未进入扫描执行链路
- **来源**：structure+consistency
- **分类**：patch
- **涉及 Story**：2-1、2-2、2-3、2-5
- **证据** - Story 2.1 定义了 `getDocumentTypes()` 和 `getPresetRules()`，Story 2.3 也提供了 BMAD 文档类型与预设规则，但 Story 2.2 的扫描管道与 Story 2.5 的 ScanService 流程都没有文档分类、预设规则求值或结果合并阶段。
- **影响** - `BmadFrameworkAdapter` 只能参与文档发现，无法兑现框架预设关系和文档类型识别的核心价值。
- **建议** - 在 Story 2.2 或 2.5 中显式增加 `docType classify -> preset rule evaluate -> merge/dedupe -> source 标记` 的数据流，并补充对应测试。

### 4. [高] 关系来源 auto_scan 与 framework_preset 契约冲突
- **来源**：structure+consistency+contract
- **分类**：patch
- **涉及 Story**：1-3、2-2、2-3、2-5
- **证据** - Story 1.3 的 `RelationSource` 已定义 `auto_scan`、`manual`、`framework_preset` 三种来源，Story 2.3 引入了框架预设规则，但 Story 2.5 把所有关系来源统一写成 `auto_scan`，Story 2.2 的 `DiscoveredRelation` 也没有来源字段。
- **影响** - 后续无法区分文本扫描发现和框架预设注入的边，影响冲突处理、调试和数据解释。
- **建议** - 扫描规则生成的边写 `auto_scan`，框架预设写 `framework_preset`，并在 Story 2.2/2.5 的数据流中显式传递 `source`。

### 5. [高] relationTypes 扩展语义与固定 9 类关系模型冲突
- **来源**：consistency
- **分类**：decision_needed
- **涉及 Story**：1-3、2-4
- **证据** - Story 2.4 和 Story 1.3 将 `relationTypes` 描述为“自定义关系类型扩展”，但 `project-context.md`、架构文档和 Epic 2 又把关系类型固定为 9 种。当前文档没有说明 `relationTypes` 是扩展新类型、筛选已有类型还是调整映射规则。
- **影响** - 类型系统、配置系统和持久化契约会出现多套真相，开发时要么忽略 `relationTypes`，要么破坏 FR10 的稳定边界。
- **建议** - 明确 `relationTypes` 的产品语义。若只允许配置已有 9 类关系的启用/映射/阈值，就收敛命名；若允许扩展新类型，则必须同步改写 `RelationType`、P9、FR10 和存储契约。

### 6. [高] 排除路径的硬边界与默认边界未收敛，.cord 口径不一致
- **来源**：contract+structure
- **分类**：decision_needed
- **涉及 Story**：2-4
- **证据** - Story 2.4 的 AC 和 Task 只列出 `src`、`node_modules`、`.git`、`dist`，但 Dev Notes 默认配置又额外加入 `.cord`；同时文档没有说明 FR39 列出的排除项是硬排除，还是用户可以通过配置重新纳入。
- **影响** - 不同实现可能对 `src`、`dist`、`.git`、`.cord` 的可扫描性做出不同判断，直接影响安全、性能和行为一致性。
- **建议** - 将排除规则拆为 `hardExcludedPaths` 和 `defaultExcludedPaths`，明确 `.cord` 的归属，并同步更新 Story 2.4、schema 和规则文档。

### 7. [高] rebuild 与增量事务边界未定义完整，原子性和性能目标都无法证明
- **来源**：structure+consistency+contract
- **分类**：patch
- **涉及 Story**：2-5、2-6
- **证据** - Story 2.5 把 `--rebuild` 写成“先清空再全量扫描”，但事务说明只覆盖写入阶段；Story 2.6 又只写“增量扫描也在事务中执行”，没有说明 async 解析、stat/hash、生命周期 diff 与同步事务的边界。
- **影响** - 一旦在清空之后、写回之前或增量扫描中途失败，图谱会留下空库、半成品或长事务锁，无法满足 NFR15、NFR18 和 NFR6。
- **建议** - 统一采用两阶段契约：事务外完成发现、解析和变更计划，事务内只提交 `documents` / `relations` / `sync_states` 的短写集；`rebuild` 需明确原子替换或同事务清空+写回方案。

### 8. [高] 增量扫描的快照、mtime 与 lifecycle-detector 契约缺失
- **来源**：structure+consistency+contract
- **分类**：patch
- **涉及 Story**：2-6、1-4
- **证据** - Story 2.6 用 `fs.statSync(path).mtimeMs` 对比 `sync_states.last_scanned_at`，但前置契约中的 `lastScannedAt` 是扫描时间而非文件版本令牌。Story 2.6 还把 `lifecycle-detector` 声明为纯函数，却没有定义它需要的输入快照结构。
- **影响** - 增量扫描会在时间语义和模块边界上产生分叉实现，甚至把未重新扫描的脏数据误判为“无变更”。
- **建议** - 补充 `currentFiles` 与 `storedDocs` 两类快照输入契约，并引入独立的 `lastObservedMtimeMs` 或等价版本令牌，避免直接复用 `lastScannedAt`。

### 9. [高] rename、move、delete 的存储语义与 Repository API 不匹配
- **来源**：structure+consistency+contract
- **分类**：patch
- **涉及 Story**：2-6、1-3、1-4
- **证据** - Story 2.6 要求重命名时更新文档路径和相关关系边，并在流程中使用 `repo.updateDocument(path)`；但现有关系模型按 `docId` 建边，Repository 也只定义了 `updateDocument(id, updates)` 和 `deleteDocument(id)`。同时 rename 与 move 的判定规则也未收敛。
- **影响** - 实现者要么引入多余的关系边重写与新 API，要么在服务层自行猜测规则，导致生命周期行为与存储模型漂移。
- **建议** - 将契约收敛为更新 `documents.path`、按 `docId` 保持关系边；补充 `getDocumentByPath(oldPath) -> updateDocument(id, { path })` 的明确流程，并定义 rename 与 move 的判定优先级。

### 10. [中] 配置验证未明确复用共享 configSchema，7 项配置缺少闭环定义
- **来源**：structure+contract
- **分类**：patch
- **涉及 Story**：1-3、2-4
- **证据** - Epic 2 要求 Story 2.4 与 Story 1.3 的 `configSchema` 集成，但 Story 2.4 只写成“通过 Zod schema 验证”。同时 7 项配置里只有 `scanPaths`、`excludePaths`、`confidenceThreshold` 给出了默认行为，其余字段缺少类型、优先级和合并语义。
- **影响** - 实现者容易在 loader 内复制一套私有 schema，或把剩余字段做成“可解析但不可预测”的弱契约。
- **建议** - 在 Story 2.4 中明确必须复用 `schemas/configSchema`，并为 `framework`、`ide`、`relationTypes`、`adapters` 补齐默认行为、覆盖语义和测试矩阵。

### 11. [中] Markdown 链接支持从相对+绝对退化为仅相对
- **来源**：structure+contract
- **分类**：patch
- **涉及 Story**：2-2
- **证据** - Epic 2 明确要求 `extract-links` 支持相对路径和绝对路径的 Markdown 链接，但 Story 2.2 的 `markdown-link-rule` 实现说明只处理相对路径的 `.md` 链接。
- **影响** - 按 Story 2.2 实现会静默漏扫绝对路径链接，Story 可“完成”，Epic 却无法通过原始验收。
- **建议** - 统一 Epic 和 Story 口径：要么明确支持绝对路径并补充规范化规则与测试，要么在 Epic 和 Story 中同步声明延期。

### 12. [中] CLI JSON、退出码、性能与测试验收未被任务闭合
- **来源**：structure+contract
- **分类**：patch
- **涉及 Story**：2-5、2-6
- **证据** - Story 2.5/2.6 的多个 AC 仍停留在目标描述层：2.5 没有退出码映射和全局 `--json` 的落地任务，2.5/2.6 的性能指标缺少测量基线，2.6 也没有把单元、集成和异常路径测试拆开。
- **影响** - 即使实现完成，也难以通过一致、可复现的方式验证 CLI 行为、性能目标和端到端回归。
- **建议** - 补充全局 `--json` 输出契约、错误类型到退出码的映射、性能基线与样本规模，并把单元 / 集成 / 异常测试分别拆入任务列表。

## 逐篇审查结论

### Story 2.1: 框架适配器接口与通用规则退化

**结论：硬阻塞**

**优点**
- 已明确抽象层、通用适配器和门面导出的位置。
- 文档把路径排除和框架扩展目标都写进了 AC 与 Dev Notes。

**关键问题**
1. **Generic fallback 契约未闭合** — `detectFramework()` 恒真，但没有统一的适配器选择算法，具体适配器容易被兜底适配器吞掉。
2. **声明式注册只有口号，没有契约** — AC 要求“声明式注册”，但接口仍只是拉取数组，没有 registry / descriptor / manifest 级约束。

**建议动作**
- 在 Story 2.1 中补 adapter resolution contract，并把“声明式注册”具体化为单一扩展契约。

### Story 2.2: 扫描引擎核心管道（remark AST + 规则引擎）

**结论：有条件通过**

**优点**
- 管道、插件、规则三层拆分清楚，整体结构可实现。
- 已显式意识到 Scanner 引擎需要 async 模式和异常文档处理。

**关键问题**
1. **Epic 能力被静默收窄** — `markdown-link-rule` 从“相对+绝对路径”退化为“仅相对路径”。
2. **与适配器层没有接缝** — 文档分类和框架预设规则没有进入执行链路。
3. **frontmatter 来源存在双轨风险** — 插件抽取与 `gray-matter` 解析在文档中并存，唯一数据源未收敛。

**建议动作**
- 保留当前结构，但在开发前补齐绝对路径口径、frontmatter 单一来源和与适配器层的接缝说明。

### Story 2.3: BMAD 框架适配模块

**结论：硬阻塞**

**优点**
- 已给出较完整的 BMAD 文档类型清单和检测分层思路。
- 明确把当前仓库作为真实 BMAD 样本，方向正确。

**关键问题**
1. **文档类型清单与当前扫描契约冲突** — 非 Markdown 类型无法进入现有发现链路。
2. **预设规则完成标准不明确** — 没有最小规则矩阵，也没有与执行链路的接入定义。
3. **检测器语义不稳定** — 5 层递进检测是“高置信度”叙述，但接口仍是 boolean，边界不可测。

**建议动作**
- 先收敛 BMAD 文档范围与规则接入位置，再细化最小规则矩阵和检测阈值真值表。

### Story 2.4: 配置加载与文档管辖范围

**结论：硬阻塞**

**优点**
- YAML 优先于 JSON 的加载优先级已经清晰。
- 用户可覆盖预设的目标写得明确，符合产品方向。

**关键问题**
1. **配置验证与共享 schema 脱节** — 未显式复用 Story 1.3 的 `configSchema`。
2. **relationTypes 语义冲突** — “自定义扩展”与“固定 9 类”同时存在。
3. **排除边界不一致** — `.cord`、硬排除与默认排除的边界未收敛。

**建议动作**
- 先统一配置 schema、关系类型语义与排除边界，再进入实现。

### Story 2.5: ScanService 冷启动扫描与图谱写入

**结论：硬阻塞**

**优点**
- 冷启动流程的主链路基本完整，CLI 薄壳意识明确。
- 已覆盖 `documents`、`relations`、`sync_states` 三张核心表。

**关键问题**
1. **扫描主流程缺少适配器解析与框架预设接入阶段**。
2. **关系来源被压平成 auto_scan**，与共享契约冲突。
3. **rebuild 原子性定义不足**，当前写法不能证明 NFR15 / NFR18。
4. **CLI 验收闭环不足** — 全局 `--json`、退出码、性能和 E2E 测试都未拆成可执行任务。

**建议动作**
- 在进入开发前补 adapter resolution、preset/source 数据流、rebuild 事务边界和 CLI 验收矩阵。

### Story 2.6: 增量扫描与文档生命周期检测

**结论：硬阻塞**

**优点**
- 已把无变更快速返回、rename / move / delete 这些关键场景纳入目标。
- 识别到了 lifecycle-detector 需要与 ScanService 分层。

**关键问题**
1. **快照与版本令牌契约缺失** — `mtimeMs` 与 `lastScannedAt` 语义不匹配。
2. **Repository 能力假定过多** — 文档里用了不存在的 `repo.updateDocument(path)` 等语义。
3. **重命名/移动/删除语义不稳定** — 现有存储按 `docId` 建边，关系边并不该跟路径一起重写。
4. **事务与错误处理闭环不足** — 只有目标，没有可执行的失败语义与测试设计。

**建议动作**
- 先定义 `currentFiles` / `storedDocs` 快照契约、版本令牌、生命周期判定规则和 Service/Repository 协作边界，再进入实现。

## 通过项

- 6 个 Story 都遵循了统一的 BMAD Story 文档骨架，章节齐全，引用来源基本可追溯。
- Epic 2 的主线拆分顺序总体合理：适配器 → 扫描管道 → 配置 → 冷启动扫描 → 增量扫描，演进方向清晰。
- 多个关键非功能性目标已被显式写入 Story：事务性、性能、测试覆盖、CLI JSON 输出，这为后续修订提供了锚点。
- 本轮无 defer 桶；当前发现均属于本 Epic 设计层在开发前应收敛的问题，而非可安全后置的既有遗留项。
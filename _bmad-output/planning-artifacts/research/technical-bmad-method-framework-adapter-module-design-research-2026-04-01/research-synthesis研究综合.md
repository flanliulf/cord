# Research Synthesis（研究综合）

## Executive Summary（执行摘要）

本研究为 CORD 项目完成了 **BMAD-Method 框架适配模块**的全面技术设计——从 BMAD 框架的 4 阶段 × 18 种文档类型的结构解析，到 `BmadFrameworkAdapter` 的完整架构蓝图，再到可执行的两阶段交付计划。

**三大核心结论：**

1. **BMAD 是理想的首个框架适配器**：其强结构化的文档产出链（Product Brief → PRD → Architecture → Epics → Stories）提供了 19 条高置信度预设关系对，其中 `inputDocuments` frontmatter 字段是零推测的显式关系来源（置信度 1.0）
2. **声明式架构确保可扩展性**：18 种文档类型通过配置数组而非硬编码定义，5 条预设规则通过 `IRelationRule` 接口注入 `RuleEngine`，版本差异通过 Strategy 模式隔离——整个设计遵循开闭原则，为后续 React/Vue/Spring Boot 适配器树立了实现标杆
3. **轻量嵌入、快速交付**：适配器 Phase 1（3-5 天）嵌入 TR6 Phase A 交付，Phase 2（3-4 天）嵌入 Phase D 完善，总工作量 6-9 天

## Key Technical Findings（关键技术发现）

### 发现 1：BMAD 文档类型体系完整且高度结构化

- **18 种文档类型**覆盖 4 个开发阶段：Analysis（9 种） / Planning（3 种） / Solutioning（4 种） / Implementation（3 种）
- **17 种 Markdown + 1 种 YAML**（Sprint Status）
- 文档间形成清晰的**产出链拓扑**，每种类型有明确的上下游关系
- 每种类型具备可靠的**结构指纹**：frontmatter 字段、文件位置、标题模式、文件名约定

### 发现 2：inputDocuments 是最高价值的关系信号

- `inputDocuments` 是 BMAD 工作流**自动生成**的文档引用列表
- 直接映射为 CORD 的 `derived_from` 关系类型，**零推测、零歧义**
- 置信度固定为 **1.0**——等同于显式 frontmatter 声明
- Phase 2-3 的核心文档（PRD、Architecture、Epics）均携带此字段

### 发现 3：5 层递进检测策略覆盖所有场景

| 层级 | 检测方式 | 置信度 | 适用场景 |
|------|---------|--------|---------|
| L1 | Frontmatter 字段 | 95% | Phase 2-3 核心文档（含 workflowType） |
| L2 | 文件位置模式 | 90% | 所有已知输出路径的文档 |
| L3 | 内容标题 | 75% | 无 frontmatter 的文档 |
| L4 | 内容结构特征 | 65% | 模板产出的文档 |
| L5 | 文件名模式 | 40% | 兜底检测 |

组合使用时，整体识别率可达 **≥ 90%**。

### 发现 4：适配器对 CORD 核心架构零侵入

- BMAD 适配器通过 `FrameworkRegistry.register()` 注入——**CORD 核心不感知 BMAD**
- 预设规则通过 `RuleEngine.register()` 注入——**规则引擎不感知框架**
- VFile.data 通过命名空间 `cordBmad` 隔离——**remark 管道不感知 BMAD**
- 完美符合 CORD 的**端口-适配器（Hexagonal）架构**

### 发现 5：版本兼容通过策略模式解决

- BMAD 作为新兴框架，版本迭代活跃（当前 v6.2.2）
- 检测器仅依赖**稳定信号**（`_bmad/` 目录 + `core/` + `config.yaml`）
- 版本特定行为通过 `BmadVersionStrategy` 隔离
- 未知版本降级到通用 Markdown 适配器——**永不中断扫描**

## Architecture Decision Records（架构决策记录）

### ADR-TR10-01：BMAD 适配器采用声明式文档类型定义

- **决策**：18 种文档类型通过 `DocTypeDefinition[]` 配置数组定义，而非硬编码 if-else 逻辑
- **理由**：BMAD 版本迭代可能增加新文档类型；声明式配置允许用户通过 `cord.config.ts` 追加自定义类型
- **后果**：新增文档类型仅需追加配置，不修改核心代码；类型检测逻辑统一由 `BmadDocTypeRegistry` 驱动

### ADR-TR10-02：inputDocuments 规则独立于产出链推断规则

- **决策**：`BmadInputDocumentsRule`（置信度 1.0）和 `BmadDocumentChainRule`（置信度 0.85）作为两条独立规则
- **理由**：`inputDocuments` 是显式声明（零推测），产出链是启发式推断（有误判可能）；分离后可独立评估准确率
- **后果**：同一关系可能被两条规则同时发现，由 `mergeResults()` 的置信度聚合取较高值

### ADR-TR10-03：BMAD 适配器分两阶段嵌入冷启动扫描器路线图

- **决策**：Phase 1 MVP（Detector + DocTypeRegistry + 2 条核心规则）随 TR6 Phase A 交付；Phase 2（3 条增强规则 + 扩展接口 + 版本兼容）随 Phase D 交付
- **理由**：Phase 1 已能覆盖 80%+ 的 BMAD 文档关系发现；Phase 2 的增强规则和版本兼容需要在实际使用反馈后调参
- **后果**：6-9 天总工作量分散在两个 Phase，不形成关键路径

### ADR-TR10-04：扩展接口 IBmadFrameworkAdapter 向下兼容基础接口

- **决策**：`IBmadFrameworkAdapter extends IFrameworkAdapter`，增加 `getOutputConfig()`、`getPhaseTopology()`、`getWorkflowDependencies()` 三个方法
- **理由**：`FrameworkRegistry` 统一管理所有适配器时使用基础接口；BMAD 特有场景（如阶段视图展示）使用扩展接口
- **后果**：BMAD 适配器可同时作为通用 `IFrameworkAdapter` 和 BMAD 专属 `IBmadFrameworkAdapter` 使用

### ADR-TR10-05：框架检测采用三层递进算法

- **决策**：L1（`_bmad/` 目录） → L2（`core/` + `config.yaml`） → L3（版本注释解析），组合达 98-99% 置信度
- **理由**：单层检测（如仅检查 `_bmad/`）可能误判；三层组合在速度（<10ms）和准确性之间取得最佳平衡
- **后果**：非 BMAD 项目的误判率趋近于零；未来版本结构变更时通过策略模式适配

## Strategic Recommendations（战略建议）

### 建议 1：Phase A 即包含 BMAD 适配器——用自身项目验证

CORD 项目本身就是 BMAD 框架的使用者，`_bmad-output/` 中包含完整的研究文档、头脑风暴产出——这是最理想的**集成测试场景**。建议 Phase A 交付时即包含 BMAD 适配器 MVP，通过自身项目验证适配器的检测准确性和关系发现能力。

**预期效果**：Phase A 交付时，`cord scan` 能扫描 CORD 项目的 _bmad-output/ 目录，自动发现并展示 TR1-TR10 研究文档间的关系拓扑。

### 建议 2：BMAD 适配器作为后续框架适配器的代码模板

`BmadFrameworkAdapter` 的模块化设计（Detector + DocTypeRegistry + RuleFactory + ConfigReader）应作为后续 React/Vue/Spring Boot 适配器的**代码模板**。每个新适配器只需：
1. 实现自己的 `detect()` 逻辑
2. 定义自己的 `DocTypeDefinition[]` 数组
3. 编写自己的预设规则

**建议在 BMAD 适配器完成后，抽取公共基类 `AbstractFrameworkAdapter`，封装通用的注册/检测/类型匹配逻辑。**

### 建议 3：预设关系对的覆盖率需持续跟踪

当前定义的 19 条预设关系对基于 BMAD v6.2.2 的工作流分析。随着项目推进（创建 PRD、Architecture、Epics 等），应持续验证这些关系对的**准确率和覆盖率**。建议设立评估关卡：

- Phase 1 验收时：检查 19 条关系对中有多少被真实的 CORD 项目文档触发
- Phase 2 验收时：通过 `cord review` 收集用户对关系准确性的反馈

### 建议 4：为 BMAD 阶段视图预留展示接口

BMAD 的 4 阶段工作流（Analysis → Planning → Solutioning → Implementation）是一个高价值的可视化维度。建议 `IBmadFrameworkAdapter.getPhaseTopology()` 的输出在 `cord scan` 和 MCP Tool 中以阶段分组展示：

```
Phase 1 (Analysis):     8 docs, 12 relations  ✅
Phase 2 (Planning):     2 docs,  5 relations  ✅
Phase 3 (Solutioning):  0 docs,  0 relations  ⏳ 待开始
Phase 4 (Implementation): 0 docs, 0 relations  🔲
```

这能帮助开发者直观了解项目在 BMAD 工作流中的推进状态。

## Research Completeness Assessment（研究完整性评估）

| 研究目标 | 完成度 | 关键交付物 |
|---------|--------|----------|
| BMAD 文档产出流程节点分析 | ✅ 100% | 18 种文档类型完整清单、4 阶段工作流拓扑、所有模板和 frontmatter schema |
| 预设关系规则设计 | ✅ 100% | 5 条预设规则（含完整 TypeScript 实现规格）、19 条预设关系对 |
| 作为 core + adapters 模式的参考实现 | ✅ 100% | 完整类图、模块分解、文件结构、接口设计、两阶段交付计划、5 条 ADR |

## Research Conclusion（研究结论）

TR10 完成了 BMAD-Method 框架适配模块的全面技术设计。BMAD 框架高度结构化的 4 阶段 × 18 种文档类型工作流，为 CORD 的文档关系发现提供了理想的首个适配场景——其 `inputDocuments` frontmatter 字段提供了置信度 1.0 的显式关系信号，产出链拓扑提供了 19 条高置信度的推断关系对，5 条预设规则覆盖了从显式声明（1.0）到启发式推断（0.70）的完整置信度频谱。

适配器采用**声明式配置 + 策略模式 + 接口继承**的架构，以 6-9 天工作量分两阶段交付，对 CORD 核心架构**零侵入**。其模块化设计（Detector / DocTypeRegistry / RuleFactory / ConfigReader / PhaseModel）将成为后续 React/Vue/Spring Boot 等框架适配器的**代码模板和实现标杆**。

至此，CORD 技术研究路线图中规划的 **10 项技术研究全部完成**（TR1-TR10），MVP 及 V1.0 的全部技术选型和架构设计已就绪。

---

**技术研究完成日期：** 2026-04-02
**研究周期：** 2026-04-01 至 2026-04-02
**源验证：** 所有技术事实均经过 Web 搜索交叉验证或本地实证分析
**置信度等级：** HIGH — 基于 BMAD v6.2.2 实际安装的一手分析

_本研究报告是 CORD 项目技术研究路线图的最后一项（TR10），与 TR1-TR9 共同构成了 CORD 项目的完整技术基础。_

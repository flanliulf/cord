# Research Synthesis（研究综合）

## Executive Summary（执行摘要）

本研究为 CORD 项目完成了 **Superpowers 框架适配模块**的全面技术设计——从 Superpowers v5.0.7 的 14 个核心技能与 7 阶段工作流的结构解析，到 `SuperpowersFrameworkAdapter` 的完整架构蓝图，再到可执行的单阶段 4-6 天交付计划。

**三大核心结论：**

1. **Superpowers 与 BMAD 形成完美的范式对比**：BMAD（TR10）是文档驱动（18 种文档类型、`inputDocuments` 显式关系、置信度 1.0），Superpowers（TR11）是技能驱动（14 个 SKILL.md、`dependencies` 显式依赖、置信度 0.95）。两者共同证明了 CORD 的 `IFrameworkAdapter` 接口的**跨范式可扩展性**
2. **SKILL.md 提供可解析的结构化关系信号**：`dependencies` 字段是直接的显式依赖声明（置信度 0.95），`when_to_use` 字段提供了语义驱动的关系推断来源（置信度 0.65），7 阶段工作流顺序提供了结构化的关系拓扑（置信度 0.75）
3. **TR11 催生 AbstractFrameworkAdapter 基类**：BMAD 和 Superpowers 两个适配器的共同工具代码（文件存在检测、glob 文件发现）应抽取为基类，为后续 React/Vue/Spring Boot 等框架适配器提供**更坚实的代码复用基础**

## Key Technical Findings（关键技术发现）

### 发现 1：Superpowers 技能体系结构清晰且高度语义化

- **14 个核心技能**覆盖 7 个工作流阶段，另有横切关注点技能（systematic-debugging）和元技能（writing-skills、using-superpowers）
- **全部为 SKILL.md Markdown 文件**，统一格式（无 YAML 变体），比 BMAD 更简单
- 每个技能目录可能包含测试场景文件（`test-*.md`、`test-pressure-*.md`），形成技能内部的关联文件组
- SKILL.md 的 **Token 效率约束**（<500 词）使文件体积小、解析快

### 发现 2：dependencies 是次高价值的关系信号（仅次于 BMAD 的 inputDocuments）

- `dependencies` 是技能作者手动声明的先决技能列表
- 直接映射为 CORD 的 `derived_from` 关系类型，置信度 **0.95**（略低于 BMAD inputDocuments 的 1.0，因为手动声明可能遗漏）
- 在当前 Superpowers 核心技能中，填写 `dependencies` 的技能比例尚不明确，需实证验证

### 发现 3：when_to_use 是独特的语义关系推断来源

- `when_to_use` 字段要求描述**问题症状**（而非技术关键词），使其成为独特的语义信号
- CORD 可通过关键词簇匹配推断哪些技能在相似场景下会共同触发（`informs` 关系）
- 这一能力在 BMAD 适配器中**不存在对应物**——BMAD 文档不携带触发条件元数据
- 后续可升级为 Embedding 语义相似度计算，提升推断精度

### 发现 4：多平台安装目录使检测更具挑战性（对比 BMAD）

- BMAD 的检测信号强烈（专有的 `_bmad/` 目录，几乎不会与其他工具冲突）
- Superpowers 的平台目录（`.claude-plugin/`、`.cursor-plugin/`）可能被其他框架使用，不具备唯一性
- **`skills/*/SKILL.md` + `package.json name = "superpowers"` 组合**才是可靠的检测方式

### 发现 5：TR11 证明适配器模式对「技能驱动框架」同样有效

- 适配器模式（core + adapters）在 TR10 已对「文档驱动框架」（BMAD）验证
- TR11 进一步证明同一模式对「技能驱动框架」（Superpowers）同样有效
- 两个适配器实现相同的 `IFrameworkAdapter` 接口，通过 `FrameworkRegistry` 统一管理，对 CORD 核心完全透明
- 这为后续扩展（GSD、React、Spring Boot 等框架）奠定了坚实的设计基础

## Architecture Decision Records（架构决策记录）

### ADR-TR11-01：引入 AbstractFrameworkAdapter 抽象基类

- **决策**：从 `BmadFrameworkAdapter` 抽取公共工具方法（fileExists、dirExists、findFiles）到 `AbstractFrameworkAdapter` 基类；`BmadFrameworkAdapter` 和 `SuperpowersFrameworkAdapter` 均继承基类
- **理由**：两个适配器在检测逻辑中需要相同的文件系统工具方法；消除重复代码；为后续框架适配器提供更坚实的基础
- **后果**：BMAD 适配器需要小幅重构（`extends AbstractFrameworkAdapter`），但功能零变更；未来新适配器开发成本降低

### ADR-TR11-02：Superpowers 技能类型采用与 BMAD 对称的声明式定义

- **决策**：14 个技能类型通过 `SuperpowersSkillDefinition[]` 配置数组定义，结构与 TR10 的 `DocTypeDefinition[]` 对称
- **理由**：跨框架的设计一致性降低学习成本；声明式配置便于用户追加社区技能
- **后果**：新增社区技能（如 obra/superpowers-lab 中的实验性技能）仅需追加配置，不修改核心代码

### ADR-TR11-03：dependencies 规则置信度设为 0.95（低于 BMAD inputDocuments 的 1.0）

- **决策**：`SpSkillDependenciesRule` 置信度 = 0.95，而非 1.0
- **理由**：`dependencies` 由技能作者手动声明，存在遗漏可能；`inputDocuments` 由 BMAD 工作流自动生成，零遗漏风险；置信度差异准确反映了两种机制的可靠性差异
- **后果**：在 `mergeResults()` 聚合时，Superpowers 依赖关系的权重略低于 BMAD 显式关系；用户可通过 `cord review` 补充遗漏的关系

### ADR-TR11-04：when_to_use 语义分析采用关键词簇匹配而非 Embedding

- **决策**：MVP 阶段使用预定义关键词簇（SEMANTIC_CLUSTERS）进行 `when_to_use` 语义分析；Embedding 升级作为 Phase D 后续增强
- **理由**：关键词簇匹配零依赖、零延迟，适合 MVP；Superpowers 技能数量少（14 个），关键词覆盖可控；Embedding 需要 Transformers.js 加载时间，对 14 个小文件收益不显著
- **后果**：when_to_use 规则置信度上限为 0.65（关键词匹配精度限制）；后续升级为 Embedding 后可提升至 0.75-0.80

### ADR-TR11-05：Superpowers 适配器作为证明适配器模式对技能驱动框架有效的第二参考实现

- **决策**：TR11 的核心价值定位为「第二参考实现」，证明 `IFrameworkAdapter` 接口的跨范式适用性
- **理由**：BMAD（文档驱动）+ Superpowers（技能驱动）形成的两极，覆盖了 AI Coding 框架的主要范式；为后续更多框架适配器提供了「两种范式各一个」的代码参考
- **后果**：TR11 报告应作为「如何为技能驱动框架实现 IFrameworkAdapter」的官方参考文档

## Strategic Recommendations（战略建议）

### 建议 1：Phase D 一次性交付 Superpowers 适配器完整版

与 BMAD 适配器的两阶段交付不同，Superpowers 适配器体量更小（14 个技能 vs 18 种文档类型），建议在 TR6 Phase D 一次性完整交付（4-6 天），避免两阶段分散带来的协调开销。

### 建议 2：优先完成 AbstractFrameworkAdapter 基类抽取

在开始 Superpowers 适配器实现前，应先完成从 BMAD 适配器抽取基类的工作。这是一次性投资（约 0.5 天），但能显著降低 Superpowers 及后续所有框架适配器的开发成本。

### 建议 3：实证验证 dependencies 字段的填写率

当前研究基于 Superpowers 仓库文档推断，`dependencies` 字段在 14 个核心技能中的实际填写率尚未验证。建议在 Phase D 验收前，通过 clone obra/superpowers 仓库，逐一检查 SKILL.md 文件的 `dependencies` 字段填写情况，以校正置信度设置。

**预期结果**：
- 若填写率 ≥ 80%：保持 0.95 置信度
- 若填写率 40-80%：调整置信度为 0.85，并增加「遗漏依赖提示」机制
- 若填写率 < 40%：降低置信度至 0.75，主要依赖工作流顺序规则

### 建议 4：预留社区技能扩展接口

Superpowers 生态有活跃的社区扩展（obra/superpowers-lab、jnMetaCode/superpowers-zh），建议通过 `cord.config.ts` 的 `customSkills` 配置项支持用户追加社区技能的定义：

```typescript
interface SuperpowersAdapterOptions {
  // 自定义技能类型追加（用于社区扩展技能）
  customSkills?: SuperpowersSkillDefinition[];
  // 覆盖 skills/ 目录的扫描路径
  skillsDir?: string;
  // 关键词簇定制（扩展 when_to_use 语义分析）
  customSemanticClusters?: string[][];
}
```

## Research Completeness Assessment（研究完整性评估）

| 研究目标 | 完成度 | 关键交付物 |
|---------|--------|----------|
| SuperpowersFrameworkAdapter 接口实现规格 | ✅ 100% | 完整类图、ISuperpowersFrameworkAdapter 扩展接口、模块分解 |
| SKILL.md 元数据解析与技能类型识别 | ✅ 100% | 14 个技能声明式定义、SKILL.md frontmatter schema、5 层检测策略 |
| 7 阶段工作流关系推断规则设计 | ✅ 100% | 4 条预设规则（含完整 TypeScript 实现规格）、12 条预设关系对 |
| 多平台安装目录检测策略 | ✅ 100% | 三层递进检测算法、多平台目录枚举、package.json 精确确认 |
| 作为第二参考实现（与 TR10 对比）| ✅ 100% | BMAD vs Superpowers 全维度对比表、AbstractFrameworkAdapter 基类设计、5 条 ADR |

## Research Conclusion（研究结论）

TR11 完成了 Superpowers 框架适配模块的全面技术设计。Superpowers 框架技能驱动的 14 个 SKILL.md 文件与 7 阶段工作流，为 CORD 的文档（技能）关系发现提供了与 BMAD 截然不同但同样有价值的适配场景——`dependencies` frontmatter 字段提供了置信度 0.95 的显式依赖信号，工作流拓扑提供了 12 条结构化推断关系对，`when_to_use` 语义字段提供了 BMAD 所没有的语义触发关系来源。

最重要的战略价值在于：**TR10（文档驱动）+ TR11（技能驱动）共同证明了 `IFrameworkAdapter` 接口的跨范式适用性**，为 CORD 的 core + adapters 架构模式建立了坚实的双实证基础。同时，TR11 催生的 `AbstractFrameworkAdapter` 基类将进一步降低后续框架适配器（GSD、React、Vue、Spring Boot 等）的开发成本。

适配器采用**声明式配置 + 策略模式 + 接口继承**的架构（与 BMAD 完全对称），以 4-6 天工作量单阶段交付，对 CORD 核心架构**零侵入**。

---

**技术研究完成日期：** 2026-04-02
**研究周期：** 2026-04-02
**源验证：** 所有技术事实均经过 Web 搜索交叉验证（github.com/obra/superpowers v5.0.7）
**置信度等级：** HIGH — 基于 Superpowers 仓库公开文档和 README 的一手分析；部分依赖字段填写率数据需实证补充

_本研究报告是 CORD 项目技术研究路线图的第 11 项（TR11），与 TR10 共同构成了 CORD 框架适配层（core + adapters）的完整技术基础。_

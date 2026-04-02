---
stepsCompleted: [1, 2, 3]
inputDocuments:
  - 'docs/referrence/discuss-with-gpt-01.md'
  - 'docs/referrence/discuss-with-gpt-02.md'
  - 'docs/referrence/discuss-with-gpt-03.md'
  - 'docs/referrence/discuss-with-gemini-01.md'
  - 'docs/referrence/discuss-with-gemini-02.md'
  - 'docs/referrence/discuss-with-gemini-03.md'
  - 'docs/referrence/discuss-with-gemini-04.md'
  - 'docs/referrence/discuss-store-design-with-gemini-01.md'
session_topic: 'AI Coding 场景下的项目文档关联关系管理与一致性同步机制'
session_goals: '设计一个轻量可靠的文档关系图谱载体，支持本地存储、跨设备迁移、LLM 高性能读取、人类可读、与 IDE 工具和 AI Coding 框架深度集成'
selected_approach: 'ai-recommended'
techniques_used: ['Question Storming', 'First Principles Thinking', 'Morphological Analysis']
ideas_generated:
  - '21 个结构化洞察（问题风暴）'
  - '6 条第一性原理'
  - '12 维度拿走vs重建判定矩阵'
  - '7 参数轴最优组合'
  - '9 种传播行为驱动关系类型'
  - 'L1-L5 分层架构'
  - '11 项 MVP 交付物清单'
  - '系统命名: CORD (Context-Oriented Relation for Documents)'
technique_execution_complete: true
product_name: 'CORD'
product_full_name: 'Context-Oriented Relation for Documents'
context_file: ''
---

# Brainstorming Session Results

**Facilitator:** Fancyliu
**Date:** 2026-03-29

## Session Overview

**Topic:** AI Coding 场景下的项目文档关联关系管理与一致性同步机制
**Goals:**
- 轻量本地存储，易于跨设备迁移
- LLM 友好的高性能读取
- 人类可读的直观展示
- 与 Claude Code / Copilot 等 IDE 工具及 BMAD-Method / Superpowers / GSD / OpenSpec 等框架深度集成

### Session Setup

在 AI Coding 开发流程中，项目文档之间存在隐性关联关系，AI Agent 更新文档时经常遗漏关联文档的同步更新。现有方案（文档内备注 + hooks）不够可靠，需要一个轻量级、可靠的"文档关系记忆载体"。

## Technique Selection

**Approach:** AI-Recommended Techniques
**Analysis Context:** 文档关系图谱载体设计，聚焦约束下的产品/技术方案创新

**Recommended Techniques:**

- **Question Storming（问题风暴）：** 穷举关键问题，锚定问题空间，避免遗漏关键约束
- **First Principles Thinking（第一性原理）：** 剥掉惯性假设，从基本真相出发重建方案空间
- **Morphological Analysis（形态分析法）：** 系统性组合关键参数，穷举可行方案并找到最优解

**AI Rationale:** 此序列专为"约束下创新"场景设计——先锚定问题、再拆掉假设、最后系统组合，三步走向可落地的最优方案。

## Technique Execution Results

### 阶段 1：Question Storming（问题风暴）

**探索维度：** 6 个正交维度，30 个关键问题
**核心发现：** 从关系本质、机制触发、LLM消费、人类消费、IDE/框架集成、边界约束六个维度全面锚定问题空间

---

#### 维度 1：文档关系的本质

**[关系类型 #1]**: 多维关系类型体系
_Concept_: 文档间关系远不止"引用"一种，至少包括：单向依赖、双向同步、层级包含、派生关系、约束关系、生命周期关系、模板关系、冲突关系、聚合关系、版本关系、上下文注入关系、验证关系、互斥关系。
_Novelty_: 超越了传统的"A引用B"扁平模型，建立了多维度的关系类型学。

**[关系强度 #2]**: 强关联与弱关联分级
_Concept_: 关系有强弱之分——强关联（必须同步更新）直接影响 AI 编程正确性，弱关联（如"A参考B"）也需记录但触发策略不同。
_Novelty_: 引入关系强度维度，避免"一刀切"的同步策略导致噪音过大。

**[动态演化 #3]**: 关系的生命周期
_Concept_: 关系是动态的——会创建、演化、甚至消亡（消亡也是一种"过时的关系"需要标记）。不是静态配置表，而是活的关系网络。
_Novelty_: "过时关系"作为一种有价值的历史信息保留，而非简单删除。

---

#### 维度 2：机制与触发

**[AI 驱动维护 #4]**: AI Agent 发现与维护关系
_Concept_: 关系的识别和维护由 AI Agent 主导完成。在研发过程中，文档的新建、修改、引用等任何变更都应触发关系的自动识别和更新。需要通过 skills 和 hooks 等机制来实现。
_Novelty_: 人类不直接维护关系图谱，而是通过与 AI 对话间接驱动，降低维护成本。

**[策略可配置 #5]**: 按文档类别配置更新策略
_Concept_: 不同文档/文档类别可配置不同的更新策略——哪些允许 AI 自动更新关联文档，哪些需要生成更新建议后提醒用户确认。
_Novelty_: 在自动化和人工控制之间提供细粒度的策略配置，而非全有或全无。

**[变更即触发 #6]**: 落盘即可追踪
_Concept_: 任何文档变更都必须落盘，落盘即可通过 hooks 追踪从而触发关系检查。需要明确区分项目 AI 文档和项目源码文件——源码不在管辖范围内。
_Novelty_: 划定了清晰的管辖边界——AI/框架文档 Yes，源码及源码目录下的文档 No。

---

#### 维度 3：LLM 消费场景

**[按需加载 #7]**: 渐进式披露是核心思想
_Concept_: LLM 不全量加载关系图谱，而是按需查询——只有在某个文档触发时才查询与之相关的关系。绝对避免无效查询。这正是关系存储存在的核心意义。
_Novelty_: 关系图谱的价值不在于"有多全"，而在于"能多精准地只给 LLM 它当下需要的那部分"。

**[两级粒度 #8]**: 文档级 → 章节/段落级
_Concept_: 关系核心是文档级的"A关联B"。如有必要下钻，才渐进式查询章节/段落颗粒度。存储需要考虑这两级。
_Novelty_: 分层索引设计——第一级快速定位关联文档，第二级按需深入到内容段落。

**[通用协议 #9]**: 一个格式适配所有 LLM
_Concept_: 提供一个通用协议/格式供所有 LLM（Claude/GPT/Gemini）消费，而非针对不同 LLM 做适配。
_Novelty_: 协议层面的抽象，确保工具的跨 LLM 通用性。

---

#### 维度 4：人类消费场景

**[双视图 #10]**: 全局鸟瞰 + 局部探查
_Concept_: 人类需要两种视图——全局鸟瞰（整个项目文档关系全景）和局部探查（某个文档和谁有关），且日常开发中随时可能查看。
_Novelty_: 同一份数据的两种可视化渲染模式。

**[图形化可视化 #11]**: 关系图形化展示
_Concept_: 人类更偏好图形化的关系图来直观理解文档关系，而非列表或表格。
_Novelty_: 可视化是给人类的，结构化数据是给 LLM 的——"一个数据源，两个消费接口"。

**[AI 驱动编辑 #12]**: 人类不手动编辑关系
_Concept_: 即使需要补充关系，也应交由 AI 对话驱动完成，人类不直接编辑关系图谱数据。
_Novelty_: 关系图谱的"写"操作完全由 AI 代理，人类只做"读"和"指令"。

**[双功能分离 #13]**: 人类展示与 AI 消费是两个独立功能
_Concept_: for 人类的展示需求和 for AI Agent 的消费需求是两个大的功能模块，不应强行放一起，但都需要考虑设计。统一数据源，分离消费接口。
_Novelty_: 架构层面的关注点分离——存储层统一，读取层分叉。

---

#### 维度 5：IDE / 框架集成

**[全栈集成 #14]**: MCP + Hooks + Skills + CLAUDE.md
_Concept_: 关系数据以 MCP Server 形式提供，通过 Skills 被触发调用，Skills 由 CLAUDE.md 全局指令定义，Hooks 保障文档变更时自动触发更新。这些配套产物都是系统需要提供的。
_Novelty_: 不是单一集成点，而是一个覆盖数据层→触发层→能力层→指令层的完整技术栈。

**[跨 IDE 兼容 #15]**: Skills 通用 + Hooks 替代方案
_Concept_: Skills 机制大多数 IDE 都支持。对于没有 hooks 机制的 IDE，需要考虑替代方案——如自定义一套配置和触发脚本来模拟 hooks 行为。
_Novelty_: 承认不同 IDE 能力差异，提供降级兼容方案。

**[通用协议 + 框架适配 #16]**: 核心通用，适配可插拔
_Concept_: 提供框架无关的通用协议，各框架可做适配层。默认提供 BMAD-Method 的适配实现作为示例。独立于框架是核心能力，框架适配是扩展能力。
_Novelty_: 开源生态的经典架构——core + adapters 模式。

**[框架 Module 适配 #17]**: 为主流框架提供专用适配模块
_Concept_: 如 BMAD-Method 可提供专门的 Module 来适配其流程节点（每个产出文档的环节自动触发关系检查）。其他热门框架同理。
_Novelty_: 框架适配不是"让用户自己配"，而是提供开箱即用的预设模块。

---

#### 维度 6：边界与约束

**[文档管辖范围 #18]**: 框架文档 + IDE 指令文档 + 用户自定义文档
_Concept_: 核心管理资产包括：框架产出文档、AI IDE/Agent 指令规范文档（如 CLAUDE.md）、用户在框架之外自行指令产生的文档。排除项目源码目录（src）下的所有内容。需为主流框架和 IDE 提供预设的路径/目录/文件名配置。
_Novelty_: 管辖范围的精确划定，避免"管太多"导致噪音，也避免"管太少"遗漏关键文档。

**[项目级维护 #19]**: 以项目为单位，子模块关系内化
_Concept_: 关系图谱以项目维度维护。对于子模块/微服务场景，通过特定的关系类型（如跨模块依赖、共享文档引用等）来承载，而非分散为多个独立图谱。
_Novelty_: 单一图谱 + 关系类型扩展，而非多图谱联邦。

**[冷启动能力 #20]**: 初始化扫描 + 逆向分析
_Concept_: 提供初始化功能扫描现有文档自动建立关系。对于已积累大量文档但无关系图谱的项目，逆向分析能力是"非常重要"的核心功能。
_Novelty_: 冷启动不是边缘场景，而是大多数用户的首次使用体验——决定了产品的第一印象。

**[性能红线 #21]**: 50ms / 2000 文档 / 50000 关系
_Concept_: 查询一个文档的一级关联需在 50ms 内返回。系统按上限 2000 个文档、50000 条关系来设计。
_Novelty_: 明确的性能 SLA——直接影响存储方案的技术选型（排除纯文本遍历方案）。

---

#### Question Storming 小结

| 维度 | 核心发现 |
|------|----------|
| 关系本质 | 10+ 种关系类型，动态演化，强弱分级 |
| 机制触发 | AI Agent 发现维护，按文档类别配置更新策略 |
| LLM 消费 | 按需加载，渐进式披露，两级粒度（文档级→章节级） |
| 人类消费 | 图形化可视化，全局鸟瞰+局部探查，AI 驱动编辑，双功能分离 |
| IDE/框架集成 | MCP+Hooks+Skills+CLAUDE.md 全栈，通用协议+框架适配层 |
| 边界约束 | 50ms/2000文档/50000关系，冷启动逆向扫描必备 |

---

### 阶段 2：First Principles Thinking（第一性原理思维）

**探索方式：** 拆解惯性假设，从基本真相出发重建方案空间
**参考材料整合：** 综合 GPT 3轮讨论 + Gemini 4轮讨论 + Gemini 存储设计专题讨论

---

#### 已锚定的第一性原理

**原理 1：确定性优于推理性**
> LLM 必须依赖确定的、被图谱所保存并提供的事实，而不是靠推理来判断文档关联。图谱是必需品，不是可选手段。

**原理 2：集中式存储为唯一真相源**
> 混合式架构——集中式主存储为唯一真相源，文档内轻量标记仅为辅助参考。变更操作永远依赖于确定的集中式存储。

**原理 3：一个数据源，两个消费接口**
> for 人类的展示需求和 for AI Agent 的消费需求是两个独立功能模块。存储层统一，读取层分叉——LLM 走高性能按需查询通道，人类走可视化渲染通道。

**原理 4：通用协议 + 框架适配层**
> 核心通用，适配可插拔。独立于框架是核心能力，框架适配是扩展能力。core + adapters 架构模式。

**原理 5：渐进式披露 + 按需加载**
> 关系图谱的价值在于精准地只给 LLM 它当下需要的那部分。两级粒度：文档级 → 章节/段落级。

**原理 6：图模型思维建表**
> 即使 MVP 使用 SQLite，也应以图模型（节点表+边表）思维建表，为未来平滑迁移到原生图数据库做准备。

---

#### 参考材料交叉分析

**GPT 方案（3轮）核心贡献：**
- 6 大类 30+ 种 relation_type 字典（过于详尽，需简化）
- 完整 SQLite schema（5张表，需精简为核心3张）
- 5 组核心 API + hooks 流水线
- 扫描脚本原型（含 frontmatter 解析）

**Gemini 方案（4轮）核心贡献：**
- 5 种核心关系类型（过于简单，需扩展）
- JSON 优先的 MVP 思路 + CLI 工具
- Skill → MCP 渐进演进路线

**Gemini 存储设计专题核心贡献：**
- **Kùzu 嵌入式图数据库**作为 SQLite 升级路径（图数据库界的 SQLite）
- **Repository Pattern** 实现 SQLite → Kùzu 平滑迁移
- **L1-L5 分层架构**（数据层→仓储层→接口层→技能层→消费端）
- **意图驱动的 Skill 设计**（`analyze_impact` 而非 `query_edges`）
- Node.js/TS 环境两者均有原生支持

---

#### 最终"拿走 vs 重建"判定矩阵

| 维度 | 最终判定 | 最佳来源 | 理由 |
|------|----------|----------|------|
| 存储架构 | **拿走** | GPT + Gemini | SQLite（MVP）→ Kùzu（V2）+ JSON 快照 |
| 架构分层 | **拿走** | Gemini 存储专题 | Repository Pattern 隔离存储引擎 |
| 接口层 | **拿走** | GPT + Gemini | MCP Server 为主 |
| 能力层 | **拿走** | Gemini 存储专题 | 意图驱动的 Skills |
| 数据模型 | **拿走并简化** | GPT（简化版）| 核心 3 张表（documents/relations/sync_state），evidence/anchors 后加 |
| 关系类型 | **重建** | 我们的发现 | 按"传播行为"而非"语义标签"分类 |
| 可视化层 | **新建** | 我们的发现 | Mermaid + 全局/局部视图，两份参考均缺失 |
| 框架适配层 | **新建** | 我们的发现 | core + adapters 架构，两份参考均缺失 |
| 冷启动 | **增强** | GPT + 我们的发现 | GPT 扫描脚本为基线 + 框架文档识别增强 |
| 跨 IDE 兼容 | **新建** | 我们的发现 | Skills 通用 + Hooks 降级方案 |
| 两级粒度 | **新建** | 我们的发现 | 文档级 → 章节/段落级分层索引 |
| 演进路线 | **拿走** | Gemini | Skill→MCP 渐进路线 |

---

### 阶段 3：Morphological Analysis（形态分析法）

**探索方式：** 系统性定义关键参数轴，穷举可行组合，找到最优方案
**核心输出：** 7 个参数轴的最优组合 + 系统架构 + MVP 交付物清单

---

#### 系统命名

**CORD** — Context-Oriented Relation for Documents

备选释义：
- **CORVUS**: Context-Oriented Relation Versioned Unified System（拉丁语"乌鸦属"，隐喻智慧信使遍历关系网络）
- **COREX**: Context-Oriented Relation EXchange

---

#### 关键参数轴最优组合

| # | 参数轴 | 最优选项 | 理由 |
|---|--------|----------|------|
| **P1** | 存储引擎 | SQLite + Kùzu 可切换（Repository Pattern） | MVP 用 SQLite 快速验证，Repository 隔离为 Kùzu 留路；一跳查询为主，SQLite 完全胜任 |
| **P2** | 关系类型分类法 | 按传播行为分类（9种） | GPT 的 30+ 种太细增加维护负担，Gemini 的 5 种太粗无法区分同步策略；按"触发后做什么"分类最实用 |
| **P3** | 接口暴露方式 | CLI + MCP + RESTful API 三模式 | CLI 供 hooks/脚本调用，MCP 供 AI IDE 集成，RESTful API 供 Web UI 衍生系统 |
| **P4** | 触发机制 | Hooks + 全局指令文件 + Skills 全栈 | 三层保障互补：Hooks 强保障落盘触发，全局指令文件定义规则，Skills 封装意图驱动能力 |
| **P5** | 可视化方案 | 本系统 Mermaid 静态渲染 + 独立 Web UI 衍生插件 | 关注点分离：本系统专注核心能力，复杂可视化作为独立消费者通过 RESTful API 连接 |
| **P6** | 框架适配 | 通用协议 + BMAD 适配模块作为示例 | 核心通用确保可推广，BMAD 适配降低上手成本 |
| **P7** | 技术栈 | TypeScript / Node.js | MCP SDK / better-sqlite3 / kuzu 均有原生 TS 支持 |

---

#### 关系类型体系（按传播行为分类）

| 传播行为 | 关系类型名称 | 触发动作 | 覆盖场景 |
|----------|-------------|----------|----------|
| **必须同步** | `sync_required` | 自动更新或生成 patch 提议 | 枚举列表同步、聚合视图更新、内容抽取 |
| **建议同步** | `sync_suggested` | 标记 stale + 提醒用户 | 摘要过期、弱引用内容变化 |
| **一致性约束** | `must_consistent` | CI/hooks 校验 + 冲突标记 | ADR 约束实现、规范约束文档 |
| **派生依赖** | `derived_from` | 源变更时标记派生物 stale 或重生成 | 生成文档、模板派生、代码生成 |
| **上下文注入** | `context_for` | 被关联文档处理时自动注入上下文 | CLAUDE.md / AGENTS.md 对所有文档、project-context 等 |
| **生命周期绑定** | `lifecycle_bound` | 状态变更时触发关联文档状态审查 | Epic 完成→Sprint Plan 更新 |
| **结构包含** | `contains` | 结构变更时更新索引/导航 | 目录包含章节、模块包含子文档 |
| **普通引用** | `references` | 仅记录，不主动触发（查询时可追溯） | 一般引用、术语引用、示例引用 |
| **已过时** | `deprecated` | 阻止 AI 引用旧文档，引导到新文档 | 版本替代、废弃决策 |

**设计原则：** 9 种关系类型，每种都有明确的"系统该做什么"。相比 GPT 的 30+ 种减少 70% 复杂度，同时比 Gemini 的 5 种多覆盖了上下文注入、生命周期绑定、结构包含、已过时 4 种核心类型。

---

#### 系统分层架构

```
┌─────────────────────────────────────────────────────┐
│  L5 消费端                                           │
│  ┌──────────────┐  ┌─────────────────────────────┐  │
│  │ Web UI (衍生) │  │ Claude Code / Copilot /     │  │
│  │   ↓ RESTful   │  │ Cursor 等 AI IDE            │  │
│  │   ↓ API       │  │   ↓ 倾向走 L4 Skills        │  │
│  │   ↓           │  │   ↓ (也可直连 MCP)          │  │
│  └───┼──────────┘  └───┼─────────────────────────┘  │
├──────┼──────────────────┼───────────────────────────┤
│  L4 技能层 (Skills) — 意图驱动，渐进式披露            │
│  analyze_impact / sync_docs / init_graph /           │
│  query_relations / export_snapshot                   │
├──────┼──────────────────┼───────────────────────────┤
│  L3 接口层                                           │
│  ┌────────────┐ ┌────────────┐ ┌──────────────────┐ │
│  │ CLI (Hooks/ │ │ MCP Server │ │ RESTful API      │ │
│  │  脚本直调)  │ │ (AI IDE)   │ │ (Web UI 衍生)    │ │
│  └──────┬─────┘ └─────┬──────┘ └────────┬─────────┘ │
├─────────┴─────────────┴─────────────────┴───────────┤
│  L2 仓储层 (Repository Pattern)                      │
│  IGraphRepository → SQLiteRepo / KuzuRepo            │
├─────────────────────────────────────────────────────┤
│  L1 数据层                                           │
│  SQLite (MVP) → Kùzu (V2) + JSON 快照 (git 审阅)    │
├─────────────────────────────────────────────────────┤
│  触发层 (横切关注点)                                  │
│  Hooks (文档落盘触发)                                 │
│  + CLAUDE.md / AGENTS.md / instructions.md /         │
│    .cursorrules 等全局指令文件                         │
│  + 框架适配模块 (BMAD Module 等)                      │
└─────────────────────────────────────────────────────┘

可视化层 (独立衍生系统/插件)
  本系统内: Mermaid 静态渲染 (一跳/有限数量)
  衍生插件: Web UI 交互式 (全局鸟瞰 + 局部探查)
           通过 L3 RESTful API 连接
```

---

#### MVP 交付物清单

| # | 交付物 | 描述 |
|---|--------|------|
| 1 | **Core Library** | IGraphRepository 接口 + SQLiteGraphRepository 实现（图模型建表） |
| 2 | **CLI 工具** | `cord init` / `cord query` / `cord impact` / `cord sync` / `cord export` |
| 3 | **MCP Server** | 暴露意图驱动 Tools 供 AI IDE 调用 |
| 4 | **RESTful API** | 供 Web UI 衍生系统连接的数据接口 |
| 5 | **Skills 模板** | 意图驱动的 Skill 定义文件（Claude Code 格式 + 通用格式） |
| 6 | **Hooks 配置** | 文档变更时自动触发关系检查的 hook 脚本 |
| 7 | **全局指令片段** | CLAUDE.md + AGENTS.md + instructions.md（Copilot）+ .cursorrules 等多 IDE 指令模板 |
| 8 | **BMAD 适配模块** | BMAD 框架的预设关系规则和流程节点触发配置（作为框架适配示例） |
| 9 | **冷启动扫描器** | 扫描现有项目文档自动建立初始关系图谱（含框架文档结构识别） |
| 10 | **Mermaid 渲染器** | 一跳关系的 Mermaid 图生成（本系统内轻量可视化） |
| 11 | **JSON 快照导出** | 供 git 审阅的全量关系快照 |

---

## Session Summary

### 会话总体成果

**产品名称：** CORD (Context-Oriented Relation for Documents)
**核心定位：** AI Coding 场景下的项目文档关联关系管理与一致性同步引擎

**三阶段探索成果：**

1. **Question Storming（问题风暴）** — 6 个正交维度、30 个关键问题、21 个结构化洞察，全面锚定了问题空间
2. **First Principles Thinking（第一性原理）** — 锚定 6 条第一性原理，整合 GPT/Gemini 共 8 轮讨论的参考材料，产出"拿走 vs 重建"判定矩阵
3. **Morphological Analysis（形态分析法）** — 7 个参数轴的最优组合、9 种传播行为驱动的关系类型体系、L1-L5 分层架构、11 项 MVP 交付物清单

**本系统的差异化价值（相比 GPT/Gemini 方案的独有发现）：**
- 可视化层设计（Mermaid + Web UI 衍生系统）
- 框架适配层架构（core + adapters 模式）
- 按传播行为分类的 9 种关系类型（vs GPT 的 30+ / Gemini 的 5）
- 跨 IDE 全局指令文件兼容（CLAUDE.md / AGENTS.md / instructions.md / .cursorrules）
- 两级粒度分层索引（文档级 → 章节/段落级）
- 独立 Web UI 作为衍生消费者的关注点分离设计

### Creative Facilitation Narrative

本次头脑风暴从一个看似"文档同步"的技术问题出发，通过三阶段渐进式探索，最终演化为一个完整的**AI Coding 生态基础设施产品蓝图**。Fancyliu 展现了极强的架构直觉和产品边界感——在每个关键决策点都能精准地在"过度设计"和"不够充分"之间找到最佳平衡。特别是"确定性优于推理性"、"一个数据源两个消费接口"、"通用协议+框架适配"这三个核心判定，将一个工具级项目提升到了平台级思维。

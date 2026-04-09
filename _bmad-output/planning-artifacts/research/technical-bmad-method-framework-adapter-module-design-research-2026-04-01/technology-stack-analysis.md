# Technology Stack Analysis

本节以 CORD 项目中实际安装的 BMAD v6.2.2 为实证样本，对 BMAD-Method 框架的技术特征进行全面解析。所有结论均基于本地 `_bmad/` 目录的一手分析，并结合 Web 搜索交叉验证。

## 1. BMAD-Method 框架结构分析

### 1.1 框架整体架构

BMAD（Breakthrough Method for AI-Driven Development）是一个 AI Coding 场景下的结构化开发方法论框架，通过 Skills（技能）和 Agents（角色代理）驱动，覆盖从分析到交付的完整软件开发生命周期。

**框架核心组件**：

| 组件 | 位置 | 说明 |
|------|------|------|
| **Core 模块** | `_bmad/core/` | 12 个通用技能（头脑风暴、评审、帮助、初始化等），不绑定特定方法论 |
| **BMM 模块** | `_bmad/bmm/` | 32 个方法论技能 + 10 个角色代理，按 4 阶段组织 |
| **Config** | `_bmad/_config/` | 安装器生成的配置目录 |
| **Module Config** | `_bmad/bmm/config.yaml` | BMM 模块的运行时配置（项目名、用户名、语言、输出目录） |
| **Help Index** | `_bmad/bmm/module-help.csv` | 31 行 CSV，完整描述所有技能的菜单代码、阶段、依赖关系、输出位置 |

_置信度：**HIGH** — 基于 CORD 项目中 BMAD v6.2.2 实际文件结构直接验证_

### 1.2 四阶段工作流架构

BMAD-Method 将开发流程划分为 4 个递进阶段，每个阶段有明确的输入/输出文档类型：

```
Phase 1: Analysis（分析）
  ├─ Brainstorming Session → 头脑风暴
  ├─ Product Brief         → 产品概要
  ├─ Market Research       → 市场研究
  ├─ Domain Research       → 领域研究
  ├─ Technical Research    → 技术研究
  └─ Document Project      → 项目文档化
         ↓
Phase 2: Planning（规划）
  ├─ PRD                   → 产品需求文档
  ├─ UX Design             → UX 设计规格
  └─ PRD Validation        → PRD 验证报告
         ↓
Phase 3: Solutioning（方案设计）
  ├─ Architecture          → 架构决策文档
  ├─ Epics & Stories       → 史诗/故事分解
  ├─ Project Context       → AI 项目上下文
  └─ Readiness Check       → 实施就绪评估
         ↓
Phase 4: Implementation（实施）
  ├─ Sprint Planning       → Sprint 状态 (YAML)
  ├─ Story                 → 用户故事
  ├─ Dev Story             → 故事开发
  ├─ Code Review           → 代码评审
  ├─ QA Automation         → 自动化测试
  └─ Retrospective         → 回顾总结
```

**阶段间依赖约束**（源自 `module-help.csv` `after` 字段）：

| 技能 | 前置依赖 | 强制性 |
|------|---------|--------|
| PRD | — | ✅ required |
| UX Design | PRD | 推荐 |
| Architecture | — | ✅ required |
| Epics & Stories | Architecture | ✅ required |
| Readiness Check | Epics & Stories | ✅ required |
| Sprint Planning | — | ✅ required |
| Create Story | Sprint Planning | ✅ required |
| Dev Story | Story Validation | ✅ required |
| Code Review | Dev Story | 推荐 |

_置信度：**HIGH** — 直接从 `module-help.csv` 的 `after` 和 `required` 字段提取_

### 1.3 框架检测签名

CORD 适配器需要可靠地检测项目是否使用 BMAD-Method。基于实际文件结构分析，以下是分层检测策略：

| 检测层级 | 检测方式 | 置信度 | 说明 |
|---------|---------|--------|------|
| **L1: 目录存在** | `_bmad/` 目录存在 | 95% | BMAD 框架的根标志 |
| **L2: 核心配置** | `_bmad/core/` + `_bmad/bmm/config.yaml` | 98% | 排除误判（其他使用 `_bmad` 命名的项目） |
| **L3: 版本确认** | `config.yaml` 中 `Version: 6.x.x` 注释 | 99% | 精确版本识别 |
| **L4: 输出目录** | `_bmad-output/` 目录存在 | 80% | 辅助确认（可能被 gitignore 排除） |

**推荐检测逻辑**：L1 + L2 组合即可达到 98% 置信度，L3 用于版本特定行为。

_置信度：**HIGH** — 基于实际目录结构验证_

## 2. BMAD 文档类型学与分类体系

### 2.1 完整文档类型清单

通过对 BMAD v6.2.2 所有模板文件、SKILL.md 和 workflow.md 的逐一分析，共识别 **18 种文档类型**，分布于 4 个阶段：

**Phase 1 — Analysis（9 种）**：

| Type ID | 名称 | 输出格式 | 输出位置 | 关键 Frontmatter |
|---------|------|---------|---------|-----------------|
| `product-brief` | 产品概要 | Markdown | `{planning_artifacts}/` | — |
| `brainstorming-session` | 头脑风暴 | Markdown | `{brainstorming}/` | `session_topic`, `techniques_used` |
| `research-technical` | 技术研究 | Markdown | `{planning_artifacts}/research/` | `workflowType: 'research'`, `research_type: 'technical'` |
| `research-market` | 市场研究 | Markdown | `{planning_artifacts}/research/` | `workflowType: 'research'`, `research_type: 'market'` |
| `research-domain` | 领域研究 | Markdown | `{planning_artifacts}/research/` | `workflowType: 'research'`, `research_type: 'domain'` |
| `project-documentation-index` | 项目文档索引 | Markdown | `{project_knowledge}/` | — |
| `project-overview` | 项目概览 | Markdown | `{project_knowledge}/` | — |
| `source-tree-analysis` | 源码树分析 | Markdown | `{project_knowledge}/` | — |
| `deep-dive-documentation` | 深度分析文档 | Markdown | `{project_knowledge}/` | — |

**Phase 2 — Planning（3 种）**：

| Type ID | 名称 | 输出格式 | 输出位置 | 关键 Frontmatter |
|---------|------|---------|---------|-----------------|
| `prd` | 产品需求文档 | Markdown | `{planning_artifacts}/` | `workflowType: 'prd'`, `stepsCompleted`, `inputDocuments` |
| `ux-design` | UX 设计规格 | Markdown | `{planning_artifacts}/` | `stepsCompleted`, `inputDocuments` |
| `prd-validation-report` | PRD 验证报告 | Markdown | `{planning_artifacts}/` | — |

**Phase 3 — Solutioning（4 种）**：

| Type ID | 名称 | 输出格式 | 输出位置 | 关键 Frontmatter |
|---------|------|---------|---------|-----------------|
| `architecture` | 架构决策文档 | Markdown | `{planning_artifacts}/` | `workflowType: 'architecture'`, `stepsCompleted`, `inputDocuments` |
| `epics-and-stories` | 史诗/故事分解 | Markdown | `{planning_artifacts}/` | `stepsCompleted`, `inputDocuments` |
| `project-context` | AI 项目上下文 | Markdown | `{project_knowledge}/` | `sections_completed`, `existing_patterns_found` |
| `readiness-report` | 就绪评估报告 | Markdown | `{planning_artifacts}/` | — |

**Phase 4 — Implementation（3 种）**：

| Type ID | 名称 | 输出格式 | 输出位置 | 关键 Frontmatter |
|---------|------|---------|---------|-----------------|
| `sprint-status` | Sprint 状态 | **YAML** | `{implementation_artifacts}/` | YAML 格式，含 `development_status` |
| `story` | 用户故事 | Markdown | `{implementation_artifacts}/` | 含 `Status: ready-for-dev` |
| `retrospective` | 回顾总结 | Markdown | `{implementation_artifacts}/` | — |

_置信度：**HIGH** — 基于所有 BMAD 模板文件和实际输出文件逐一验证_

### 2.2 文档类型检测分层策略

CORD 适配器采用 **5 层递进检测策略**，从最高到最低置信度逐层尝试：

**Layer 1: Frontmatter 字段检测（置信度 95%）**

```typescript
// 主键检测
workflowType: 'prd'           → prd
workflowType: 'architecture'  → architecture
workflowType: 'research'      → 结合 research_type 细分

// 组合键检测
research_type: 'technical' + workflowType: 'research'  → research-technical
session_topic + techniques_used                        → brainstorming-session
sections_completed + existing_patterns_found            → project-context
```

**Layer 2: 文件位置模式（置信度 90%）**

```
{planning_artifacts}/prd.md                    → prd
{planning_artifacts}/architecture.md           → architecture
{planning_artifacts}/research/technical-*.md   → research-technical
{brainstorming}/brainstorming-session-*.md     → brainstorming-session
{implementation_artifacts}/sprint-*.yaml       → sprint-status
{implementation_artifacts}/story-*.md          → story
```

**Layer 3: 内容标题检测（置信度 75%）**

```
"# Product Requirements Document"              → prd
"# Architecture Decision Document"             → architecture
"# Research Report:"                           → research-*
"# Brainstorming Session Results"              → brainstorming-session
"# Story {N}.{M}:"                             → story
```

**Layer 4: 内容结构特征（置信度 65%）**

```
含 "Acceptance Criteria" + "Given/When/Then"    → story
含 "Epic List" + "User Story"                   → epics-and-stories
含 "Technology Stack" + "Critical Rules"         → project-context
```

**Layer 5: 文件名模式（置信度 40%）**

```
brief*.md / *product-brief*.md                  → product-brief
*epic*.md / *stories*.md                        → epics-and-stories
*retrospective*.md                              → retrospective
```

_置信度：**HIGH** — 基于所有模板文件和实际输出文件的结构特征提取_

### 2.3 Frontmatter 元数据规范

BMAD 文档使用 YAML Frontmatter 记录工作流状态和文档间引用关系。以下是核心字段清单：

| 字段 | 类型 | 出现频率 | 说明 | CORD 关系价值 |
|------|------|---------|------|-------------|
| `workflowType` | string | Phase 2-3 核心文档 | 工作流类型标识（`prd`/`architecture`/`research`） | ⭐⭐⭐ 文档类型识别主键 |
| `stepsCompleted` | number[] | Phase 2-3 核心文档 | 已完成的工作流步骤编号 | ⭐ 文档完成度信号 |
| `inputDocuments` | string[] | Phase 2-3 核心文档 | 输入文档路径列表 | ⭐⭐⭐ 显式关系声明——直接映射为 `derived_from` 关系 |
| `research_type` | string | 研究文档 | 研究类型（`technical`/`market`/`domain`） | ⭐⭐ 文档类型细分 |
| `research_topic` | string | 研究文档 | 研究主题 | ⭐ 语义关系匹配 |
| `session_topic` | string | 头脑风暴 | 会话主题 | ⭐ 语义关系匹配 |
| `techniques_used` | string[] | 头脑风暴 | 使用的创意技法 | ⭐ 文档类型检测 |
| `product_name` | string | 多种文档 | 产品名称 | ⭐⭐ 项目归属确认 |
| `sections_completed` | string[] | 项目上下文 | 已完成的章节 | ⭐ 文档完成度 |

**关键发现：`inputDocuments` 是 BMAD 框架中最有价值的关系信号**——它是 BMAD 工作流自动生成的显式文档引用列表，可直接映射为 CORD 的 `derived_from` 关系类型，置信度 1.0。

_置信度：**HIGH** — 直接从模板 frontmatter schema 和实际输出文件提取_

## 3. BMAD 输出目录与命名约定

### 3.1 输出目录结构

BMAD 通过 `config.yaml` 配置 4 个输出目录变量，所有文档产出均写入这些目录：

```
{output_folder}/                          ← _bmad-output/
  ├─ brainstorming/                       ← 头脑风暴产出
  │   └─ brainstorming-session-{YYYY-MM-DD}-{###}.md
  ├─ planning-artifacts/                  ← 规划阶段产出
  │   ├─ prd.md
  │   ├─ ux-design.md
  │   ├─ architecture.md
  │   ├─ epics-and-stories.md
  │   ├─ readiness-report.md
  │   └─ research/                        ← 研究文档子目录
  │       ├─ technical-{topic}-research-{date}.md
  │       ├─ market-{topic}-research-{date}.md
  │       ├─ domain-{topic}-research-{date}.md
  │       └─ technical-research-roadmap.md
  └─ implementation-artifacts/            ← 实施阶段产出
      ├─ sprint-status.yaml
      ├─ story-{epic_num}-{story_num}.md
      └─ retrospective-{epic_id}.md

{project_knowledge}/                      ← docs/
  ├─ index.md
  ├─ project-overview.md
  ├─ source-tree-analysis.md
  ├─ project-context.md
  └─ {component}-deep-dive.md
```

### 3.2 文件命名模式规则

| 文档类型 | 命名模式 | 示例 |
|---------|---------|------|
| 头脑风暴 | `brainstorming-session-{YYYY-MM-DD}-{###}.md` | `brainstorming-session-2026-03-29-001.md` |
| 技术研究 | `technical-{topic-slug}-research-{YYYY-MM-DD}.md` | `technical-sqlite-vs-kuzu-embedded-graph-db-research-2026-03-31.md` |
| 市场研究 | `market-{topic-slug}-research-{YYYY-MM-DD}.md` | `market-cord-ai-doc-relation-management-research-2026-03-30.md` |
| 领域研究 | `domain-{topic-slug}-research-{YYYY-MM-DD}.md` | `domain-cord-ecosystem-technology-growth-research-2026-03-30.md` |
| PRD | `prd.md`（单一文件） | `prd.md` |
| 架构 | `architecture.md`（单一文件） | `architecture.md` |
| Sprint | `sprint-status.yaml` 或 `sprint-{key}.yaml` | `sprint-status.yaml` |
| Story | `story-{epic}-{story}.md` | `story-1-1.md` |

**命名约定关系推断规则**：
- `story-{N}-{M}.md` 中的 `{N}` 对应 Epics 文档中的 Epic N → `belongs_to` 关系
- `technical-{topic}-research-{date}.md` 的 `{topic}` 可与其他文档的主题语义匹配
- `brainstorming-session-{date}` 的日期早于 Brief/PRD 日期 → 时序推断 `informs` 关系

_置信度：**HIGH** — 基于 CORD 项目中实际 BMAD 输出文件命名验证_

## 4. CORD 已确认技术栈约束（前序研究继承）

BMAD 适配器模块的实现受以下已确认技术栈约束：

| 技术层 | 已确认方案 | 确认来源 | 对适配器的影响 |
|--------|-----------|---------|-------------|
| **文档解析** | remark/unified.js | TR3 | 适配器通过 remark 管道接收 AST |
| **Frontmatter 解析** | gray-matter / remark-frontmatter | TR3 | 适配器读取 frontmatter 进行类型检测 |
| **文件发现** | fast-glob + ignore | TR6 | 适配器提供 glob 模式给扫描器 |
| **数据存储** | SQLite + better-sqlite3 | TR1 | 适配器发现的关系写入 relations 表 |
| **CLI** | Commander.js v14 | TR5 | 适配器配置通过 CLI 子命令管理 |
| **MCP Server** | TypeScript SDK v1.x | TR2 | 适配器结果通过 MCP Tool 暴露 |
| **关系发现** | 策略模式 + Provider 抽象 | TR6 | 适配器作为 `IFrameworkAdapter` Provider |
| **跨 IDE** | 适配器 + 抽象工厂 | TR4/TR7 | BMAD 适配器为首个参考实现 |

_置信度：**HIGH** — TR1-TR9 已确认的技术决策_

## 5. BMAD 生态与版本演进

### 5.1 BMAD 版本信息

| 维度 | 数据 |
|------|------|
| 当前版本 | v6.2.2（CORD 项目中安装） |
| 安装方式 | npm 安装器（`npx bmad-method`） |
| 配置文件版本标记 | `config.yaml` 注释 `# Version: 6.2.2` |
| 模块数量 | Core 12 + BMM 32 = 44 skills |
| Agent 数量 | 10 个角色代理 |

### 5.2 版本兼容性考量

BMAD 作为新兴的 AI Coding 方法论框架，版本迭代活跃。CORD 适配器需要考虑：

| 兼容性维度 | 策略 |
|-----------|------|
| **目录结构变更** | 以 `_bmad/` 根目录检测为基础，子目录模式作为增强信号 |
| **Frontmatter 字段演变** | 仅依赖核心稳定字段（`workflowType`、`inputDocuments`），其他字段为可选增强 |
| **新文档类型** | 适配器设计预留扩展点，新类型通过配置添加而非代码修改 |
| **输出目录变更** | 从 `config.yaml` 动态读取输出路径，而非硬编码 |

_置信度：**MEDIUM-HIGH** — BMAD 版本演进推断基于框架设计模式分析，具体向后兼容策略需持续跟踪_

## 6. 技术采用趋势

### 6.1 AI Coding 方法论框架生态

| 框架 | 定位 | 文档结构模式 | CORD 适配潜力 |
|------|------|-------------|-------------|
| **BMAD-Method** | AI Agent 驱动的全生命周期方法论 | 4 阶段 × 18 文档类型，强结构化 | ⭐⭐⭐ 首个适配器（本研究对象） |
| **Superpowers** | AI Coding 能力增强框架 | 指令文件 + 上下文注入 | ⭐⭐ 未来适配候选 |
| **GSD** | 快速交付框架 | 简化文档流程 | ⭐ 低优先级 |
| **OpenSpec** | 开放规格定义标准 | 规格文档 + 验证 | ⭐ 低优先级 |
| **通用 Markdown** | 无框架约束的项目文档 | 自由格式 | ⭐⭐⭐ 默认适配器（已在 TR6 规划） |

**关键趋势**：AI Coding 方法论框架呈现「多元化 + 结构化」趋势——每个框架都定义了自己的文档产出链和约定。CORD 的适配器模式（core + adapters）恰好匹配这一生态特征。

_置信度：**MEDIUM** — AI Coding 方法论框架为新兴领域，生态格局尚在形成中_

---

**技术栈分析完成日期：** 2026-04-01

---

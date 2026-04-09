---
title: "Product Brief: CORD"
status: "complete"
created: "2026-04-02"
updated: "2026-04-02"
inputs:
  - "_bmad-output/brainstorming/brainstorming-session-2026-03-29-001.md"
  - "_bmad-output/planning-artifacts/research/market-cord-ai-doc-relation-management-research-2026-03-30/index.md"
  - "_bmad-output/planning-artifacts/research/domain-cord-ecosystem-technology-growth-research-2026-03-30/index.md"
  - "_bmad-output/planning-artifacts/research/technical-research-roadmap.md"
  - "_bmad-output/planning-artifacts/research/technical-sqlite-vs-kuzu-embedded-graph-db-research-2026-03-31/index.md"
  - "_bmad-output/planning-artifacts/research/technical-mcp-server-typescript-sdk-research-2026-03-31/index.md"
  - "_bmad-output/planning-artifacts/research/technical-markdown-ast-remark-unified-research-2026-03-31/index.md"
  - "_bmad-output/planning-artifacts/research/technical-ai-ide-hooks-research-2026-04-01/index.md"
  - "_bmad-output/planning-artifacts/research/technical-nodejs-cli-framework-research-2026-04-01/index.md"
  - "_bmad-output/planning-artifacts/research/technical-ai-document-relation-discovery-cold-start-scan-research-2026-04-01/index.md"
  - "_bmad-output/planning-artifacts/research/technical-global-instruction-files-cross-ide-compatibility-research-2026-04-01/index.md"
  - "_bmad-output/planning-artifacts/research/technical-mermaid-diagram-rendering-document-relation-visualization-research-2026-04-01/index.md"
  - "_bmad-output/planning-artifacts/research/technical-npm-distribution-cross-platform-compatibility-research-2026-04-01/index.md"
  - "_bmad-output/planning-artifacts/research/technical-bmad-method-framework-adapter-module-design-research-2026-04-01/index.md"
  - "_bmad-output/planning-artifacts/research/technical-superpowers-framework-adapter-module-design-research-2026-04-02/index.md"
---

# Product Brief: CORD

**Context-Oriented Relation for Documents**
**版本：** Draft v0.3 · 2026-04-02
**许可证：** MIT · **定位：** 开源 · 本地优先

---

## 执行摘要

AI Coding 工具正在改写开发者的工作方式——GitHub Copilot 拥有 1500 万+用户，Cursor 估值突破 100 亿美元，Claude Code 正在成为 agentic 编码的标准工具。但这场变革带来了一个被所有工具忽视的系统性缺陷：**AI Agent 是无记忆的，它不知道项目文档之间是如何关联的，也不知道哪些文档已经过时。**

结果是：AI 基于三周前的架构文档生成了代码，而那份文档已经被更新了两次。开发者花两小时排查，最后发现问题不在代码，而在上下文。这类事件每周发生 2-3 次，每次损失 1-4 小时。

**CORD（Context-Oriented Relation for Documents）** 是 AI Coding 工具链中缺失的文档关系智能层。它为项目文档构建一张持久化的关系图谱，让 AI Agent 在任何时刻都能获取正确的、最新的、与当前任务相关的文档上下文——而不是靠推理猜测，也不是靠人类手动维护。

CORD 是开源的、本地优先的、MIT 许可的。数据不离本机，无订阅，无供应商锁定。它在一个月内发布首个可用版本，目标是成为 AI Coding 生态基础设施的标准组件。

---

## 问题：文档关系的「不可见性」

### 核心痛点

在 AI Coding 工作流中，项目文档（PRD、架构文档、Epic、Story、API 规范……）之间存在大量隐性关联关系。当任意一份文档变更时，AI Agent 没有任何机制感知其他关联文档需要同步更新。这造成两类高频损耗：

**上下文污染（P0）**：AI Agent 加载了过时或不一致的文档作为上下文，产出与实际设计不符的代码。在日均使用 AI 编码 4h+ 的开发者中，每周平均发生 2-3 次，每次返工损耗 1-4 小时。

**关联遗漏（P0）**：修改了 PRD，但 Epic、Story、架构约束中对应内容没有同步，矛盾在代码实现阶段才被发现。使用 BMAD-Method 等结构化框架的项目，每周发生 5-10 次。

> 「我花了两个小时排查一个 AI 生成的代码错误，最后发现是 CLAUDE.md 里引用的架构文档还是两周前的版本——那份文档已经改了三次了。AI 根据旧架构写的代码，当然跑不通。那一刻我意识到：这不是 AI 的问题，而是没有任何工具告诉 AI 哪些文档已经过时了。」
> — Fancyliu，CORD 作者，BMAD-Method 重度用户

### 现有方案的失败

| 方案 | 根本缺陷 |
|------|----------|
| 文档内手动备注（`<!-- Related: -->`） | 不可靠、不可查询、无人维护就立刻失效 |
| 依赖 LLM 自行推断关联 | 不确定、有幻觉风险、无法保证一致性 |
| 手动维护 CLAUDE.md / .cursorrules | 人工成本高、不感知文档变更状态 |
| 自定义 hooks + 脚本 | 脆弱、不可移植、每个项目重写一遍 |

### 市场空白

当前上下文管理工具的格局已清晰：Context7 解决「外部库文档过期」，Serena 解决「代码符号导航」，Repomix 解决「仓库全量打包」——但**没有任何工具专门解决项目内部文档之间的关系建模与变更传播**。这是一个清晰可见、无人占据的品类空白。

---

## 解决方案：五分钟给你的项目建一张关系图谱

### 核心体验：从零到第一张关系图谱

```bash
# 一行命令，冷启动扫描现有项目，自动识别文档间的关联关系
npx cord init

# 输出示例：
# ✓ 扫描了 34 个文档
# ✓ 识别出 47 条关联关系
# ✓ 检测到框架结构：BMAD-Method（18 种文档类型已映射）
# ✓ 已生成 CLAUDE.md 配置片段
# ✓ 已配置 MCP Server（Claude Code / Cursor）

# 同时生成可视化快照（Mermaid DSL，可直接粘贴到任意渲染器）
npx cord init --visualize
# → .cord/graph.mmd 已生成（47 个节点，可在 mermaid.live 查看全局关系图）

# 改了一份文档？立刻知道影响范围
cord impact docs/architecture/api-design.md
# → sync_required: docs/stories/story-04.md（需要更新 AC）
# → must_consistent: docs/epics/epic-02.md（接口约束需校验）
# → derived_from: docs/implementation/api-spec.yaml（派生物已过时）

# 查看项目文档关系健康状态
cord status
# → 3 条关系已过时（文档已删除），建议清理
# → 2 处潜在不一致，建议审查
```

### 关系类型体系：按「传播行为」而非语义标签分类

CORD 的核心设计是将文档关系按**变更发生时系统应该做什么**来分类。9 种关系类型覆盖 AI Coding 场景的全部关联模式：

| 关系类型 | 触发行为 | 典型场景 |
|----------|----------|----------|
| `sync_required` | 自动更新或生成 patch 提议 | PRD 更新需求 → Epic AC 必须同步 |
| `sync_suggested` | 标记 stale + 提醒用户 | 摘要文档引用的源内容已变更 |
| `must_consistent` | CI 校验 + 冲突标记 | ADR 架构约束 → 实现规范必须一致 |
| `derived_from` | 源变更时标记派生物过时 | 设计文档变更 → 生成的 API 规范过时 |
| `context_for` | 被关联文档处理时自动注入上下文 | CLAUDE.md → 所有项目文档 |
| `lifecycle_bound` | 状态变更时触发关联文档审查 | Epic 完成 → Sprint Plan 需更新 |
| `contains` | 结构变更时更新索引/导航 | 目录文档包含子章节 |
| `references` | 仅记录，不主动触发 | 一般引用，查询时可追溯 |
| `deprecated` | 阻止 AI 引用旧文档，引导到新版本 | 版本替代的废弃决策 |

**设计哲学**：不是标签，是行为规范。每种关系类型都回答了同一个问题：「这个文档变了，系统应该做什么？」

### 技术架构：Local-First，接口开放

```
L5 消费端：Claude Code / Cursor / Copilot / Windsurf / Web UI（衍生）
           ↑ MCP Tools: analyze_impact / query_relations / sync_docs / init_graph
L4 技能层：意图驱动的 Skills（渐进式披露，精准 context 而非全量加载）
L3 接口层：CLI（cord 命令行）+ MCP Server（Stdio Transport）+ RESTful API（扩展）
L2 仓储层：IGraphRepository（Repository Pattern，存储引擎可切换）
L1 数据层：SQLite 嵌入式（零运维，一跳查询 < 1ms，支持 2000 文档 / 50000 关系）
触发层：Claude Code Hooks（20+ 事件）+ 全局指令文件跨 IDE 生成 + 框架适配模块
```

**核心技术选型**（11 项技术研究）：TypeScript / Node.js · SQLite + better-sqlite3 · MCP SDK v1.x · remark/unified.js（54 亿月下载量）· Commander.js v14 · Mermaid.js

---

## 差异化

### 1. 唯一专注「文档↔文档」关系的工具

其他工具管理「文档本身」；CORD 管理「文档之间的关系」。
其他工具给人类读文档；CORD 让 AI Agent 理解文档。
其他工具是知识管理；CORD 是 AI Coding 的项目记忆基础设施。

### 2. 传播行为驱动的关系类型体系（独创）

市场上没有第二个工具以「变更发生时系统做什么」来定义文档关系。9 种类型是经过 3 轮 GPT + 4 轮 Gemini 讨论验证后的最优解——比 GPT 方案（30+ 种）减少 70% 复杂度，比 Gemini 方案（5 种）多覆盖 4 种核心行为。

### 3. 冷启动即有价值（逆向分析现有项目）

大多数工具只能管理「从现在开始」的关系。CORD 的冷启动扫描器采用三级渐进架构（规则引擎 → Embedding 增强 → LLM 辅助），在首次运行时就能逆向分析现有项目文档，自动建立初始关系图谱。第一次使用就有 Wow 时刻——而不是在项目积累三个月后才有价值。

### 4. 跨 IDE 通用，不绑定任何平台

AI IDE 厂商的内置方案必然锁定自家产品。CORD 通过通用协议 + 框架适配层（core + adapters 模式）实现「一套图谱，所有 IDE 可用」。Claude Code、Cursor、Copilot、Windsurf——统一 MCP 接口，统一关系查询，各自 IDE 的指令文件由 `cord init` 自动生成。

### 5. 本地优先 + MIT 开源：零信任风险

数据不离本机，无云端依赖，无数据上传，无订阅，无供应商锁定，代码完全可审计。MIT 许可意味着可以无顾虑地集成到任何商业或开源项目中。这在企业安全团队眼中消除了三大顾虑，也是 SaaS 竞品永远无法复制的信任优势。

### 对抗平台内化的护城河

AI IDE 厂商内置文档关系功能的概率约为 60%（时间窗口 18-36 个月），这是最大的竞争威胁。CORD 的护城河策略：
- **跨 IDE 通用性**：厂商方案必然锁定自家 IDE，CORD 是唯一跨所有 AI 编码工具的方案
- **框架适配生态**：与 BMAD、Superpowers 等方法论框架深度联结，厂商难以复制社区积累的领域知识
- **先发品类定义权**：先定义「文档关系 MCP 标准」的项目控制话语体系，后来者必须在 CORD 定义的框架内竞争
- **速度**：在窗口期关闭前建立足够的社区壁垒和生态网络效应

---

## 目标用户

### 主要用户：AI Coding 深度实践者

**「方法论布道者」**（约 5-20 万人）
高级工程师 / 技术负责人，使用 BMAD-Method、Superpowers 等结构化 AI 编码框架，每个项目产出 20-50 份结构化文档。他们的痛点最深、需求最明确、传播意愿最强。**CORD 的天然种子用户**——CORD 是这些框架生态的「缺失拼图」，BMAD（43.3K Stars）和 Superpowers 社区是最优先的发布渠道。

**「效率猎手」**（约 100-200 万人）
中高级工程师，日均使用 AI 编码工具 4h+，通过 CLAUDE.md / .cursorrules 管理 AI 上下文。核心需求是消除「上下文污染」——AI 基于过时文档生成错误代码，每周 2-3 次，每次 1-4 小时损耗。对可量化效率收益高度敏感。

**「工具匠人」**（约 300-500 万人）
独立开发者和小团队，热衷于在 GitHub / HN / Reddit 发现并组合开源工具。对技术架构的优雅性有高标准，活跃的开源贡献者和传播者。

### Aha 时刻

首次运行 `npx cord init`，冷启动扫描器**自动发现**项目中已存在的文档关联关系——

> 「它居然知道我的 architecture.md 和 prd.md 是关联的，还识别出 story-04 依赖 api-design——这正是我一直需要但没有工具给我的东西。」

---

## 成功标准

### 开源社区指标（发布后 6 个月内）

| 指标 | 目标 | 信号含义 |
|------|------|----------|
| GitHub Stars | 1,000+ | 开发者认可 CORD 解决了真实问题 |
| BMAD 社区官方推荐 | 达成 | 最高价值种子用户渠道激活 |
| 非创始人采用案例（持续使用 >30 天） | 50+ | 产品价值主张被验证 |
| npm 周下载量 | 500+ | 生态集成度指标 |

### 产品质量指标（v0.1 发布时）

| 指标 | 目标 |
|------|------|
| `cord init` 完成时间（中型项目，~30 个文档） | < 2 分钟 |
| 一跳关系查询响应时间 | < 50ms |
| 首次安装到看到第一条已识别关系 | < 5 步操作 |
| BMAD 框架项目冷启动扫描关系识别率 | > 80% |

---

## 范围

### v0.1 MVP（一个月内发布）

**纳入：**
- CLI 核心命令：`cord init` / `cord query` / `cord impact` / `cord scan` / `cord export` / `cord status`
- `cord init --visualize`：生成 Mermaid DSL 快照（`.cord/graph.mmd`），可直接在 mermaid.live 或任意渲染器查看全局关系图谱——零依赖，无需内置渲染引擎
- MCP Server（Stdio Transport + Tools 原语，支持 Claude Code / Cursor / VS Code Copilot / Windsurf）
- SQLite 图模型存储（documents + relations + sync_state 三表，Repository Pattern 隔离）
- 冷启动扫描器——规则级：frontmatter 解析 + Markdown 链接提取 + 框架文档结构识别
- BMAD-Method 适配模块（18 种文档类型，19 个预置关系对，5 层递进检测，置信度 0.95-1.0）
- 跨 IDE 全局指令文件生成（CLAUDE.md / .cursorrules / copilot-instructions.md / .windsurf/rules）
- `npx cord init` 一键初始化（自动检测 IDE 类型，自动配置 MCP Server，生成对应格式配置）

**明确排除（推迟到 v0.5 / v1.0）：**
- Mermaid 可视化渲染（v0.5，完整交互式图谱）
- RESTful API / Web UI 衍生系统接口（v0.5）
- Superpowers 框架适配模块（v0.5）
- Embedding 增强扫描（Transformers.js + all-MiniLM-L6-v2）（v0.5）
- LLM 辅助关系发现（v1.0）
- 团队协作 / 共享图谱（v1.0）

### 长期路线图（2-3 年愿景）

- **AI Coding 工具链的文档关系基础设施标准**：与所有主流 AI Coding 框架深度集成，成为结构化 AI 开发工作流的默认组件
- **文档关系 MCP 的事实标准**：在 MCP 生态（当前 2 万+ Server）中定义「文档关系智能」品类，后来者必须兼容 CORD 的协议格式
- **开放框架适配平台**：通过 `IFrameworkAdapter` 接口，让任何 AI Coding 框架一键接入 CORD 的关系图谱能力；建立公开的 Schema Registry，社区贡献技术栈特定的预置关系模板
- **CI/CD 守卫**：作为工程流程基础设施，在合并前自动检测关联文档是否已同步，从「开发时工具」升级为「工程质量门禁」

---

*本简报基于 1 份头脑风暴、1 份市场研究、1 份领域研究、11 份技术研究报告（TR1-TR11）综合撰写。*
*产品研究阶段已全部完成，技术选型已全面落定，MVP 开发就绪。*

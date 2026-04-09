---
stepsCompleted:
  - 'step-01-init'
  - 'step-02-discovery'
  - 'step-02b-vision'
  - 'step-02c-executive-summary'
  - 'step-03-success'
  - 'step-04-journeys'
  - 'step-05-domain-skipped'
  - 'step-06-innovation-skipped'
  - 'step-07-project-type'
  - 'step-08-scoping'
  - 'step-09-functional'
  - 'step-10-nonfunctional'
  - 'step-11-polish'
  - 'step-12-complete'
inputDocuments:
  - '_bmad-output/brainstorming/brainstorming-session-2026-03-29-001.md'
  - '_bmad-output/planning-artifacts/product-brief-cord-distillate.md'
  - '_bmad-output/planning-artifacts/research/technical-research-roadmap.md'
documentCounts:
  briefs: 1
  research: 1
  brainstorming: 1
  projectDocs: 0
classification:
  projectType: 'developer_tool'
  domain: 'AI Developer Tooling'
  complexity: 'Medium-High'
  projectContext: 'greenfield'
workflowType: 'prd'
lastEdited: '2026-04-08'
editHistory:
  - date: '2026-04-08'
    trigger: '第二轮验证可选优化（3 项锦上添花）'
    changes:
      - '新增"目标用户概览"表（用户旅程章节前），含三类画像规模估算和决策因素'
      - '差异化 D4 补充 v0.5+ 版本标注（Mermaid 可视化渲染通道）'
      - 'CLI 命令表 cord init 补充 --visualize 选项说明（v0.5+）'
  - date: '2026-04-08'
    trigger: 'OQ1 决策落地 + 复核 Low 修复'
    changes:
      - 'OQ1 已决策：增量扫描时检测文档生命周期变更（对比快照），不引入 Git hook/文件监听'
      - 'FR8 新增：增量扫描检测重命名/移动/删除并清理孤立节点'
      - 'FR9-FR42 编号顺延（原 FR8-FR41 各 +1）'
      - '用户成功标准验证方法改为调用日志抽样统计'
      - 'frontmatter projectType 改为规范化枚举 developer_tool'
  - date: '2026-04-08'
    trigger: '外部验证报告（5 项发现）'
    changes:
      - 'NFR17 改写：自动重启→优雅退出，进程生命周期归 IDE Host'
      - 'IDE 支持面统一：补充 Windsurf→Codex CLI 替换决策说明'
      - 'FR36 .windsurf/rules 标注为 v0.5+ 扩展'
      - 'FR21 新增：增量扫描时手动修正关系受保护（收敛机制）'
      - 'FR22-FR41 编号顺延'
      - '用户成功标准 SMART 化：消除叙事措辞，4 条均补充量化验证标准'
      - '新增"开放问题"章节（OQ1-OQ5）追踪上游 5 个待决事项'
  - date: '2026-04-07'
    trigger: 'PRD Validation Report (4/5 Good, Warning)'
    changes:
      - 'FR29 重写：Skills 定义文件规格完整化（S:2→4, M:2→4）'
      - 'NFR 全面修订：20→19 条，全部补充测量方法/分位数/适用条件'
      - 'FR10 精化：置信度分数范围 0.0-1.0 和基础级别定义'
      - 'FR19 重写：明确 CORD vs AI IDE 职责边界'
      - 'FR35 精化：4 项验收标准和 4 小时最小适配基准'
      - 'CLI 命令表补充输出格式、--json flag、退出码规范'
      - 'FR11 重写：明确 MVP=文档级，章节级=v0.5+'
      - 'FR36 重写：CLAUDE.md 等→5 种 IDE 指令文件完整列表'
      - 'FR38 拆分为 FR38+FR39，主流→具体框架和 IDE 列表'
      - 'cord.config 配置 schema 概览表新增'
      - 'FR40 新增：贡献者文档体验（覆盖 C14 追溯缺口）'
      - 'FR3 补充检测≠适配说明'
---

# Product Requirements Document - CORD

**Author:** Fancyliu
**Date:** 2026-04-03

## 执行摘要

CORD（Context-Oriented Relation for Documents）是一个面向 AI Coding 场景的文档关系引擎。在 AI Agent 驱动的开发流程中，项目文档之间存在大量隐性关联关系——需求变更会影响架构设计、Sprint 计划会引用用户故事、API 规范与数据模型相互约束。当前 AI Agent 在修改文档时，只能依靠推理来猜测关联文档并尝试同步更新，遗漏不可避免。CORD 的核心使命是将这些隐性关联转化为确定性的、可查询的关系图谱，让每个 AI Agent 在处理任何文档时都能精准获知"与谁有关、关系类型是什么、变更后该触发什么动作"。

CORD 以 npm 包形式分发，提供 CLI + MCP Server 两种接口模式（v0.1），RESTful API 计划于 v0.5 引入。核心用户是深度使用 AI Coding 工具（Claude Code、Cursor、VS Code Copilot 等）并采用结构化开发框架（BMAD-Method、Superpowers 等）的中高级开发者。产品采用 TypeScript/Node.js 技术栈，SQLite 嵌入式存储，本地优先、零云依赖。

### 产品差异化

- **品类创造者**：市场上不存在"AI Coding 文档关系引擎"这一品类的产品。最近似的竞品 Swimm（$30M 融资）仅处理代码↔文档关系，不处理文档↔文档。CORD 拥有 12-18 个月的市场空白窗口期。
- **确定性优于推理性**：核心第一性原理——AI 必须依赖图谱保存的确定事实来判断关联，而非靠推理猜测。这一原则决定了 CORD 的存在价值不随 LLM 能力提升而贬值。
- **传播行为分类法**：9 种关系类型按"系统该做什么"（如 `sync_required`、`context_for`、`lifecycle_bound`）而非"关系是什么"分类。相比语义标签方案减少 70% 复杂度，同时保证每种类型都有明确的自动化动作。
- **一个数据源，两个消费接口**：存储层统一（SQLite 图模型），LLM/Agent 走按需查询通道（MCP / Skills / CLI 三入口共享 Service 层），人类走可视化渲染通道（Mermaid 图表，v0.5+）。架构层面的关注点分离。
- **跨 IDE + 跨框架通用性**：通用协议核心 + 可插拔框架适配层（core + adapters 模式）。不锁定任何 IDE 或开发框架，首批提供 BMAD-Method 和 Superpowers 适配模块作为示范。

### 项目分类

| 维度 | 分类 |
|------|------|
| **项目类型** | Developer Tool（开发者工具）— CLI + MCP Server + RESTful API 三模式接口 |
| **领域** | AI Developer Tooling（AI 开发者工具链） |
| **复杂度** | Medium-High — 多 IDE 兼容性、框架适配器架构、图模型数据设计、冷启动 AI 扫描、MCP 协议集成 |
| **项目上下文** | Greenfield（全新项目） |

## 成功标准

### 用户成功

- **首次影响分析触达**：用户完成 `cord init` + `cord scan` 后，首次修改文档时 CORD 自动返回影响分析结果（至少包含 1 条受影响文档）——验证标准：首次体验测试中 100% 触达
- **文档同步遗漏率下降**：使用 CORD 后，用户项目中因文档不一致导致的返工事件减少 ≥ 50%（用户自评问卷，基线为使用前 2 周的返工次数）
- **首次体验闭环**：从 `npx cord init` 到冷启动扫描完成到第一次影响分析触发，全流程 < 30 分钟
- **CLI 命令零记忆负担**：MCP 集成后，用户日常开发中 ≥ 90% 的 CORD 交互通过 AI Agent 自动调用完成，无需手动输入 CLI 命令——验证方法：抽样用户 7 天内的 CORD 调用日志，统计 MCP Tool 调用次数 / (MCP Tool 调用 + CLI 手动调用) 占比

### 业务成功

| 指标 | 3 个月目标 | 6 个月目标 |
|------|-----------|-----------|
| GitHub Stars | 1,000 | — |
| npm 周下载量 | 100 | — |
| 非创始人采用案例 | — | 50+ |
| 社区贡献者 | — | 10 |

- **品类定义权**：在 12-18 个月的市场空白窗口期内，建立"AI Coding 文档关系引擎"品类的先发优势和社区认知。
- **开源信任信号**：持续的提交活跃度、Issue 响应速度 < 48h、PR 审阅周期 < 1 周。

### 技术成功

- **性能 SLA**：一跳关系查询 < 1ms，三跳遍历 < 5ms（2000 文档 / 50000 关系规模）。
- **CLI 冷启动**：< 200ms（懒加载策略）。
- **冷启动扫描准确率**：规则引擎阶段（MVP）关系识别准确率 ≥ 80%。
- **跨 IDE 兼容**：MCP Server 在 Claude Code / Cursor / VS Code Copilot 三大 IDE 中验证通过。
- **零云依赖**：全部数据本地存储，不依赖任何外部服务即可运行。

### 可量化成果

- 用户项目中文档不一致导致的返工减少 ≥ 50%（用户自评）
- 冷启动扫描覆盖率：已有项目文档关系识别 ≥ 80%
- 框架适配模块开箱即用率：BMAD 工作流覆盖 ≥ 90% 文档类型

## 用户旅程

### 目标用户概览

| 用户群体 | 估算规模 | 核心特征 | 决策驱动因素 |
|---------|---------|---------|------------|
| **方法论布道者** | 5-20 万 | BMAD/Superpowers/GSD 等框架深度用户，项目文档 40-100+ 份，团队 2-5 人 | 痛点有效性（35%）> 上手成本（25%）> 工具兼容性（20%） |
| **效率猎手** | 100-200 万 | 多项目维护，日均编码 4h+，深度使用 AI IDE，每项目 10-30 份文档 | 效率提升可量化 > 零配置理想 > 社区活跃度信号 |
| **工具匠人** | 300-500 万 | 开源工具链爱好者，活跃贡献者，关注架构质量和扩展性 | 架构质量（高权重）> 贡献门槛 > 社区治理 |

> 数据来源：GitHub/Stack Overflow 开发者总量、JetBrains 2025 AI 工具渗透率调查、主流框架 Stars 合计推算。置信度中等——均为行业报告推算，非一手调研。详见产品简报蒸馏版。

### 旅程 1：方法论布道者的首次体验（核心 Happy Path）

**人物：** 陈远，全栈开发者，BMAD-Method 深度用户。团队 3 人，负责一个中型 SaaS 项目，项目文档超过 60 份（PRD、架构文档、Epic、Story、技术研究等）。

**痛点：** 每次用 Claude Code 修改 PRD 中的需求描述后，AI Agent 经常遗漏对架构文档和相关 Story 的同步更新。上周因为 API 规范和数据模型不一致，导致生成的代码跑不通，排查花了整整两小时。他心里清楚文档之间有关联，但没有任何工具帮他系统性地管理这些关系。

**开场：** 陈远在 GitHub Trending 上看到 CORD，README 里"确定性优于推理性"这句话直击痛点——他终于理解了为什么 AI Agent 总是漏掉关联文档，不是 Agent 不够聪明，而是关联关系根本没有被确定性地记录下来。

**上升：** 他在项目目录下运行 `npx cord init`。CORD 自动检测到 Claude Code 环境和 BMAD 框架结构，一键完成 MCP Server 配置、CLAUDE.md 指令注入、Hooks 脚本安装。接着运行 `cord scan`，冷启动扫描器在 15 秒内解析了全部 60 份文档，识别出 180+ 条关系——包括 PRD 与架构文档的 `sync_required`、Epic 与 Story 的 `contains`、project-context 与所有文档的 `context_for`。陈远看着扫描报告，发出感叹："原来我的文档之间有这么多关联。"

**高潮：** 第二天，陈远用 Claude Code 修改了 PRD 中的一个用户故事的验收标准。文档落盘的瞬间，Hook 自动触发，AI Agent 通过 MCP 调用 `analyze_impact`——CORD 返回：这个变更影响了架构文档第 4 章的 API 端点定义（`sync_required`）、Sprint 计划中 Story #12 的任务描述（`sync_suggested`）、以及 E2E 测试计划中的 2 个测试用例（`must_consistent`）。AI Agent 自动提示陈远是否要同步更新这三份文档。

**结局：** 陈远再也不用在修改文档后人肉回忆"还有哪些文档需要改"。一周后，他在团队内演示了 CORD，其他两位同事当场安装。文档不一致导致的返工从每周 2-3 次降为零。

---

### 旅程 2：效率猎手的日常开发（持续价值路径）

**人物：** 林薇，独立开发者，同时维护 3 个开源项目。深度使用 Cursor + Copilot，日均编码 6 小时以上。她不使用任何特定开发框架，但每个项目都有自己的 CLAUDE.md、API 文档、CHANGELOG、架构笔记等 10-20 份文档。

**痛点：** 跨项目切换频繁，每次回到一个项目时都需要花 10-15 分钟回忆"上次改了什么，还有哪些文档没同步"。她曾尝试在文档内手动维护引用列表，但一个月后就放弃了——维护成本太高，而且经常忘记更新。

**开场：** 林薇在 3 个项目中都安装了 CORD。由于没有使用特定框架，CORD 通过冷启动扫描的通用规则引擎自动识别文档关系——frontmatter 引用、Markdown 链接、目录结构推断。

**上升：** 周一早上，林薇打开项目 A，用 Cursor 开始修改 API 文档中的一个端点定义。她不需要做任何额外操作——Cursor 的 MCP 集成使得 AI Agent 在处理文档时自动查询 CORD。Agent 在生成修改建议前，先通过 `query_relations` 获取了这份 API 文档的所有关联文档。

**高潮：** 修改完成后，AI Agent 自动展示影响分析结果："此端点变更影响 CHANGELOG（`sync_suggested`）和集成测试文档（`must_consistent`）。建议同步更新。" 林薇确认后，Agent 自动完成了 CHANGELOG 的条目追加和测试文档的端点引用更新。整个过程比她以前手动追踪节省了 15 分钟。

**结局：** 三个月后，林薇的 3 个项目文档一致性从"经常出问题"变为"几乎零不一致"。她在 Twitter 上分享了 CORD 的使用体验，获得了 200+ 转发。

---

### 旅程 3：效率猎手的异常恢复（Edge Case）

**人物：** 同一个林薇，在项目 B 中遇到了冷启动扫描的误判。

**痛点：** 冷启动扫描不可能 100% 准确。当 CORD 误判了关系（假阳性）或遗漏了关系（假阴性），用户需要一条清晰的修正路径。

**开场：** CORD 冷启动扫描将项目 B 的 `design-notes.md` 和 `api-spec.md` 标记为 `sync_required` 关系。但实际上，`design-notes.md` 只是早期草稿，与当前 API 规范无关——这是一个假阳性。同时，扫描遗漏了 `deployment-guide.md` 与 `api-spec.md` 之间的部署端点引用关系——这是一个假阴性。

**上升：** 林薇在一次影响分析中注意到 `design-notes.md` 被错误地标记为受影响文档。她对 AI Agent 说："design-notes 和 api-spec 之间没有同步关系，请移除。" Agent 通过 CORD 的 MCP Tool 调用关系修正接口，将该条关系标记为 `deprecated`。

**高潮：** 同一天，林薇修改了 `api-spec.md` 中的部署端点，但 CORD 没有提示 `deployment-guide.md` 需要更新。她意识到漏了一条关系，对 Agent 说："api-spec 和 deployment-guide 之间有同步依赖，请添加。" Agent 调用 CORD 注册了这条新的 `sync_required` 关系。

**结局：** 关系图谱的准确度随着使用而自然收敛。林薇发现大约一周后，CORD 的影响分析结果就完全符合她的预期了。这种"AI 初建 + 人类微调"的模式让她觉得既省力又可控。

---

### 旅程 4：框架适配贡献者的社区贡献

**人物：** 赵阳，开源社区活跃贡献者，GSD（Get Shit Done）框架的早期用户。他在 GitHub 上有 2000+ followers，经常为开源工具编写集成插件。

**痛点：** 赵阳的团队使用 GSD 框架，但 CORD v0.1 只内置了 BMAD 适配模块。GSD 有自己的文档结构（sprint-backlog、daily-standup-notes、retro 等），CORD 的通用规则引擎能识别一部分关系，但缺少 GSD 特有的文档类型识别和预设关系规则。

**开场：** 赵阳在 CORD 的 GitHub 仓库中看到了 `IFrameworkAdapter` 接口文档和 BMAD 适配模块作为参考实现。他决定为 GSD 编写一个社区适配模块。

**上升：** 赵阳 fork 了 CORD 仓库，参考 `BmadFrameworkAdapter` 的实现模式，创建了 `GsdFrameworkAdapter`。他定义了 GSD 的 12 种文档类型（sprint-backlog、daily-notes、retro 等），编写了 3 条预设规则覆盖 GSD 的核心工作流关系（sprint-backlog `contains` daily-notes、retro `derived_from` sprint-backlog 等）。`AbstractFrameworkAdapter` 抽象基类让他不需要重复实现通用逻辑。

**高潮：** 赵阳提交了 PR，CORD 维护团队在 3 天内完成了审阅。他的适配模块成为 CORD 的第三个官方适配，在社区公告中获得了特别鸣谢。GSD 社区的用户现在可以通过 `cord init` 一键启用 GSD 适配。

**结局：** 赵阳的贡献为 CORD 的 `core + adapters` 模式提供了第三个活的验证案例。其他框架的社区成员看到 GSD 适配的实现过程后，也开始着手为自己的框架编写适配模块。CORD 的框架生态从"官方维护"开始向"社区驱动"演进。

### 旅程需求汇总

| 旅程 | 揭示的关键能力需求 |
|------|-------------------|
| **旅程 1：首次体验** | `cord init` 一键配置（IDE 检测 + 框架检测 + MCP/Hooks/指令注入）、`cord scan` 冷启动扫描、框架适配模块（BMAD）、影响分析 MCP Tool |
| **旅程 2：日常开发** | MCP Server 长驻进程、`query_relations` / `analyze_impact` 意图驱动 Tools、Hooks 文档变更触发、跨 IDE 兼容（Cursor/Copilot） |
| **旅程 3：异常恢复** | 关系修正接口（添加/移除/标记 deprecated）、AI 对话驱动的关系编辑、图谱准确度随使用收敛 |
| **旅程 4：社区贡献** | `IFrameworkAdapter` 接口 + `AbstractFrameworkAdapter` 抽象基类、BMAD 适配作为参考实现、清晰的贡献者文档和 PR 审阅流程 |

## 开发者工具特定需求

### 运行环境

- **实现语言**：TypeScript / Node.js
- **最低运行环境**：Node.js 20+（LTS）
- **包管理器**：npm（`npx cord init` 一键启动）
- **分发策略**：MVP 阶段依赖上游预编译（模式 C，零成本），v0.5 升级 prebuildify 自建（模式 A）

### IDE 集成矩阵

| IDE | Hooks 能力 | 指令文件格式 | MCP 支持 | CORD 集成等级 |
|-----|-----------|-------------|----------|-------------|
| Claude Code | 20+ 事件（最完整） | CLAUDE.md（层级结构） | ✅ Stdio | 🥇 最优先 |
| Cursor | 无原生 Hooks | .cursor/rules/*.mdc | ✅ 需手动 mcp.json | 🥈 指令引导层 |
| VS Code Copilot | 无原生 Hooks | copilot-instructions.md + AGENTS.md | ✅ MCP Host | 🥈 指令引导层 |
| OpenAI Codex CLI | 待确认 | AGENTS.md | 待确认 | 🥉 基础集成 |

- Claude Code 是最优先深耕目标（Hooks 最完整，MCP 原生支持）
- 三层分级集成架构：MCP 通用层 → 指令引导层 → 原生 Hooks 层
- `cord init` 自动检测 IDE 类型并生成对应配置文件
- **IDE 选型变更说明**：上游简报中 Windsurf 列为 🥈 研究目标（TR4/TR7 已完成技术研究），PRD 编写时替换为 Codex CLI——原因是 Codex CLI 采用 AGENTS.md 标准格式且为 OpenAI 官方工具，战略优先级高于 Windsurf。Windsurf 适配保留为 v0.5+ 可选扩展

### CLI 命令接口

| 命令 | 描述 | 默认输出格式 |
|------|------|------------|
| `cord init` | 一键初始化：自动检测 IDE + 框架 + 配置 MCP Server / Hooks / 指令文件。支持 `--visualize` 选项生成初始 Mermaid DSL 关系快照（v0.5+） | 人类可读（步骤进度 + 结果摘要） |
| `cord scan` | 冷启动扫描或增量扫描，解析文档并建立/更新关系图谱 | 人类可读（发现关系数 + 耗时 + 警告） |
| `cord query <doc>` | 查询指定文档的关联关系（一跳关系列表） | 人类可读表格 |
| `cord impact <doc>` | 变更影响分析：列出受影响文档及建议动作 | 人类可读表格 |
| `cord export` | JSON 快照导出（供 git 审阅的全量关系快照） | JSON 文件 |
| `cord status` | 健康检查：过时关系 / 潜在不一致 / 图谱统计 | 人类可读（仪表盘式摘要） |

- 所有命令支持 `--json` 全局 flag，输出机器可读的 JSON 格式（供脚本化集成和 CI/CD 管道使用）
- 退出码规范：0 = 成功、1 = 运行时错误、2 = 参数/配置错误
- CLI 采用 Commander.js v14（分层 + 命令模式架构）
- 辅助工具链：@clack/prompts（交互向导）+ picocolors（终端颜色）+ tsup（构建）
- 懒加载冷启动 < 200ms

### MCP Tools 接口

| Tool | 意图描述 | 对应 CLI |
|------|---------|---------|
| `analyze_impact` | 分析文档变更的影响范围，返回受影响文档及建议动作 | `cord impact` |
| `query_relations` | 查询文档关联关系（支持按关系类型过滤） | `cord query` |
| `sync_docs` | 触发关联文档的同步更新建议 | — |
| `init_graph` | 初始化或重建关系图谱 | `cord scan` |

- CLI ↔ MCP 双入口共享 Service 层，互不依赖
- MCP 采用 TypeScript SDK v1.x + Stdio Transport + Tools 原语优先
- 意图驱动命名（`analyze_impact` 而非 `query_edges`）

### cord.config 配置概览

| 配置项 | 类型 | 描述 | 默认值 |
|--------|------|------|--------|
| `framework` | string | 检测到的开发框架 | 自动检测 |
| `ide` | string | 检测到的 IDE 类型 | 自动检测 |
| `scanPaths` | string[] | 文档扫描路径 | 项目根目录（排除 src/、node_modules/、.git/） |
| `excludePaths` | string[] | 排除扫描的路径 | `["src/", "node_modules/", ".git/", "dist/"]` |
| `confidenceThreshold` | number | 影响分析最低置信度阈值 | `0.50` |
| `relationTypes` | object | 自定义关系类型扩展 | — |
| `adapters` | string[] | 启用的框架适配模块 | 自动检测 |

- 配置文件路径：项目根目录 `cord.config.json` 或 `cord.config.yaml`
- 所有配置项均可选，`cord init` 自动生成合理默认值

### 文档要求（v0.1）

| 文档 | 描述 |
|------|------|
| **README** | 项目介绍、核心概念、快速开始链接、Star 徽章 |
| **快速开始指南** | 从安装到首次影响分析触发的完整流程（< 5 分钟阅读） |
| **CLI 命令文档** | 每个命令的用法、参数、选项、示例输出 |
| **MCP Tools 文档** | 每个 Tool 的输入/输出 schema、使用场景、调用示例 |
| **配置参考** | cord.config 配置项说明、IDE 配置文件模板、框架适配配置 |
| **框架适配开发者指南** | IFrameworkAdapter 接口说明、BMAD 适配源码导读、社区贡献 PR 流程 |

## 项目范围与分阶段开发

### MVP 策略与定位

**MVP 类型：问题验证型（Problem-Solving MVP）**

CORD 的 MVP 目标不是追求功能完整性，而是验证核心命题——**确定性的关系图谱是否比 AI 推理更可靠地解决文档同步遗漏问题**。最小验证路径：

1. `cord init` 一键配置 → 用户零摩擦上手
2. `cord scan` 冷启动扫描 → 图谱自动建立
3. 文档修改 → Hook 触发 → `analyze_impact` 返回影响范围 → 用户验证 "Aha!" 时刻

**资源要求：** 独立开发者（创始人）可独立完成 MVP 交付。

### MVP 用户旅程覆盖

| 旅程 | MVP 覆盖状态 |
|------|-------------|
| 旅程 1：首次体验（Happy Path） | ✅ 完整支持 — 核心验证路径 |
| 旅程 2：日常开发（持续价值） | ✅ 完整支持 — MCP + Hooks 自动触发 |
| 旅程 3：异常恢复（Edge Case） | ⚠️ 基础支持 — 通过 MCP Tool 对话修正关系，无专用 CLI 命令 |
| 旅程 4：社区贡献 | ⚠️ 基础支持 — IFrameworkAdapter 接口已就绪，但贡献者文档为 MVP 最低优先级 |

### MVP 必备能力（Must-Have）

| 能力 | 理由 | 缺失后果 |
|------|------|---------|
| `cord init` 一键配置 | 首次体验闭环 < 30 分钟的门槛 | 用户流失 — 配置成本过高直接放弃 |
| `cord scan` 冷启动扫描 | 图谱从零建立的唯一路径 | 产品无法启动 — 没有图谱就没有价值 |
| `cord impact` 影响分析 | "Aha!" 时刻的直接触发器 | 核心价值无法体验 |
| MCP Server + Tools | AI Agent 自主消费数据的通道 | 退化为纯 CLI 工具，失去 AI 生态集成价值 |
| Hooks 配置 | 文档变更自动触发影响分析 | 用户需手动运行 CLI，体验断裂 |
| BMAD 适配模块 | 首批目标用户的开箱即用体验 | 方法论布道者群体无法验证价值 |
| SQLite 存储层 | 性能 SLA 的基础保障 | 无法满足 < 1ms 查询要求 |

### 可延迟能力（Nice-to-Have → v0.5+）

| 能力 | 延迟理由 |
|------|---------|
| Mermaid 可视化渲染 | 人类消费通道，不影响 AI Agent 核心流程 |
| RESTful API | Web UI 场景，MVP 阶段无需 |
| Embedding 增强扫描 | 规则引擎已够 MVP 准确率 ≥ 80%，增强是锦上添花 |
| Superpowers 适配 | 第二个框架适配，验证模式而非 MVP 必备 |
| 专用关系修正 CLI 命令 | MVP 通过 MCP Tool 对话修正即可，专用命令体验更好但非必须 |

### 风险缓解策略

**技术风险**

| 风险 | 概率 | 影响 | 缓解策略 |
|------|------|------|---------|
| 冷启动扫描准确率不达标 | 中 | 高 | Phase A 纯规则引擎目标 ≥ 80%；不达标时降级为"低置信度标记"让用户确认 |
| MCP 协议跨 IDE 兼容性问题 | 低 | 高 | TR2/TR4 已验证三大 IDE 兼容性；Claude Code 优先深耕，其他 IDE 降级为指令引导层 |
| better-sqlite3 native addon 跨平台构建 | 中 | 中 | MVP 用模式 C（依赖上游预编译），v0.5 再升级自建 |

**市场风险**

| 风险 | 概率 | 影响 | 缓解策略 |
|------|------|------|---------|
| AI IDE 厂商内置类似功能 | 60%（18-36 月） | 高 | 护城河：跨 IDE 通用性 + 开源社区 + 品类定义先发优势 |
| 目标用户群体太小 | 低 | 高 | 初始聚焦框架用户（5-20 万），验证后向效率猎手（100-200 万）扩展 |
| 开源项目冷启动困难 | 中 | 中 | README 叙事 + 首周 ProductHunt / Hacker News 发布 + 框架社区精准投放 |

**资源风险**

| 风险 | 概率 | 影响 | 缓解策略 |
|------|------|------|---------|
| 独立开发者精力有限 | 高 | 中 | MVP 极简范围 + 分阶段交付 + 社区贡献模式（旅程 4）分担适配层 |
| 维护负担超预期 | 中 | 中 | core + adapters 架构解耦维护责任；社区适配模块由社区维护 |

## 功能需求

### 项目初始化与配置

- **FR1**：用户可以通过单个命令（`cord init`）完成项目的完整初始化配置
- **FR2**：系统可以自动检测当前项目使用的 AI IDE 类型（Claude Code / Cursor / VS Code Copilot / Codex CLI）
- **FR3**：系统可以自动检测当前项目使用的开发框架（BMAD-Method / Superpowers / 无框架）。注：检测能力与适配能力解耦——v0.1 可检测 Superpowers 框架存在，但适配模块（预设文档类型和关系规则）计划于 v0.5 交付
- **FR4**：系统可以根据检测到的 IDE 类型自动生成对应的配置文件（MCP 配置、指令文件、Hooks 脚本）
- **FR5**：用户可以查看当前项目的 CORD 配置状态和健康信息（`cord status`）

### 文档扫描与关系发现

- **FR6**：用户可以对项目中的所有文档执行冷启动扫描，自动发现并建立文档间的关系图谱
- **FR7**：系统可以对已有图谱执行增量扫描，仅处理变更的文档
- **FR8**：增量扫描时，系统可以检测文档的重命名、移动和删除事件（通过对比文件系统快照与图谱记录的路径），并自动更新或清理图谱中的孤立节点和失效关系边
- **FR9**：系统可以通过规则引擎识别文档间的关系（frontmatter 引用、Markdown 链接、目录结构推断）
- **FR10**：系统可以将发现的关系按 9 种传播行为类型进行分类（sync_required / context_for / lifecycle_bound / contains / must_consistent / sync_suggested / derived_from / deprecated / references）
- **FR11**：系统可以为每条发现的关系标记置信度分数（范围 0.0-1.0）：frontmatter 显式声明 ≥ 0.95、Markdown 链接精确匹配 ≥ 0.85、目录结构推断 0.50-0.70、框架预设规则 ≥ 0.90。影响分析默认过滤阈值 ≥ 0.50，用户可通过配置调整
- **FR12**：系统可以建立文档级关系索引（文档 A 关联文档 B）作为 v0.1 核心粒度；章节/段落级粒度（文档 A 第 3 章关联文档 B 第 2 节）作为 v0.5+ 扩展能力，v0.1 阶段不实现

### 关系查询与影响分析

- **FR13**：用户可以查询指定文档的所有关联关系（一跳关系列表）
- **FR14**：用户可以按关系类型过滤查询结果
- **FR15**：用户可以对指定文档执行变更影响分析，获取受影响文档列表及建议动作
- **FR16**：系统可以支持多跳关系遍历（一跳、二跳、三跳查询）
- **FR17**：系统可以在影响分析结果中明确标注每条受影响关系的传播行为类型和建议动作

### 关系管理与修正

- **FR18**：用户可以手动添加文档间的关系（指定源文档、目标文档、关系类型）
- **FR19**：用户可以移除或标记已有关系为 deprecated
- **FR20**：系统可以通过 MCP Tools 暴露 FR18（添加关系）和 FR19（移除/标记 deprecated）的关系管理能力，AI Agent 负责从用户自然语言对话中解析意图后调用对应 Tool——CORD 提供原子化的关系 CRUD 操作，AI IDE 负责意图理解和交互编排
- **FR21**：系统可以记录关系的来源（自动扫描 / 手动添加 / 框架预设）和修改历史
- **FR22**：增量扫描时，系统可以识别并保护用户手动修正过的关系：手动添加的关系不被自动删除，手动标记为 deprecated 的关系不被自动恢复。优先级规则：手动修正 > 框架预设 > 自动扫描发现
- **FR23**：用户可以按文档类别配置不同的更新策略（自动更新 / 生成建议后人工确认 / 仅记录不触发）

### 数据存储与导出

- **FR24**：系统可以使用嵌入式数据库存储文档节点和关系边的完整图谱数据
- **FR25**：系统可以维护文档同步状态表，追踪每份文档的最后扫描时间和变更状态
- **FR26**：用户可以将完整关系图谱导出为 JSON 快照文件（供 git 审阅）
- **FR27**：系统可以在本地完成所有数据存储和处理，不依赖任何外部云服务

### AI IDE 集成

- **FR28**：AI Agent 可以通过 MCP Server 以 Tools 方式调用 CORD 的核心能力（影响分析、关系查询、图谱初始化、同步建议）
- **FR29**：系统可以通过 Hooks 机制在文档变更落盘时自动触发关系检查
- **FR30**：系统可以生成 IDE 特定的全局指令片段，引导 AI Agent 在适当场景调用 CORD
- **FR31**：系统可以生成符合 AI IDE Skills 规范的定义文件（Claude Code `skills/` 目录下 Markdown 格式），覆盖 4 个核心意图场景（影响分析、关系查询、图谱初始化、同步建议），每个 Skills 文件包含触发条件描述、对应 MCP Tool 调用序列和预期输出格式
- **FR32**：MCP Server 可以作为长驻进程运行，响应 AI Agent 的并发查询请求

### 框架适配

- **FR33**：系统可以通过适配器接口（IFrameworkAdapter）支持不同开发框架的文档类型识别
- **FR34**：BMAD 适配模块可以识别 18 种 BMAD 文档类型并应用预设关系规则
- **FR35**：框架适配模块可以通过声明式方式注册文档类型定义和预设关系规则
- **FR36**：系统可以在无特定框架适配时，退回通用规则引擎进行关系发现
- **FR37**：社区开发者可以基于公开的适配器接口和参考实现开发新的框架适配模块。验收标准：(a) IFrameworkAdapter 接口文档完整发布；(b) AbstractFrameworkAdapter 抽象基类提供通用逻辑复用；(c) BMAD 适配模块作为可运行的参考实现，含源码注释和集成测试模板；(d) 非核心开发者可在 4 小时内完成最小可用适配模块（含文档类型注册 + 1 条预设规则 + 通过集成测试）

### 文档管辖范围

- **FR38**：系统的管辖范围包括：框架产出文档、AI IDE/Agent 指令规范文档（CLAUDE.md、.cursor/rules/*.mdc、copilot-instructions.md、AGENTS.md；.windsurf/rules 为 v0.5+ 扩展）、用户在框架之外自行指令产生的文档
- **FR39**：系统明确排除项目源码目录（src/）下的所有文件，不对源码及源码目录下的文档建立关系
- **FR40**：系统可以为已支持的框架（BMAD-Method、Superpowers）和 IDE（Claude Code、Cursor、VS Code Copilot、Codex CLI）提供预设的文档路径/目录/文件名配置
- **FR41**：用户可以通过 `cord.config` 自定义扩展文档路径、目录和文件名匹配规则，覆盖或补充预设配置
- **FR42**：系统可以提供框架适配贡献者文档，包含：IFrameworkAdapter 接口 API 说明、最小适配模块开发教程（含代码示例）、集成测试编写指南、PR 提交规范和审阅流程说明

## 非功能需求

### 性能

- **NFR1**：一跳关系查询响应时间 p95 < 1ms（条件：2000 文档 / 50000 关系规模，SQLite WAL 模式）
  - 测量方法：集成测试中使用预填充测试数据库，随机采样 100 次查询，取 p95 值
- **NFR2**：三跳关系遍历响应时间 p95 < 5ms（条件：同 NFR1 数据规模）
  - 测量方法：同 NFR1，使用随机起点执行三跳 BFS，取 p95 值
- **NFR3**：CLI 冷启动时间 p95 < 200ms（条件：已安装项目，Node.js 20+ LTS，无需首次初始化）
  - 测量方法：`time cord --version` 连续执行 20 次，排除首次冷缓存，取 p95 值
- **NFR4**：MCP Server 单次 Tool 调用响应时间 p95 < 50ms（条件：不含 Stdio 传输耗时，单并发，NFR1 同等数据规模）
  - 测量方法：MCP 集成测试中直接调用 Tool handler，记录 Service 层调用耗时，100 次取 p95
- **NFR5**：冷启动扫描处理速度 ≥ 4 文档/秒（条件：平均文档大小 ≤ 50KB，纯 Markdown，规则引擎模式）
  - 测量方法：使用 60 份标准测试文档集（含 BMAD 典型文档类型），记录 `cord scan` 总耗时并计算吞吐率
- **NFR6**：增量扫描无变更时检查完成时间 p95 < 100ms（条件：NFR1 同等数据规模，所有文档 mtime 未变）
  - 测量方法：在完成全量扫描后立即执行 `cord scan`，记录耗时，重复 20 次取 p95

### 可扩展性

- **NFR7**：系统从 200 文档 / 5000 关系扩展到 2000 文档 / 50000 关系时，NFR1-NFR2 指标退化不超过 10%
  - 测量方法：分别在 200/2000 文档规模下执行 NFR1/NFR2 测量，对比响应时间差异百分比
- **NFR8**：新增框架适配模块时，核心模块（scanner/query/impact）的单元测试通过率保持 100%，无需修改核心模块源码
  - 测量方法：新增适配模块 PR 中，CI 流水线执行核心模块完整测试套件，diff 显示核心模块零变更
- **NFR9**：新增传播行为类型时，已有关系数据无需迁移即可正常查询，新旧类型共存于同一图谱
  - 测量方法：集成测试中向 9 类型图谱添加第 10 种类型的关系，验证原有查询结果不变且新类型可查询
- **NFR10**：新增 MCP Tool 时，已有 4 个 Tool（analyze_impact / query_relations / sync_docs / init_graph）的输入输出 JSON Schema 保持不变
  - 测量方法：MCP Tools JSON Schema 快照对比测试——新增 Tool 后与基线快照 diff 为空

### 集成

- **NFR11**：MCP Server 在 Claude Code ≥ 1.0 / Cursor ≥ 0.48 / VS Code Copilot ≥ 1.96 中完成端到端验证：Tool 注册成功 + Tool 调用返回正确结果
  - 测量方法：每个 IDE 中执行标准验证脚本（init_graph → query_relations → analyze_impact 序列），验证返回值符合预期 schema
- **NFR12**：全局指令文件生成采用独立文件注入策略，不修改用户已有的 IDE 配置文件（CLAUDE.md / .cursor/rules/ / copilot-instructions.md）
  - 测量方法：`cord init` 执行前后对用户已有配置文件计算 SHA-256 校验和，校验和一致即通过
- **NFR13**：CLI 与 MCP Server 调用同一 Service 层方法时，对相同输入参数返回语义一致的输出结构（字段名、数据类型、排序规则一致）
  - 测量方法：对照测试——相同输入通过 CLI JSON 模式和 MCP Tool 分别调用，输出 JSON 深度比较（忽略时间戳等运行时字段）
- **NFR14**：JSON 快照导出格式包含 schema 版本号（`schemaVersion` 字段），v0.1 导出的快照在 v0.5+ 中可成功导入
  - 测量方法：版本兼容集成测试——使用 v0.1 格式的快照文件在新版本中执行导入，验证图谱数据完整性

### 可靠性

- **NFR15**：扫描过程中异常中断（进程 kill / 断电模拟）后，数据库一致性校验通过率 = 100%（无部分写入的脏数据）
  - 测量方法：在扫描过程中随机时间点发送 SIGKILL，重启后执行 `PRAGMA integrity_check` 和图谱完整性校验
- **NFR16**：冷启动扫描遇到无法解析的文档（编码错误 / 非 Markdown / 超大文件 > 1MB）时跳过并记录 WARNING 级别日志，整体扫描正常完成
  - 测量方法：测试文档集中混入 5 份异常文档（二进制、乱码、超大），验证扫描完成且异常文档被记录在 WARNING 日志中
- **NFR17**：MCP Server 收到 SIGTERM 信号后在 ≤ 2 秒内完成优雅退出（关闭 SQLite 连接、flush 日志缓冲），返回退出码 0（正常关闭）或 1（异常关闭）。进程生命周期管理（启动/重启）由 IDE Host 负责，不在 CORD 职责范围内
  - 测量方法：集成测试中向 MCP Server 进程发送 SIGTERM，验证：(a) 退出耗时 ≤ 2 秒；(b) SQLite 数据库 `PRAGMA integrity_check` 通过；(c) 退出码符合预期
- **NFR18**：关系图谱可通过 `cord scan --rebuild` 从源文档完全重建，重建后图谱与全量扫描结果一致（节点数、边数、关系类型分布完全匹配）
  - 测量方法：全量扫描后导出快照 A，删除数据库，执行 `--rebuild`，导出快照 B，A 与 B 的 JSON diff 为空（排除时间戳字段）
- **NFR19**：所有用户操作的错误信息遵循统一格式：`[错误码] 错误描述 → 建议操作`，覆盖率 ≥ 95% 的已知错误路径
  - 测量方法：错误路径清单覆盖度审查——列举所有已知错误场景，逐一验证错误输出是否包含错误码、描述和建议三要素

## 开放问题

> 以下问题在产品简报阶段已识别但未解决，需在后续迭代中逐项决策。记录于此以避免下游团队基于未决假设做出不一致的实现选择。

| # | 问题 | 影响范围 | 决策时限建议 |
|---|------|---------|-------------|
| OQ1 | ~~**关系生命周期维护**~~：已决策 — 增量扫描时检测（对比文件系统快照与图谱记录路径），见 FR8。不引入 Git hook 或文件系统监听 | ~~v0.1 增量扫描设计~~ | ✅ 已关闭 |
| OQ2 | **数据收集机制**："非创始人采用案例 50+"（6 个月目标）如何验证？opt-in 遥测？GitHub Discussion 申报？npm 下载统计？ | 业务成功标准可测性 | v0.1 发布前 |
| OQ3 | **社区治理模型**：开源项目长期存续需要核心贡献者招募策略，当前未规划 | 旅程 4 社区贡献可持续性 | v0.5 规划期 |
| OQ4 | **团队共享图谱的技术路径**：v1.0 路线图项，Git 同步 SQLite？多用户并发？技术方案未研究 | v1.0 架构 | v0.5 发布后 |
| OQ5 | **企业级合规**：长期愿景中"开放平台"若引入云同步或协作功能，需考虑 SOC2 / GDPR | v1.0+ 合规 | v1.0 规划期 |

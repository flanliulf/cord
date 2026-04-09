# DR5: AI Coding 辅助框架的文档管理

> **研究日期：** 2026-03-31
> **数据来源：** BMAD Method、GSD、Superpowers、Gstack、OpenSpec 各自 GitHub 仓库及官方文档
> **补充来源：** CORD 项目中 BMAD 本地安装实例的深度文件分析

---

## 5.1 领域定义与边界

**DR5 与 DR2 的区别：**

DR2 研究的是 **IDE/AI 助手的内置文档管理**（Claude Code 的 CLAUDE.md、Cursor 的 .cursor/rules/ 等）——这些是 AI 工具的**原生能力**。

DR5 研究的是 **构建在这些 AI 工具之上的方法论框架**——它们不是 IDE，而是一套**结构化的开发工作流 + 文档管理系统**，通过 Skills/Commands 等机制"教会"AI 按照专业流程工作。

**这个区别对 CORD 至关重要**：DR5 中的框架是 CORD 在"AI 规则文档管理"之上的**高层竞争者和合作者**——它们代表了开发者对"结构化 AI 工作流"的需求，也验证了 CORD 核心假设的市场热度。

---

## 5.2 五大框架概览

| 框架 | 创建者 | GitHub Stars | 定位 | 核心理念 |
|------|--------|-------------|------|---------|
| **Superpowers** | Jesse Vincent (obra) | **127,000** | 可组合的 Agent 技能框架 | "技能优先"——AI 通过学习技能自动执行标准化工作流 |
| **Gstack** | Garry Tan (YC CEO) | **58,500** | 虚拟工程团队 | "This is not a copilot. This is a team."——23 个专业角色的团队模拟 |
| **GSD** | gsd-build | **45,500** | 轻量级元提示系统 | "复杂性在系统中，不在你的工作流中"——反对企业化繁琐 |
| **BMAD Method** | BMad Code | **43,000** | 全生命周期敏捷开发 | "规模-领域自适应"——按项目复杂度自动调整深度 |
| **OpenSpec** | Fission AI | **35,800** | 规范驱动开发 (SDD) | "先共识规范，再写代码"——消除模糊需求 |

**合计：309,800+ GitHub Stars** — 表明 AI Coding 辅助框架已成为一个巨大的开发者需求品类。

---

## 5.3 各框架深度分析

### 5.3.1 Superpowers — 可组合技能框架

**核心定位：** 一套完整的软件开发工作流，构建于可组合"技能（Skills）"之上。

**七阶段开发循环：**

```
Brainstorming → Git Worktrees → Planning → Execution → TDD → Code Review → Branch Completion
```

**技能库组织：**

| 技能类别 | 代表技能 | 说明 |
|---------|---------|------|
| **测试质量** | test-driven-development, verification-before-completion | 强制 RED→GREEN→REFACTOR 循环 |
| **调试** | systematic-debugging | 四阶段根因分析 |
| **协作** | brainstorming, writing-plans, executing-plans, code-review | 工作流编排 |
| **并行执行** | dispatching-parallel-agents | 多 Agent 并行任务 |
| **元能力** | writing-skills, using-superpowers | 自我扩展能力 |

**文档管理方式：**
- Skills 通过 SKILL.md 标准化元数据文件发现
- **自动触发机制**：相关技能在任务执行前**自动**加载（非可选建议）
- 不维护集中式文档仓库——上下文通过技能的组合传递

**支持平台：** Claude Code、Cursor、Codex、OpenCode、Gemini CLI

_来源：[github.com/obra/superpowers](https://github.com/obra/superpowers)_

---

### 5.3.2 Gstack — 虚拟工程团队

**核心定位：** 将 Claude Code 变为一支由 23 个专业 Slash Command 技能组成的虚拟工程团队。

**团队角色映射：**

| 角色 | 对应命令 | 职责 |
|------|---------|------|
| **CEO** | `/office-hours`, `/plan-ceo-review` | 设计评审、战略决策 |
| **Designer** | `/design-consultation`, `/design-shotgun` | 设计系统生成、视觉迭代 |
| **Engineering Manager** | `/plan-eng-review` | 工程评审、测试矩阵 |
| **Release Manager** | `/ship`, `/document-release` | 发布管理、文档自动生成 |
| **QA Lead** | `/qa` | 回归测试生成 |
| **Security Officer** | `/guard` | 安全审计 |
| **Technical Writer** | `/document-release` | 发布文档 |

**工作流：** Think → Plan → Build → Review → Test → Ship → Reflect

**文档管理方式：**
- **CLAUDE.md** 作为核心配置入口
- **SKILL.md 标准** 实现技能发现
- **conductor.json** 管理并行 Sprint（10-15 个并发 Claude Code 实例）
- **ETHOS.md** 定义三层知识架构

**独特能力：**
- 真实 Chromium 浏览器控制（`/browse`、`/connect-chrome`）
- 并行 Sprint：10-15 个 Claude Code 实例同时工作
- 作者声称：60 天发运 600K+ LOC（35% 测试代码），每天 10K-20K 行

_来源：[github.com/garrytan/gstack](https://github.com/garrytan/gstack)_

---

### 5.3.3 GSD — 轻量级元提示系统

**核心定位：** 针对独立开发者的轻量级、规范驱动的 AI 开发系统，反对企业级繁琐流程。

**六步核心循环：**

```
/gsd:new-project → /gsd:discuss-phase → /gsd:plan-phase → /gsd:execute-phase → /gsd:verify-work → /gsd:ship
```

**文档管理方式（五文档体系）：**

| 文档 | 作用 | 位置 |
|------|------|------|
| **PROJECT.md** | 愿景文档 | 项目根目录 |
| **REQUIREMENTS.md** | 功能范围（v1/v2 分阶段） | 项目根目录 |
| **ROADMAP.md** | 阶段化时间线 | 项目根目录 |
| **STATE.md** | 跨会话记忆 | 项目根目录 |
| **CONTEXT.md** | 实现决策记录 | 项目根目录 |

**上下文工程核心策略：解决"Context Rot（上下文腐烂）"**
- 保持项目上下文文档低于退化阈值
- 每个执行器获得全新的 200K Token 上下文（防止累积污染）
- 并行子代理执行保持主会话响应性

**多 Agent 编排：**

| 阶段 | Agent 配置 |
|------|-----------|
| **研究** | 4 个并行调查者 |
| **规划** | 规划器 + 检查器（迭代循环） |
| **执行** | 并行执行器 + 依赖管理 |
| **验证** | 验证器 + 自动调试器 |

**任务结构化：** 使用 XML 格式 `<name>`, `<files>`, `<action>`, `<verify>`, `<done>`

**支持平台：** Claude Code、OpenCode、Gemini CLI、Codex、Copilot、Cursor、Windsurf、Antigravity

_来源：[github.com/gsd-build/get-shit-done](https://github.com/gsd-build/get-shit-done)_

---

### 5.3.4 BMAD Method — 全生命周期敏捷开发

**核心定位：** 规模-领域自适应的 AI 驱动敏捷开发框架，覆盖从想法到部署的全生命周期。

**Agent 角色体系（8+1 个专家角色）：**

| 阶段 | Agent | 人设名 | 职责 |
|------|-------|--------|------|
| **分析** | 业务分析师 | Mary | 市场/竞争/需求分析 |
| **分析** | 技术文档专家 | Paige | 文档创作、Mermaid 图表 |
| **规划** | 产品经理 | John | PRD 创建、需求发现 |
| **规划** | UX 设计师 | Sally | 用户研究、交互设计 |
| **方案** | 系统架构师 | Winston | 技术决策、架构设计 |
| **实施** | 开发工程师 | Amelia | 故事执行、TDD |
| **实施** | QA 工程师 | Quinn | 测试自动化 |
| **实施** | Scrum Master | Bob | Sprint 规划 |
| **快速** | 全栈开发者 | Barry | 最小仪式、快速交付 |

**Skills 系统（42 个 Skill，2 个模块）：**

| 模块 | Skill 数 | 覆盖 |
|------|---------|------|
| **Core（通用）** | 13 | 配置、导航、评审、文档工具 |
| **BMM（工作流）** | 29 | 分析→规划→方案→实施，4 阶段 |

**文档管理架构（三层上下文模型）：**

```
第 1 层：全局配置（_bmad/core/config.yaml + _bmad/bmm/config.yaml）
    ↓
第 2 层：工作流文档（Frontmatter 状态追踪 + Markdown 内容）
    ↓
第 3 层：步骤级上下文（step-01.md, step-02.md... 微文件架构）
```

**关键设计模式：**
- **微文件架构**：每个工作流拆分为 8-12 个独立步骤文件，Just-In-Time 加载
- **Append-Only 文档构建**：步骤完成后追加内容，不修改已有部分
- **Frontmatter 状态库**：`stepsCompleted`、`inputDocuments`、`workflowType` 追踪进度
- **续航协议**：中断后通过 `step-01b-continue.md` 自动恢复状态
- **输入文档自动发现**：搜索 `{planning_artifacts}/**`、`docs/**` 自动关联上下文

**产出物链条：**

```
Product Brief → Research (Domain/Market/Technical)
    ↓
PRD (11 步) → UX Design → Architecture (8 步)
    ↓
Epics & Stories → Sprint Plan → Story Dev → Code Review → QA Tests
```

_来源：[github.com/bmad-code-org/BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD)、CORD 项目本地实例深度分析_

---

### 5.3.5 OpenSpec — 规范驱动开发

**核心定位：** 在写代码之前，人与 AI 先就需求规范达成共识的 SDD（Spec-Driven Development）框架。

**核心工作流：**

```
/opsx:propose → /opsx:apply → /opsx:archive
```

**规范文件结构（每个功能提案）：**

| 文件 | 作用 |
|------|------|
| **proposal.md** | 理由和范围定义 |
| **specs/** | 需求和用户场景 |
| **design.md** | 技术架构 |
| **tasks.md** | 实现清单 |

**五大原则：**
1. 流式而非僵化
2. 迭代而非瀑布
3. 简单优于复杂
4. 棕地就绪（不只是绿地项目）
5. 从个人到企业可扩展

**扩展命令体系：** `/opsx:new`、`/opsx:continue`、`/opsx:ff`、`/opsx:verify`、`/opsx:sync`、`/opsx:bulk-archive`、`/opsx:onboard`

**支持平台：** 20+ AI 编程助手（GitHub Copilot、Claude Code、AWS Kiro 等）

_来源：[github.com/Fission-AI/OpenSpec](https://github.com/Fission-AI/OpenSpec)_

---

## 5.4 横向比较矩阵

### 5.4.1 基础对比

| 维度 | Superpowers | Gstack | GSD | BMAD | OpenSpec |
|------|------------|--------|-----|------|---------|
| **Stars** | 127K | 58.5K | 45.5K | 43K | 35.8K |
| **定位** | 技能框架 | 虚拟团队 | 元提示系统 | 全生命周期 | 规范驱动 |
| **侧重阶段** | 实施为主 | 全流程 | 规划+执行 | 分析→部署 | 规划为主 |
| **角色体系** | 技能组合 | 7 个虚拟角色 | 4 类 Agent | 9 个人设 Agent | 无显式角色 |
| **Skill 数** | ~14 | 23 | ~8 命令 | 42 | ~10 命令 |
| **许可证** | MIT | MIT | — | MIT | MIT |

### 5.4.2 文档管理对比

| 维度 | Superpowers | Gstack | GSD | BMAD | OpenSpec |
|------|------------|--------|-----|------|---------|
| **核心文档载体** | SKILL.md 元数据 | CLAUDE.md + SKILL.md | 5 个 .md 文件体系 | Frontmatter Markdown 系统 | proposal + specs 文件夹 |
| **上下文工程** | 技能自动触发 | ETHOS.md 三层知识 | Context Rot 预防 | 三层上下文 + JIT 加载 | 规范与代码共存 |
| **状态管理** | Git Worktrees | conductor.json | STATE.md 跨会话 | Frontmatter stepsCompleted | tasks.md 清单 |
| **产出物管理** | 无集中仓库 | 发布文档自动生成 | .planning/ 目录 | _bmad-output/ 结构化目录 | 功能文件夹结构 |
| **多语言支持** | ❌ | ❌ | ❌ | ✅（通信+文档分离） | ❌ |
| **中断恢复** | Git Worktree 隔离 | — | STATE.md | step-01b-continue.md | /opsx:continue |

### 5.4.3 上下文工程策略对比

| 框架 | 策略 | 核心技术 |
|------|------|---------|
| **Superpowers** | "技能即上下文"——需要什么技能就加载什么知识 | SKILL.md 自动发现 + 按需触发 |
| **Gstack** | "三层知识架构"——ETHOS.md 定义思考框架 | 角色间流转 + conductor 并行 |
| **GSD** | "Context Rot 预防"——每个执行器全新 200K 上下文 | 并行子代理 + 原子提交 |
| **BMAD** | "微文件 JIT 加载"——只加载当前步骤 | step 文件 + Frontmatter 状态 |
| **OpenSpec** | "规范与代码共存"——规范文件随功能文件夹组织 | proposal → specs → design → tasks |

---

## 5.5 行业模式归纳

通过对 5 个框架的横向分析，可以归纳出 AI Coding 辅助框架的文档管理的**三大模式**：

### 模式 A：技能驱动（Skill-Driven）

**代表：** Superpowers、Gstack

```
SKILL.md 定义 → AI 自动发现 → 按需加载技能 → 技能中嵌入上下文
```

- **优势**：灵活、可组合、社区可扩展
- **劣势**：缺乏全局文档视图；技能之间的上下文传递不明确
- **CORD 机会**：为技能库提供元数据管理和依赖图谱

### 模式 B：文档驱动（Document-Driven）

**代表：** BMAD Method、GSD

```
结构化 Markdown 文件 → Frontmatter 状态 → 工作流步骤引用 → 产出物链条
```

- **优势**：文档即真相源；产出物可追溯；支持中断恢复
- **劣势**：文件数量多（BMAD 42 个 Skill + 数十个步骤文件）；上下文管理复杂
- **CORD 机会**：提供产出物关系图谱、文件过时检测、跨工作流引用追踪

### 模式 C：规范驱动（Spec-Driven）

**代表：** OpenSpec

```
proposal.md → specs/ → design.md → tasks.md → 代码实现
```

- **优势**：规范与代码同目录，天然同步；简洁直观
- **劣势**：缺少自动化执行编排；适合规划阶段，实施阶段较弱
- **CORD 机会**：增强规范与代码的绑定关系追踪（类似 DR3 的图谱方案）

---

## 5.6 对 CORD 产品设计的关键洞察

### 洞察 1：市场验证极为充分

**309,800+ Stars 合计**——AI Coding 辅助框架已成为一个巨大的开发者需求品类。开发者不满足于 IDE 的内置 AI 能力，他们需要**结构化的工作流和文档管理系统**。这直接验证了 CORD 的核心假设。

### 洞察 2：CORD 是这些框架的"文档基础设施层"

所有 5 个框架都面临共同的文档管理挑战：
- 大量 Markdown 文件的组织和发现
- 产出物之间的引用关系追踪
- 跨工作流的上下文传递
- 文档过时检测

CORD 不与这些框架竞争，而是**为它们提供基础设施**——管理它们产生的文档、追踪文档关系、检测过时内容。

### 洞察 3：SKILL.md 正在成为事实标准

Superpowers、Gstack、BMAD 都采用 SKILL.md 作为技能/工具的元数据标准。这与 DR2 中的 AGENTS.md 类似，是另一个**可标准化的文档格式**。CORD 应该支持 SKILL.md 的解析和关系追踪。

### 洞察 4：上下文工程是核心技术挑战

5 个框架各自发明了不同的上下文工程方案：
- GSD 的 "Context Rot 预防"
- BMAD 的 "微文件 JIT 加载"
- Superpowers 的 "技能自动触发"

这证明**上下文管理**是 AI Coding 的最大技术痛点。CORD 的智能上下文分片功能（DR3）直接解决这个问题。

### 洞察 5：Frontmatter 成为工作流状态管理的通用模式

BMAD、GSD、OpenSpec 都使用 YAML Frontmatter 作为 Markdown 文件的状态管理机制。这再次验证了 DR2 的发现——**Markdown + YAML Frontmatter 是 AI 规则文档的事实标准格式**。

### 洞察 6：从独立开发者到团队的增长路径

| 框架 | 目标用户 |
|------|---------|
| GSD | 独立开发者（反企业繁琐） |
| Superpowers | 独立开发者→小团队 |
| OpenSpec | 个人→企业（明确声明可扩展） |
| Gstack | 独立创始人（YC CEO 的个人实践） |
| BMAD | 个人→团队（多 Agent 协作） |

CORD 在这些框架的产出物管理上的价值，同样遵循 DR4 的增长路径：个人使用→团队共享→企业管控。

---

## DR5 研究小结

**AI Coding 辅助框架已爆炸性增长，309K+ Stars 合计，代表了开发者对结构化 AI 工作流的强烈需求：**

- **5 个框架形成三大文档管理模式**：技能驱动（Superpowers/Gstack）、文档驱动（BMAD/GSD）、规范驱动（OpenSpec）
- **所有框架都基于 Markdown + YAML Frontmatter**，格式标准化具有高可行性
- **上下文工程是最大技术挑战**——每个框架都发明了独特的解决方案
- **CORD 不是这些框架的竞争者，而是它们的文档基础设施层**——管理产出物、追踪关系、检测过时

**对 CORD 核心价值命题的增强：**

> CORD = AI 编程生态的文档基础设施层
> - **向下**（DR2）：管理 IDE 级别的 CLAUDE.md / .cursor/rules / copilot-instructions
> - **向上**（DR5）：管理框架级别的 SKILL.md / PRD / Architecture / Stories 产出物
> - **贯穿**（DR3）：用文档关系图谱追踪所有层级的关联关系

_研究完成日期：2026-03-31_
_置信度：高（数据来自 5 个框架的 GitHub 仓库一手资料 + BMAD 本地实例深度分析）_

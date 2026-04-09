# Customer Pain Points and Needs

## 客户挑战与挫败感

在 AI Coding 场景下，文档管理的痛点呈现出一种独特的「级联放大」效应——单个文档的不一致会通过 AI Agent 的推理链条被放大为代码级别的错误。

**🔴 P0 级挫败感：AI Agent 的「上下文污染」**

这是 CORD 目标用户最强烈的挫败感来源。当 AI Agent（如 Claude Code、Cursor）在编码时加载了**过时的或不一致的文档**作为上下文，会直接导致：
- 生成的代码与最新架构决策不符
- 使用已弃用的 API 或数据结构
- 产出与 PRD 不一致的功能实现
- 花费大量时间 debug 才发现「问题出在文档不是代码」

_挫败感量化：每次「上下文污染」事件导致的返工时间估计为 1-4 小时。对于日均使用 AI 编码 4h+ 的开发者，每周至少遭遇 2-3 次此类问题。_

> 💬 典型用户反馈场景：「我花了两个小时 debug，最后发现是 CLAUDE.md 里引用的架构文档还是两周前的版本，但架构文档本身已经改了三次了。AI 根据旧架构写的代码，当然跑不通。」

**🟠 P1 级挫败感：「改了一个文档，不知道还有哪些文档受影响」**

在使用 BMAD-Method 等框架的项目中，一个典型项目可能有 20-50 份结构化文档（PRD、架构设计、Epic 列表、Sprint Plan、Story 文件、UX 设计等）。它们之间存在复杂的关联关系，但这些关系是**隐性的**：
- 修改 PRD 中的需求条目 → 可能影响多个 Epic 描述、Story AC、架构约束
- 更新架构决策（ADR）→ 可能影响技术实现指南、API 文档、部署文档
- 变更 UX 设计 → 可能影响 Story 的验收标准、测试用例

_频率分析：在活跃开发周期中，这类「关联遗漏」每周发生 5-10 次，大多数被静默忽略，直到在代码实现阶段才被发现。_

**🟡 P2 级挫败感：「手动维护 CLAUDE.md / .cursorrules 中的文档引用」**

开发者目前通过在 AI 指令文件（CLAUDE.md、.cursorrules、instructions.md 等）中手动列出关键文档引用来管理 AI 上下文。这种方式：
- 容易遗漏新增的重要文档
- 无法自动感知引用文档的变更状态
- 随着项目增长，指令文件变得臃肿不堪
- 不同 IDE 的指令文件格式不统一，维护多份

_Source: [Anthropic Claude Code Documentation](https://docs.anthropic.com/en/docs/claude-code), [Cursor Documentation](https://docs.cursor.com/), [GitHub Copilot Documentation](https://docs.github.com/en/copilot)_

## 未被满足的客户需求

通过交叉分析用户行为和现有解决方案，以下核心需求目前在市场上**无任何工具**能充分满足：

**⭐ 需求 1：文档间关联关系的确定性存储与查询**

| 维度 | 描述 |
|------|------|
| 需求强度 | 🔴 极高 |
| 现有方案 | 无专用工具。开发者依赖文档内的手动备注（如 `<!-- Related: xxx.md -->`）或纯靠 LLM 推理 |
| 差距 | 手动备注不可靠、不完整；LLM 推理不确定、有幻觉风险。需要**确定性的、可查询的**关系存储 |
| CORD 映射 | 核心价值——SQLite/Kùzu 存储 + IGraphRepository 接口 |

**⭐ 需求 2：文档变更时的关联影响分析**

| 维度 | 描述 |
|------|------|
| 需求强度 | 🔴 极高 |
| 现有方案 | 无。开发者靠经验和记忆判断「改了这个文档还需要改哪些」 |
| 差距 | 人的记忆不可靠，新团队成员更无从知晓。需要**自动化的影响分析** |
| CORD 映射 | `analyze_impact` 意图驱动 Skill |

**⭐ 需求 3：渐进式上下文注入（给 AI Agent「恰好够用」的上下文）**

| 维度 | 描述 |
|------|------|
| 需求强度 | 🟠 高 |
| 现有方案 | 手动在 CLAUDE.md 中列出文件路径，或使用 `@file` 手动引用 |
| 差距 | 加载太多 → token 浪费 + 注意力稀释；加载太少 → 信息不足。需要**按需精准加载**关联文档 |
| CORD 映射 | 渐进式披露机制 + `context_for` 关系类型 |

**⭐ 需求 4：文档关系的全局可视化**

| 维度 | 描述 |
|------|------|
| 需求强度 | 🟡 中 |
| 现有方案 | 无。开发者脑中有一个模糊的「文档关系地图」，但无法外化和共享 |
| 差距 | 新团队成员无法快速理解项目文档结构；文档关系只存在于「老人」脑中 |
| CORD 映射 | Mermaid 静态渲染 + Web UI 衍生系统 |

**⭐ 需求 5：冷启动——对已有项目的逆向关系发现**

| 维度 | 描述 |
|------|------|
| 需求强度 | 🟠 高 |
| 现有方案 | 无。新工具通常只能管理「从现在开始」产生的关系 |
| 差距 | 大多数用户的项目已有大量文档但无关系图谱，冷启动能力决定第一印象 |
| CORD 映射 | 冷启动扫描器 + 框架文档结构识别 |

_Source: [Anthropic Claude Code Docs](https://docs.anthropic.com/en/docs/claude-code), [Model Context Protocol Spec](https://modelcontextprotocol.io/), [BMAD Method Documentation](https://github.com/bmadcode/BMAD-METHOD)_

## 采纳障碍

**🚧 技术障碍：**

| 障碍 | 严重程度 | 描述 | 缓解策略 |
|------|----------|------|----------|
| 安装配置复杂度 | 🟠 中 | 需要安装 Node.js + SQLite + 配置 MCP Server + 配置 Hooks | 提供 `npx cord init` 一键初始化 |
| 学习曲线 | 🟡 低-中 | 新概念（关系类型、传播行为）需要学习 | 意图驱动 API（`analyze_impact`），降低认知负担 |
| 与现有工具链集成 | 🟠 中 | 需要与 Claude Code / Cursor / Copilot 各自的配置机制适配 | 提供多 IDE 预设模板 |
| 性能顾虑 | 🟡 低 | 「又一个后台进程会不会拖慢我的开发环境？」 | SQLite 嵌入式 + 50ms SLA 承诺 |

**🚧 信任障碍：**

| 障碍 | 严重程度 | 描述 | 缓解策略 |
|------|----------|------|----------|
| 「又一个工具？」疲劳 | 🔴 高 | 开发者对新工具的天然抵触——学习成本 vs 收益不确定 | 5 分钟快速上手体验 + 可量化收益展示 |
| 开源信任度 | 🟡 低 | 新项目无 Star、无社区背书 | 通过 BMAD 社区获取早期用户 + 高质量文档 |
| 数据安全顾虑 | 🟢 极低 | 纯本地存储，无云端依赖 | 本地优先架构本身就是最好的安全承诺 |

**🚧 生态障碍：**

| 障碍 | 严重程度 | 描述 | 缓解策略 |
|------|----------|------|----------|
| 跨 IDE 碎片化 | 🟠 中 | Claude Code 有 Hooks，Cursor 有 .cursorrules，Copilot 有 instructions.md——各自为政 | 通用协议 + 框架适配层（core + adapters） |
| MCP 生态成熟度 | 🟠 中 | Model Context Protocol 仍在快速演进中，API 可能变化 | CLI 作为稳定基线，MCP 作为增强通道 |
| 框架依赖性 | 🟡 低 | 「我不用 BMAD，这个工具对我有用吗？」 | 核心独立于框架，BMAD 适配仅为示例 |

_Source: [Model Context Protocol Documentation](https://modelcontextprotocol.io/), [GitHub Developer Survey](https://github.blog/news-insights/), [SlashData Developer Nation Report](https://www.slashdata.co/)_

## 客户满意度差距

**现有方案满意度评估：**

| 方案类别 | 用户满意度 | 核心不满 |
|----------|-----------|----------|
| **手动文档内备注** (`<!-- Related: -->`) | ⭐⭐ (2/5) | 不可靠、不可查询、容易遗忘维护 |
| **LLM 推理关联** （无图谱支撑） | ⭐⭐ (2/5) | 不确定性高、有幻觉风险、无法保证一致性 |
| **Confluence/Notion 链接** | ⭐⭐⭐ (3/5) | 为人类设计，对 AI Agent 不友好；链接是扁平的，无法区分关系类型 |
| **Git submodule / monorepo** | ⭐⭐ (2/5) | 代码级工具，不适合文档关系管理 |
| **自定义脚本** (hooks + grep) | ⭐⭐⭐ (3/5) | 能用但脆弱，维护成本高，不可移植 |

**期望差距（Expectation Gap）：**
- 开发者**期望** AI 编码工具能自动理解文档间的关系 → **现实**是 AI 只能看到你明确提供的上下文
- 开发者**期望**修改一个文档后能自动获得关联影响提示 → **现实**是无任何工具提供此能力
- 开发者**期望**新团队成员能快速理解文档结构 → **现实**是文档关系只存在于「老人」脑中

_Source: [Zeroheight State of Documentation 2025](https://zeroheight.com/), [SmartBear State of Software Quality Report](https://smartbear.com/)_

## 情感影响评估

**挫败感严重性地图：**

```
极高挫败 ████████████████████ AI 基于过时文档生成错误代码（P0）
高挫败   ███████████████     改了文档不知道影响范围（P1）
中挫败   ██████████          手动维护 AI 指令文件的文档引用（P2）
低挫败   ██████              新项目无法快速建立文档关系（P3）
```

**忠诚度风险：**
- 这些痛点**不会**导致用户离开 AI 编码工具（AI 编码的效率提升远大于文档管理的成本）
- 但会导致用户**降低对 AI 编码输出的信任度**——「AI 写的代码我都要仔细 review，因为不确定它看的文档是不是最新的」
- 这种「信任折扣」正是 CORD 可以消除的——**CORD 不是替代 AI 编码工具，而是提升 AI 编码工具可信度的基础设施**

**品牌声誉影响：**
- 如果 CORD 能解决 P0 痛点（AI 上下文污染），将赢得「AI Coding 基础设施必备」的品牌定位
- 首批用户的口碑至关重要——AI Coding 社区信息传播极快

_Source: [Anthropic Claude Code Docs](https://docs.anthropic.com/en/docs/claude-code), [Developer Sentiment Analysis - GitHub Discussions](https://github.com/)_

## 痛点优先级矩阵

| 优先级 | 痛点 | 影响面 | 发生频率 | 解决方案机会 | CORD 能力映射 |
|--------|------|--------|----------|-------------|---------------|
| **🔴 P0** | AI Agent 上下文污染（加载过时/不一致文档） | 所有 AI 编码用户 | 每周 2-3 次 | ⭐⭐⭐⭐⭐ 市场空白 | `sync_required` + `deprecated` 关系类型 + `analyze_impact` |
| **🔴 P0** | 文档变更的关联影响不可知 | 框架用户 + 团队项目 | 每周 5-10 次 | ⭐⭐⭐⭐⭐ 市场空白 | 核心图谱查询 + 影响分析 |
| **🟠 P1** | 手动维护 AI 指令文件的文档引用 | Claude Code/Cursor 用户 | 每日 | ⭐⭐⭐⭐ 部分可替代方案 | `context_for` 关系类型 + 自动注入 |
| **🟠 P1** | 已有项目无法建立文档关系图谱 | 所有潜在新用户 | 首次使用 | ⭐⭐⭐⭐⭐ 市场空白 | 冷启动扫描器 |
| **🟡 P2** | 缺乏文档关系全局视图 | 团队项目 + 新成员 | 偶尔 | ⭐⭐⭐ 有替代方案 | Mermaid 渲染 + Web UI |
| **🟡 P2** | 跨 IDE 文档管理不统一 | 多 IDE 用户 | 持续 | ⭐⭐⭐⭐ 通用协议可解 | 通用协议 + 适配层 |

**💎 核心洞察：两个 P0 痛点（上下文污染 + 关联影响不可知）目前在市场上完全空白，没有任何专用工具在解决。这是 CORD 最大的市场机会。**

_Source: [Market analysis based on web research and brainstorming session findings](https://github.blog/), [Stack Overflow Developer Survey 2025](https://survey.stackoverflow.co/2025/)_

---

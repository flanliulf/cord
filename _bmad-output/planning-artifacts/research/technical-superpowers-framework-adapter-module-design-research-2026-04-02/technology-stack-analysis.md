# Technology Stack Analysis

本节以 Superpowers v5.0.7（github.com/obra/superpowers）为实证样本，对 Superpowers 框架的技术特征进行全面解析。所有结论基于 GitHub 仓库一手分析，并结合 Web 搜索交叉验证。

## 1. Superpowers 框架结构分析

### 1.1 框架整体架构

Superpowers 是一个由 Jesse Vincent（GitHub: obra）创建的 **AI 编码代理技能框架（Agentic Skills Framework）**，核心定位是为 AI 编码代理提供系统化的软件工程方法论——引导代理按照测试驱动开发（TDD）、系统化调试、并行代理派遣等工程最佳实践工作，而非直接生成代码。

**框架核心设计理念**：`"Test-Driven Development — Write tests first, always"`

**框架核心组件**：

| 组件 | 位置 | 说明 |
|------|------|------|
| **Skills 目录** | `skills/` | 14 个核心技能，每个技能一个子目录，含 SKILL.md 定义文件 |
| **Agents 目录** | `agents/` | 代理实现（代理调用技能） |
| **Commands 目录** | `commands/` | 命令定义 |
| **Tests 目录** | `tests/` | 技能测试套件 |
| **Platform 目录** | `.claude-plugin/` `.cursor-plugin/` `.codex/` `.opencode/` | 各平台集成配置 |
| **Platform Docs** | `CLAUDE.md` `AGENTS.md` `GEMINI.md` | 各 AI 平台专属指南文件 |
| **Package Config** | `package.json` | `name: "superpowers"`, `version: "5.0.7"`, `type: "module"` |

_置信度：**HIGH** — 基于 github.com/obra/superpowers 仓库实际文件结构直接验证_

### 1.2 七阶段工作流架构

Superpowers 将开发流程组织为 7 个顺序阶段，形成完整的技能驱动开发生命周期：

```
Stage 1: Brainstorming（头脑风暴）
  └─ 技能：brainstorming
  └─ 产出：细化的规格和设计方案
         ↓
Stage 2: Git Worktrees（工作树隔离）
  └─ 技能：using-git-worktrees
  └─ 产出：隔离的开发环境，干净的测试基线
         ↓
Stage 3: Planning（计划制定）
  └─ 技能：writing-plans
  └─ 产出：2-5 分钟粒度的任务分解（含精确文件路径和验证步骤）
         ↓
Stage 4: Subagent-Driven Development（子代理驱动开发）
  └─ 技能：subagent-driven-development、dispatching-parallel-agents
  └─ 产出：每个任务由独立子代理执行，任务间设代码审查关卡
         ↓
Stage 5: Test-Driven Development（测试驱动开发）
  └─ 技能：test-driven-development
  └─ 产出：RED-GREEN-REFACTOR 循环，测试先行
         ↓
Stage 6: Code Review（代码审查）
  └─ 技能：receiving-code-review、requesting-code-review
  └─ 产出：对照规格验证，关键问题阻断流程
         ↓
Stage 7: Branch Completion（分支完成）
  └─ 技能：finishing-a-development-branch、verification-before-completion
  └─ 产出：验证测试通过，提供合并/PR 选项
```

**关键特性**：技能是**自动激活**的——代理不需要手动选择，框架根据上下文自动调用相关技能（由 `when_to_use` 字段驱动）。

_置信度：**HIGH** — 基于 Superpowers README 和 SKILL.md 文件直接验证_

### 1.3 框架检测签名

CORD 适配器需要可靠地检测项目是否使用 Superpowers 框架。基于实际文件结构分析，以下是分层检测策略：

| 检测层级 | 检测方式 | 置信度 | 说明 |
|---------|---------|--------|------|
| **L1: 平台目录存在** | `.claude-plugin/` 或 `.cursor-plugin/` 或 `.opencode/` 目录存在 | 70% | 多平台框架的安装标志（不唯一） |
| **L2: skills/ 目录** | `skills/` 目录存在 + 含 `*/SKILL.md` 文件 | 85% | Superpowers 技能目录特征 |
| **L3: package.json 确认** | `package.json` 中 `name: "superpowers"` | 98% | 精确框架识别 |
| **L4: CLAUDE.md 标记** | `CLAUDE.md` 中含 Superpowers 特征字符串 | 90% | 辅助确认 |

**推荐检测逻辑**：L2（`skills/*/SKILL.md` 存在）即可达到 85% 置信度；L2 + L3 组合达 98%。L1 单独使用置信度过低（`.claude-plugin/` 可能是其他框架的配置目录）。

_置信度：**HIGH** — 基于 Superpowers 仓库实际目录结构验证_

## 2. SKILL.md 元数据规范

### 2.1 SKILL.md Frontmatter 标准

Superpowers 每个技能的核心定义文件为 `SKILL.md`，YAML frontmatter 包含以下字段：

```yaml
---
name: Systematic Debugging           # 人类可读名称（必填）
description: Four-phase debugging... # 一行描述（必填）
when_to_use: when encountering...    # ⭐ 触发条件（必填，关键字段）
version: 2.1.0                       # 语义化版本号（必填）
languages: all                       # all | [具体语言列表]（可选）
dependencies:                        # 可选，依赖其他技能列表
  - systematic-debugging
  - test-driven-development
---
```

**`when_to_use` 字段的关键设计规则**：
- 必须描述**问题症状**（如 `"when encountering race conditions or flakiness"`），而非技术关键词
- 这使得 AI 代理能在特定上下文中自动触发技能，无需手动选择
- 是 CORD 关系推断中**语义分析**的主要来源

_置信度：**HIGH** — 基于 Superpowers `writing-skills` 技能文档直接验证_

### 2.2 SKILL.md 标准文档结构（5个部分）

| 部分 | 说明 | CORD 关系价值 |
|------|------|-------------|
| **Frontmatter** | YAML 元数据（name、description、when_to_use、version、dependencies） | ⭐⭐⭐ 技能类型识别 + 依赖关系提取 |
| **Overview** | 核心原则（1-2句话） | ⭐ 语义匹配 |
| **Quick Reference** | 可扫描的模式/表格 | — |
| **Implementation** | 详细指导和示例 | ⭐ 内容特征检测 |
| **Supporting files** | 测试场景文件（test-*.md）、创建日志（CREATION-LOG.md） | ⭐ 目录结构检测 |

### 2.3 CORD 关系价值评估

| Frontmatter 字段 | CORD 关系价值 | 说明 |
|-----------------|-------------|------|
| `dependencies` | ⭐⭐⭐ **最高价值** — 显式依赖声明 → `derived_from` 关系，置信度 0.95 | 技能间的显式先决条件 |
| `when_to_use` | ⭐⭐ **高价值** — 触发条件语义分析 → `informs` 关系，置信度 0.70 | 语义驱动的自动激活信号 |
| `name` + `description` | ⭐ **中价值** — 技能名称匹配 → 类型识别 | 技能分类 |
| `version` | ⭐ **低价值** — 版本管理信号 | 版本兼容性 |

_置信度：**HIGH** — 字段价值评估基于 Superpowers 框架设计理念分析_

## 3. 14 个核心技能完整清单

通过对 Superpowers v5.0.7 仓库的全面分析，识别 **14 个核心技能**：

| 技能 ID | 技能名称 | 工作流阶段 | 技能类型 | 关键文件 |
|--------|---------|----------|---------|---------|
| `brainstorming` | 头脑风暴 | Stage 1 | 协作类 | SKILL.md |
| `using-git-worktrees` | 使用 Git 工作树 | Stage 2 | 技术类 | SKILL.md |
| `writing-plans` | 编写计划 | Stage 3 | 协作类 | SKILL.md |
| `executing-plans` | 执行计划 | Stage 3-4 | 协作类 | SKILL.md |
| `subagent-driven-development` | 子代理驱动开发 | Stage 4 | 技术类 | SKILL.md |
| `dispatching-parallel-agents` | 并行代理派遣 | Stage 4 | 协作类 | SKILL.md |
| `test-driven-development` | 测试驱动开发 | Stage 5 | 技术类 | SKILL.md |
| `requesting-code-review` | 请求代码审查 | Stage 6 | 协作类 | SKILL.md |
| `receiving-code-review` | 接受代码审查 | Stage 6 | 协作类 | SKILL.md |
| `finishing-a-development-branch` | 完成开发分支 | Stage 7 | 技术类 | SKILL.md |
| `verification-before-completion` | 完成前验证 | Stage 7 | 技术类 | SKILL.md |
| `systematic-debugging` | 系统化调试 | 横切关注点 | 调试类 | SKILL.md + test-*.md |
| `using-superpowers` | 使用 Superpowers 框架入门 | 元技能 | 参考类 | SKILL.md |
| `writing-skills` | 编写新技能 | 元技能 | 元技能类 | SKILL.md |

**技能分类维度（来自 `superpowers-skills` 社区库）**：

| 类别 | 技能特征 | CORD 检测策略 |
|------|---------|-------------|
| **rigid（严格遵守）** | 必须按步骤执行的技能（如 TDD）| 高置信度规则匹配 |
| **flexible（灵活适用）** | 根据上下文灵活使用的技能（如 brainstorming）| 语义分析推断 |

_置信度：**HIGH** — 基于 github.com/obra/superpowers 仓库 skills/ 目录直接枚举_

## 4. 多平台支持结构

Superpowers 是**多平台框架**，支持 6+ 个 AI 编码工具，各平台的安装目录和配置文件不同：

| 平台 | 安装目录 | 配置文件 | 安装命令 |
|------|---------|---------|---------|
| **Claude Code** | `.claude-plugin/` | `CLAUDE.md` | `/plugin install superpowers@claude-plugins-official` |
| **Cursor** | `.cursor-plugin/` | — | 插件市场搜索 |
| **Codex** | `.codex/` | — | GitHub raw URL 安装 |
| **OpenCode** | `.opencode/` | — | GitHub raw URL 安装 |
| **GitHub Copilot CLI** | — | — | 市场安装 |
| **Gemini CLI** | — | `GEMINI.md` + `gemini-extension.json` | GitHub URL 安装 |

**CORD 适配器检测影响**：多平台支持意味着 Superpowers 在不同项目中的安装目录可能不同，CORD 适配器需要检测所有可能的平台目录作为框架存在的信号。

_置信度：**HIGH** — 基于 Superpowers README 和仓库目录结构直接验证_

## 5. CORD 已确认技术栈约束（前序研究继承）

Superpowers 适配器模块的实现受以下已确认技术栈约束：

| 技术层 | 已确认方案 | 确认来源 | 对适配器的影响 |
|--------|-----------|---------|-------------|
| **文档解析** | remark/unified.js | TR3 | 适配器通过 remark 管道接收 SKILL.md 的 AST |
| **Frontmatter 解析** | gray-matter / remark-frontmatter | TR3 | 适配器读取 `when_to_use`、`dependencies` 字段 |
| **文件发现** | fast-glob + ignore | TR6 | 适配器提供 `skills/*/SKILL.md` glob 模式给扫描器 |
| **数据存储** | SQLite + better-sqlite3 | TR1 | 适配器发现的技能依赖关系写入 relations 表 |
| **CLI** | Commander.js v14 | TR5 | 适配器配置通过 CLI 子命令管理 |
| **MCP Server** | TypeScript SDK v1.x | TR2 | 适配器结果通过 MCP Tool 暴露 |
| **关系发现** | 策略模式 + Provider 抽象 | TR6 | 适配器作为 `IFrameworkAdapter` Provider |
| **框架适配器接口** | `IFrameworkAdapter` 基础接口 | TR10 | Superpowers 适配器实现同一接口，复用 FrameworkRegistry |

_置信度：**HIGH** — TR1-TR10 已确认的技术决策_

## 6. Superpowers 生态与版本信息

| 维度 | 数据 |
|------|------|
| 当前版本 | v5.0.7（package.json `version` 字段） |
| 许可证 | MIT 开源 |
| 核心技能数量 | 14 个（主仓库 obra/superpowers） |
| 社区技能库 | obra/superpowers-skills（已归档，2025-10） |
| 社区扩展 | obra/superpowers-lab（实验性） |
| 中文适配 | jnMetaCode/superpowers-zh（14 翻译 + 6 原创） |
| 支持平台数 | 6+（Claude Code、Cursor、Codex、OpenCode、Copilot、Gemini） |
| 更新频率 | 活跃（语义化版本管理，`.version-bump.json` 管理） |

_置信度：**HIGH** — 基于 GitHub 仓库元数据直接验证_

---

**技术栈分析完成日期：** 2026-04-02

---

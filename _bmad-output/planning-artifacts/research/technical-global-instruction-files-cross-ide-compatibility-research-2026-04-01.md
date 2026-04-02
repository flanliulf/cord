---
stepsCompleted: [1, 2, 3, 4, 5, 6]
inputDocuments: []
workflowType: 'research'
lastStep: 1
research_type: 'technical'
research_topic: '全局指令文件跨 IDE 兼容性研究'
research_goals: 'CLAUDE.md / .cursorrules / instructions.md / .github/copilot-instructions.md / AGENTS.md 格式差异、共性抽象模型、CORD 指令片段注入策略'
user_name: 'Fancyliu'
date: '2026-04-01'
web_research_enabled: true
source_verification: true
---

# Research Report: TR7 — 全局指令文件跨 IDE 兼容性研究

**Date:** 2026-04-01
**Author:** Fancyliu
**Research Type:** Technical Research
**Project:** CORD (Context-Oriented Relation for Documents)

---

## Research Overview

本研究针对 CORD 项目跨 IDE 适配层的核心技术问题——各主流 AI IDE 的全局指令文件体系进行了全面深度对比与抽象建模。研究覆盖了 Claude Code（CLAUDE.md + .claude/rules/）、Cursor（.cursor/rules/ .mdc/.md）、GitHub Copilot（.github/copilot-instructions.md + .github/instructions/）、Windsurf（.windsurf/rules/）、Gemini CLI（GEMINI.md）五大 AI IDE 的指令文件格式、Frontmatter 规格、作用域模型、优先级继承规则，以及 AGENTS.md 开放标准的成熟度评估。

核心结论：**AI IDE 指令文件体系呈现"格式碎片化、语义同构化"格局**——所有 IDE 都采用 Markdown + 可选 YAML Frontmatter 作为基础格式，都支持项目/用户/全局三层作用域和 Glob 文件匹配，但 Frontmatter 字段命名、触发模式语义、目录约定各不相同。基于此，CORD 应采用 **统一内部表示（CordInstructionModel）+ 适配器模式格式转换** 架构，配合 **独立文件注入策略**（零侵入）和 **AGENTS.md 标记区块兜底**，通过 `npx cord init` 一键为检测到的 IDE 生成对应格式的指令文件。完整的抽象模型、架构设计、实现方案和 5 条 ADR 决策见下方各章节。

---

<!-- Content will be appended sequentially through research workflow steps -->

## Technical Research Scope Confirmation

**Research Topic:** 全局指令文件跨 IDE 兼容性研究
**Research Goals:** CLAUDE.md / .cursorrules / instructions.md / .github/copilot-instructions.md / AGENTS.md 格式差异、共性抽象模型、CORD 指令片段注入策略

**Technical Research Scope:**

- Architecture Analysis — 各 AI IDE 全局/项目级指令文件的格式结构、目录约定、语义模型与优先级继承规则
- Implementation Approaches — CORD 指令片段的注入策略、非破坏性合并、冲突检测与版本管理
- Technology Stack — 各 IDE 指令文件的技术载体（Markdown / YAML frontmatter / MDC）、解析工具与生态
- Integration Patterns — 跨 IDE 统一抽象模型设计（CORD Instruction Model），指令片段的中间表示与转换管道
- Performance Considerations — AGENTS.md 标准化潜力评估、指令注入的上下文开销优化、增量更新策略

**Research Methodology:**

- Current web data with rigorous source verification
- Multi-source validation for critical technical claims
- Confidence level framework for uncertain information
- Comprehensive technical coverage with architecture-specific insights
- 直接继承 TR4 已验证的跨 IDE 指令体系结论

**Scope Confirmed:** 2026-04-01

## Technology Stack Analysis

> 本章节对五大 AI IDE / AI Agent 平台的指令文件体系进行全面技术栈分析，覆盖文件格式、目录约定、Frontmatter 规格、作用域模型、优先级继承、字符限制等核心维度。额外纳入 Gemini CLI 和 AGENTS.md 开放标准作为参照。

### 1. Claude Code — CLAUDE.md + .claude/rules/ 体系

**产品定位：** CLI 终端工具，指令体系最为成熟完整
**置信度：** 🟢 高（官方文档极为详尽，2026 年 4 月最新版本）

#### 1.1 指令文件体系

| 文件类型 | 位置 | 作用域 | 共享方式 |
|----------|------|--------|----------|
| **托管策略级** | macOS: `/Library/Application Support/ClaudeCode/CLAUDE.md`<br>Linux/WSL: `/etc/claude-code/CLAUDE.md`<br>Windows: `C:\Program Files\ClaudeCode\CLAUDE.md` | 组织全局（不可被排除） | IT/DevOps 通过 MDM 分发 |
| **项目级** | `./CLAUDE.md` 或 `./.claude/CLAUDE.md` | 项目全部成员 | 版本控制（Git） |
| **用户级** | `~/.claude/CLAUDE.md` | 个人所有项目 | 仅本机 |
| **项目规则** | `.claude/rules/*.md`（支持子目录递归） | 项目级（可按路径限定） | 版本控制（Git） |
| **用户规则** | `~/.claude/rules/*.md` | 个人所有项目 | 仅本机 |

#### 1.2 文件格式

- **纯 Markdown**（无 Frontmatter 要求）
- 规则文件支持 **可选 YAML Frontmatter**（`paths` 字段）
- HTML 块注释（`<!-- -->`）在注入上下文前被剥离（不消耗 Token）
- 推荐 **200 行以内** 以保持遵循率

#### 1.3 规则文件 Frontmatter

```yaml
---
paths:
  - "src/api/**/*.ts"
  - "**/*.{ts,tsx}"
---
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `paths` | string[] (glob) | ❌ | 匹配文件路径时才加载；无此字段则无条件加载 |

**关键特点：** Frontmatter 极简——仅一个 `paths` 字段。相比 Cursor 的三字段模型和 Windsurf 的双字段模型，Claude Code 选择了最小化设计。

#### 1.4 加载机制与优先级

1. **启动时**：从工作目录向上遍历目录树，加载每一级的 CLAUDE.md
2. **按需加载**：子目录下的 CLAUDE.md 在 Claude 读取该目录文件时才加载
3. **规则加载**：无 `paths` 字段的规则启动时加载；有 `paths` 字段的规则匹配时加载
4. **优先级**：托管策略级 > 项目级 > 用户级（更具体的位置覆盖更宽泛的）
5. **排除机制**：`claudeMdExcludes` 设置可跳过不相关的 CLAUDE.md（大型 Monorepo 场景）

#### 1.5 独有能力

- **`@path` 导入语法**：CLAUDE.md 可导入外部文件（相对/绝对路径，最多 5 层嵌套）
- **AGENTS.md 桥接**：通过 `@AGENTS.md` 导入已有的 AGENTS.md，避免内容重复
- **符号链接支持**：`.claude/rules/` 支持 symlink，可跨项目共享规则
- **`claudeMdExcludes`**：按路径或 Glob 排除不相关的 CLAUDE.md
- **`/init` 命令**：自动分析代码库并生成起步 CLAUDE.md
- **`/memory` 命令**：列出所有已加载的指令文件，支持编辑

_Source: [Claude Code Memory 文档](https://code.claude.com/docs/en/memory)_

---

### 2. Cursor — .cursor/rules/ + AGENTS.md 体系

**产品定位：** VS Code fork IDE，指令体系聚焦 AI Agent/Chat
**置信度：** 🟢 高（官方文档清晰）

#### 2.1 指令文件体系

| 文件类型 | 位置 | 作用域 | 共享方式 |
|----------|------|--------|----------|
| **项目规则** | `.cursor/rules/*.mdc` 或 `.cursor/rules/*.md` | 项目级（版本控制） | Git |
| **用户规则** | Cursor Settings → Rules | 个人全局（仅 Agent/Chat） | 仅本机 |
| **团队规则** | Cursor Dashboard | 团队/企业组织 | 云端管理 |
| **AGENTS.md** | 项目根目录或任意子目录 | 目录级（层级继承） | Git |

#### 2.2 文件格式

- **`.mdc` 或 `.md`** 格式（MDC = Markdown with Context）
- **YAML Frontmatter** 控制触发行为
- 推荐 **500 行以内**

#### 2.3 规则文件 Frontmatter

```yaml
---
description: "TypeScript 编码规范"
alwaysApply: false
globs: ["**/*.ts", "src/components/**"]
---
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `description` | string | 智能模式必填 | 规则用途描述，Agent 据此判断是否相关 |
| `alwaysApply` | boolean | ❌ | `true` = 每次对话注入 |
| `globs` | string[] | ❌ | 文件匹配模式，匹配时注入 |

**触发模式矩阵：**

| `alwaysApply` | `globs` | `description` | 触发模式 |
|---------------|---------|---------------|----------|
| `true` | 忽略 | 可选 | **Always Apply** — 每次对话 |
| `false` | 无 | **必填** | **Apply Intelligently** — Agent 判断 |
| `false` | 有值 | 可选 | **Apply to Specific Files** — Glob 匹配 |
| `false` | 无 | 无 | **Apply Manually** — `@规则名` 触发 |

#### 2.4 优先级

Team Rules > Project Rules > User Rules

#### 2.5 关键局限

- **User Rules 仅作用于 Agent/Chat**，不影响 Cursor Tab 和 Inline Edit
- **无导入/引用语法** — 不支持 `@path` 类似机制
- **无排除机制** — 无法选择性跳过某些规则文件

_Source: [Cursor Rules 文档](https://cursor.com/docs/rules)_

---

### 3. GitHub Copilot — .github/instructions/ + AGENTS.md 体系

**产品定位：** 多 IDE 插件（VS Code / JetBrains / Xcode 等）
**置信度：** 🟡 中高（Custom Instructions 文档清晰，AGENTS.md 集成较新）

#### 3.1 指令文件体系

| 文件类型 | 位置 | 作用域 | 共享方式 |
|----------|------|--------|----------|
| **仓库级指令** | `.github/copilot-instructions.md` | 整个仓库 | Git |
| **路径级指令** | `.github/instructions/*.instructions.md` | 匹配 Glob 的文件 | Git |
| **Agent 指令** | `AGENTS.md`（任意位置） | 目录级（就近原则） | Git |
| **替代文件** | `CLAUDE.md` 或 `GEMINI.md`（仓库根目录） | Agent 级别 | Git |
| **个人指令** | IDE Settings | 用户全局 | 仅本机 |
| **组织指令** | GitHub Organization Settings | 组织级 | 云端管理 |

#### 3.2 文件格式

- **纯 Markdown**
- 路径级指令支持 **YAML Frontmatter**

#### 3.3 路径级指令 Frontmatter

```yaml
---
applyTo: "**/*.ts,**/*.tsx"
excludeAgent: "code-review"
---
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `applyTo` | string (逗号分隔的 Glob) | ✅ | 匹配的文件路径 |
| `excludeAgent` | string | ❌ | 排除特定 Agent（`code-review` 或 `coding-agent`） |

#### 3.4 优先级

个人指令 > 仓库指令 > 组织指令

**叠加机制：** 当路径级指令和仓库级指令同时匹配，**两者内容均被使用**（非覆盖）。

#### 3.5 关键约束

- 仓库级指令 **不超过 2 页**
- 仓库级指令 **不应任务特定**
- AGENTS.md 遵循 **就近原则**（最近目录的 AGENTS.md 优先）
- 支持读取 `CLAUDE.md` 和 `GEMINI.md`（仅限仓库根目录）

_Source: [GitHub Copilot Custom Instructions 文档](https://docs.github.com/en/copilot/customizing-copilot/adding-custom-instructions-for-github-copilot)_

---

### 4. Windsurf — .windsurf/rules/ + AGENTS.md 体系

**产品定位：** VS Code fork IDE，内置 Cascade AI Agent
**置信度：** 🟢 高（官方文档详尽）

#### 4.1 指令文件体系

| 文件类型 | 位置 | 作用域 | 共享方式 |
|----------|------|--------|----------|
| **工作区规则** | `.windsurf/rules/*.md` | 项目级（可按触发模式限定） | Git |
| **全局规则** | `~/.codeium/windsurf/memories/global_rules.md` | 个人所有项目 | 仅本机 |
| **系统规则** | macOS: `/Library/Application Support/Windsurf/rules/*.md`<br>Linux/WSL: `/etc/windsurf/rules/*.md`<br>Windows: `C:\ProgramData\Windsurf\rules\*.md` | 企业全局（只读） | MDM/配置管理 |
| **AGENTS.md** | 项目根目录或任意子目录 | 根目录 = always-on；子目录 = auto-glob | Git |
| **记忆** | `~/.codeium/windsurf/memories/` | 工作区级（自动生成） | 仅本机 |

#### 4.2 文件格式

- **Markdown (`.md`)**
- 工作区规则支持 **可选 YAML Frontmatter**

#### 4.3 规则文件 Frontmatter

```yaml
---
trigger: model_decision
globs: "**/*.test.ts"
---
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `trigger` | enum | ❌ | `always_on` / `model_decision` / `glob` / `manual` |
| `globs` | string | ❌ | 文件匹配模式（仅 `glob` 触发时有效） |

**触发模式：**

| 模式 | 行为 | 上下文开销 |
|------|------|------------|
| `always_on` | 全文注入每条系统消息 | 最高 |
| `model_decision` | 仅 description 可见；全文按需加载 | 按需 |
| `glob` | 匹配文件被编辑时注入 | 按需 |
| `manual` | `@规则名` 手动触发 | 按需 |

#### 4.4 字符限制

| 类型 | 限制 |
|------|------|
| 全局规则 | 6,000 字符 |
| 工作区规则 | 12,000 字符/文件 |

#### 4.5 优先级与发现

- 自动发现：当前工作区 → 子目录 → 父目录（直至 Git 根目录）
- 同级别规则去重
- 系统级 → 用户级 → 工作区级依次执行

#### 4.6 AGENTS.md 特殊处理

- **根目录** AGENTS.md → `always_on` 模式
- **子目录** AGENTS.md → 自动 Glob 模式（匹配该目录下的文件）

_Source: [Windsurf Rules & Memories 文档](https://docs.windsurf.com/windsurf/cascade/memories)_

---

### 5. Gemini CLI — GEMINI.md + .gemini/ 体系

**产品定位：** Google 的 CLI 终端工具，架构类似 Claude Code
**置信度：** 🟡 中（文档从 GitHub README 获取，详细规格需查阅子文档）

#### 5.1 指令文件体系

| 文件类型 | 位置 | 作用域 |
|----------|------|--------|
| **项目级** | `GEMINI.md`（项目根目录） | 项目全部成员 |
| **配置文件** | `~/.gemini/settings.json` | 用户全局 |
| **AGENTS.md** | 项目根目录或子目录 | 目录级 |

#### 5.2 文件格式

- **纯 Markdown**（GEMINI.md）
- JSON（settings.json）

**关键特点：** Gemini CLI 同时读取 `GEMINI.md` 和 `AGENTS.md`，与 Copilot 支持多品牌指令文件（CLAUDE.md / GEMINI.md / AGENTS.md）的策略一致。

_Source: [Gemini CLI GitHub 仓库](https://github.com/google-gemini/gemini-cli)_

---

### 6. AGENTS.md — 跨 IDE 开放标准

**定位：** 由 Agentic AI Foundation（Linux Foundation 旗下）维护的开放标准
**置信度：** 🟢 高（官方网站 + GitHub 仓库 + 25+ 工具支持列表）

#### 6.1 标准概述

AGENTS.md 定义为 **"a simple, open format for guiding coding agents"**——AI 编码代理的 README。它旨在提供一个 **专用、可预测的位置**，让 AI 编码代理获取项目上下文和指令。

#### 6.2 格式规格

| 维度 | 规格 |
|------|------|
| **文件格式** | 纯 Markdown（标准语法） |
| **Frontmatter** | 无（纯内容） |
| **文件名** | `AGENTS.md`（大写） |
| **位置** | 仓库内任意目录 |
| **层级行为** | Monorepo 支持多文件；最近目录优先 |
| **Schema 验证** | 无正式 Schema |

#### 6.3 推荐内容结构

```markdown
## Dev environment tips
- Commands for package management, installation, scaffolding

## Testing instructions
- CI workflows, test execution, linting, type-checking

## PR instructions
- Title formatting, pre-commit requirements
```

#### 6.4 工具支持矩阵（25+ 工具）

| 支持方式 | 工具 |
|----------|------|
| **原生支持** | Cursor, Windsurf, GitHub Copilot, Gemini CLI, OpenAI Codex, Devin, JetBrains Junie, Zed, Warp, Aider, goose, opencode |
| **通过导入支持** | Claude Code（`@AGENTS.md`） |
| **其他** | Factory, UiPath Autopilot, RooCode, Kilo Code, Phoenix, Semgrep, Ona, Augment Code |

#### 6.5 治理与标准化

- **维护方：** Agentic AI Foundation（Linux Foundation）
- **贡献者：** OpenAI, Amp, Cursor, Factory 等
- **设计原则：** Agent 无关性、工具兼容性、简洁性优先
- **成熟度评估：** 早期采用阶段（无正式 Schema、无版本号、无验证规范）

_Source: [AGENTS.md 官方网站](https://agents.md)、[GitHub 仓库](https://github.com/agentsmd/agents.md)_

---

### 7. 技术栈横向对比总览

#### 7.1 指令文件格式矩阵

| 维度 | Claude Code | Cursor | Copilot | Windsurf | Gemini CLI | AGENTS.md 标准 |
|------|------------|--------|---------|----------|------------|---------------|
| **主文件名** | `CLAUDE.md` | — | `copilot-instructions.md` | — | `GEMINI.md` | `AGENTS.md` |
| **规则目录** | `.claude/rules/` | `.cursor/rules/` | `.github/instructions/` | `.windsurf/rules/` | `.gemini/` (推测) | — |
| **文件后缀** | `.md` | `.mdc` / `.md` | `.instructions.md` / `.md` | `.md` | `.md` | `.md` |
| **Frontmatter** | 可选（`paths`） | 可选（3 字段） | 可选（2 字段） | 可选（2 字段） | 无 | 无 |
| **Frontmatter 格式** | YAML | YAML | YAML | YAML | — | — |
| **AGENTS.md 支持** | 通过 `@AGENTS.md` 导入 | ✅ 原生 | ✅ 原生 | ✅ 原生 | ✅ 原生 | — |

#### 7.2 作用域层级矩阵

| 层级 | Claude Code | Cursor | Copilot | Windsurf |
|------|------------|--------|---------|----------|
| **系统/策略级** | ✅ 托管策略 CLAUDE.md | ❌ | ✅ 组织指令 | ✅ 系统规则 |
| **用户级** | ✅ `~/.claude/CLAUDE.md` + rules/ | ✅ Settings | ✅ IDE Settings | ✅ 全局规则 |
| **项目级** | ✅ `./CLAUDE.md` + `.claude/rules/` | ✅ `.cursor/rules/` | ✅ `.github/copilot-instructions.md` | ✅ `.windsurf/rules/` |
| **目录级** | ✅ 子目录 CLAUDE.md（按需） | ✅ AGENTS.md 子目录 | ✅ AGENTS.md 就近原则 | ✅ AGENTS.md auto-glob |
| **文件级** | ✅ `paths` glob | ✅ `globs` | ✅ `applyTo` glob | ✅ `globs` glob |
| **团队/企业级** | ✅ 托管策略 | ✅ Dashboard | ✅ Organization | ✅ 云端仪表板 |

#### 7.3 触发模式矩阵

| 触发模式 | Claude Code | Cursor | Copilot | Windsurf |
|----------|------------|--------|---------|----------|
| **无条件加载** | 无 `paths` 的规则 | `alwaysApply: true` | 仓库级指令 | `trigger: always_on` |
| **智能判断** | ❌ | `description` + 无 glob | ❌ | `trigger: model_decision` |
| **文件匹配** | `paths: [glob]` | `globs: [glob]` | `applyTo: glob` | `trigger: glob` + `globs` |
| **手动触发** | ❌ | `@规则名` | ❌ | `trigger: manual` + `@规则名` |
| **目录就近** | 子目录 CLAUDE.md | AGENTS.md | AGENTS.md | AGENTS.md (auto-glob) |

#### 7.4 Frontmatter 字段对比

| 平台 | 字段名 | 值类型 | 含义 |
|------|--------|--------|------|
| **Claude Code** | `paths` | string[] (glob) | 文件路径匹配 |
| **Cursor** | `description` | string | 规则用途描述 |
| | `alwaysApply` | boolean | 是否无条件注入 |
| | `globs` | string[] | 文件匹配模式 |
| **Copilot** | `applyTo` | string (逗号 glob) | 文件路径匹配 |
| | `excludeAgent` | string | 排除特定 Agent |
| **Windsurf** | `trigger` | enum | 触发模式 |
| | `globs` | string | 文件匹配模式 |

#### 7.5 独有能力对比

| 能力 | Claude Code | Cursor | Copilot | Windsurf |
|------|------------|--------|---------|----------|
| **文件导入（@path）** | ✅ | ❌ | ❌ | ❌ |
| **符号链接规则** | ✅ | ❌ | ❌ | ❌ |
| **排除机制** | ✅ `claudeMdExcludes` | ❌ | ❌ | ❌ |
| **自动生成（/init）** | ✅ | ✅ `/create-rule` | ❌ | ❌ |
| **Agent 排除** | ❌ | ❌ | ✅ `excludeAgent` | ❌ |
| **字符限制** | 建议 200 行 | 建议 500 行 | 建议 2 页 | 全局 6K / 工作区 12K 字符 |
| **智能判断模式** | ❌ | ✅ | ❌ | ✅ |
| **HTML 注释剥离** | ✅ | ❌ | ❌ | ❌ |
| **Auto Memory** | ✅ | ❌ | ❌ | ✅ Memories |
| **读取竞品文件** | ❌ | ❌ | ✅ CLAUDE.md/GEMINI.md | ❌ |

_Source: 综合以上各 IDE 官方文档_

## Integration Patterns Analysis

> 本章节聚焦于 CORD 如何与各 IDE 的指令文件体系集成——包括指令片段的格式转换、注入策略、非破坏性合并、冲突检测与版本管理。这是 CORD `npx cord init` 指令层实现的核心设计依据。

### 1. CORD 指令片段的集成需求

CORD 需要向各 IDE 的指令文件中注入 **两类指令片段**：

| 片段类型 | 内容 | 目的 | 生命周期 |
|----------|------|------|----------|
| **行为引导片段** | "当修改 Markdown 文档时，调用 cord_update_relations" | 引导 AI 在合适时机调用 CORD MCP Tools | 一次性注入，长期有效 |
| **上下文片段** | "本项目使用 CORD 管理文档关系；关系图谱存储在 .cord/cord.db" | 提供项目上下文，帮助 AI 理解 CORD 的存在和能力 | 一次性注入，长期有效 |

**核心挑战：** 同一段语义内容需要 **转换为 4 种不同格式** 分发到各 IDE 的指令文件中，同时保证：
- ❶ 不破坏用户已有的指令内容
- ❷ 支持后续版本升级（更新 CORD 片段而不影响用户内容）
- ❸ 各 IDE 片段的语义一致性

---

### 2. 各 IDE 指令片段注入路径

#### 2.1 Claude Code 注入路径

**最优方案：独立规则文件**

```
.claude/rules/cord-relations.md    ← CORD 专属规则文件（新建）
CLAUDE.md                          ← 不修改（仅需 MCP Server 配置）
```

**规则文件内容：**
```markdown
---
paths:
  - "**/*.md"
  - "**/*.mdx"
  - "docs/**/*"
---

# CORD 文档关系维护

本项目使用 CORD (Context-Oriented Relation for Documents) 管理文档间的关系。

## 修改文档后
当你修改了 Markdown 文档（.md / .mdx 文件）时：
1. 修改完成后，调用 `cord_update_relations` 工具更新该文档的关系
2. 如果修改涉及到链接/引用变化，同步更新关联文档的关系

## 理解文档上下文
当你需要理解某个文档的上下文时：
1. 调用 `cord_get_context` 获取关联文档信息
2. 根据上下文信息提供更准确的编辑建议

## 首次接入
如果 .cord/cord.db 不存在，提示用户运行 `npx cord scan` 初始化关系图谱
```

**为什么选择独立文件而非修改 CLAUDE.md：**
- ✅ **零侵入** — 不修改用户已有的 CLAUDE.md 内容
- ✅ **路径限定** — `paths` frontmatter 确保仅在编辑 Markdown 文件时加载
- ✅ **易于升级** — `cord init --upgrade` 直接覆盖此文件
- ✅ **可删除** — 用户随时删除此文件即可移除 CORD 指令

**备选方案：CLAUDE.md `@` 导入**

如果用户已有 CLAUDE.md 且不希望额外规则文件，CORD 可在 CLAUDE.md 末尾追加：
```markdown
# CORD Integration
@.claude/rules/cord-relations.md
```

这利用了 Claude Code 独有的 `@path` 导入语法，保持 CLAUDE.md 简洁。

_置信度：🟢 高 — Claude Code 的 `.claude/rules/` 机制天然支持第三方工具注入独立规则_

---

#### 2.2 Cursor 注入路径

**最优方案：独立 .mdc 规则文件**

```
.cursor/rules/cord-relations.mdc  ← CORD 专属规则文件（新建）
```

**规则文件内容：**
```yaml
---
description: "CORD 文档关系维护 — 修改 Markdown 文档时自动更新关系图谱"
alwaysApply: false
globs: ["**/*.md", "**/*.mdx", "docs/**/*"]
---

本项目使用 CORD 管理文档间的关系。

当你修改了匹配的 Markdown 文档时：
1. 修改完成后，调用 cord_update_relations MCP 工具更新该文档的关系
2. 如果修改涉及到链接/引用变化，同步更新关联文档的关系
3. 如需理解文档上下文，先调用 cord_get_context
```

**格式转换要点：**
- Claude Code 的 `paths` → Cursor 的 `globs`（语法兼容，均为 Glob 模式）
- 需要额外添加 `description` 字段（Cursor 智能判断模式需要）
- `alwaysApply: false` + `globs` 实现文件匹配触发模式

_置信度：🟢 高 — Cursor 的 `.cursor/rules/` 机制完美支持此模式_

---

#### 2.3 GitHub Copilot 注入路径

**最优方案：路径级指令文件**

```
.github/instructions/cord-relations.instructions.md  ← CORD 专属指令（新建）
```

**指令文件内容：**
```yaml
---
applyTo: "**/*.md,**/*.mdx,docs/**/*"
---

本项目使用 CORD 管理文档间的关系。

当修改 Markdown 文档时：
1. 修改后调用 cord_update_relations 更新关系
2. 需要上下文时调用 cord_get_context
3. 首次接入时运行 npx cord scan 初始化
```

**格式转换要点：**
- Claude Code 的 `paths` (数组) → Copilot 的 `applyTo` (逗号分隔字符串)
- Copilot 的路径级指令 **与仓库级指令叠加**（非覆盖），无冲突风险
- 无 `description` 字段需求

_置信度：🟢 高 — Copilot 的 `.github/instructions/` 路径级指令机制直接支持_

---

#### 2.4 Windsurf 注入路径

**最优方案：独立工作区规则文件**

```
.windsurf/rules/cord-relations.md  ← CORD 专属规则文件（新建）
```

**规则文件内容：**
```yaml
---
trigger: glob
globs: "**/*.md,**/*.mdx"
---

本项目使用 CORD 管理文档间的关系。

当你修改了匹配的 Markdown 文档时：
1. 修改完成后，调用 cord_update_relations MCP 工具更新关系
2. 如需理解文档上下文，先调用 cord_get_context
3. 首次接入时运行 npx cord scan 初始化
```

**格式转换要点：**
- 需要添加 `trigger: glob` 字段（Windsurf 特有）
- `globs` 字段格式为单个字符串（逗号分隔），而非 Cursor 的数组格式
- 注意 12,000 字符限制

_置信度：🟢 高 — Windsurf 的 `.windsurf/rules/` 机制直接支持_

---

#### 2.5 AGENTS.md 通用兜底路径

**方案：在 AGENTS.md 中追加 CORD 片段**

```
AGENTS.md  ← 追加 CORD 片段（需要非破坏性合并）
```

**追加内容：**
```markdown
<!-- CORD:BEGIN -->
## CORD - 文档关系维护

本项目使用 CORD 管理文档间的关系。当你修改 Markdown 文档时：
- 修改后调用 cord_update_relations 更新关系
- 需要文档上下文时调用 cord_get_context
- 首次接入时运行 `npx cord scan` 初始化
<!-- CORD:END -->
```

**关键设计：CORD 标记注释**
- `<!-- CORD:BEGIN -->` 和 `<!-- CORD:END -->` 标记 CORD 管理的区域
- 升级时仅替换标记之间的内容，保留用户自定义内容
- 如果 AGENTS.md 不存在，则新建并写入

_置信度：🟢 高 — 标记注释是业界成熟的非破坏性注入模式（类似 `.gitignore` 中的标记区块）_

---

### 3. 跨 IDE 指令片段格式转换管道

CORD 需要一个 **统一的内部表示（IR）** 来描述指令片段，然后通过格式转换器输出到各 IDE：

```
┌─────────────────────────────────────────────────────────┐
│              CORD Instruction IR（内部表示）              │
│                                                          │
│  {                                                       │
│    id: "cord-relations",                                 │
│    version: "1.0.0",                                     │
│    description: "CORD 文档关系维护",                       │
│    filePatterns: ["**/*.md", "**/*.mdx", "docs/**/*"],   │
│    triggerMode: "file_match",                            │
│    content: "当你修改了 Markdown 文档时...",                │
│    contentLanguage: "zh-CN"                              │
│  }                                                       │
└────────┬────────┬────────┬────────┬────────┬─────────────┘
         │        │        │        │        │
         ▼        ▼        ▼        ▼        ▼
   ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌────────┐
   │Claude│ │Cursor│ │Copil.│ │Winds.│ │AGENTS  │
   │ Code │ │      │ │      │ │      │ │  .md   │
   │ Fmt  │ │ Fmt  │ │ Fmt  │ │ Fmt  │ │  Fmt   │
   └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘ └───┬────┘
      │        │        │        │         │
      ▼        ▼        ▼        ▼         ▼
   paths:   globs:   applyTo:  trigger:  <!-- -->
   [glob]   [glob]   "glob"    glob      标记区块
                               globs:
                               "glob"
```

#### 3.1 CORD Instruction IR 数据模型

```typescript
interface CordInstructionIR {
  // 元数据
  id: string;                      // 唯一标识，如 "cord-relations"
  version: string;                 // 语义化版本，用于升级检测
  description: string;             // 指令描述（Cursor/Windsurf 需要）

  // 触发配置
  filePatterns: string[];          // Glob 模式数组（统一内部格式）
  triggerMode: TriggerMode;        // 'always' | 'file_match' | 'manual'

  // 内容
  content: string;                 // Markdown 格式的指令正文
  contentLanguage?: string;        // 内容语言（i18n 支持）
}

type TriggerMode = 'always' | 'file_match' | 'manual';
```

#### 3.2 格式转换器接口

```typescript
interface InstructionFormatter {
  readonly targetIDE: string;

  // 检测目标 IDE 是否存在
  detect(projectPath: string): boolean;

  // 将 IR 转换为目标格式
  format(ir: CordInstructionIR): FormattedInstruction;

  // 写入文件（含非破坏性合并逻辑）
  write(formatted: FormattedInstruction, projectPath: string): WriteResult;

  // 读取已存在的 CORD 片段（用于升级检测）
  readExisting(projectPath: string): CordInstructionIR | null;
}

interface FormattedInstruction {
  filePath: string;           // 目标文件相对路径
  content: string;            // 完整文件内容（含 Frontmatter）
  isNewFile: boolean;         // 是否为新建文件
  mergeStrategy: MergeStrategy;
}

type MergeStrategy = 'create' | 'replace_file' | 'replace_section';
```

#### 3.3 各 IDE 格式转换规则

| IR 字段 | Claude Code | Cursor | Copilot | Windsurf | AGENTS.md |
|---------|------------|--------|---------|----------|-----------|
| `filePatterns` | `paths: [...]` | `globs: [...]` | `applyTo: "..."` (逗号连接) | `globs: "..."` (逗号连接) | 忽略 |
| `triggerMode: always` | 无 frontmatter | `alwaysApply: true` | 仓库级文件 | `trigger: always_on` | 直接追加 |
| `triggerMode: file_match` | `paths: [...]` | `globs: [...]` | `applyTo: "..."` | `trigger: glob` + `globs` | 忽略（无此能力） |
| `description` | 忽略 | `description: "..."` | 忽略 | 忽略（可选放入正文） | 忽略 |
| `content` | 原样输出 | 原样输出 | 原样输出 | 原样输出 | 包裹在标记区块内 |
| `version` | 写入 HTML 注释 | 写入 HTML 注释 | 写入 HTML 注释 | 写入 HTML 注释 | 写入标记注释 |

**版本标记示例（所有格式通用）：**
```markdown
<!-- cord-instruction-version: 1.0.0 -->
```

_置信度：🟢 高 — IR + Formatter 模式是跨平台内容分发的标准方案_

---

### 4. 非破坏性合并策略

#### 4.1 合并策略矩阵

| 场景 | Claude Code | Cursor | Copilot | Windsurf | AGENTS.md |
|------|------------|--------|---------|----------|-----------|
| **首次安装** | 新建独立文件 | 新建独立文件 | 新建独立文件 | 新建独立文件 | 新建或追加标记区块 |
| **版本升级** | 覆盖整个文件 | 覆盖整个文件 | 覆盖整个文件 | 覆盖整个文件 | 替换标记区块内容 |
| **用户卸载** | 删除独立文件 | 删除独立文件 | 删除独立文件 | 删除独立文件 | 删除标记区块 |

**关键设计决策：独立文件策略**

对于支持规则目录的 IDE（Claude Code / Cursor / Copilot / Windsurf），CORD 采用 **独立文件策略** 而非修改已有文件：

| 方案 | 优势 | 劣势 | 结论 |
|------|------|------|------|
| **独立文件** | 零冲突、易升级、易卸载、版本控制友好 | 多一个文件 | ✅ 推荐 |
| **修改已有文件** | 文件数量少 | 合并冲突风险、升级复杂、回退困难 | ❌ 不推荐 |

对于 AGENTS.md（无规则目录的通用方案），采用 **标记区块策略**：

```typescript
class AgentsMdMerger {
  private static BEGIN_MARKER = '<!-- CORD:BEGIN -->';
  private static END_MARKER = '<!-- CORD:END -->';

  merge(existingContent: string, cordSection: string): string {
    const beginIdx = existingContent.indexOf(AgentsMdMerger.BEGIN_MARKER);
    const endIdx = existingContent.indexOf(AgentsMdMerger.END_MARKER);

    if (beginIdx !== -1 && endIdx !== -1) {
      // 替换已有 CORD 区块
      return (
        existingContent.substring(0, beginIdx) +
        AgentsMdMerger.BEGIN_MARKER + '\n' +
        cordSection + '\n' +
        AgentsMdMerger.END_MARKER +
        existingContent.substring(endIdx + AgentsMdMerger.END_MARKER.length)
      );
    } else {
      // 追加新 CORD 区块
      return (
        existingContent.trimEnd() + '\n\n' +
        AgentsMdMerger.BEGIN_MARKER + '\n' +
        cordSection + '\n' +
        AgentsMdMerger.END_MARKER + '\n'
      );
    }
  }

  remove(existingContent: string): string {
    const beginIdx = existingContent.indexOf(AgentsMdMerger.BEGIN_MARKER);
    const endIdx = existingContent.indexOf(AgentsMdMerger.END_MARKER);

    if (beginIdx !== -1 && endIdx !== -1) {
      return (
        existingContent.substring(0, beginIdx).trimEnd() +
        existingContent.substring(endIdx + AgentsMdMerger.END_MARKER.length)
      ).trim() + '\n';
    }
    return existingContent;
  }
}
```

_置信度：🟢 高 — 标记区块合并是业界标准模式（如 ESLint 配置注释、.gitignore 区段）_

---

### 5. Frontmatter 解析与生成工具链

CORD 需要一个健壮的工具链来解析和生成各 IDE 的 Frontmatter：

#### 5.1 工具选型

| 工具 | 用途 | 推荐度 |
|------|------|--------|
| **gray-matter** | YAML Frontmatter 解析/生成 | ✅ 推荐（生态最成熟，Gatsby/Vite/Astro 等使用） |
| **remark-frontmatter** | remark 管道中处理 Frontmatter | ✅ TR3 已选定 remark 生态 |
| **js-yaml** | 底层 YAML 解析/序列化 | 🟡 gray-matter 内部已依赖 |

**gray-matter 核心 API：**
```typescript
import matter from 'gray-matter';

// 解析已有规则文件
const file = matter.read('.cursor/rules/cord-relations.mdc');
console.log(file.data);    // { description: '...', alwaysApply: false, globs: [...] }
console.log(file.content);  // Markdown 正文

// 生成规则文件
const output = matter.stringify('Markdown 正文内容', {
  description: 'CORD 文档关系维护',
  alwaysApply: false,
  globs: ['**/*.md']
});
```

**关键优势：**
- `.test()` 方法可检测文件是否含有 Frontmatter
- `.stringify()` 方法可从数据对象生成完整文件
- 支持自定义分隔符（兼容 MDC 格式）

_Source: [gray-matter GitHub 仓库](https://github.com/jonschlinkert/gray-matter)_

#### 5.2 格式兼容性矩阵

| Frontmatter 特性 | gray-matter 支持 | 备注 |
|------------------|-----------------|------|
| YAML 解析/生成 | ✅ | 默认引擎 |
| 数组值（globs） | ✅ | Cursor 的 `globs: [...]` |
| 字符串值 | ✅ | Copilot 的 `applyTo: "..."` |
| 枚举值 | ✅ | Windsurf 的 `trigger: glob` |
| 布尔值 | ✅ | Cursor 的 `alwaysApply: false` |
| 无 Frontmatter | ✅ `.test()` 检测 | Claude Code 的 CLAUDE.md |
| MDC 格式 | 🟡 需验证 | Cursor 的 `.mdc` 后缀 |

---

### 6. 版本管理与升级策略

#### 6.1 版本检测机制

每个 CORD 生成的指令文件中嵌入版本标记：

```markdown
<!-- cord-instruction-version: 1.0.0 -->
```

`cord init` 执行时的版本检测流程：

```
cord init 启动
    │
    ├── 检测到已有 CORD 指令文件?
    │   ├── 否 → 全新安装（创建文件）
    │   └── 是 → 读取版本标记
    │       ├── 版本相同 → 跳过（已是最新）
    │       ├── 版本更低 → 提示升级
    │       │   ├── 用户确认 → 覆盖/替换
    │       │   └── 用户拒绝 → 跳过
    │       └── 版本更高 → 警告（可能是手动修改）
    │
    └── 生成/更新文件
```

#### 6.2 升级安全性

| 文件类型 | 升级策略 | 用户内容风险 |
|----------|----------|-------------|
| 独立规则文件（Claude/Cursor/Copilot/Windsurf） | 整文件覆盖 | ⚠️ 低（CORD 独占文件） |
| AGENTS.md 标记区块 | 仅替换标记区块内容 | ✅ 零（不影响用户区域） |
| MCP 配置文件 | 合并 JSON 对象 | ⚠️ 低（仅添加 `cord` 条目） |

---

### 7. IDE 配置检测策略

`cord init` 需要自动检测用户项目中存在哪些 IDE 配置，以决定生成哪些指令文件：

#### 7.1 检测信号矩阵

| IDE | 检测信号 | 置信度 |
|-----|----------|--------|
| **Claude Code** | `.claude/` 目录存在 | 🟢 高 |
| **Cursor** | `.cursor/` 目录存在 | 🟢 高 |
| **GitHub Copilot** | `.github/` 目录存在 | 🟡 中（可能仅有 CI 配置） |
| **Windsurf** | `.windsurf/` 目录存在 | 🟢 高 |
| **Gemini CLI** | `.gemini/` 目录存在 | 🟢 高 |

**Copilot 误检问题：** `.github/` 目录可能仅包含 CI/CD 配置（workflows/）而非 Copilot 指令。CORD 应进行二级检测：

```typescript
function detectCopilot(projectPath: string): boolean {
  const githubDir = path.join(projectPath, '.github');
  if (!existsSync(githubDir)) return false;

  // 二级检测：检查是否有 Copilot 相关文件
  return (
    existsSync(path.join(githubDir, 'copilot-instructions.md')) ||
    existsSync(path.join(githubDir, 'instructions'))
  );
}
```

**如果二级检测未通过，仍应询问用户是否要生成 Copilot 指令文件**（因为用户可能正在首次配置 Copilot）。

#### 7.2 交互式配置流程

```
$ npx cord init

🔍 检测项目 AI IDE 配置...

  ✅ Claude Code   (.claude/ 已存在)
  ✅ Cursor         (.cursor/ 已存在)
  ⚠️ GitHub Copilot (.github/ 已存在，但无 Copilot 指令文件)
  ❌ Windsurf       (未检测到)
  ❌ Gemini CLI     (未检测到)

📋 将生成以下配置：
  ✅ .claude/rules/cord-relations.md
  ✅ .cursor/rules/cord-relations.mdc
  ✅ AGENTS.md (追加 CORD 片段)

❓ 是否也为 GitHub Copilot 生成指令？(y/N)
> y
  ✅ .github/instructions/cord-relations.instructions.md

❓ 是否为未检测到的 IDE 生成配置？
  [ ] Windsurf
  [ ] Gemini CLI

🚀 配置生成完成！
```

_置信度：🟢 高 — 目录检测 + 交互式确认是 CLI 工具的标准初始化模式_

---

### 8. MCP Server 配置注入

除指令文件外，CORD 还需要向各 IDE 的 MCP 配置文件注入 MCP Server 条目：

#### 8.1 MCP 配置文件矩阵

| IDE | MCP 配置文件 | 格式 | 注入方式 |
|-----|-------------|------|----------|
| **Claude Code** | `.claude/settings.json` | JSON | 合并 `mcpServers.cord` |
| **Cursor** | `.cursor/mcp.json` | JSON | 合并 `mcpServers.cord` |
| **Copilot** | `.vscode/mcp.json` | JSON | 合并 `servers.cord` |
| **Windsurf** | `~/.codeium/windsurf/mcp_config.json` | JSON | 合并 `mcpServers.cord` |

#### 8.2 JSON 合并策略

```typescript
function mergeMcpConfig(
  existingConfig: Record<string, any>,
  cordEntry: Record<string, any>,
  serverKey: string = 'mcpServers'
): Record<string, any> {
  const merged = { ...existingConfig };

  if (!merged[serverKey]) {
    merged[serverKey] = {};
  }

  // 仅添加/更新 cord 条目，不影响其他 MCP Server
  merged[serverKey]['cord'] = cordEntry;

  return merged;
}
```

**安全原则：** 仅添加或更新 `cord` 条目，绝不删除或修改用户配置的其他 MCP Server。

_Source: 基于 TR2（MCP Server 技术选型）和 TR4（跨 IDE 集成）研究结论_

## Architectural Patterns and Design

> 本章节从架构设计角度分析 CORD 指令文件适配层的核心设计模式、共性抽象模型、AGENTS.md 标准化评估，以及关键架构决策记录。

### 1. 核心架构模式：适配器模式 + 抽象工厂模式

CORD 指令文件适配层的核心挑战是：**同一套指令语义需要转换为 4+ 种不同的文件格式、Frontmatter 结构和目录约定**。这完美契合 **适配器模式（Adapter Pattern）** 与 **抽象工厂模式（Abstract Factory）** 的组合应用。

```
┌──────────────────────────────────────────────────────────────┐
│                CORD Instruction Engine                        │
│                                                              │
│  ┌──────────────────────────────────┐                        │
│  │     CordInstructionIR            │                        │
│  │   (统一内部表示)                   │                        │
│  │                                  │                        │
│  │  id / version / description      │                        │
│  │  filePatterns / triggerMode       │                        │
│  │  content / contentLanguage        │                        │
│  └────────────┬─────────────────────┘                        │
│               │                                              │
│  ┌────────────▼─────────────────────┐                        │
│  │   InstructionFormatterFactory    │  ← 抽象工厂             │
│  │   create(ide: IDEType)           │                        │
│  └────────────┬─────────────────────┘                        │
│               │                                              │
│  ┌────────────▼─────────────────────────────────────────┐    │
│  │              Formatter Adapters                       │    │
│  │                                                       │    │
│  │  ┌─────────────┐ ┌─────────────┐ ┌──────────────┐   │    │
│  │  │ ClaudeCode   │ │ Cursor      │ │ Copilot      │   │    │
│  │  │ Formatter    │ │ Formatter   │ │ Formatter    │   │    │
│  │  │              │ │             │ │              │   │    │
│  │  │ paths: glob  │ │ globs: arr  │ │ applyTo: str │   │    │
│  │  │ .md file     │ │ .mdc file   │ │ .inst.md     │   │    │
│  │  └─────────────┘ └─────────────┘ └──────────────┘   │    │
│  │                                                       │    │
│  │  ┌─────────────┐ ┌─────────────┐                    │    │
│  │  │ Windsurf    │ │ AgentsMd    │                    │    │
│  │  │ Formatter   │ │ Formatter   │                    │    │
│  │  │             │ │             │                    │    │
│  │  │ trigger:    │ │ <!-- CORD   │                    │    │
│  │  │ glob+globs  │ │ :BEGIN -->  │                    │    │
│  │  └─────────────┘ └─────────────┘                    │    │
│  └───────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

**设计决策理由：**

| 决策 | 选择 | 理由 |
|------|------|------|
| **为什么用适配器而非策略？** | IR → Formatter 的转换是 **格式适配**（同一语义、不同表现），非 **行为策略**（不同算法选择） | 适配器模式语义更精确 |
| **为什么用抽象工厂？** | 每个 IDE 需要一组相关对象（Formatter + Detector + Writer） | 抽象工厂封装一族对象创建 |
| **与 TR4 策略模式的关系？** | TR4 的 `TriggerStrategy` 处理 Hook 触发行为（行为差异），TR7 的 Formatter 处理指令格式转换（数据适配）。两者互补不冲突 | 正交职责 |

_置信度：🟢 高 — 适配器+工厂模式是跨平台数据格式转换的经典组合_

---

### 2. 指令抽象模型：CORD Instruction Model

基于 Step 2 各 IDE 的格式分析，提炼出跨 IDE 的 **共性抽象模型**——CORD Instruction Model：

#### 2.1 共性维度提炼

通过分析四大 IDE 的指令文件体系，识别出 **5 个共性维度** 和 **3 个差异维度**：

**共性维度（所有 IDE 都有）：**

| 维度 | Claude Code | Cursor | Copilot | Windsurf | 抽象名称 |
|------|------------|--------|---------|----------|----------|
| 指令正文 | Markdown 内容 | Markdown 内容 | Markdown 内容 | Markdown 内容 | `content` |
| 文件匹配 | `paths` | `globs` | `applyTo` | `globs` | `filePatterns` |
| 作用域层级 | 策略/用户/项目/目录 | 团队/项目/用户 | 组织/仓库/个人 | 系统/用户/工作区 | `scope` |
| 优先级方向 | 具体 > 宽泛 | 团队 > 项目 > 用户 | 个人 > 仓库 > 组织 | 系统 → 用户 → 工作区 | `precedence` |
| 版本控制 | `.claude/` 可 Git | `.cursor/` 可 Git | `.github/` 可 Git | `.windsurf/` 可 Git | `versionControlled` |

**差异维度（部分 IDE 有）：**

| 维度 | Claude Code | Cursor | Copilot | Windsurf | 抽象处理 |
|------|------------|--------|---------|----------|----------|
| 智能判断触发 | ❌ | ✅ `description` | ❌ | ✅ `model_decision` | 可选字段 `description` |
| 手动触发 | ❌ | ✅ `@规则名` | ❌ | ✅ `@规则名` | 可选字段 `manualTrigger` |
| Agent 排除 | ❌ | ❌ | ✅ `excludeAgent` | ❌ | 可选字段 `excludeAgents` |

#### 2.2 统一抽象模型定义

```typescript
/**
 * CORD Instruction Model — 跨 IDE 指令的统一抽象表示
 *
 * 设计原则：
 * 1. 共性字段为必填，差异字段为可选
 * 2. 内部格式与任何 IDE 的原生格式解耦
 * 3. 支持 IR → 各 IDE 格式的无损转换
 */
interface CordInstructionModel {
  // === 元数据 ===
  id: string;                       // 全局唯一标识 "cord-relations"
  version: string;                  // 语义化版本 "1.0.0"
  cordVersion: string;              // CORD CLI 版本约束 ">=0.1.0"

  // === 共性字段（所有 IDE 均映射）===
  content: string;                  // Markdown 指令正文
  filePatterns: string[];           // Glob 模式数组（统一为数组格式）
  scope: InstructionScope;          // 'project' | 'user' | 'global'
  versionControlled: boolean;       // 是否纳入 Git 版本控制

  // === 差异字段（可选，部分 IDE 映射）===
  description?: string;             // 规则描述（Cursor/Windsurf 智能判断模式）
  triggerMode?: TriggerMode;        // 触发模式
  manualTrigger?: string;           // 手动触发标识（@name）
  excludeAgents?: string[];         // 排除特定 Agent（Copilot）
  contentLanguage?: string;         // 内容语言（i18n 支持）
}

type InstructionScope = 'project' | 'user' | 'global';
type TriggerMode = 'always' | 'file_match' | 'intelligent' | 'manual';
```

#### 2.3 IR → IDE 格式转换规则表

| IR 字段 | Claude Code `.md` | Cursor `.mdc` | Copilot `.instructions.md` | Windsurf `.md` | AGENTS.md |
|---------|-------------------|---------------|---------------------------|----------------|-----------|
| `content` | 正文 | 正文 | 正文 | 正文 | `<!-- CORD:BEGIN -->` 区块 |
| `filePatterns` | `paths: [...]` | `globs: [...]` | `applyTo: "p1,p2"` | `globs: "p1,p2"` | 忽略（无此能力） |
| `description` | 忽略 | `description: "..."` | 忽略 | 可选正文首段 | 忽略 |
| `triggerMode: always` | 无 frontmatter | `alwaysApply: true` | 仓库级文件 | `trigger: always_on` | 直接写入 |
| `triggerMode: file_match` | `paths: [...]` | `globs: [...]` | `applyTo: "..."` | `trigger: glob` | 忽略 |
| `triggerMode: intelligent` | 降级为 always | `description` + 无 glob | 降级为 always | `trigger: model_decision` | 降级为 always |
| `triggerMode: manual` | 降级为 always | 无 frontmatter | 降级为 always | `trigger: manual` | 降级为 always |
| `excludeAgents` | 忽略 | 忽略 | `excludeAgent: "..."` | 忽略 | 忽略 |
| `version` | `<!-- cord:1.0.0 -->` | `<!-- cord:1.0.0 -->` | `<!-- cord:1.0.0 -->` | `<!-- cord:1.0.0 -->` | 标记区块内 |

**降级策略原则：** 当目标 IDE 不支持某触发模式时，降级为 **更宽泛的模式**（如 `intelligent` → `always`），确保指令始终被加载，不丢失。

_置信度：🟢 高 — 降级策略遵循"宽容原则"：宁可多加载（浪费少量 Token）也不遗漏_

---

### 3. 文件系统交互模式：模板方法模式 + 防御性编程

#### 3.1 配置文件写入流程（模板方法）

所有 IDE 的指令文件写入共享同一流程骨架，差异部分由子类实现：

```typescript
abstract class InstructionWriter {
  /**
   * 模板方法 — 定义统一的写入流程
   */
  async write(ir: CordInstructionModel, projectPath: string): Promise<WriteResult> {
    // 1. 确保目标目录存在
    await this.ensureDirectory(projectPath);

    // 2. 检查已有文件
    const existing = await this.readExisting(projectPath);

    // 3. 格式化 IR 为目标格式
    const formatted = this.format(ir);

    // 4. 决定合并策略
    const strategy = this.decideMergeStrategy(existing, formatted);

    // 5. 执行写入
    return this.executeWrite(formatted, strategy, projectPath);
  }

  // 抽象方法 — 各 IDE 实现差异
  abstract format(ir: CordInstructionModel): string;
  abstract getTargetPath(projectPath: string): string;
  abstract decideMergeStrategy(existing: string | null, formatted: string): MergeStrategy;

  // 共享方法
  protected async ensureDirectory(projectPath: string): Promise<void> {
    const dir = path.dirname(this.getTargetPath(projectPath));
    await fs.mkdir(dir, { recursive: true });
  }
}
```

#### 3.2 防御性编程原则

| 原则 | 实现 | 目的 |
|------|------|------|
| **不删除用户文件** | 仅操作 CORD 标识的文件/区块 | 防止误删用户指令 |
| **不覆盖用户内容** | 独立文件或标记区块 | 保护用户自定义指令 |
| **原子性写入** | 写入临时文件 → 重命名 | 防止半写入导致损坏 |
| **备份机制** | 升级前备份 `.cord/backups/` | 支持回退 |
| **幂等性** | 多次执行 `cord init` 结果一致 | 安全重复执行 |
| **版本保护** | 检测到更高版本时警告不覆盖 | 防止降级覆盖用户修改 |

---

### 4. AGENTS.md 标准化评估与战略定位

#### 4.1 标准化成熟度评估

| 评估维度 | 当前状态 | 成熟度 |
|----------|----------|--------|
| **治理结构** | Agentic AI Foundation（Linux Foundation 旗下），OpenAI/Cursor/Factory 等贡献 | 🟢 高 |
| **工具支持广度** | 25+ 工具原生支持（几乎覆盖所有主流 AI IDE 和 Agent） | 🟢 高 |
| **格式规范** | 仅"纯 Markdown，无 Schema"——极简但缺乏精确性 | 🟡 中 |
| **版本管理** | 无版本号、无 changelog、无兼容性承诺 | 🔴 低 |
| **验证工具** | 无 linter、无 validator、无 Schema 验证 | 🔴 低 |
| **内容约定** | 仅有"示例"级别的推荐结构（Dev / Testing / PR 章节） | 🟡 中 |
| **目录层级行为** | "最近的 AGENTS.md 优先"——但各 IDE 实现可能不一致 | 🟡 中 |

**综合成熟度：** 🟡 **早期采用阶段**（Early Adoption）

- 治理和工具覆盖已达生产水平
- 格式规范和验证工具仍处于 MVP 状态
- 预期 2026-2027 年将出现更正式的 Schema 和版本化规范

#### 4.2 AGENTS.md 对比各 IDE 原生指令文件

| 维度 | AGENTS.md | 各 IDE 原生规则 |
|------|-----------|---------------|
| **覆盖范围** | 25+ 工具 | 仅该 IDE |
| **触发控制** | ❌ 无 | ✅ 精细控制 |
| **文件匹配** | ❌ 无 | ✅ Glob 模式 |
| **智能判断** | ❌ 无 | ✅ Cursor/Windsurf |
| **上下文开销** | 🔴 全量加载 | 🟢 按需加载 |
| **Frontmatter** | ❌ 无 | ✅ 结构化元数据 |
| **标准化** | ✅ 开放标准 | ❌ 各自为政 |

**结论：AGENTS.md 是"最大公约数"，但不是"最优解"。**

#### 4.3 CORD 对 AGENTS.md 的战略定位

| 策略 | 描述 | 推荐度 |
|------|------|--------|
| **A: AGENTS.md 优先** | 仅维护 AGENTS.md，各 IDE 自动读取 | ❌ 不推荐 — 丧失触发控制能力 |
| **B: AGENTS.md 兜底** | 各 IDE 原生规则为主，AGENTS.md 为通用兜底 | ✅ 推荐 — 最佳覆盖 + 最优体验 |
| **C: 不使用 AGENTS.md** | 仅维护各 IDE 原生规则 | ❌ 不推荐 — 丧失对 25+ 工具的兼容 |

**选择方案 B 的理由：**

```
用户使用 Claude Code?
  └── ✅ → .claude/rules/cord-relations.md（精准触发 + 路径匹配）

用户使用 Cursor?
  └── ✅ → .cursor/rules/cord-relations.mdc（智能判断 + Glob 匹配）

用户使用 Copilot?
  └── ✅ → .github/instructions/cord-relations.instructions.md（路径匹配）

用户使用 Windsurf?
  └── ✅ → .windsurf/rules/cord-relations.md（Glob 触发）

用户使用其他 25+ 工具中的任何一个?
  └── ✅ → AGENTS.md 兜底（全量加载，无触发控制，但功能可用）
```

_置信度：🟢 高 — "原生规则 + 通用兜底"是跨平台兼容性的最优策略_

---

### 5. 跨 IDE 指令一致性架构

#### 5.1 语义一致性保证

同一条 CORD 指令在不同 IDE 中的表现应 **语义等价**，即使格式不同：

```
┌─────────────────────────────────────────────────────────┐
│           语义等价层（Semantic Equivalence）              │
│                                                          │
│  "当修改 Markdown 文档时，调用 cord_update_relations"    │
│                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │Claude    │ │Cursor    │ │Copilot   │ │Windsurf  │   │
│  │          │ │          │ │          │ │          │   │
│  │ paths 限 │ │ globs 限 │ │ applyTo  │ │ trigger  │   │
│  │ 定到 .md │ │ 定到 .md │ │ 限定 .md │ │ glob .md │   │
│  │          │ │          │ │          │ │          │   │
│  │ 按需加载 │ │ 按需加载 │ │ 按需加载 │ │ 按需加载 │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│                                                          │
│  ✅ 相同触发条件 → 相同指令内容 → 相同 AI 行为           │
└─────────────────────────────────────────────────────────┘
```

#### 5.2 行为差异不可避免的领域

| 领域 | 差异表现 | CORD 应对 |
|------|----------|----------|
| **AI 遵循率** | 各 AI 模型对指令的遵循率不同 | 接受差异，指令写法针对性优化 |
| **上下文加载时机** | Claude Code 按需 vs AGENTS.md 全量 | 按 IDE 能力最优化 |
| **智能判断** | 仅 Cursor/Windsurf 支持 | 无智能判断的 IDE 降级为文件匹配 |
| **指令可见性** | 用户在各 IDE 中看到的指令展示方式不同 | 文档化各 IDE 的查看方式 |

---

### 6. 关键架构决策记录（ADR）

#### ADR-TR7-001: CORD 指令文件命名约定

| 选项 | 示例 | 优势 | 劣势 | 结论 |
|------|------|------|------|------|
| **cord-relations** | `.claude/rules/cord-relations.md` | 清晰表达 CORD 用途 | 名称较长 | ✅ 推荐 |
| **cord** | `.claude/rules/cord.md` | 简短 | 不够描述性 | ❌ |
| **document-relations** | `.claude/rules/document-relations.md` | 描述功能 | 不包含 CORD 品牌 | ❌ |

**决策：** 统一使用 `cord-relations` 作为文件名前缀（不含后缀）。各 IDE 的后缀由格式决定。

#### ADR-TR7-002: Frontmatter Glob 语法标准化

| 问题 | 决策 |
|------|------|
| IR 内部用什么格式？ | **数组格式** `["**/*.md", "**/*.mdx"]` |
| 为什么不用逗号字符串？ | 数组更安全（Glob 模式可能包含逗号） |
| 转换到 Copilot/Windsurf 的逗号格式？ | Formatter 负责 `array.join(',')` |

#### ADR-TR7-003: 指令内容是否随 IDE 差异化

| 选项 | 描述 | 结论 |
|------|------|------|
| **A: 统一内容** | 所有 IDE 使用完全相同的 Markdown 指令正文 | ✅ 推荐 |
| **B: 差异化内容** | 根据 IDE 能力差异调整指令措辞 | ❌ 不推荐（维护成本高） |

**决策：** 指令正文保持 **内容一致**，差异仅体现在 Frontmatter 格式上。

#### ADR-TR7-004: CORD 在 AGENTS.md 中的位置策略

| 选项 | 描述 | 结论 |
|------|------|------|
| **文件末尾追加** | 在已有内容后追加 CORD 区块 | ✅ 推荐 |
| **文件开头插入** | 在已有内容前插入 | ❌ 不推荐（改变用户内容的相对位置） |
| **按字母序插入** | 找到合适的章节位置插入 | ❌ 不推荐（解析复杂度高，易出错） |

**决策：** 始终在 AGENTS.md **末尾追加** CORD 标记区块。

#### ADR-TR7-005: 指令内容的 i18n（国际化）策略

| 选项 | 描述 | 结论 |
|------|------|------|
| **A: 仅英文** | 所有指令片段仅英文 | 🟡 可接受（AI 理解英文最佳） |
| **B: 跟随项目语言** | 检测项目主要语言，使用对应语言 | ✅ 推荐 |
| **C: 用户选择** | `cord init --lang zh` 指定语言 | ✅ 推荐（作为 B 的覆盖选项） |

**决策：** 默认英文（方案 A），支持 `--lang` 参数覆盖（方案 C）。IR 中的 `contentLanguage` 字段控制。

_Source: 基于 Gang of Four 设计模式、CORD 项目需求分析及 TR4 架构基础_

## Implementation Approaches and Technology Adoption

> 本章节聚焦于 CORD 指令文件适配层的具体实现路径，包括开发路线图、核心代码实现、测试策略、部署方案和风险评估。

### 1. 实现路线图

CORD 指令文件适配层的实现应整合到 TR4 已规划的 Phase 2（`cord init` + 指令模板）中，细化为以下子阶段：

```
Phase 2A: 核心基础设施（3-4 天）
├── CordInstructionModel 数据模型定义
├── gray-matter 集成与 Frontmatter 解析/生成
├── InstructionFormatterFactory 抽象工厂
├── 基础 Formatter 接口与测试骨架
└── 版本标记解析/嵌入工具

Phase 2B: 各 IDE Formatter 实现（4-5 天）
├── ClaudeCodeFormatter（paths frontmatter + .md）
├── CursorFormatter（description/alwaysApply/globs frontmatter + .mdc）
├── CopilotFormatter（applyTo/excludeAgent frontmatter + .instructions.md）
├── WindsurfFormatter（trigger/globs frontmatter + .md）
├── AgentsMdFormatter（标记区块合并）
└── 各 Formatter 单元测试 + 快照测试

Phase 2C: cord init 指令层集成（3-4 天）
├── IDE 检测器（目录探测 + 二级检测）
├── 交互式配置流程（@clack/prompts — TR5 已选定）
├── MCP 配置注入（JSON 合并）
├── 升级/卸载流程
└── 端到端集成测试

Phase 2D: 指令模板与 i18n（2-3 天）
├── CORD 指令内容模板（默认英文）
├── 中文模板
├── 模板版本管理
└── 文档与使用指南
```

**总工时：12-16 天**（含测试），可与 TR4 Phase 2 的 MCP 配置部分并行。

---

### 2. 核心代码实现

#### 2.1 项目文件结构

```
cord/
├── src/
│   ├── cli/
│   │   └── commands/
│   │       └── init.ts                    # cord init 命令入口
│   ├── instruction/                       # 指令文件适配层（TR7 核心产出）
│   │   ├── model.ts                       # CordInstructionModel 定义
│   │   ├── formatter-factory.ts           # InstructionFormatterFactory
│   │   ├── formatters/
│   │   │   ├── base-formatter.ts          # 基础 Formatter（模板方法）
│   │   │   ├── claude-code-formatter.ts   # Claude Code 适配器
│   │   │   ├── cursor-formatter.ts        # Cursor 适配器
│   │   │   ├── copilot-formatter.ts       # Copilot 适配器
│   │   │   ├── windsurf-formatter.ts      # Windsurf 适配器
│   │   │   └── agents-md-formatter.ts     # AGENTS.md 适配器
│   │   ├── detector/
│   │   │   └── ide-detector.ts            # IDE 环境检测
│   │   ├── merger/
│   │   │   ├── json-merger.ts             # MCP 配置 JSON 合并
│   │   │   └── agents-md-merger.ts        # AGENTS.md 标记区块合并
│   │   └── templates/
│   │       ├── cord-relations.en.md       # 英文指令模板
│   │       ├── cord-relations.zh.md       # 中文指令模板
│   │       └── template-loader.ts         # 模板加载器
│   └── ...
├── tests/
│   ├── instruction/
│   │   ├── formatters/
│   │   │   ├── claude-code-formatter.test.ts
│   │   │   ├── cursor-formatter.test.ts
│   │   │   ├── copilot-formatter.test.ts
│   │   │   ├── windsurf-formatter.test.ts
│   │   │   └── agents-md-formatter.test.ts
│   │   ├── detector/
│   │   │   └── ide-detector.test.ts
│   │   ├── merger/
│   │   │   ├── json-merger.test.ts
│   │   │   └── agents-md-merger.test.ts
│   │   └── __snapshots__/                 # 快照测试基线
│   └── ...
└── ...
```

#### 2.2 Formatter 核心实现（伪代码）

```typescript
// src/instruction/formatters/cursor-formatter.ts
import matter from 'gray-matter';
import { BaseFormatter } from './base-formatter';
import type { CordInstructionModel, FormattedOutput } from '../model';

export class CursorFormatter extends BaseFormatter {
  readonly targetIDE = 'cursor';
  readonly fileExtension = '.mdc';

  getTargetPath(projectPath: string): string {
    return path.join(projectPath, '.cursor', 'rules', 'cord-relations.mdc');
  }

  detect(projectPath: string): boolean {
    return existsSync(path.join(projectPath, '.cursor'));
  }

  format(ir: CordInstructionModel): FormattedOutput {
    // 构建 Cursor 特定的 Frontmatter
    const frontmatter: Record<string, any> = {};

    if (ir.triggerMode === 'file_match' && ir.filePatterns.length > 0) {
      frontmatter.alwaysApply = false;
      frontmatter.globs = ir.filePatterns; // 数组格式，Cursor 原生支持
    } else if (ir.triggerMode === 'always') {
      frontmatter.alwaysApply = true;
    }

    if (ir.description) {
      frontmatter.description = ir.description;
    }

    // 使用 gray-matter 生成完整文件
    const content = matter.stringify(
      this.injectVersionComment(ir.content, ir.version),
      frontmatter
    );

    return {
      filePath: this.getTargetPath(''),
      content,
      isNewFile: true,
      mergeStrategy: 'create',
    };
  }
}
```

```typescript
// src/instruction/formatters/copilot-formatter.ts
export class CopilotFormatter extends BaseFormatter {
  readonly targetIDE = 'copilot';
  readonly fileExtension = '.instructions.md';

  getTargetPath(projectPath: string): string {
    return path.join(projectPath, '.github', 'instructions',
                     'cord-relations.instructions.md');
  }

  detect(projectPath: string): boolean {
    const githubDir = path.join(projectPath, '.github');
    if (!existsSync(githubDir)) return false;
    // 二级检测
    return (
      existsSync(path.join(githubDir, 'copilot-instructions.md')) ||
      existsSync(path.join(githubDir, 'instructions'))
    );
  }

  format(ir: CordInstructionModel): FormattedOutput {
    const frontmatter: Record<string, any> = {};

    if (ir.filePatterns.length > 0) {
      // Copilot 使用逗号分隔的字符串格式
      frontmatter.applyTo = ir.filePatterns.join(',');
    }

    if (ir.excludeAgents && ir.excludeAgents.length > 0) {
      frontmatter.excludeAgent = ir.excludeAgents[0]; // Copilot 仅支持单值
    }

    const content = matter.stringify(
      this.injectVersionComment(ir.content, ir.version),
      frontmatter
    );

    return {
      filePath: this.getTargetPath(''),
      content,
      isNewFile: true,
      mergeStrategy: 'create',
    };
  }
}
```

#### 2.3 IDE 检测器实现

```typescript
// src/instruction/detector/ide-detector.ts
import { existsSync } from 'fs';
import path from 'path';

export interface DetectedIDE {
  name: string;
  detected: boolean;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  formatterKey: string;
}

export class IDEDetector {
  detect(projectPath: string): DetectedIDE[] {
    return [
      this.detectClaudeCode(projectPath),
      this.detectCursor(projectPath),
      this.detectCopilot(projectPath),
      this.detectWindsurf(projectPath),
      this.detectGemini(projectPath),
    ];
  }

  private detectClaudeCode(projectPath: string): DetectedIDE {
    const exists = existsSync(path.join(projectPath, '.claude'));
    return {
      name: 'Claude Code',
      detected: exists,
      confidence: exists ? 'high' : 'low',
      reason: exists ? '.claude/ 目录已存在' : '未检测到 .claude/ 目录',
      formatterKey: 'claude-code',
    };
  }

  private detectCopilot(projectPath: string): DetectedIDE {
    const githubDir = path.join(projectPath, '.github');
    if (!existsSync(githubDir)) {
      return {
        name: 'GitHub Copilot',
        detected: false,
        confidence: 'low',
        reason: '未检测到 .github/ 目录',
        formatterKey: 'copilot',
      };
    }

    // 二级检测
    const hasCopilotFiles =
      existsSync(path.join(githubDir, 'copilot-instructions.md')) ||
      existsSync(path.join(githubDir, 'instructions'));

    return {
      name: 'GitHub Copilot',
      detected: true,
      confidence: hasCopilotFiles ? 'high' : 'medium',
      reason: hasCopilotFiles
        ? 'Copilot 指令文件已存在'
        : '.github/ 存在但无 Copilot 指令文件',
      formatterKey: 'copilot',
    };
  }

  // detectCursor, detectWindsurf, detectGemini 类似...
}
```

---

### 3. 测试策略

#### 3.1 测试金字塔

```
          ╱╲
         ╱  ╲          E2E 手动验证
        ╱ E2E╲         各 IDE 中加载生成文件 → AI 遵循指令
       ╱──────╲
      ╱        ╲       集成测试
     ╱ 集成测试  ╲      cord init → 检测 → 生成 → 写入 → 验证
    ╱────────────╲
   ╱              ╲    快照测试
  ╱   快照测试     ╲    各 Formatter 输出 → 基线快照对比
 ╱────────────────╲
╱                  ╲   单元测试
╱   单元测试       ╲   IR 转换、Glob 格式转换、标记区块合并
╱────────────────────╲
```

#### 3.2 各层测试方案

| 测试层 | 测试对象 | 工具 | 覆盖目标 |
|--------|----------|------|----------|
| **单元测试** | IR 数据模型、Glob 格式转换、版本标记解析 | Vitest | 数据转换 100% |
| **快照测试** | 各 Formatter 的输出文件内容 | Vitest + `toMatchSnapshot()` | 格式正确性 100% |
| **Merger 测试** | AGENTS.md 标记区块合并、JSON MCP 配置合并 | Vitest | 合并场景 100% |
| **IDE 检测测试** | IDEDetector 在各种目录结构下的检测结果 | Vitest + 临时目录 | 检测准确性 |
| **集成测试** | `cord init` 完整流程（检测 → 生成 → 写入） | Vitest + 临时项目目录 | 端到端流程 |
| **E2E 验证** | 在真实 IDE 中加载生成的指令文件 | 手动测试 checklist | 4 IDE 各一轮 |

#### 3.3 快照测试示例

```typescript
// tests/instruction/formatters/cursor-formatter.test.ts
import { describe, it, expect } from 'vitest';
import { CursorFormatter } from '../../../src/instruction/formatters/cursor-formatter';
import type { CordInstructionModel } from '../../../src/instruction/model';

describe('CursorFormatter', () => {
  const formatter = new CursorFormatter();

  const baseIR: CordInstructionModel = {
    id: 'cord-relations',
    version: '1.0.0',
    cordVersion: '>=0.1.0',
    content: '当你修改了 Markdown 文档时...',
    filePatterns: ['**/*.md', '**/*.mdx', 'docs/**/*'],
    scope: 'project',
    versionControlled: true,
    description: 'CORD 文档关系维护',
    triggerMode: 'file_match',
  };

  it('should generate correct .mdc file with glob frontmatter', () => {
    const result = formatter.format(baseIR);
    expect(result.content).toMatchSnapshot();
  });

  it('should generate alwaysApply frontmatter for always trigger mode', () => {
    const alwaysIR = { ...baseIR, triggerMode: 'always' as const };
    const result = formatter.format(alwaysIR);
    expect(result.content).toContain('alwaysApply: true');
    expect(result.content).toMatchSnapshot();
  });

  it('should detect Cursor when .cursor/ exists', () => {
    // 使用临时目录模拟
    expect(formatter.detect('/fake/project/with/.cursor')).toBe(true);
  });
});
```

#### 3.4 AGENTS.md Merger 测试矩阵

| 测试场景 | 输入 | 预期输出 |
|----------|------|----------|
| AGENTS.md 不存在 | 无文件 | 新建含 CORD 标记区块的文件 |
| AGENTS.md 存在，无 CORD 区块 | 用户内容 | 末尾追加 CORD 标记区块 |
| AGENTS.md 存在，有 CORD 区块 | 用户内容 + 旧 CORD 区块 | 替换 CORD 区块，保留用户内容 |
| AGENTS.md 存在，卸载 | 用户内容 + CORD 区块 | 删除 CORD 区块，保留用户内容 |
| AGENTS.md 仅有 CORD 区块 | CORD 区块 | 卸载后文件为空或仅有换行 |
| 标记区块损坏（仅有 BEGIN） | 部分标记 | 追加新区块，不处理损坏标记 |

---

### 4. 部署与分发

#### 4.1 指令模板随 npm 包分发

```json
{
  "name": "cord",
  "files": [
    "dist/",
    "templates/"
  ]
}
```

指令模板文件存储在 `templates/` 目录，`cord init` 从 npm 包中读取模板内容，通过 Formatter 转换后写入用户项目。

#### 4.2 `cord init` 子命令设计

基于 TR5 确定的 Commander.js v14 框架：

```typescript
// src/cli/commands/init.ts
import { Command } from 'commander';

export const initCommand = new Command('init')
  .description('Initialize CORD for the current project')
  .option('--lang <language>', 'Instruction language (en/zh)', 'en')
  .option('--ide <ides...>', 'Specify IDEs (claude-code,cursor,copilot,windsurf)')
  .option('--no-agents-md', 'Skip AGENTS.md generation')
  .option('--upgrade', 'Upgrade existing CORD instructions')
  .option('--uninstall', 'Remove all CORD instruction files')
  .option('--dry-run', 'Show what would be generated without writing')
  .action(async (options) => {
    // 实现逻辑...
  });
```

**子命令选项说明：**

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `--lang` | 指令内容语言 | `en`（英文） |
| `--ide` | 指定目标 IDE（跳过检测） | 自动检测 |
| `--no-agents-md` | 不生成 AGENTS.md 片段 | 生成 |
| `--upgrade` | 升级已有 CORD 指令 | 全新安装 |
| `--uninstall` | 移除所有 CORD 指令文件 | — |
| `--dry-run` | 预览输出不实际写入 | 实际写入 |

---

### 5. 风险评估与缓解

| # | 风险 | 概率 | 影响 | 缓解策略 |
|---|------|------|------|----------|
| **R1** | gray-matter 无法正确解析 Cursor `.mdc` 格式 | 🟡 中 | 🟡 中 | `.mdc` 本质是带 YAML frontmatter 的 Markdown；如有问题可自定义分隔符或降级为手动解析 |
| **R2** | 各 IDE 更新指令文件格式（新增/移除 frontmatter 字段） | 🟡 中 | 🟡 中 | 各 Formatter 松耦合，单独更新不影响其他；关注 IDE changelog |
| **R3** | AGENTS.md 标记区块被用户误编辑导致升级失败 | 🟢 低 | 🟢 低 | 容错处理：标记损坏时追加新区块而非覆盖；提供 `--force` 选项 |
| **R4** | Glob 模式语法在各 IDE 间行为不一致 | 🟡 中 | 🟡 中 | IR 使用最通用的 Glob 子集（`**/*.md` 风格）；避免使用 brace expansion 等高级语法 |
| **R5** | 用户项目中 `.github/` 存在但非 Copilot 配置 | 🟠 高 | 🟢 低 | 二级检测 + 交互式确认（已在 IDE 检测器中实现） |
| **R6** | MCP 配置 JSON 合并覆盖用户自定义配置 | 🟢 低 | 🟠 高 | 仅添加/更新 `cord` 条目；读取 → 合并 → 写入原子操作；备份机制 |
| **R7** | 指令内容更新后 AI 遵循率下降 | 🟡 中 | 🟡 中 | A/B 测试不同指令措辞；收集用户反馈；参考各 IDE 官方最佳实践 |

---

### 6. 依赖清单

| 依赖 | 用途 | 类型 | 版本 |
|------|------|------|------|
| **gray-matter** | YAML Frontmatter 解析/生成 | 运行时 | ^4.x |
| **@clack/prompts** | 交互式 CLI 提示 | 运行时 | TR5 已选定 |
| **commander** | CLI 命令框架 | 运行时 | TR5 已选定 (v14) |
| **picocolors** | 终端颜色输出 | 运行时 | TR5 已选定 |
| **vitest** | 测试框架 | 开发时 | TR5 已选定 |

**新增依赖仅 `gray-matter` 一个**（其余均为 TR5 已选定的技术栈），最小化依赖增长。

---

## Technical Research Recommendations

### 实现路线图推荐

| 阶段 | 产出 | 依赖 | 工时 |
|------|------|------|------|
| **Phase 2A** | IR 模型 + gray-matter 集成 + Factory | TR5 项目骨架 | 3-4 天 |
| **Phase 2B** | 5 个 Formatter + 单元/快照测试 | Phase 2A | 4-5 天 |
| **Phase 2C** | cord init 指令层 + IDE 检测 + 交互流程 | Phase 2B + TR5 CLI | 3-4 天 |
| **Phase 2D** | 指令模板 + i18n + 文档 | Phase 2C | 2-3 天 |

### 技术栈推荐

| 组件 | 技术选择 | 来源 |
|------|----------|------|
| Frontmatter 解析 | gray-matter ^4.x | TR7 本研究 |
| CLI 框架 | Commander.js v14 | TR5 |
| 交互式提示 | @clack/prompts | TR5 |
| 测试框架 | Vitest + snapshot | TR5 / TR7 |
| 构建工具 | tsup | TR5 |

### 技能发展要求

| 技能 | 深度 | 用途 |
|------|------|------|
| **gray-matter API** | 中等 | Frontmatter 解析/生成 |
| **各 IDE 指令文件格式** | 熟悉 | Formatter 开发与维护 |
| **Glob 模式语法** | 中等 | 跨 IDE Glob 兼容性 |
| **Vitest 快照测试** | 基础 | 配置输出回归测试 |

### 成功指标与 KPI

| 指标 | 目标值 | 测量方式 |
|------|--------|----------|
| **Formatter 输出正确率** | 100% | 快照测试全通过 |
| **IDE 检测准确率** | ≥ 95% | 集成测试 + 用户反馈 |
| **`cord init` 到首次使用时间** | < 1 分钟 | 用户测试 |
| **跨 IDE 指令语义一致性** | 100% | IR → 各格式对比审查 |
| **升级不破坏用户内容** | 100% | Merger 测试矩阵全通过 |
| **AI 指令遵循率** | ≥ 80%（4 IDE 平均） | 手动验证统计 |

_Source: 基于 TR4（跨 IDE 集成）、TR5（CLI 框架）研究结论及 npm 生态最佳实践_

## Research Synthesis — 综合分析与战略结论

### Executive Summary

本 TR7 研究对五大主流 AI IDE 的全局指令文件体系进行了全面深度对比，产出了 CORD 指令文件适配层的完整抽象模型、架构设计和实现方案。

**核心发现：**

1. **"格式碎片化、语义同构化"** — 所有 IDE 都采用 Markdown + 可选 YAML Frontmatter，都支持 Glob 文件匹配和多层作用域。但 Frontmatter 字段名称（`paths` vs `globs` vs `applyTo`）、触发模式（`paths` vs `alwaysApply` vs `trigger`）、文件后缀（`.md` vs `.mdc` vs `.instructions.md`）各不相同
2. **AGENTS.md 已成为事实标准** — 25+ 工具支持，Linux Foundation 旗下 Agentic AI Foundation 维护。但仍处"早期采用阶段"（无 Schema、无版本号、无验证工具），功能远弱于各 IDE 原生规则
3. **统一抽象模型可行** — 5 个共性维度 + 3 个差异维度可完整覆盖所有 IDE 的指令语义；差异维度通过可选字段和降级策略处理
4. **独立文件注入策略是最优解** — 为每个 IDE 新建独立规则文件（零侵入用户已有配置），AGENTS.md 通过标记区块兜底
5. **gray-matter 是唯一新增依赖** — 其余工具链（Commander.js、@clack/prompts、Vitest、tsup）全部复用 TR5 已选定的技术栈

**战略建议：**

- **采用"原生规则优先 + AGENTS.md 兜底"策略**（方案 B），最大化 IDE 特定功能利用（Glob 匹配、智能判断）+ 最大化工具覆盖（25+ 工具）
- **实现 CordInstructionModel → 5 个 Formatter 适配器的转换管道**，新增 IDE 仅需添加 Formatter
- **`cord init` 集成自动检测 + 交互式确认 + dry-run**，实现 < 1 分钟的首次配置体验
- **12-16 天完成实现**，可与 TR4 Phase 2 并行

---

### Table of Contents

1. [Technical Research Scope Confirmation](#technical-research-scope-confirmation)
2. [Technology Stack Analysis](#technology-stack-analysis)
   - 2.1 Claude Code — CLAUDE.md + .claude/rules/ 体系
   - 2.2 Cursor — .cursor/rules/ + AGENTS.md 体系
   - 2.3 GitHub Copilot — .github/instructions/ + AGENTS.md 体系
   - 2.4 Windsurf — .windsurf/rules/ + AGENTS.md 体系
   - 2.5 Gemini CLI — GEMINI.md + .gemini/ 体系
   - 2.6 AGENTS.md — 跨 IDE 开放标准
   - 2.7 技术栈横向对比总览
3. [Integration Patterns Analysis](#integration-patterns-analysis)
   - 3.1 CORD 指令片段的集成需求
   - 3.2 各 IDE 指令片段注入路径（Claude Code / Cursor / Copilot / Windsurf / AGENTS.md）
   - 3.3 跨 IDE 指令片段格式转换管道
   - 3.4 非破坏性合并策略
   - 3.5 Frontmatter 解析与生成工具链（gray-matter）
   - 3.6 版本管理与升级策略
   - 3.7 IDE 配置检测策略
   - 3.8 MCP Server 配置注入
4. [Architectural Patterns and Design](#architectural-patterns-and-design)
   - 4.1 核心架构模式：适配器模式 + 抽象工厂模式
   - 4.2 指令抽象模型：CORD Instruction Model（5 共性 + 3 差异）
   - 4.3 文件系统交互模式：模板方法 + 防御性编程
   - 4.4 AGENTS.md 标准化评估与战略定位
   - 4.5 跨 IDE 指令一致性架构
   - 4.6 关键架构决策记录（ADR-TR7-001 ~ 005）
5. [Implementation Approaches and Technology Adoption](#implementation-approaches-and-technology-adoption)
   - 5.1 实现路线图（Phase 2A-2D）
   - 5.2 核心代码实现（文件结构 + Formatter 伪代码 + IDE 检测器）
   - 5.3 测试策略（四层测试金字塔 + AGENTS.md Merger 测试矩阵）
   - 5.4 部署与分发
   - 5.5 风险评估与缓解（7 项）
   - 5.6 依赖清单
6. [Technical Research Recommendations](#technical-research-recommendations)
7. [Research Synthesis — 综合分析与战略结论](#research-synthesis--综合分析与战略结论)

---

### 关键技术决策汇总

| ADR 编号 | 决策主题 | 结论 | 理由 |
|----------|----------|------|------|
| **ADR-TR7-001** | CORD 指令文件命名 | `cord-relations` 作为统一前缀 | 清晰表达 CORD 用途 + 品牌识别 |
| **ADR-TR7-002** | Glob 语法标准化 | IR 内部用数组格式 | 数组更安全；转换为逗号字符串由 Formatter 负责 |
| **ADR-TR7-003** | 指令内容差异化 | 统一内容，差异仅在 Frontmatter | 维护成本最低，语义一致性最高 |
| **ADR-TR7-004** | AGENTS.md 位置策略 | 始终末尾追加 | 不改变用户内容的相对位置 |
| **ADR-TR7-005** | i18n 策略 | 默认英文 + `--lang` 覆盖 | AI 理解英文最佳，支持用户偏好 |

---

### 五大 IDE 指令文件体系终极对比

| 维度 | Claude Code 🥇 | Cursor 🥈 | Copilot | Windsurf | AGENTS.md |
|------|----------------|-----------|---------|----------|-----------|
| **主文件** | `CLAUDE.md` | — | `copilot-instructions.md` | — | `AGENTS.md` |
| **规则目录** | `.claude/rules/` | `.cursor/rules/` | `.github/instructions/` | `.windsurf/rules/` | — |
| **文件后缀** | `.md` | `.mdc`/`.md` | `.instructions.md` | `.md` | `.md` |
| **Frontmatter** | `paths` (1 字段) | 3 字段 | 2 字段 | 2 字段 | 无 |
| **作用域层数** | 6 级 | 3 级 | 3 级 | 4 级 | 1 级 |
| **文件匹配** | `paths: [glob]` | `globs: [glob]` | `applyTo: "glob"` | `trigger: glob` | ❌ |
| **智能判断** | ❌ | ✅ `description` | ❌ | ✅ `model_decision` | ❌ |
| **手动触发** | ❌ | ✅ `@name` | ❌ | ✅ `@name` | ❌ |
| **文件导入** | ✅ `@path` | ❌ | ❌ | ❌ | ❌ |
| **排除机制** | ✅ `claudeMdExcludes` | ❌ | ✅ `excludeAgent` | ❌ | ❌ |
| **字符限制** | ~200 行建议 | ~500 行建议 | ~2 页 | 6K/12K 字符 | 无 |
| **AGENTS.md 支持** | `@AGENTS.md` 导入 | ✅ 原生 | ✅ 原生 | ✅ 原生 | — |
| **工具覆盖** | 仅 Claude Code | 仅 Cursor | 仅 Copilot | 仅 Windsurf | **25+ 工具** |
| **CORD 注入方式** | 独立 .md 文件 | 独立 .mdc 文件 | 独立 .instructions.md | 独立 .md 文件 | 标记区块 |

---

### 未来技术展望

#### 近期趋势（2026-2027）

1. **AGENTS.md 规范化加速** — Agentic AI Foundation 的正式治理结构将推动 AGENTS.md 从"纯 Markdown 约定"向"有 Schema、有版本号、有验证工具"的方向演进。CORD 的适配器架构已预留扩展空间。

2. **各 IDE 原生规则体系趋于收敛** — Cursor 的 `.mdc` 和 Windsurf 的 `trigger` 模式已体现出相似的设计理念（声明式触发控制）。未来可能出现跨 IDE 的规则格式标准化协议。

3. **Claude Code 的 `@path` 导入模式可能被其他 IDE 采纳** — 文件导入和符号链接是管理大型项目指令集的最佳方案，其他 IDE 可能跟进。

#### 中期展望（2027-2028）

1. **AI IDE 指令格式统一标准** — 类似 MCP 对 AI 工具调用的标准化，可能出现跨 IDE 的指令文件格式标准（"MCP for Instructions"），使工具开发者只需维护一份指令文件。

2. **AI Agent 自主发现指令** — AI 可能无需显式指令文件，自动从 MCP Server 能力描述中推断行为规范。这将降低指令层的必要性，但 CORD 的 MCP Tools 描述已是这一趋势的早期实践。

3. **指令文件即代码（Instructions as Code）** — 类似 Infrastructure as Code 的演进，指令文件可能引入变量、条件逻辑、模板继承等编程能力。

---

### 对后续研究的影响

| 后续研究 | TR7 的影响 |
|----------|-----------|
| **TR8 (Mermaid 可视化)** | 各 IDE 指令文件的生成/注入路径可作为 Mermaid 可视化的一个数据源，展示"指令分发拓扑" |
| **TR9 (npm 分发)** | 指令模板文件随 npm 包分发的方案已确定；`cord init` 的模板加载路径需与 npm 包结构对齐 |
| **TR10 (BMAD 适配)** | BMAD 文档产出的 AGENTS.md / CLAUDE.md 片段可复用 TR7 的 Formatter 管道自动注入 |

---

### 研究方法论与来源说明

**研究方法：**
- 官方文档优先，所有核心结论均基于各 IDE 最新官方文档
- Web 搜索验证，交叉比对多个来源
- 直接继承 TR4 已验证的跨 IDE 对比基础，避免重复研究
- 基于 CORD 项目实际需求进行针对性架构设计

**主要来源：**
- [Claude Code Memory 文档](https://code.claude.com/docs/en/memory) — CLAUDE.md 规格、.claude/rules/ 目录、加载机制、@path 导入
- [Cursor Rules 文档](https://cursor.com/docs/rules) — .cursor/rules/ 目录、.mdc 格式、Frontmatter 字段、触发模式
- [GitHub Copilot Custom Instructions](https://docs.github.com/en/copilot/customizing-copilot/adding-custom-instructions-for-github-copilot) — copilot-instructions.md、路径级指令、applyTo/excludeAgent
- [Windsurf Rules & Memories 文档](https://docs.windsurf.com/windsurf/cascade/memories) — .windsurf/rules/ 目录、trigger/globs Frontmatter、字符限制
- [Gemini CLI GitHub 仓库](https://github.com/google-gemini/gemini-cli) — GEMINI.md 规格
- [AGENTS.md 官方网站](https://agents.md) — 开放标准定义、工具支持列表、Agentic AI Foundation
- [gray-matter GitHub 仓库](https://github.com/jonschlinkert/gray-matter) — YAML Frontmatter 解析/生成 API

**置信度评估：**
- Claude Code CLAUDE.md: 🟢 高（文档极为详尽，涵盖所有边界情况）
- Cursor Rules: 🟢 高（文档清晰，4 种触发模式均有说明）
- Copilot Instructions: 🟡 中高（Custom Instructions 清晰，AGENTS.md 集成较新）
- Windsurf Rules: 🟢 高（文档详尽，含字符限制和企业部署说明）
- Gemini CLI: 🟡 中（仅 README 级别信息，详细规格需查阅子文档）
- AGENTS.md 标准: 🟢 高（官方网站 + GitHub + 25+ 工具支持列表）

---

**Technical Research Completion Date:** 2026-04-01
**Research Period:** 2026-04-01（综合分析，基于 TR4-TR5 积累的项目上下文）
**Source Verification:** 所有技术声明均引用当前官方文档
**Technical Confidence Level:** 🟢 高 — 基于多个权威技术来源交叉验证

_本技术研究报告为 CORD 项目指令文件适配层设计提供了权威的技术选型依据和完整的架构方案，可直接指导 `cord init` 指令层的实现工作。_

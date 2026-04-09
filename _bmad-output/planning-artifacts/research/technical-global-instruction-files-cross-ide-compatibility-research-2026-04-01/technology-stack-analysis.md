# Technology Stack Analysis

> 本章节对五大 AI IDE / AI Agent 平台的指令文件体系进行全面技术栈分析，覆盖文件格式、目录约定、Frontmatter 规格、作用域模型、优先级继承、字符限制等核心维度。额外纳入 Gemini CLI 和 AGENTS.md 开放标准作为参照。

## 1. Claude Code — CLAUDE.md + .claude/rules/ 体系

**产品定位：** CLI 终端工具，指令体系最为成熟完整
**置信度：** 🟢 高（官方文档极为详尽，2026 年 4 月最新版本）

### 1.1 指令文件体系

| 文件类型 | 位置 | 作用域 | 共享方式 |
|----------|------|--------|----------|
| **托管策略级** | macOS: `/Library/Application Support/ClaudeCode/CLAUDE.md`<br>Linux/WSL: `/etc/claude-code/CLAUDE.md`<br>Windows: `C:\Program Files\ClaudeCode\CLAUDE.md` | 组织全局（不可被排除） | IT/DevOps 通过 MDM 分发 |
| **项目级** | `./CLAUDE.md` 或 `./.claude/CLAUDE.md` | 项目全部成员 | 版本控制（Git） |
| **用户级** | `~/.claude/CLAUDE.md` | 个人所有项目 | 仅本机 |
| **项目规则** | `.claude/rules/*.md`（支持子目录递归） | 项目级（可按路径限定） | 版本控制（Git） |
| **用户规则** | `~/.claude/rules/*.md` | 个人所有项目 | 仅本机 |

### 1.2 文件格式

- **纯 Markdown**（无 Frontmatter 要求）
- 规则文件支持 **可选 YAML Frontmatter**（`paths` 字段）
- HTML 块注释（`<!-- -->`）在注入上下文前被剥离（不消耗 Token）
- 推荐 **200 行以内** 以保持遵循率

### 1.3 规则文件 Frontmatter

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

### 1.4 加载机制与优先级

1. **启动时**：从工作目录向上遍历目录树，加载每一级的 CLAUDE.md
2. **按需加载**：子目录下的 CLAUDE.md 在 Claude 读取该目录文件时才加载
3. **规则加载**：无 `paths` 字段的规则启动时加载；有 `paths` 字段的规则匹配时加载
4. **优先级**：托管策略级 > 项目级 > 用户级（更具体的位置覆盖更宽泛的）
5. **排除机制**：`claudeMdExcludes` 设置可跳过不相关的 CLAUDE.md（大型 Monorepo 场景）

### 1.5 独有能力

- **`@path` 导入语法**：CLAUDE.md 可导入外部文件（相对/绝对路径，最多 5 层嵌套）
- **AGENTS.md 桥接**：通过 `@AGENTS.md` 导入已有的 AGENTS.md，避免内容重复
- **符号链接支持**：`.claude/rules/` 支持 symlink，可跨项目共享规则
- **`claudeMdExcludes`**：按路径或 Glob 排除不相关的 CLAUDE.md
- **`/init` 命令**：自动分析代码库并生成起步 CLAUDE.md
- **`/memory` 命令**：列出所有已加载的指令文件，支持编辑

_Source: [Claude Code Memory 文档](https://code.claude.com/docs/en/memory)_

---

## 2. Cursor — .cursor/rules/ + AGENTS.md 体系

**产品定位：** VS Code fork IDE，指令体系聚焦 AI Agent/Chat
**置信度：** 🟢 高（官方文档清晰）

### 2.1 指令文件体系

| 文件类型 | 位置 | 作用域 | 共享方式 |
|----------|------|--------|----------|
| **项目规则** | `.cursor/rules/*.mdc` 或 `.cursor/rules/*.md` | 项目级（版本控制） | Git |
| **用户规则** | Cursor Settings → Rules | 个人全局（仅 Agent/Chat） | 仅本机 |
| **团队规则** | Cursor Dashboard | 团队/企业组织 | 云端管理 |
| **AGENTS.md** | 项目根目录或任意子目录 | 目录级（层级继承） | Git |

### 2.2 文件格式

- **`.mdc` 或 `.md`** 格式（MDC = Markdown with Context）
- **YAML Frontmatter** 控制触发行为
- 推荐 **500 行以内**

### 2.3 规则文件 Frontmatter

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

### 2.4 优先级

Team Rules > Project Rules > User Rules

### 2.5 关键局限

- **User Rules 仅作用于 Agent/Chat**，不影响 Cursor Tab 和 Inline Edit
- **无导入/引用语法** — 不支持 `@path` 类似机制
- **无排除机制** — 无法选择性跳过某些规则文件

_Source: [Cursor Rules 文档](https://cursor.com/docs/rules)_

---

## 3. GitHub Copilot — .github/instructions/ + AGENTS.md 体系

**产品定位：** 多 IDE 插件（VS Code / JetBrains / Xcode 等）
**置信度：** 🟡 中高（Custom Instructions 文档清晰，AGENTS.md 集成较新）

### 3.1 指令文件体系

| 文件类型 | 位置 | 作用域 | 共享方式 |
|----------|------|--------|----------|
| **仓库级指令** | `.github/copilot-instructions.md` | 整个仓库 | Git |
| **路径级指令** | `.github/instructions/*.instructions.md` | 匹配 Glob 的文件 | Git |
| **Agent 指令** | `AGENTS.md`（任意位置） | 目录级（就近原则） | Git |
| **替代文件** | `CLAUDE.md` 或 `GEMINI.md`（仓库根目录） | Agent 级别 | Git |
| **个人指令** | IDE Settings | 用户全局 | 仅本机 |
| **组织指令** | GitHub Organization Settings | 组织级 | 云端管理 |

### 3.2 文件格式

- **纯 Markdown**
- 路径级指令支持 **YAML Frontmatter**

### 3.3 路径级指令 Frontmatter

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

### 3.4 优先级

个人指令 > 仓库指令 > 组织指令

**叠加机制：** 当路径级指令和仓库级指令同时匹配，**两者内容均被使用**（非覆盖）。

### 3.5 关键约束

- 仓库级指令 **不超过 2 页**
- 仓库级指令 **不应任务特定**
- AGENTS.md 遵循 **就近原则**（最近目录的 AGENTS.md 优先）
- 支持读取 `CLAUDE.md` 和 `GEMINI.md`（仅限仓库根目录）

_Source: [GitHub Copilot Custom Instructions 文档](https://docs.github.com/en/copilot/customizing-copilot/adding-custom-instructions-for-github-copilot)_

---

## 4. Windsurf — .windsurf/rules/ + AGENTS.md 体系

**产品定位：** VS Code fork IDE，内置 Cascade AI Agent
**置信度：** 🟢 高（官方文档详尽）

### 4.1 指令文件体系

| 文件类型 | 位置 | 作用域 | 共享方式 |
|----------|------|--------|----------|
| **工作区规则** | `.windsurf/rules/*.md` | 项目级（可按触发模式限定） | Git |
| **全局规则** | `~/.codeium/windsurf/memories/global_rules.md` | 个人所有项目 | 仅本机 |
| **系统规则** | macOS: `/Library/Application Support/Windsurf/rules/*.md`<br>Linux/WSL: `/etc/windsurf/rules/*.md`<br>Windows: `C:\ProgramData\Windsurf\rules\*.md` | 企业全局（只读） | MDM/配置管理 |
| **AGENTS.md** | 项目根目录或任意子目录 | 根目录 = always-on；子目录 = auto-glob | Git |
| **记忆** | `~/.codeium/windsurf/memories/` | 工作区级（自动生成） | 仅本机 |

### 4.2 文件格式

- **Markdown (`.md`)**
- 工作区规则支持 **可选 YAML Frontmatter**

### 4.3 规则文件 Frontmatter

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

### 4.4 字符限制

| 类型 | 限制 |
|------|------|
| 全局规则 | 6,000 字符 |
| 工作区规则 | 12,000 字符/文件 |

### 4.5 优先级与发现

- 自动发现：当前工作区 → 子目录 → 父目录（直至 Git 根目录）
- 同级别规则去重
- 系统级 → 用户级 → 工作区级依次执行

### 4.6 AGENTS.md 特殊处理

- **根目录** AGENTS.md → `always_on` 模式
- **子目录** AGENTS.md → 自动 Glob 模式（匹配该目录下的文件）

_Source: [Windsurf Rules & Memories 文档](https://docs.windsurf.com/windsurf/cascade/memories)_

---

## 5. Gemini CLI — GEMINI.md + .gemini/ 体系

**产品定位：** Google 的 CLI 终端工具，架构类似 Claude Code
**置信度：** 🟡 中（文档从 GitHub README 获取，详细规格需查阅子文档）

### 5.1 指令文件体系

| 文件类型 | 位置 | 作用域 |
|----------|------|--------|
| **项目级** | `GEMINI.md`（项目根目录） | 项目全部成员 |
| **配置文件** | `~/.gemini/settings.json` | 用户全局 |
| **AGENTS.md** | 项目根目录或子目录 | 目录级 |

### 5.2 文件格式

- **纯 Markdown**（GEMINI.md）
- JSON（settings.json）

**关键特点：** Gemini CLI 同时读取 `GEMINI.md` 和 `AGENTS.md`，与 Copilot 支持多品牌指令文件（CLAUDE.md / GEMINI.md / AGENTS.md）的策略一致。

_Source: [Gemini CLI GitHub 仓库](https://github.com/google-gemini/gemini-cli)_

---

## 6. AGENTS.md — 跨 IDE 开放标准

**定位：** 由 Agentic AI Foundation（Linux Foundation 旗下）维护的开放标准
**置信度：** 🟢 高（官方网站 + GitHub 仓库 + 25+ 工具支持列表）

### 6.1 标准概述

AGENTS.md 定义为 **"a simple, open format for guiding coding agents"**——AI 编码代理的 README。它旨在提供一个 **专用、可预测的位置**，让 AI 编码代理获取项目上下文和指令。

### 6.2 格式规格

| 维度 | 规格 |
|------|------|
| **文件格式** | 纯 Markdown（标准语法） |
| **Frontmatter** | 无（纯内容） |
| **文件名** | `AGENTS.md`（大写） |
| **位置** | 仓库内任意目录 |
| **层级行为** | Monorepo 支持多文件；最近目录优先 |
| **Schema 验证** | 无正式 Schema |

### 6.3 推荐内容结构

```markdown
# Dev environment tips
- Commands for package management, installation, scaffolding

# Testing instructions
- CI workflows, test execution, linting, type-checking

# PR instructions
- Title formatting, pre-commit requirements
```

### 6.4 工具支持矩阵（25+ 工具）

| 支持方式 | 工具 |
|----------|------|
| **原生支持** | Cursor, Windsurf, GitHub Copilot, Gemini CLI, OpenAI Codex, Devin, JetBrains Junie, Zed, Warp, Aider, goose, opencode |
| **通过导入支持** | Claude Code（`@AGENTS.md`） |
| **其他** | Factory, UiPath Autopilot, RooCode, Kilo Code, Phoenix, Semgrep, Ona, Augment Code |

### 6.5 治理与标准化

- **维护方：** Agentic AI Foundation（Linux Foundation）
- **贡献者：** OpenAI, Amp, Cursor, Factory 等
- **设计原则：** Agent 无关性、工具兼容性、简洁性优先
- **成熟度评估：** 早期采用阶段（无正式 Schema、无版本号、无验证规范）

_Source: [AGENTS.md 官方网站](https://agents.md)、[GitHub 仓库](https://github.com/agentsmd/agents.md)_

---

## 7. 技术栈横向对比总览

### 7.1 指令文件格式矩阵

| 维度 | Claude Code | Cursor | Copilot | Windsurf | Gemini CLI | AGENTS.md 标准 |
|------|------------|--------|---------|----------|------------|---------------|
| **主文件名** | `CLAUDE.md` | — | `copilot-instructions.md` | — | `GEMINI.md` | `AGENTS.md` |
| **规则目录** | `.claude/rules/` | `.cursor/rules/` | `.github/instructions/` | `.windsurf/rules/` | `.gemini/` (推测) | — |
| **文件后缀** | `.md` | `.mdc` / `.md` | `.instructions.md` / `.md` | `.md` | `.md` | `.md` |
| **Frontmatter** | 可选（`paths`） | 可选（3 字段） | 可选（2 字段） | 可选（2 字段） | 无 | 无 |
| **Frontmatter 格式** | YAML | YAML | YAML | YAML | — | — |
| **AGENTS.md 支持** | 通过 `@AGENTS.md` 导入 | ✅ 原生 | ✅ 原生 | ✅ 原生 | ✅ 原生 | — |

### 7.2 作用域层级矩阵

| 层级 | Claude Code | Cursor | Copilot | Windsurf |
|------|------------|--------|---------|----------|
| **系统/策略级** | ✅ 托管策略 CLAUDE.md | ❌ | ✅ 组织指令 | ✅ 系统规则 |
| **用户级** | ✅ `~/.claude/CLAUDE.md` + rules/ | ✅ Settings | ✅ IDE Settings | ✅ 全局规则 |
| **项目级** | ✅ `./CLAUDE.md` + `.claude/rules/` | ✅ `.cursor/rules/` | ✅ `.github/copilot-instructions.md` | ✅ `.windsurf/rules/` |
| **目录级** | ✅ 子目录 CLAUDE.md（按需） | ✅ AGENTS.md 子目录 | ✅ AGENTS.md 就近原则 | ✅ AGENTS.md auto-glob |
| **文件级** | ✅ `paths` glob | ✅ `globs` | ✅ `applyTo` glob | ✅ `globs` glob |
| **团队/企业级** | ✅ 托管策略 | ✅ Dashboard | ✅ Organization | ✅ 云端仪表板 |

### 7.3 触发模式矩阵

| 触发模式 | Claude Code | Cursor | Copilot | Windsurf |
|----------|------------|--------|---------|----------|
| **无条件加载** | 无 `paths` 的规则 | `alwaysApply: true` | 仓库级指令 | `trigger: always_on` |
| **智能判断** | ❌ | `description` + 无 glob | ❌ | `trigger: model_decision` |
| **文件匹配** | `paths: [glob]` | `globs: [glob]` | `applyTo: glob` | `trigger: glob` + `globs` |
| **手动触发** | ❌ | `@规则名` | ❌ | `trigger: manual` + `@规则名` |
| **目录就近** | 子目录 CLAUDE.md | AGENTS.md | AGENTS.md | AGENTS.md (auto-glob) |

### 7.4 Frontmatter 字段对比

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

### 7.5 独有能力对比

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

# DR2: AI Coding 框架文档管理

> **研究日期：** 2026-03-31
> **数据来源：** Claude Code 官方文档、Cursor Docs、GitHub Copilot 文档、Windsurf 文档、Aider 文档

---

## 2.1 领域定义与问题背景

**AI Coding 框架文档管理**，指的是开发者如何向 AI 编程助手提供持久化的项目知识和行为规则，使其在每次会话中都能理解项目上下文、遵守编码规范、执行正确工作流。

**核心挑战：**

每个 AI Coding 工具都基于大型语言模型，天然无状态——每次新会话上下文归零。解决这个问题的关键机制是：**将项目知识外化为文档文件，在每次会话启动时注入上下文**。

这就形成了一个新的开发者工作流问题：**"如何管理 AI 的规则文档？"**——这正是 CORD 产品的核心机会所在。

---

## 2.2 主流 AI Coding 工具文档管理机制横向比较

### 2.2.1 Claude Code（Anthropic）

**核心机制：双轨记忆系统**

| 机制 | 写入方 | 内容类型 | 范围 | 加载时机 |
|------|--------|---------|------|---------|
| **CLAUDE.md 文件** | 开发者手写 | 指令和规则 | 项目/用户/组织 | 每次会话启动 |
| **Auto Memory（自动记忆）** | Claude 自动写入 | 学习到的模式和偏好 | 单工作区 | 每次会话（前 200 行或 25KB） |

**CLAUDE.md 文件层级体系（4 层）：**

| 范围 | 位置 | 用途 | 共享方式 |
|------|------|------|---------|
| **托管策略** | macOS: `/Library/Application Support/ClaudeCode/CLAUDE.md` | 组织级编码标准、合规要求 | IT 统一下发，不可排除 |
| **项目级** | `./CLAUDE.md` 或 `./.claude/CLAUDE.md` | 项目架构、编码规范、工作流 | 通过版本控制团队共享 |
| **用户级** | `~/.claude/CLAUDE.md` | 个人偏好、工具快捷键 | 仅本机所有项目 |
| **子目录级** | `subdirectory/CLAUDE.md` | 特定子模块规则 | 按需加载（访问该目录时） |

**进阶功能：**
- **`.claude/rules/` 目录**：按主题拆分规则文件（如 `testing.md`、`api-design.md`），支持 YAML frontmatter 的 `paths` 字段实现**路径级规则**（仅当操作匹配文件时加载）
- **`@path` 导入语法**：可在 CLAUDE.md 中引用外部文件（README、package.json 等），最多 5 层递归
- **`AGENTS.md` 兼容**：可通过 `@AGENTS.md` 导入，实现多 AI 工具共享规则
- **组织级排除**：`claudeMdExcludes` 设置支持在 monorepo 中跳过无关团队的 CLAUDE.md

**Auto Memory 存储结构：**
```
~/.claude/projects/<project>/memory/
├── MEMORY.md          # 主索引（每次加载前 200 行/25KB）
├── debugging.md       # 调试模式笔记
├── api-conventions.md # API 设计决策
└── ...                # Claude 自动创建的主题文件
```

**最佳实践要求：**
- 每个 CLAUDE.md 文件目标 **200 行以内**（超出降低遵从率）
- 使用 Markdown 标题和列表组织结构
- 指令要具体可验证："使用 2 空格缩进" 而非 "格式化代码"

_来源：[code.claude.com/docs/en/memory](https://code.claude.com/docs/en/memory)_

---

### 2.2.2 Cursor

**核心机制：Project Rules 系统**

规则文件存储于 `.cursor/rules/` 目录，使用 `.md` 或 `.mdc` 格式，版本控制友好。

**四种规则激活模式：**

| 激活模式 | 触发条件 | frontmatter 配置 |
|---------|---------|----------------|
| **Always Apply（始终应用）** | 每次 Chat 会话自动加载 | `alwaysApply: true` |
| **Apply Intelligently（智能应用）** | Agent 根据描述判断是否相关 | `description: "..."` + `alwaysApply: false` |
| **Apply to Specific Files（文件匹配）** | 当操作文件路径匹配 glob 时激活 | `globs: ["**/*.ts"]` |
| **Apply Manually（手动应用）** | 用户在 Chat 中 `@rule-name` 显式引用 | 无 `alwaysApply`，无 `globs` |

**规则文件格式示例：**
```markdown
---
description: "TypeScript API 开发规范"
alwaysApply: false
globs: ["src/api/**/*.ts"]
---

# API 规则
- 所有端点必须包含输入验证
- 使用标准错误响应格式
```

**层级优先级：** Team Rules → Project Rules → User Rules

**注：** `.cursorrules` 文件（旧版全局规则）已被新版 `.cursor/rules/` 系统取代，但社区仍广泛使用旧格式。

_来源：[cursor.com/docs/context/rules](https://cursor.com/docs/context/rules)_

---

### 2.2.3 GitHub Copilot（Microsoft）

**核心机制：多层次指令文件系统**

| 文件 | 位置 | 作用范围 | 说明 |
|------|------|---------|------|
| **`copilot-instructions.md`** | `.github/` | 全仓库基础指令 | 自动附加到所有 Copilot 请求 |
| **`NAME.instructions.md`** | `.github/instructions/` | 路径特定指令 | frontmatter 中 `applyTo` 指定 glob 匹配 |
| **`AGENTS.md`、`CLAUDE.md`、`GEMINI.md`** | 任意目录 | Agent 专属配置 | 就近原则（最近父目录优先） |
| **`.prompt.md` 文件（预览版）** | `.github/prompts/` | 可复用 prompt 模板 | VS Code、Visual Studio、JetBrains 支持 |

**优先级：** 个人设置 > 仓库级 > 组织级

**内容规范（官方建议）：**
- 文档项目架构和目的
- 构建、测试、验证流程
- 文件布局和配置位置
- CI/CD 工作流和验证步骤
- 依赖项和已知解决方案
- 限制在 **2 页以内**（约 400-600 字），不写任务特定语言

_来源：[docs.github.com/en/copilot/customizing-copilot/adding-custom-instructions-for-github-copilot](https://docs.github.com/en/copilot/customizing-copilot/adding-custom-instructions-for-github-copilot)_

---

### 2.2.4 Windsurf（Codeium）

**核心机制：Rules + Memories 双系统**

**规则文件位置（4 层）：**

| 层级 | 位置 | 范围 | 大小限制 |
|------|------|------|---------|
| **企业系统级** | macOS: `/Library/Application Support/Windsurf/rules/` | 全机器 | — |
| **全局用户级** | `~/.codeium/windsurf/memories/global_rules.md` | 所有工作区 | **6,000 字符** |
| **工作区级** | `.windsurf/rules/*.md` | 当前项目 | **12,000 字符/文件** |
| **AGENTS.md** | 任意目录 | 该目录及子目录 | — |

**规则激活模式（frontmatter `trigger` 字段）：**

| 模式 | 触发条件 |
|------|---------|
| `always_on` | 系统提示中始终包含 |
| `model_decision` | 显示描述，Cascade 按需读取完整内容 |
| `glob` | 匹配文件被访问时激活 |
| `manual` | `@rule-name` 手动引用 |

**自动记忆（Auto Memory）：**
- 存储位置：`~/.codeium/windsurf/memories/`（本地、工作区绑定，不跨工作区）
- 无信用点消耗
- 官方建议：**"将持久知识写入规则或 AGENTS.md，而非依赖自动记忆"**（以保证团队可靠性）

_来源：[docs.windsurf.com/windsurf/cascade/memories](https://docs.windsurf.com/windsurf/cascade/memories)_

---

### 2.2.5 Aider

**核心机制：约定文件（CONVENTIONS.md）**

最简化的文档管理方式：
- 创建 `CONVENTIONS.md` 记录编码规范（偏好库、类型注解、代码风格等）
- 通过 `/read CONVENTIONS.md` 在会话中加载，或在 `.aider.conf.yml` 中配置持久化
- 标记为只读文件，启用 **prompt caching** 降低 API 成本
- 社区共享：[github.com/Aider-AI/conventions](https://github.com/Aider-AI/conventions) 开源规范文件库

_来源：[aider.chat/docs/usage/conventions.html](https://aider.chat/docs/usage/conventions.html)_

---

## 2.3 跨工具横向比较矩阵

| 维度 | Claude Code | Cursor | GitHub Copilot | Windsurf | Aider |
|------|-------------|--------|---------------|---------|-------|
| **规则文件名** | `CLAUDE.md` | `.cursor/rules/*.md` | `copilot-instructions.md` | `.windsurf/rules/*.md` | `CONVENTIONS.md` |
| **层级数量** | 4 层 | 3 层 | 3 层 | 4 层 | 1 层 |
| **路径级规则** | ✅ `paths` frontmatter | ✅ `globs` frontmatter | ✅ `applyTo` frontmatter | ✅ `glob` trigger | ❌ |
| **自动记忆** | ✅ MEMORY.md 系统 | ❌ | ❌ | ✅ 自动生成 | ❌ |
| **版本控制友好** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **组织级管理** | ✅ 托管策略文件 | ✅ Team Rules | ✅ 组织级指令 | ✅ 系统级规则 | ❌ |
| **AGENTS.md 兼容** | ✅（via @import） | ❌ | ✅ | ✅ | ❌ |
| **文件大小限制** | 200 行/文件（建议） | 无明确限制 | ~2 页（建议） | 12,000 字符/文件 | 无明确限制 |
| **导入/引用机制** | ✅ `@path` 语法 | ✅ `@filename.ts` | ✅ Markdown 链接 | ❌ | ❌ |

---

## 2.4 行业痛点深度分析

通过跨平台文档研究，识别出 AI Coding 框架文档管理的核心痛点：

### 痛点 1：文档碎片化 — 多工具、多文件、无统一中心
- **现象**：开发者同时使用 Claude Code（CLAUDE.md）、Cursor（.cursor/rules/）、Copilot（.github/copilot-instructions.md），同样的规则需要在 3 个地方维护
- **影响**：规则不一致 → AI 工具给出矛盾建议；维护成本翻倍
- **严重程度**：🔴 极高（每个额外工具线性增加维护负担）

### 痛点 2：文档过时 — 规则与代码不同步
- **现象**：项目架构变化后，CLAUDE.md 中的旧规则未更新；Cursor Rules 指向已删除的文件路径
- **影响**：AI 基于过时规则产生错误建议，开发者逐渐失去对 AI 输出的信任
- **严重程度**：🔴 极高（静默失效，难以察觉）

### 痛点 3：上下文溢出 — 文档越大越失效
- **现象**：Claude Code 官方警告超过 200 行会降低遵从率；Windsurf 硬限制 12,000 字符
- **根因**：所有规则在每次会话中全量注入，文档越大消耗上下文越多，遵从率越低
- **影响**：团队为解决此问题手动拆分文件，但拆分后又难以维护全局一致性
- **严重程度**：🟠 高（与项目规模正相关，大型项目必然触达上限）

### 痛点 4：团队协作断层 — 个人规则与团队规则的边界模糊
- **现象**：
  - 用户级规则（如 `~/.claude/CLAUDE.md`）在本机有效，其他团队成员看不到
  - 项目级规则通过 Git 共享，但个人定制无法合并
  - Windsurf 自动记忆"不跨工作区、不跨机器"
- **影响**：团队 AI 体验不一致；高级工程师积累的 AI 规则无法传递给新成员
- **严重程度**：🟠 高（团队越大，一致性问题越严重）

### 痛点 5：规则质量评估缺失
- **现象**：开发者不知道 AI 是否"真的在遵守"某条规则
- **现有应对**：Claude Code 提供 `/memory` 命令查看加载的规则；但没有"规则有效性"的系统性追踪
- **影响**：规则可能冲突（两条矛盾规则导致 AI 随机选择）而开发者无从知晓
- **严重程度**：🟡 中（影响规则迭代效率）

### 痛点 6：跨工具规则迁移成本高
- **现象**：从 Cursor 迁移到 Claude Code 需要将 `.cursor/rules/` 手动转换为 CLAUDE.md 格式
- **影响**：工具切换成本高，形成平台锁定效应；开发团队难以尝试新 AI 工具
- **严重程度**：🟡 中（影响工具生态多样性）

---

## 2.5 行业解决方案现状

目前行业的解决尝试：

| 方案 | 代表性工具/方法 | 解决的问题 | 局限性 |
|------|--------------|----------|--------|
| **AGENTS.md 标准** | Windsurf、GitHub Copilot 采用 | 跨工具共享规则 | 仅部分工具支持；结构无规范 |
| **路径级规则** | Claude Code paths、Cursor globs | 上下文溢出（按需加载） | 手动维护 glob 模式；无自动推断 |
| **Auto Memory** | Claude Code、Windsurf | 自动积累项目知识 | 不可团队共享；内容不可审计 |
| **规则导入/引用** | Claude Code `@import`、Copilot prompt files | 模块化管理 | 各平台语法不兼容 |
| **社区约定仓库** | Aider conventions repo、cursor.directory | 分享最佳实践 | 被动分享，无集成工作流 |

**空白地带**：目前没有任何工具提供：
1. 跨平台文档规范化和自动同步
2. 规则与代码关系的可视化图谱
3. 规则有效性评估和过时检测
4. 团队知识沉淀的结构化工作流

---

## 2.6 对 CORD 产品设计的关键洞察

### 核心机会

**机会 1：成为"AI 规则文档的单一真相源（Single Source of Truth）"**
- 开发者在 CORD 中维护一套规则
- CORD 自动同步/导出到各工具格式（CLAUDE.md、.cursor/rules/、copilot-instructions.md 等）
- 解决最高优先级痛点：碎片化和不一致性

**机会 2：文档与代码的关系感知**
- 检测代码变更 → 自动标记相关规则为"可能过时"
- 解决痛点 2（文档过时）的根本问题

**机会 3：智能上下文分片（Context Slicing）**
- 根据当前任务自动选择相关规则子集
- 避免超出工具的文档大小限制
- 解决痛点 3（上下文溢出）

**机会 4：团队知识沉淀流水线**
- 将 Auto Memory 的内容结构化后推入版本控制的团队规则
- 将个人最佳实践转化为团队规范
- 解决痛点 4（团队协作断层）

### 竞争定位

CORD 不是另一个 AI 编程工具，而是 **AI 编程工具的文档基础设施层**：
- 现有工具（Claude Code、Cursor 等）是 CORD 的**消费者**，而非竞争者
- CORD 越被更多工具采用，价值越高（网络效应）

### 格式标准化机会

各主流工具的规则格式相似度高（均为 Markdown + YAML frontmatter），表明存在**格式标准化**的技术可行性——CORD 可以定义并推动一个通用的 AI 规则文档格式标准。

---

## DR2 研究小结

**AI Coding 框架文档管理正成为开发者工作流的核心基础设施需求：**

- 5 大主流工具（Claude Code、Cursor、Copilot、Windsurf、Aider）均已建立各自的规则文档系统，但**互不兼容**
- 所有工具都采用 **Markdown + YAML frontmatter** 的技术底层，表明格式统一具有可行性
- **6 大痛点**明确：碎片化、过时、上下文溢出、团队断层、质量缺失、迁移成本
- 目前**无任何工具**系统性解决跨平台文档管理问题——这是 CORD 的核心机会

**CORD 核心价值命题验证**：AI Coding 工具的爆炸性增长（MCP 生态 20,000+ 服务器，多款主流 IDE 支持）直接放大了文档管理问题的严重程度——工具越多，碎片化越严重，CORD 的价值越大。

_研究完成日期：2026-03-31_
_置信度：高（数据来自 5 个平台官方文档，均有可验证来源）_

---

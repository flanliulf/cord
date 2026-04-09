# Integration Patterns Analysis

> 本章节聚焦于 CORD 如何与各 IDE 的指令文件体系集成——包括指令片段的格式转换、注入策略、非破坏性合并、冲突检测与版本管理。这是 CORD `npx cord init` 指令层实现的核心设计依据。

## 1. CORD 指令片段的集成需求

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

## 2. 各 IDE 指令片段注入路径

### 2.1 Claude Code 注入路径

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

# 修改文档后
当你修改了 Markdown 文档（.md / .mdx 文件）时：
1. 修改完成后，调用 `cord_update_relations` 工具更新该文档的关系
2. 如果修改涉及到链接/引用变化，同步更新关联文档的关系

# 理解文档上下文
当你需要理解某个文档的上下文时：
1. 调用 `cord_get_context` 获取关联文档信息
2. 根据上下文信息提供更准确的编辑建议

# 首次接入
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

### 2.2 Cursor 注入路径

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

### 2.3 GitHub Copilot 注入路径

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

### 2.4 Windsurf 注入路径

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

### 2.5 AGENTS.md 通用兜底路径

**方案：在 AGENTS.md 中追加 CORD 片段**

```
AGENTS.md  ← 追加 CORD 片段（需要非破坏性合并）
```

**追加内容：**
```markdown
<!-- CORD:BEGIN -->
# CORD - 文档关系维护

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

## 3. 跨 IDE 指令片段格式转换管道

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

### 3.1 CORD Instruction IR 数据模型

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

### 3.2 格式转换器接口

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

### 3.3 各 IDE 格式转换规则

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

## 4. 非破坏性合并策略

### 4.1 合并策略矩阵

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

## 5. Frontmatter 解析与生成工具链

CORD 需要一个健壮的工具链来解析和生成各 IDE 的 Frontmatter：

### 5.1 工具选型

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

### 5.2 格式兼容性矩阵

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

## 6. 版本管理与升级策略

### 6.1 版本检测机制

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

### 6.2 升级安全性

| 文件类型 | 升级策略 | 用户内容风险 |
|----------|----------|-------------|
| 独立规则文件（Claude/Cursor/Copilot/Windsurf） | 整文件覆盖 | ⚠️ 低（CORD 独占文件） |
| AGENTS.md 标记区块 | 仅替换标记区块内容 | ✅ 零（不影响用户区域） |
| MCP 配置文件 | 合并 JSON 对象 | ⚠️ 低（仅添加 `cord` 条目） |

---

## 7. IDE 配置检测策略

`cord init` 需要自动检测用户项目中存在哪些 IDE 配置，以决定生成哪些指令文件：

### 7.1 检测信号矩阵

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

### 7.2 交互式配置流程

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

## 8. MCP Server 配置注入

除指令文件外，CORD 还需要向各 IDE 的 MCP 配置文件注入 MCP Server 条目：

### 8.1 MCP 配置文件矩阵

| IDE | MCP 配置文件 | 格式 | 注入方式 |
|-----|-------------|------|----------|
| **Claude Code** | `.claude/settings.json` | JSON | 合并 `mcpServers.cord` |
| **Cursor** | `.cursor/mcp.json` | JSON | 合并 `mcpServers.cord` |
| **Copilot** | `.vscode/mcp.json` | JSON | 合并 `servers.cord` |
| **Windsurf** | `~/.codeium/windsurf/mcp_config.json` | JSON | 合并 `mcpServers.cord` |

### 8.2 JSON 合并策略

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

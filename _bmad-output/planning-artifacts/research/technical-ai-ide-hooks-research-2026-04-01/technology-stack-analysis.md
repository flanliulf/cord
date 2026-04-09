# Technology Stack Analysis

> 本章节对四大 AI IDE 的 Hooks / 自动化机制进行全面的技术栈分析，覆盖架构模型、事件体系、配置方式、扩展能力等核心维度。

## 1. Claude Code Hooks — 最完整的命令行级事件钩子体系

**产品定位：** CLI 终端工具（非 GUI IDE），通过 `settings.json` 配置钩子
**置信度：** 🟢 高（官方文档详尽，2026 年 4 月最新版本）

### 1.1 架构模型

Claude Code Hooks 采用 **事件驱动 + 命令执行** 架构，在 AI Agent 生命周期的关键节点触发用户自定义的 Shell 命令、HTTP 请求、LLM Prompt 或子 Agent。

**核心设计理念：**
- 覆盖 AI Agent 完整生命周期（从会话启动到结束）
- 支持 **阻断式 (blocking)** 和 **非阻断式 (non-blocking)** 两种模式
- 通过 JSON stdin/stdout 实现结构化数据交换
- 多层配置合并（用户级 → 项目级 → 组织策略级）

### 1.2 事件类型（20+ 种）

| 类别 | 事件名 | 可阻断 | 触发时机 |
|------|--------|--------|----------|
| **会话生命周期** | `SessionStart` | ❌ | 会话启动/恢复/清空/压缩 |
| | `SessionEnd` | ❌ | 会话终止 |
| **用户输入** | `UserPromptSubmit` | ✅ | 用户提交 prompt 前 |
| **工具执行** | `PreToolUse` | ✅ | 工具执行前（可拦截/修改/放行） |
| | `PostToolUse` | ❌ | 工具执行成功后 |
| | `PostToolUseFailure` | ❌ | 工具执行失败后 |
| **权限控制** | `PermissionRequest` | ✅ | 权限对话框出现前 |
| **子 Agent** | `SubagentStart` | ❌ | 子 Agent 启动 |
| | `SubagentStop` | ✅ | 子 Agent 完成 |
| **任务管理** | `TaskCreated` | ✅ | 任务创建 |
| | `TaskCompleted` | ✅ | 任务完成 |
| **响应控制** | `Stop` | ✅ | Claude 完成响应（可阻止停止） |
| | `StopFailure` | ❌ | API 错误导致中断 |
| | `TeammateIdle` | ✅ | 团队成员即将空闲 |
| **上下文管理** | `PreCompact` / `PostCompact` | ❌ | 上下文压缩前/后 |
| | `InstructionsLoaded` | ❌ | CLAUDE.md 加载时 |
| **文件/配置** | `ConfigChange` | ✅ | 配置文件变更 |
| | `CwdChanged` | ❌ | 工作目录变更 |
| | `FileChanged` | ❌ | 监视的文件变更 |
| **工作树** | `WorktreeCreate` / `WorktreeRemove` | 部分 | 工作树创建/移除 |
| **MCP 交互** | `Elicitation` / `ElicitationResult` | ✅ | MCP 用户输入请求 |
| **通知** | `Notification` | ❌ | 通知发送 |

### 1.3 Hook 处理器类型（4 种）

| 类型 | 说明 | 典型用途 |
|------|------|----------|
| `command` | 执行 Shell 命令，通过 stdin 接收 JSON | 文件验证、脚本触发、日志记录 |
| `http` | 发送 JSON POST 到 HTTP 端点 | 远程服务集成、Webhook |
| `prompt` | 将事件发送给 LLM 模型评估 | 安全审查、代码规范检查 |
| `agent` | 启动子 Agent 执行验证任务 | 复杂条件验证、测试运行 |

### 1.4 配置层级（6 级合并）

```
1. ~/.claude/settings.json              — 用户全局
2. .claude/settings.json                — 项目级（可共享）
3. .claude/settings.local.json          — 项目级（gitignore）
4. 组织策略设置                          — 管理策略
5. 插件 hooks/hooks.json                — 插件启用时
6. Skill/Agent frontmatter              — 组件激活时
```

### 1.5 Matcher 模式

通过正则表达式精确过滤事件触发范围：
- 工具事件：`Bash`、`Edit|Write`、`mcp__.*`
- 会话事件：`startup`、`resume`、`clear`
- MCP 工具：`mcp__<server>__<tool>`（支持通配符）
- 文件变更：文件名匹配（如 `.envrc`、`.env`）

### 1.6 退出码语义

| 退出码 | 含义 | 效果 |
|--------|------|------|
| `0` | 成功 | 解析 stdout JSON，继续执行 |
| `2` | 阻断错误 | 拦截操作，将 stderr 反馈给 Claude |
| 其他 | 非阻断错误 | stderr 在 verbose 模式显示，继续执行 |

### 1.7 关键能力：输入修改

`PreToolUse` 的 `updatedInput` 字段可以 **修改工具的输入参数**，例如将 `rm -rf /` 重写为安全命令。这是其他 IDE 不具备的能力。

_Source: [Claude Code Hooks 官方文档](https://code.claude.com/docs/en/hooks)_

---

## 2. Windsurf Cascade Hooks — 企业级事件钩子体系

**产品定位：** VS Code fork IDE，内置 Cascade AI Agent
**置信度：** 🟢 高（官方文档详尽）

### 2.1 架构模型

Windsurf 采用与 Claude Code 类似的 **事件驱动 + Shell 命令执行** 架构，但事件类型更聚焦于 "读/写/执行" 三大核心操作。

**核心设计理念：**
- 围绕代码操作的 pre/post 对称事件模型
- 三级配置层级（系统级 → 用户级 → 工作区级）
- 企业级部署支持（MDM、配置管理工具）
- 仅支持 Shell 命令类型（无 HTTP/Prompt/Agent 类型）

### 2.2 事件类型（12 种）

| 类别 | 事件名 | 可阻断 | 触发时机 |
|------|--------|--------|----------|
| **文件读取** | `pre_read_code` | ✅ | 读取文件前 |
| | `post_read_code` | ❌ | 读取文件后 |
| **代码写入** | `pre_write_code` | ✅ | 修改代码前 |
| | `post_write_code` | ❌ | 修改代码后 |
| **命令执行** | `pre_run_command` | ✅ | 终端命令执行前 |
| | `post_run_command` | ❌ | 终端命令执行后 |
| **MCP 工具** | `pre_mcp_tool_use` | ✅ | MCP 工具调用前 |
| | `post_mcp_tool_use` | ❌ | MCP 工具调用后 |
| **用户输入** | `pre_user_prompt` | ✅ | 用户 prompt 处理前 |
| **AI 响应** | `post_cascade_response` | ❌ | AI 响应完成后（Markdown 摘要） |
| | `post_cascade_response_with_transcript` | ❌ | AI 响应完成后（完整 JSONL 转录） |
| **工作树** | `post_setup_worktree` | ❌ | 工作树创建后 |

### 2.3 配置层级（3 级 + 云端）

| 层级 | 路径 | 用途 |
|------|------|------|
| **系统级** | macOS: `/Library/Application Support/Windsurf/hooks.json`<br>Linux: `/etc/windsurf/hooks.json` | 组织强制策略 |
| **用户级** | `~/.codeium/windsurf/hooks.json` | 个人偏好 |
| **工作区级** | `.windsurf/hooks.json` | 项目特定策略 |
| **云端仪表板** | Team Settings | 团队/企业管理 |

同级别的 Hooks 按 **系统 → 用户 → 工作区** 顺序依次执行。

### 2.4 配置格式

```json
{
  "hooks": {
    "pre_write_code": [
      {
        "command": "/path/to/validate.sh",
        "show_output": true,
        "working_directory": "/optional/path"
      }
    ]
  }
}
```

**输入字段（通过 stdin JSON）：**
- `agent_action_name` — Hook 事件标识
- `trajectory_id` — 对话唯一标识
- `execution_id` — Agent 回合唯一标识
- `timestamp` — ISO 8601 时间戳
- `tool_info` — 事件特定数据（文件路径、编辑内容、命令行等）

### 2.5 退出码语义

与 Claude Code 一致：`0` = 成功，`2` = 阻断（仅 pre-hooks），其他 = 非阻断错误。

_Source: [Windsurf Cascade Hooks 文档](https://docs.windsurf.com/windsurf/cascade/hooks)_

---

## 3. Cursor — Rules 指令体系（无原生 Hooks）

**产品定位：** VS Code fork IDE，内置 AI Agent
**置信度：** 🟢 高（官方文档验证）

### 3.1 架构模型

Cursor **不具备** 事件驱动的 Hooks 机制。其自动化/定制化能力完全依赖 **Rules（指令规则）** 体系——通过向 AI 提供上下文指令来影响其行为，而非在操作前后执行外部命令。

**核心设计理念：**
- 声明式指令注入（非命令执行）
- 通过 AI 理解和遵循规则来间接控制行为
- 多种触发模式（Always / 智能判断 / Glob / 手动）
- 支持 `.mdc` / `.md` 格式的规则文件

### 3.2 规则类型

| 类型 | 存储位置 | 作用域 |
|------|----------|--------|
| **Project Rules** | `.cursor/rules/*.mdc` / `.md` | 项目级（可版本控制） |
| **User Rules** | Cursor Settings | 全局（所有项目） |
| **Team Rules** | Cursor Dashboard | 团队/企业（远程管理） |
| **AGENTS.md** | 项目根目录或子目录 | 目录级 |

### 3.3 规则触发模式

| 模式 | 行为 | 上下文开销 |
|------|------|------------|
| **Always Apply** | 每次对话都注入 | 每条消息 |
| **Apply Intelligently** | Agent 根据 description 判断是否相关 | Description 始终存在，全文按需 |
| **Apply to Specific Files** | 文件匹配 glob 模式时注入 | 仅匹配文件时 |
| **Apply Manually** | 用户 `@规则名` 手动触发 | 仅手动触发时 |

### 3.4 规则文件格式

```yaml
---
description: "TypeScript 编码规范"
alwaysApply: false
globs: ["**/*.ts", "src/components/**"]
---

# TypeScript 编码规范

- 使用严格模式
- 所有函数必须有返回类型注解
- 优先使用 interface 而非 type
```

### 3.5 关键局限

- **无事件驱动钩子** — 无法在操作前后执行外部命令
- **无阻断能力** — 不能阻止 AI 执行特定操作
- **无结构化输入/输出** — 规则是纯文本指令，非 JSON 数据交换
- **不影响 Cursor Tab 和内联编辑** — Rules 仅作用于 Agent/Chat

**优先级：** Team Rules → Project Rules → User Rules

_Source: [Cursor Rules 文档](https://cursor.com/docs/rules)_

---

## 4. GitHub Copilot — Custom Instructions + Extensions（无原生 Hooks）

**产品定位：** 多 IDE 插件（VS Code / JetBrains / Xcode 等）
**置信度：** 🟡 中高（Custom Instructions 文档清晰，Extensions API 较分散）

### 4.1 架构模型

GitHub Copilot **不具备** 原生 Hooks 机制。其定制化能力分为两个层面：

1. **Custom Instructions（自定义指令）** — 类似 Cursor Rules 的声明式指令注入
2. **Extensions（扩展）** — 通过 VS Code Extension API 或 GitHub App 构建自定义 Chat Participants

### 4.2 Custom Instructions 体系

| 配置文件 | 位置 | 作用域 |
|----------|------|--------|
| **仓库级指令** | `.github/copilot-instructions.md` | 整个仓库 |
| **路径级指令** | `.github/instructions/*.instructions.md` | 匹配 glob 的文件 |
| **Agent 指令** | `AGENTS.md` / `CLAUDE.md` / `GEMINI.md` | Agent 级别 |
| **个人指令** | IDE Settings | 用户全局 |
| **组织指令** | GitHub Organization Settings | 组织级 |

**优先级：** 个人指令 > 仓库指令 > 组织指令

**路径级指令 Frontmatter：**
```markdown
---
applyTo: "**/*.ts,**/*.tsx"
---
使用 TypeScript strict mode...
```

**排除机制：** 支持 `excludeAgent` frontmatter 字段（可排除 `code-review` 或 `coding-agent`）。

### 4.3 VS Code Chat Extensions API

通过 VS Code Extension API 构建 **Chat Participants**：
- 使用 `vscode.chat.createChatParticipant()` 注册参与者
- 用户通过 `@参与者名` 触发
- 支持 slash commands（`/命令名`）
- 可调用 `vscode.lm.tools` 实现工具调用
- 支持丰富的输出格式（Markdown、代码块、按钮、文件树等）

### 4.4 MCP Server 集成

GitHub Copilot 支持通过 MCP Server 扩展工具能力：
- 支持本地和远程 MCP Server
- 通过 GitHub MCP Registry 发现可用 Server
- 提供 GitHub MCP Server 用于自动化代码任务

### 4.5 关键局限

- **无事件钩子** — 无法在操作前后自动触发外部命令
- **无阻断能力** — Custom Instructions 是建议性指令，非强制执行
- **扩展开发门槛高** — 需要构建完整的 VS Code 扩展或 GitHub App
- **跨 IDE 一致性有限** — Chat Participants API 仅限 VS Code

_Source: [GitHub Copilot Custom Instructions](https://docs.github.com/en/copilot/customizing-copilot/adding-custom-instructions-for-github-copilot)，[VS Code Chat Extensions](https://code.visualstudio.com/api/extension-guides/chat)_

---

## 5. 技术栈横向对比总览

### 5.1 Hooks/自动化能力矩阵

| 能力维度 | Claude Code | Windsurf | Cursor | GitHub Copilot |
|----------|------------|----------|--------|----------------|
| **原生事件 Hooks** | ✅ 20+ 事件 | ✅ 12 事件 | ❌ 无 | ❌ 无 |
| **Pre-action 阻断** | ✅ | ✅ | ❌ | ❌ |
| **Post-action 回调** | ✅ | ✅ | ❌ | ❌ |
| **工具输入修改** | ✅ `updatedInput` | ❌ | ❌ | ❌ |
| **Shell 命令执行** | ✅ | ✅ | ❌ | ❌ |
| **HTTP Webhook** | ✅ | ❌ | ❌ | ❌ |
| **LLM Prompt Hook** | ✅ | ❌ | ❌ | ❌ |
| **Agent Hook** | ✅ | ❌ | ❌ | ❌ |
| **声明式规则/指令** | ✅ CLAUDE.md | ✅ Rules + AGENTS.md | ✅ Rules + AGENTS.md | ✅ Instructions + AGENTS.md |
| **Glob 文件匹配** | ✅ Matcher | ✅ Glob trigger | ✅ Glob pattern | ✅ applyTo glob |
| **MCP Server** | ✅ | ✅ | ✅ | ✅ |
| **配置层级数** | 6 级 | 4 级 | 3 级 | 3 级 |
| **企业部署** | 策略设置 | MDM / 云端 | Dashboard | Organization |

### 5.2 事件覆盖对比（Claude Code vs Windsurf）

| CORD 触发场景 | Claude Code 事件 | Windsurf 事件 |
|---------------|-----------------|--------------|
| 文件被读取时 | `PreToolUse` (matcher: `Read`) | `pre_read_code` / `post_read_code` |
| 文件被修改时 | `PreToolUse` / `PostToolUse` (matcher: `Edit\|Write`) | `pre_write_code` / `post_write_code` |
| 命令执行时 | `PreToolUse` / `PostToolUse` (matcher: `Bash`) | `pre_run_command` / `post_run_command` |
| MCP 工具调用 | `PreToolUse` / `PostToolUse` (matcher: `mcp__.*`) | `pre_mcp_tool_use` / `post_mcp_tool_use` |
| 用户提交 prompt | `UserPromptSubmit` | `pre_user_prompt` |
| AI 响应完成 | `Stop` | `post_cascade_response` |
| 会话启动 | `SessionStart` | ❌ 无 |
| 文件系统变化 | `FileChanged` | ❌ 无 |
| 配置变更 | `ConfigChange` | ❌ 无 |
| 指令文件加载 | `InstructionsLoaded` | ❌ 无 |

### 5.3 技术实现对比

| 技术维度 | Claude Code | Windsurf | Cursor | Copilot |
|----------|------------|----------|--------|---------|
| **运行时** | Node.js CLI | VS Code Electron | VS Code Electron | 多 IDE 插件 |
| **配置格式** | JSON (settings.json) | JSON (hooks.json) | YAML frontmatter + MD | MD + YAML frontmatter |
| **数据交换** | JSON stdin/stdout | JSON stdin/stdout | 纯文本注入 | 纯文本注入 |
| **处理器语言** | 任意 Shell 命令 | 任意 Shell 命令 | N/A | N/A (需 Extension) |
| **超时控制** | ✅ 可配置 | ❌ 未提供 | N/A | N/A |
| **异步执行** | ✅ `async: true` | ❌ | N/A | N/A |

_Source: 综合以上各 IDE 官方文档_

# Integration Patterns Analysis

> 本章节聚焦于 CORD 项目如何利用各 AI IDE 的 Hooks/Rules/MCP 机制实现文档关系的自动触发与更新，设计跨 IDE 的统一集成架构。

## 1. CORD 触发层核心需求

CORD 的触发层需要在以下场景自动感知文档变化并更新关系图谱：

| 触发场景 | 优先级 | 说明 |
|----------|--------|------|
| **文件修改后** | 🔴 P0 | AI 编辑/写入文档后，自动检测关系变化 |
| **文件读取时** | 🟡 P1 | AI 读取文档时，提供相关文档的上下文信息 |
| **会话启动时** | 🟡 P1 | 新会话开始时，加载项目文档关系图谱 |
| **MCP Tool 手动调用** | 🔴 P0 | 用户/AI 主动查询或更新文档关系（所有 IDE 的兜底方案） |
| **冷启动扫描** | 🟠 P2 | 首次接入项目时全量扫描（参见 TR6） |

## 2. 集成模式分层架构

基于 Step 2 的技术栈分析，CORD 的触发层应采用 **三层分级集成架构**：

```
┌─────────────────────────────────────────────────────────────────┐
│                     Layer 1: MCP Tools（通用层）                 │
│           所有 IDE 均支持 — CORD 的核心交互接口                   │
│  cord_query_relations / cord_update_relations / cord_scan / ... │
└─────────────────────────┬───────────────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────────────┐
│                  Layer 2: 指令引导层（声明式）                    │
│     CLAUDE.md / .cursor/rules / .windsurf/rules / AGENTS.md     │
│     "当修改文档时，请调用 cord_update_relations 更新关系"         │
└─────────────────────────┬───────────────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────────────┐
│                Layer 3: 原生 Hooks（自动触发层）                  │
│             仅 Claude Code + Windsurf 支持                       │
│   PostToolUse → 自动调用 CORD CLI 更新关系（零用户感知）          │
└─────────────────────────────────────────────────────────────────┘
```

## 3. Layer 1: MCP Tools 通用集成模式

**覆盖 IDE：** Claude Code ✅ / Cursor ✅ / GitHub Copilot ✅ / Windsurf ✅
**置信度：** 🟢 高（TR2 已验证 MCP 跨 IDE 兼容性）

这是 CORD 的 **核心交互接口**，所有 IDE 用户都可以通过 MCP Tools 与 CORD 交互。基于 TR2 确定的技术方案（TypeScript SDK v1.x + Stdio Transport + Tools 优先），MCP Tools 应覆盖：

| MCP Tool | 用途 | 触发方式 |
|----------|------|----------|
| `cord_query_relations` | 查询文档的关联关系 | AI 主动调用或用户指令 |
| `cord_update_relations` | 更新指定文档的关系 | Hooks 自动触发或手动调用 |
| `cord_scan_project` | 全项目冷启动扫描 | 用户指令 |
| `cord_get_context` | 获取文档上下文（关联文档摘要） | AI 读取文档时调用 |
| `cord_add_relation` | 手动添加文档关系 | 用户指令 |
| `cord_visualize` | 生成关系图谱 Mermaid 图 | 用户指令 |

**集成配置示例（MCP Server 注册）：**

Claude Code (`~/.claude/settings.json` 或 `.claude/settings.json`):
```json
{
  "mcpServers": {
    "cord": {
      "command": "npx",
      "args": ["-y", "cord-mcp-server"],
      "env": {
        "CORD_DB_PATH": ".cord/cord.db"
      }
    }
  }
}
```

Cursor (`.cursor/mcp.json`):
```json
{
  "mcpServers": {
    "cord": {
      "command": "npx",
      "args": ["-y", "cord-mcp-server"]
    }
  }
}
```

Windsurf (`~/.codeium/windsurf/mcp_config.json`):
```json
{
  "mcpServers": {
    "cord": {
      "command": "npx",
      "args": ["-y", "cord-mcp-server"]
    }
  }
}
```

VS Code / Copilot (`.vscode/mcp.json`):
```json
{
  "servers": {
    "cord": {
      "command": "npx",
      "args": ["-y", "cord-mcp-server"]
    }
  }
}
```

_Source: 基于 TR2 MCP Server 技术选型结论_

---

## 4. Layer 2: 指令引导层集成模式

**覆盖 IDE：** 全部 4 个 IDE
**置信度：** 🟢 高

通过各 IDE 的指令/规则体系，引导 AI 在合适时机自动调用 CORD MCP Tools。这是 **Cursor 和 Copilot 的主要自动化路径**。

### 4.1 Claude Code — CLAUDE.md 指令注入

```markdown
<!-- CLAUDE.md 或 .claude/rules/cord-relations.md -->
# CORD 文档关系维护

当你修改了 Markdown 文档（.md 文件）时：
1. 修改完成后，调用 `cord_update_relations` 工具更新该文档的关系
2. 如果修改涉及到文档中的链接/引用变化，同步更新关联文档的关系

当你需要理解某个文档的上下文时：
1. 调用 `cord_get_context` 获取关联文档信息
2. 根据上下文信息提供更准确的编辑建议
```

### 4.2 Cursor — Project Rules 指令注入

```yaml
# .cursor/rules/cord-relations.mdc
---
description: "CORD 文档关系维护 - 修改 Markdown 文档时自动更新关系"
alwaysApply: false
globs: ["**/*.md", "docs/**/*"]
---

当你修改了匹配的 Markdown 文档时：
1. 修改完成后，调用 cord_update_relations MCP 工具更新该文档的关系
2. 如果修改涉及到文档中的链接/引用变化，同步更新关联文档的关系
3. 如需理解文档上下文，先调用 cord_get_context
```

**关键优势：** Cursor 的 `globs` 触发模式可以精确匹配 Markdown 文件，只在相关文件被编辑时才注入 CORD 指令，避免上下文污染。

### 4.3 GitHub Copilot — Path-Specific Instructions

```markdown
<!-- .github/instructions/cord-relations.instructions.md -->
---
applyTo: "**/*.md"
---

当修改 Markdown 文档时，使用 cord MCP server 的工具：
1. 修改后调用 cord_update_relations 更新关系
2. 需要上下文时调用 cord_get_context
```

### 4.4 Windsurf — Workspace Rules (Glob 触发)

```markdown
<!-- .windsurf/rules/cord-relations.md -->
---
trigger: glob
globs: "**/*.md"
---

当你修改了匹配的 Markdown 文档时：
1. 修改完成后，调用 cord_update_relations MCP 工具更新关系
2. 如需理解文档上下文，先调用 cord_get_context
```

### 4.5 AGENTS.md — 跨 IDE 通用方案

```markdown
<!-- AGENTS.md（项目根目录）-->
# CORD - 文档关系维护指南

本项目使用 CORD 管理文档间的关系。当你修改 Markdown 文档时：
- 修改后调用 cord_update_relations 更新关系
- 需要文档上下文时调用 cord_get_context
- 首次接入项目时调用 cord_scan_project 初始化
```

**AGENTS.md 兼容性：** Claude Code ✅ / Cursor ✅ / Copilot ✅ / Windsurf ✅

---

## 5. Layer 3: 原生 Hooks 自动触发集成模式

**覆盖 IDE：** Claude Code ✅ / Windsurf ✅（Cursor ❌ / Copilot ❌）
**置信度：** 🟢 高

这是最高级别的自动化——在 AI 操作完成后 **自动、静默地** 触发 CORD 关系更新，用户无需任何操作。

### 5.1 Claude Code — PostToolUse Hook

**核心方案：** 监听 `PostToolUse` 事件（匹配 `Edit|Write` 工具），检测被修改文件是否为 Markdown，自动调用 CORD CLI 更新关系。

**配置（`.claude/settings.json`）：**
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.cord/hooks/post-edit.sh",
            "async": true,
            "timeout": 30,
            "statusMessage": "Updating CORD relations..."
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "matcher": "startup",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.cord/hooks/session-start.sh",
            "async": true,
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

**Hook 脚本（`.cord/hooks/post-edit.sh`）：**
```bash
#!/bin/bash
# 读取 PostToolUse 事件 JSON
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# 仅处理 Markdown 文件
if [[ "$FILE_PATH" == *.md ]]; then
  # 异步调用 CORD CLI 更新关系
  npx cord update-relations "$FILE_PATH" &
fi
exit 0
```

**补充方案：** 利用 `PreToolUse` (matcher: `Read`) 的 `additionalContext` 输出，自动注入关联文档信息：

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Read",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.cord/hooks/pre-read.sh",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

```bash
#!/bin/bash
# .cord/hooks/pre-read.sh — 文件读取前注入关联上下文
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [[ "$FILE_PATH" == *.md ]]; then
  CONTEXT=$(npx cord get-context "$FILE_PATH" --format=brief 2>/dev/null)
  if [ -n "$CONTEXT" ]; then
    jq -n --arg ctx "$CONTEXT" '{
      "hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "additionalContext": $ctx
      }
    }'
  fi
fi
exit 0
```

### 5.2 Windsurf — post_write_code Hook

**核心方案：** 监听 `post_write_code` 事件，自动触发 CORD CLI。

**配置（`.windsurf/hooks.json`）：**
```json
{
  "hooks": {
    "post_write_code": [
      {
        "command": "python3 .cord/hooks/post-write.py",
        "show_output": false
      }
    ],
    "post_read_code": [
      {
        "command": "python3 .cord/hooks/post-read.py",
        "show_output": false
      }
    ]
  }
}
```

**Hook 脚本（`.cord/hooks/post-write.py`）：**
```python
#!/usr/bin/env python3
import json, sys, subprocess

data = json.load(sys.stdin)
file_path = data.get("tool_info", {}).get("file_path", "")

if file_path.endswith(".md"):
    subprocess.Popen(["npx", "cord", "update-relations", file_path])

sys.exit(0)
```

### 5.3 Claude Code 独有能力：PreToolUse 输入修改

Claude Code 的 `updatedInput` 能力可以实现 **工具输入的动态增强**。例如：当 AI 要读取某个 Markdown 文件时，Hook 可以自动将相关联的文件也加入读取列表。

```bash
#!/bin/bash
# 高级模式：自动扩展读取范围（将关联文档一并提供给 AI）
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [[ "$FILE_PATH" == *.md ]]; then
  RELATED=$(npx cord get-related "$FILE_PATH" --limit=3 2>/dev/null)
  if [ -n "$RELATED" ]; then
    jq -n --arg related "$RELATED" '{
      "hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "additionalContext": ("Related CORD documents:\n" + $related)
      }
    }'
  fi
fi
exit 0
```

---

## 6. 降级兼容策略

对于不支持原生 Hooks 的 IDE（Cursor、Copilot），CORD 需要 **优雅降级**：

| 降级层级 | 方案 | 适用 IDE | 自动化程度 |
|----------|------|----------|------------|
| **L1 完全自动** | 原生 Hooks + MCP | Claude Code, Windsurf | 🟢 零用户感知 |
| **L2 AI 引导** | Rules/Instructions + MCP | Cursor, Copilot | 🟡 AI 自主判断调用时机 |
| **L3 手动触发** | MCP Tool 直接调用 | 所有 IDE | 🟠 用户/AI 明确请求 |
| **L4 CLI 兜底** | `npx cord update` 命令行 | 无 MCP 支持时 | 🔴 纯手动 |

**降级检测逻辑：**
```
CORD 启动时检测运行环境：
├── 检测到 Claude Code Hooks 配置? → Layer 3 自动触发
├── 检测到 Windsurf Hooks 配置? → Layer 3 自动触发
├── 检测到 MCP Server 连接? → Layer 1 MCP Tools（配合 Layer 2 指令引导）
└── 无 MCP 连接? → Layer 4 CLI 兜底
```

---

## 7. 跨 IDE 统一集成方案

CORD 应提供 **一键初始化** 命令，自动为当前项目配置所有可用的集成层：

```bash
npx cord init
```

该命令应：

1. **检测当前项目中存在的 AI IDE 配置**（`.claude/`、`.cursor/`、`.windsurf/`、`.github/`、`.vscode/`）
2. **为每个检测到的 IDE 生成对应的集成配置**：
   - Claude Code: `.claude/settings.json` hooks + CLAUDE.md 指令
   - Cursor: `.cursor/mcp.json` + `.cursor/rules/cord-relations.mdc`
   - Windsurf: `.windsurf/hooks.json` + `.windsurf/rules/cord-relations.md`
   - Copilot: `.vscode/mcp.json` + `.github/instructions/cord-relations.instructions.md`
3. **生成通用 AGENTS.md** 片段（兜底方案）
4. **创建 Hook 脚本目录** `.cord/hooks/`
5. **初始化 CORD 数据库** `.cord/cord.db`

**示例输出：**
```
🔍 检测到的 AI IDE 配置：
  ✅ Claude Code (.claude/)
  ✅ Cursor (.cursor/)
  ❌ Windsurf (未检测到)
  ✅ GitHub Copilot (.github/)

📦 已生成集成配置：
  ✅ Claude Code Hooks (PostToolUse + SessionStart)
  ✅ Cursor Rules (cord-relations.mdc)
  ✅ Copilot Instructions (cord-relations.instructions.md)
  ✅ MCP Server 配置 (所有检测到的 IDE)
  ✅ AGENTS.md 片段
  ✅ Hook 脚本 (.cord/hooks/)
  ✅ CORD 数据库 (.cord/cord.db)

🚀 CORD 已就绪！
```

---

## 8. 通信协议与数据格式

### 8.1 Hook → CORD CLI 通信

| 维度 | 设计选择 |
|------|----------|
| **协议** | 进程调用（`npx cord <command>`） |
| **数据格式** | CLI 参数 + JSON stdout |
| **同步/异步** | 异步（`async: true` / `&` 后台执行） |
| **超时** | 文件更新 30s，上下文查询 5s |
| **错误处理** | 静默失败，不阻断 AI 工作流 |

### 8.2 MCP Server ↔ CORD Core 通信

| 维度 | 设计选择 |
|------|----------|
| **协议** | Stdio Transport (JSON-RPC 2.0) — TR2 已确定 |
| **数据格式** | MCP Tool Input/Output JSON |
| **同步/异步** | 同步（MCP Tool 调用为同步） |
| **超时** | IDE 默认超时 |
| **错误处理** | MCP 标准错误响应 |

### 8.3 CORD CLI ↔ SQLite 通信

| 维度 | 设计选择 |
|------|----------|
| **协议** | better-sqlite3 同步 API — TR1 已确定 |
| **数据格式** | SQL + Repository Pattern |
| **并发控制** | WAL 模式 + 文件锁 |

_Source: 基于 TR1（SQLite 选型）、TR2（MCP Server 选型）及本研究的综合设计_

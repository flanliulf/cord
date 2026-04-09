# Technology Stack Analysis

## MCP 协议与核心架构

**MCP（Model Context Protocol）** 是由 Anthropic 主导的开源标准协议，旨在为 AI 应用提供与外部系统连接的统一接口。类比 USB-C 之于电子设备，MCP 为 AI 应用提供了标准化的上下文交换通道。

**协议版本：** `2025-06-18`（当前最新规范版本）

**架构层次：**

| 层级 | 名称 | 职责 |
|------|------|------|
| **数据层（内层）** | JSON-RPC 2.0 协议 | 生命周期管理、能力协商、核心原语（Tools / Resources / Prompts）、通知机制 |
| **传输层（外层）** | Transport | 连接建立、消息帧格式、认证授权 |

**三方参与者模型：**

| 角色 | 说明 | 示例 |
|------|------|------|
| **MCP Host** | AI 应用（协调管理多个 Client） | Claude Code、Cursor、VS Code |
| **MCP Client** | Host 内部组件，维护与 Server 的连接 | 每个 Server 对应一个 Client 实例 |
| **MCP Server** | 提供上下文数据的程序 | CORD 即为此角色 |

_关键设计：一个 Host 可同时连接多个 Server，每个连接由独立的 Client 实例维护。_

_Source: [MCP Architecture Overview](https://modelcontextprotocol.io/docs/learn/architecture)_

## TypeScript SDK 版本与包结构

**当前稳定版本：** v1.29.0（2026-03-30 发布）
**v2 状态：** 主分支为 v2 pre-alpha 开发中，预计 Q1 2026 稳定发布

> ⚠️ **CORD 项目建议：使用 v1.x 进行开发。** v1.x 将在 v2 发布后继续获得至少 6 个月的 bug 修复和安全更新。

**v1.x 包结构（单包）：**

```
@modelcontextprotocol/sdk          # 统一包，包含 server 和 client
├── server/mcp.js                  # McpServer 类
├── server/stdio.js                # StdioServerTransport
└── ...
```

**安装方式（v1.x）：**

```bash
npm install @modelcontextprotocol/sdk zod@3
npm install -D @types/node typescript
```

**v2 包结构（拆分为 monorepo）：**

```
@modelcontextprotocol/server       # Server 核心
@modelcontextprotocol/client       # Client 核心
@modelcontextprotocol/node         # Node.js HTTP 适配
@modelcontextprotocol/express      # Express 中间件
@modelcontextprotocol/hono         # Hono 中间件
```

**v2 关键变化：**

- **Standard Schema 支持**：不再强制 Zod，可使用 Zod v4、Valibot、ArkType 或任何兼容库
- **多运行时支持**：Node.js、Bun、Deno
- **增强的 Streamable HTTP 支持**
- **中间件包作为"薄适配器"**：不引入新 MCP 功能，仅提供框架集成

_置信度：🟢 高（来自官方 GitHub 仓库 README 和 npm 发布记录）_
_Source: [GitHub - modelcontextprotocol/typescript-sdk](https://github.com/modelcontextprotocol/typescript-sdk)_

## 传输层（Transport）

MCP 支持两种核心传输机制：

| 传输类型 | 适用场景 | 通信模型 | 特点 |
|----------|---------|---------|------|
| **Stdio** | 本地进程间通信 | 标准输入/输出流 | 零网络开销、单 Client 连接、CORD 首选 |
| **Streamable HTTP** | 远程/多 Client | HTTP POST + 可选 SSE 流 | 支持标准 HTTP 认证（Bearer / API Key / OAuth） |

> ⚠️ **SSE 传输已被标记为 deprecated。** Claude Code 文档明确推荐使用 HTTP 替代 SSE。

**对 CORD 项目的意义：**

- **MVP 阶段**：使用 **Stdio 传输**（本地 CLI 工具，由 IDE 直接启动进程）
- **未来扩展**：如需远程访问可升级到 Streamable HTTP

**Stdio 关键注意事项：**

- ❌ 绝不能使用 `console.log()`（写入 stdout 会破坏 JSON-RPC 消息）
- ✅ 使用 `console.error()` 写入 stderr 进行日志输出
- ✅ 使用专门的日志库写入 stderr 或文件

_Source: [MCP Architecture - Transport Layer](https://modelcontextprotocol.io/docs/learn/architecture)_
_Source: [Claude Code MCP 文档](https://code.claude.com/docs/en/mcp)_

## 核心原语（Primitives）

MCP Server 可暴露三种核心能力：

### 1. Tools（工具）— 模型控制

| 属性 | 说明 |
|------|------|
| 控制方 | LLM 模型（自动发现和调用） |
| 用途 | 可执行函数（写数据库、调 API、修改文件等） |
| 协议方法 | `tools/list` 发现 → `tools/call` 执行 |
| Schema | JSON Schema（TypeScript SDK 使用 Zod 自动生成） |

**Tool 定义模式（v1.x TypeScript SDK）：**

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const server = new McpServer({ name: "cord", version: "1.0.0" });

server.registerTool("search_relations", {
  description: "搜索文档之间的关系",
  inputSchema: {
    query: z.string().describe("搜索关键词"),
    type: z.enum(["depends_on", "references", "extends"]).optional()
      .describe("关系类型过滤"),
  },
}, async ({ query, type }) => {
  // 执行逻辑...
  return {
    content: [{ type: "text", text: JSON.stringify(results) }],
  };
});
```

### 2. Resources（资源）— 应用控制

| 属性 | 说明 |
|------|------|
| 控制方 | AI 应用程序（决定如何检索和使用） |
| 用途 | 只读数据源（文件内容、数据库记录、API 响应） |
| 协议方法 | `resources/list` / `resources/templates/list` / `resources/read` / `resources/subscribe` |
| URI 模式 | 固定 URI（`cord://relations/all`）或模板 URI（`cord://doc/{path}/relations`） |

### 3. Prompts（提示模板）— 用户控制

| 属性 | 说明 |
|------|------|
| 控制方 | 用户（需显式调用，如 Slash 命令 `/cord.analyze`） |
| 用途 | 预构建指令模板，引导模型使用特定工具和资源 |
| 协议方法 | `prompts/list` / `prompts/get` |

**CORD 项目原语规划建议：**

| 原语 | CORD 用例 |
|------|----------|
| **Tools** | `search_relations`、`add_relation`、`remove_relation`、`scan_document`、`get_graph` |
| **Resources** | `cord://relations/{doc}`（文档关系）、`cord://graph/overview`（全局关系图） |
| **Prompts** | `analyze-dependencies`（分析文档依赖）、`suggest-relations`（推荐关系） |

_Source: [MCP Server Concepts](https://modelcontextprotocol.io/docs/learn/server-concepts)_
_Source: [MCP Build Server Guide](https://modelcontextprotocol.io/docs/develop/build-server)_

## 开发工具与构建链

**推荐 TypeScript 项目配置：**

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./build",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

```json
// package.json
{
  "type": "module",
  "bin": { "cord": "./build/index.js" },
  "scripts": {
    "build": "tsc && chmod 755 build/index.js"
  }
}
```

**开发与调试工具：**

| 工具 | 用途 |
|------|------|
| **MCP Inspector** | 官方调试工具（[github.com/modelcontextprotocol/inspector](https://github.com/modelcontextprotocol/inspector)） |
| **TypeDoc** | SDK 使用 TypeDoc 生成 API 文档 |
| **Vitest** | SDK 内部使用 Vitest 进行测试 |

**运行时要求：**

| 项目 | 最低版本 |
|------|---------|
| Node.js | v16+（推荐最新 LTS） |
| TypeScript | 与 `@types/node` 配套 |
| Zod | v3（v1.x SDK）/ v4（v2 SDK） |

_Source: [MCP Build Server Guide - TypeScript](https://modelcontextprotocol.io/docs/develop/build-server)_

## AI IDE 兼容性横向对比

### Claude Code

| 维度 | 详情 |
|------|------|
| **支持的传输** | Stdio ✅、HTTP ✅、SSE ✅（deprecated） |
| **配置方式** | `claude mcp add` CLI 命令 |
| **配置作用域** | `local`（当前项目/当前用户）、`project`（共享 `.mcp.json`）、`user`（全局） |
| **支持的能力** | Tools ✅、Resources ✅、Prompts ✅、Discovery ✅、Sampling ✅、Roots ✅、Elicitation ✅ |
| **动态更新** | 支持 `list_changed` 通知，自动刷新可用能力 |
| **环境变量** | `--env KEY=value` |
| **认证** | `--header "Authorization: Bearer token"` |
| **超时控制** | `MCP_TIMEOUT` 环境变量（默认值未公开） |
| **输出限制** | 超过 10,000 token 时警告，可通过 `MAX_MCP_OUTPUT_TOKENS` 调整 |
| **特殊功能** | Channels（Server 主动推送消息到会话）、Plugin MCP servers |

**Claude Code 配置示例（Stdio）：**

```bash
claude mcp add --transport stdio cord -- node /path/to/cord/build/index.js
```

**Claude Code 配置示例（共享 `.mcp.json`）：**

```json
{
  "mcpServers": {
    "cord": {
      "command": "node",
      "args": ["./node_modules/.bin/cord-mcp"],
      "env": { "CORD_DB_PATH": "./cord.db" }
    }
  }
}
```

_Source: [Claude Code MCP Documentation](https://code.claude.com/docs/en/mcp)_

### Cursor

| 维度 | 详情 |
|------|------|
| **支持的传输** | Stdio ✅、SSE ✅、Streamable HTTP ✅ |
| **配置方式** | `.cursor/mcp.json`（项目级）/ `~/.cursor/mcp.json`（全局）/ Marketplace |
| **支持的能力** | Tools ✅、Prompts ✅、Resources ✅、Roots ✅、Elicitation ✅、Apps ✅ |
| **环境变量** | `env` 字段 + `envFile` 引用 `.env` 文件 |
| **变量插值** | `${env:NAME}`、`${userHome}`、`${workspaceFolder}` 等 |
| **认证** | `headers` 字段 + `auth` OAuth 配置 |
| **调试** | Output 面板 → "MCP Logs" |

**Cursor 配置示例：**

```json
{
  "mcpServers": {
    "cord": {
      "type": "stdio",
      "command": "node",
      "args": ["./build/index.js"],
      "env": { "CORD_DB_PATH": "${workspaceFolder}/cord.db" }
    }
  }
}
```

_Source: [Cursor MCP Documentation](https://cursor.com/docs/context/mcp)_

### VS Code (GitHub Copilot)

| 维度 | 详情 |
|------|------|
| **支持的传输** | HTTP ✅、Stdio ✅ |
| **配置方式** | `.vscode/mcp.json`（工作区）/ User Profile |
| **支持的能力** | Tools ✅、Resources ✅、Prompts ✅（`/<server>.<prompt>` 语法）、Apps ✅ |
| **安全沙箱** | macOS/Linux 支持文件系统和网络沙箱（仅 Stdio 服务器） |
| **调试** | IntelliSense 支持、信任确认机制 |

**VS Code 配置示例：**

```json
{
  "servers": {
    "cord": {
      "type": "stdio",
      "command": "node",
      "args": ["./build/index.js"]
    }
  }
}
```

_Source: [VS Code MCP Documentation](https://code.visualstudio.com/docs/copilot/chat/mcp-servers)_

### Windsurf

| 维度 | 详情 |
|------|------|
| **支持的传输** | Stdio ✅（确认）、HTTP/SSE（信息有限） |
| **配置方式** | `~/.codeium/windsurf/mcp_config.json` 或项目级配置 |
| **支持的能力** | Tools ✅（其他能力信息有限） |

_置信度：🟡 中（Windsurf 官方文档获取受限，信息来源较少）_

## 跨 IDE 兼容性总结

| 特性 | Claude Code | Cursor | VS Code | Windsurf |
|------|-------------|--------|---------|----------|
| Stdio Transport | ✅ | ✅ | ✅ | ✅ |
| HTTP Transport | ✅ | ✅ | ✅ | ❓ |
| SSE Transport | ✅ (deprecated) | ✅ | — | ❓ |
| Tools | ✅ | ✅ | ✅ | ✅ |
| Resources | ✅ | ✅ | ✅ | ❓ |
| Prompts | ✅ | ✅ | ✅ | ❓ |
| list_changed 通知 | ✅ | ❓ | ❓ | ❓ |
| 配置文件格式 | `.mcp.json` / CLI | `.cursor/mcp.json` | `.vscode/mcp.json` | `mcp_config.json` |

**CORD 跨 IDE 兼容性策略建议：**

1. **优先 Stdio Transport** — 所有主流 IDE 均支持，且是本地 CLI 工具的最佳选择
2. **优先 Tools 原语** — 所有 IDE 均完整支持，是 CORD 核心功能的最佳载体
3. **Resources 和 Prompts 作为增强** — 大部分 IDE 支持，可提供更丰富的上下文
4. **配置文件差异可通过文档覆盖** — 提供各 IDE 的配置示例

## 技术采纳趋势

**MCP 生态现状（2026年3月）：**

- TypeScript SDK GitHub: 12,000+ Stars、1.7k Forks
- 协议版本: `2025-06-18`
- 支持 MCP 的 AI 客户端数量: 40+（根据官方客户端列表页统计）
- 主要 AI 产品均已支持: Claude、ChatGPT、VS Code Copilot、Cursor 等

**趋势观察：**

- **HTTP Transport 成为远程 Server 的主流** — SSE 已被 deprecate，Streamable HTTP 成为推荐方案
- **Standard Schema 方向** — v2 SDK 拥抱多验证库生态，降低耦合
- **MCP Apps（实验性）** — 允许 Server 在 AI 客户端中渲染交互式 HTML UI
- **Tasks（实验性）** — 支持长时间运行操作的状态追踪
- **Channels（Claude Code 特有）** — Server 主动推送外部事件到会话

_Source: [MCP Clients List](https://modelcontextprotocol.io/clients)_
_Source: [MCP Introduction](https://modelcontextprotocol.io/introduction)_

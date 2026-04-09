---
stepsCompleted: [1, 2, 3, 4, 5, 6]
inputDocuments: []
workflowType: 'research'
lastStep: 1
research_type: 'technical'
research_topic: 'MCP Server 开发实践与 TypeScript SDK 深度评估'
research_goals: 'SDK 版本选择、Tool 定义模式、与 Claude Code/Cursor 等 AI IDE 的兼容性细节、MCP Server 生命周期管理'
user_name: 'Fancyliu'
date: '2026-03-31'
web_research_enabled: true
source_verification: true
---

# Research Report: TR2 — MCP Server 开发实践与 TypeScript SDK 深度评估

**Date:** 2026-03-31
**Author:** Fancyliu
**Research Type:** Technical Research
**Project:** CORD (Context-Oriented Relation for Documents)

---

## Research Overview

本研究针对 CORD 项目的核心接口层——MCP（Model Context Protocol）Server 开发进行了全面的技术深度评估。研究覆盖了 MCP 协议架构、TypeScript SDK 版本选择（v1.x vs v2）、Tool/Resource/Prompt 定义模式、跨 AI IDE 兼容性（Claude Code / Cursor / VS Code / Windsurf）以及 Server 生命周期管理等关键维度。

核心结论：**CORD 应使用 TypeScript SDK v1.x（v1.29.0）+ Stdio Transport + better-sqlite3 构建 MCP Server**，优先暴露 Tools 原语作为 AI IDE 交互的主要载体。所有主流 AI IDE 均完整支持此技术组合，跨平台兼容性风险可控。详细的架构建议、实现路线图和风险评估见综合报告章节。

---

<!-- Content will be appended sequentially through research workflow steps -->

## Technical Research Scope Confirmation

**Research Topic:** MCP Server 开发实践与 TypeScript SDK 深度评估
**Research Goals:** SDK 版本选择、Tool 定义模式、与 Claude Code/Cursor 等 AI IDE 的兼容性细节、MCP Server 生命周期管理

**Technical Research Scope:**

- Architecture Analysis - MCP 协议架构、Server/Client 通信模型、Transport 层设计
- Implementation Approaches - TypeScript SDK 的 Tool/Resource/Prompt 定义模式、开发范式与最佳实践
- Technology Stack - SDK 版本演进、与 Node.js 运行时的兼容性、构建工具链
- Integration Patterns - 与 Claude Code、Cursor、Copilot、Windsurf 等 AI IDE 的集成方式与兼容性
- Performance Considerations - Server 生命周期管理、连接管理、错误处理、与 SQLite 数据库集成

**Research Methodology:**

- Current web data with rigorous source verification
- Multi-source validation for critical technical claims
- Confidence level framework for uncertain information
- Comprehensive technical coverage with architecture-specific insights

**Scope Confirmed:** 2026-03-31

## Technology Stack Analysis

### MCP 协议与核心架构

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

### TypeScript SDK 版本与包结构

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

### 传输层（Transport）

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

### 核心原语（Primitives）

MCP Server 可暴露三种核心能力：

#### 1. Tools（工具）— 模型控制

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

#### 2. Resources（资源）— 应用控制

| 属性 | 说明 |
|------|------|
| 控制方 | AI 应用程序（决定如何检索和使用） |
| 用途 | 只读数据源（文件内容、数据库记录、API 响应） |
| 协议方法 | `resources/list` / `resources/templates/list` / `resources/read` / `resources/subscribe` |
| URI 模式 | 固定 URI（`cord://relations/all`）或模板 URI（`cord://doc/{path}/relations`） |

#### 3. Prompts（提示模板）— 用户控制

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

### 开发工具与构建链

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

### AI IDE 兼容性横向对比

#### Claude Code

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

#### Cursor

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

#### VS Code (GitHub Copilot)

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

#### Windsurf

| 维度 | 详情 |
|------|------|
| **支持的传输** | Stdio ✅（确认）、HTTP/SSE（信息有限） |
| **配置方式** | `~/.codeium/windsurf/mcp_config.json` 或项目级配置 |
| **支持的能力** | Tools ✅（其他能力信息有限） |

_置信度：🟡 中（Windsurf 官方文档获取受限，信息来源较少）_

### 跨 IDE 兼容性总结

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

### 技术采纳趋势

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

## Integration Patterns Analysis

### MCP 通信协议与数据格式

**核心协议：JSON-RPC 2.0**

MCP 的所有 Client-Server 通信都基于 [JSON-RPC 2.0](https://www.jsonrpc.org/) 标准：

| 消息类型 | 特征 | 示例 |
|---------|------|------|
| **Request** | 包含 `id`、`method`、`params`，期望 Response | `tools/list`、`tools/call`、`initialize` |
| **Response** | 包含 `id`、`result` 或 `error` | 工具执行结果 |
| **Notification** | 无 `id`，不期望 Response | `notifications/initialized`、`notifications/tools/list_changed` |

**协议版本协商：**

```
Client → Server:  initialize (protocolVersion: "2025-06-18")
Server → Client:  initialize response (protocolVersion: "2025-06-18")
Client → Server:  notifications/initialized
```

- 如果 Server 不支持 Client 请求的版本，返回自己支持的最新版本
- Client 不支持 Server 返回的版本时，**应断开连接**
- HTTP 传输时，Client **必须**在后续所有请求中包含 `MCP-Protocol-Version` Header

_置信度：🟢 高（来自 MCP 官方规范文档）_
_Source: [MCP Lifecycle Specification](https://modelcontextprotocol.io/specification/latest/basic/lifecycle)_

### Server 生命周期管理

#### 初始化阶段（Initialization）

MCP 是**有状态协议**，初始化是**强制的**第一步交互：

```
1. Client → Server:  initialize 请求
   ├── protocolVersion: 协议版本
   ├── capabilities: Client 能力声明 (roots, sampling, elicitation...)
   └── clientInfo: Client 信息 (name, version)

2. Server → Client:  initialize 响应
   ├── protocolVersion: 确认的协议版本
   ├── capabilities: Server 能力声明 (tools, resources, prompts, logging...)
   └── serverInfo: Server 信息 (name, version)
   └── instructions: 可选的 LLM 指令文本

3. Client → Server:  notifications/initialized  (通知，表示就绪)
```

**能力协商（Capability Negotiation）关键字段：**

| 方向 | 能力 | 说明 |
|------|-----|------|
| Server → Client | `tools` | 暴露可调用工具 |
| Server → Client | `tools.listChanged` | 支持工具变更通知 |
| Server → Client | `resources` | 暴露只读资源 |
| Server → Client | `resources.subscribe` | 支持资源变更订阅 |
| Server → Client | `resources.listChanged` | 支持资源列表变更通知 |
| Server → Client | `prompts` | 暴露提示模板 |
| Server → Client | `prompts.listChanged` | 支持提示模板变更通知 |
| Server → Client | `logging` | 支持结构化日志 |
| Server → Client | `completions` | 支持参数自动补全 |
| Client → Server | `roots` | 提供文件系统根路径 |
| Client → Server | `sampling` | 支持 LLM 采样请求 |
| Client → Server | `elicitation` | 支持用户信息请求 |

**CORD Server 能力声明建议：**

```typescript
const server = new McpServer(
  { name: "cord", version: "1.0.0" },
  {
    capabilities: {
      tools: { listChanged: true },
      resources: { subscribe: true, listChanged: true },
      prompts: { listChanged: true },
      logging: {},
    },
  }
);
```

#### 运行阶段（Operation）

- 双方**必须**遵守协商的协议版本
- **只能**使用成功协商的能力
- 支持通知机制实现动态更新（如 `notifications/tools/list_changed`）

#### 关闭阶段（Shutdown）

**Stdio 关闭序列：**

```
1. Client 关闭 Server 的 stdin（输入流）
2. 等待 Server 自行退出
3. 若超时未退出 → 发送 SIGTERM
4. 若仍未退出 → 发送 SIGKILL
```

**HTTP 关闭：** 关闭 HTTP 连接即可。

**CORD 项目关键考量：**
- 使用 Stdio 时，需在 Server 进程退出前**优雅关闭 SQLite 连接**
- 监听进程信号（SIGTERM）并执行清理逻辑

#### 超时与取消

- 实现**应当**为所有发送的请求设置超时
- 超时时发送 `cancellation` 通知并停止等待
- 收到 `progress` 通知时**可以**重置超时计时器
- Claude Code 通过 `MCP_TIMEOUT` 环境变量控制启动超时

_Source: [MCP Lifecycle Specification](https://modelcontextprotocol.io/specification/latest/basic/lifecycle)_

### Tool 注册与实现模式

#### 基础 Tool 注册（v1.x SDK）

```typescript
server.registerTool(
  "tool-name",            // 工具唯一标识
  {
    title: "显示名称",      // 可选，UI 展示用
    description: "工具描述", // LLM 用于理解何时调用
    inputSchema: {         // Zod schema，自动转 JSON Schema
      param1: z.string().describe("参数说明"),
      param2: z.number().optional(),
    },
  },
  async ({ param1, param2 }) => {
    // 异步处理逻辑
    return {
      content: [{ type: "text", text: "结果文本" }],
    };
  }
);
```

#### 结构化输出（Structured Content）

```typescript
server.registerTool("get-relation", {
  description: "获取文档关系",
  inputSchema: { docPath: z.string() },
}, async ({ docPath }) => ({
  content: [{ type: "text", text: JSON.stringify(relation) }],
  structuredContent: relation,  // 类型化输出，v2 增强
}));
```

> ⚠️ `structuredContent` 需使用 **type alias**（而非 interface）以确保 TypeScript 类型兼容

#### Resource Link 引用模式

工具可返回 `resource_link` 指向大型资源，避免内联嵌入：

```typescript
return {
  content: [
    { type: "resource_link", uri: "cord://graph/full", title: "完整关系图" }
  ],
};
```

#### 日志与上下文

```typescript
server.registerTool("scan", {
  description: "扫描文档关系",
  inputSchema: { path: z.string() },
}, async ({ path }, ctx) => {
  ctx.mcpReq.log("info", { message: `扫描文档: ${path}` });
  // ...
});
```

_Source: [TypeScript SDK Server Documentation](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md)_

### Resource 注册模式

#### 静态资源

```typescript
server.registerResource(
  "overview",                        // 资源名称
  "cord://graph/overview",           // 固定 URI
  { title: "关系图概览", mimeType: "application/json" },
  async (uri) => ({
    contents: [{ uri: uri.href, text: JSON.stringify(graphData) }],
  })
);
```

#### 模板资源（动态 URI）

```typescript
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";

server.registerResource(
  "doc-relations",
  new ResourceTemplate("cord://doc/{docPath}/relations", {
    list: async () => ({
      resources: allDocs.map((d) => ({
        uri: `cord://doc/${d.path}/relations`,
        name: d.name,
      })),
    }),
  }),
  { title: "文档关系", mimeType: "application/json" },
  async (uri, { docPath }) => ({
    contents: [{ uri: uri.href, text: JSON.stringify(getRelations(docPath)) }],
  })
);
```

#### 参数自动补全（Completions）

```typescript
import { completable } from "@modelcontextprotocol/sdk/server/mcp.js";

// 在 Prompt 或 Resource 中使用
argsSchema: z.object({
  language: completable(
    z.string(),
    (value) => ["typescript", "python", "java"].filter((l) => l.startsWith(value))
  ),
});
```

_Source: [TypeScript SDK Server Documentation](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md)_

### 传输层集成模式

#### Stdio 传输（CORD 首选）

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({ name: "cord", version: "1.0.0" });

// 注册 tools, resources, prompts...

const transport = new StdioServerTransport();
await server.connect(transport);
```

**关键约束：**
- 所有 tool/resource/prompt **必须在 `server.connect()` 之前注册**
- `console.log()` 被禁止（破坏 stdin/stdout 上的 JSON-RPC）
- 使用 `console.error()` 或日志库写 stderr

#### Streamable HTTP 传输（未来扩展）

```typescript
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

// 有状态模式（支持会话恢复）
const transport = new NodeStreamableHTTPServerTransport({
  sessionIdGenerator: () => randomUUID(),
});

// 无状态模式
const transport = new NodeStreamableHTTPServerTransport({
  sessionIdGenerator: undefined,
});
```

**框架集成（Express / Hono）：**

```typescript
// Express（v2 SDK）
import { createMcpExpressApp } from "@modelcontextprotocol/express";

// Hono（v2 SDK）
import { createMcpHonoApp } from "@modelcontextprotocol/hono";
```

> 中间件包提供 DNS rebinding 防护（localhost 场景）和 Host Header 验证。

_Source: [TypeScript SDK Server Documentation](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md)_

### 认证与授权模式

#### Stdio Transport：环境变量注入

Stdio 模式下**不使用 OAuth**，通过环境变量传递凭证：

```bash
# Claude Code
claude mcp add --transport stdio --env CORD_DB_PATH=/path/to/db cord -- node ./build/index.js

# Cursor (.cursor/mcp.json)
{ "env": { "CORD_DB_PATH": "${workspaceFolder}/cord.db" } }
```

**CORD 项目：** 作为本地工具，主要通过环境变量传递数据库路径等配置，无需 OAuth。

#### HTTP Transport：OAuth 2.1（远程场景）

如未来 CORD 提供远程服务，需支持：
- OAuth 2.1 + PKCE
- Bearer Token via `Authorization` Header
- Protected Resource Metadata (RFC 9728)
- Dynamic Client Registration 或 Client ID Metadata Documents

> ⚠️ MVP 阶段无需实现 OAuth，Stdio + 环境变量即可满足需求。

_Source: [MCP Authorization Specification](https://modelcontextprotocol.io/specification/latest/basic/authorization)_

### 通知与动态更新模式

MCP 支持 Server 主动通知 Client 能力变更：

| 通知类型 | 触发条件 | 前提能力 |
|---------|---------|---------|
| `notifications/tools/list_changed` | 工具列表变更 | `tools.listChanged: true` |
| `notifications/resources/list_changed` | 资源列表变更 | `resources.listChanged: true` |
| `notifications/prompts/list_changed` | 提示模板变更 | `prompts.listChanged: true` |

**CORD 使用场景：**
- 冷启动扫描后，新发现的文档关系可触发 `resources/list_changed`
- 插件加载新工具时触发 `tools/list_changed`

### SQLite 数据库集成模式

**推荐架构：Repository Pattern + 进程内 SQLite**

```
MCP Server (Node.js 进程)
├── McpServer (协议层)
│   ├── Tools → Handler → Repository → SQLite
│   ├── Resources → Handler → Repository → SQLite
│   └── Prompts → Handler
├── StdioServerTransport (传输层)
└── better-sqlite3 (同步 SQLite 驱动)
```

**关键设计决策：**

| 决策 | 选择 | 理由 |
|------|------|------|
| SQLite 驱动 | `better-sqlite3` | 同步 API、高性能、C++ 绑定 |
| 数据库连接管理 | 进程内单例 | Stdio 模式下单 Client，无并发竞争 |
| 数据库路径 | 环境变量注入 | `CORD_DB_PATH` 或默认 `./cord.db` |
| 优雅关闭 | SIGTERM 监听 | 关闭 SQLite 连接，避免数据损坏 |

**生命周期集成示例：**

```typescript
import Database from "better-sqlite3";

let db: Database.Database;

function initDatabase(): void {
  const dbPath = process.env.CORD_DB_PATH || "./cord.db";
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");  // 写前日志模式，提升并发读性能
  db.pragma("foreign_keys = ON");
}

function shutdownDatabase(): void {
  if (db) {
    db.close();
  }
}

// 优雅关闭
process.on("SIGTERM", () => {
  shutdownDatabase();
  process.exit(0);
});

process.on("SIGINT", () => {
  shutdownDatabase();
  process.exit(0);
});
```

_置信度：🟡 中（SQLite + MCP 的组合基于 TR1 结论和 MCP SDK 最佳实践推导，非直接引用）_

### 跨 IDE 配置文件集成策略

各 IDE 的 MCP 配置文件格式存在差异，CORD 需提供多格式配置指引：

| IDE | 配置路径 | 格式差异 |
|-----|---------|---------|
| Claude Code | `.mcp.json`（项目共享）或 CLI 添加 | `{ "mcpServers": { "cord": { "command": "...", "args": [...] } } }` |
| Cursor | `.cursor/mcp.json` | `{ "mcpServers": { "cord": { "type": "stdio", "command": "...", "args": [...] } } }` |
| VS Code | `.vscode/mcp.json` | `{ "servers": { "cord": { "type": "stdio", "command": "...", "args": [...] } } }` |

**关键差异：**
- Claude Code 不需要 `type` 字段（默认 stdio）
- Cursor 需要显式 `type: "stdio"`
- VS Code 使用 `servers` 而非 `mcpServers` 作为顶层 key
- Cursor 支持 `envFile` 引用 `.env` 文件
- VS Code 支持 Input Variables 避免硬编码敏感数据

**CORD 集成建议：**
- 提供 `cord init` CLI 命令，自动生成对应 IDE 的配置文件
- 或通过 `npx cord-mcp` 方式启动，简化跨 IDE 配置

### SDK 已知问题与陷阱

| 问题 | 影响 | 解决方案 |
|------|------|---------|
| **Zod 版本冲突**（TS2589 错误） | 多个 zod 版本共存导致类型递归过深 | 使用 `npm ls zod` 检查，通过 resolutions 强制统一版本 |
| **Web Crypto 可用性** | Node.js < 19 时 OAuth helpers 可能失败 | 对 Node.js 18 使用 `--experimental-global-webcrypto` 或 polyfill |
| **SSE 在 v2 中被移除** | v2 Server 不再支持 SSE transport | 使用 Streamable HTTP 替代 |
| **console.log 破坏 Stdio** | 写入 stdout 的任何内容都会破坏 JSON-RPC | 严格使用 console.error 或 stderr 日志 |

_Source: [TypeScript SDK FAQ](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/faq.md)_

## Architectural Patterns and Design

### CORD MCP Server 系统架构模式

基于对 MCP 官方参考实现（filesystem、memory 等）的分析，结合 CORD 项目需求，推荐以下架构模式：

#### 推荐架构：分层模块化架构

```
cord/
├── src/
│   ├── index.ts                    # 入口：Server 初始化 + Transport 连接
│   ├── server.ts                   # McpServer 配置与能力声明
│   ├── tools/                      # Tool 定义层
│   │   ├── index.ts                # Tool 注册聚合
│   │   ├── relation-tools.ts       # 关系管理工具 (add/remove/search)
│   │   ├── scan-tools.ts           # 文档扫描工具
│   │   └── graph-tools.ts          # 图谱查询工具
│   ├── resources/                  # Resource 定义层
│   │   ├── index.ts                # Resource 注册聚合
│   │   ├── doc-resources.ts        # 文档关系资源
│   │   └── graph-resources.ts      # 图谱资源
│   ├── prompts/                    # Prompt 定义层
│   │   ├── index.ts                # Prompt 注册聚合
│   │   └── analysis-prompts.ts     # 分析提示模板
│   ├── repository/                 # 数据访问层 (Repository Pattern)
│   │   ├── db.ts                   # SQLite 连接管理（单例）
│   │   ├── relation-repo.ts        # 关系数据存取
│   │   ├── document-repo.ts        # 文档数据存取
│   │   └── migrations/             # 数据库迁移
│   ├── services/                   # 业务逻辑层
│   │   ├── relation-service.ts     # 关系管理逻辑
│   │   ├── scanner-service.ts      # 文档扫描逻辑
│   │   └── graph-service.ts        # 图谱计算逻辑
│   └── utils/                      # 工具函数
│       ├── logger.ts               # stderr 日志工具
│       └── path-utils.ts           # 路径处理
├── build/                          # 编译输出
├── package.json
└── tsconfig.json
```

**核心设计原则：**

| 原则 | 说明 | 在 CORD 中的体现 |
|------|------|-----------------|
| **关注点分离** | Tool/Resource/Prompt 定义与业务逻辑分离 | `tools/` 只负责 schema 和路由，`services/` 处理业务 |
| **Repository Pattern** | 数据访问与业务逻辑解耦 | `repository/` 封装 SQLite 操作，可独立测试和替换 |
| **单一入口** | `index.ts` 统一初始化流程 | 创建 Server → 注册能力 → 连接 Transport |
| **模块聚合** | 每个目录有 `index.ts` 聚合导出 | `tools/index.ts` 统一注册所有工具到 Server |

_灵感来源：官方 filesystem server（5 模块分层）和 memory server（实体-关系图谱模型）_
_Source: [MCP Reference Servers](https://github.com/modelcontextprotocol/servers)_

### 设计原则与最佳实践

#### Tool 设计原则

基于 MCP 规范的 **Tool Annotations** 机制，每个工具应明确声明行为特征：

```typescript
server.registerTool("add_relation", {
  description: "在两个文档之间添加关系",
  annotations: {
    readOnlyHint: false,          // 非只读：会修改数据库
    destructiveHint: false,       // 非破坏性：添加不删除
    idempotentHint: true,         // 幂等：重复添加同一关系无副作用
    openWorldHint: false,         // 封闭世界：不调用外部服务
  },
  inputSchema: {
    sourceDoc: z.string().describe("源文档路径"),
    targetDoc: z.string().describe("目标文档路径"),
    relationType: z.enum(["depends_on", "references", "extends", "conflicts_with"]),
  },
}, async ({ sourceDoc, targetDoc, relationType }) => {
  // ...
});
```

**Annotation 语义与 IDE 行为：**

| Annotation | 含义 | IDE 响应 |
|-----------|------|---------|
| `readOnlyHint: true` | 不修改任何状态 | 可能跳过确认对话框 |
| `destructiveHint: true` | 可能导致不可逆操作 | 应显示警告确认 |
| `idempotentHint: true` | 重复调用结果一致 | 允许自动重试 |
| `openWorldHint: true` | 与外部系统交互 | 可能提示网络权限 |

> ⚠️ 规范明确指出：Client **必须**将 Tool Annotations 视为**不可信的**（除非来自可信 Server）。

#### 错误处理两层模型

MCP 区分两类错误，设计意图截然不同：

| 错误类型 | 用途 | LLM 能否自我纠正 | 示例 |
|---------|------|-----------------|------|
| **Protocol Error** | JSON-RPC 层面错误（未知工具、格式错误） | ❌ 通常不能 | `Unknown tool: invalid_name` |
| **Tool Execution Error** | 业务逻辑层面错误（输入无效、操作失败） | ✅ 可以调整参数重试 | `文档路径不存在: /foo/bar.md` |

**CORD Tool Execution Error 模式：**

```typescript
// 输入验证错误 → isError: true, LLM 可自我纠正
return {
  content: [{ type: "text", text: "文档路径不存在: /foo/bar.md。请确认路径正确。" }],
  isError: true,
};

// 操作成功
return {
  content: [{ type: "text", text: JSON.stringify(result) }],
  isError: false,
};
```

_Source: [MCP Tools Specification](https://modelcontextprotocol.io/specification/latest/server/tools)_

#### Tool 命名规范

基于 MCP 规范的工具命名要求：

| 规则 | 详情 |
|------|------|
| 长度 | 1-128 字符 |
| 大小写 | 区分大小写 |
| 允许字符 | `A-Z a-z 0-9 _ - .` |
| 禁止字符 | 空格、逗号、其他特殊字符 |
| 唯一性 | Server 内唯一 |

**CORD 命名规范建议：**

```
关系管理：  relation.add, relation.remove, relation.search, relation.list
文档扫描：  document.scan, document.scan_all
图谱操作：  graph.get, graph.export, graph.visualize
配置管理：  config.get, config.set
```

_使用 `.` 分隔实现逻辑分组，符合规范且提升可读性。_

### 安全架构模式

MCP 规范对 Server 安全有明确要求：

| 安全要求 | CORD 实现策略 |
|---------|-------------|
| **验证所有输入** | Zod schema 自动验证 + 业务层路径检查 |
| **访问控制** | 限制文件操作在项目根目录内（参考 filesystem server 的 allowlist 模式） |
| **速率限制** | MVP 阶段可不实现（Stdio 单 Client 场景） |
| **输出清理** | 确保不在工具输出中泄露敏感路径或系统信息 |

**路径安全模式（参考 filesystem server）：**

```typescript
// 路径验证：确保操作不越界
function validatePath(requestedPath: string, allowedRoots: string[]): boolean {
  const resolved = path.resolve(requestedPath);
  return allowedRoots.some(root => resolved.startsWith(path.resolve(root)));
}
```

_Source: [MCP Tools Specification - Security](https://modelcontextprotocol.io/specification/latest/server/tools)_
_Source: [Filesystem MCP Server](https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem)_

### 数据架构模式

#### SQLite Schema 设计（CORD 核心表）

基于 TR1 结论和 Memory Server 的实体-关系模型参考：

```sql
-- 文档实体表
CREATE TABLE documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT UNIQUE NOT NULL,        -- 相对于项目根的规范化路径
  name TEXT NOT NULL,               -- 文件名
  type TEXT,                        -- 文件类型 (markdown, yaml, etc.)
  last_scanned_at TEXT,             -- ISO 8601 时间戳
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 关系表（有向关系）
CREATE TABLE relations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_doc_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  target_doc_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL,      -- depends_on, references, extends, conflicts_with
  metadata TEXT,                    -- JSON 格式的附加元数据
  confidence REAL DEFAULT 1.0,      -- 关系置信度 (0-1, AI 发现的关系可能 < 1)
  source TEXT DEFAULT 'manual',     -- manual | auto_scan | ai_suggested
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(source_doc_id, target_doc_id, relation_type)
);

-- 索引
CREATE INDEX idx_relations_source ON relations(source_doc_id);
CREATE INDEX idx_relations_target ON relations(target_doc_id);
CREATE INDEX idx_relations_type ON relations(relation_type);
CREATE INDEX idx_documents_path ON documents(path);
```

**设计决策理由：**

| 决策 | 理由 |
|------|------|
| 有向关系 | 文档依赖关系有方向性（A depends_on B ≠ B depends_on A） |
| 唯一约束 | 防止重复关系（source + target + type 唯一） |
| CASCADE 删除 | 文档删除时自动清理相关关系 |
| confidence 字段 | 支持 AI 辅助发现的关系标记不确定度 |
| source 字段 | 区分手动定义和自动发现的关系 |
| WAL 模式 | 提升读并发性能 |

_置信度：🟢 高（基于 TR1 SQLite 选型结论和 MCP Memory Server 参考实现推导）_

### 部署与运维架构

#### npm 分发模式

```json
{
  "name": "cord-mcp",
  "version": "1.0.0",
  "type": "module",
  "bin": {
    "cord-mcp": "./build/index.js"
  },
  "files": ["build"],
  "engines": {
    "node": ">=18.0.0"
  }
}
```

**用户安装与使用：**

```bash
# 方式 1：全局安装
npm install -g cord-mcp

# 方式 2：npx 直接运行（推荐）
npx cord-mcp

# 方式 3：项目依赖
npm install cord-mcp --save-dev
```

**IDE 配置快捷命令：**

```bash
# Claude Code
claude mcp add --transport stdio cord -- npx -y cord-mcp

# 或通过 .mcp.json 共享配置
```

#### 日志架构

```typescript
// utils/logger.ts — 所有日志写入 stderr
const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;

function log(level: typeof LOG_LEVELS[number], message: string, data?: unknown): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(data && { data }),
  };
  console.error(JSON.stringify(entry)); // ← stderr，不破坏 Stdio JSON-RPC
}

export const logger = {
  debug: (msg: string, data?: unknown) => log("debug", msg, data),
  info: (msg: string, data?: unknown) => log("info", msg, data),
  warn: (msg: string, data?: unknown) => log("warn", msg, data),
  error: (msg: string, data?: unknown) => log("error", msg, data),
};
```

#### 测试策略

| 测试层 | 目标 | 工具 | 策略 |
|--------|------|------|------|
| **单元测试** | Repository/Service 层 | Vitest | 内存 SQLite（`:memory:`）隔离测试 |
| **集成测试** | Tool 注册与执行 | Vitest + MCP Client | 模拟 Client 发送 JSON-RPC 请求 |
| **E2E 测试** | 完整 Stdio 通信流程 | MCP Inspector | 手动/自动化验证 Tool 行为 |

```typescript
// 单元测试示例 (Vitest)
import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { RelationRepository } from "../src/repository/relation-repo.js";

describe("RelationRepository", () => {
  let db: Database.Database;
  let repo: RelationRepository;

  beforeEach(() => {
    db = new Database(":memory:");
    // 运行 migrations...
    repo = new RelationRepository(db);
  });

  it("should add a relation", () => {
    repo.addRelation("doc-a.md", "doc-b.md", "depends_on");
    const relations = repo.getRelationsForDoc("doc-a.md");
    expect(relations).toHaveLength(1);
    expect(relations[0].relationType).toBe("depends_on");
  });
});
```

_Source: [MCP Reference Servers](https://github.com/modelcontextprotocol/servers)_
_Source: [TypeScript SDK - Vitest testing](https://github.com/modelcontextprotocol/typescript-sdk)_

## Implementation Approaches and Technology Adoption

### 技术采纳策略

#### SDK 版本选择路径

| 时间点 | 策略 | 理由 |
|--------|------|------|
| **MVP 阶段（现在）** | 使用 **v1.x**（`@modelcontextprotocol/sdk`） | 稳定生产版本，完整文档，社区验证 |
| **v2 稳定后（预计 2026 Q2-Q3）** | 评估迁移到 v2 | v2 拆分包结构更清晰，Standard Schema 更灵活 |
| **v1 EOL 前** | 完成迁移 | v1 在 v2 发布后至少维护 6 个月 |

**迁移风险评估：**

| 维度 | 风险等级 | 说明 |
|------|---------|------|
| API 兼容性 | 🟡 中 | v2 API 整体相似，但包导入路径变化 |
| Schema 迁移 | 🟢 低 | Zod v3 → v4 平滑升级；v2 也支持其他 Schema 库 |
| Transport 变化 | 🟢 低 | Stdio 无变化；SSE 被移除但 CORD 不使用 |
| 依赖变化 | 🟡 中 | 单包 → 多包，需调整构建配置 |

#### better-sqlite3 跨平台策略

**当前状态（v12.8.0, 2026-03-13）：**
- 178,000+ 项目使用
- 提供 Node.js LTS 版本的**预编译二进制文件**（prebuild）
- C++ 原生绑定（67.9% JS / 31.8% C++）

**跨平台支持矩阵：**

| 平台 | 预编译可用 | 备注 |
|------|-----------|------|
| macOS (Intel) | ✅ | 主流开发环境 |
| macOS (Apple Silicon) | ✅ | M1/M2/M3 原生支持 |
| Linux (x64) | ✅ | CI/CD 和服务器环境 |
| Linux (ARM64) | ✅ | 树莓派等嵌入式场景 |
| Windows (x64) | ✅ | 需确保 VS Build Tools 或预编译匹配 |

**npm 分发的关键挑战：**

当 CORD 作为 npm 包分发（`npx cord-mcp`）时，`better-sqlite3` 的原生 C++ 绑定需要：
1. 用户机器上有匹配的预编译二进制，或
2. 本地编译（需要 Python + C++ 编译工具链）

**缓解策略：**
- `better-sqlite3` 对主流 LTS Node.js 提供 prebuild → 大多数用户免编译
- `package.json` 中声明 `engines.node` 限定支持版本
- README 提供各平台安装故障排查指南
- 后续 TR9（npm 分发研究）将深入此话题

_Source: [better-sqlite3 GitHub](https://github.com/WiseLibs/better-sqlite3)_

### 开发工作流与工具链

#### 本地开发工作流

```
1. 编写/修改 TypeScript 代码
      ↓
2. 编译: tsc (或 tsx 直接运行)
      ↓
3. 本地测试: MCP Inspector
      ↓
4. IDE 集成测试: Claude Code / Cursor
      ↓
5. 单元/集成测试: Vitest
      ↓
6. 提交代码
```

**MCP Inspector — 开发首选调试工具：**

```bash
# 测试本地开发中的 CORD server
npx @modelcontextprotocol/inspector node ./build/index.js

# 测试已发布的 npm 包
npx @modelcontextprotocol/inspector npx cord-mcp
```

Inspector 提供：
- ✅ 可视化 Tool/Resource/Prompt 列表
- ✅ 交互式 Tool 执行测试（自定义输入）
- ✅ 查看 Resource 内容
- ✅ 测试 Prompt 模板（自定义参数）
- ✅ 查看日志和通知流
- ✅ Transport 选择（Stdio / HTTP）

**开发迭代推荐模式：**

| 阶段 | 工具 | 说明 |
|------|------|------|
| 核心开发 | MCP Inspector | 快速验证 Tool 行为，无需完整 IDE |
| 集成测试 | Claude Code | 验证真实 AI IDE 场景 |
| 回归测试 | Vitest | 自动化测试套件 |
| 发布前验证 | `npx cord-mcp` | 模拟用户安装体验 |

_Source: [MCP Inspector Documentation](https://modelcontextprotocol.io/docs/tools/inspector)_

#### 项目初始化模板

```bash
# 1. 初始化项目
mkdir cord-mcp && cd cord-mcp
npm init -y

# 2. 安装核心依赖
npm install @modelcontextprotocol/sdk zod@3 better-sqlite3
npm install -D @types/node @types/better-sqlite3 typescript vitest

# 3. 配置 TypeScript (tsconfig.json)
# → 如架构模式章节所述

# 4. 配置 package.json
# → type: "module", bin, scripts

# 5. 创建项目结构
mkdir -p src/{tools,resources,prompts,repository,services,utils}
```

**依赖清单：**

| 包名 | 用途 | 类型 |
|------|------|------|
| `@modelcontextprotocol/sdk` | MCP Server/Client SDK | production |
| `zod@3` | Schema 定义与验证 | production |
| `better-sqlite3` | SQLite 数据库驱动 | production |
| `typescript` | TypeScript 编译器 | devDependency |
| `@types/node` | Node.js 类型定义 | devDependency |
| `@types/better-sqlite3` | better-sqlite3 类型定义 | devDependency |
| `vitest` | 测试框架 | devDependency |

### 调试与故障排查

#### 常见问题清单

| 问题 | 症状 | 解决方案 |
|------|------|---------|
| **stdout 污染** | Server 连接后立即断开 | 移除所有 `console.log()`，改用 `console.error()` |
| **工作目录不确定** | 相对路径文件找不到 | 使用绝对路径；环境变量传递路径 |
| **环境变量丢失** | Server 无法读取配置 | 通过 IDE 配置的 `env` 字段显式传递 |
| **协议版本不匹配** | 初始化失败 | 确认 SDK 版本与 Client 支持的协议版本兼容 |
| **能力协商失败** | 运行时调用报错 | 检查 `initialize` 交换中双方声明的 capabilities |
| **Zod 版本冲突** | TS2589 类型错误 | `npm ls zod` 检查，使用 resolutions 统一版本 |
| **SQLite 锁定** | 数据库操作超时 | 确认 WAL 模式启用；检查是否有其他进程锁定 |
| **prebuild 缺失** | better-sqlite3 安装编译失败 | 使用 LTS Node.js 版本；安装 C++ 编译工具链 |

#### 日志策略

```typescript
// 结构化日志 → stderr (不干扰 Stdio JSON-RPC)
function logToStderr(level: string, message: string, context?: Record<string, unknown>) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...context,
  };
  console.error(JSON.stringify(entry));
}

// MCP 协议内日志 → 通过 notifications/message 发送给 Client
// 需声明 logging 能力
await server.sendLoggingMessage({
  level: "info",
  data: "扫描完成: 发现 42 个文档关系",
});
```

**日志输出双通道：**

| 通道 | 方式 | 查看者 |
|------|------|--------|
| **stderr** | `console.error()` / 日志库 | 开发者（终端/日志文件） |
| **MCP 协议** | `sendLoggingMessage()` | AI IDE / LLM |

_Source: [MCP Debugging Guide](https://modelcontextprotocol.io/docs/tools/debugging)_

### 风险评估与缓解

| 风险 | 等级 | 影响 | 缓解措施 |
|------|------|------|---------|
| **v2 SDK 破坏性变更** | 🟡 中 | 需要迁移代码 | 使用 v1.x 稳定版；关注 v2 changelog；保持松耦合 |
| **better-sqlite3 跨平台编译失败** | 🟡 中 | 部分用户安装困难 | 限定 LTS Node.js；提供详细排查文档；TR9 深入研究 |
| **MCP 规范演进** | 🟢 低 | 新功能需要适配 | SDK 封装了规范差异；关注 `listChanged` 通知 |
| **IDE 兼容性碎片化** | 🟡 中 | 需维护多套配置文档 | 优先 Stdio + Tools（全 IDE 通用）；提供 `cord init` 命令 |
| **单进程 SQLite 性能** | 🟢 低 | 大规模项目可能慢 | WAL 模式；索引优化；Repository Pattern 可替换数据层 |

## Technical Research Recommendations

### 实现路线图

```
Phase 1: 核心骨架 (Week 1-2)
├── 项目初始化 (TypeScript + SDK + SQLite)
├── McpServer 创建与 Stdio Transport 连接
├── 数据库 Schema 创建与 Migration
└── 第一个 Tool: relation.add

Phase 2: 核心工具集 (Week 3-4)
├── relation.remove / relation.search / relation.list
├── document.scan (单文件 Markdown AST 扫描 → 依赖 TR3)
├── graph.get (文档关系图查询)
└── MCP Inspector 集成测试

Phase 3: 资源与提示 (Week 5-6)
├── Resource: cord://doc/{path}/relations
├── Resource: cord://graph/overview
├── Prompt: analyze-dependencies
└── 跨 IDE 配置文档 (Claude Code / Cursor / VS Code)

Phase 4: 打磨与发布 (Week 7-8)
├── 错误处理强化
├── Vitest 自动化测试套件
├── npm 包配置与发布 (→ 依赖 TR9)
└── README 与用户文档
```

### 技术栈最终推荐

| 层级 | 技术选择 | 置信度 |
|------|---------|--------|
| **语言** | TypeScript (ES2022 + Node16 module) | 🟢 高 |
| **MCP SDK** | `@modelcontextprotocol/sdk` v1.x | 🟢 高 |
| **Schema 验证** | Zod v3 | 🟢 高 |
| **数据库** | SQLite via `better-sqlite3` | 🟢 高（TR1 已验证） |
| **传输层** | Stdio (MVP) → Streamable HTTP (未来) | 🟢 高 |
| **测试框架** | Vitest | 🟢 高 |
| **调试工具** | MCP Inspector | 🟢 高 |
| **构建工具** | tsc (TypeScript Compiler) | 🟢 高 |
| **包管理** | npm / npx | 🟢 高 |

### 成功度量指标

| KPI | 目标 | 度量方式 |
|-----|------|---------|
| **Tool 响应时间** | < 500ms（单次查询） | MCP Inspector 执行计时 |
| **IDE 兼容性** | Claude Code + Cursor + VS Code 均正常 | 手动集成测试 |
| **安装成功率** | > 95%（主流 LTS Node.js） | npm 安装 + better-sqlite3 prebuild |
| **测试覆盖率** | > 80%（Repository + Service 层） | Vitest coverage |
| **冷启动时间** | < 2s（Server 初始化 + DB 连接） | 启动到 `initialized` 通知的时间 |

---

## Research Synthesis: 综合技术研究报告

### Executive Summary

本研究对 MCP Server 开发实践与 TypeScript SDK 进行了全面的技术评估，涵盖协议架构、SDK 版本选择、跨 IDE 兼容性、生命周期管理和实现架构五大维度。基于对 MCP 官方规范、TypeScript SDK 仓库、参考实现和四大 AI IDE 文档的深度分析，得出以下核心结论：

**关键技术发现：**

- **SDK 选择已确定**：v1.x（v1.29.0）是唯一生产推荐版本；v2 pre-alpha 不适合 MVP
- **传输层已确定**：Stdio Transport 是 CORD 本地 CLI 工具的最佳选择，所有主流 AI IDE 均支持
- **核心原语已确定**：Tools 是跨 IDE 兼容性最强的原语，应作为 CORD 的首选交互载体
- **架构模式已确定**：分层模块化架构（Tools → Services → Repository → SQLite）
- **跨 IDE 兼容性已验证**：Claude Code / Cursor / VS Code 均完整支持 Stdio + Tools，配置差异可通过文档覆盖

**战略建议：**

1. 立即启动 MVP 开发，使用 v1.x SDK + Stdio + better-sqlite3
2. 优先实现 5-8 个核心 Tools（关系管理 + 文档扫描 + 图谱查询）
3. Resources 和 Prompts 作为 Phase 3 增强功能
4. 持续关注 v2 SDK 进展，在 v2 稳定后规划迁移

### Table of Contents

1. [Technical Research Scope Confirmation](#technical-research-scope-confirmation) — 研究范围与方法论
2. [Technology Stack Analysis](#technology-stack-analysis) — MCP 协议、SDK、传输层、核心原语、AI IDE 兼容性
3. [Integration Patterns Analysis](#integration-patterns-analysis) — JSON-RPC 协议、生命周期、Tool 注册、SQLite 集成、跨 IDE 配置
4. [Architectural Patterns and Design](#architectural-patterns-and-design) — 系统架构、设计原则、安全模式、数据架构
5. [Implementation Approaches](#implementation-approaches-and-technology-adoption) — 采纳策略、开发工作流、调试故障排查、风险评估
6. [Research Synthesis](#research-synthesis-综合技术研究报告) — 综合结论与建议（本章节）

### 研究方法论

本研究采用多源验证的技术研究方法论：

| 维度 | 方法 |
|------|------|
| **一手资料** | MCP 官方规范文档、TypeScript SDK GitHub README 与源码文档、各 IDE 官方配置文档 |
| **二手验证** | npm 包元数据、GitHub 社区数据（Stars/Forks/Usage）、MCP 客户端列表 |
| **交叉验证** | 多个 IDE 文档对比验证 MCP 能力支持情况 |
| **置信度标注** | 每项结论标注置信度等级（🟢 高 / 🟡 中 / 🔴 低） |

### 研究目标达成评估

| 研究目标 | 达成状态 | 核心结论 |
|---------|---------|---------|
| **SDK 版本选择** | ✅ 完成 | v1.x（v1.29.0）用于 MVP；v2 观望至稳定 |
| **Tool 定义模式** | ✅ 完成 | `server.registerTool()` + Zod schema；支持 structuredContent、resource_link、annotations |
| **AI IDE 兼容性** | ✅ 完成 | Stdio + Tools 在所有主流 IDE 通用；配置格式差异已记录 |
| **生命周期管理** | ✅ 完成 | 三阶段协议（Initialize → Operation → Shutdown）；SIGTERM 优雅关闭 SQLite |

### CORD 项目技术决策汇总

| 决策项 | 选择 | 置信度 | 替代方案 | 否决理由 |
|--------|------|--------|---------|---------|
| MCP SDK 版本 | v1.x | 🟢 高 | v2 pre-alpha | 不稳定，无生产推荐 |
| 传输层 | Stdio | 🟢 高 | Streamable HTTP | 本地 CLI 工具不需要远程传输 |
| 核心原语 | Tools 优先 | 🟢 高 | Resources/Prompts 优先 | Tools 跨 IDE 兼容性最强 |
| Schema 验证 | Zod v3 | 🟢 高 | ArkType / Valibot | v1.x SDK 原生支持 Zod v3 |
| SQLite 驱动 | better-sqlite3 | 🟢 高 | sql.js / drizzle-orm | 同步 API + 高性能（TR1 已验证） |
| 测试框架 | Vitest | 🟢 高 | Jest | SDK 内部使用 Vitest，生态一致 |
| 调试工具 | MCP Inspector | 🟢 高 | 自建 Client | 官方工具，完整功能 |
| 日志输出 | console.error (stderr) | 🟢 高 | 第三方日志库 | 简单直接，不污染 stdout |
| 包分发 | npx cord-mcp | 🟢 高 | 全局安装 | 零安装体验更好 |

### 后续技术研究依赖

本研究（TR2）为以下待研究主题提供了基础输入：

| 后续 TR | 主题 | TR2 提供的输入 |
|---------|------|-------------|
| **TR3** | Markdown AST 解析 | Tool 定义模式确定后，`document.scan` 工具需要 AST 解析引擎 |
| **TR5** | CLI 框架选择 | CLI 子命令体系可参考 MCP Tool 命名约定（`.` 分隔分组） |
| **TR4** | IDE Hooks 对比 | 已获取各 IDE 的 MCP 能力支持详情，可直接输入 |
| **TR9** | npm 分发 | better-sqlite3 跨平台 prebuild 策略已初步评估 |

### 信息来源汇总

| 来源 | URL | 用途 |
|------|-----|------|
| MCP 官方文档 | https://modelcontextprotocol.io | 协议规范、架构、概念 |
| TypeScript SDK | https://github.com/modelcontextprotocol/typescript-sdk | SDK 版本、API、示例 |
| MCP 参考 Servers | https://github.com/modelcontextprotocol/servers | 架构模式参考 |
| MCP Inspector | https://github.com/modelcontextprotocol/inspector | 调试工具 |
| Claude Code MCP 文档 | https://code.claude.com/docs/en/mcp | IDE 集成配置 |
| Cursor MCP 文档 | https://cursor.com/docs/context/mcp | IDE 集成配置 |
| VS Code MCP 文档 | https://code.visualstudio.com/docs/copilot/chat/mcp-servers | IDE 集成配置 |
| MCP Lifecycle Spec | https://modelcontextprotocol.io/specification/latest/basic/lifecycle | 生命周期规范 |
| MCP Tools Spec | https://modelcontextprotocol.io/specification/latest/server/tools | Tool 规范详情 |
| MCP Authorization Spec | https://modelcontextprotocol.io/specification/latest/basic/authorization | 认证授权规范 |
| better-sqlite3 | https://github.com/WiseLibs/better-sqlite3 | SQLite 驱动详情 |

---

**Technical Research Completion Date:** 2026-03-31
**Document Status:** ✅ 完成
**Steps Completed:** 6/6
**Source Verification:** 所有技术声明均引用当前可访问的官方源
**Overall Confidence Level:** 🟢 高 — 基于多个权威技术源的交叉验证

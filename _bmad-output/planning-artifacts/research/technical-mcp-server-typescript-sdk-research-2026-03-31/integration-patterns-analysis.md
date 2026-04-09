# Integration Patterns Analysis

## MCP 通信协议与数据格式

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

## Server 生命周期管理

### 初始化阶段（Initialization）

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

### 运行阶段（Operation）

- 双方**必须**遵守协商的协议版本
- **只能**使用成功协商的能力
- 支持通知机制实现动态更新（如 `notifications/tools/list_changed`）

### 关闭阶段（Shutdown）

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

### 超时与取消

- 实现**应当**为所有发送的请求设置超时
- 超时时发送 `cancellation` 通知并停止等待
- 收到 `progress` 通知时**可以**重置超时计时器
- Claude Code 通过 `MCP_TIMEOUT` 环境变量控制启动超时

_Source: [MCP Lifecycle Specification](https://modelcontextprotocol.io/specification/latest/basic/lifecycle)_

## Tool 注册与实现模式

### 基础 Tool 注册（v1.x SDK）

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

### 结构化输出（Structured Content）

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

### Resource Link 引用模式

工具可返回 `resource_link` 指向大型资源，避免内联嵌入：

```typescript
return {
  content: [
    { type: "resource_link", uri: "cord://graph/full", title: "完整关系图" }
  ],
};
```

### 日志与上下文

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

## Resource 注册模式

### 静态资源

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

### 模板资源（动态 URI）

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

### 参数自动补全（Completions）

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

## 传输层集成模式

### Stdio 传输（CORD 首选）

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

### Streamable HTTP 传输（未来扩展）

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

## 认证与授权模式

### Stdio Transport：环境变量注入

Stdio 模式下**不使用 OAuth**，通过环境变量传递凭证：

```bash
# Claude Code
claude mcp add --transport stdio --env CORD_DB_PATH=/path/to/db cord -- node ./build/index.js

# Cursor (.cursor/mcp.json)
{ "env": { "CORD_DB_PATH": "${workspaceFolder}/cord.db" } }
```

**CORD 项目：** 作为本地工具，主要通过环境变量传递数据库路径等配置，无需 OAuth。

### HTTP Transport：OAuth 2.1（远程场景）

如未来 CORD 提供远程服务，需支持：
- OAuth 2.1 + PKCE
- Bearer Token via `Authorization` Header
- Protected Resource Metadata (RFC 9728)
- Dynamic Client Registration 或 Client ID Metadata Documents

> ⚠️ MVP 阶段无需实现 OAuth，Stdio + 环境变量即可满足需求。

_Source: [MCP Authorization Specification](https://modelcontextprotocol.io/specification/latest/basic/authorization)_

## 通知与动态更新模式

MCP 支持 Server 主动通知 Client 能力变更：

| 通知类型 | 触发条件 | 前提能力 |
|---------|---------|---------|
| `notifications/tools/list_changed` | 工具列表变更 | `tools.listChanged: true` |
| `notifications/resources/list_changed` | 资源列表变更 | `resources.listChanged: true` |
| `notifications/prompts/list_changed` | 提示模板变更 | `prompts.listChanged: true` |

**CORD 使用场景：**
- 冷启动扫描后，新发现的文档关系可触发 `resources/list_changed`
- 插件加载新工具时触发 `tools/list_changed`

## SQLite 数据库集成模式

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

## 跨 IDE 配置文件集成策略

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

## SDK 已知问题与陷阱

| 问题 | 影响 | 解决方案 |
|------|------|---------|
| **Zod 版本冲突**（TS2589 错误） | 多个 zod 版本共存导致类型递归过深 | 使用 `npm ls zod` 检查，通过 resolutions 强制统一版本 |
| **Web Crypto 可用性** | Node.js < 19 时 OAuth helpers 可能失败 | 对 Node.js 18 使用 `--experimental-global-webcrypto` 或 polyfill |
| **SSE 在 v2 中被移除** | v2 Server 不再支持 SSE transport | 使用 Streamable HTTP 替代 |
| **console.log 破坏 Stdio** | 写入 stdout 的任何内容都会破坏 JSON-RPC | 严格使用 console.error 或 stderr 日志 |

_Source: [TypeScript SDK FAQ](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/faq.md)_

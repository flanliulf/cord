# Architectural Patterns and Design

## CORD MCP Server 系统架构模式

基于对 MCP 官方参考实现（filesystem、memory 等）的分析，结合 CORD 项目需求，推荐以下架构模式：

### 推荐架构：分层模块化架构

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

## 设计原则与最佳实践

### Tool 设计原则

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

### 错误处理两层模型

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

### Tool 命名规范

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

## 安全架构模式

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

## 数据架构模式

### SQLite Schema 设计（CORD 核心表）

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

## 部署与运维架构

### npm 分发模式

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

### 日志架构

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

### 测试策略

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

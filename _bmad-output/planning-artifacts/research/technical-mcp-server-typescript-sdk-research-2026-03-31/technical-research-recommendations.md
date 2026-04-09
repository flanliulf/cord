# Technical Research Recommendations

## 实现路线图

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

## 技术栈最终推荐

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

## 成功度量指标

| KPI | 目标 | 度量方式 |
|-----|------|---------|
| **Tool 响应时间** | < 500ms（单次查询） | MCP Inspector 执行计时 |
| **IDE 兼容性** | Claude Code + Cursor + VS Code 均正常 | 手动集成测试 |
| **安装成功率** | > 95%（主流 LTS Node.js） | npm 安装 + better-sqlite3 prebuild |
| **测试覆盖率** | > 80%（Repository + Service 层） | Vitest coverage |
| **冷启动时间** | < 2s（Server 初始化 + DB 连接） | 启动到 `initialized` 通知的时间 |

---

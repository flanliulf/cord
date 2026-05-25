# CORD 项目总览

**生成日期：** 2026-05-21  
**扫描模式：** DP Deep Scan  
**项目类型：** 单体 TypeScript npm 包；主类型 CLI，兼具 library exports 与本地 MCP Server 能力

## 一句话定位

CORD 是面向 AI 辅助开发的文档关系图谱引擎。它把需求、架构、Epic、Story 和用户文档之间的隐性关系写入本地 SQLite 图谱，再通过 CLI 与 MCP Tool 提供确定性的查询、影响分析和关系修正能力。

## 核心目标

CORD 解决的问题不是“让 AI 更会猜”，而是让 AI 在修改文档前后能查询一个可信的数据源。这个数据源由扫描引擎、框架适配器、SQLite 存储和关系服务共同维护。

核心使用路径：

1. `cord init` 生成项目配置、IDE MCP 配置和必要指令文件。
2. `cord scan` 扫描文档并写入 `.cord/cord.db`。
3. `cord query` 或 MCP `query_relations` 查询关系。
4. `cord impact` 或 MCP `analyze_impact` 分析变更影响。
5. MCP `add_relation`、`remove_relation`、`deprecate_relation` 修正图谱。

## 技术栈摘要

| 类别   | 技术                          | 用途                                      |
| ------ | ----------------------------- | ----------------------------------------- |
| 运行时 | Node.js >= 20                 | CLI、MCP Server 和文件系统操作            |
| 语言   | TypeScript strict + ESM       | 全项目源码，NodeNext 解析                 |
| 打包   | tsup                          | 生成 ESM CLI、library 和 MCP server 入口  |
| CLI    | commander                     | `cord` 命令和子命令注册                   |
| 交互   | @clack/prompts                | `cord init` 交互式向导                    |
| MCP    | @modelcontextprotocol/sdk     | stdio MCP Server 与 7 个 Tool             |
| 存储   | better-sqlite3                | 本地 `.cord/cord.db`，同步 Repository API |
| 扫描   | unified + remark              | Markdown AST、frontmatter、GFM 链接解析   |
| 验证   | zod v3                        | CLI/MCP/Service 输入输出契约              |
| 测试   | Vitest                        | 单元测试、集成测试和覆盖率门禁            |
| 质量   | ESLint flat config + Prettier | 静态检查与格式化                          |

## 仓库结构

CORD 是单体仓库，不是多包 monorepo。源码在 `src/`，测试在 `tests/`，用户文档和 DP 项目知识库在 `docs/`，规划与实现历史在 `_bmad-output/`。

| 区域                      | 说明                                                   |
| ------------------------- | ------------------------------------------------------ |
| `src/cli/`                | CLI 入口和 6 个命令工厂                                |
| `src/mcp/`                | MCP Server、Tool 注册和 JSON Schema                    |
| `src/services/`           | CLI 与 MCP 共享的业务服务层                            |
| `src/repositories/`       | SQLite Repository、迁移和 mapper                       |
| `src/scanner/`            | Markdown 扫描管道、插件、规则和生命周期检测            |
| `src/adapters/framework/` | BMAD 与 Generic 框架适配器                             |
| `src/adapters/ide/`       | Claude Code、Cursor、VS Code Copilot、Codex CLI 适配器 |
| `src/schemas/`            | Zod 输入验证和 JSON Schema 导出                        |
| `src/types/`              | 文档、关系、配置、扫描结果等公共类型                   |
| `tests/`                  | 单元测试、集成测试和 fixture 项目                      |
| `.github/workflows/`      | CI、跨平台和 release workflow                          |

## 主要能力地图

| 能力       | 入口                                    | 核心实现                                                                  | 用户文档                                                                               |
| ---------- | --------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 项目初始化 | CLI `cord init`                         | `src/services/init-service.ts`、`src/adapters/ide/`                       | [getting-started.md](getting-started.md), [configuration.md](configuration.md)         |
| 文档扫描   | CLI `cord scan`、MCP `init_graph`       | `src/services/scan-service.ts`、`src/scanner/`、`src/adapters/framework/` | [cli-reference.md](cli-reference.md)                                                   |
| 关系查询   | CLI `cord query`、MCP `query_relations` | `src/services/query-service.ts`                                           | [cli-reference.md](cli-reference.md), [mcp-tools-reference.md](mcp-tools-reference.md) |
| 影响分析   | CLI `cord impact`、MCP `analyze_impact` | `src/services/impact-service.ts`                                          | [cli-reference.md](cli-reference.md), [mcp-tools-reference.md](mcp-tools-reference.md) |
| 关系管理   | MCP only                                | `src/services/relation-service.ts`、`src/mcp/tools/`                      | [mcp-tools-reference.md](mcp-tools-reference.md)                                       |
| 快照导出   | CLI `cord export`                       | `src/services/export-service.ts`                                          | [cli-reference.md](cli-reference.md)                                                   |
| 健康检查   | CLI `cord status`                       | `src/services/status-service.ts`                                          | [cli-reference.md](cli-reference.md)                                                   |

## 架构关键词

- 双入口薄壳：CLI 与 MCP 只做参数解析、协议适配和输出格式化。
- 共享 Service 层：业务逻辑集中在 `src/services/`。
- Repository 接口注入：Service 依赖 `IGraphRepository`，默认实现是 SQLite。
- 框架适配器：扫描边界、文档类型和预设关系由适配器提供。
- 本地优先：所有图谱数据默认写入项目本地 `.cord/cord.db`。

## 已有权威文档

- [README.md](../README.md) 是面向 GitHub 用户的入口说明。
- [getting-started.md](getting-started.md) 是 5 分钟快速开始。
- [cli-reference.md](cli-reference.md) 是 CLI 命令参考。
- [mcp-tools-reference.md](mcp-tools-reference.md) 是 MCP Tool schema 和示例参考。
- [adapter-guide.md](adapter-guide.md) 是框架适配器贡献指南。
- `_bmad-output/project-context.md` 是 AI agent 编码规则入口。
- `_bmad-output/planning-artifacts/architecture/00-index.md` 是原始架构决策索引。

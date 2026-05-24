# Project Documentation Index

**项目：** CORD  
**生成日期：** 2026-05-21  
**扫描模式：** DP Deep Scan  
**项目类型：** monolith，TypeScript npm package，主类型 CLI，兼具 library 与 MCP server 能力

## Project Overview

- **Type:** 单体开发者工具仓库
- **Primary Language:** TypeScript
- **Runtime:** Node.js >= 20
- **Architecture:** CLI + MCP 双入口，共享 Service 层，本地 SQLite 图谱存储
- **Primary Data Store:** `.cord/cord.db`
- **Main Entry Points:** `src/cli/index.ts`, `src/mcp/server.ts`, `src/index.ts`

## Quick Reference

| 主题              | 入口                                               |
| ----------------- | -------------------------------------------------- |
| 项目总览          | [project-overview.md](project-overview.md)         |
| 架构说明          | [architecture.md](architecture.md)                 |
| 源码树            | [source-tree-analysis.md](source-tree-analysis.md) |
| 模块清单          | [component-inventory.md](component-inventory.md)   |
| 数据模型          | [data-models.md](data-models.md)                   |
| 开发指南          | [development-guide.md](development-guide.md)       |
| CLI 用户参考      | [cli-reference.md](cli-reference.md)               |
| MCP Tool 用户参考 | [mcp-tools-reference.md](mcp-tools-reference.md)   |
| 配置参考          | [configuration.md](configuration.md)               |
| 框架适配器开发    | [adapter-guide.md](adapter-guide.md)               |

## Generated Documentation

- [Project Overview](project-overview.md)
- [Architecture](architecture.md)
- [Source Tree Analysis](source-tree-analysis.md)
- [Component Inventory](component-inventory.md)
- [Data Models](data-models.md)
- [Development Guide](development-guide.md)

## Existing User Documentation

- [Getting Started](getting-started.md) - 安装、初始化、扫描、影响分析和状态查看。
- [CLI Reference](cli-reference.md) - 6 个 CLI 命令、参数、JSON 输出和退出码。
- [MCP Tools Reference](mcp-tools-reference.md) - 7 个 MCP Tool、input/output schema 和调用示例。
- [Configuration Reference](configuration.md) - `cord.config.yaml/json` 配置项、IDE 和框架配置。
- [Adapter Guide](adapter-guide.md) - 新增框架适配器的接口、步骤和测试建议。
- [Contributing Guide](contributing.md) - 贡献流程、测试要求和文档更新规则。

## Existing Planning and Implementation Artifacts

- [\_bmad-output/project-context.md](../_bmad-output/project-context.md) - AI agent 主规则文件。
- [\_bmad-output/planning-artifacts/prd.md](../_bmad-output/planning-artifacts/prd.md) - 产品需求文档。
- [\_bmad-output/planning-artifacts/architecture/00-index.md](../_bmad-output/planning-artifacts/architecture/00-index.md) - 架构决策文档索引。
- [\_bmad-output/planning-artifacts/epics/index.md](../_bmad-output/planning-artifacts/epics/index.md) - Epic 规划索引。
- [\_bmad-output/implementation-artifacts/sprint-status.yaml](../_bmad-output/implementation-artifacts/sprint-status.yaml) - Story 与 Epic 状态追踪。
- [\_bmad-output/implementation-artifacts/stories/](../_bmad-output/implementation-artifacts/stories/) - 已实现 Story 规格。
- [\_bmad-output/implementation-artifacts/code-reviews/](../_bmad-output/implementation-artifacts/code-reviews/) - CR 记录。
- [\_bmad-output/implementation-artifacts/retrospectives/](../_bmad-output/implementation-artifacts/retrospectives/) - Epic 回顾。

## Main Reading Paths

### 新人理解项目

1. [project-overview.md](project-overview.md)
2. [architecture.md](architecture.md)
3. [source-tree-analysis.md](source-tree-analysis.md)
4. [development-guide.md](development-guide.md)

### 修改 CLI 行为

1. [architecture.md](architecture.md#cli)
2. [component-inventory.md](component-inventory.md#cli-模块)
3. [cli-reference.md](cli-reference.md)
4. `tests/unit/cli/` 与 `tests/integration/cli/`

### 修改 MCP 或 IDE 集成

1. [architecture.md](architecture.md#mcp-server)
2. [component-inventory.md](component-inventory.md#mcp-模块)
3. [mcp-tools-reference.md](mcp-tools-reference.md)
4. `tests/unit/mcp/` 与 `tests/integration/mcp/`

### 修改存储或查询行为

1. [data-models.md](data-models.md)
2. [architecture.md](architecture.md#数据架构)
3. `src/repositories/`
4. `src/services/query-service.ts`、`src/services/impact-service.ts`

### 修改扫描或框架适配器

1. [architecture.md](architecture.md#扫描架构)
2. [component-inventory.md](component-inventory.md#scanner-模块)
3. [adapter-guide.md](adapter-guide.md)
4. `src/scanner/` 与 `src/adapters/framework/`

## Getting Started

安装和首次使用请从 [getting-started.md](getting-started.md) 开始。开发本仓库请从 [development-guide.md](development-guide.md) 开始。

## Workflow State

DP 扫描状态保存在 [project-scan-report.json](project-scan-report.json)。

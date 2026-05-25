# CORD 模块清单

**生成日期：** 2026-05-21  
**扫描模式：** DP Deep Scan

> 本项目不是 UI 应用，没有前端组件库。本文件按 DP 工作流的 component inventory 产出，但内容聚焦后端/CLI 工具的功能模块。

## 模块总览

| 模块               | 目录                      | 类型        | 主要职责                                                   |
| ------------------ | ------------------------- | ----------- | ---------------------------------------------------------- |
| CLI                | `src/cli/`                | 用户入口    | 命令注册、参数解析、输出格式、退出码                       |
| MCP                | `src/mcp/`                | AI IDE 入口 | stdio server、Tool schema、Tool 注册与调用                 |
| Services           | `src/services/`           | 业务核心    | 扫描、查询、影响分析、导出、状态、初始化、关系管理         |
| Repository         | `src/repositories/`       | 数据访问    | SQLite schema、迁移、事务、mapper、CRUD                    |
| Scanner            | `src/scanner/`            | 解析引擎    | Markdown AST、frontmatter、链接、标题、规则                |
| Framework Adapters | `src/adapters/framework/` | 扩展点      | BMAD/Generic 文档结构适配                                  |
| IDE Adapters       | `src/adapters/ide/`       | 平台适配    | Claude Code、Cursor、VS Code Copilot、Codex CLI 初始化输出 |
| Schemas            | `src/schemas/`            | 契约边界    | Zod 输入验证和 JSON Schema 导出                            |
| Types              | `src/types/`              | 领域模型    | 文档、关系、配置、扫描结果、更新策略                       |
| Utils              | `src/utils/`              | 横切能力    | 配置加载、错误类型、日志                                   |

## CLI 模块

关键文件：

- `src/cli/index.ts`
- `src/cli/verbose.ts`
- `src/cli/commands/*.ts`

命令工厂：

| 命令          | 文件        | 共享服务        |
| ------------- | ----------- | --------------- |
| `cord scan`   | `scan.ts`   | `ScanService`   |
| `cord query`  | `query.ts`  | `QueryService`  |
| `cord impact` | `impact.ts` | `ImpactService` |
| `cord export` | `export.ts` | `ExportService` |
| `cord status` | `status.ts` | `StatusService` |
| `cord init`   | `init.ts`   | `InitService`   |

模块特点：

- 命令层使用依赖注入，便于测试。
- `runCli()` 使用 `parseAsync` 承接 async action。
- 入口守卫会处理 symlink 和带空格路径。
- `--verbose` 在 async action 前生效。

## MCP 模块

关键文件：

- `src/mcp/server.ts`
- `src/mcp/tools/schemas.ts`
- `src/mcp/tools/*.ts`

Tool 清单：

| Tool                 | 目的                |
| -------------------- | ------------------- |
| `query_relations`    | 查询文档关系        |
| `analyze_impact`     | 分析变更影响        |
| `init_graph`         | 初始化或重建图谱    |
| `sync_docs`          | 生成同步建议        |
| `add_relation`       | 手动添加关系        |
| `remove_relation`    | 物理删除关系        |
| `deprecate_relation` | 标记关系 deprecated |

模块特点：

- Tool schema 由 Zod 定义并导出 JSON Schema。
- 输出同时包含 `content` 和 `structuredContent`。
- 运行时支持注入 repository 和 transport，便于测试。
- stdout 只用于 JSON-RPC。

## Service 模块

| Service           | 输入来源 | 输出对象               | 说明                       |
| ----------------- | -------- | ---------------------- | -------------------------- |
| `ScanService`     | CLI/MCP  | `ScanResult`           | 扫描并写入文档节点和关系边 |
| `QueryService`    | CLI/MCP  | `QueryRelationsOutput` | BFS 查询 1 到 3 跳关系     |
| `ImpactService`   | CLI/MCP  | `AnalyzeImpactResult`  | 计算影响范围和建议动作     |
| `RelationService` | MCP      | relation result        | 修正关系图谱               |
| `ExportService`   | CLI      | `ExportResult`         | 导出 JSON 快照             |
| `StatusService`   | CLI      | `StatusResult`         | 诊断图谱健康               |
| `InitService`     | CLI      | `InitResult`           | 初始化配置和 IDE 集成      |

## Scanner 模块

| 子模块                           | 说明                    |
| -------------------------------- | ----------------------- |
| `pipeline.ts`                    | unified/remark 解析管道 |
| `plugins/extract-frontmatter.ts` | 提取 YAML frontmatter   |
| `plugins/extract-links.ts`       | 提取 Markdown links     |
| `plugins/extract-headings.ts`    | 提取标题结构            |
| `rules/frontmatter-rule.ts`      | frontmatter 显式关系    |
| `rules/markdown-link-rule.ts`    | Markdown 链接关系       |
| `rules/directory-rule.ts`        | 目录结构启发式关系      |
| `lifecycle-detector.ts`          | 增量扫描生命周期识别    |

## Framework Adapter 模块

| Adapter                    | 说明                                                                        |
| -------------------------- | --------------------------------------------------------------------------- |
| `BmadFrameworkAdapter`     | 识别 BMAD 项目，扫描 `_bmad-output` 和 `docs`，提供 BMAD 文档类型和预设关系 |
| `GenericFrameworkAdapter`  | 无框架预设的兜底 Markdown 扫描                                              |
| `AbstractFrameworkAdapter` | 通用路径处理、文档发现和排除规则                                            |

BMAD adapter 的关键资产：

- `doc-types.ts`：PRD、architecture、epic、story 等文档类型。
- `preset-rules.ts`：PRD 到架构、Epic 到 Story 等高置信度关系。
- `detector.ts`：多信号检测 `_bmad/`、`_bmad-output/`、skills、frontmatter 等。

## IDE Adapter 模块

| Adapter         | 检测/输出重点                                                              |
| --------------- | -------------------------------------------------------------------------- |
| Claude Code     | `.claude/`、`CLAUDE.md`、settings、rules、hooks、skills                    |
| Cursor          | `.cursor/mcp.json`、Cursor rules                                           |
| VS Code Copilot | `.vscode/mcp.json`、`.github/copilot-instructions.md`、`AGENTS.md` CORD 段 |
| Codex CLI       | `AGENTS.md` CORD 段                                                        |

## Schemas 与 Types

Schema 层负责把模糊用户输入变成稳定 DTO。常见 schema：

- scan input
- query input
- impact input
- export input
- status input
- relation management input
- MCP Tool input/output schema

Types 层定义关系类型、关系状态、文档节点、关系边、配置和更新策略。

## 测试映射

| 模块              | 主要测试目录                                |
| ----------------- | ------------------------------------------- |
| CLI               | `tests/unit/cli/`, `tests/integration/cli/` |
| MCP               | `tests/unit/mcp/`, `tests/integration/mcp/` |
| Services          | `tests/unit/services/`                      |
| Repository        | `tests/unit/repositories/`                  |
| Scanner           | `tests/unit/scanner/`                       |
| Framework Adapter | `tests/unit/adapters/framework/`            |
| IDE Adapter       | `tests/unit/adapters/`                      |
| Schemas           | `tests/unit/schemas/`                       |

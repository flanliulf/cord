# CORD 源码树分析

**生成日期：** 2026-05-21  
**扫描模式：** DP Deep Scan

## 总览

CORD 的源码结构按入口、业务服务、数据访问、扫描引擎、适配器和契约分层。`src/` 当前约 89 个 TypeScript 文件，`tests/unit` 与 `tests/integration` 约 49 个测试文件。

```text
cord/
├── README.md                         # GitHub 项目入口
├── package.json                      # npm 包、CLI bin、脚本和依赖
├── tsconfig.json                     # TypeScript strict + NodeNext
├── tsup.config.ts                    # ESM 打包入口：library / CLI / MCP
├── vitest.config.ts                  # 测试与覆盖率门禁
├── eslint.config.js                  # ESLint flat config
├── src/
│   ├── index.ts                      # library exports 门面
│   ├── cli/                          # CLI 入口和命令
│   │   ├── index.ts                  # createProgram/runCli/entrypoint guard
│   │   ├── verbose.ts                # 全局 verbose 标志处理
│   │   └── commands/                 # scan/query/impact/export/status/init
│   ├── mcp/                          # MCP Server 和 Tool
│   │   ├── server.ts                 # runtime、server、stdio transport、信号处理
│   │   └── tools/                    # 7 个 MCP Tool 和 schema
│   ├── services/                     # CLI/MCP 共享业务服务
│   ├── repositories/                 # SQLite Repository、mapper、迁移
│   ├── scanner/                      # Markdown AST 扫描管道和规则
│   ├── adapters/                     # framework 与 IDE 适配器
│   ├── schemas/                      # Zod 输入/输出契约
│   ├── types/                        # 公共类型与枚举
│   └── utils/                        # config loader、errors、logger 等
├── tests/
│   ├── fixtures/                     # sample projects
│   ├── unit/                         # 模块级单元测试
│   └── integration/                  # CLI/MCP 端到端测试
├── docs/                             # 用户文档与 DP 项目知识库
├── _bmad-output/                     # PRD、架构、Epic、Story、CR、Retro 历史
└── .github/workflows/                # ci/cross-platform/release
```

## 关键目录说明

| 目录                      | 角色               | 重点文件                                                                                             |
| ------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------- |
| `src/cli/`                | 人类命令行入口     | `index.ts`, `commands/*.ts`, `verbose.ts`                                                            |
| `src/mcp/`                | AI IDE 协议入口    | `server.ts`, `tools/schemas.ts`, `tools/*.ts`                                                        |
| `src/services/`           | 业务逻辑中心       | `scan-service.ts`, `query-service.ts`, `impact-service.ts`, `relation-service.ts`, `init-service.ts` |
| `src/repositories/`       | 持久化边界         | `interfaces.ts`, `sqlite-graph-repository.ts`, `mappers.ts`, `migrations/`                           |
| `src/scanner/`            | 文档解析与关系发现 | `pipeline.ts`, `lifecycle-detector.ts`, `plugins/`, `rules/`                                         |
| `src/adapters/framework/` | 框架文档结构适配   | `interfaces.ts`, `abstract-base.ts`, `bmad/`, `generic/`                                             |
| `src/adapters/ide/`       | IDE 初始化适配     | `interfaces.ts`, `detector.ts`, `shared.ts`, `skills-generator.ts`                                   |
| `src/schemas/`            | 输入验证           | `query-input.ts`, `scan-input.ts`, `relation-management-input.ts`, `export-input.ts`                 |
| `src/types/`              | 公共领域模型       | `relations.ts`, `graph.ts`, `documents.ts`, `config.ts`                                              |
| `tests/unit/`             | 细粒度行为验证     | CLI、Service、Repository、Scanner、Adapter、Schema 测试                                              |
| `tests/integration/`      | 真实入口验证       | CLI、MCP server、sample project fixture                                                              |

## 文件数量热点

| 目录                          | 文件数 | 含义                                       |
| ----------------------------- | ------ | ------------------------------------------ |
| `src/schemas`                 | 12     | 契约验证细分，CLI/MCP/Service 输入边界清晰 |
| `src/mcp/tools`               | 10     | 7 个 Tool、schema、shared helper           |
| `src/adapters/ide`            | 9      | 4 个 IDE 适配器加检测/共享工具             |
| `src/services`                | 8      | 每个业务能力一个 Service                   |
| `src/cli/commands`            | 7      | 6 个命令加 index 门面                      |
| `src/repositories/migrations` | 5      | SQLite schema 演进                         |
| `src/scanner/rules`           | 4      | 规则实现与 registry                        |
| `src/adapters/framework/bmad` | 4      | BMAD adapter、检测、文档类型、预设关系     |

## 入口点

### npm library

`src/index.ts` 是 public exports 门面。`package.json` 的 `exports` 指向 `dist/index.js` 与 `dist/index.d.ts`。

### CLI binary

`package.json` 的 `bin.cord` 指向 `dist/cli/index.js`。`tsup.config.ts` 为所有 JS 输出添加 shebang banner。

### MCP server

`tsup.config.ts` 生成 `dist/mcp/server.js`。IDE MCP 配置通过 `cord init` 写入，实际运行时通过 stdio transport 连接 MCP Host。

## 测试结构

```text
tests/
├── fixtures/
│   └── sample-projects/              # BMAD 与 generic 示例项目
├── integration/
│   ├── cli/                          # 真实 CLI 行为
│   └── mcp/                          # MCP server 端到端
└── unit/
    ├── adapters/                     # framework + IDE 适配器
    ├── cli/                          # command factories 与 entrypoint
    ├── mcp/                          # schemas/server/tools
    ├── repositories/                 # SQLite 与 mapper
    ├── scanner/                      # pipeline/rules/lifecycle
    ├── schemas/                      # Zod schema
    ├── services/                     # 业务服务
    └── utils/                        # config loader 等
```

## 构建与发布相关文件

| 文件                                   | 用途                                                         |
| -------------------------------------- | ------------------------------------------------------------ |
| `tsup.config.ts`                       | 打包 `src/index.ts`、`src/cli/index.ts`、`src/mcp/server.ts` |
| `tsconfig.json`                        | 源码编译，生成 declaration/source map                        |
| `tsconfig.check.json`                  | 类型检查配置                                                 |
| `vitest.config.ts`                     | 测试和覆盖率门禁                                             |
| `eslint.config.js`                     | ESLint v10 flat config                                       |
| `.releaserc.json`                      | semantic-release 配置                                        |
| `.github/workflows/ci.yml`             | CI 质量门禁                                                  |
| `.github/workflows/cross-platform.yml` | 跨平台行为验证                                               |
| `.github/workflows/release.yml`        | 发布自动化                                                   |

## 阅读建议

首次理解代码时按下面顺序阅读更省力：

1. [project-overview.md](project-overview.md) 建立能力地图。
2. [architecture.md](architecture.md) 理解多入口单内核结构。
3. `src/services/scan-service.ts` 看扫描如何写图谱。
4. `src/services/query-service.ts` 与 `src/services/impact-service.ts` 看读图谱路径。
5. `src/mcp/server.ts` 与 `src/cli/index.ts` 看两个入口如何共享 Service。
6. `tests/integration/` 看真实用户路径。

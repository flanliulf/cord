# Project Structure & Boundaries

## Requirements to Structure Mapping

| FR 功能域 | 主要模块位置 | 涉及的 Service |
|-----------|-------------|---------------|
| **初始化与配置**（FR1-5） | `src/cli/commands/init.ts` + `src/adapters/ide/` + `src/adapters/framework/` | `InitService` |
| **文档扫描与关系发现**（FR6-12） | `src/scanner/` + `src/adapters/framework/` | `ScanService` |
| **关系查询与影响分析**（FR13-17） | `src/services/query-service.ts` + `src/services/impact-service.ts` | `QueryService` + `ImpactService` |
| **关系管理与修正**（FR18-23） | `src/services/relation-service.ts` | `RelationService` |
| **数据存储与导出**（FR24-27） | `src/repositories/` + `src/services/export-service.ts` | `ExportService` |
| **AI IDE 集成**（FR28-32） | `src/mcp/` + `src/adapters/ide/` | MCP Server + IDE Adapters |
| **框架适配**（FR33-37） | `src/adapters/framework/` | Framework Adapters |
| **文档管辖与配置**（FR38-42） | `src/utils/config-loader.ts` + `src/adapters/` + `docs/` | `InitService` + Config |

## Complete Project Directory Structure

```
cord/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                    # PR 检查：lint + type-check + test + coverage
│   │   ├── release.yml               # semantic-release + npm publish
│   │   └── cross-platform.yml        # 跨平台矩阵测试（ubuntu/macos/windows）
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug-report.yml
│   │   └── feature-request.yml
│   └── PULL_REQUEST_TEMPLATE.md
│
├── src/
│   ├── cli/                          # L3 CLI 入口层（薄壳）
│   │   ├── commands/
│   │   │   ├── init.ts               # cord init — FR1-4, 一键配置
│   │   │   ├── scan.ts               # cord scan — FR6-8, 冷启动/增量扫描/生命周期检测
│   │   │   ├── query.ts              # cord query — FR13-14, 关系查询
│   │   │   ├── impact.ts             # cord impact — FR15-17, 影响分析
│   │   │   ├── export.ts             # cord export — FR26, JSON快照导出
│   │   │   └── status.ts             # cord status — FR5, 健康检查
│   │   ├── formatters/               # CLI 输出格式化
│   │   │   ├── table.ts              # 表格格式化
│   │   │   ├── tree.ts               # 树形格式化（关系图）
│   │   │   └── json.ts               # JSON 格式化
│   │   └── index.ts                  # CLI 程序入口，Commander 根命令
│   │
│   ├── mcp/                          # L3 MCP Server 入口层（薄壳）
│   │   ├── tools/
│   │   │   ├── analyze-impact.ts     # analyze_impact — FR15-17, FR28
│   │   │   ├── query-relations.ts    # query_relations — FR13-14, FR28
│   │   │   ├── sync-docs.ts          # sync_docs — FR28
│   │   │   ├── init-graph.ts         # init_graph — FR28
│   │   │   ├── add-relation.ts       # add_relation — FR18, FR20
│   │   │   ├── remove-relation.ts    # remove_relation — FR19, FR20
│   │   │   └── deprecate-relation.ts # deprecate_relation — FR19, FR20
│   │   ├── server.ts                 # MCP Server 启动，Stdio Transport
│   │   └── index.ts
│   │
│   ├── services/                     # L2 Service 层（核心业务逻辑）
│   │   ├── init-service.ts           # 项目初始化逻辑：IDE检测+框架检测+配置生成
│   │   ├── scan-service.ts           # 扫描编排：调用 scanner 管道+生命周期检测，写入 repository
│   │   ├── query-service.ts          # 关系查询：一跳/多跳/类型过滤
│   │   ├── impact-service.ts         # 影响分析：图遍历+传播行为+建议动作
│   │   ├── relation-service.ts       # 关系CRUD：添加/移除/deprecated/来源追溯/收敛保护
│   │   ├── export-service.ts         # JSON快照导出
│   │   ├── status-service.ts         # 健康检查：过时关系/不一致/统计
│   │   └── index.ts                  # Service 层公共 API 门面
│   │
│   ├── repositories/                 # L1 Repository 层（数据访问）
│   │   ├── interfaces.ts             # IGraphRepository 接口定义
│   │   ├── sqlite-graph-repository.ts # SQLite 实现
│   │   ├── migrations/               # SQL 迁移脚本
│   │   │   ├── 001-initial-schema.sql # documents + relations + sync_states 三表
│   │   │   └── runner.ts             # 迁移执行器（版本检测+按序执行）
│   │   ├── mappers.ts                # snake_case ↔ camelCase 转换
│   │   └── index.ts
│   │
│   ├── scanner/                      # 扫描引擎（策略模式 + remark 管道）
│   │   ├── pipeline.ts               # remark/unified 处理管道编排
│   │   ├── lifecycle-detector.ts     # 文档生命周期检测（重命名/移动/删除→孤立节点清理）
│   │   ├── rules/                    # 规则引擎策略（MVP Phase A）
│   │   │   ├── frontmatter-rule.ts   # frontmatter 引用解析（置信度最高）
│   │   │   ├── markdown-link-rule.ts # Markdown 链接提取
│   │   │   ├── directory-rule.ts     # 目录结构推断
│   │   │   └── index.ts             # IScanRule 接口 + 规则注册
│   │   ├── plugins/                  # remark 自定义插件
│   │   │   ├── extract-frontmatter.ts
│   │   │   ├── extract-links.ts
│   │   │   └── extract-headings.ts
│   │   ├── types.ts                  # 扫描相关类型定义
│   │   └── index.ts
│   │
│   ├── adapters/                     # 可插拔适配层
│   │   ├── framework/                # 框架适配器
│   │   │   ├── interfaces.ts         # IFrameworkAdapter 接口
│   │   │   ├── abstract-base.ts      # AbstractFrameworkAdapter 抽象基类
│   │   │   ├── bmad/                 # BMAD-Method 适配模块
│   │   │   │   ├── adapter.ts        # BmadFrameworkAdapter 实现
│   │   │   │   ├── doc-types.ts      # 18 种 BMAD 文档类型定义
│   │   │   │   ├── preset-rules.ts   # 5 条预设规则 × 19 关系对
│   │   │   │   └── detector.ts       # 5 层递进检测策略
│   │   │   ├── generic/              # 通用规则退化（无框架时）
│   │   │   │   └── adapter.ts
│   │   │   └── index.ts
│   │   ├── ide/                      # IDE 适配器
│   │   │   ├── interfaces.ts         # IIdeAdapter 接口
│   │   │   ├── claude-code.ts        # Claude Code：Hooks + CLAUDE.md + MCP 配置
│   │   │   ├── cursor.ts             # Cursor：.cursor/mcp.json + .cursor/rules/
│   │   │   ├── vscode-copilot.ts     # VS Code Copilot：copilot-instructions.md + MCP Host
│   │   │   ├── codex-cli.ts          # Codex CLI：AGENTS.md（基础集成层）
│   │   │   ├── detector.ts           # IDE 自动检测逻辑
│   │   │   ├── skills-generator.ts   # Skills 定义文件生成器（FR31：4 个核心意图场景）
│   │   │   └── index.ts
│   │   └── index.ts
│   │
│   ├── schemas/                      # Zod schema 定义（统一验证层）
│   │   ├── document.ts               # 文档节点 schema
│   │   ├── relation.ts               # 关系边 schema
│   │   ├── config.ts                 # cord.config.yaml schema
│   │   ├── scan-input.ts             # 扫描输入 schema
│   │   ├── query-input.ts            # 查询输入 schema
│   │   ├── impact-input.ts           # 影响分析输入 schema
│   │   └── index.ts
│   │
│   ├── utils/                        # 公共工具
│   │   ├── errors.ts                 # CordError 基类 + 子类层级
│   │   ├── logger.ts                 # 四级 Logger（debug/info/warn/error）
│   │   ├── config-loader.ts          # cord.config.yaml 加载 + Zod 验证
│   │   └── index.ts
│   │
│   └── types/                        # 全局类型定义
│       ├── relations.ts              # 9 种关系类型常量（RELATION_TYPES as const）+ RelationType 字符串联合类型
│       ├── documents.ts              # DocumentNode 类型
│       ├── graph.ts                  # 图遍历相关类型
│       ├── config.ts                 # 配置类型
│       └── index.ts
│
├── tests/                            # 所有测试（独立目录）
│   ├── unit/
│   │   ├── services/
│   │   │   ├── init-service.test.ts
│   │   │   ├── scan-service.test.ts
│   │   │   ├── query-service.test.ts
│   │   │   ├── impact-service.test.ts
│   │   │   ├── relation-service.test.ts
│   │   │   └── export-service.test.ts
│   │   ├── repositories/
│   │   │   ├── sqlite-graph-repository.test.ts
│   │   │   └── mappers.test.ts
│   │   ├── scanner/
│   │   │   ├── pipeline.test.ts
│   │   │   └── rules/
│   │   │       ├── frontmatter-rule.test.ts
│   │   │       ├── markdown-link-rule.test.ts
│   │   │       └── directory-rule.test.ts
│   │   ├── adapters/
│   │   │   ├── framework/
│   │   │   │   ├── bmad-adapter.test.ts
│   │   │   │   └── generic-adapter.test.ts
│   │   │   └── ide/
│   │   │       ├── claude-code.test.ts
│   │   │       ├── cursor.test.ts
│   │   │       ├── codex-cli.test.ts
│   │   │       └── detector.test.ts
│   │   └── utils/
│   │       ├── errors.test.ts
│   │       └── logger.test.ts
│   ├── integration/
│   │   ├── cli/
│   │   │   ├── init-command.test.ts
│   │   │   ├── scan-command.test.ts
│   │   │   └── query-command.test.ts
│   │   ├── mcp/
│   │   │   ├── analyze-impact-tool.test.ts
│   │   │   └── query-relations-tool.test.ts
│   │   └── flows/
│   │       ├── scan-to-query.test.ts       # 扫描→查询端到端流
│   │       └── init-scan-impact.test.ts    # 初始化→扫描→影响分析全流程
│   └── fixtures/
│       ├── sample-projects/
│       │   ├── bmad-project/               # 模拟 BMAD 框架项目
│       │   ├── generic-project/            # 模拟无框架项目
│       │   └── empty-project/              # 空项目
│       ├── documents/                      # 各种测试用 Markdown 文档
│       │   ├── with-frontmatter.md
│       │   ├── with-links.md
│       │   ├── complex-relations.md
│       │   └── unparseable.md
│       └── configs/
│           ├── valid-config.yaml
│           └── invalid-config.yaml
│
├── schemas/                              # JSON Schema（IDE 验证用）
│   └── cord-config.schema.json           # cord.config.yaml 的 JSON Schema
│
├── docs/                                  # 用户文档（FR42 贡献者文档）
│   ├── getting-started.md                 # 快速开始指南（< 5 分钟阅读）
│   ├── cli-reference.md                   # CLI 命令文档（用法/参数/选项/示例）
│   ├── mcp-tools-reference.md             # MCP Tools 文档（schema/场景/调用示例）
│   ├── configuration.md                   # cord.config 配置参考 + IDE 配置模板
│   ├── adapter-guide.md                   # IFrameworkAdapter 接口 API + 最小适配教程
│   └── contributing.md                    # PR 提交规范 + 审阅流程 + 集成测试指南
│
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
├── eslint.config.js
├── .prettierrc
├── .gitignore
├── .npmignore
├── LICENSE                               # MIT
├── README.md
└── CHANGELOG.md                          # semantic-release 自动生成
```

## Architectural Boundaries

**层间通信边界：**

```
┌─────────────────────────────────────────────────┐
│  L3 入口层                                       │
│  ┌──────────┐    ┌──────────┐                   │
│  │ CLI 薄壳  │    │ MCP 薄壳  │                   │
│  │(Commander)│    │(Stdio/RPC)│                   │
│  └─────┬─────┘    └─────┬─────┘                   │
│        │  Zod 验证边界   │                        │
├────────┼────────────────┼────────────────────────┤
│  L2 Service 层（核心业务逻辑）                     │
│  ┌──────────┬──────────┬──────────┬────────────┐ │
│  │InitSvc   │ScanSvc   │QuerySvc  │ImpactSvc   │ │
│  │          │          │          │RelationSvc │ │
│  │          │          │          │ExportSvc   │ │
│  └────┬─────┴────┬─────┴────┬─────┴──────┬─────┘ │
│       │          │          │            │        │
│       │ IGraphRepository 接口边界        │        │
├───────┼──────────┼──────────┼────────────┼───────┤
│  L1 Repository 层                                 │
│  ┌──────────────────────────────────────────────┐ │
│  │ SqliteGraphRepository                        │ │
│  │ (snake_case ↔ camelCase 转换边界)            │ │
│  └──────────────────┬───────────────────────────┘ │
│                     │                             │
│  ┌──────────────────┴───────────────────────────┐ │
│  │ SQLite DB (.cord/cord.db)                    │ │
│  │ documents | relations | sync_states          │ │
│  └──────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘

  ┌──────────────────┐     ┌──────────────────────┐
  │ Scanner 引擎      │     │ Adapters 适配层       │
  │ (remark 管道)     │     │ ┌─ Framework ───────┐│
  │ ┌─ Rules ───────┐│     │ │ IFrameworkAdapter  ││
  │ │ frontmatter   ││     │ │ ├─ BMAD            ││
  │ │ markdown-link ││     │ │ └─ Generic         ││
  │ │ directory     ││     │ └────────────────────┘│
  │ └───────────────┘│     │ ┌─ IDE ─────────────┐│
  │                   │     │ │ IIdeAdapter       ││
  │  被 ScanService   │     │ │ ├─ Claude Code    ││
  │  调用             │     │ │ ├─ Cursor         ││
  │                   │     │ │ ├─ VS Code Copilot││
  │                   │     │ │ └─ Codex CLI      ││
  └──────────────────┘     │ └────────────────────┘│
                           └──────────────────────┘
```

**关键边界规则：**

| 边界 | 规则 | 违反后果 |
|------|------|---------|
| **入口→Service** | 入口层只调用 Service 公共 API（index.ts），不包含业务逻辑 | CLI/MCP 行为不一致 |
| **Service→Repository** | Service 只依赖 `IGraphRepository` 接口，不引用 SQLite 实现 | 存储引擎无法切换 |
| **Repository→DB** | Repository 内部完成 snake↔camelCase 转换，Service 只看到 camelCase | 命名混乱 |
| **Service→Scanner** | ScanService 编排 Scanner 管道，Scanner 不直接写 Repository | 扫描逻辑与存储耦合 |
| **Service→Adapter** | InitService/ScanService 通过 Adapter 接口调用，不直接引用 BMAD/IDE 具体实现 | 适配不可插拔 |
| **Zod 验证边界** | 入口层验证后才传入 Service | 无效数据进入核心逻辑 |

## Data Flow

```
文档变更 → Hook/手动触发
    ↓
CLI: cord impact <doc>  /  MCP: analyze_impact({docPath})
    ↓ Zod 验证
Service: ImpactService.analyzeImpact()
    ↓
Repository: IGraphRepository.getRelations(docId)
    ↓
SQLite: SELECT FROM relations WHERE source_doc_id = ?
    ↓ BFS 图遍历
Service: 构建影响结果（受影响文档 + 关系类型 + 建议动作）
    ↓
CLI: chalk 格式化终端输出  /  MCP: JSON-RPC 响应
```

## Cross-Cutting Concerns Mapping

| 关注点 | 涉及模块 | 实现位置 |
|--------|---------|---------|
| **Zod 验证** | CLI commands、MCP tools | `src/schemas/` → 入口层调用 |
| **错误处理** | 所有模块 | `src/utils/errors.ts` 定义，入口层捕获转换 |
| **日志** | 所有模块 | `src/utils/logger.ts` 统一 Logger |
| **配置加载** | InitService、所有需要读配置的模块 | `src/utils/config-loader.ts` |
| **snake↔camelCase** | Repository 层 | `src/repositories/mappers.ts` |
| **框架检测** | InitService、ScanService | `src/adapters/framework/` 适配器 |
| **IDE 检测** | InitService | `src/adapters/ide/detector.ts` |

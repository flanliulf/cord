# Core Architectural Decisions

## Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- D1: Zod 数据验证 — 影响所有入口层和 Service 层
- D2: 版本号 + 增量 SQL 迁移 — 影响存储层和版本升级
- D3: 自定义 Error 类层级 — 影响全局错误处理
- D5: 按架构层组织目录 — 影响项目初始化

**Important Decisions (Shape Architecture):**
- D4: 自研轻量 Logger — 影响调试和运维体验
- D6: YAML + JSON Schema 配置 — 影响用户配置体验
- D7: GitHub Actions CI/CD — 影响发布流程
- D8: 80%+ 代码覆盖率 — 影响测试策略

**Deferred Decisions (Post-MVP):**
- RESTful API 层设计（v0.5）
- Embedding 增强引擎配置（v0.5）
- 团队协作/共享图谱传输协议（v1.0）

## Data Architecture

**D1. 数据验证策略：Zod Schema**

- **决策：** 在 Service 层使用 Zod 定义 schema，所有输入（CLI 参数、MCP Tool 参数、扫描产出）统一验证
- **版本：** Zod v3.x（当前稳定版）
- **理由：** 与 MCP Tools 的 `inputSchema`（JSON Schema 格式）天然兼容；CORD 有多个入口（CLI / MCP / 未来 REST），统一验证层价值高；TypeScript 类型推断一流
- **影响范围：** Service 层、CLI 入口层、MCP Server 层
- **实现要点：**
  - 定义 `src/schemas/` 目录存放所有 Zod schema
  - CLI 参数验证、MCP Tool inputSchema、Service 层输入验证共享同一套 schema
  - Zod schema 可通过 `zod-to-json-schema` 转换为 MCP Tools 所需的 JSON Schema

**D2. 数据迁移策略：版本号 + 增量 SQL 脚本**

- **决策：** 数据库内存储 `schema_version`，应用启动时检测版本差异，按序执行迁移脚本
- **理由：** CORD 是嵌入式本地数据库，不需要 ORM 级别的迁移框架；用户手动添加的关系必须保留，排除按需重建方案
- **影响范围：** Repository 层、应用启动流程
- **实现要点：**
  - `src/repositories/migrations/` 目录存放有序编号的 SQL 脚本（`001_initial.sql`、`002_add_index.sql`...）
  - 应用启动时 Repository 层自动检测并执行待执行的迁移
  - 迁移在事务中执行，失败可回滚
  - `cord status` 展示当前 schema 版本

## Error Handling & Logging

**D3. 错误处理模式：自定义 Error 类层级**

- **决策：** `CordError` 基类 → `ScanError` / `QueryError` / `ConfigError` / `StorageError` / `AdapterError` 等子类
- **理由：** 简单务实，与 Node.js 生态习惯一致；CLI 和 MCP 两个入口需要将错误转化为用户可理解的消息；自定义 Error 携带 `code` + `suggestion` 字段满足 NFR19
- **影响范围：** 全局，所有模块
- **实现要点：**
  - `CordError` 基类包含 `code: string`、`suggestion: string`、`context: Record<string, unknown>`
  - CLI 入口层：捕获 CordError，用 chalk 格式化输出错误信息和修复建议
  - MCP 入口层：捕获 CordError，转换为 MCP 标准错误响应格式
  - 错误码命名规范：`CORD_SCAN_001`、`CORD_QUERY_001` 等

**D4. 日志策略：自研轻量 Logger**

- **决策：** 自研 debug/info/warn/error 四级 Logger，CLI 用 chalk 着色输出，MCP 通过 stderr
- **理由：** CORD 是 CLI 工具，日志面向终端输出（用户可读），不需要结构化 JSON；chalk v5+ 纯 ESM，与项目 ESM-first 一致
- **影响范围：** 全局，所有模块
- **实现要点：**
  - `src/utils/logger.ts` 提供统一 Logger
  - 四个级别：`debug`（默认隐藏）、`info`、`warn`、`error`
  - `CORD_DEBUG=1` 或 `--verbose` 启用 debug 级别输出
  - MCP Server 模式下日志输出到 stderr（避免污染 stdout 的 JSON-RPC 通信）

## Project Structure & Module Organization

**D5. 目录结构策略：按架构层分（Layered）**

- **决策：** 顶层按架构层组织，层内按功能域细分
- **理由：** CORD 的核心架构特征是「双入口共享 Service 层」，按层分组最直观体现此设计
- **影响范围：** 项目初始化、所有开发活动
- **目录结构：**

```
src/
├── cli/                    # L3 CLI 入口层（薄壳）
│   ├── commands/           # Commander.js 命令定义
│   │   ├── init.ts
│   │   ├── scan.ts
│   │   ├── query.ts
│   │   ├── impact.ts
│   │   ├── export.ts
│   │   └── status.ts
│   └── index.ts            # CLI 入口
├── mcp/                    # L3 MCP Server 入口层（薄壳）
│   ├── tools/              # MCP Tool 定义
│   │   ├── analyze-impact.ts
│   │   ├── query-relations.ts
│   │   ├── sync-docs.ts
│   │   ├── init-graph.ts
│   │   ├── add-relation.ts      # FR18/FR20 关系管理
│   │   ├── remove-relation.ts   # FR19/FR20 关系管理
│   │   └── deprecate-relation.ts # FR19/FR20 关系管理
│   └── server.ts           # MCP Server 入口
├── services/               # L2 Service 层（核心业务逻辑）
│   ├── init-service.ts
│   ├── scan-service.ts
│   ├── query-service.ts
│   ├── impact-service.ts
│   ├── relation-service.ts
│   ├── export-service.ts
│   └── status-service.ts
├── repositories/           # L1 Repository 层（数据访问）
│   ├── sqlite-graph-repository.ts # IGraphRepository 的 SQLite 实现
│   └── migrations/         # SQL 迁移脚本
├── scanner/                # 扫描引擎（策略模式）
│   ├── pipeline.ts         # remark 处理管道
│   ├── rules/              # 规则引擎策略
│   └── types.ts
├── adapters/               # 框架适配层（可插拔）
│   ├── framework/          # IFrameworkAdapter 接口 + 基类
│   │   ├── interfaces.ts
│   │   ├── abstract-base.ts
│   │   └── bmad/           # BMAD 适配模块
│   └── ide/                # IDE 适配层
│       ├── interfaces.ts
│       ├── claude-code.ts
│       ├── cursor.ts
│       ├── vscode-copilot.ts
│       └── codex-cli.ts
├── schemas/                # Zod schema 定义
├── utils/                  # 公共工具
│   ├── logger.ts
│   ├── errors.ts           # CordError 类层级
│   └── config-loader.ts    # 配置加载
└── types/                  # 全局类型定义
    ├── relations.ts        # 9 种关系类型
    ├── documents.ts
    └── graph.ts
```

## Configuration Management

**D6. 配置文件格式：YAML + JSON 双格式 + JSON Schema**

- **决策：** 同时支持 `cord.config.yaml`（推荐）和 `cord.config.json` 两种配置格式，加载优先级 YAML > JSON（同时存在时 YAML 优先）。提供 JSON Schema 供 IDE 验证和自动补全
- **理由：** CORD 用户群体（BMAD/Superpowers 用户）大量使用 YAML（frontmatter），YAML 为推荐格式；同时支持 JSON 格式以适配偏好 JSON 的开发者和自动化工具链。gray-matter 已在依赖中可复用 YAML 解析；JSON 使用 Node.js 内置 `JSON.parse` 零额外依赖
- **影响范围：** `cord init` 生成流程、配置加载模块
- **实现要点：**
  - `cord init` 默认生成 `cord.config.yaml` + `.cord/` 数据目录（可通过 `--format json` 生成 `cord.config.json`）
  - 配置加载策略：按 `cord.config.yaml` → `cord.config.json` 顺序检测，找到第一个即停止
  - JSON Schema 发布到 schemastore.org（后期），本地通过 YAML 文件头 `# yaml-language-server: $schema=...` 或 JSON `"$schema"` 字段引用
  - 配置项（7 项，对齐 PRD cord.config schema）：`framework`（框架类型）、`ide`（IDE 类型）、`scanPaths`（扫描路径）、`excludePaths`（排除路径）、`confidenceThreshold`（影响分析最低置信度阈值，默认 0.50）、`relationTypes`（自定义关系类型扩展）、`adapters`（启用的框架适配模块）；所有配置项均可选，`cord init` 自动生成合理默认值

## CI/CD & Quality Gates

**D7. CI/CD 工作流：GitHub Actions**

- **决策：** GitHub Actions 作为唯一 CI/CD 平台
- **理由：** CORD 是 GitHub 开源项目，与 semantic-release / npm provenance 原生集成
- **影响范围：** 发布流程、PR 质量门禁
- **实现要点：**
  - PR 检查：lint + type-check + test + coverage
  - 发布流程：semantic-release 自动化版本 + npm publish + GitHub Release
  - 跨平台矩阵：ubuntu / macos / windows（better-sqlite3 native addon 验证）
  - npm provenance 从第一天启用

**D8. 代码覆盖率目标：80%+**

- **决策：** 整体行覆盖率 ≥ 80%，核心 Service 层和 Scanner 引擎要求更高
- **理由：** MVP 阶段务实为主，核心引擎高标准，入口层薄壳可宽松
- **影响范围：** 测试策略、CI 质量门禁
- **分级要求：**
  - Service 层 + Scanner 引擎：≥ 90%（核心业务逻辑）
  - Repository 层：≥ 85%（数据访问关键路径）
  - CLI / MCP 入口层：≥ 70%（薄壳，主要是参数转发）
  - Adapters 层：≥ 80%（适配逻辑需可靠）

## Decision Impact Analysis

**Implementation Sequence:**

1. D5 目录结构 → 项目骨架搭建（第一个 Story）
2. D3 Error 类 + D4 Logger → 基础设施层（所有模块依赖）
3. D1 Zod Schema → 数据验证层（Service 层依赖）
4. D2 数据迁移 → 存储层初始化（Repository 依赖）
5. D6 配置管理 → `cord init` 功能实现
6. D7 CI/CD → 首次发布前就绪
7. D8 覆盖率 → CI 质量门禁配置

**Cross-Component Dependencies:**

- D1 (Zod) ↔ D3 (Error): 验证失败时抛出 `CordError` 子类，两者需协同设计
- D5 (目录结构) → D1/D2/D3/D4: 目录结构决定了其他所有模块的物理位置
- D6 (YAML 配置) ↔ D1 (Zod): 配置文件加载后通过 Zod schema 验证
- D7 (CI/CD) ↔ D8 (覆盖率): CI 流水线集成覆盖率检查门禁

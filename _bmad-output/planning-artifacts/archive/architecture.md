---
stepsCompleted:
  - 1
  - 2
  - 3
  - 4
  - 5
  - 6
  - 7
  - 8
status: 'complete'
completedAt: '2026-04-08'
lastStep: 8
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/product-brief-cord.md'
  - '_bmad-output/planning-artifacts/product-brief-cord-distillate.md'
  - '_bmad-output/planning-artifacts/research/technical-research-roadmap.md'
workflowType: 'architecture'
project_name: 'CORD'
user_name: 'Fancyliu'
date: '2026-04-07'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**

CORD 包含 42 项功能需求，组织为 8 个功能域：

1. **项目初始化与配置**（FR1-FR5）：`cord init` 一键配置、IDE/框架自动检测、配置状态查看。这是用户首次体验的入口，架构上需要支持多IDE检测策略和框架检测策略的可插拔组合。

2. **文档扫描与关系发现**（FR6-FR12）：冷启动扫描、增量扫描、文档生命周期变更检测（重命名/移动/删除→孤立节点清理）、规则引擎关系识别、9种传播行为分类、置信度评分、文档级关系索引（v0.1 核心粒度，章节级为 v0.5+ 扩展）。这是 CORD 的核心引擎，架构上需要管道式处理（remark AST）、策略模式（多种识别规则）、渐进增强（规则→Embedding→LLM三级）、文件系统快照对比（生命周期检测）。

3. **关系查询与影响分析**（FR13-FR17）：一跳/多跳查询、类型过滤、变更影响分析、传播行为标注。这是 CORD 价值交付的主通道，架构上要求图遍历算法高效实现和查询结果的结构化输出。

4. **关系管理与修正**（FR18-FR23）：手动添加/移除/标记deprecated、MCP Tools暴露关系CRUD操作（AI IDE负责意图解析）、来源追溯、收敛保护机制（手动修正 > 框架预设 > 自动扫描，增量扫描时不覆盖手动修正）、文档类别更新策略配置。这是图谱准确度收敛的闭环机制。

5. **数据存储与导出**（FR24-FR27）：SQLite图模型存储、同步状态表、JSON快照导出、零云依赖。架构上通过Repository Pattern隔离，预留存储引擎切换能力。

6. **AI IDE 集成**（FR28-FR32）：MCP Server + Tools、Hooks文档变更触发、IDE指令文件生成、Skills定义文件（4个核心意图场景，含触发条件+MCP Tool调用序列+预期输出格式）、长驻进程。这是 CORD 与 AI 生态连接的桥梁，架构上需要三层分级集成（MCP通用层→指令引导层→原生Hooks层）。

7. **框架适配**（FR33-FR37）：IFrameworkAdapter接口、BMAD 18种文档类型适配、声明式注册、通用规则退化、社区可扩展（验收标准：4小时最小适配模块）。架构上采用core + adapters模式，AbstractFrameworkAdapter抽象基类提取公共逻辑。

8. **文档管辖范围与配置**（FR38-FR42）：管辖范围明确排除源码目录（src/）、IDE指令文件范围（5种格式，.windsurf/rules为v0.5+扩展）、预设文档路径配置、用户自定义配置扩展（cord.config）、贡献者文档（接口API说明+适配教程+集成测试指南+PR规范）。

**Non-Functional Requirements:**

19 项NFR分为4个类别，对架构决策有直接约束：

- **性能（NFR1-6）**：一跳 p95 < 1ms、三跳 p95 < 5ms、CLI冷启动 p95 < 200ms、MCP Tool p95 < 50ms、扫描 ≥ 4文档/秒、增量无变更 p95 < 100ms。要求：嵌入式数据库直接内存访问、索引优化、懒加载策略、增量处理。
- **可扩展性（NFR7-10）**：2000文档/50000关系不退化10%以上、适配器横向扩展（核心模块零变更）、关系类型可扩展（新旧共存）、MCP Tools接口前向兼容（JSON Schema快照对比）。要求：插件架构、接口契约稳定、数据模型版本策略。
- **集成（NFR11-14）**：3大IDE MCP兼容（含版本范围）、零侵入指令注入（SHA-256校验）、CLI↔MCP语义一致（JSON深度对比）、JSON快照向前兼容（含schemaVersion字段）。要求：共享Service层、适配器模式、独立文件注入。
- **可靠性（NFR15-19）**：扫描中断数据库一致性100%（事务保护）、扫描容错跳过异常文档、MCP Server优雅退出（SIGTERM ≤2s关闭SQLite+flush日志，进程生命周期由IDE Host管理）、--rebuild恢复路径（快照diff为空）、错误信息统一格式含修复建议（≥95%覆盖）。要求：事务管理、错误隔离、幂等重建、SIGTERM handler。

**Scale & Complexity:**

- Primary domain: Developer Tool — CLI + MCP Server（开发者工具链基础设施）
- Complexity level: Medium-High
- Estimated architectural components: ~15-20 个核心模块
  - CLI层（6个命令模块）、MCP Server层、Service层（4-5个核心服务）、Repository层、Scanner引擎、Framework Adapter层、IDE Adapter层、指令文件生成器

### Technical Constraints & Dependencies

**已锁定的技术选型（11项TR）：**

| 层次 | 技术选型 | 架构约束 |
|------|----------|----------|
| 运行时 | TypeScript / Node.js 20+ | 统一语言，async/await并发 |
| 存储 | SQLite + better-sqlite3 v12.8.0 | 同步API，嵌入式零运维，图模型思维建表 |
| MCP | TypeScript SDK v1.x + Stdio Transport（SSE不需要——本地优先定位，三大IDE均通过Stdio连接） | 长驻进程，JSON-RPC，Tools原语优先 |
| 文档解析 | remark/unified.js | 管道式AST，9核心依赖+6自定义插件 |
| CLI | Commander.js v14 | 命令模式，子命令懒加载 |
| 构建 | tsup | TypeScript→JavaScript编译 |
| 交互 | @clack/prompts + picocolors | CLI交互向导+终端颜色 |
| 可视化 | Mermaid.js v11.13.0（v0.5） | DSL优先，Builder模式生成器 |
| npm分发 | MVP模式C→v0.5模式A | 渐进式，semantic-release自动化 |
| 存储抽象 | Repository Pattern（IGraphRepository） | 存储引擎可切换 |

**外部依赖约束：**
- better-sqlite3 native addon 跨平台构建：MVP依赖上游预编译
- MCP协议版本兼容性：锁定v1.x SDK
- npm provenance 供应链安全从第一天启用

### Cross-Cutting Concerns Identified

1. **双入口一致性（CLI ↔ MCP）**：两个接口入口共享Service层，必须保证语义和行为100%一致。Service层是架构的核心锚点。

2. **可插拔框架适配**：IFrameworkAdapter → AbstractFrameworkAdapter → 具体适配器（BMAD/Superpowers/社区）。新框架适配不触碰核心代码。

3. **跨IDE兼容**：端口-适配器模式 + 策略模式。IDE Hooks能力两极分化（Claude Code 20+事件 vs Cursor/Copilot 无Hooks），通过三层分级集成架构（MCP→指令引导→原生Hooks）统一处理。

4. **错误处理与容错**：贯穿所有层的统一错误处理策略——扫描容错跳过、MCP Server优雅退出（SIGTERM handler关闭SQLite+flush日志，进程生命周期由IDE Host管理）、错误信息含上下文和修复建议。

5. **数据前向兼容**：JSON快照格式（NFR15）、关系类型体系（NFR9）、MCP Tools接口（NFR10）——三个维度的向前兼容需要版本策略和迁移机制。

6. **性能预算**：懒加载（CLI冷启动 < 200ms）、索引优化（查询 < 1ms）、增量处理（无变更扫描 < 100ms）——性能约束贯穿多个架构层。

7. **渐进式增强**：冷启动扫描的三级架构（规则→Embedding→LLM）、npm分发的演进（模式C→模式A）、可视化的分阶段交付——架构需支持能力的渐进式叠加。

## Starter Template Evaluation

### Primary Technology Domain

CLI Tool + MCP Server（开发者工具链基础设施）— 基于项目需求分析，CORD 是一个本地优先的 CLI 工具 + MCP Server 双入口系统，不属于 Web 应用、移动应用或传统 API 服务的范畴。

### Starter Options Considered

| 选项 | 评估结论 | 理由 |
|------|---------|------|
| **Custom Setup（从零搭建）** | ✅ **选定** | 技术栈已由11项TR完全锁定，架构独特性（CLI+MCP双入口+共享Service+Repository Pattern+框架适配器）无现成模板覆盖 |
| oclif (Salesforce CLI 框架) | ❌ 排除 | 过重、自带框架约束与Commander.js v14冲突、TR5已否决 |
| create-ts-starter 类通用模板 | ❌ 排除 | 面向通用库/工具、不包含CLI/MCP架构、仍需大量改造 |
| MCP Server 官方模板 | ⚠️ 仅参考 | 仅覆盖MCP层、缺少CLI/存储/扫描引擎等核心层 |

### Selected Starter: Custom Setup（从零搭建）

**Rationale for Selection:**

1. **技术栈已完全锁定** — 11项TR已确定所有核心依赖，Starter Template 的选型优势（帮你做技术决策）不再适用
2. **架构独特性** — CLI + MCP双入口 + 共享Service层 + Repository Pattern + 框架适配器，没有现成模板能覆盖
3. **避免技术债** — 使用不匹配的 Starter 意味着首先花时间剥离不需要的东西，再添加需要的东西
4. **控制力** — 架构分层、目录结构、模块边界完全由我们设计，确保与 PRD 需求精确对齐

**Initialization Command:**

```bash
# 1. 创建项目并初始化
mkdir cord && cd cord
npm init -y

# 2. 安装核心开发依赖
npm install -D typescript tsup @types/node vitest eslint prettier

# 3. 安装核心运行时依赖
npm install commander @clack/prompts picocolors better-sqlite3 @anthropic-ai/mcp-sdk
npm install unified remark-parse remark-frontmatter remark-gfm gray-matter

# 4. 配置 TypeScript + tsup + Vitest
```

**Architectural Decisions Provided by Starter:**

**Language & Runtime:**
- TypeScript strict mode + Node.js 20+ LTS
- ESM 模块系统（`"type": "module"` in package.json）
- tsconfig.json: strict, ESNext target, NodeNext module resolution

**Build Tooling:**
- tsup: TypeScript → JavaScript 编译，零配置 ESM/CJS 双输出
- semantic-release: 自动化版本管理（从第一天建立规范的版本语义）
- npm provenance: 供应链安全从第一天启用

**Testing Framework:**
- Vitest: TypeScript 原生支持、与 tsup 生态一致、速度快、兼容 Jest API

**Code Quality:**
- ESLint: 静态分析
- Prettier: 代码格式化

**Development Experience:**
- Vitest watch mode 开发时即时反馈
- TypeScript 类型检查集成 IDE 实时提示
- tsup --watch 开发模式

**Note:** 项目初始化应作为第一个实现 Story，确保基础工程化配置到位。

## Core Architectural Decisions

### Decision Priority Analysis

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

### Data Architecture

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

### Error Handling & Logging

**D3. 错误处理模式：自定义 Error 类层级**

- **决策：** `CordError` 基类 → `ScanError` / `QueryError` / `ConfigError` / `StorageError` / `AdapterError` 等子类
- **理由：** 简单务实，与 Node.js 生态习惯一致；CLI 和 MCP 两个入口需要将错误转化为用户可理解的消息；自定义 Error 携带 `code` + `suggestion` 字段满足 NFR20
- **影响范围：** 全局，所有模块
- **实现要点：**
  - `CordError` 基类包含 `code: string`、`suggestion: string`、`context: Record<string, unknown>`
  - CLI 入口层：捕获 CordError，用 picocolors 格式化输出错误信息和修复建议
  - MCP 入口层：捕获 CordError，转换为 MCP 标准错误响应格式
  - 错误码命名规范：`CORD_SCAN_001`、`CORD_QUERY_001` 等

**D4. 日志策略：自研轻量 Logger**

- **决策：** 自研 debug/info/warn/error 四级 Logger，CLI 用 picocolors 着色输出，MCP 通过 stderr
- **理由：** CORD 是 CLI 工具，日志面向终端输出（用户可读），不需要结构化 JSON；picocolors 已在技术栈中
- **影响范围：** 全局，所有模块
- **实现要点：**
  - `src/utils/logger.ts` 提供统一 Logger
  - 四个级别：`debug`（默认隐藏）、`info`、`warn`、`error`
  - `CORD_DEBUG=1` 或 `--verbose` 启用 debug 级别输出
  - MCP Server 模式下日志输出到 stderr（避免污染 stdout 的 JSON-RPC 通信）

### Project Structure & Module Organization

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
│   │   └── init-graph.ts
│   └── server.ts           # MCP Server 入口
├── services/               # L2 Service 层（核心业务逻辑）
│   ├── init-service.ts
│   ├── scan-service.ts
│   ├── query-service.ts
│   ├── impact-service.ts
│   └── relation-service.ts
├── repositories/           # L1 Repository 层（数据访问）
│   ├── graph-repository.ts # IGraphRepository 实现
│   ├── migrations/         # SQL 迁移脚本
│   └── schema.ts           # 数据库 schema 定义
├── scanner/                # 扫描引擎（策略模式）
│   ├── pipeline.ts         # remark 处理管道
│   ├── rules/              # 规则引擎策略
│   └── types.ts
├── adapters/               # 框架适配层（可插拔）
│   ├── framework/          # IFrameworkAdapter 接口 + 基类
│   │   ├── interface.ts
│   │   ├── abstract-base.ts
│   │   └── bmad/           # BMAD 适配模块
│   └── ide/                # IDE 适配层
│       ├── interface.ts
│       ├── claude-code.ts
│       ├── cursor.ts
│       └── vscode-copilot.ts
├── schemas/                # Zod schema 定义
├── utils/                  # 公共工具
│   ├── logger.ts
│   ├── errors.ts           # CordError 类层级
│   └── config.ts           # 配置加载
└── types/                  # 全局类型定义
    ├── relations.ts        # 9 种关系类型
    ├── documents.ts
    └── graph.ts
```

### Configuration Management

**D6. 配置文件格式：YAML + JSON 双格式 + JSON Schema**

- **决策：** 同时支持 `cord.config.yaml`（推荐）和 `cord.config.json` 两种配置格式，加载优先级 YAML > JSON（同时存在时 YAML 优先）。提供 JSON Schema 供 IDE 验证和自动补全
- **理由：** CORD 用户群体（BMAD/Superpowers 用户）大量使用 YAML（frontmatter），YAML 为推荐格式；同时支持 JSON 格式以适配偏好 JSON 的开发者和自动化工具链。gray-matter 已在依赖中可复用 YAML 解析；JSON 使用 Node.js 内置 `JSON.parse` 零额外依赖
- **影响范围：** `cord init` 生成流程、配置加载模块
- **实现要点：**
  - `cord init` 默认生成 `cord.config.yaml` + `.cord/` 数据目录（可通过 `--format json` 生成 `cord.config.json`）
  - 配置加载策略：按 `cord.config.yaml` → `cord.config.json` 顺序检测，找到第一个即停止
  - JSON Schema 发布到 schemastore.org（后期），本地通过 YAML 文件头 `# yaml-language-server: $schema=...` 或 JSON `"$schema"` 字段引用
  - 配置项（7 项，对齐 PRD cord.config schema）：`framework`（框架类型）、`ide`（IDE 类型）、`scanPaths`（扫描路径）、`excludePaths`（排除路径）、`confidenceThreshold`（影响分析最低置信度阈值，默认 0.50）、`relationTypes`（自定义关系类型扩展）、`adapters`（启用的框架适配模块）；所有配置项均可选，`cord init` 自动生成合理默认值

### CI/CD & Quality Gates

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

### Decision Impact Analysis

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

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:** 5 大类 16 个冲突点，确保多个 AI Agent 写出兼容一致的代码。

### Naming Patterns

**P1. 数据库命名约定：**

| 维度 | 规则 | 示例 |
|------|------|------|
| 表名 | snake_case 复数 | `documents`、`relations`、`sync_states` |
| 列名 | snake_case | `doc_id`、`source_path`、`relation_type`、`created_at` |
| 外键 | `{referenced_table}_id` | `source_doc_id`、`target_doc_id` |
| 索引 | `idx_{table}_{columns}` | `idx_relations_source_doc_id`、`idx_documents_path` |
| 主键 | `id`（每表统一） | `documents.id`、`relations.id` |

**P2. 代码命名约定：**

| 维度 | 规则 | 示例 |
|------|------|------|
| 文件名 | kebab-case | `scan-service.ts`、`graph-repository.ts`、`cord-error.ts` |
| 类名 | PascalCase | `ScanService`、`GraphRepository`、`CordError` |
| 函数/方法 | camelCase | `analyzeImpact()`、`queryRelations()`、`getDocumentById()` |
| 变量 | camelCase | `docPath`、`relationType`、`scanResult` |
| 常量 | SCREAMING_SNAKE_CASE | `RELATION_TYPES`、`MAX_TRAVERSAL_DEPTH`、`DEFAULT_CONFIDENCE` |
| 接口 | `I` 前缀 + PascalCase | `IGraphRepository`、`IFrameworkAdapter`、`IScanRule` |
| 类型 | PascalCase（无前缀） | `RelationType`、`DocumentNode`、`ScanResult` |
| Enum 值 | snake_case | `RelationType.sync_required`、`RelationType.context_for` |
| Zod Schema | camelCase + `Schema` 后缀 | `documentSchema`、`relationSchema`、`configSchema` |

**P3. CLI 命令命名约定：**

| 维度 | 规则 | 示例 |
|------|------|------|
| 命令名 | kebab-case 单词 | `cord init`、`cord scan`、`cord query`、`cord impact` |
| 选项长名 | `--kebab-case` | `--output-format`、`--relation-type`、`--max-depth` |
| 选项短名 | 单字母 `-x` | `-f`（format）、`-t`（type）、`-d`（depth） |

**P4. MCP Tool 命名约定：**

| 维度 | 规则 | 示例 |
|------|------|------|
| Tool 名 | snake_case（意图驱动） | `analyze_impact`、`query_relations`、`sync_docs`、`init_graph` |
| 参数名 | camelCase | `docPath`、`relationType`、`maxDepth` |

### Structure Patterns

**P5. 测试文件组织：独立 `tests/` 目录**

测试文件统一存放在项目根目录的 `tests/` 下，镜像 `src/` 目录结构：

```
tests/
├── unit/
│   ├── services/
│   │   ├── scan-service.test.ts
│   │   ├── query-service.test.ts
│   │   └── impact-service.test.ts
│   ├── repositories/
│   │   └── graph-repository.test.ts
│   ├── scanner/
│   │   ├── pipeline.test.ts
│   │   └── rules/
│   ├── adapters/
│   │   └── framework/
│   │       └── bmad/
│   └── utils/
│       ├── errors.test.ts
│       └── logger.test.ts
├── integration/
│   ├── cli/
│   │   └── init-command.test.ts
│   ├── mcp/
│   │   └── tools.test.ts
│   └── scan-to-query-flow.test.ts
└── fixtures/
    ├── sample-project/       # 模拟项目目录结构
    ├── documents/            # 测试用 Markdown 文档
    └── configs/              # 测试用配置文件
```

- 单元测试：`tests/unit/` 镜像 `src/` 结构
- 集成测试：`tests/integration/` 按场景组织
- 测试数据：`tests/fixtures/` 统一存放
- 测试文件命名：`{source}.test.ts`

**P6. 模块导出模式：**

每个架构层有一个 `index.ts` 作为公共 API 门面：

```typescript
// src/services/index.ts — Service 层公共 API
export { ScanService } from './scan-service.js';
export { QueryService } from './query-service.js';
export { ImpactService } from './impact-service.js';
```

跨层引用**必须通过 index.ts**，禁止直接引用内部文件。

**P7. 依赖注入模式：**

Service 层通过构造函数注入 Repository：

```typescript
// ✅ 正确：构造函数注入
class ScanService {
  constructor(private readonly repo: IGraphRepository) {}
}

// ❌ 错误：直接 import 具体实现
import { SqliteGraphRepository } from '../repositories/graph-repository.js';
```

### Format Patterns

**P8. 内部数据传递格式：**

| 维度 | 规则 | 说明 |
|------|------|------|
| Service 返回值 | camelCase TypeScript 接口 | `{ docId, sourcePath, relationType }` |
| DB ↔ Repository | snake_case（与 DB 列名一致） | `{ doc_id, source_path, relation_type }` |
| 转换边界 | Repository 层负责 snake ↔ camelCase | 映射逻辑集中在 Repository 层 |

**P9. 关系类型值格式：**

```typescript
export const RELATION_TYPES = {
  SYNC_REQUIRED: 'sync_required',
  CONTEXT_FOR: 'context_for',
  LIFECYCLE_BOUND: 'lifecycle_bound',
  CONTAINS: 'contains',
  MUST_CONSISTENT: 'must_consistent',
  SYNC_SUGGESTED: 'sync_suggested',
  DERIVED_FROM: 'derived_from',
  DEPRECATED: 'deprecated',
  REFERENCES: 'references',
} as const;
```

**P10. JSON 快照导出格式：**

```json
{
  "version": "1.0",
  "exportedAt": "2026-04-07T10:00:00Z",
  "project": "cord-project-name",
  "documents": [],
  "relations": []
}
```

- 所有日期时间：ISO 8601 字符串
- JSON 字段：camelCase
- null 值：保留（不省略键）

### Communication & Process Patterns

**P11. Service 方法签名规范：**

```typescript
// ✅ 正确：输入用 Zod schema 类型，输出用明确的返回类型
async scanDocuments(input: ScanInput): Promise<ScanResult>

// ❌ 错误：散装参数
async scanDocuments(path: string, incremental: boolean, framework?: string): Promise<any>
```

所有 Service 方法：
- 输入：单一对象参数，类型由 Zod schema 推导
- 输出：明确的 TypeScript 类型（`Promise<T>` 或同步 `T`）
- 不抛非 `CordError` 的异常

**P12. 错误处理流程：**

```
Service 层 → throw CordError 子类（携带 code + suggestion）
    ↓
CLI 入口 → catch → picocolors 格式化输出 → process.exit(1)
MCP 入口 → catch → 转换为 MCP 标准错误响应
```

**绝不：**
- Service 层直接 `console.log` 或 `process.exit`
- MCP 层直接输出到 stdout（stdout 是 JSON-RPC 通道）
- 吞掉异常不处理

**P13. 异步 vs 同步模式：**

| 层 | 模式 | 理由 |
|---|------|------|
| Repository 层 | **同步** | better-sqlite3 是同步 API |
| Service 层 | **同步为主**（文件 I/O 用 async） | 数据库操作同步，文件读写可能需要 async |
| Scanner 引擎 | **async** | unified/remark 处理管道是异步的 |
| CLI 入口 | **async** | Commander action 支持 async，可调用任何 Service |
| MCP 入口 | **async** | MCP SDK handler 是 async |

### Quality Patterns

**P14. 导入排序：**

```typescript
// 1. Node.js 内置模块
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// 2. 第三方依赖
import { z } from 'zod';
import { Command } from 'commander';

// 3. 内部模块（按层级从外到内）
import { ScanService } from '../services/index.js';
import { CordError } from '../utils/errors.js';

// 4. 同级模块
import { formatOutput } from './helpers.js';
```

**P15. 注释规范：**

```typescript
// ✅ 公共 API 必须有 JSDoc
/**
 * 分析文档变更的影响范围
 * @param input - 影响分析输入参数
 * @returns 受影响文档列表及建议动作
 * @throws {QueryError} 当文档不存在时
 */
async analyzeImpact(input: ImpactInput): Promise<ImpactResult> { ... }

// ✅ 复杂逻辑用行内注释解释 WHY，不解释 WHAT
// 使用 BFS 而非 DFS，因为影响分析需要按距离排序结果
const affected = this.bfsTraverse(docId, maxDepth);

// ❌ 错误：解释显而易见的代码
// 获取文档 ID
const docId = input.docId;
```

**P16. 测试命名规范：**

```typescript
describe('ScanService', () => {
  describe('scanDocuments', () => {
    it('should discover frontmatter references as relations', () => { ... });
    it('should skip unparseable documents and log warning', () => { ... });
    it('should throw ScanError when project root is invalid', () => { ... });
  });
});
```

- describe: 类名 → 方法名
- it: `should + 行为描述`
- 测试文件名：`{source}.test.ts`

### Enforcement Guidelines

**所有 AI Agent 必须遵守：**

1. **跨层引用必须通过 index.ts 门面**，禁止直接 import 内部文件
2. **Service 层禁止直接引用具体 Repository 实现**，只依赖 `IGraphRepository` 接口
3. **CLI/MCP 入口层是薄壳**，只负责参数解析 → 调用 Service → 格式化输出，不含业务逻辑
4. **所有用户输入必须经过 Zod schema 验证**，在进入 Service 层之前
5. **所有错误必须是 CordError 子类**，携带 `code` 和 `suggestion`
6. **MCP Server 的 stdout 只用于 JSON-RPC**，所有日志/调试信息走 stderr
7. **数据库列名用 snake_case，TypeScript 代码用 camelCase**，Repository 层负责转换
8. **新增功能必须附带测试**，覆盖正常路径 + 至少一个异常路径

**Anti-Patterns（禁止事项）：**

```typescript
// ❌ Service 层直接操作终端
console.log('Scanning...');  // 禁止
process.exit(1);             // 禁止

// ❌ 跨层直接引用内部文件
import { scanDocumentsImpl } from '../services/scan-service.js';  // 禁止，应通过 index.ts

// ❌ Repository 返回 camelCase 或 Service 返回 snake_case
return { source_path: '...' };  // Repository 层：✅ 正确
return { source_path: '...' };  // Service 层：❌ 错误，应已转换为 sourcePath

// ❌ 散装参数代替输入对象
async queryRelations(docPath: string, type?: string, depth?: number)  // 禁止

// ❌ 吞掉异常
try { ... } catch (e) { /* 静默忽略 */ }  // 禁止
```

## Project Structure & Boundaries

### Requirements to Structure Mapping

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

### Complete Project Directory Structure

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
│   │   │   └── init-graph.ts         # init_graph — FR28
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
│       ├── relations.ts              # 9 种关系类型 + RelationType 枚举
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
├── .eslintrc.cjs
├── .prettierrc
├── .gitignore
├── .npmignore
├── LICENSE                               # MIT
├── README.md
└── CHANGELOG.md                          # semantic-release 自动生成
```

### Architectural Boundaries

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

### Data Flow

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
CLI: picocolors 格式化终端输出  /  MCP: JSON-RPC 响应
```

### Cross-Cutting Concerns Mapping

| 关注点 | 涉及模块 | 实现位置 |
|--------|---------|---------|
| **Zod 验证** | CLI commands、MCP tools | `src/schemas/` → 入口层调用 |
| **错误处理** | 所有模块 | `src/utils/errors.ts` 定义，入口层捕获转换 |
| **日志** | 所有模块 | `src/utils/logger.ts` 统一 Logger |
| **配置加载** | InitService、所有需要读配置的模块 | `src/utils/config-loader.ts` |
| **snake↔camelCase** | Repository 层 | `src/repositories/mappers.ts` |
| **框架检测** | InitService、ScanService | `src/adapters/framework/` 适配器 |
| **IDE 检测** | InitService | `src/adapters/ide/detector.ts` |

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**

所有技术选型无冲突，版本兼容性已由 11 项独立技术研究验证：
- TypeScript + better-sqlite3：同步 API 与 Repository 层设计一致
- Commander.js v14 + ESM：完全支持
- remark/unified + TypeScript：unified 生态全面支持 TS
- MCP SDK v1.x + Stdio + Zod：Tool inputSchema 与 Zod-to-JSON-Schema 转换兼容
- tsup + Vitest + ESM：同一生态，零冲突
- Zod + gray-matter：YAML 解析 → Zod 验证管道顺畅
- semantic-release + npm provenance：GitHub Actions 工作流原生集成

**Pattern Consistency:**

- 命名约定跨层一致：DB snake_case → Repository 转换 → Service/入口 camelCase
- 错误处理流程完整：CordError 基类 → 子类 → 入口层捕获转换，双入口都覆盖
- 导入模式统一：跨层通过 index.ts 门面，禁止直接引用
- 依赖注入一致：Service 构造函数注入 Repository 接口
- 异步模式对齐：better-sqlite3 同步 → Repository 同步 → Service 按需 → 入口 async

**Structure Alignment:**

- 目录结构与架构层一一对应
- 测试结构（独立 `tests/`）镜像源码结构
- 适配器通过接口解耦，独立于核心模块

### Requirements Coverage Validation ✅

**Functional Requirements Coverage: 42/42 ✅**

| FR 域 | 需求数 | 架构支撑 | 状态 |
|-------|--------|---------|------|
| 初始化与配置（FR1-5） | 5 | InitService + IDE/Framework Adapters + StatusService | ✅ |
| 文档扫描与关系发现（FR6-12） | 7 | ScanService + Scanner Pipeline + Lifecycle Detector + Rules + Framework Adapter | ✅ |
| 关系查询与影响分析（FR13-17） | 5 | QueryService + ImpactService + IGraphRepository 图遍历 | ✅ |
| 关系管理与修正（FR18-23） | 6 | RelationService + MCP sync_docs Tool + 收敛保护机制 | ✅ |
| 数据存储与导出（FR24-27） | 4 | SqliteGraphRepository + ExportService + 迁移机制 | ✅ |
| AI IDE 集成（FR28-32） | 5 | MCP Server + IDE Adapters + Skills 生成 + 指令文件生成 | ✅ |
| 框架适配（FR33-37） | 5 | IFrameworkAdapter + AbstractBase + BMAD + Generic | ✅ |
| 文档管辖与配置（FR38-42） | 5 | Config Loader + 预设/自定义配置 + 贡献者文档 | ✅ |

**Non-Functional Requirements Coverage: 19/19 ✅**

| NFR 类别 | 需求数 | 架构支撑 | 状态 |
|----------|--------|---------|------|
| 性能（NFR1-6） | 6 | SQLite 内存访问 + 索引 + 懒加载 + 增量处理 | ✅ |
| 可扩展性（NFR7-10） | 4 | Repository Pattern + Adapter Pattern + 版本策略 | ✅ |
| 集成（NFR11-14） | 4 | 共享 Service 层 + IDE Adapter + JSON 版本控制 | ✅ |
| 可靠性（NFR15-19） | 5 | SQLite 事务 + 错误隔离 + CordError + SIGTERM handler + --rebuild | ✅ |

### Implementation Readiness Validation ✅

| 检查项 | 状态 |
|--------|------|
| 所有关键决策已记录且含版本号（D1-D8 + 11项TR） | ✅ |
| 实现模式有具体代码示例（P1-P16） | ✅ |
| 一致性规则可执行（8条强制规则 + Anti-Patterns） | ✅ |
| 项目结构具体到文件级（含注释说明职责和对应FR） | ✅ |
| 架构边界图清晰（层间通信 + 数据流 + 依赖方向） | ✅ |
| 测试策略明确（独立 tests/ + 分级覆盖率 + 命名规范） | ✅ |

### Gap Analysis Results

**Critical Gaps: 无** ✅

**Important Gaps（建议但不阻塞）:**

| # | 差距 | 影响 | 处理建议 |
|---|------|------|---------|
| G1 | SQLite 初始 Schema DDL 具体建表语句 | 开发首个 Story 时需要 | 在 Epic/Story 阶段细化，由 `001-initial-schema.sql` 定义 |
| G2 | MCP Tool 具体 inputSchema/outputSchema 定义 | MCP 层实现时需要 | Zod schema 定义后自动导出 JSON Schema |
| G3 | cord.config.yaml 完整配置项清单 | `cord init` 实现时需要 | 在 Epic/Story 阶段细化 |

**Nice-to-Have Gaps:**

| # | 差距 | 处理建议 |
|---|------|---------|
| G4 | 开发环境设置指南 | 随 README 一起编写 |
| G5 | Git 工作流约定（分支策略、commit 规范） | 项目初始化 Story 中定义 |

**PRD 开放问题参考（不阻塞当前架构）：**

| PRD OQ | 主题 | 决策时间 | 架构影响 |
|--------|------|---------|---------|
| OQ2 | 数据收集机制（opt-in 遥测 / GitHub Discussion / npm 统计） | v0.1 发布前 | 若选 opt-in 遥测，需新增 Telemetry 模块 |
| OQ3 | 社区治理模型（核心贡献者招募策略） | v0.5 规划期 | 无直接架构影响 |
| OQ4 | 团队共享图谱技术路径（Git 同步 SQLite / 多用户并发） | v0.5 发布后 | 可能需要存储层和传输层架构扩展 |
| OQ5 | 企业级合规（SOC2 / GDPR） | v1.0 规划期 | 可能需要数据加密和审计日志模块 |

### Architecture Completeness Checklist

**✅ Requirements Analysis**

- [x] 项目上下文深度分析（8 个功能域、42 项 FR、19 项 NFR）
- [x] 规模与复杂度评估（Medium-High，~15-20 核心模块）
- [x] 技术约束识别（11 项 TR 全部锁定）
- [x] 跨切面关注点映射（7 项）

**✅ Architectural Decisions**

- [x] 关键决策含版本号记录（D1-D8）
- [x] 技术栈完全锁定（11 项 TR + Starter 评估）
- [x] 集成模式定义（双入口共享 Service 层）
- [x] 性能约束寻址（懒加载 / 索引 / 增量处理）

**✅ Implementation Patterns**

- [x] 命名约定建立（P1-P4：DB / 代码 / CLI / MCP）
- [x] 结构模式定义（P5-P7：测试组织 / 模块导出 / 依赖注入）
- [x] 数据格式模式（P8-P10：内部传递 / 关系类型值 / JSON 快照）
- [x] 通信/流程模式（P11-P13：方法签名 / 错误流程 / 异步模式）
- [x] 质量模式（P14-P16：导入排序 / 注释规范 / 测试命名）
- [x] 强制执行规则（8 条 + Anti-Patterns）

**✅ Project Structure**

- [x] 完整目录树定义（具体到文件级）
- [x] 架构边界建立（层间通信图 + 6 条边界规则）
- [x] 需求到结构映射（42 项 FR → 具体模块/文件）
- [x] 数据流图示（变更触发 → 查询 → 响应全链路）

### Architecture Readiness Assessment

**Overall Status:** 🟢 **READY FOR IMPLEMENTATION**

**Confidence Level:** **High** — 11 项 TR 已验证技术可行性，架构决策全面且无冲突

**Key Strengths:**

- 技术栈经过 11 项独立技术研究验证，不存在"架构拍脑袋"
- 双入口共享 Service 层的设计保证 CLI/MCP 行为 100% 一致
- 适配器模式保证框架/IDE 可插拔扩展
- 16 条实现模式 + 8 条强制规则为 AI Agent 实现提供明确约束

**Areas for Future Enhancement:**

- G1-G3 在 Epic/Story 阶段自然细化
- v0.5 增加 RESTful API 层时需扩展架构（新增入口层，Service 层不变）
- v0.5 增加 Embedding 增强时需扩展 Scanner 引擎（新增策略，管道不变）

### Implementation Handoff

**AI Agent Guidelines:**

- 严格遵循所有架构决策（D1-D8）和实现模式（P1-P16）
- 项目结构和边界规则是不可协商的约束
- 有疑问时参考本文档，而非自行推断
- 新增代码必须附带测试，遵循覆盖率分级要求

**First Implementation Priority:**

项目初始化 Story — 搭建骨架目录结构、配置 TypeScript/tsup/Vitest/ESLint/Prettier、创建 `001-initial-schema.sql`、建立 CI/CD 基础工作流

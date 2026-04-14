# Epic 1：工程就绪——开发者可开始编写功能代码

开发团队拥有完整可用的工程骨架——TypeScript 项目结构、构建管道、测试框架、CI/CD、错误处理基础、日志系统均就绪，可以开始实际功能开发。

## Story 1.1：项目初始化与目录结构搭建

As a 开发者，
I want 一个完整配置好的 TypeScript/Node.js 项目骨架（含 tsup 构建、Vitest 测试、ESLint、Prettier），
So that 我可以立即开始编写符合架构规范的功能代码。

**Acceptance Criteria:**

**Given** 一个空的项目目录
**When** 执行项目初始化脚本
**Then** 生成完整的 D5 目录结构（src/ 下 cli/、mcp/、services/、repositories/、scanner/、adapters/、schemas/、utils/、types/ 全部就位）
**And** package.json 配置 `"type": "module"` + 所有核心依赖（commander、@clack/prompts、chalk、better-sqlite3、@modelcontextprotocol/sdk、unified/remark 生态、zod）
**And** tsconfig.json 启用 strict 模式、ESNext target、NodeNext module resolution
**And** tsup.config.ts 配置 ESM 输出
**And** vitest.config.ts 配置就绪，`npm test` 可运行（含一个占位测试通过）
**And** eslint.config.js + .prettierrc 配置就绪，`npm run lint` 可运行
**And** 每个架构层的 index.ts 门面文件创建完毕（空导出）
**And** tests/ 目录镜像 src/ 结构（unit/、integration/、fixtures/）

## Story 1.2：CordError 错误处理体系与 Logger 日志系统

As a 开发者，
I want 统一的错误处理类层级和四级日志系统，
So that 所有模块可以使用一致的错误报告和日志输出模式。

**Acceptance Criteria:**

**Given** Story 1.1 的项目骨架已就绪
**When** 引入 CordError 错误体系
**Then** `src/utils/errors.ts` 提供 CordError 基类（含 `code: string`、`suggestion: string`、`context: Record<string, unknown>`）
**And** 提供至少 5 个子类：ScanError、QueryError、ConfigError、StorageError、AdapterError
**And** 错误码遵循 `CORD_{MODULE}_{NNN}` 命名规范

**Given** Story 1.1 的项目骨架已就绪
**When** 引入 Logger 日志系统
**Then** `src/utils/logger.ts` 提供 debug/info/warn/error 四个级别
**And** 默认隐藏 debug 级别，`CORD_DEBUG=1` 或 `--verbose` 启用
**And** CLI 模式使用 chalk 着色输出到 stdout/stderr
**And** MCP Server 模式所有日志输出到 stderr（不污染 stdout JSON-RPC 通道）
**And** 单元测试覆盖所有错误子类和所有日志级别（≥ 90% 覆盖率）

## Story 1.3：Zod 统一验证层与核心类型定义

As a 开发者，
I want 统一的 Zod schema 验证层和全局类型定义，
So that CLI/MCP/Service 层可以共享同一套输入验证和类型系统。

**Acceptance Criteria:**

**Given** Story 1.2 的错误体系已就绪
**When** 定义 Zod schema 和类型系统
**Then** `src/types/relations.ts` 定义 9 种关系类型常量（RELATION_TYPES as const）和 RelationType 类型（字符串联合，非 enum）
**And** `src/types/documents.ts` 定义 DocumentNode 类型
**And** `src/types/graph.ts` 定义图遍历相关类型
**And** `src/types/config.ts` 定义配置相关类型
**And** `src/schemas/` 目录下提供 document、relation、config、scan-input、query-input、impact-input 的 Zod schema
**And** Zod 验证失败时抛出 CordError 子类（ConfigError 或对应子类）
**And** 所有 Zod schema 可通过 `zod-to-json-schema` 导出为 JSON Schema（为 MCP Tools 预备）
**And** 单元测试覆盖每个 schema 的有效/无效输入路径

## Story 1.4：SQLite 存储层与数据迁移机制

As a 开发者，
I want IGraphRepository 接口、SQLite 实现和自动数据迁移机制，
So that Service 层可以通过抽象接口进行图谱数据的 CRUD 操作。

**Acceptance Criteria:**

**Given** Story 1.3 的类型系统已就绪
**When** 实现存储层
**Then** `src/repositories/interfaces.ts` 定义 IGraphRepository 接口（含文档节点和关系边的 CRUD 方法签名）
**And** `src/repositories/sqlite-graph-repository.ts` 实现 IGraphRepository，使用 better-sqlite3 同步 API
**And** `src/repositories/mappers.ts` 实现 snake_case ↔ camelCase 双向转换
**And** `src/repositories/migrations/001-initial-schema.sql` 创建 documents、relations、sync_states 三张核心表（遵循 P1 数据库命名约定）
**And** `src/repositories/migrations/runner.ts` 实现迁移执行器——应用启动时查询 `schema_migrations` 历史表已执行版本，按序执行未执行的迁移脚本
**And** 迁移在事务中执行，失败可回滚，数据库一致性保证（NFR15）
**And** SQLite 启用 WAL 模式
**And** 单元测试覆盖率 ≥ 85%：CRUD 正常路径 + 迁移执行 + 事务回滚 + mapper 转换

## Story 1.5：CI/CD 管道与质量门禁

As a 开发者，
I want GitHub Actions CI/CD 管道和质量门禁，
So that 每个 PR 都经过自动化的 lint、类型检查、测试和覆盖率验证。

**Acceptance Criteria:**

**Given** Story 1.1-1.4 的代码基础已就绪
**When** 配置 CI/CD
**Then** `.github/workflows/ci.yml` 配置 PR 检查管道：lint → type-check → test → coverage
**And** `.github/workflows/release.yml` 配置完整可执行的 `semantic-release` 发布流程（全权负责 npm publish + GitHub Release，通过 `NPM_CONFIG_PROVENANCE: true` 启用 provenance）
**And** `.github/workflows/cross-platform.yml` 配置跨平台矩阵（ubuntu / macos / windows）验证 better-sqlite3 native addon
**And** 覆盖率门禁配置：整体 ≥ 80%（D8）
**And** `.github/ISSUE_TEMPLATE/` 和 `PULL_REQUEST_TEMPLATE.md` 创建完毕
**And** npm provenance 配置就绪
**And** 本地执行 `npm run lint && npm run type-check && npm test -- --coverage` 全部通过，覆盖率不低于 80%

---

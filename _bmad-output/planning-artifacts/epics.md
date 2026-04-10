---
stepsCompleted:
  - 'step-01-validate-prerequisites'
  - 'step-02-design-epics'
  - 'step-03-create-stories'
  - 'step-04-final-validation'
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/architecture/index.md'
---

# CORD - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for CORD, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

**项目初始化与配置**
- FR1：用户可以通过单个命令（`cord init`）完成项目的完整初始化配置
- FR2：系统可以自动检测当前项目使用的 AI IDE 类型（Claude Code / Cursor / VS Code Copilot / Codex CLI）
- FR3：系统可以自动检测当前项目使用的开发框架（BMAD-Method / Superpowers / 无框架）。注：检测能力与适配能力解耦——v0.1 可检测 Superpowers 框架存在，但适配模块计划于 v0.5 交付
- FR4：系统可以根据检测到的 IDE 类型自动生成对应的配置文件（MCP 配置、指令文件、Hooks 脚本）
- FR5：用户可以查看当前项目的 CORD 配置状态和健康信息（`cord status`）

**文档扫描与关系发现**
- FR6：用户可以对项目中的所有文档执行冷启动扫描，自动发现并建立文档间的关系图谱
- FR7：系统可以对已有图谱执行增量扫描，仅处理变更的文档
- FR8：增量扫描时，系统可以检测文档的重命名、移动和删除事件（通过对比文件系统快照与图谱记录的路径），并自动更新或清理图谱中的孤立节点和失效关系边
- FR9：系统可以通过规则引擎识别文档间的关系（frontmatter 引用、Markdown 链接、目录结构推断）
- FR10：系统可以将发现的关系按 9 种传播行为类型进行分类（sync_required / context_for / lifecycle_bound / contains / must_consistent / sync_suggested / derived_from / deprecated / references）
- FR11：系统可以为每条发现的关系标记置信度分数（范围 0.0-1.0）：frontmatter 显式声明 ≥ 0.95、Markdown 链接精确匹配 ≥ 0.85、目录结构推断 0.50-0.70、框架预设规则 ≥ 0.90。影响分析默认过滤阈值 ≥ 0.50
- FR12：系统可以建立文档级关系索引（文档 A 关联文档 B）作为 v0.1 核心粒度；章节/段落级粒度作为 v0.5+ 扩展能力

**关系查询与影响分析**
- FR13：用户可以查询指定文档的所有关联关系（一跳关系列表）
- FR14：用户可以按关系类型过滤查询结果
- FR15：用户可以对指定文档执行变更影响分析，获取受影响文档列表及建议动作
- FR16：系统可以支持多跳关系遍历（一跳、二跳、三跳查询）
- FR17：系统可以在影响分析结果中明确标注每条受影响关系的传播行为类型和建议动作

**关系管理与修正**
- FR18：用户可以手动添加文档间的关系（指定源文档、目标文档、关系类型）
- FR19：用户可以移除或标记已有关系为 deprecated
- FR20：系统可以通过 MCP Tools 暴露关系管理能力，AI Agent 负责从用户自然语言对话中解析意图后调用对应 Tool
- FR21：系统可以记录关系的来源（自动扫描 / 手动添加 / 框架预设）和修改历史
- FR22：增量扫描时，系统可以识别并保护用户手动修正过的关系（手动修正 > 框架预设 > 自动扫描发现）
- FR23：用户可以按文档类别配置不同的更新策略（自动更新 / 生成建议后人工确认 / 仅记录不触发）

**数据存储与导出**
- FR24：系统可以使用嵌入式数据库存储文档节点和关系边的完整图谱数据
- FR25：系统可以维护文档同步状态表，追踪每份文档的最后扫描时间和变更状态
- FR26：用户可以将完整关系图谱导出为 JSON 快照文件（供 git 审阅）
- FR27：系统可以在本地完成所有数据存储和处理，不依赖任何外部云服务

**AI IDE 集成**
- FR28：AI Agent 可以通过 MCP Server 以 Tools 方式调用 CORD 的核心能力
- FR29：系统可以通过 Hooks 机制在文档变更落盘时自动触发关系检查
- FR30：系统可以生成 IDE 特定的全局指令片段，引导 AI Agent 在适当场景调用 CORD
- FR31：系统可以生成符合 AI IDE Skills 规范的定义文件，覆盖 4 个核心意图场景
- FR32：MCP Server 可以作为长驻进程运行，响应 AI Agent 的并发查询请求

**框架适配**
- FR33：系统可以通过适配器接口（IFrameworkAdapter）支持不同开发框架的文档类型识别
- FR34：BMAD 适配模块可以识别 18 种 BMAD 文档类型并应用预设关系规则
- FR35：框架适配模块可以通过声明式方式注册文档类型定义和预设关系规则
- FR36：系统可以在无特定框架适配时，退回通用规则引擎进行关系发现
- FR37：社区开发者可以基于公开的适配器接口和参考实现开发新的框架适配模块

**文档管辖范围**
- FR38：系统的管辖范围包括：框架产出文档、AI IDE/Agent 指令规范文档、用户自行产生的文档
- FR39：系统明确排除项目源码目录（src/）下的所有文件
- FR40：系统可以为已支持的框架和 IDE 提供预设的文档路径/目录/文件名配置
- FR41：用户可以通过 `cord.config` 自定义扩展文档路径、目录和文件名匹配规则
- FR42：系统可以提供框架适配贡献者文档

### NonFunctional Requirements

**性能**
- NFR1：一跳关系查询响应时间 p95 < 1ms（2000 文档 / 50000 关系规模，SQLite WAL 模式）
- NFR2：三跳关系遍历响应时间 p95 < 5ms（同 NFR1 数据规模）
- NFR3：CLI 冷启动时间 p95 < 200ms（已安装项目，Node.js 20+ LTS）
- NFR4：MCP Server 单次 Tool 调用响应时间 p95 < 50ms
- NFR5：冷启动扫描处理速度 ≥ 4 文档/秒（平均文档大小 ≤ 50KB）
- NFR6：增量扫描无变更时检查完成时间 p95 < 100ms

**可扩展性**
- NFR7：从 200 文档扩展到 2000 文档时，NFR1-NFR2 指标退化不超过 10%
- NFR8：新增框架适配模块时核心模块单元测试通过率保持 100%，无需修改核心模块源码
- NFR9：新增传播行为类型时已有关系数据无需迁移即可正常查询
- NFR10：新增 MCP Tool 时已有 4 个 Tool 的 JSON Schema 保持不变

**集成**
- NFR11：MCP Server 在 Claude Code ≥ 1.0 / Cursor ≥ 0.48 / VS Code Copilot ≥ 1.96 中端到端验证通过
- NFR12：全局指令文件生成采用独立文件注入策略，不修改用户已有 IDE 配置文件
- NFR13：CLI 与 MCP Server 对相同输入返回语义一致的输出结构
- NFR14：JSON 快照导出格式包含 schemaVersion 字段，v0.1 导出的快照在 v0.5+ 中可成功导入

**可靠性**
- NFR15：扫描过程中异常中断后数据库一致性校验通过率 100%
- NFR16：冷启动扫描遇到无法解析的文档时跳过并记录 WARNING，整体扫描正常完成
- NFR17：MCP Server 收到 SIGTERM 后 ≤ 2 秒内完成优雅退出
- NFR18：关系图谱可通过 `cord scan --rebuild` 从源文档完全重建
- NFR19：所有用户操作的错误信息遵循统一格式：`[错误码] 错误描述 → 建议操作`，≥ 95% 覆盖率

### Additional Requirements

**架构技术需求（影响 Epic/Story 设计）：**

- **Starter Template: Custom Setup（从零搭建）** — 架构文档明确指出不使用现成模板，项目初始化应作为第一个实现 Story，搭建完整工程骨架
- **基础设施层优先** — D5 目录结构 → D3 Error 类 + D4 Logger → D1 Zod Schema → D2 数据迁移 → D6 配置管理 → D7 CI/CD → D8 覆盖率（实现顺序约束）
- **双入口共享 Service 层** — CLI 和 MCP Server 双入口必须共享同一 Service 层，Service 层是架构核心锚点
- **Repository Pattern（IGraphRepository）** — 存储引擎可切换，Service 层只依赖接口
- **SQLite + better-sqlite3 同步 API** — 图模型思维建表，documents + relations + sync_states 三表核心 Schema
- **SQL 迁移机制（版本号 + 增量 SQL 脚本）** — `src/repositories/migrations/` 目录，应用启动时自动迁移
- **CordError 自定义错误类层级** — 基类 + 5+ 子类（ScanError / QueryError / ConfigError / StorageError / AdapterError），携带 code + suggestion
- **自研轻量 Logger（四级）** — debug/info/warn/error，MCP 模式日志走 stderr
- **Zod 统一验证层** — `src/schemas/` 目录，CLI/MCP/Service 共享同一套 schema
- **依赖注入模式** — Service 构造函数注入 Repository 接口
- **跨层引用必须通过 index.ts 门面** — 禁止直接引用内部文件
- **snake_case ↔ camelCase 转换** — Repository 层（mappers.ts）负责 DB 与 Service 之间的命名转换
- **测试策略** — 独立 `tests/` 目录，Service 层 + Scanner ≥ 90%，Repository ≥ 85%，CLI/MCP ≥ 70%，Adapters ≥ 80%
- **CI/CD: GitHub Actions** — PR 质量门禁 + semantic-release + npm provenance + 跨平台矩阵
- **三层分级 IDE 集成架构** — MCP 通用层 → 指令引导层 → 原生 Hooks 层
- **IFrameworkAdapter + AbstractFrameworkAdapter** — 可插拔框架适配，BMAD 适配作为参考实现
- **IIdeAdapter** — 可插拔 IDE 适配，Claude Code / Cursor / VS Code Copilot / Codex CLI
- **16 条实现模式（P1-P16）** — 命名约定、结构模式、格式模式、通信模式、质量模式
- **8 条强制执行规则** — 跨层引用/接口依赖/薄壳入口/Zod 验证/CordError/stderr 日志/命名转换/测试附带

### UX Design Requirements

无 UX 设计文档（本项目为 CLI + MCP Server 开发者工具，无 GUI）。

### FR Coverage Map

**项目初始化与配置**
- FR1 → Epic 5：`cord init` 一键初始化配置
- FR2 → Epic 5：自动检测 AI IDE 类型
- FR3 → Epic 5：自动检测开发框架
- FR4 → Epic 5：根据 IDE 类型生成配置文件
- FR5 → Epic 3：`cord status` 健康检查

**文档扫描与关系发现**
- FR6 → Epic 2：冷启动扫描建立关系图谱
- FR7 → Epic 2：增量扫描处理变更文档
- FR8 → Epic 2：增量扫描检测重命名/移动/删除
- FR9 → Epic 2：规则引擎识别文档关系
- FR10 → Epic 2：9 种传播行为类型分类
- FR11 → Epic 2：关系置信度评分（0.0-1.0）
- FR12 → Epic 2：文档级关系索引（v0.1 核心粒度）

**关系查询与影响分析**
- FR13 → Epic 3：查询文档关联关系（一跳）
- FR14 → Epic 3：按关系类型过滤查询结果
- FR15 → Epic 3：变更影响分析
- FR16 → Epic 3：多跳关系遍历
- FR17 → Epic 3：影响分析结果标注传播行为和建议动作

**关系管理与修正**
- FR18 → Epic 4：手动添加文档关系
- FR19 → Epic 4：移除/标记关系为 deprecated
- FR20 → Epic 5：MCP Tools 暴露关系管理能力
- FR21 → Epic 4：记录关系来源和修改历史
- FR22 → Epic 4：增量扫描保护手动修正（收敛机制）
- FR23 → Epic 4：按文档类别配置更新策略

**数据存储与导出**
- FR24 → Epic 2：嵌入式数据库存储图谱数据
- FR25 → Epic 2：文档同步状态表
- FR26 → Epic 3：JSON 快照导出
- FR27 → Epic 2：本地存储，零云依赖

**AI IDE 集成**
- FR28 → Epic 5：MCP Server + Tools 调用核心能力
- FR29 → Epic 5：Hooks 文档变更自动触发
- FR30 → Epic 5：IDE 全局指令片段生成
- FR31 → Epic 5：Skills 定义文件生成（4 个意图场景）
- FR32 → Epic 5：MCP Server 长驻进程

**框架适配**
- FR33 → Epic 2：IFrameworkAdapter 适配器接口
- FR34 → Epic 2：BMAD 适配模块（18 种文档类型）
- FR35 → Epic 2：声明式注册文档类型和预设规则
- FR36 → Epic 2：无框架时退回通用规则引擎
- FR37 → Epic 6：社区开发者可开发新适配模块

**文档管辖范围**
- FR38 → Epic 2：管辖范围定义
- FR39 → Epic 2：排除源码目录
- FR40 → Epic 2：预设文档路径配置
- FR41 → Epic 2：用户自定义配置扩展
- FR42 → Epic 6：贡献者文档

## Epic List

### Epic 1：工程就绪——开发者可开始编写功能代码
开发团队拥有完整可用的工程骨架——TypeScript 项目结构、构建管道、测试框架、CI/CD、错误处理基础、日志系统均就绪，可以开始实际功能开发。
**FRs 覆盖：** 无直接 FR（基础设施层，支撑所有后续 Epic）
**NFRs 覆盖：** NFR3, NFR7-NFR10, NFR15, NFR19
**架构决策：** D1-D8, P1-P16

### Epic 2：文档扫描与关系图谱构建
用户可以运行 `cord scan` 对项目文档执行冷启动扫描，自动发现文档间的关系并建立关系图谱（SQLite 存储）。支持增量扫描、文档生命周期检测（重命名/移动/删除）、置信度评分。BMAD 框架用户开箱即用（18 种文档类型 + 预设规则），无框架用户通过通用规则引擎获得基础体验。
**FRs 覆盖：** FR6, FR7, FR8, FR9, FR10, FR11, FR12, FR24, FR25, FR27, FR33, FR34, FR35, FR36, FR38, FR39, FR40, FR41
**NFRs 覆盖：** NFR1, NFR5, NFR6, NFR8, NFR9, NFR15, NFR16, NFR18

### Epic 3：关系查询、影响分析与数据导出
用户可以通过 `cord query` 查询任意文档的关联关系（支持类型过滤、多跳遍历），通过 `cord impact` 获取文档变更的影响分析（受影响文档列表 + 传播行为类型 + 建议动作），通过 `cord export` 导出 JSON 快照，通过 `cord status` 查看图谱健康状态。
**FRs 覆盖：** FR5, FR13, FR14, FR15, FR16, FR17, FR26
**NFRs 覆盖：** NFR1, NFR2, NFR7, NFR13, NFR14

### Epic 4：关系管理与图谱修正
用户可以手动添加、移除或标记关系为 deprecated。系统记录关系来源和修改历史，增量扫描时保护手动修正（收敛机制），支持按文档类别配置更新策略。图谱准确度随使用自然收敛。
**FRs 覆盖：** FR18, FR19, FR21, FR22, FR23
**NFRs 覆盖：** NFR9

### Epic 5：AI IDE 集成（MCP Server + Hooks + 指令注入）
用户运行 `cord init` 即可一键完成 IDE 检测、框架检测、MCP Server 配置、Hooks 脚本安装和指令文件注入。AI Agent 可通过 MCP Server 自动调用 CORD 能力（影响分析、关系查询、图谱初始化、同步建议、关系管理）。文档变更落盘时自动触发关系检查。
**FRs 覆盖：** FR1, FR2, FR3, FR4, FR20, FR28, FR29, FR30, FR31, FR32
**NFRs 覆盖：** NFR4, NFR10, NFR11, NFR12, NFR13, NFR17

### Epic 6：社区贡献体验与文档交付
社区开发者可以基于完整的 IFrameworkAdapter 接口文档、BMAD 参考实现、集成测试模板和 PR 规范，在 4 小时内完成最小可用的框架适配模块。最终用户通过 README、快速开始指南、CLI/MCP/配置参考等完整文档获得自助式上手体验。
**FRs 覆盖：** FR37, FR42
**NFRs 覆盖：** NFR8

---

## Epic 1：工程就绪——开发者可开始编写功能代码

开发团队拥有完整可用的工程骨架——TypeScript 项目结构、构建管道、测试框架、CI/CD、错误处理基础、日志系统均就绪，可以开始实际功能开发。

### Story 1.1：项目初始化与目录结构搭建

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

### Story 1.2：CordError 错误处理体系与 Logger 日志系统

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

### Story 1.3：Zod 统一验证层与核心类型定义

As a 开发者，
I want 统一的 Zod schema 验证层和全局类型定义，
So that CLI/MCP/Service 层可以共享同一套输入验证和类型系统。

**Acceptance Criteria:**

**Given** Story 1.2 的错误体系已就绪
**When** 定义 Zod schema 和类型系统
**Then** `src/types/relations.ts` 定义 9 种关系类型常量（RELATION_TYPES as const）和 RelationType 枚举
**And** `src/types/documents.ts` 定义 DocumentNode 类型
**And** `src/types/graph.ts` 定义图遍历相关类型
**And** `src/types/config.ts` 定义配置相关类型
**And** `src/schemas/` 目录下提供 document、relation、config、scan-input、query-input、impact-input 的 Zod schema
**And** Zod 验证失败时抛出 CordError 子类（ConfigError 或对应子类）
**And** 所有 Zod schema 可通过 `zod-to-json-schema` 导出为 JSON Schema（为 MCP Tools 预备）
**And** 单元测试覆盖每个 schema 的有效/无效输入路径

### Story 1.4：SQLite 存储层与数据迁移机制

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
**And** `src/repositories/migrations/runner.ts` 实现迁移执行器——应用启动时检测 schema_version 并按序执行待执行迁移
**And** 迁移在事务中执行，失败可回滚，数据库一致性保证（NFR15）
**And** SQLite 启用 WAL 模式
**And** 单元测试覆盖率 ≥ 85%：CRUD 正常路径 + 迁移执行 + 事务回滚 + mapper 转换

### Story 1.5：CI/CD 管道与质量门禁

As a 开发者，
I want GitHub Actions CI/CD 管道和质量门禁，
So that 每个 PR 都经过自动化的 lint、类型检查、测试和覆盖率验证。

**Acceptance Criteria:**

**Given** Story 1.1-1.4 的代码基础已就绪
**When** 配置 CI/CD
**Then** `.github/workflows/ci.yml` 配置 PR 检查管道：lint → type-check → test → coverage
**And** `.github/workflows/release.yml` 配置 semantic-release + npm publish（可暂为占位）
**And** `.github/workflows/cross-platform.yml` 配置跨平台矩阵（ubuntu / macos / windows）验证 better-sqlite3 native addon
**And** 覆盖率门禁配置：整体 ≥ 80%（D8）
**And** `.github/ISSUE_TEMPLATE/` 和 `PULL_REQUEST_TEMPLATE.md` 创建完毕
**And** npm provenance 配置就绪
**And** CI 管道在本地代码推送后可成功执行（至少 lint + test 通过）

---

## Epic 2：文档扫描与关系图谱构建

用户可以运行 `cord scan` 对项目文档执行冷启动扫描，自动发现文档间的关系并建立关系图谱（SQLite 存储）。支持增量扫描、文档生命周期检测（重命名/移动/删除）、置信度评分。BMAD 框架用户开箱即用（18 种文档类型 + 预设规则），无框架用户通过通用规则引擎获得基础体验。

### Story 2.1：框架适配器接口与通用规则退化

As a 开发者，
I want IFrameworkAdapter 接口、AbstractFrameworkAdapter 抽象基类和通用适配器实现，
So that 扫描引擎可以在无框架时通过通用规则引擎进行关系发现，并为后续框架适配模块提供扩展基础。

**Acceptance Criteria:**

**Given** Epic 1 的项目基础设施已就绪
**When** 实现框架适配层
**Then** `src/adapters/framework/interfaces.ts` 定义 IFrameworkAdapter 接口（含文档类型注册、预设关系规则、框架检测方法）
**And** `src/adapters/framework/abstract-base.ts` 实现 AbstractFrameworkAdapter 抽象基类，提取通用逻辑复用
**And** `src/adapters/framework/generic/adapter.ts` 实现 GenericFrameworkAdapter（无框架时的默认适配）
**And** GenericFrameworkAdapter 支持通过 cord.config 配置的 scanPaths 和 excludePaths 确定文档范围
**And** GenericFrameworkAdapter 明确排除 src/ 目录下的所有文件（FR39）
**And** 框架适配模块通过声明式方式注册文档类型定义和预设关系规则（FR35）
**And** 单元测试覆盖：接口契约验证 + 通用适配器文档发现 + 路径排除逻辑（≥ 80%）

### Story 2.2：扫描引擎核心管道（remark AST + 规则引擎）

As a 用户，
I want 一个基于 remark/unified 的文档解析管道和规则引擎，
So that 系统可以解析 Markdown 文档并通过规则识别文档间的关系。

**Acceptance Criteria:**

**Given** Story 2.1 的框架适配层已就绪
**When** 实现扫描引擎管道
**Then** `src/scanner/pipeline.ts` 实现 remark/unified 处理管道编排（解析 Markdown → AST → 提取关系）
**And** `src/scanner/plugins/extract-frontmatter.ts` 提取 frontmatter 中的引用信息
**And** `src/scanner/plugins/extract-links.ts` 提取 Markdown 链接（相对路径和绝对路径）
**And** `src/scanner/plugins/extract-headings.ts` 提取标题结构
**And** `src/scanner/rules/index.ts` 定义 IScanRule 接口和规则注册机制
**And** `src/scanner/rules/frontmatter-rule.ts` 实现 frontmatter 引用解析（置信度 ≥ 0.95）
**And** `src/scanner/rules/markdown-link-rule.ts` 实现 Markdown 链接提取（置信度 ≥ 0.85）
**And** `src/scanner/rules/directory-rule.ts` 实现目录结构推断（置信度 0.50-0.70）
**And** 每条规则发现的关系都按 9 种传播行为类型分类（FR10）
**And** 每条关系标记置信度分数（FR11，范围 0.0-1.0）
**And** 关系粒度为文档级（FR12，v0.1 核心粒度）
**And** 遇到无法解析的文档（编码错误/非 Markdown/超大文件 > 1MB）时跳过并记录 WARNING（NFR16）
**And** 单元测试覆盖率 ≥ 90%：三种规则各自的正常路径 + 异常文档跳过 + 置信度范围验证

### Story 2.3：BMAD 框架适配模块

As a BMAD-Method 用户，
I want CORD 开箱即用地识别 BMAD 文档类型并应用预设关系规则，
So that 我的 BMAD 项目文档关系可以被准确识别，无需手动配置。

**Acceptance Criteria:**

**Given** Story 2.1 的适配器接口和 Story 2.2 的扫描引擎已就绪
**When** 实现 BMAD 适配模块
**Then** `src/adapters/framework/bmad/adapter.ts` 实现 BmadFrameworkAdapter（extends AbstractFrameworkAdapter）
**And** `src/adapters/framework/bmad/doc-types.ts` 定义 18 种 BMAD 文档类型（PRD、Architecture、Epic、Story、Sprint、技术研究等）
**And** `src/adapters/framework/bmad/preset-rules.ts` 定义预设关系规则（例如：PRD ↔ Architecture 为 sync_required、Epic → Story 为 contains）
**And** `src/adapters/framework/bmad/detector.ts` 实现 5 层递进检测策略（检测项目是否使用 BMAD 框架）
**And** 框架预设规则的置信度 ≥ 0.90（FR11）
**And** 单元测试覆盖：18 种文档类型识别 + 预设规则匹配 + 框架检测逻辑（≥ 80%）

### Story 2.4：配置加载与文档管辖范围

As a 用户，
I want 通过 cord.config 配置文件控制文档扫描范围和行为，
So that 我可以自定义哪些文档被扫描、哪些路径被排除。

**Acceptance Criteria:**

**Given** Story 2.1-2.3 的扫描和适配能力已就绪
**When** 实现配置加载系统
**Then** `src/utils/config-loader.ts` 支持加载 `cord.config.yaml`（优先）和 `cord.config.json` 两种格式
**And** 配置通过 Zod schema 验证（与 Story 1.3 的 configSchema 集成）
**And** 支持 7 项配置：framework、ide、scanPaths、excludePaths、confidenceThreshold（默认 0.50）、relationTypes、adapters
**And** 所有配置项均为可选，未配置时使用合理默认值
**And** 系统管辖范围包括框架产出文档、AI IDE 指令规范文档、用户自行产生的文档（FR38）
**And** 明确排除 src/、node_modules/、.git/、dist/ 目录（FR39）
**And** 支持已支持框架和 IDE 的预设文档路径配置（FR40）
**And** 用户可通过 cord.config 自定义扩展或覆盖预设配置（FR41）
**And** 单元测试覆盖：YAML/JSON 加载 + Zod 验证通过/失败 + 默认值回退 + 路径排除

### Story 2.5：ScanService 冷启动扫描与图谱写入

As a 用户，
I want 运行 `cord scan` 对项目所有文档执行冷启动扫描，
So that 文档间的关系图谱从零建立，我可以看到文档之间有哪些关联。

**Acceptance Criteria:**

**Given** Story 2.2 的扫描引擎和 Story 2.4 的配置加载已就绪
**When** 执行冷启动扫描
**Then** `src/services/scan-service.ts` 编排完整扫描流程：加载配置 → 发现文档 → 调用 Scanner 管道 → 写入 Repository
**And** 扫描过程在事务中执行，异常中断不产生脏数据（NFR15）
**And** 扫描结果写入 documents 表（文档节点）和 relations 表（关系边），并更新 sync_states 表
**And** 每条关系记录来源为"自动扫描"（FR21）
**And** `src/cli/commands/scan.ts` 实现 `cord scan` CLI 命令（薄壳——参数解析 → 调用 ScanService → 格式化输出）
**And** CLI 输出人类可读格式：发现关系数 + 耗时 + 警告
**And** 支持 `--json` 全局 flag 输出 JSON 格式
**And** 退出码：0 = 成功、1 = 运行时错误、2 = 参数/配置错误
**And** 冷启动扫描处理速度 ≥ 4 文档/秒（NFR5，平均文档 ≤ 50KB）
**And** 支持 `cord scan --rebuild` 完全重建图谱，重建结果与全量扫描一致（NFR18）
**And** 集成测试：使用 fixtures/sample-projects/ 中的 BMAD 项目和通用项目验证端到端扫描流程

### Story 2.6：增量扫描与文档生命周期检测

As a 用户，
I want 增量扫描只处理变更的文档，并自动检测重命名/移动/删除的文档，
So that 日常使用中扫描速度极快，且图谱自动保持与文件系统同步。

**Acceptance Criteria:**

**Given** Story 2.5 的冷启动扫描已就绪
**When** 执行增量扫描
**Then** `src/scanner/lifecycle-detector.ts` 实现文档生命周期检测——对比文件系统快照与图谱记录的路径
**And** 检测到文档重命名时，更新图谱中的文档路径和相关关系边
**And** 检测到文档移动时，更新文档路径
**And** 检测到文档删除时，清理孤立节点和失效关系边（FR8）
**And** 增量扫描仅处理 mtime 变更的文档（FR7）
**And** `cord scan` 自动判断是冷启动（无图谱）还是增量扫描（有图谱）
**And** 增量扫描无变更时检查完成时间 p95 < 100ms（NFR6）
**And** 单元测试 + 集成测试：增量扫描正常路径 + 文档重命名/移动/删除检测 + 无变更快速返回

---

## Epic 3：关系查询、影响分析与数据导出

用户可以通过 `cord query` 查询任意文档的关联关系（支持类型过滤、多跳遍历），通过 `cord impact` 获取文档变更的影响分析（受影响文档列表 + 传播行为类型 + 建议动作），通过 `cord export` 导出 JSON 快照，通过 `cord status` 查看图谱健康状态。

### Story 3.1：QueryService 关系查询（一跳 + 类型过滤）

As a 用户，
I want 通过 `cord query <doc>` 查询指定文档的所有关联关系，
So that 我可以了解某份文档与哪些其他文档有关联、关系类型是什么。

**Acceptance Criteria:**

**Given** 已有通过 `cord scan` 建立的关系图谱
**When** 执行 `cord query <doc>`
**Then** `src/services/query-service.ts` 实现一跳关系查询（FR13），返回所有直接关联的文档列表
**And** 每条结果包含：目标文档路径、关系类型、置信度分数、关系来源
**And** 支持 `--type <relation_type>` 按关系类型过滤结果（FR14）
**And** `src/cli/commands/query.ts` 实现 `cord query` CLI 命令（薄壳）
**And** CLI 默认输出人类可读表格格式
**And** 支持 `--json` 输出机器可读 JSON
**And** 一跳关系查询响应时间 p95 < 1ms（NFR1，2000 文档 / 50000 关系规模）
**And** 查询不存在的文档时返回明确的错误信息（含错误码 + 建议操作，NFR19）
**And** 单元测试 + 集成测试：正常查询 + 类型过滤 + 空结果 + 文档不存在

### Story 3.2：多跳关系遍历

As a 用户，
I want 查询指定文档的二跳、三跳间接关联关系，
So that 我可以了解更深层的文档依赖链路。

**Acceptance Criteria:**

**Given** Story 3.1 的一跳查询已就绪
**When** 执行多跳查询
**Then** QueryService 支持 `--depth <N>` 参数控制遍历深度（1/2/3 跳，默认 1）（FR16）
**And** 使用 BFS 算法实现图遍历，结果按距离排序
**And** 结果中标注每条关系的跳数距离
**And** 三跳关系遍历响应时间 p95 < 5ms（NFR2，2000 文档 / 50000 关系规模）
**And** 从 200 文档扩展到 2000 文档时查询性能退化不超过 10%（NFR7）
**And** 单元测试：BFS 遍历正确性 + 深度限制 + 环路处理 + 性能基准

### Story 3.3：ImpactService 变更影响分析

As a 用户，
I want 通过 `cord impact <doc>` 获取文档变更的完整影响分析，
So that 我可以在修改文档前了解哪些关联文档会受到影响，以及应该采取什么动作。

**Acceptance Criteria:**

**Given** Story 3.2 的多跳遍历已就绪
**When** 执行影响分析
**Then** `src/services/impact-service.ts` 实现变更影响分析（FR15）
**And** 结果包含：受影响文档路径、关系类型、传播行为类型、建议动作（FR17）
**And** 建议动作根据传播行为类型自动推导（如 sync_required → "需要同步更新"、context_for → "仅供参考"）
**And** 影响分析默认过滤置信度 ≥ 0.50 的关系（FR11），可通过配置调整
**And** `src/cli/commands/impact.ts` 实现 `cord impact` CLI 命令（薄壳）
**And** CLI 默认输出人类可读表格（按影响严重程度排序）
**And** 支持 `--json` 输出 JSON
**And** 单元测试 + 集成测试：正常影响分析 + 置信度过滤 + 空影响 + 各传播行为类型的建议动作验证

### Story 3.4：JSON 快照导出

As a 用户，
I want 通过 `cord export` 将完整关系图谱导出为 JSON 快照文件，
So that 我可以将图谱快照提交到 git 供团队审阅。

**Acceptance Criteria:**

**Given** 已有关系图谱数据
**When** 执行导出
**Then** `src/services/export-service.ts` 实现 JSON 快照导出（FR26）
**And** 导出格式包含 `schemaVersion` 字段（值为 "1.0"）（NFR14）
**And** 导出格式包含 `exportedAt`（ISO 8601）、`project` 名称、`documents` 数组、`relations` 数组
**And** JSON 字段使用 camelCase，null 值保留不省略（P10）
**And** `src/cli/commands/export.ts` 实现 `cord export` CLI 命令
**And** 导出文件默认输出到项目根目录
**And** 单元测试：导出格式验证 + schemaVersion 字段存在 + 空图谱导出

### Story 3.5：StatusService 健康检查

As a 用户，
I want 通过 `cord status` 查看当前项目的 CORD 配置状态和图谱健康信息，
So that 我可以了解图谱的整体状况——有多少文档、多少关系、是否有过时或不一致的数据。

**Acceptance Criteria:**

**Given** 已有 CORD 配置和关系图谱
**When** 执行健康检查
**Then** `src/services/status-service.ts` 实现健康检查（FR5）
**And** 输出包含：文档总数、关系总数、按关系类型的分布统计、最后扫描时间
**And** 检测并报告过时关系（关联文档 mtime 新于关系创建时间）
**And** 检测并报告潜在不一致（孤立节点、悬空关系边）
**And** 显示当前 schema 版本号（D2）
**And** `src/cli/commands/status.ts` 实现 `cord status` CLI 命令
**And** CLI 输出人类可读的仪表盘式摘要
**And** 支持 `--json` 输出
**And** 单元测试：正常健康检查 + 有过时关系时的报告 + 空图谱

---

## Epic 4：关系管理与图谱修正

用户可以手动添加、移除或标记关系为 deprecated。系统记录关系来源和修改历史，增量扫描时保护手动修正（收敛机制），支持按文档类别配置更新策略。图谱准确度随使用自然收敛。

### Story 4.1：RelationService 手动添加与移除关系

As a 用户，
I want 手动添加文档间的关系或移除/标记已有关系为 deprecated，
So that 我可以修正自动扫描的误判（假阳性和假阴性），让图谱更准确。

**Acceptance Criteria:**

**Given** 已有关系图谱
**When** 手动管理关系
**Then** `src/services/relation-service.ts` 实现手动添加关系（FR18）——指定源文档、目标文档、关系类型
**And** 支持移除关系或标记关系为 deprecated（FR19）
**And** 手动添加的关系来源标记为"手动添加"（FR21）
**And** 手动修改的关系记录修改历史（FR21）
**And** 添加关系时验证源文档和目标文档路径存在于图谱中
**And** 添加重复关系时返回明确提示（不重复创建）
**And** 所有错误信息遵循 `[错误码] 描述 → 建议` 格式（NFR19）
**And** 单元测试：添加/移除/deprecated 正常路径 + 文档不存在 + 重复关系 + 来源和历史记录验证

### Story 4.2：收敛保护机制与来源优先级

As a 用户，
I want 增量扫描时系统保护我手动修正过的关系，
So that 自动扫描不会覆盖我的手动修正，图谱准确度随使用自然收敛。

**Acceptance Criteria:**

**Given** Story 4.1 的关系管理能力和 Story 2.6 的增量扫描已就绪
**When** 执行增量扫描
**Then** 手动添加的关系不被自动删除（FR22）
**And** 手动标记为 deprecated 的关系不被自动恢复（FR22）
**And** 优先级规则：手动修正 > 框架预设 > 自动扫描发现（FR22）
**And** 关系来源区分三种类型：自动扫描（auto_scan）/ 手动添加（manual）/ 框架预设（framework_preset）
**And** 新增传播行为类型时，已有关系数据无需迁移即可正常查询（NFR9）
**And** 单元测试 + 集成测试：手动关系在增量扫描后保持不变 + deprecated 关系不恢复 + 优先级冲突场景

### Story 4.3：文档类别更新策略配置

As a 用户，
I want 按文档类别配置不同的更新策略，
So that 关键文档（如 PRD）变更时自动触发同步，而参考文档只记录不触发。

**Acceptance Criteria:**

**Given** Story 4.1 的关系管理和配置系统已就绪
**When** 配置更新策略
**Then** 支持三种更新策略：自动更新 / 生成建议后人工确认 / 仅记录不触发（FR23）
**And** 策略可通过 cord.config 按文档类别（如 prd、architecture、story 等）配置
**And** 未配置的文档类别使用默认策略（生成建议后人工确认）
**And** 影响分析结果中体现对应文档的更新策略
**And** 单元测试：三种策略各自生效 + 默认策略回退 + 配置覆盖

---

## Epic 5：AI IDE 集成（MCP Server + Hooks + 指令注入）

用户运行 `cord init` 即可一键完成 IDE 检测、框架检测、MCP Server 配置、Hooks 脚本安装和指令文件注入。AI Agent 可通过 MCP Server 自动调用 CORD 能力（影响分析、关系查询、图谱初始化、同步建议、关系管理）。文档变更落盘时自动触发关系检查。

### Story 5.1：MCP Server 核心与 4 个 Tools

As a AI Agent（通过 AI IDE），
I want 通过 MCP Server 调用 CORD 的核心能力，
So that 我可以在用户的开发流程中自动执行影响分析、关系查询等操作。

**Acceptance Criteria:**

**Given** Epic 2-4 的 Service 层已就绪
**When** 实现 MCP Server
**Then** `src/mcp/server.ts` 实现 MCP Server 入口，使用 TypeScript SDK v1.x + Stdio Transport
**And** `src/mcp/tools/analyze-impact.ts` 实现 analyze_impact Tool（调用 ImpactService）
**And** `src/mcp/tools/query-relations.ts` 实现 query_relations Tool（调用 QueryService）
**And** `src/mcp/tools/init-graph.ts` 实现 init_graph Tool（调用 ScanService）
**And** `src/mcp/tools/sync-docs.ts` 实现 sync_docs Tool（触发关联文档同步建议）
**And** 每个 Tool 的 inputSchema 从 Zod schema 自动导出为 JSON Schema
**And** MCP Server 作为长驻进程运行（FR32）
**And** MCP Tool 单次调用响应时间 p95 < 50ms（NFR4）
**And** CLI 与 MCP Server 对相同输入返回语义一致的输出（NFR13）
**And** MCP Server 收到 SIGTERM 后 ≤ 2 秒内优雅退出（关闭 SQLite + flush 日志）（NFR17）
**And** 新增 MCP Tool 时已有 4 个 Tool 的 JSON Schema 保持不变（NFR10）
**And** 所有日志输出到 stderr，不污染 stdout JSON-RPC 通道
**And** 集成测试：4 个 Tool 端到端调用 + SIGTERM 优雅退出 + 输入验证失败

### Story 5.2：MCP Tools 关系管理能力

As a AI Agent（通过 AI IDE），
I want 通过 MCP Tools 添加、移除或标记关系为 deprecated，
So that 用户可以通过自然语言对话让我修正文档关系（AI IDE 负责意图解析，CORD 提供原子化 CRUD）。

**Acceptance Criteria:**

**Given** Story 5.1 的 MCP Server 和 Epic 4 的 RelationService 已就绪
**When** 扩展 MCP Tools 关系管理能力
**Then** 在 MCP Server 中注册关系管理 Tools：add_relation、remove_relation、deprecate_relation（FR20）
**And** 每个 Tool 暴露原子化的关系 CRUD 操作
**And** CORD 提供操作接口，AI IDE 负责从用户自然语言中解析意图后调用（FR20 职责边界）
**And** 新增 Tools 不影响已有 4 个 Tool 的 JSON Schema（NFR10）
**And** 集成测试：通过 MCP 添加/移除/deprecated 关系 + 操作结果验证

### Story 5.3：IDE 适配器与自动检测

As a 用户，
I want 系统自动检测我使用的 AI IDE 类型，
So that `cord init` 可以为我的 IDE 生成正确的配置文件。

**Acceptance Criteria:**

**Given** 需要支持多种 IDE
**When** 实现 IDE 适配层
**Then** `src/adapters/ide/interfaces.ts` 定义 IIdeAdapter 接口
**And** `src/adapters/ide/detector.ts` 实现 IDE 自动检测逻辑（FR2）——检测 Claude Code / Cursor / VS Code Copilot / Codex CLI
**And** `src/adapters/ide/claude-code.ts` 实现 Claude Code 适配器（Hooks 配置 + CLAUDE.md 指令注入 + MCP 配置）
**And** `src/adapters/ide/cursor.ts` 实现 Cursor 适配器（.cursor/mcp.json + .cursor/rules/）
**And** `src/adapters/ide/vscode-copilot.ts` 实现 VS Code Copilot 适配器（copilot-instructions.md + MCP Host）
**And** `src/adapters/ide/codex-cli.ts` 实现 Codex CLI 适配器（AGENTS.md，基础集成层）
**And** 全局指令文件生成采用独立文件注入策略，不修改用户已有 IDE 配置文件（NFR12）
**And** 单元测试：4 种 IDE 检测 + 各适配器配置文件生成 + 零侵入验证（SHA-256 校验已有文件不变）

### Story 5.4：InitService 一键初始化（cord init）

As a 用户，
I want 通过 `cord init` 一键完成项目的完整初始化配置，
So that 从安装到首次使用的体验闭环 < 30 分钟，零摩擦上手。

**Acceptance Criteria:**

**Given** Story 5.3 的 IDE 适配器和 Story 2.1 的框架适配器已就绪
**When** 执行 `cord init`
**Then** `src/services/init-service.ts` 编排完整初始化流程（FR1）：
**And** 自动检测 IDE 类型（FR2）并选择对应适配器
**And** 自动检测开发框架（FR3）并选择对应适配器
**And** 根据 IDE 类型生成配置文件——MCP 配置、指令文件、Hooks 脚本（FR4）
**And** 生成 `cord.config.yaml` 默认配置文件
**And** 创建 `.cord/` 数据目录
**And** `src/cli/commands/init.ts` 实现 `cord init` CLI 命令（薄壳），使用 @clack/prompts 提供交互向导
**And** CLI 输出人类可读的步骤进度 + 结果摘要
**And** 支持 `--json` 输出
**And** 集成测试：在 BMAD 项目中 init + 在通用项目中 init + IDE 检测正确性

### Story 5.5：Hooks 文档变更自动触发与 Skills 生成

As a 用户，
I want 文档变更落盘时自动触发关系检查，且 AI Agent 有 Skills 定义文件引导它调用 CORD，
So that 日常开发中我无需手动操作，AI Agent 自动完成影响分析和同步建议。

**Acceptance Criteria:**

**Given** Story 5.4 的 init 流程已就绪
**When** 配置 Hooks 和 Skills
**Then** `cord init` 为 Claude Code 生成 Hooks 脚本——文档变更落盘时自动触发 `analyze_impact`（FR29）
**And** 对不支持 Hooks 的 IDE（Cursor/VS Code Copilot），通过指令文件引导 AI Agent 在文档编辑后主动调用 CORD
**And** `src/adapters/ide/skills-generator.ts` 生成符合 Claude Code Skills 规范的定义文件（FR31）
**And** Skills 文件覆盖 4 个核心意图场景：影响分析、关系查询、图谱初始化、同步建议
**And** 每个 Skills 文件包含触发条件描述、对应 MCP Tool 调用序列和预期输出格式
**And** MCP Server 在 Claude Code ≥ 1.0 / Cursor ≥ 0.48 / VS Code Copilot ≥ 1.96 中验证通过（NFR11）
**And** 集成测试：Hooks 脚本触发验证 + Skills 文件格式验证 + 三大 IDE MCP 端到端验证

---

## Epic 6：社区贡献体验与文档交付

社区开发者可以基于完整的 IFrameworkAdapter 接口文档、BMAD 参考实现、集成测试模板和 PR 规范，在 4 小时内完成最小可用的框架适配模块。最终用户通过 README、快速开始指南、CLI/MCP/配置参考等完整文档获得自助式上手体验。

### Story 6.1：框架适配贡献者文档

As a 社区开发者，
I want 完整的框架适配开发者指南，
So that 我可以在 4 小时内为自己使用的框架编写最小可用的 CORD 适配模块。

**Acceptance Criteria:**

**Given** Epic 2 的框架适配层已实现并稳定
**When** 编写贡献者文档
**Then** `docs/adapter-guide.md` 包含 IFrameworkAdapter 接口 API 完整说明（FR42）
**And** 包含最小适配模块开发教程（含代码示例——从零创建一个适配器的步骤）
**And** 包含集成测试编写指南（含测试模板）
**And** `docs/contributing.md` 包含 PR 提交规范和审阅流程说明（FR42）
**And** BMAD 适配模块作为可运行的参考实现，含源码注释（FR37）
**And** 非核心开发者可在 4 小时内完成最小可用适配模块（含文档类型注册 + 1 条预设规则 + 通过集成测试）（FR37 验收标准 d）
**And** 新增适配模块时核心模块单元测试通过率保持 100%，无需修改核心模块源码（NFR8）

### Story 6.2：用户文档与 README

As a 新用户，
I want 完整的用户文档，
So that 我可以通过自助式阅读快速上手 CORD，从安装到首次影响分析 < 5 分钟阅读。

**Acceptance Criteria:**

**Given** 所有功能 Epic 已完成
**When** 编写用户文档
**Then** `README.md` 包含项目介绍、核心概念（"确定性优于推理性"）、快速开始链接、安装指南、Star 徽章
**And** `docs/getting-started.md` 包含从安装到首次影响分析触发的完整流程（< 5 分钟阅读）
**And** `docs/cli-reference.md` 包含每个 CLI 命令的用法、参数、选项、示例输出
**And** `docs/mcp-tools-reference.md` 包含每个 MCP Tool 的输入/输出 schema、使用场景、调用示例
**And** `docs/configuration.md` 包含 cord.config 配置项说明、IDE 配置文件模板、框架适配配置
**And** 所有文档使用中文编写（document_output_language: Mandarin）

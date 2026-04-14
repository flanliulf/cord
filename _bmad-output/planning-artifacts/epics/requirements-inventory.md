# Requirements Inventory

## Functional Requirements

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

## NonFunctional Requirements

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

## Additional Requirements

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

## UX Design Requirements

无 UX 设计文档（本项目为 CLI + MCP Server 开发者工具，无 GUI）。

## FR Coverage Map

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

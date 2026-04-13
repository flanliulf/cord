# Project Context Analysis

## Requirements Overview

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

## Technical Constraints & Dependencies

**已锁定的技术选型（11项TR）：**

| 层次 | 技术选型 | 架构约束 |
|------|----------|----------|
| 运行时 | TypeScript / Node.js 20+ | 统一语言，async/await并发 |
| 存储 | SQLite + better-sqlite3 v12.8.0 | 同步API，嵌入式零运维，图模型思维建表 |
| MCP | TypeScript SDK v1.x + Stdio Transport（SSE不需要——本地优先定位，三大IDE均通过Stdio连接） | 长驻进程，JSON-RPC，Tools原语优先 |
| 文档解析 | remark/unified.js | 管道式AST，9核心依赖+6自定义插件 |
| CLI | Commander.js v14 | 命令模式，子命令懒加载 |
| 构建 | tsup | TypeScript→JavaScript编译 |
| 交互 | @clack/prompts + chalk | CLI交互向导+终端颜色（chalk v5+ 纯 ESM） |
| 可视化 | Mermaid.js v11.13.0（v0.5） | DSL优先，Builder模式生成器 |
| npm分发 | MVP模式C→v0.5模式A | 渐进式，semantic-release自动化 |
| 存储抽象 | Repository Pattern（IGraphRepository） | 存储引擎可切换 |

**外部依赖约束：**
- better-sqlite3 native addon 跨平台构建：MVP依赖上游预编译
- MCP协议版本兼容性：锁定v1.x SDK
- npm provenance 供应链安全从第一天启用

## Cross-Cutting Concerns Identified

1. **双入口一致性（CLI ↔ MCP）**：两个接口入口共享Service层，必须保证语义和行为100%一致。Service层是架构的核心锚点。

2. **可插拔框架适配**：IFrameworkAdapter → AbstractFrameworkAdapter → 具体适配器（BMAD/Superpowers/社区）。新框架适配不触碰核心代码。

3. **跨IDE兼容**：端口-适配器模式 + 策略模式。IDE Hooks能力两极分化（Claude Code 20+事件 vs Cursor/Copilot 无Hooks），通过三层分级集成架构（MCP→指令引导→原生Hooks）统一处理。

4. **错误处理与容错**：贯穿所有层的统一错误处理策略——扫描容错跳过、MCP Server优雅退出（SIGTERM handler关闭SQLite+flush日志，进程生命周期由IDE Host管理）、错误信息含上下文和修复建议。

5. **数据前向兼容**：JSON快照格式（NFR14）、关系类型体系（NFR9）、MCP Tools接口（NFR10）——三个维度的向前兼容需要版本策略和迁移机制。

6. **性能预算**：懒加载（CLI冷启动 < 200ms）、索引优化（查询 < 1ms）、增量处理（无变更扫描 < 100ms）——性能约束贯穿多个架构层。

7. **渐进式增强**：冷启动扫描的三级架构（规则→Embedding→LLM）、npm分发的演进（模式C→模式A）、可视化的分阶段交付——架构需支持能力的渐进式叠加。

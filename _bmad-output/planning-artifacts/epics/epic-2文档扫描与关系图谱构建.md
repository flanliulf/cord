# Epic 2：文档扫描与关系图谱构建

用户可以运行 `cord scan` 对项目文档执行冷启动扫描，自动发现文档间的关系并建立关系图谱（SQLite 存储）。支持增量扫描、文档生命周期检测（重命名/移动/删除）、置信度评分。BMAD 框架用户开箱即用（18 种文档类型 + 预设规则），无框架用户通过通用规则引擎获得基础体验。

## Story 2.1：框架适配器接口与通用规则退化

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

## Story 2.2：扫描引擎核心管道（remark AST + 规则引擎）

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

## Story 2.3：BMAD 框架适配模块

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

## Story 2.4：配置加载与文档管辖范围

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

## Story 2.5：ScanService 冷启动扫描与图谱写入

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

## Story 2.6：增量扫描与文档生命周期检测

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

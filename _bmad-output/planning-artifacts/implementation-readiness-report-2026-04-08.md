---
stepsCompleted:
  - step-01-document-discovery
  - step-02-prd-analysis
  - step-03-epic-coverage-validation
  - step-04-ux-alignment
  - step-05-epic-quality-review
  - step-06-final-assessment
status: 'complete'
startedAt: '2026-04-08'
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/architecture.md'
  - '_bmad-output/planning-artifacts/epics/index.md'
  - '_bmad-output/planning-artifacts/prd-validation-report.md'
---

# Implementation Readiness Assessment Report

**Date:** 2026-04-08
**Project:** CORD

## Step 1: Document Discovery

### 文档清单

| 文档类型 | 文件 | 大小 | 最后修改 | 状态 |
|---------|------|------|---------|------|
| PRD | `prd.md` | 39KB | 2026-04-08 | ✅ 已找到 |
| PRD 验证报告 | `prd-validation-report.md` | 25KB | 2026-04-08 | ✅ 已找到（辅助） |
| Architecture | `architecture.md` | 56KB | 2026-04-08 | ✅ 已找到 |
| Epics & Stories | `epics.md` | 45KB | 2026-04-08 | ✅ 已找到 |
| UX Design | — | — | — | ⚠️ 未找到 |

### 发现结果

- ✅ 无重复文档冲突
- ✅ Epics & Stories 已创建（较上次评估新增）
- ⚠️ UX 设计文档缺失 — CORD 为 CLI/MCP 开发者工具，可能无需传统 UX 文档
- ℹ️ 本次为第二轮评估，Epics 已就绪，可执行完整检查

## Step 2: PRD Analysis

### 功能需求（Functional Requirements）— 42 项

**项目初始化与配置（FR1-FR5）**

- **FR1**：用户可以通过单个命令（`cord init`）完成项目的完整初始化配置
- **FR2**：系统可以自动检测当前项目使用的 AI IDE 类型（Claude Code / Cursor / VS Code Copilot / Codex CLI）
- **FR3**：系统可以自动检测当前项目使用的开发框架（BMAD-Method / Superpowers / 无框架）。注：检测能力与适配能力解耦
- **FR4**：系统可以根据检测到的 IDE 类型自动生成对应的配置文件（MCP 配置、指令文件、Hooks 脚本）
- **FR5**：用户可以查看当前项目的 CORD 配置状态和健康信息（`cord status`）

**文档扫描与关系发现（FR6-FR12）**

- **FR6**：用户可以对项目中的所有文档执行冷启动扫描，自动发现并建立文档间的关系图谱
- **FR7**：系统可以对已有图谱执行增量扫描，仅处理变更的文档
- **FR8**：增量扫描时，系统可以检测文档的重命名、移动和删除事件（通过对比文件系统快照与图谱记录的路径），并自动更新或清理图谱中的孤立节点和失效关系边
- **FR9**：系统可以通过规则引擎识别文档间的关系（frontmatter 引用、Markdown 链接、目录结构推断）
- **FR10**：系统可以将发现的关系按 9 种传播行为类型进行分类
- **FR11**：系统可以为每条发现的关系标记置信度分数（范围 0.0-1.0）
- **FR12**：系统可以建立文档级关系索引（v0.1 核心粒度；章节/段落级 v0.5+）

**关系查询与影响分析（FR13-FR17）**

- **FR13**：用户可以查询指定文档的所有关联关系（一跳关系列表）
- **FR14**：用户可以按关系类型过滤查询结果
- **FR15**：用户可以对指定文档执行变更影响分析，获取受影响文档列表及建议动作
- **FR16**：系统可以支持多跳关系遍历（一跳、二跳、三跳查询）
- **FR17**：系统可以在影响分析结果中明确标注每条受影响关系的传播行为类型和建议动作

**关系管理与修正（FR18-FR23）**

- **FR18**：用户可以手动添加文档间的关系
- **FR19**：用户可以移除或标记已有关系为 deprecated
- **FR20**：系统可以通过 MCP Tools 暴露关系管理能力
- **FR21**：系统可以记录关系的来源和修改历史
- **FR22**：增量扫描时，系统可以识别并保护用户手动修正过的关系（收敛保护机制）
- **FR23**：用户可以按文档类别配置不同的更新策略

**数据存储与导出（FR24-FR27）**

- **FR24**：系统可以使用嵌入式数据库存储文档节点和关系边的完整图谱数据
- **FR25**：系统可以维护文档同步状态表
- **FR26**：用户可以将完整关系图谱导出为 JSON 快照文件
- **FR27**：系统可以在本地完成所有数据存储和处理，不依赖任何外部云服务

**AI IDE 集成（FR28-FR32）**

- **FR28**：AI Agent 可以通过 MCP Server 以 Tools 方式调用 CORD 的核心能力
- **FR29**：系统可以通过 Hooks 机制在文档变更落盘时自动触发关系检查
- **FR30**：系统可以生成 IDE 特定的全局指令片段
- **FR31**：系统可以生成符合 AI IDE Skills 规范的定义文件
- **FR32**：MCP Server 可以作为长驻进程运行

**框架适配（FR33-FR37）**

- **FR33**：系统可以通过适配器接口（IFrameworkAdapter）支持不同开发框架的文档类型识别
- **FR34**：BMAD 适配模块可以识别 18 种 BMAD 文档类型并应用预设关系规则
- **FR35**：框架适配模块可以通过声明式方式注册文档类型定义和预设关系规则
- **FR36**：系统可以在无特定框架适配时退回通用规则引擎
- **FR37**：社区开发者可以基于公开接口开发新的框架适配模块

**文档管辖范围与配置（FR38-FR42）**

- **FR38**：系统的管辖范围包括：框架产出文档、AI IDE/Agent 指令规范文档、用户自行指令产生的文档
- **FR39**：系统明确排除项目源码目录（src/）下的所有文件
- **FR40**：系统可以为已支持的框架和 IDE 提供预设的文档路径/目录/文件名配置
- **FR41**：用户可以通过 `cord.config` 自定义扩展文档路径、目录和文件名匹配规则
- **FR42**：系统可以提供框架适配贡献者文档

**总计：42 项功能需求**

### 非功能需求（Non-Functional Requirements）— 19 项

**性能（NFR1-NFR6）**

- **NFR1**：一跳关系查询响应时间 p95 < 1ms
- **NFR2**：三跳关系遍历响应时间 p95 < 5ms
- **NFR3**：CLI 冷启动时间 p95 < 200ms
- **NFR4**：MCP Server 单次 Tool 调用响应时间 p95 < 50ms
- **NFR5**：冷启动扫描处理速度 ≥ 4 文档/秒
- **NFR6**：增量扫描无变更时检查完成时间 p95 < 100ms

**可扩展性（NFR7-NFR10）**

- **NFR7**：200→2000 文档扩展时性能退化不超过 10%
- **NFR8**：新增框架适配模块时核心模块零修改
- **NFR9**：新增传播行为类型时已有数据无需迁移
- **NFR10**：新增 MCP Tool 时已有 Tool Schema 不变

**集成（NFR11-NFR14）**

- **NFR11**：MCP Server 在三大 IDE 中完成端到端验证
- **NFR12**：全局指令文件生成采用独立文件注入策略
- **NFR13**：CLI 与 MCP Server 对相同输入返回语义一致的输出
- **NFR14**：JSON 快照导出格式包含 schema 版本号

**可靠性（NFR15-NFR19）**

- **NFR15**：异常中断后数据库一致性 = 100%
- **NFR16**：遇到无法解析的文档时跳过并记录 WARNING
- **NFR17**：MCP Server 收到 SIGTERM 后 ≤ 2 秒完成优雅退出
- **NFR18**：关系图谱可通过 `--rebuild` 完全重建
- **NFR19**：所有错误信息遵循统一格式

**总计：19 项非功能需求**

### 附加需求与约束

- **开放问题 5 项**：OQ1（已关闭）、OQ2-OQ5（待决策，均有决策时限建议）
- **技术约束**：TypeScript/Node.js、Node.js 20+ LTS、npm 分发、SQLite 嵌入式存储、零云依赖
- **IDE 集成约束**：三层分级架构（MCP 通用层 → 指令引导层 → 原生 Hooks 层）
- **分发约束**：MVP 模式 C（依赖上游预编译），v0.5 模式 A
- **配置约束**：cord.config.yaml / cord.config.json，7 项配置，所有可选

### PRD 完整性评估

- ✅ 功能需求覆盖 8 个功能域，42 项 FR 编号连续无缺失
- ✅ 非功能需求覆盖 4 个类别，19 项 NFR 均含测量方法和 p95 分位数
- ✅ MVP 策略清晰（Must-Have vs Nice-to-Have 划分明确）
- ✅ 4 条用户旅程覆盖 Happy Path、持续价值、异常恢复、社区贡献
- ✅ 风险缓解策略涵盖技术/市场/资源三维度
- ✅ 成功标准 SMART 化，含量化验证方法
- ⚠️ OQ2（数据收集机制）需在 v0.1 发布前决策

## Step 3: Epic Coverage Validation

### FR 覆盖矩阵（42 项 FR）

| FR | PRD 需求 | Epic 覆盖 | Story 追溯 | 状态 |
|----|---------|----------|-----------|------|
| FR1 | `cord init` 一键初始化配置 | Epic 5 | Story 5.4 | ✅ 覆盖 |
| FR2 | 自动检测 AI IDE 类型 | Epic 5 | Story 5.3 | ✅ 覆盖 |
| FR3 | 自动检测开发框架 | Epic 5 | Story 5.4 | ✅ 覆盖 |
| FR4 | 根据 IDE 生成配置文件 | Epic 5 | Story 5.3, 5.4 | ✅ 覆盖 |
| FR5 | `cord status` 健康检查 | Epic 3 | Story 3.5 | ✅ 覆盖 |
| FR6 | 冷启动扫描建立关系图谱 | Epic 2 | Story 2.5 | ✅ 覆盖 |
| FR7 | 增量扫描处理变更文档 | Epic 2 | Story 2.6 | ✅ 覆盖 |
| FR8 | 增量扫描检测重命名/移动/删除 | Epic 2 | Story 2.6 | ✅ 覆盖 |
| FR9 | 规则引擎识别文档关系 | Epic 2 | Story 2.2 | ✅ 覆盖 |
| FR10 | 9 种传播行为类型分类 | Epic 2 | Story 2.2 | ✅ 覆盖 |
| FR11 | 关系置信度评分（0.0-1.0） | Epic 2 | Story 2.2, 2.3 | ✅ 覆盖 |
| FR12 | 文档级关系索引 | Epic 2 | Story 2.2 | ✅ 覆盖 |
| FR13 | 查询文档关联关系（一跳） | Epic 3 | Story 3.1 | ✅ 覆盖 |
| FR14 | 按关系类型过滤查询结果 | Epic 3 | Story 3.1 | ✅ 覆盖 |
| FR15 | 变更影响分析 | Epic 3 | Story 3.3 | ✅ 覆盖 |
| FR16 | 多跳关系遍历 | Epic 3 | Story 3.2 | ✅ 覆盖 |
| FR17 | 影响分析标注传播行为和建议动作 | Epic 3 | Story 3.3 | ✅ 覆盖 |
| FR18 | 手动添加文档关系 | Epic 4 | Story 4.1 | ✅ 覆盖 |
| FR19 | 移除/标记关系为 deprecated | Epic 4 | Story 4.1 | ✅ 覆盖 |
| FR20 | MCP Tools 暴露关系管理能力 | Epic 5 | Story 5.2 | ✅ 覆盖 |
| FR21 | 记录关系来源和修改历史 | Epic 4 | Story 4.1 | ✅ 覆盖 |
| FR22 | 增量扫描保护手动修正（收敛机制） | Epic 4 | Story 4.2 | ✅ 覆盖 |
| FR23 | 按文档类别配置更新策略 | Epic 4 | Story 4.3 | ✅ 覆盖 |
| FR24 | 嵌入式数据库存储图谱数据 | Epic 2 | Story 1.4, 2.5 | ✅ 覆盖 |
| FR25 | 文档同步状态表 | Epic 2 | Story 2.5 | ✅ 覆盖 |
| FR26 | JSON 快照导出 | Epic 3 | Story 3.4 | ✅ 覆盖 |
| FR27 | 本地存储，零云依赖 | Epic 2 | Story 1.4 | ✅ 覆盖 |
| FR28 | MCP Server + Tools 调用核心能力 | Epic 5 | Story 5.1 | ✅ 覆盖 |
| FR29 | Hooks 文档变更自动触发 | Epic 5 | Story 5.5 | ✅ 覆盖 |
| FR30 | IDE 全局指令片段生成 | Epic 5 | Story 5.3 | ✅ 覆盖 |
| FR31 | Skills 定义文件生成 | Epic 5 | Story 5.5 | ✅ 覆盖 |
| FR32 | MCP Server 长驻进程 | Epic 5 | Story 5.1 | ✅ 覆盖 |
| FR33 | IFrameworkAdapter 适配器接口 | Epic 2 | Story 2.1 | ✅ 覆盖 |
| FR34 | BMAD 适配模块（18 种文档类型） | Epic 2 | Story 2.3 | ✅ 覆盖 |
| FR35 | 声明式注册文档类型和预设规则 | Epic 2 | Story 2.1 | ✅ 覆盖 |
| FR36 | 无框架时退回通用规则引擎 | Epic 2 | Story 2.1 | ✅ 覆盖 |
| FR37 | 社区开发者可开发新适配模块 | Epic 6 | Story 6.1 | ✅ 覆盖 |
| FR38 | 管辖范围定义 | Epic 2 | Story 2.4 | ✅ 覆盖 |
| FR39 | 排除源码目录 | Epic 2 | Story 2.1, 2.4 | ✅ 覆盖 |
| FR40 | 预设文档路径配置 | Epic 2 | Story 2.4 | ✅ 覆盖 |
| FR41 | 用户自定义配置扩展 | Epic 2 | Story 2.4 | ✅ 覆盖 |
| FR42 | 贡献者文档 | Epic 6 | Story 6.1 | ✅ 覆盖 |

### 缺失 FR 覆盖

无缺失。42 项 FR 全部在 Epics 中有明确的 Story 追溯。

### 覆盖统计

- PRD 功能需求总计：**42 项**
- Epics 覆盖 FR 数：**42 项**
- 覆盖率：**100%**
- 缺失 FR：**0 项**

## Step 4: UX Alignment Assessment

### UX 文档状态

**未找到** — Step 1 已确认无 UX 设计文档。

### 评估结论

- CORD 是 CLI + MCP Server 开发者工具，**无 GUI 界面**，不需要传统 UX 设计文档
- PRD 未提及任何图形用户界面需求
- 用户交互界面完全通过 CLI 命令和 MCP Tools 定义，已在 PRD 中详细描述：
  - CLI 命令接口（6 个命令，含参数、选项、输出格式）
  - MCP Tools 接口（4+3 个 Tools，含意图描述）
  - cord.config 配置规范（7 项配置）
- Epics 文档中也明确标注："无 UX 设计文档（本项目为 CLI + MCP Server 开发者工具，无 GUI）"

### 警告

无。UX 文档缺失属于**预期状态**，不构成风险。

## Step 5: Epic Quality Review

### Epic 结构验证

#### A. 用户价值焦点检查

| Epic | 标题 | 用户价值 | 判定 |
|------|------|---------|------|
| Epic 1 | 项目骨架与工程基础设施 | ❌ 技术基础设施，无直接用户价值 | 🔴 违规 |
| Epic 2 | 文档扫描与关系图谱构建 | ✅ 用户可运行 `cord scan` 建立图谱 | ✅ 通过 |
| Epic 3 | 关系查询、影响分析与数据导出 | ✅ 用户可通过 `cord query/impact/export/status` 获取价值 | ✅ 通过 |
| Epic 4 | 关系管理与图谱修正 | ✅ 用户可手动修正关系，图谱随使用收敛 | ✅ 通过 |
| Epic 5 | AI IDE 集成（MCP + Hooks + 指令注入） | ✅ 用户可 `cord init` 一键配置，AI Agent 自动调用 | ✅ 通过 |
| Epic 6 | 社区贡献体验与文档交付 | ✅ 社区开发者可开发适配模块，新用户可自助上手 | ✅ 通过 |

#### B. Epic 独立性验证

| Epic 依赖链 | 判定 | 说明 |
|------------|------|------|
| Epic 1 → 独立 | ✅ 通过 | 工程骨架自包含 |
| Epic 2 → 依赖 Epic 1 | ✅ 通过 | 使用 Epic 1 的基础设施（Repository、类型系统等） |
| Epic 3 → 依赖 Epic 1+2 | ✅ 通过 | 使用 Epic 2 产出的图谱数据 |
| Epic 4 → 依赖 Epic 1+2 | ✅ 通过 | 使用 Epic 2 的扫描和存储能力 |
| Epic 5 → 依赖 Epic 1+2+3+4 | ✅ 通过 | MCP Server 包装 Service 层，init 集成所有能力 |
| Epic 6 → 依赖 Epic 1-5 | ✅ 通过 | 文档需要功能稳定后编写 |

**无循环依赖，无前向依赖。** Epic 序号严格遵循依赖顺序。

### Story 质量评估

#### Epic 1 Story 详细审查

| Story | 验收标准质量 | Story 大小 | 独立性 | 问题 |
|-------|------------|-----------|--------|------|
| 1.1 项目初始化与目录结构搭建 | ✅ 具体、可测试 | ✅ 合理 | ✅ 独立 | — |
| 1.2 CordError + Logger | ✅ Given/When/Then 格式 | ✅ 合理 | ✅ 依赖 1.1 | — |
| 1.3 Zod 验证层与类型定义 | ✅ 具体、可测试 | ✅ 合理 | ✅ 依赖 1.2 | — |
| 1.4 SQLite 存储层与迁移 | ✅ 具体、可测试 | ✅ 合理 | ✅ 依赖 1.3 | — |
| 1.5 CI/CD 管道 | ✅ 具体、可测试 | ✅ 合理 | ✅ 依赖 1.1-1.4 | — |

#### Epic 2 Story 详细审查

| Story | 验收标准质量 | Story 大小 | 独立性 | 问题 |
|-------|------------|-----------|--------|------|
| 2.1 框架适配器接口与通用规则 | ✅ 具体 | ✅ 合理 | ✅ 依赖 Epic 1 | — |
| 2.2 扫描引擎核心管道 | ✅ 详细（三种规则 + 异常处理） | ⚠️ 偏大 | ✅ 依赖 2.1 | 🟡 见下 |
| 2.3 BMAD 框架适配模块 | ✅ 具体 | ✅ 合理 | ✅ 依赖 2.1+2.2 | — |
| 2.4 配置加载与文档管辖范围 | ✅ 具体 | ✅ 合理 | ✅ 依赖 2.1-2.3 | — |
| 2.5 ScanService 冷启动扫描 | ✅ 具体（含性能 SLA） | ✅ 合理 | ✅ 依赖 2.2+2.4 | — |
| 2.6 增量扫描与生命周期检测 | ✅ 具体 | ✅ 合理 | ✅ 依赖 2.5 | — |

#### Epic 3 Story 详细审查

| Story | 验收标准质量 | Story 大小 | 独立性 | 问题 |
|-------|------------|-----------|--------|------|
| 3.1 QueryService 一跳查询 | ✅ 具体（含 NFR1 性能指标） | ✅ 合理 | ✅ 依赖 Epic 2 | — |
| 3.2 多跳关系遍历 | ✅ 具体（含 NFR2/NFR7） | ✅ 合理 | ✅ 依赖 3.1 | — |
| 3.3 ImpactService 影响分析 | ✅ 具体（含置信度过滤） | ✅ 合理 | ✅ 依赖 3.2 | — |
| 3.4 JSON 快照导出 | ✅ 具体（含 schemaVersion） | ✅ 合理 | ✅ 依赖 Epic 2 | — |
| 3.5 StatusService 健康检查 | ✅ 具体 | ✅ 合理 | ✅ 依赖 Epic 2 | — |

#### Epic 4 Story 详细审查

| Story | 验收标准质量 | Story 大小 | 独立性 | 问题 |
|-------|------------|-----------|--------|------|
| 4.1 手动添加与移除关系 | ✅ 具体 | ✅ 合理 | ✅ 依赖 Epic 2 | — |
| 4.2 收敛保护机制 | ✅ 具体（含优先级规则） | ✅ 合理 | ✅ 依赖 4.1+2.6 | — |
| 4.3 文档类别更新策略 | ✅ 具体（三种策略） | ✅ 合理 | ✅ 依赖 4.1 | — |

#### Epic 5 Story 详细审查

| Story | 验收标准质量 | Story 大小 | 独立性 | 问题 |
|-------|------------|-----------|--------|------|
| 5.1 MCP Server 核心 + 4 Tools | ✅ 详细（含 NFR4/NFR10/NFR13/NFR17） | ⚠️ 偏大 | ✅ 依赖 Epic 2-4 | 🟡 见下 |
| 5.2 MCP 关系管理 Tools | ✅ 具体 | ✅ 合理 | ✅ 依赖 5.1+Epic 4 | — |
| 5.3 IDE 适配器与自动检测 | ✅ 具体（4 种 IDE） | ✅ 合理 | ✅ 独立于 5.1 | — |
| 5.4 InitService 一键初始化 | ✅ 具体（含交互向导） | ✅ 合理 | ✅ 依赖 5.3+2.1 | — |
| 5.5 Hooks + Skills 生成 | ✅ 具体（含 NFR11 三大 IDE 验证） | ✅ 合理 | ✅ 依赖 5.4 | — |

#### Epic 6 Story 详细审查

| Story | 验收标准质量 | Story 大小 | 独立性 | 问题 |
|-------|------------|-----------|--------|------|
| 6.1 框架适配贡献者文档 | ✅ 具体（含 4 小时验收基准） | ✅ 合理 | ✅ 依赖 Epic 2 | — |
| 6.2 用户文档与 README | ✅ 具体（含 6 份文档清单） | ✅ 合理 | ✅ 依赖 Epic 1-5 | — |

### 最佳实践合规检查清单

| 检查项 | Epic 1 | Epic 2 | Epic 3 | Epic 4 | Epic 5 | Epic 6 |
|-------|--------|--------|--------|--------|--------|--------|
| 交付用户价值 | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 可独立运作 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Story 大小适当 | ✅ | ⚠️ | ✅ | ✅ | ⚠️ | ✅ |
| 无前向依赖 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 数据库表按需创建 | ✅ | ✅ | ✅ | ✅ | ✅ | N/A |
| 验收标准清晰 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| FR 追溯完整 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### 发现详情

#### 🔴 Critical Violations（1 项）

**V1. Epic 1 为纯技术基础设施 Epic，无直接用户价值**

- **问题**：Epic 1"项目骨架与工程基础设施"是典型的技术里程碑——设置目录结构、错误类、日志系统、Zod schema、SQLite 存储、CI/CD。这些不直接交付用户可感知的价值。
- **上下文**：然而，架构文档明确指出"Custom Setup（从零搭建）"策略，且此项目为 Greenfield 纯新项目，没有任何现有代码可依托。Epic 1 的产出（Repository 接口、类型系统、迁移机制）是 Epic 2-6 的硬性前提。
- **评估**：虽然违反"每个 Epic 应交付用户价值"的最佳实践，但对于 Greenfield 开发者工具项目，基础设施 Epic 是**合理的例外**。Epic 1 的 5 个 Story 拆分合理、依赖清晰、验收标准具体，问题不在于 Epic 存在，而在于命名可以更好地体现其作为"使能层"的角色。
- **建议**：考虑将 Epic 1 重命名为"开发者可开始编写功能代码的工程就绪状态"（强调 Outcome 而非 Activity），但**不阻塞实施**。

#### 🟡 Minor Concerns（2 项）

**V2. Story 2.2 偏大——扫描引擎核心管道**

- **问题**：Story 2.2 包含 remark/unified 管道编排 + 3 个 AST 提取插件 + 3 个扫描规则 + 异常处理，验收标准 11 条。
- **评估**：内容量偏大但逻辑内聚——三个规则（frontmatter、markdown-link、directory）属于同一个扫描管道的不同策略，拆分反而增加集成复杂度。
- **建议**：可接受，实施时如果发现过大可以在 Story 内部分阶段交付。

**V3. Story 5.1 偏大——MCP Server + 4 个 Tools**

- **问题**：Story 5.1 包含 MCP Server 入口 + 4 个 Tool 实现 + SIGTERM 优雅退出 + 性能 SLA 验证，验收标准 12 条。
- **评估**：MCP Server 和 Tools 紧密耦合，4 个 Tool 都是 Service 层的薄壳包装，逻辑上属于同一个交付单元。
- **建议**：可接受。如果需要拆分，可将 MCP Server 框架搭建（含 1 个 Tool）和其余 3 个 Tool 分为两个 Story。

### 依赖分析

#### Epic 间依赖图

```
Epic 1 (基础设施)
  ↓
Epic 2 (扫描 + 图谱) ← Epic 1
  ↓         ↓
Epic 3    Epic 4  ← Epic 2
  ↓         ↓
Epic 5 ← Epic 2 + 3 + 4
  ↓
Epic 6 ← Epic 1-5
```

- ✅ 无循环依赖
- ✅ 无前向依赖
- ✅ Epic 3 和 Epic 4 可**并行实施**（都只依赖 Epic 2）
- ✅ 数据库表在 Story 1.4 创建三张核心表——这是合理的，因为架构要求统一的迁移机制，且三张表（documents、relations、sync_states）是图模型的最小可用 schema

#### Story 间依赖（关键路径）

```
1.1 → 1.2 → 1.3 → 1.4 → 1.5
                    ↓
2.1 → 2.2 → 2.3 → 2.4 → 2.5 → 2.6
                              ↓
              3.1 → 3.2 → 3.3    (并行: 3.4, 3.5)
              4.1 → 4.2 → 4.3    (可与 Epic 3 并行)
                              ↓
5.1 → 5.2    5.3 → 5.4 → 5.5
                              ↓
              6.1    6.2
```

### 数据库创建时机验证

- Story 1.4 创建三张核心表（documents、relations、sync_states）+ 迁移机制
- **评估**：架构要求 SQL 迁移机制（版本号 + 增量 SQL 脚本），所有表通过 `001-initial-schema.sql` 统一创建。这不是"提前创建所有表"的反模式——三张表是图模型的最小 schema，缺一不可。迁移机制保证后续 Story 可按需添加新迁移。
- ✅ 合理

### Greenfield 项目特定检查

- ✅ Story 1.1 为初始项目设置（从零搭建）
- ✅ Story 1.5 为 CI/CD 管道设置（早期）
- ✅ 架构决策 D1-D8 在 Epic 1 中完整落地

## Step 6: Final Assessment

### Overall Readiness Status

🟢 **READY — 实施就绪**

### 评估综合评分

| 维度 | 评分 | 说明 |
|------|------|------|
| PRD 完整性 | 98/100 | 42 FR + 19 NFR，编号连续无缺失，OQ2 待决策 |
| FR → Epic 覆盖率 | 100% | 42/42 项 FR 全部有明确的 Story 追溯 |
| PRD ↔ Architecture 对齐 | 99/100 | 上轮评估 95→修复后 99，4 项发现已全部修复 |
| Epic ↔ Architecture 对齐 | 97/100 | Epics 完整反映架构决策和约束（见下） |
| Epic 质量 | 95/100 | 1 项可接受的违规（Epic 1 技术 Epic）+ 2 项轻微关注 |
| UX 对齐 | N/A | CLI/MCP 开发者工具，无需 UX 文档 |
| **综合就绪度** | **97/100** | |

### Epics ↔ Architecture 对齐验证

| 架构要素 | Epics 落地情况 | 判定 |
|---------|-------------|------|
| D1 Zod Schema | Story 1.3 完整实现 | ✅ |
| D2 SQL 迁移机制 | Story 1.4 完整实现 | ✅ |
| D3 CordError 层级 | Story 1.2 完整实现 | ✅ |
| D4 自研 Logger | Story 1.2 完整实现 | ✅ |
| D5 目录结构 | Story 1.1 完整实现 | ✅ |
| D6 YAML+JSON 配置 | Story 2.4 完整实现 | ✅ |
| D7 GitHub Actions CI/CD | Story 1.5 完整实现 | ✅ |
| D8 覆盖率门禁 | Story 1.5 配置 | ✅ |
| IGraphRepository | Story 1.4 接口+实现 | ✅ |
| IFrameworkAdapter | Story 2.1 接口+抽象基类 | ✅ |
| BmadFrameworkAdapter | Story 2.3 完整实现 | ✅ |
| 双入口共享 Service 层 | Epic 2-4 Service → Epic 5 CLI+MCP 双入口 | ✅ |
| IIdeAdapter | Story 5.3 完整实现 | ✅ |
| 16 条实现模式 P1-P16 | 各 Story AC 中体现（命名约定、Zod 验证、CordError、测试等） | ✅ |
| NFR 架构约束 | 各 Story AC 中含具体 NFR 指标 | ✅ |
| 架构 NFR 文本残留（"20 项 NFR"） | ⚠️ 未修正 | 🟡 轻微 |

### 所有发现汇总

| # | 严重程度 | 发现 | 来源 | 建议 |
|---|---------|------|------|------|
| F1 | 🔴→✅ | 配置文件格式歧义 | 上轮评估 | ✅ 已修复（D6 双格式支持） |
| F2 | 🟡→✅ | FR31 Skills 生成器文件位置 | 上轮评估 | ✅ 已修复 |
| F3 | 🟡→✅ | FR42 docs/ 目录未展开 | 上轮评估 | ✅ 已修复 |
| F4 | 🟡 | 架构 NFR 数量文本残留"20 项" | 上轮评估 | 纯文本错误，建议修正 |
| V1 | 🔴→🟡 | Epic 1 为纯技术 Epic | 本轮审查 | Greenfield 项目合理例外，建议重命名 |
| V2 | 🟡 | Story 2.2 偏大 | 本轮审查 | 可接受，实施时按需分阶段 |
| V3 | 🟡 | Story 5.1 偏大 | 本轮审查 | 可接受，可拆为 Server 框架 + Tools 两个 Story |
| OQ2 | ⚠️ | 数据收集机制待决策 | PRD 开放问题 | 需在 v0.1 发布前决策 |

### Critical Issues Requiring Immediate Action

**无阻塞级问题。** 所有上轮发现已修复，本轮新发现均为轻微关注级别。

### Recommended Next Steps

1. **（可选）修正架构文档 NFR 数量文本**：将"20 项 NFR"改为"19 项 NFR"（~1 分钟）
2. **（可选）重命名 Epic 1**：从"项目骨架与工程基础设施"改为更强调 Outcome 的表述，如"工程就绪——开发者可开始编写功能代码"
3. **（可选）评估 Story 2.2 和 5.1 的拆分**：如果团队/个人认为这两个 Story 过大，可在 Sprint Planning 时拆分
4. **决策 OQ2**：数据收集机制（opt-in 遥测 / GitHub Discussion / npm 统计）——需在 v0.1 发布前确定
5. **🚀 开始实施**：从 Epic 1 Story 1.1 开始，按顺序执行

### Final Note

本次实施就绪评估是**第二轮完整评估**（第一轮因 Epics 未创建而跳过了 Step 3 和 Step 5）。本轮新增了：
- **FR 覆盖验证**：42 项 FR 全部追溯到具体 Story，覆盖率 100%
- **Epic 质量审查**：6 个 Epic、22 个 Story 逐一检查，发现 1 项可接受违规 + 2 项轻微关注
- **Epic ↔ Architecture 对齐**：16 项核心架构要素全部在 Epics 中有明确落地

**综合评估：CORD 项目的 PRD、架构文档和 Epics/Stories 三者之间对齐度极高（97/100），不存在阻塞级差距。项目已准备好进入实施阶段。**

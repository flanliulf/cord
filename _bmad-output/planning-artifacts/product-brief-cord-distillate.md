---
title: "Product Brief Distillate: CORD"
type: llm-distillate
source: "product-brief-cord.md"
created: "2026-04-02"
purpose: "Token-efficient context for downstream PRD creation"
---

# Product Brief Distillate: CORD

> 本文档是产品简报的补充细节包，包含所有超出执行摘要篇幅但对 PRD 创建有价值的信息。每条 bullet 都包含足够上下文可独立理解。

---

## 被否决的方案（避免 PRD 阶段重新提议）

- **Kùzu 嵌入式图数据库作为 V2 升级目标** → 已否决（ADR-04）。Kùzu 于 2025 年 10 月归档，GitHub 仓库只读，核心代码冻结于 v0.11.3。Repository Pattern 的远见价值被此事件验证——存储层解耦设计正确
- **30+ 种语义标签式关系类型**（GPT 方案） → 已否决。维护负担过重，开发者无法记住 30 种类型的区别。最终收敛为 9 种传播行为分类，每种定义"系统该做什么"而非"关系是什么"
- **5 种关系类型**（Gemini 方案） → 已否决。过于粗糙，缺少 context_for（上下文注入）、lifecycle_bound（生命周期绑定）、contains（结构包含）、deprecated（已过时）4 种核心行为
- **JSON 文件作为主存储**（Gemini MVP 建议） → 已否决。无法满足 50ms SLA 和 2000 文档 / 50000 关系规模的查询性能要求。SQLite 一跳查询 < 1ms，远超需求
- **混合存储（文档内标记 + 集中存储）作为真相源** → 已否决。确立第一性原理：集中式存储为唯一真相源，文档内轻量标记仅为辅助参考
- **prebuild-install** 作为 native addon 分发方案 → 已否决。该库已弃用（deprecated），改用 prebuildify 内嵌策略（V0.5 阶段）
- **DuckDB SQL/PGQ 作为 V2 备选**（ADR-05） → 保持开放。等待 DuckDB PGQ 成熟度或新兴嵌入式图 DB 出现后再评估

---

## 技术选型决策（11 项 TR 的 ADR 汇总）

### TR1: 存储引擎
- SQLite + better-sqlite3 v12.8.0 确认为 MVP 及中长期方案
- 核心三表数据模型：documents + relations + sync_state（图模型思维建表，节点表+边表）
- 性能基准：2000 文档 / 50000 关系规模，一跳查询 < 1ms，三跳遍历 < 5ms
- Repository Pattern（IGraphRepository 接口）隔离存储实现，保持引擎可切换

### TR2: MCP Server
- MCP TypeScript SDK v1.x（v1.29.0）+ Stdio Transport + Tools 原语优先
- 跨 IDE 兼容性已验证：Claude Code / Cursor / VS Code Copilot 均完整支持此组合
- 分层模块化架构：MCP Server 层 → Service 层 → Repository 层
- 意图驱动的 Tools 命名（analyze_impact 而非 query_edges）

### TR3: 文档解析
- remark/unified.js 确认为文档解析引擎（唯一合理选择）
- 7 维度评估：6✅ 1🟡（增量解析需自研策略）
- 9 个核心依赖 + 6 个自定义插件方案
- 增量策略：文件级重解析 + 差量入库（而非 AST diff）

### TR4: IDE Hooks
- AI IDE Hooks 能力两极分化：Claude Code 20+ 事件 vs Cursor/Copilot 无原生 Hooks
- 三层分级集成架构：MCP 通用层 → 指令引导层 → 原生 Hooks 层
- 端口-适配器模式 + 策略模式实现跨 IDE 兼容
- `npx cord init` 一键配置方案：自动检测 IDE 类型并生成对应配置

### TR5: CLI 框架
- Commander.js v14 确认（5 框架横评全面领先，~180M+ 周下载，零依赖）
- 分层 + 命令模式架构
- CLI ↔ MCP 双入口共享 Service 层，互不依赖
- 辅助工具链：@clack/prompts（交互向导）+ picocolors（终端颜色）+ tsup（构建）
- 懒加载冷启动 < 200ms

### TR6: 冷启动扫描
- 三级渐进增强架构：规则引擎（MVP）→ Embedding 增强 → LLM 辅助
- 不存在现成方案，必须自研
- remark 管道 + 策略模式 + 适配器模式
- Embedding 默认选型：Transformers.js + all-MiniLM-L6-v2（本地运行，零 API 依赖）
- 四阶段实现路线图（8-11 周总计）：Phase A 纯规则即可交付 MVP

### TR7: 全局指令文件
- "格式碎片化、语义同构化"格局确认
- 5 种 IDE 指令文件格式：CLAUDE.md / .cursor/rules/*.mdc / copilot-instructions.md / .windsurf/rules / AGENTS.md
- CordInstructionModel 统一抽象：5 共性维度 + 3 差异维度
- 适配器 + 抽象工厂模式
- 独立文件注入策略（零侵入）+ AGENTS.md 标记区块兜底
- gray-matter 为唯一新增依赖

### TR8: 可视化
- Mermaid.js v11.13.0 确认（24 种图表类型、4 种布局引擎）
- Flowchart 图表完美映射文档关系拓扑
- 「DSL 优先」策略：默认输出 Mermaid DSL 文本，零新增核心依赖
- 三层视图策略：全局鸟瞰 / 局部探查（一跳） / 路径追踪
- 四级降级策略：maxEdges=500 约束
- Builder 模式 DSL 生成器 + 三级缓存架构

### TR9: npm 分发
- 三种分发架构：prebuildify 内嵌 / platform-specific packages / 依赖上游预编译
- 渐进式演进：MVP 用模式 C（依赖上游预编译，零成本）→ V0.5 升级模式 A（prebuildify 自建）
- npm provenance 供应链安全从第一天启用
- semantic-release 自动化版本管理

### TR10: BMAD 适配
- IBmadFrameworkAdapter 继承 IFrameworkAdapter 接口
- 声明式 DocTypeDefinition 注册 18 种 BMAD 文档类型
- 5 层递进检测策略：frontmatter（95%）→ 位置（90%）→ 标题（75%）→ 结构（65%）→ 文件名（40%）
- inputDocuments frontmatter 显式关系来源（置信度 1.0）
- 5 条预设规则 × 19 关系对覆盖完整 BMAD 工作流
- 策略模式版本兼容（BmadVersionStrategy）

### TR11: Superpowers 适配
- ISuperpowersFrameworkAdapter 继承 IFrameworkAdapter
- 声明式 SuperpowersSkillDefinition 注册 14 个技能
- 三层递进检测：skills/*/SKILL.md（85%）→ package.json（99%）→ 平台目录（90%）
- dependencies frontmatter 显式依赖来源（置信度 0.95）
- 4 条预设规则 × 12 关系对覆盖 7 阶段工作流
- when_to_use 语义关键词簇分析（BMAD 所没有的独特推断维度）
- AbstractFrameworkAdapter 抽象基类催生（TR10 代码复用验证）

---

## 竞品详细对比

### 直接品类空白（无直接竞品）
- **CORD 的精确定位**（AI Coding 文档关系引擎）在市场上无对标产品
- 市场空白窗口期估计 12-18 个月

### 最近似竞品
- **Swimm**（融资 $30M）：仅处理代码↔文档关系，不处理文档↔文档；商业闭源；无 MCP；无传播行为分类体系。威胁等级：中
- **Context7**（Upstash，51.4K Stars）：解决外部第三方库文档过期问题。与 CORD 互补而非竞争——验证了开发者愿意为"AI 用过期信息"主动安装额外工具
- **Serena**（代码符号级语义导航）：聚焦代码层 LSP 集成，不涉及项目文档关系
- **Repomix**（22.9K Stars）：仓库全量打包为单文件。粗暴方式，无关系理解，context window 效率差
- **Aider repo-map**：代码级 import/call graph，不涵盖项目文档

### 间接竞争
- **Obsidian**（100 万+用户）：验证了"本地优先 + 文档图谱"有市场，但面向通用知识管理，无 AI Coding 场景优化
- **Confluence / Notion**：为人类设计，链接是扁平引用，无关系类型区分，对 AI Agent 不友好
- **原生平台方案**（CLAUDE.md / .cursorrules 等）：静态文件，无关系感知，是 CORD 的集成目标而非竞品

### 威胁评估
- **T1 最高**：AI IDE 厂商内置（概率 60%，18-36 月）→ 护城河：跨 IDE 通用性
- **T2 中**：类似定位开源项目涌现（概率 40%，12-24 月）→ 护城河：先发 + 品类定义 + 社区
- **T3 中**：Swimm 向 AI Coding 转型（概率 30%，24-36 月）→ 护城河：开源 vs 商业
- **T4 低**：LLM 能力突破使 CORD 价值降低（概率 15%，36-60 月）→ 确定性 > 推理性原理仍成立

---

## 用户画像详细数据

### 规模估算依据
- 全球开发者总量约 3000 万（GitHub / Stack Overflow 数据）
- AI 编码工具渗透率约 40-60%（JetBrains 2025 调查）
- "方法论布道者"5-20 万：基于 BMAD（43.3K Stars）+ Superpowers + GSD + OpenSpec 合计 310K+ Stars 推算活跃用户
- "效率猎手"100-200 万：基于 GitHub Copilot 1500 万用户中日均使用 4h+ 的深度用户比例推算
- "工具匠人"300-500 万：基于 GitHub 活跃开发者中开源工具链爱好者比例推算
- 置信度：中等。均为行业报告推算，非一手调研数据

### 用户决策路径
1. 意识（1-3 天）：社区发现 / 痛点触发
2. 探索（3-10 分钟）：GitHub README + Star 数 + 最近提交活跃度
3. 试用（5-30 分钟首次 + 1-7 天持续）：`npx cord init` → 冷启动扫描 → 评估
4. 验证（1-2 周）：实际项目使用 → MCP 集成 → 量化效率提升
5. 推广（2-4 周）：团队内演示 → 标准化配置

### 关键决策因素权重
- 解决痛点的有效性（35%）→ CORD ✅ 直击 P0
- 上手成本（25%）→ ⚠️ 需精心设计 cord init 首次体验
- 与现有工具兼容性（20%）→ CORD ✅ CLI + MCP + 多 IDE
- 社区活跃度信号（12%）→ ⚠️ 新项目冷启动挑战
- 架构质量（8%）→ CORD ✅ L1-L5 分层展现架构功力

---

## 需求提示（用户在会话中暗示的功能级需求）

### 已确认纳入 v0.1
- `cord init` 一键初始化（自动检测 IDE + 框架 + 配置 MCP）
- `cord query` 查询某文档的关联关系
- `cord impact` 变更影响分析
- `cord scan` 冷启动 / 增量扫描
- `cord export` JSON 快照导出（供 git 审阅）
- `cord status` 健康检查（过时关系 / 潜在不一致）
- `cord init --visualize` 生成 Mermaid DSL 快照

### 已确认推迟到 v0.5
- Mermaid 完整交互式渲染（三层视图 + 四级降级）
- RESTful API（Web UI 衍生系统接口）
- Superpowers 框架适配模块（TR11 已完成设计，代码待实现）
- Embedding 增强扫描（Transformers.js + all-MiniLM-L6-v2）

### 已确认推迟到 v1.0
- LLM 辅助关系发现
- 团队协作 / 共享图谱

### 路线图级别（长期愿景，已确认纳入）
- Schema Registry：社区提交技术栈特定的预置关系模板（`cord init --template nextjs`）
- CI/CD 守卫：GitHub Action「CORD Document Drift Detector」，PR 时自动评论受影响文档

---

## IDE 集成约束详细

| IDE | Hooks 能力 | 指令文件格式 | MCP 支持 | CORD 集成等级 |
|-----|-----------|-------------|----------|-------------|
| Claude Code | 20+ 事件（最完整） | CLAUDE.md（层级结构） | ✅ Stdio | 🥇 最优先 |
| Windsurf | 12 事件 | .windsurf/rules | ✅ Stdio | 🥈 |
| Cursor | 无原生 Hooks | .cursor/rules/*.mdc | ✅ 需手动配置 mcp.json | 🥉 指令引导层 |
| VS Code Copilot | 无原生 Hooks | copilot-instructions.md + AGENTS.md | ✅ MCP Host 官方示例 | 🥉 指令引导层 |

- Claude Code 是最优先深耕目标（Hooks 最完整，MCP 原生支持）
- Cursor 用户需手动配置 `.cursor/mcp.json`，`cord init` 应自动生成此文件
- "格式碎片化、语义同构化"：5 种 IDE 的指令文件格式不同，但语义内容高度一致——CordInstructionModel 统一抽象后适配

---

## 第一性原理（PRD 设计时的约束准则）

1. **确定性优于推理性**：LLM 必须依赖图谱保存的确定事实，而非靠推理判断关联
2. **集中式存储为唯一真相源**：文档内标记仅为辅助参考，变更操作永远依赖集中式存储
3. **一个数据源，两个消费接口**：存储层统一，LLM 走高性能按需查询通道，人类走可视化渲染通道
4. **通用协议 + 框架适配层**：核心通用，适配可插拔。独立于框架是核心能力，框架适配是扩展能力
5. **渐进式披露 + 按需加载**：精准地只给 LLM 它当下需要的那部分，两级粒度（文档级 → 章节/段落级）
6. **图模型思维建表**：即使使用 SQLite，也以图模型（节点表+边表）思维建表

---

## 开放问题（未在会话中解决）

- **关系修正闭环**：自动识别必然有误报，用户如何修正错误关系？是否需要 `cord edit` / `cord reject` 命令？（审阅者建议纳入，但用户未明确回应）
- **关系生命周期维护**：文档重命名 / 移动 / 删除后，图谱如何自动同步？需要 Git hook 还是文件监听？
- **数据收集机制**："非创始人采用案例 50+"如何验证？opt-in 遥测？GitHub Discussion 申报？npm 下载统计？
- **社区治理模型**：开源项目长期存续需要核心贡献者招募策略，当前未规划
- **团队共享图谱的技术路径**：v1.0 路线图项，但技术方案（Git 同步 SQLite？多用户并发？）未研究
- **企业级合规**：长期愿景中的"开放平台"若引入云同步或协作功能，需考虑 SOC2 / GDPR

---
created: '2026-03-31'
updated: '2026-04-02'
status: 'active'
project: 'CORD'
type: 'technical-research-roadmap'
completedCount: 11
totalCount: 11
---

# CORD 技术研究路线图

**项目：** CORD (Context-Oriented Relation for Documents)
**维护者：** Fancyliu
**创建日期：** 2026-03-31

---

## 已完成

| # | 研究主题 | 完成日期 | 关键结论 | 输出文档 |
|---|---------|---------|---------|---------|
| **TR1** | SQLite vs Kuzu 嵌入式图数据库对比评估 | 2026-03-31 | SQLite 确认为 MVP 及中长期方案；Kuzu 已归档，路径否决；Repository Pattern 价值验证 | `research/technical-sqlite-vs-kuzu-embedded-graph-db-research-2026-03-31/index.md` |
| **TR2** | MCP Server 开发实践与 TypeScript SDK 深度评估 | 2026-03-31 | v1.x SDK（v1.29.0）+ Stdio Transport + Tools 优先；跨 IDE 兼容性验证（Claude Code/Cursor/VS Code）；分层模块化架构确定 | `research/technical-mcp-server-typescript-sdk-research-2026-03-31/index.md` |
| **TR3** | Markdown AST 解析生态（remark / unified.js）技术评估 | 2026-04-01 | remark/unified.js 确认为文档解析引擎；7 维度评估（6✅ 1🟡）；9 核心依赖 + 6 自定义插件方案；增量策略：文件级重解析+差量入库 | `research/technical-markdown-ast-remark-unified-research-2026-03-31/index.md` |
| **TR4** | AI IDE Hooks 机制横向对比（Claude Code / Cursor / Copilot / Windsurf） | 2026-04-01 | AI IDE Hooks 两极分化（Claude Code 20+事件 vs Cursor/Copilot 无 Hooks）；三层分级集成架构（MCP→指令引导→原生 Hooks）；端口-适配器+策略模式实现跨 IDE 兼容；`npx cord init` 一键配置方案 | `research/technical-ai-ide-hooks-research-2026-04-01/index.md` |
| **TR5** | Node.js CLI 工具开发框架与最佳实践 | 2026-04-01 | Commander.js v14 确认为 CLI 框架（5 框架横评全面领先）；分层+命令模式架构；@clack/prompts 交互向导 + picocolors 颜色 + tsup 构建；CLI ↔ MCP 双入口共享 Service 层；懒加载冷启动 < 200ms | `research/technical-nodejs-cli-framework-research-2026-04-01/index.md` |
| **TR6** | AI 驱动的文档关系发现与冷启动扫描技术 | 2026-04-01 | 三级渐进增强架构（规则→Embedding→LLM）；remark 管道+策略模式+适配器模式；不存在现成方案必须自研；Transformers.js+all-MiniLM-L6-v2 为默认 Embedding；四阶段实现路线图（8-11 周）；Phase A 纯规则即可交付 MVP | `research/technical-ai-document-relation-discovery-cold-start-scan-research-2026-04-01/index.md` |
| **TR7** | 全局指令文件跨 IDE 兼容性研究 | 2026-04-01 | "格式碎片化、语义同构化"格局确认；CordInstructionModel 统一抽象（5 共性+3 差异维度）；适配器+抽象工厂模式；独立文件注入策略（零侵入）+ AGENTS.md 标记区块兜底；gray-matter 为唯一新增依赖；5 条 ADR 决策；12-16 天实现 | `research/technical-global-instruction-files-cross-ide-compatibility-research-2026-04-01/index.md` |
| **TR8** | Mermaid 图表渲染与文档关系可视化方案 | 2026-04-01 | Mermaid.js v11.13.0 确认为可视化引擎；Flowchart 图表完美映射文档关系；「DSL 优先」零新增核心依赖；三层视图策略（全局/局部/路径）；四级降级策略（maxEdges=500 约束）；Builder 模式 DSL 生成器；三级缓存；7 条 ADR；10-14 天实现 | `research/technical-mermaid-diagram-rendering-document-relation-visualization-research-2026-04-01/index.md` |
| **TR9** | 开源 CLI 工具的 npm 分发与跨平台兼容性 | 2026-04-01 | 三种分发架构模式对比（prebuildify/platform-specific/依赖上游）；渐进式演进策略（MVP 模式 C → V0.5 模式 A）；prebuild-install 已弃用确认；npm provenance 供应链安全；semantic-release 自动化版本管理；5 条 ADR；完整 CI/CD 工作流模板 | `research/technical-npm-distribution-cross-platform-compatibility-research-2026-04-01/index.md` |
| **TR10** | BMAD-Method 框架适配模块设计 | 2026-04-01 | IBmadFrameworkAdapter 继承 IFrameworkAdapter；声明式 DocTypeDefinition 注册 18 种文档类型；5 层递进检测（frontmatter→位置→标题→结构→文件名）；inputDocuments 显式关系（置信度 1.0）；5 条预设规则 × 19 关系对；策略模式版本兼容；两阶段交付（6-9 天）；5 条 ADR | `research/technical-bmad-method-framework-adapter-module-design-research-2026-04-01/index.md` |
| **TR11** | Superpowers 框架适配模块设计 | 2026-04-02 | ISuperpowersFrameworkAdapter 继承 IFrameworkAdapter；声明式 SuperpowersSkillDefinition 注册 14 个技能；三层递进检测（skills/→package.json→平台目录）；dependencies 显式依赖（置信度 0.95）；4 条预设规则 × 12 关系对；when_to_use 语义关键词簇分析；AbstractFrameworkAdapter 基类抽取；单阶段交付（4-6 天）；5 条 ADR | `research/technical-superpowers-framework-adapter-module-design-research-2026-04-02/index.md` |

---

## 待研究

🎉 **全部 11 项技术研究已完成！**

---

## 推荐研究顺序

### 优先批 — 影响 MVP Phase 1-3

```
TR2 (MCP Server) ✅  ←→  TR3 (Markdown 解析) ✅   ← 已完成
         ↓
TR5 (CLI 框架) ✅                                  ← 已完成
```

- **TR2 + TR3 + TR5** 全部完成
- 优先批研究全部完成，MVP Phase 1-3 技术选型已就绪
- **TR5** 产出：Commander.js v14 + 分层架构 + 双入口模式 + 完整技术栈

### 第二批 — 影响 MVP Phase 4-5

```
TR4 (IDE Hooks) ✅  ←→  TR6 (冷启动扫描) ✅   ← 全部完成
        ↓
TR5 (CLI 框架) ✅  ──→  TR6 需要 cord scan 命令设计（已由 TR5 产出）✅
```

- **TR4 + TR5 + TR6** ✅ 全部完成
- 第二批研究全部完成，MVP Phase 4-5 技术路径已就绪
- **TR6** 产出：三级渐进增强架构 + 管道模式 + 策略模式 + 适配器模式 + 四阶段实现路线图

### 第三批 — 影响 V1.0 扩展

```
TR7 (全局指令兼容) ✅  →  TR8 (Mermaid 可视化) ✅   ← 全部完成
```

- **TR7 + TR8** ✅ 全部完成
- 第三批研究全部完成，V1.0 可视化层技术路径已就绪
- **TR8** 产出：Mermaid.js v11.13.0 确认 + 三层视图策略 + 四级降级策略 + Builder 模式 + 三级缓存 + 7 条 ADR + 10-14 天实现路线图

### 按需研究

```
TR9  (npm 分发) ✅  —— 已完成
TR10 (BMAD 适配) ✅ —— 已完成
TR11 (Superpowers 适配) ✅ —— 已完成
```

---

## 研究依赖关系图

```
TR1 ✅ (SQLite 选型)
 │
 ├──→ TR2 ✅ (MCP Server)  ──→ TR5 ✅ (CLI 框架)
 │         ↓
 │    TR3 ✅ (Markdown 解析) ──→ TR6 ✅ (冷启动扫描)
 │
 ├──→ TR4 ✅ (IDE Hooks) ──→ TR7 ✅ (全局指令兼容)
 │                              ↓
 │                         TR8 ✅ (Mermaid 可视化)
 │
 ├──→ TR9 ✅ (npm 分发)     ← 已完成
 ├──→ TR10 ✅ (BMAD 适配)  ← 已完成
 └──→ TR11 ✅ (Superpowers 适配)  ← 已完成（依赖 TR10 参考实现）
```

---

## 更新记录

| 日期 | 变更内容 |
|------|---------|
| 2026-03-31 | 初始创建；TR1 完成，9 项待研究 TR 规划完成 |
| 2026-03-31 | TR2 完成；MCP Server 技术选型确定（v1.x SDK + Stdio + Tools 优先） |
| 2026-04-01 | TR3 完成；remark/unified.js 确认为文档解析引擎（7 维度评估：6✅ 1🟡） |
| 2026-04-01 | TR4 完成；AI IDE Hooks 两极分化确认；三层分级集成架构 + 端口-适配器模式 + `npx cord init` 一键配置方案 |
| 2026-04-01 | TR5 完成；Commander.js v14 确认为 CLI 框架（5 框架横评全面领先）；分层+命令模式架构；@clack/prompts + picocolors + tsup 技术栈；CLI ↔ MCP 双入口共享 Service 层 |
| 2026-04-01 | TR6 完成；三级渐进增强架构确认（规则→Embedding→LLM）；不存在现成方案必须自研；remark 管道+策略模式+适配器模式；Transformers.js+all-MiniLM-L6-v2 默认 Embedding；四阶段实现路线图（8-11 周）；第二批研究全部完成 |
| 2026-04-01 | TR7 完成；"格式碎片化、语义同构化"格局确认；CordInstructionModel 统一抽象（5 共性+3 差异维度）；适配器+抽象工厂模式；独立文件注入策略+AGENTS.md 标记区块兜底；gray-matter 唯一新增依赖；5 条 ADR；12-16 天实现；第三批 TR7 完成 |
| 2026-04-01 | TR8 完成；Mermaid.js v11.13.0 确认为可视化引擎（24 种图表类型、4 种布局引擎）；Flowchart 完美映射文档关系拓扑；「DSL 优先」零新增核心依赖策略；三层视图策略引擎（全局/局部/路径）；四级降级策略（maxEdges=500 约束）；Builder 模式 DSL 生成器；三级缓存架构；7 条 ADR；10-14 天实现路线图；第三批研究全部完成 |
| 2026-04-01 | TR9 完成；三种分发架构模式对比（prebuildify 内嵌/platform-specific packages/依赖上游预编译）；渐进式演进策略（MVP 模式 C → V0.5 模式 A）；prebuild-install 已弃用确认；npm provenance 供应链安全从第一天启用；semantic-release 自动化版本管理；5 条 ADR 决策记录；完整 CI/CD 工作流模板（含 6 平台 matrix build + artifacts 汇聚）；9/10 研究完成 |
| 2026-04-01 | 🎉 TR10 完成 — **全部 10/10 技术研究完成！** IBmadFrameworkAdapter 继承 IFrameworkAdapter 接口设计；声明式 DocTypeDefinition 注册 18 种 BMAD 文档类型；5 层递进检测策略（frontmatter 95%→位置 90%→标题 75%→结构 65%→文件名 40%）；inputDocuments frontmatter 显式关系来源（置信度 1.0）；5 条预设规则 × 19 关系对覆盖完整 BMAD 工作流；策略模式版本兼容（BmadVersionStrategy）；两阶段嵌入 TR6 冷启动扫描器交付（6-9 天）；5 条 ADR 决策记录；CORD 技术研究阶段圆满收官 |
| 2026-04-02 | 🎉 TR11 完成 — **全部 11/11 技术研究完成！** ISuperpowersFrameworkAdapter 继承 IFrameworkAdapter 接口设计；声明式 SuperpowersSkillDefinition 注册 14 个 Superpowers 技能；三层递进检测策略（skills/*/SKILL.md 85%→package.json 99%→平台目录 90%）；dependencies frontmatter 显式依赖来源（置信度 0.95）；4 条预设规则 × 12 关系对覆盖 7 阶段工作流；when_to_use 语义关键词簇分析（BMAD 所没有的独特推断维度）；AbstractFrameworkAdapter 抽象基类催生（TR10 代码复用）；单阶段交付（4-6 天）；5 条 ADR 决策记录；CORD 框架适配层双范式验证完成（文档驱动 TR10 + 技能驱动 TR11）|

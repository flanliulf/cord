# Research Synthesis（研究综合）

## Executive Summary（执行摘要）

本研究对 CORD 冷启动扫描器的核心技术——**AI 驱动的文档关系发现**进行了全面、系统的技术分析。经过 6 步研究工作流（范围确认 → 技术栈分析 → 集成模式 → 架构模式 → 实现方案 → 综合总结）和 40+ 次 Web 搜索验证，得出以下核心结论：

**1. 不存在现成解决方案——CORD 必须自研**

经过对 remark 生态、知识图谱框架（GraphRAG）、知识管理工具（Obsidian/Logseq）的全面调研，确认没有任何现成工具能直接满足 CORD「从 Markdown 文档中自动发现 9 种语义关系类型 + 置信度评分 + 用户反馈回路」的完整需求。remark-validate-links 仅做链接验证；GraphRAG 依赖云端 LLM 且成本过高；Obsidian 的反向链接引擎不可复用。CORD 需要在 remark/unified.js 管道之上构建专属的关系发现引擎。

**2. 三级渐进增强架构已完整定义**

```
Level 1（规则）→ Level 2（Embedding）→ Level 3（LLM）
零依赖即可用      本地推理增强            云端/本地可选智能增强
```

- **Level 1**：8 类内置规则（链接/frontmatter/目录/命名/代码块/框架），Precision ≥ 0.90，零外部依赖
- **Level 2**：Transformers.js + all-MiniLM-L6-v2（22MB），余弦相似度发现隐含关系，F1 ≥ 0.80
- **Level 3**：云端 LLM（GPT-4o-mini / Claude 3.5 Haiku）或本地 Ollama，结构化输出，F1 ≥ 0.87

**3. 核心架构决策确认**

| 决策 | 选定方案 | 关键理由 |
|------|---------|---------|
| 整体架构 | 五层分层 + 双入口共享 Service 层 | TR5 已确认，CLI ↔ MCP 一致性 |
| 解析子系统 | unified.js 管道 + 6 级串联插件 | TR3 已确认，可组合可测试 |
| 关系发现 | 策略模式 + 渐进增强编排器 | 运行时动态选择，叠加式增强 |
| Embedding 抽象 | IEmbeddingProvider 策略接口 | Transformers.js / Ollama / OpenAI 三级 Provider |
| 规则引擎 | 注册-执行模式 + IRelationRule 接口 | 内置 8 类规则 + 用户自定义扩展 |
| 框架适配 | IFrameworkAdapter + 自动检测注册表 | BMAD-Method 为首个参考实现 |
| 扫描流程 | 六阶段状态机 | 清晰分阶段，支持进度报告 |
| 数据模型 | SQLite 邻接表 + 三表设计 | TR1 已确认，性能充足 |
| 置信度系统 | 加权聚合 + 用户绝对覆盖 | 多源融合，用户最终决策权 |

**4. 四阶段实现路线图**

- **Phase A（2-3 周）**：规则引擎核心 + 全量扫描 + 5 条规则 + SQLite 入库
- **Phase B（1-2 周）**：增量扫描 + chokidar 监控 + CLI 完善
- **Phase C（2-3 周）**：Embedding 集成 + 策略模式 + 相似度阈值调参
- **Phase D（2-3 周）**：LLM 集成 + 置信度聚合 + cord review + BMAD 适配器

## Key Technical Findings（关键技术发现）

### 发现 1：remark 生态空白确认，自研路径明确

- `remark-validate-links`（v13）—— 仅验证链接有效性，不做关系提取和分类
- `remark-wiki-link`（v1.0+）—— `[[wiki-link]]` AST 节点设计可借鉴（`data.exists` 布尔标记模式）
- 不存在任何 remark 插件实现「反向链接分析」「关系类型分类」「置信度评分」
- CORD 需新增 `cord-relation-analyzer` 插件（第 6 级管道节点）

### 发现 2：本地 Embedding 推理技术已成熟

- **Transformers.js v3** 支持 100+ 模型架构，纯 JS + ONNX Runtime，Node.js 原生运行
- **all-MiniLM-L6-v2**（22MB/384 维）作为 MVP 默认——轻量、快速、离线可用
- **nomic-embed-text-v1.5**（274MB/768 维）通过 Ollama 提供更高精度选项
- q8 量化 + 懒加载模式可将首次推理延迟控制在 <5s

### 发现 3：GraphRAG 思路可借鉴但实现路径不适合

- Microsoft GraphRAG 使用 GPT-4 级 LLM 进行实体/关系/社区检测——成本过高
- 其「分层社区检测」思路有价值——CORD 可用纯规则实现（目录结构 + 命名模式 → 文档社区）
- CORD 的 Local-First + Node.js 约束排除了 Python + 云端 LLM 的技术路径

### 发现 4：增量扫描可实现 25-62x 加速

- mtime + content_hash 双重检查策略
- 1000 文档改 10 个：全量 ~50s vs 增量 ~800ms = **62x 加速**
- MCP Server 常驻模式通过 chokidar v4 实现实时事件驱动更新

### 发现 5：置信度系统设计完成

- 四源加权聚合：rule(1.0) > llm(0.8) > embedding(0.6) > user(∞ 覆盖)
- 用户反馈具有绝对覆盖权——`cord review` + `cord_confirm_relation` 双通道

## Strategic Recommendations（战略建议）

### 建议 1：Phase A 优先——纯规则引擎即可交付 MVP 价值

Level 1 纯规则方案（零外部依赖）已能覆盖 ~70% 的显式文档关系：

- Markdown 正向/反向链接（100% 置信度）
- Frontmatter 显式声明（100% 置信度）
- 目录结构推断（80% 置信度）
- 命名层级模式（70% 置信度）

**建议在 2-3 周内完成 Phase A 并交付 MVP，收集真实用户反馈后再决定 Phase C/D 的投入力度。**

### 建议 2：Embedding 作为「高价值可选增强」而非必需

Phase C 的 Embedding 集成是**可选增强**——它能发现规则无法捕获的隐含语义关系（如两篇无直接链接但讨论同一架构决策的文档），但：

- 需要首次下载 22MB 模型
- 增加 ~10s 扫描延迟
- 相似度阈值需要调参

**建议设立评估关卡：F1 < 0.7 则将 Embedding 降级为实验性功能。**

### 建议 3：LLM 集成保持轻量——成本可控

Level 3 LLM 方案的关键设计原则已确定：

- **数据最小化**：仅发送标题+章节+frontmatter，不暴露全文
- **渐进调用**：仅对 Level 1+2 无法判定的低置信度对使用 LLM
- **成本可控**：大型项目（1000 docs）单次扫描 < $0.01

**建议 Phase D 最后实现，且作为完全可选功能。**

### 建议 4：BMAD-Method 适配器作为框架适配层的参考实现

BMAD-Method 的文档产出链（Product Brief → PRD → Epics → Stories）是理想的首个适配器：

- 检测逻辑简单（`_bmad/` 目录存在）
- 关系模式明确（derived_from / lifecycle_bound / contains）
- 可直接用 CORD 自身项目作为测试场景

**建议 Phase A 即包含 BMAD 适配器基础版，Phase D 完善。**

### 建议 5：`cord.config.ts` 声明式配置为扩展性基础

用户自定义规则通过配置文件注入，而非代码修改：

```typescript
// cord.config.ts
export default {
  rules: [{ id: 'my-rule', pattern: /.../, relationType: '...' }],
  frameworks: ['bmad-method'],
  scan: { defaultLevel: 'rules', include: ['docs/**/*.md'] }
};
```

**建议 Phase B 实现配置文件加载，为后续扩展奠定基础。**

## Future Outlook（未来展望）

### 近期（1-2 个季度）

- Phase A-B 完成，纯规则 + 增量扫描可用
- BMAD-Method 适配器作为参考实现
- CLI `cord scan` + MCP Tool `cord_scan` 双入口就绪

### 中期（3-4 个季度）

- Phase C-D 完成，三级渐进增强完整可用
- 更多框架适配器（React/Vue/Spring Boot）
- SQLite FTS5 关键词共现分析
- `cord review` 交互式反馈回路成熟

### 长期（V2.0+）

- sqlite-vec 向量扩展集成——Embedding 直接存储在 SQLite
- 跨项目关系发现——多 CORD 数据库联邦查询
- 实时协作关系编辑——多人同时标注关系
- AI IDE 深度集成——编辑文档时实时提示关系变更影响

## Research Methodology（研究方法论）

**研究框架**：6 步技术研究工作流（scope → tech stack → integration → architecture → implementation → synthesis）

**数据来源**：
- 40+ 次 Web 搜索验证（npm 包、GitHub 仓库、官方文档、API 参考）
- 5 项前序技术研究（TR1-TR5）的完整技术上下文
- 官方文档直接获取（remark-validate-links、remark-wiki-link、Transformers.js、Ollama API、unist-util-visit）

**置信度框架**：
- **HIGH**：官方文档/代码验证、多源一致、成熟技术
- **MEDIUM-HIGH**：可靠来源推导、社区广泛实践
- **MEDIUM**：设计预期值、需实测验证、估算数据

**关键源引用**：
- [remark-validate-links](https://github.com/remarkjs/remark-validate-links) — 链接验证插件 API
- [remark-wiki-link](https://github.com/landakram/remark-wiki-link) — Wiki 链接语法支持
- [unist-util-visit](https://github.com/syntax-tree/unist-util-visit) — AST 遍历 API
- [Transformers.js](https://huggingface.co/docs/transformers.js) — 本地 ML 推理引擎
- [Ollama API](https://github.com/ollama/ollama/blob/main/docs/api.md) — 本地 LLM 运行时
- [Microsoft GraphRAG](https://github.com/microsoft/graphrag) — 知识图谱构建参考
- [unified.js](https://github.com/unifiedjs/unified) — 管道架构规范

## Research Completion（研究完成）

**研究结论**：CORD 冷启动扫描器的技术路径已完整定义——以 remark/unified.js 管道为解析基础，以可插拔规则引擎为核心，以策略模式封装三级 Embedding/LLM 提供者，以适配器模式支持多框架识别。四阶段实现路线图可在 8-11 周内完成全部交付，其中 Phase A（2-3 周）即可交付 MVP 级别的规则扫描功能。

**与 CORD 整体架构的关系**：本研究产出直接对应 CORD MVP Phase 4（冷启动扫描）和 Phase 5（智能增强），是 TR1-TR5 技术选型在「关系发现」核心功能上的完整落地方案。

---

**TR6 技术研究完成日期：** 2026-04-01
**研究周期：** 2026-04-01（单日全面研究）
**文档总长度：** 全面覆盖，含 7 个主要章节 + 执行摘要 + 战略建议
**来源验证：** 所有技术事实均经 Web 搜索验证，标注置信度
**整体置信度：** HIGH — 基于前序 5 项研究 + 40+ 次 Web 搜索多源验证

_本研究报告作为 CORD 冷启动扫描器开发的权威技术参考，为架构设计和实现决策提供全面依据。_

# Research Overview

本研究是 CORD (Context-Oriented Relation for Documents) 项目技术研究路线图中的第 8 项（TR8），聚焦于**文档关系图的可视化技术选型与架构设计**。研究覆盖了 Mermaid.js v11.13.0 的 24 种图表类型在文档关系场景的适用性评估、4 种布局引擎（dagre/elk/cose-bilkent/tidy-tree）的选型对比、4 种竞品方案（Graphviz/Cytoscape.js/D3.js）的横向评估，以及与 CORD 已有 7 项前置研究（TR1-TR7）的完整集成设计。

核心结论：**Mermaid.js 确认为 CORD 首选可视化引擎**，采用「DSL 优先」策略——默认输出 Mermaid DSL 文本（零新增依赖），SVG/PNG 渲染通过 `@mermaid-js/mermaid-cli` 作为可选功能。研究产出了三层视图策略引擎（全局/局部/路径）、四级大规模图降级策略、Builder 模式 DSL 生成器、三级缓存架构等完整的架构设计方案，以及 4 阶段共 10-14 天的实现路线图。完整的 Executive Summary 和战略建议请参见本文档末尾的 [研究综合与结论](#研究综合与结论) 章节。

---

<!-- Content will be appended sequentially through research workflow steps -->

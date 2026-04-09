# Research Overview

本研究报告是 CORD（Context-Oriented Relation for Documents）项目的第 6 项技术研究（TR6），聚焦 **AI 驱动的文档关系发现与冷启动扫描技术**。研究覆盖三大核心方向：基于规则的关系发现（Markdown 链接/引用/frontmatter/目录结构/命名模式）、LLM/Embedding 辅助的语义关系发现（本地推理 vs 云端 API 的三级渐进方案）、以及框架文档结构识别（BMAD-Method 适配器为参考实现）。

研究基于 CORD 前序 5 项技术研究（TR1-TR5）已确认的技术栈约束（SQLite + remark/unified.js + Commander.js + MCP TypeScript SDK），通过 6 步系统化工作流完成。核心结论为：**CORD 冷启动扫描器采用「纯规则为基础 + Embedding 增强 + LLM 可选」的三级渐进架构，通过管道模式（unified.js）+ 策略模式（Provider 抽象）+ 适配器模式（框架识别）实现。** 不存在现成工具可直接满足 CORD 需求，必须自研。

完整执行摘要和战略建议请参见文末 **Research Synthesis** 章节。

---

<!-- Content will be appended sequentially through research workflow steps -->

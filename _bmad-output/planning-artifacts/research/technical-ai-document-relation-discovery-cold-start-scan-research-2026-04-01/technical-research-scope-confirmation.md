# Technical Research Scope Confirmation

**Research Topic:** AI 驱动的文档关系发现与冷启动扫描技术
**Research Goals:** 从现有文档中自动发现和建立关系（基于规则 vs LLM 辅助）、框架文档结构识别；为 CORD 冷启动扫描器提供技术路径选型和架构设计

**Technical Research Scope:**

- 基于规则的关系发现 — Markdown 链接/引用分析、frontmatter 显式声明、目录结构推断、文件命名模式匹配、代码块文件引用识别
- LLM 辅助的关系发现 — 本地 LLM vs 云端 LLM vs 无 LLM 三级方案对比、语义相似性分析、隐含关系推断、Embedding 向量相似度 vs 全文 LLM 分析
- 框架文档结构识别 — BMAD-Method 文档产出链、通用项目文档结构模式、预设关系规则引擎设计
- 冷启动扫描器架构设计 — `cord scan` 完整技术架构、性能优化、增量/全量策略
- 置信度与反馈机制 — 扫描结果置信度评分、用户校正反馈循环

**Research Methodology:**

- Current web data with rigorous source verification
- Multi-source validation for critical technical claims
- Confidence level framework for uncertain information
- Comprehensive technical coverage with architecture-specific insights

**Scope Confirmed:** 2026-04-01

---

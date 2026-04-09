# Technical Research Scope Confirmation

**Research Topic:** Superpowers 框架适配模块设计
**Research Goals:** SuperpowersFrameworkAdapter 接口实现规格、SKILL.md 元数据解析与技能类型识别、7 阶段工作流关系推断规则设计、多平台安装目录检测策略、作为 core + adapters 模式的第二个参考实现（与 TR10 BMAD 适配器形成对比）

**Technical Research Scope:**

- Architecture Analysis — Superpowers 7 阶段技能工作流拓扑、`IFrameworkAdapter` 接口 Superpowers 参考实现规格、多平台适配器注册与自动检测机制
- Implementation Approaches — SKILL.md 技能类型识别（元数据解析/检测签名）、`when_to_use` 驱动的关系推断规则、`dependencies` 字段的显式依赖提取
- Technology Stack — Superpowers 目录结构解析、SKILL.md frontmatter 元数据规范、多平台安装差异（Claude Code / Cursor / Codex / OpenCode / Gemini）
- Integration Patterns — 与 TR6 remark 管道集成、与 `RelationDiscoveryService` 协作接口、`FrameworkRegistry` 注册机制、与 BMAD 适配器（TR10）的对比与共存
- Performance Considerations — 技能检测效率、`when_to_use` 语义分析策略、增量扫描下的适配器缓存策略

**Research Methodology:**

- Current web data with rigorous source verification
- Multi-source validation for critical technical claims
- Confidence level framework for uncertain information
- Comprehensive technical coverage with architecture-specific insights
- TR10 BMAD 适配器作为对比参考基线

**Scope Confirmed:** 2026-04-02

---

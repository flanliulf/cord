# Research Overview

本研究针对 CORD（Context-Oriented Relation for Documents）项目的文档解析引擎进行技术选型评估，聚焦 remark / unified.js 生态在 7 个关键维度的能力表现：frontmatter 解析、章节/段落级锚点提取、增量解析能力、非标准 Markdown 容错性、性能基准、TypeScript 类型支持和自定义插件开发体验。同时简要对比 markdown-it 和 marked 作为备选参考。

研究采用实时网络数据 + 多源交叉验证方法论，覆盖了 unified.js 官方文档、GitHub 仓库、npm 注册表、CommonMark 规范等权威来源。**核心结论：remark/unified.js 是 CORD 文档解析引擎的唯一合理选择**，7 个维度中 6 个完全满足，1 个（增量解析）有成熟的替代策略。完整的依赖清单、实现代码和风险评估详见后续章节。

---

<!-- Content will be appended sequentially through research workflow steps -->

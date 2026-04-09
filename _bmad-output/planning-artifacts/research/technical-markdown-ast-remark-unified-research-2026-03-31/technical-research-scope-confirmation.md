# Technical Research Scope Confirmation

**Research Topic:** Markdown AST 解析生态（remark / unified.js）技术评估
**Research Goals:** frontmatter 解析、章节/段落级锚点提取、增量解析能力、非标准 Markdown 容错性、性能基准测试、TypeScript 类型支持、自定义插件开发体验；以 remark/unified.js 为主，简要对比替代方案

**Technical Research Scope:**

- Frontmatter 解析 — YAML frontmatter 提取、解析与类型安全处理
- 章节/段落级锚点提取 — Heading 层级、段落定位、AST 节点精准定位能力
- 增量解析能力 — 文件变更时的增量更新策略
- 非标准 Markdown 容错性 — GFM 扩展、自定义指令、各 IDE/框架特有语法兼容
- 性能基准测试 — 大文件场景下的解析速度与内存占用
- TypeScript 类型支持 — AST 节点类型定义质量、泛型支持、IDE 推断体验
- 自定义插件开发体验 — 编写 CORD 场景专用 remark 插件的 DX 评估
- 替代方案简要对比 — markdown-it、marked 等方案作为备选参考

**Research Methodology:**

- Current web data with rigorous source verification
- Multi-source validation for critical technical claims
- Confidence level framework for uncertain information
- Comprehensive technical coverage with architecture-specific insights

**Scope Confirmed:** 2026-03-31

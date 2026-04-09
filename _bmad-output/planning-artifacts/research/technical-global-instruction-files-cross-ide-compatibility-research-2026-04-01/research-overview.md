# Research Overview

本研究针对 CORD 项目跨 IDE 适配层的核心技术问题——各主流 AI IDE 的全局指令文件体系进行了全面深度对比与抽象建模。研究覆盖了 Claude Code（CLAUDE.md + .claude/rules/）、Cursor（.cursor/rules/ .mdc/.md）、GitHub Copilot（.github/copilot-instructions.md + .github/instructions/）、Windsurf（.windsurf/rules/）、Gemini CLI（GEMINI.md）五大 AI IDE 的指令文件格式、Frontmatter 规格、作用域模型、优先级继承规则，以及 AGENTS.md 开放标准的成熟度评估。

核心结论：**AI IDE 指令文件体系呈现"格式碎片化、语义同构化"格局**——所有 IDE 都采用 Markdown + 可选 YAML Frontmatter 作为基础格式，都支持项目/用户/全局三层作用域和 Glob 文件匹配，但 Frontmatter 字段命名、触发模式语义、目录约定各不相同。基于此，CORD 应采用 **统一内部表示（CordInstructionModel）+ 适配器模式格式转换** 架构，配合 **独立文件注入策略**（零侵入）和 **AGENTS.md 标记区块兜底**，通过 `npx cord init` 一键为检测到的 IDE 生成对应格式的指令文件。完整的抽象模型、架构设计、实现方案和 5 条 ADR 决策见下方各章节。

---

<!-- Content will be appended sequentially through research workflow steps -->

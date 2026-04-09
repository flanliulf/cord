# Research Overview

本研究报告是 CORD（Context-Oriented Relation for Documents）项目的第 11 项技术研究（TR11），聚焦 **Superpowers 框架适配模块设计**。研究以 Superpowers v5.0.7（github.com/obra/superpowers）为实证样本，通过 6 步系统化工作流完成。

Superpowers 是一个由 Jesse Vincent（GitHub: obra）创建的 **AI 编码代理技能框架**，与 BMAD-Method（TR10）形成鲜明对比：BMAD 是**文档驱动**（18 种文档类型、4 阶段工作流），而 Superpowers 是**技能驱动**（14 个核心技能、7 阶段顺序工作流）。CORD 适配器层（`IFrameworkAdapter`）需要处理这两种截然不同的范式。

核心结论为：**Superpowers 是 CORD 框架适配层的理想第二参考实现**——其 SKILL.md 元数据标准（`name`、`description`、`when_to_use`、`version`、`dependencies` 字段）提供了可解析的技能依赖信号，其 7 阶段顺序工作流（Brainstorming → Git Worktrees → Planning → Subagent Dev → TDD → Code Review → Branch Completion）形成了清晰的文件使用关系拓扑。适配器采用轻量检测（`.claude-plugin/` 目录 + `skills/` 子目录）+ SKILL.md 依赖图提取 + `when_to_use` 语义分析的架构，总工作量 4-6 天，嵌入 TR6 冷启动扫描器的 Phase A 或 Phase D 交付。

完整执行摘要和战略建议请参见文末 **Research Synthesis** 章节。

---

<!-- Content will be appended sequentially through research workflow steps -->

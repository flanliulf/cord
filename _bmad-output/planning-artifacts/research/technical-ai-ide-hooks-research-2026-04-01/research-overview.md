# Research Overview

本研究针对 CORD 项目触发层的核心技术问题——各主流 AI IDE 的 Hooks/自动化机制进行了全面横向对比评估。研究覆盖了 Claude Code、Cursor、GitHub Copilot 和 Windsurf 四大 AI IDE 的事件钩子体系、配置方式、触发类型、数据交换协议和企业部署能力，并深入分析了 CORD 如何基于各 IDE 的能力差异设计分级集成架构和优雅降级策略。

核心结论：**AI IDE 的 Hooks 能力呈现"两极分化"格局**——Claude Code（20+ 事件、4 种处理器）和 Windsurf（12 事件、Shell 命令）具备完整的原生事件钩子，可实现零用户感知的自动触发；而 Cursor 和 GitHub Copilot 仅具备声明式指令/规则体系，无法在操作前后执行外部命令。基于此，CORD 应采用 **三层分级集成架构**（MCP 通用层 → 指令引导层 → 原生 Hooks 层），配合端口-适配器模式实现跨 IDE 兼容，并通过策略模式实现一键初始化（`npx cord init`）。完整的架构设计、实现方案和风险评估见下方各章节。

---

<!-- Content will be appended sequentially through research workflow steps -->

# Research Overview

本研究围绕 CORD 项目（一个包含原生 C++ 绑定 better-sqlite3 的 TypeScript CLI 工具 + MCP Server）的 npm 发布策略，系统性地调研了原生 Node.js 模块的跨平台预编译分发方案、npm/npx 安装体验优化、GitHub Actions CI 矩阵配置以及开源 CLI 发布最佳实践。

研究覆盖了 prebuildify / prebuild-install / node-pre-gyp 三大传统预编译工具链的完整对比，以及 esbuild / Rollup / SWC / NAPI-RS 为代表的 Platform-Specific Optional Dependencies 新兴分发模式。通过对 better-sqlite3 实际 CI 工作流、npm provenance 供应链安全机制、semantic-release 自动化版本管理等的深入分析，产出了一套从 MVP 零成本起步到 V1.0 完整平台覆盖的渐进式发布架构演进方案。

**核心结论：** MVP 阶段推荐**模式 C（依赖上游预编译）**零成本起步；V0.5 阶段推荐**模式 A（prebuildify 内嵌单包）**自建预编译流水线。完整的执行摘要和 ADR 决策记录请见文末「研究综合与战略建议」章节。

---

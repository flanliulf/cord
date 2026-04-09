# Technical Research Scope Confirmation

**Research Topic:** 开源 CLI 工具的 npm 分发与跨平台兼容性
**Research Goals:** 研究原生 C++ 绑定（better-sqlite3）的跨平台预编译、npm/npx 安装体验、CI 矩阵配置，为 CORD 项目的发布策略提供技术决策依据

**Technical Research Scope:**

- 原生模块分发策略 — prebuild/prebuildify/node-pre-gyp 预编译方案、platform-specific optional dependencies 模式
- npm/npx 安装体验 — CLI 工具全局安装与 npx 执行体验、bin 字段配置、安装失败降级策略
- 跨平台兼容性矩阵 — macOS/Linux/Windows 多架构覆盖（x64/arm64/musl）
- CI/CD 构建矩阵 — GitHub Actions 多平台构建、预编译产物管理、npm publish 自动化
- 开源 CLI 发布最佳实践 — 版本管理、发布流程、npm registry 配置

**Research Methodology:**

- Current web data with rigorous source verification
- Multi-source validation for critical technical claims
- Confidence level framework for uncertain information
- Comprehensive technical coverage with architecture-specific insights

**Scope Confirmed:** 2026-04-01

---

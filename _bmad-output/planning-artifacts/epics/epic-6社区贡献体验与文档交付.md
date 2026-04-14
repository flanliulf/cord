# Epic 6：社区贡献体验与文档交付

社区开发者可以基于完整的 IFrameworkAdapter 接口文档、BMAD 参考实现、集成测试模板和 PR 规范，在 4 小时内完成最小可用的框架适配模块。最终用户通过 README、快速开始指南、CLI/MCP/配置参考等完整文档获得自助式上手体验。

## Story 6.1：框架适配贡献者文档

As a 社区开发者，
I want 完整的框架适配开发者指南，
So that 我可以在 4 小时内为自己使用的框架编写最小可用的 CORD 适配模块。

**Acceptance Criteria:**

**Given** Epic 2 的框架适配层已实现并稳定
**When** 编写贡献者文档
**Then** `docs/adapter-guide.md` 包含 IFrameworkAdapter 接口 API 完整说明（FR42）
**And** 包含最小适配模块开发教程（含代码示例——从零创建一个适配器的步骤）
**And** 包含集成测试编写指南（含测试模板）
**And** `docs/contributing.md` 包含 PR 提交规范和审阅流程说明（FR42）
**And** BMAD 适配模块作为可运行的参考实现，含源码注释（FR37）
**And** 非核心开发者可在 4 小时内完成最小可用适配模块（含文档类型注册 + 1 条预设规则 + 通过集成测试）（FR37 验收标准 d）
**And** 新增适配模块时核心模块单元测试通过率保持 100%，无需修改核心模块源码（NFR8）

## Story 6.2：用户文档与 README

As a 新用户，
I want 完整的用户文档，
So that 我可以通过自助式阅读快速上手 CORD，从安装到首次影响分析 < 5 分钟阅读。

**Acceptance Criteria:**

**Given** 所有功能 Epic 已完成
**When** 编写用户文档
**Then** `README.md` 包含项目介绍、核心概念（"确定性优于推理性"）、快速开始链接、安装指南、Star 徽章
**And** `docs/getting-started.md` 包含从安装到首次影响分析触发的完整流程（< 5 分钟阅读）
**And** `docs/cli-reference.md` 包含每个 CLI 命令的用法、参数、选项、示例输出
**And** `docs/mcp-tools-reference.md` 包含每个 MCP Tool 的输入/输出 schema、使用场景、调用示例
**And** `docs/configuration.md` 包含 cord.config 配置项说明、IDE 配置文件模板、框架适配配置
**And** 所有文档使用中文编写（document_output_language: Mandarin）

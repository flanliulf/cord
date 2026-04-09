# Technical Research Recommendations

## 实现路线图推荐

| 阶段 | 产出 | 依赖 | 工时 |
|------|------|------|------|
| **Phase 2A** | IR 模型 + gray-matter 集成 + Factory | TR5 项目骨架 | 3-4 天 |
| **Phase 2B** | 5 个 Formatter + 单元/快照测试 | Phase 2A | 4-5 天 |
| **Phase 2C** | cord init 指令层 + IDE 检测 + 交互流程 | Phase 2B + TR5 CLI | 3-4 天 |
| **Phase 2D** | 指令模板 + i18n + 文档 | Phase 2C | 2-3 天 |

## 技术栈推荐

| 组件 | 技术选择 | 来源 |
|------|----------|------|
| Frontmatter 解析 | gray-matter ^4.x | TR7 本研究 |
| CLI 框架 | Commander.js v14 | TR5 |
| 交互式提示 | @clack/prompts | TR5 |
| 测试框架 | Vitest + snapshot | TR5 / TR7 |
| 构建工具 | tsup | TR5 |

## 技能发展要求

| 技能 | 深度 | 用途 |
|------|------|------|
| **gray-matter API** | 中等 | Frontmatter 解析/生成 |
| **各 IDE 指令文件格式** | 熟悉 | Formatter 开发与维护 |
| **Glob 模式语法** | 中等 | 跨 IDE Glob 兼容性 |
| **Vitest 快照测试** | 基础 | 配置输出回归测试 |

## 成功指标与 KPI

| 指标 | 目标值 | 测量方式 |
|------|--------|----------|
| **Formatter 输出正确率** | 100% | 快照测试全通过 |
| **IDE 检测准确率** | ≥ 95% | 集成测试 + 用户反馈 |
| **`cord init` 到首次使用时间** | < 1 分钟 | 用户测试 |
| **跨 IDE 指令语义一致性** | 100% | IR → 各格式对比审查 |
| **升级不破坏用户内容** | 100% | Merger 测试矩阵全通过 |
| **AI 指令遵循率** | ≥ 80%（4 IDE 平均） | 手动验证统计 |

_Source: 基于 TR4（跨 IDE 集成）、TR5（CLI 框架）研究结论及 npm 生态最佳实践_

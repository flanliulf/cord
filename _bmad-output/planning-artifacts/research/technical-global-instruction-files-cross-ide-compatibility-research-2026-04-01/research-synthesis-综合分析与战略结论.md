# Research Synthesis — 综合分析与战略结论

## Executive Summary

本 TR7 研究对五大主流 AI IDE 的全局指令文件体系进行了全面深度对比，产出了 CORD 指令文件适配层的完整抽象模型、架构设计和实现方案。

**核心发现：**

1. **"格式碎片化、语义同构化"** — 所有 IDE 都采用 Markdown + 可选 YAML Frontmatter，都支持 Glob 文件匹配和多层作用域。但 Frontmatter 字段名称（`paths` vs `globs` vs `applyTo`）、触发模式（`paths` vs `alwaysApply` vs `trigger`）、文件后缀（`.md` vs `.mdc` vs `.instructions.md`）各不相同
2. **AGENTS.md 已成为事实标准** — 25+ 工具支持，Linux Foundation 旗下 Agentic AI Foundation 维护。但仍处"早期采用阶段"（无 Schema、无版本号、无验证工具），功能远弱于各 IDE 原生规则
3. **统一抽象模型可行** — 5 个共性维度 + 3 个差异维度可完整覆盖所有 IDE 的指令语义；差异维度通过可选字段和降级策略处理
4. **独立文件注入策略是最优解** — 为每个 IDE 新建独立规则文件（零侵入用户已有配置），AGENTS.md 通过标记区块兜底
5. **gray-matter 是唯一新增依赖** — 其余工具链（Commander.js、@clack/prompts、Vitest、tsup）全部复用 TR5 已选定的技术栈

**战略建议：**

- **采用"原生规则优先 + AGENTS.md 兜底"策略**（方案 B），最大化 IDE 特定功能利用（Glob 匹配、智能判断）+ 最大化工具覆盖（25+ 工具）
- **实现 CordInstructionModel → 5 个 Formatter 适配器的转换管道**，新增 IDE 仅需添加 Formatter
- **`cord init` 集成自动检测 + 交互式确认 + dry-run**，实现 < 1 分钟的首次配置体验
- **12-16 天完成实现**，可与 TR4 Phase 2 并行

---

## Table of Contents

1. [Technical Research Scope Confirmation](#technical-research-scope-confirmation)
2. [Technology Stack Analysis](#technology-stack-analysis)
   - 2.1 Claude Code — CLAUDE.md + .claude/rules/ 体系
   - 2.2 Cursor — .cursor/rules/ + AGENTS.md 体系
   - 2.3 GitHub Copilot — .github/instructions/ + AGENTS.md 体系
   - 2.4 Windsurf — .windsurf/rules/ + AGENTS.md 体系
   - 2.5 Gemini CLI — GEMINI.md + .gemini/ 体系
   - 2.6 AGENTS.md — 跨 IDE 开放标准
   - 2.7 技术栈横向对比总览
3. [Integration Patterns Analysis](#integration-patterns-analysis)
   - 3.1 CORD 指令片段的集成需求
   - 3.2 各 IDE 指令片段注入路径（Claude Code / Cursor / Copilot / Windsurf / AGENTS.md）
   - 3.3 跨 IDE 指令片段格式转换管道
   - 3.4 非破坏性合并策略
   - 3.5 Frontmatter 解析与生成工具链（gray-matter）
   - 3.6 版本管理与升级策略
   - 3.7 IDE 配置检测策略
   - 3.8 MCP Server 配置注入
4. [Architectural Patterns and Design](#architectural-patterns-and-design)
   - 4.1 核心架构模式：适配器模式 + 抽象工厂模式
   - 4.2 指令抽象模型：CORD Instruction Model（5 共性 + 3 差异）
   - 4.3 文件系统交互模式：模板方法 + 防御性编程
   - 4.4 AGENTS.md 标准化评估与战略定位
   - 4.5 跨 IDE 指令一致性架构
   - 4.6 关键架构决策记录（ADR-TR7-001 ~ 005）
5. [Implementation Approaches and Technology Adoption](#implementation-approaches-and-technology-adoption)
   - 5.1 实现路线图（Phase 2A-2D）
   - 5.2 核心代码实现（文件结构 + Formatter 伪代码 + IDE 检测器）
   - 5.3 测试策略（四层测试金字塔 + AGENTS.md Merger 测试矩阵）
   - 5.4 部署与分发
   - 5.5 风险评估与缓解（7 项）
   - 5.6 依赖清单
6. [Technical Research Recommendations](#technical-research-recommendations)
7. [Research Synthesis — 综合分析与战略结论](#research-synthesis--综合分析与战略结论)

---

## 关键技术决策汇总

| ADR 编号 | 决策主题 | 结论 | 理由 |
|----------|----------|------|------|
| **ADR-TR7-001** | CORD 指令文件命名 | `cord-relations` 作为统一前缀 | 清晰表达 CORD 用途 + 品牌识别 |
| **ADR-TR7-002** | Glob 语法标准化 | IR 内部用数组格式 | 数组更安全；转换为逗号字符串由 Formatter 负责 |
| **ADR-TR7-003** | 指令内容差异化 | 统一内容，差异仅在 Frontmatter | 维护成本最低，语义一致性最高 |
| **ADR-TR7-004** | AGENTS.md 位置策略 | 始终末尾追加 | 不改变用户内容的相对位置 |
| **ADR-TR7-005** | i18n 策略 | 默认英文 + `--lang` 覆盖 | AI 理解英文最佳，支持用户偏好 |

---

## 五大 IDE 指令文件体系终极对比

| 维度 | Claude Code 🥇 | Cursor 🥈 | Copilot | Windsurf | AGENTS.md |
|------|----------------|-----------|---------|----------|-----------|
| **主文件** | `CLAUDE.md` | — | `copilot-instructions.md` | — | `AGENTS.md` |
| **规则目录** | `.claude/rules/` | `.cursor/rules/` | `.github/instructions/` | `.windsurf/rules/` | — |
| **文件后缀** | `.md` | `.mdc`/`.md` | `.instructions.md` | `.md` | `.md` |
| **Frontmatter** | `paths` (1 字段) | 3 字段 | 2 字段 | 2 字段 | 无 |
| **作用域层数** | 6 级 | 3 级 | 3 级 | 4 级 | 1 级 |
| **文件匹配** | `paths: [glob]` | `globs: [glob]` | `applyTo: "glob"` | `trigger: glob` | ❌ |
| **智能判断** | ❌ | ✅ `description` | ❌ | ✅ `model_decision` | ❌ |
| **手动触发** | ❌ | ✅ `@name` | ❌ | ✅ `@name` | ❌ |
| **文件导入** | ✅ `@path` | ❌ | ❌ | ❌ | ❌ |
| **排除机制** | ✅ `claudeMdExcludes` | ❌ | ✅ `excludeAgent` | ❌ | ❌ |
| **字符限制** | ~200 行建议 | ~500 行建议 | ~2 页 | 6K/12K 字符 | 无 |
| **AGENTS.md 支持** | `@AGENTS.md` 导入 | ✅ 原生 | ✅ 原生 | ✅ 原生 | — |
| **工具覆盖** | 仅 Claude Code | 仅 Cursor | 仅 Copilot | 仅 Windsurf | **25+ 工具** |
| **CORD 注入方式** | 独立 .md 文件 | 独立 .mdc 文件 | 独立 .instructions.md | 独立 .md 文件 | 标记区块 |

---

## 未来技术展望

### 近期趋势（2026-2027）

1. **AGENTS.md 规范化加速** — Agentic AI Foundation 的正式治理结构将推动 AGENTS.md 从"纯 Markdown 约定"向"有 Schema、有版本号、有验证工具"的方向演进。CORD 的适配器架构已预留扩展空间。

2. **各 IDE 原生规则体系趋于收敛** — Cursor 的 `.mdc` 和 Windsurf 的 `trigger` 模式已体现出相似的设计理念（声明式触发控制）。未来可能出现跨 IDE 的规则格式标准化协议。

3. **Claude Code 的 `@path` 导入模式可能被其他 IDE 采纳** — 文件导入和符号链接是管理大型项目指令集的最佳方案，其他 IDE 可能跟进。

### 中期展望（2027-2028）

1. **AI IDE 指令格式统一标准** — 类似 MCP 对 AI 工具调用的标准化，可能出现跨 IDE 的指令文件格式标准（"MCP for Instructions"），使工具开发者只需维护一份指令文件。

2. **AI Agent 自主发现指令** — AI 可能无需显式指令文件，自动从 MCP Server 能力描述中推断行为规范。这将降低指令层的必要性，但 CORD 的 MCP Tools 描述已是这一趋势的早期实践。

3. **指令文件即代码（Instructions as Code）** — 类似 Infrastructure as Code 的演进，指令文件可能引入变量、条件逻辑、模板继承等编程能力。

---

## 对后续研究的影响

| 后续研究 | TR7 的影响 |
|----------|-----------|
| **TR8 (Mermaid 可视化)** | 各 IDE 指令文件的生成/注入路径可作为 Mermaid 可视化的一个数据源，展示"指令分发拓扑" |
| **TR9 (npm 分发)** | 指令模板文件随 npm 包分发的方案已确定；`cord init` 的模板加载路径需与 npm 包结构对齐 |
| **TR10 (BMAD 适配)** | BMAD 文档产出的 AGENTS.md / CLAUDE.md 片段可复用 TR7 的 Formatter 管道自动注入 |

---

## 研究方法论与来源说明

**研究方法：**
- 官方文档优先，所有核心结论均基于各 IDE 最新官方文档
- Web 搜索验证，交叉比对多个来源
- 直接继承 TR4 已验证的跨 IDE 对比基础，避免重复研究
- 基于 CORD 项目实际需求进行针对性架构设计

**主要来源：**
- [Claude Code Memory 文档](https://code.claude.com/docs/en/memory) — CLAUDE.md 规格、.claude/rules/ 目录、加载机制、@path 导入
- [Cursor Rules 文档](https://cursor.com/docs/rules) — .cursor/rules/ 目录、.mdc 格式、Frontmatter 字段、触发模式
- [GitHub Copilot Custom Instructions](https://docs.github.com/en/copilot/customizing-copilot/adding-custom-instructions-for-github-copilot) — copilot-instructions.md、路径级指令、applyTo/excludeAgent
- [Windsurf Rules & Memories 文档](https://docs.windsurf.com/windsurf/cascade/memories) — .windsurf/rules/ 目录、trigger/globs Frontmatter、字符限制
- [Gemini CLI GitHub 仓库](https://github.com/google-gemini/gemini-cli) — GEMINI.md 规格
- [AGENTS.md 官方网站](https://agents.md) — 开放标准定义、工具支持列表、Agentic AI Foundation
- [gray-matter GitHub 仓库](https://github.com/jonschlinkert/gray-matter) — YAML Frontmatter 解析/生成 API

**置信度评估：**
- Claude Code CLAUDE.md: 🟢 高（文档极为详尽，涵盖所有边界情况）
- Cursor Rules: 🟢 高（文档清晰，4 种触发模式均有说明）
- Copilot Instructions: 🟡 中高（Custom Instructions 清晰，AGENTS.md 集成较新）
- Windsurf Rules: 🟢 高（文档详尽，含字符限制和企业部署说明）
- Gemini CLI: 🟡 中（仅 README 级别信息，详细规格需查阅子文档）
- AGENTS.md 标准: 🟢 高（官方网站 + GitHub + 25+ 工具支持列表）

---

**Technical Research Completion Date:** 2026-04-01
**Research Period:** 2026-04-01（综合分析，基于 TR4-TR5 积累的项目上下文）
**Source Verification:** 所有技术声明均引用当前官方文档
**Technical Confidence Level:** 🟢 高 — 基于多个权威技术来源交叉验证

_本技术研究报告为 CORD 项目指令文件适配层设计提供了权威的技术选型依据和完整的架构方案，可直接指导 `cord init` 指令层的实现工作。_

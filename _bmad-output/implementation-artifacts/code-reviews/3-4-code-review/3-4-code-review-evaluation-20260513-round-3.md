---
Story: 3-4
Round: 3
Date: 2026-05-13
Model Used: GitHub Copilot (VS Code Chat)
Review Source: 3-4-code-review-summary-20260513-round-3.md
Review Model: GitHub Copilot (VS Code Chat)
Type: Code Review Evaluation
---

## 评估总结

对 Story 3-4 的第 3 轮 CR 代码审查结果（复审）进行逐条评估。本轮审查确认 Round 2 #1 Windows 跨盘符 / UNC 绝对输出路径绕过 projectRoot 边界问题已修复，未提出新的阻塞项或中高优先级问题；当前唯一阻塞项仍为 Round 1 #1 的 `project` 字段来源待产品/架构裁决。评估结论如下。

---

## 上轮问题回顾确认

### Round 2 / Finding #1 — Windows 跨盘符或 UNC 绝对输出路径可绕过 projectRoot 边界检查：已修复

经代码验证，`src/cli/commands/export.ts:18-30` 已为 `createExportCommand()` 增加可注入 `pathApi`，默认使用运行时 `resolve`、`relative`、`isAbsolute`。`src/cli/commands/export.ts:69-105` 的 `normalizeOutputPath()` 现在先 `trim()`，再用注入的 `pathApi.resolve()` / `pathApi.relative()` 计算相对路径，并在拒绝条件中新增 `pathApi.isAbsolute(relativeOutputPath)`。这会拒绝 win32 跨盘符或 UNC 跨 root 时由 `relative()` 返回的绝对路径结果。

测试侧，`tests/unit/cli/commands/export.test.ts:2` 引入 `node:path` 的 `win32`，并在 `tests/unit/cli/commands/export.test.ts:293-332` 覆盖 `D:\outside.json` 与 `\\server\share\outside.json` 两类 Windows 跨 root 输出路径，均断言 `serviceFactory()` 不被调用且返回配置错误。该修复与测试能覆盖 Round 2 评估中的阻塞缺口。

### Round 1 / Finding #2 — `--output` 可解析到 projectRoot 外：持续有效

经代码验证，常规相对路径、`./` 相对路径、项目内绝对路径、POSIX 项目外相对路径、POSIX 项目外绝对路径、带空白项目外路径、win32 跨盘符路径、win32 UNC 路径均已有入口层测试覆盖（`tests/unit/cli/commands/export.test.ts:121-332`）。拒绝场景均在 `serviceFactory()` 初始化前完成，符合路径型 CLI 输入边界契约。

### Round 1 / Finding #1 — `project` 字段来源与 Story Dev Notes 裁决不一致：仍待裁决

经代码验证，`src/services/export-service.ts:96-109` 当前仍使用 `basename(resolve(projectRoot))` 作为 `project` 字段来源。Round 1 与 Round 2 评估均确认现有 `cord.config` 契约不存在可直接接入的项目名字段，且该项属于 `decision_needed`。本轮审查继续将其列为唯一阻塞项，判断准确。

### 历史 CR TODO（非阻塞）

| # | 发现 | 状态 | 评估意见 |
|---|------|------|---------|
| R1-#3 | 快照排序使用默认 `localeCompare` | CR TODO / 非阻塞 | 同意维持 P2。影响跨环境 diff 稳定性，但不改变导出数据内容，不阻塞当前 AC 主路径。 |
| R1-defer | 快照写入缺少原子写入或覆盖语义测试 | CR TODO / 非阻塞 | 同意维持可靠性增强项。当前无证据表明其阻塞 AC1-AC7。 |
| R2-defer | symlink 物理逃逸硬化 | CR TODO / 非阻塞 | 同意维持后续加固项。当前入口层词法路径边界已覆盖主要交付门禁。 |
| R3-defer | UNC projectRoot 与目录形态 `--output` 测试硬化 | CR TODO / 非阻塞 | 同意作为低风险硬化项跟踪。可补充 UNC projectRoot 组合测试，并明确目录形态输出语义，但不阻塞当前主路径。 |

---

## 发现 #1 评估

### 审查原文

> **【高】 Round 1 #1 project 字段来源仍需产品/架构裁决**
> - 来源：auditor
> - 分类：decision_needed

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：准确**

审查原文成立。`ExportService` 构造快照时仍直接使用 `basename(resolve(projectRoot))` 填充 `project` 字段（`src/services/export-service.ts:96-109`）。该行为与 Round 1 / Round 2 评估中确认的 Story Dev Notes 语义仍未完成裁决对齐：到底使用目录名、新增配置字段、`package.json name`，还是其它来源，仍需产品/架构先做外部契约决定。

**严重性判断：合理**

原始 [高] 作为持续阻塞项合理。该问题不是实现者可以自行选择的普通补丁，因为每一种来源都会改变 JSON 快照的项目身份语义和外部契约。它不属于 P0 安全或数据完整性事故，但属于交付前必须关闭的 P1 裁决与同步项。

**修复建议：可行**

修复建议可行，但必须先完成产品/架构裁决。若接受目录名，应同步 Story/架构契约并补充目录名行为测试；若新增配置字段，应同步 `configSchema`、`CordConfig`、默认配置/加载逻辑、Rule Document Registry 相关文档和服务测试；若读取 `package.json name`，应明确 fallback、缺失/非法 package.json 行为和测试边界。

**误报评估：非误报**

该项是前两轮已确认阻塞项的持续状态复核；当前代码仍保持目录名逻辑，且没有新的产品/架构裁决证据，非误报。

---

## 整体评估结论

### 需要修复（阻塞交付）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 1 | Round 1 #1 `project` 字段来源仍需产品/架构裁决 | [高] | **P1** | 当前唯一阻塞项；需先裁决 `project` 来源，再同步实现、测试和契约文档。 |

### 建议纳入 CR TODO 跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| R1-#3 | 快照排序使用默认 `localeCompare` | [中] | **P2** | 维持历史评估结论，作为跨环境 diff 稳定性加固项跟踪。 |
| R1-defer | 快照写入缺少原子写入或覆盖语义测试 | defer | **P2** | 维持可靠性增强项，不阻塞当前 AC 主路径。 |
| R2-defer | symlink 物理逃逸硬化 | defer | **P2** | 维持后续硬化项，不阻塞当前 AC 主路径。 |
| R3-defer | UNC projectRoot 与目录形态 `--output` 测试硬化 | defer | **P2** | 作为低风险测试/语义硬化项跟踪，不阻塞当前 AC 主路径。 |

### 可忽略（误报）

无。

### 评估决定

- **发现 #1（Round 1 #1 `project` 字段来源仍需产品/架构裁决）**：确认有效，继续维持 P1 阻塞；下一步必须先完成项目名来源裁决，再进入实现同步。
- **Round 2 / Finding #1（Windows 跨盘符或 UNC 输出路径边界）**：确认已修复，可关闭。
- **Round 1 / Finding #2（`--output` projectRoot 外路径）**：确认持续有效，可维持关闭。
- **历史 CR TODO（排序稳定性、原子写入/覆盖语义、symlink 物理逃逸、UNC projectRoot 与目录形态测试硬化）**：维持非阻塞跟踪，不纳入本轮阻塞修复范围。

## 修复执行记录

### 修复执行记录
- **Date**: 2026-05-13
- **Model Used**: GPT-5.4
- **Fix Items**: 1

1. **发现 #1：Round 1 #1 `project` 字段来源仍需产品/架构裁决**
	 - **执行结果**: 待确认，未修改源码
	 - **原因**: 当前实现仍在 `src/services/export-service.ts` 中使用目录名 `basename(resolve(projectRoot))` 作为 `project` 字段来源，而现有 `cord.config` schema 中不存在可直接接入的项目名字段。目录名、新增配置字段、`package.json name` 等方案都会改变对外契约；在没有产品/架构裁决前，不能擅自选择其中任一方案落地。
	 - **核验结果**:
		 - `src/services/export-service.ts` 仍使用目录名来源 ✅
		 - `src/schemas/config.ts` 仍不存在项目名字段 ✅
	 - **影响文件**: 无

### 修复执行记录
- **Date**: 2026-05-13
- **Model Used**: GPT-5.4
- **Fix Items**: 1

1. **发现 #1：Round 1 #1 `project` 字段来源仍需产品/架构裁决**
	 - **执行结果**: 已修复
	 - **裁决落地**: 采用 `cord.config` 中的 `projectName` 作为快照 `project` 字段的优先来源；若配置缺失，则回退到项目根目录名。
	 - **修改内容**:
		 - 在 `src/types/config.ts`、`src/schemas/config.ts` 中新增共享配置字段 `projectName?: string`，并约束为去空白后的非空字符串。
		 - 在 `src/services/export-service.ts` 中接入 `loadConfig(projectRoot)`，导出快照时优先读取 `config.projectName`，缺失时回退到 `basename(resolve(projectRoot))`。
		 - 在 `tests/unit/schemas/config.test.ts`、`tests/unit/utils/config-loader.test.ts`、`tests/unit/services/export-service.test.ts` 中补充 schema 校验、配置加载和导出回退逻辑的回归测试。
		 - 按 Rule Document Registry 同步更新 `_bmad-output/project-context.md`、`03-core-architectural-decisions.md`、`04-implementation-patterns-consistency-rules.md` 的配置字段基线。
	 - **验证结果**:
		 - `npx vitest run tests/unit/schemas/config.test.ts tests/unit/utils/config-loader.test.ts tests/unit/services/export-service.test.ts` ✅
	 - **影响文件**:
		 - `src/types/config.ts`
		 - `src/schemas/config.ts`
		 - `src/services/export-service.ts`
		 - `tests/unit/schemas/config.test.ts`
		 - `tests/unit/utils/config-loader.test.ts`
		 - `tests/unit/services/export-service.test.ts`
		 - `_bmad-output/project-context.md`
		 - `_bmad-output/planning-artifacts/architecture/03-core-architectural-decisions.md`
		 - `_bmad-output/planning-artifacts/architecture/04-implementation-patterns-consistency-rules.md`
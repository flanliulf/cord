---
Story: 3-4
Round: 2
Date: 2026-05-13
Model Used: GitHub Copilot (VS Code Chat)
Review Source: 3-4-code-review-summary-20260513-round-2.md
Review Model: GitHub Copilot (VS Code Chat)
Type: Code Review Evaluation
---

## 评估总结

对 Story 3-4 的第 2 轮 CR 代码审查结果（复审）进行逐条评估。本轮审查确认 Round 1 #2 在 macOS/Unix 语义下已修复，同时提出 1 个新的 Windows 跨盘符/UNC 路径边界缺口，并确认 Round 1 #1 的 `project` 字段来源仍处于待裁决状态。评估结论如下。

---

## 上轮问题回顾确认

### Round 1 / Finding #2 — `--output` 可解析到 projectRoot 外：部分已修复

经代码验证，`src/cli/commands/export.ts:69-96` 当前已在 `serviceFactory()` 调用前对 `--output` 执行 `trim()`、`resolve(projectRoot, value)`、`relative(projectRoot, absolutePath)`，并检查 `''`、`'..'`、`'../'`。`tests/unit/cli/commands/export.test.ts:139-189` 覆盖了常规相对路径、`./` 相对路径和项目内绝对路径归一化；`tests/unit/cli/commands/export.test.ts:240-291` 覆盖了 POSIX 风格项目外相对路径、项目外绝对路径和带空白项目外路径，并断言不调用 `serviceFactory()`。

该修复关闭了 Round 1 #2 在当前 macOS/Unix 词法路径语义下的主缺口；但本轮审查提出的 Windows 跨盘符/UNC 情况不被当前检查捕获，应作为 Round 2 新补丁项继续处理。

### Round 1 / Finding #1 — `project` 字段来源与 Story Dev Notes 裁决不一致：仍待裁决

经代码验证，`src/services/export-service.ts:96-109` 当前仍使用 `basename(resolve(projectRoot))` 作为 `project` 字段来源。Round 1 评估文件 `_bmad-output/implementation-artifacts/code-reviews/3-4-code-review/3-4-code-review-evaluation-20260512-round-1.md:132-146` 已记录该项为 `decision_needed`，且缺少产品/架构裁决前未修改源码。该状态与本轮审查判断一致。

### 历史 CR TODO（非阻塞）

| # | 发现 | 状态 | 评估意见 |
|---|------|------|---------|
| R1-#3 | 快照排序使用默认 `localeCompare` | CR TODO / 非阻塞 | 同意维持 P2。该问题影响跨环境 git diff 稳定性，但不改变导出数据内容，不作为本轮阻塞项。 |
| R1-defer | 快照写入缺少原子写入或覆盖语义测试 | CR TODO / 非阻塞 | 同意维持可靠性增强项。当前无证据表明其阻塞 AC1-AC7 主路径。 |

---

## 发现 #1 评估

### 审查原文

> **【中】【新】 Windows 跨盘符或 UNC 绝对输出路径可绕过 projectRoot 边界检查**
> - 来源：edge
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：准确**

审查原文成立。当前 `normalizeOutputPath()` 使用平台默认 `node:path` 的 `resolve()` 与 `relative()`，再将反斜杠替换为 `/`，随后仅检查空字符串、`..` 和 `../` 前缀（`src/cli/commands/export.ts:69-96`）。在 Windows 语义下，`path.win32.relative('C:\\repo', 'D:\\outside.json')` 会返回 `D:\\outside.json`，归一化后为 `D:/outside.json`；`path.win32.relative('C:\\repo', '\\\\server\\share\\outside.json')` 会返回 UNC 绝对路径，归一化后为 `//server/share/outside.json`。这两类结果都不等于 `..`，也不以 `../` 开头，因此会绕过当前检查。

我用 Node 的 `path.win32` 独立复验了上述行为：跨盘符 `D:\\outside.json` 和 UNC `\\\\server\\share\\outside.json` 的 `rejectedByCurrentCheck` 均为 `false`；而普通 `..\\outside.json` 会归一化为 `../outside.json` 并被拒绝。这说明 Round 1 #2 的 POSIX/macOS 修复有效，但 Windows 跨 root 缺口确实存在。当前测试只覆盖 POSIX 风格的项目外路径（`tests/unit/cli/commands/export.test.ts:240-291`），未覆盖 win32 跨盘符或 UNC 语义。

**严重性判断：合理**

原始严重性 [中] 合理，但评估优先级应为 P1。该问题属于路径型 CLI 输入边界的跨平台缺口，会使 Windows 环境下的纯输入错误通过入口校验并初始化 `serviceFactory()`，违反架构层“项目根目录外路径必须在入口层返回 ConfigError、不得产生副作用”的质量门禁。它不是远程安全漏洞或数据完整性 P0，但应阻塞 Story 交付。

**修复建议：可行**

修复建议可行。实现上应显式拒绝跨 root 的绝对结果，例如在归一化后额外拒绝 `path.isAbsolute(relativePath)` / win32 绝对路径形态，或使用 `path.parse(...).root` 对比 `projectRoot` 与 `absoluteOutputPath` 的 root，并补充 `path.win32` 单元测试覆盖 `D:\\outside.json` 与 `\\\\server\\share\\outside.json`。测试应继续断言拒绝场景不会调用 `serviceFactory()`。

**误报评估：非误报**

虽然该发现来源为单层 edge，但已通过代码路径和 `path.win32` 行为复验确认，非误报。

---

## 发现 #2 评估

### 审查原文

> **【高】 Round 1 #1 project 字段来源仍待产品/架构裁决**
> - 来源：auditor
> - 分类：decision_needed

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：准确**

审查原文成立。当前 `ExportService` 构造快照时仍以 `basename(resolve(projectRoot))` 写入 `project` 字段（`src/services/export-service.ts:96-109`）。Round 1 评估已经确认 Story Dev Notes 要求 `project` 字段优先读取配置文件中的项目名，但现有 `cord.config` schema 与 `CordConfig` 类型没有 `projectName` 或 `name` 字段；Round 1 修复执行记录也明确该项为 `decision_needed`，缺少裁决前未修改源码（`_bmad-output/implementation-artifacts/code-reviews/3-4-code-review/3-4-code-review-evaluation-20260512-round-1.md:132-146`）。因此本轮审查将其列为仍待裁决阻塞项是准确的。

**严重性判断：合理**

原始严重性 [高] 合理。该问题仍不是可由代码作者自行选择的简单补丁，因为选择目录名、配置字段或 `package.json name` 都会改变外部契约；但它直接影响快照 `project` 身份语义，与 Story Dev Notes 尚未对齐，属于交付前必须完成的 P1 裁决与同步项。

**修复建议：可行**

修复建议可行，但必须先完成产品/架构裁决。若裁决为接受目录名，应同步 Story/架构契约并补充目录名行为测试；若裁决为新增配置字段，应同步 `configSchema`、`CordConfig`、默认配置/加载逻辑、Rule Document Registry 相关文档和服务测试；若裁决为读取 `package.json name`，也需要明确 fallback、缺失/非法 package.json 行为和测试边界。

**误报评估：非误报**

该发现是 Round 1 已确认阻塞项的持续状态复核，当前代码和评估记录均支持，非误报。

---

## 整体评估结论

### 需要修复（阻塞交付）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 1 | Windows 跨盘符或 UNC 绝对输出路径可绕过 projectRoot 边界检查 | [中][新] | **P1** | 跨平台路径边界缺口会让 Windows 项目外输出路径绕过入口层 ConfigError 门禁。 |
| 2 | Round 1 #1 project 字段来源仍待产品/架构裁决 | [高] | **P1** | 仍需先裁决 `project` 来源，再同步实现、测试和契约文档。 |

### 建议纳入 CR TODO 跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| R1-#3 | 快照排序使用默认 `localeCompare` | [中] | **P2** | 维持 Round 1 评估结论，作为跨环境 diff 稳定性加固项跟踪。 |
| R1-defer | 快照写入缺少原子写入或覆盖语义测试 | defer | **P2** | 维持可靠性增强项，不阻塞当前 AC 主路径。 |

### 可忽略（误报）

无。

### 评估决定

- **发现 #1（Windows 跨盘符或 UNC 绝对输出路径可绕过 projectRoot 边界检查）**：确认有效，作为 P1 阻塞补丁项处理；修复应覆盖 win32 跨盘符与 UNC 路径，并确保拒绝时不初始化 `serviceFactory()`。
- **发现 #2（Round 1 #1 project 字段来源仍待产品/架构裁决）**：确认有效，继续维持 P1 阻塞；必须先完成 `project` 来源裁决，再进入实现同步。
- **历史 CR TODO（排序稳定性、原子写入/覆盖语义）**：维持非阻塞跟踪，不纳入本轮阻塞修复范围。

## 修复执行记录

### 修复执行记录
- **Date**: 2026-05-13
- **Model Used**: GPT-5.4
- **Fix Items**: 2

1. **发现 #1：Windows 跨盘符或 UNC 绝对输出路径可绕过 projectRoot 边界检查**
	 - **执行结果**: 已修复
	 - **修改内容**:
		 - 在 `src/cli/commands/export.ts` 中为 `normalizeOutputPath()` 增加 root-aware 判定，基于运行时 path API 的 `isAbsolute(relativeOutputPath)` 拒绝 win32 跨盘符与 UNC 跨 root 结果，继续保持在 `serviceFactory()` 初始化前返回 `ConfigError`。
		 - 在 `createExportCommand()` 中新增可注入的 `pathApi` 依赖，测试环境可使用 `path.win32` 复现 Windows 语义，而不改变默认运行时行为。
		 - 在 `tests/unit/cli/commands/export.test.ts` 中补充 win32 跨盘符 `D:\outside.json` 与 UNC `\\server\share\outside.json` 两条回归测试，并断言拒绝场景不会调用 `serviceFactory()`。
	 - **验证结果**:
		 - `npx vitest run tests/unit/cli/commands/export.test.ts` ✅
		 - `npm run type-check` ✅

2. **发现 #2：Round 1 #1 project 字段来源仍待产品/架构裁决**
	 - **执行结果**: 待确认，未修改源码
	 - **原因**: 该项在 Round 1 与 Round 2 评估中都被归类为 `decision_needed`。当前 `cord.config` 契约仍不存在已裁定的项目名字段，且“目录名 / 新配置字段 / package.json name”都会改变对外契约；在没有产品/架构裁决前，不能擅自选择其一落地。
	 - **影响文件**: 无
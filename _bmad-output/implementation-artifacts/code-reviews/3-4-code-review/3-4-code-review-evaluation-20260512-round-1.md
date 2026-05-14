---
Story: 3-4
Round: 1
Date: 2026-05-12
Model Used: GitHub Copilot (VS Code Chat)
Review Source: 3-4-code-review-summary-20260512-round-1.md
Review Model: GitHub Copilot (VS Code Chat)
Type: Code Review Evaluation
---

## 评估总结

对 Story 3-4 的第 1 轮 CR 代码审查结果（首轮）进行逐条评估。本轮审查提出 3 条发现：1 条需要产品/架构裁决的契约不一致、1 条明确违反路径型 CLI 输入边界的补丁项、1 条影响快照 diff 稳定性的排序加固项。评估结论如下。

---

## 发现 #1 评估

### 审查原文

> **[高] project 字段来源与 Story Dev Notes 裁决不一致**
> - 来源：blind+edge
> - 分类：decision_needed

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：准确**

审查原文成立。Story Dev Notes 明确写明 `project` 字段来源为“优先读取配置文件中的项目名，如酵出则用项目根目录名”（`_bmad-output/implementation-artifacts/stories/3-4-json-snapshot-export.md:49`），但当前 `ExportService` 在构造快照时直接使用 `basename(resolve(projectRoot))`（`src/services/export-service.ts:109`）。同时，`cord.config` schema 当前只包含 `framework`、`ide`、`scanPaths`、`excludePaths`、`confidenceThreshold`、`relationTypes`、`adapters` 等字段（`src/schemas/config.ts:18-42`），`CordConfig` 类型也未定义 `projectName` 或 `name`（`src/types/config.ts:12-41`）。因此这里不是单纯漏接已有配置，而是 Story 裁决引用了尚未存在的配置契约。

**严重性判断：合理**

原始严重性标为 [高] 基本合理。该问题会导致实现与 Story Dev Notes 的明确裁决不一致，并且在配置契约缺失的情况下无法直接补丁式修复；若项目显示名与目录名不同，导出快照会记录错误项目身份。它不是安全或数据完整性 P0，但属于交付前必须裁决并同步实现/文档/测试的 P1。

**修复建议：可行**

审查建议可行。需要先裁决 `project` 字段来源：新增 `cord.config` 项目名字段、改读 `package.json name`，或正式接受目录名作为 v0.1 契约。若选择新增配置字段，应同步 `configSchema`、`CordConfig`、默认配置/加载逻辑、相关规则文档与服务层测试；若选择目录名，应同步 Story/架构契约并补充 fallback 行为测试。

**误报评估：非误报**

多来源命中（blind+edge）且代码、schema、Story 三方证据一致，非误报。

---

## 发现 #2 评估

### 审查原文

> **[中] `--output` 可解析到 projectRoot 外，违反路径型 CLI 输入边界契约**
> - 来源：blind
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：准确**

审查原文成立。CLI 对 `--output` 仅执行 `trim()`（`src/cli/commands/export.ts:74-80`），随后通过 `validateExportInput` 校验（`src/cli/commands/export.ts:45-52`）；而 `exportInputSchema` 只要求 `outputPath` 为 trim 后非空字符串（`src/schemas/export-input.ts:4-6`）。服务层解析输出路径时直接 `resolve(projectRoot, outputPath)`（`src/services/export-service.ts:116-121`），因此 `../snapshot.json` 会解析到项目外，绝对路径也会覆盖 `projectRoot`。之后 `mkdir` 与 `writeFile` 会实际创建目录并写入文件（`src/services/export-service.ts:83-84`）。这与架构规则“路径型 CLI 输入必须在入口层归一化到 project-relative POSIX path，若落到 projectRoot 外必须直接返回 ConfigError”（`_bmad-output/planning-artifacts/architecture/03-core-architectural-decisions.md:35`）不一致。

**严重性判断：合理**

原始 [中] 严重性合理，评估优先级为 P1。该问题不等同于远程安全漏洞，但它违反已确认的 CLI 路径边界门禁，并且会在输入错误场景下初始化 service 后写出项目外文件，影响本 Story “导出到项目 git 审阅快照”的边界承诺。

**修复建议：可行**

审查建议可行。应在 CLI 入口层、`serviceFactory()` 调用前完成 output 路径归一化与边界检查：拒绝空字符串、`.`/目录路径语义不明值、`..`、`../...` 以及 projectRoot 外绝对路径，并抛出稳定 `ConfigError`。测试应覆盖合法相对路径、项目外相对路径、项目外绝对路径、带前后空白的项目外路径，并断言拒绝时不调用 `serviceFactory()`。

**误报评估：非误报**

虽然这是单来源发现，但代码路径和架构规则可独立复现，非误报。

---

## 发现 #3 评估

### 审查原文

> **[中] 快照排序使用默认 `localeCompare`，跨环境稳定性不足**
> - 来源：blind+edge
> - 分类：patch

### 评估结论：⚠️ 有效但降级 — 建议纳入 CR TODO 跟踪（P2 优先级）

### 评估分析

**问题描述准确性：准确**

审查原文成立。当前文档排序使用 `left.path.localeCompare(right.path)` 与 `left.id.localeCompare(right.id)`（`src/services/export-service.ts:154`），关系排序也连续使用未指定 locale/options 的 `localeCompare()`（`src/services/export-service.ts:158-161`）。服务测试只覆盖 `docs/a.md`、`docs/b.md` 这类简单 ASCII 路径和 ID（`tests/unit/services/export-service.test.ts:169-176`、`tests/unit/services/export-service.test.ts:213-224`），未覆盖大小写、数字段或非 ASCII 输入。

**严重性判断：偏高**

发现有效，但原始 [中] 作为阻塞项略偏高。JSON 快照用于 git 审阅，跨环境顺序不稳定会制造无意义 diff，确实影响体验和可审阅性；但它不改变导出数据内容，也未直接违反当前 AC 的明确字段要求。因此建议作为 P2 非阻塞 CR TODO 跟踪，若团队希望严格把“可 git 审阅”解释为稳定排序门禁，也可以提升为 P1 小补丁。

**修复建议：可行**

审查建议可行。优先建议使用显式二进制字符串比较（例如按 `<` / `>` 返回 -1/1/0），避免默认 locale 和 ICU 差异；同时补充覆盖大小写、数字段和非 ASCII 路径/ID 的排序稳定性测试。

**误报评估：非误报**

多来源命中（blind+edge）且代码确实使用默认 `localeCompare()`，非误报；仅对交付阻塞程度做降级。

---

## 整体评估结论

### 需要修复（阻塞交付）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 1 | `project` 字段来源与 Story Dev Notes 裁决不一致 | [高] | **P1** | 需要先裁决项目名来源，并同步实现、契约文档和测试。 |
| 2 | `--output` 可解析到 projectRoot 外 | [中] | **P1** | 违反路径型 CLI 输入边界规则，必须在入口层、service 初始化前拒绝项目外路径。 |

### 建议纳入 CR TODO 跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 3 | 快照排序使用默认 `localeCompare` | [中] | **P2** | 影响跨环境 git diff 稳定性，建议加固但可不阻塞当前主路径交付。 |

### 可忽略（误报）

无。

### 评估决定

- **发现 #1（`project` 字段来源与 Story Dev Notes 裁决不一致）**：确认有效，维持阻塞；下一步应先做产品/架构裁决，再按裁决同步实现与测试。
- **发现 #2（`--output` 可解析到 projectRoot 外）**：确认有效，维持阻塞；应在 CLI 入口层补 projectRoot 边界检查，并覆盖不初始化 service 的错误路径测试。
- **发现 #3（快照排序使用默认 `localeCompare`）**：确认有效但降级为 P2；建议进入 CR TODO 或随本轮补丁顺手修复，不作为必须阻塞项。

## 修复执行记录

### 修复执行记录
- **Date**: 2026-05-12
- **Model Used**: GPT-5.4
- **Fix Items**: 2

1. **发现 #1：`project` 字段来源与 Story Dev Notes 裁决不一致**
	- **执行结果**: 待确认，未修改源码
	- **原因**: 当前评估已明确该问题属于 `decision_needed`，且现有 `cord.config` 契约并不存在可直接接入的项目名字段；在缺少产品/架构裁决前，不能擅自选择“目录名 / 配置项 / package.json name”中的任一来源。
	- **影响文件**: 无

2. **发现 #2：`--output` 可解析到 projectRoot 外**
	- **执行结果**: 已修复
	- **修改内容**:
	  - 在 `src/cli/commands/export.ts` 的 CLI 入口层新增 `--output` 归一化逻辑：先 `trim()`，再基于 `projectRoot` 做 `resolve()` + `relative()`，将合法输入统一收敛为 project-relative POSIX path。
	  - 在调用 `serviceFactory()` 前拒绝 `..`、`../...`、项目外绝对路径和带空白的项目外路径，稳定返回 `ConfigError`。
	  - 在 `tests/unit/cli/commands/export.test.ts` 中补充合法相对路径、项目内绝对路径、项目外相对路径、项目外绝对路径、带空白项目外路径的覆盖，并断言拒绝场景不会初始化 service。
	- **验证结果**:
	  - `npx vitest run tests/unit/cli/commands/export.test.ts` ✅
	  - `npm run type-check` ✅
	  - `npm run lint` ✅

3. **发现 #3：快照排序使用默认 `localeCompare`**
	- **执行结果**: 未处理
	- **原因**: 该项在评估中已降级为 P2 且明确归类为“建议纳入 CR TODO 跟踪（非阻塞）”；根据 fixer 规则，本轮不扩大修复范围。
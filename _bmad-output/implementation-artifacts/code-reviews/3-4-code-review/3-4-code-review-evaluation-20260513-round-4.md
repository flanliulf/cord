---
Story: 3-4
Round: 4
Date: 2026-05-13
Model Used: GitHub Copilot (VS Code Chat)
Review Source: 3-4-code-review-summary-20260513-round-4.md
Review Model: GitHub Copilot (VS Code Chat)
Type: Code Review Evaluation
---

## 评估总结

对 Story 3-4 的第 4 轮 CR 代码审查结果（复审）进行逐条评估。本轮审查确认 Round 3 唯一遗留阻塞项（`project` 字段来源待裁决）已完成裁决并落地为 `cord.config.projectName` 优先、缺失回退项目根目录名；同时确认历史路径边界修复持续有效。本轮未提出新的阻塞项或中高优先级问题，仅新增 1 个配置错误路径副作用测试硬化建议。评估结论如下。

---

## 上轮问题回顾确认

### Round 1 / Finding #1 — `project` 字段来源与 Story Dev Notes 裁决不一致：已修复

经代码验证，`src/types/config.ts:8-16` 已在 `CordConfig` 中新增 `projectName?: string`；`src/schemas/config.ts:18-21` 已加入 `projectName: z.string().trim().min(1).optional()`，可拒绝空白项目名并返回统一 schema 校验错误；`src/utils/config-loader.ts:27-33` 通过 `validateConfig()` 加载并合并默认配置，因此配置中的 `projectName` 会按 schema trim 后进入运行时配置。

导出服务侧，`src/services/export-service.ts:96-120` 已将快照 `project` 字段改为 `resolveProjectName(projectRoot)`，该函数优先返回 `loadConfig(projectRoot).projectName`，缺失时回退 `basename(resolve(projectRoot))`。`tests/unit/services/export-service.test.ts:264-281` 覆盖配置项目名优先；`tests/unit/services/export-service.test.ts:283-303` 保留缺配置时目录名回退；`tests/unit/schemas/config.test.ts:11-63` 覆盖 schema 接收与拒绝空白 `projectName`；`tests/unit/utils/config-loader.test.ts:35-132` 覆盖 YAML 优先、JSON 加载和 trim 行为。

Rule Document Registry 相关文档也已同步：`_bmad-output/project-context.md:469`、`_bmad-output/planning-artifacts/architecture/03-core-architectural-decisions.md:156`、`_bmad-output/planning-artifacts/architecture/04-implementation-patterns-consistency-rules.md:257-263` 均已将配置字段基线更新为 9 项并加入 `projectName`。因此 Round 1 #1 可关闭。

### Round 2 / Finding #1 — Windows 跨盘符或 UNC 绝对输出路径可绕过 projectRoot 边界检查：持续有效

经代码验证，`src/cli/commands/export.ts:18-30` 保留可注入 `pathApi`，`src/cli/commands/export.ts:69-105` 继续通过 `pathApi.isAbsolute(relativeOutputPath)` 拒绝 win32 跨 root 结果。`tests/unit/cli/commands/export.test.ts:293-332` 仍覆盖 `D:\outside.json` 与 `\\server\share\outside.json`，并断言拒绝时不调用 `serviceFactory()`。该项持续关闭。

### Round 1 / Finding #2 — `--output` 可解析到 projectRoot 外：持续有效

经代码验证，`tests/unit/cli/commands/export.test.ts:240-291` 覆盖 POSIX 项目外相对路径、项目外绝对路径和带空白项目外路径，并断言拒绝时不初始化 `serviceFactory()`。结合 win32 测试，入口层路径边界主路径持续有效。

### 历史 CR TODO（非阻塞）

| # | 发现 | 状态 | 评估意见 |
|---|------|------|---------|
| R1-#3 | 快照排序使用默认 `localeCompare` | CR TODO / 非阻塞 | 同意维持 P2。影响跨环境 diff 稳定性，但不改变导出数据内容，不阻塞当前 AC 主路径。 |
| R1-defer | 快照写入缺少原子写入或覆盖语义测试 | CR TODO / 非阻塞 | 同意维持可靠性增强项。当前无证据表明其阻塞 AC1-AC7。 |
| R2-defer | symlink 物理逃逸硬化 | CR TODO / 非阻塞 | 同意维持后续加固项。当前入口层词法路径边界已覆盖主要交付门禁。 |
| R3-defer | UNC projectRoot 与目录形态 `--output` 测试硬化 | CR TODO / 非阻塞 | 同意维持低风险测试/语义硬化项，不阻塞当前 AC 主路径。 |
| R4-defer | `loadConfig()` 错误路径副作用测试硬化 | CR TODO / 非阻塞 | 同意作为测试硬化项跟踪。非法配置属于项目配置错误，不同于 CLI path/input 纯输入错误；当前实现会以 `ConfigError` 映射退出码 2，虽可补充副作用断言，但不阻塞当前主路径。 |

---

## 发现 #1 评估

### 审查原文

> **Round 4 / defer — `loadConfig()` 错误路径副作用测试硬化**
> - 来源：blind
> - 分类：defer

### 评估结论：⚠️ 有效但降级 — 建议纳入 CR TODO 跟踪（P2 优先级）

### 评估分析

**问题描述准确性：基本准确**

审查原文基本成立。`ExportService.exportSnapshot()` 先调用 `this.buildSnapshot()`（`src/services/export-service.ts:70-76`），而 `buildSnapshot()` 会先读取仓储中的 documents / relations，再调用 `resolveProjectName(projectRoot)`（`src/services/export-service.ts:96-120`）；如果 `cord.config` 中的 `projectName` 非法，`loadConfig(projectRoot)` 会在这些仓储读取之后抛出 `ConfigError`。CLI 默认路径也会在 `createDefaultExportService()` 中先创建 `.cord` 目录并初始化 repository（`src/cli/commands/export.ts:69-75`），之后才在 service 执行过程中触发配置读取错误。

但该问题的边界需要收窄：现有架构规则中“必须在 `serviceFactory()` 前拒绝并避免副作用”的硬门禁主要针对 CLI 参数、路径型输入和 schema 输入错误（例如 `--output` 项目外路径），而不是项目根目录下已存在但内容非法的配置文件。配置文件非法属于项目环境/配置错误，CLI 目前会通过 `ConfigError` 映射为退出码 2，并不是数据错误或 AC 主路径缺失。

**严重性判断：合理**

作为 `defer` / 非阻塞观察合理。补充非法配置路径下的副作用、退出码和错误输出测试有价值，尤其可明确是否应在 repository 读取前解析 `projectName`；但当前 Story 的核心 AC 是 JSON 快照导出、项目名来源、路径边界和 CLI 输出，现有实现与测试已覆盖主路径。

**修复建议：可行但非必要**

修复建议可行。后续可补充 CLI 或 service 测试，覆盖非法 `projectName` 时的退出码 2、错误输出、是否创建 `.cord`、是否读取 repository；若团队希望完全避免配置错误路径副作用，也可把 `resolveProjectName(projectRoot)` 提前到仓储读取之前，或在 CLI 层预加载配置。但这属于行为硬化，不应阻塞本轮交付。

**误报评估：非误报**

该观察不是误报；它指出了真实可改进的错误路径顺序和测试缺口。但它被正确归入 `defer`，不应升级为阻塞项。

---

## 整体评估结论

### 需要修复（阻塞交付）

无。

### 建议纳入 CR TODO 跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| R1-#3 | 快照排序使用默认 `localeCompare` | [中] | **P2** | 维持历史评估结论，作为跨环境 diff 稳定性加固项跟踪。 |
| R1-defer | 快照写入缺少原子写入或覆盖语义测试 | defer | **P2** | 维持可靠性增强项，不阻塞当前 AC 主路径。 |
| R2-defer | symlink 物理逃逸硬化 | defer | **P2** | 维持后续硬化项，不阻塞当前 AC 主路径。 |
| R3-defer | UNC projectRoot 与目录形态 `--output` 测试硬化 | defer | **P2** | 维持低风险测试/语义硬化项，不阻塞当前 AC 主路径。 |
| 1 | `loadConfig()` 错误路径副作用测试硬化 | defer | **P2** | 非法配置错误路径可补副作用/退出码测试，但不影响导出主路径或已关闭阻塞项。 |

### 可忽略（误报）

无。

### 评估决定

- **Round 1 / Finding #1（`project` 字段来源与 Story Dev Notes 裁决不一致）**：确认已修复并可关闭；`projectName` 裁决已同步到代码、测试和 Rule Document Registry 文档。
- **Round 2 / Finding #1（Windows 跨盘符或 UNC 输出路径边界）**：确认持续有效并可维持关闭。
- **Round 1 / Finding #2（`--output` projectRoot 外路径）**：确认持续有效并可维持关闭。
- **发现 #1（`loadConfig()` 错误路径副作用测试硬化）**：确认有效但维持 P2 CR TODO，不阻塞当前交付。
- **整体决定**：本轮无阻塞项，评估同意 Round 4 审查“通过”的结论。

## 验证摘要

- `npx vitest run tests/unit/services/export-service.test.ts tests/unit/schemas/config.test.ts tests/unit/utils/config-loader.test.ts tests/unit/cli/commands/export.test.ts` ✅ 通过（4 个测试文件，34 个测试）
- VS Code 问题检查：`src/types/config.ts`、`src/schemas/config.ts`、`src/services/export-service.ts`、`tests/unit/services/export-service.test.ts`、`tests/unit/schemas/config.test.ts`、`tests/unit/utils/config-loader.test.ts` 无错误。

## 修复执行记录

### 修复执行记录
- **Date**: 2026-05-13
- **Model Used**: GPT-5.4
- **Fix Items**: 0

- **本轮“需要修复（阻塞交付）”条目**: 无
- **执行结果**: 未修改源码
- **原因**: Round 4 评估结论中“需要修复（阻塞交付）”为空；唯一新增项 `loadConfig()` 错误路径副作用测试硬化已被明确降级为 P2 / defer。根据 fixer 规则，本轮不扩大修复范围处理非阻塞项。
- **影响文件**: 无
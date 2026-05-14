---
Story: 3-4
Round: 2
Date: 2026-05-13
Model Used: GitHub Copilot (VS Code Chat)
Type: Code Review Summary
---

## 审查结论

本轮为复审。三层审查均完成（blind / edge / auditor，无失败层）。Round 1 #2 的 macOS/Unix 词法路径边界修复已落地并有测试覆盖；`npm test`、`npm run lint`、`npm run build` 均通过。当前仍存在 Round 1 #1 的待裁决阻塞项，并新增 1 个与 #2 同域的 Windows 跨盘符/UNC 边界缺口，建议暂不通过。

## 上轮问题回顾

### 已修复

1. Round 1 / Finding #2 — `--output` 可解析到 projectRoot 外
   - 修复位置：`src/cli/commands/export.ts:69-96`。
   - 修复方式：CLI 在 `serviceFactory()` 前对 `--output` 做 `trim()`、`resolve(projectRoot, value)`、`relative(projectRoot, absolutePath)`，并拒绝 `''`、`..`、`../...` 及 macOS/Unix 项目外绝对路径。
   - 验证结果：`tests/unit/cli/commands/export.test.ts` 已覆盖合法相对路径、项目内绝对路径、项目外相对路径、项目外绝对路径和带空白项目外路径，并断言拒绝时不调用 `serviceFactory()`。

### 仍为非阻塞待办

1. Round 1 / Finding #3 — 快照排序使用默认 `localeCompare`
   - 维持既有评估结论：P2 / CR TODO / 非阻塞。

2. Round 1 / defer — 快照写入缺少原子写入或覆盖语义测试
   - 维持既有评估结论：可靠性增强项 / 非阻塞。

## 新发现

### 1. [中][新] Windows 跨盘符或 UNC 绝对输出路径可绕过 projectRoot 边界检查

- **来源**：edge
- **分类**：patch

- **证据**
  - `src/cli/commands/export.ts:85-94` 将 `relative(projectRoot, absoluteOutputPath)` 的结果只归一化反斜杠并检查 `''`、`'..'`、`'../'`。
  - 在 Windows 上，若 `projectRoot` 为 `C:\repo`，用户传入 `D:\outside.json` 或 `\\server\share\outside.json`，`path.relative()` 可能返回仍为绝对路径的跨盘符/UNC 结果；替换为 `/` 后不以 `../` 开头。
  - `src/services/export-service.ts:116-121` 后续仍会再次 `resolve(projectRoot, outputPath)`，跨盘符/UNC 结果会保持项目根外位置。
  - `tests/unit/cli/commands/export.test.ts:240-291` 当前只覆盖 POSIX 风格项目外绝对路径，未覆盖 win32 跨盘符或 UNC 语义。

- **影响**
  - 在 Windows 环境下，项目外输出路径可能通过入口校验，并且会在输入错误场景初始化 `serviceFactory()`，破坏 Round 1 #2 要求的 projectRoot 边界与“纯输入错误不产生副作用”契约。

- **建议**
  - 在路径归一化时显式处理跨 root 情况：例如基于 `path.parse(...).root` / `path.isAbsolute(relativePath)` 或 win32/posix 分支拒绝跨盘符与 UNC。
  - 补充 win32 路径语义单元测试，覆盖 `D:\outside.json` 与 `\\server\share\outside.json`，并断言 `serviceFactory()` 不被调用。

### 2. [高] Round 1 #1 project 字段来源仍待产品/架构裁决

- **来源**：auditor
- **分类**：decision_needed

- **证据**
  - `src/services/export-service.ts:96-109` 当前仍使用 `basename(resolve(projectRoot))` 作为 `project`。
  - `_bmad-output/implementation-artifacts/code-reviews/3-4-code-review/3-4-code-review-evaluation-20260512-round-1.md:132-146` 明确记录该项为 `decision_needed`，缺少裁决前未修改源码。

- **影响**
  - 该项不是本轮新发现，但仍是当前交付阻塞项。若项目显示名与目录名不同，快照 `project` 字段来源仍未与 Story Dev Notes 完成一致性裁决。

- **建议**
  - 先完成产品/架构裁决：接受目录名、引入配置字段，或指定其它来源。
  - 裁决后同步实现、测试和相关规则文档。

## 验证摘要

- `npm test` ✅ 通过（340 / 340，35 个测试文件）
- `npm run lint` ✅ 通过
- `npm run build` ✅ 通过（ESM 与 DTS 构建成功）
- 额外复核：
  - Pylance/VS Code 问题检查：`src/cli/commands/export.ts`、`tests/unit/cli/commands/export.test.ts`、`src/services/export-service.ts` 无错误。
  - 复核 Round 1 #2 的修复路径与测试覆盖，确认 POSIX/macOS 场景已修复。
  - 复核 Round 1 #1 仍为待裁决状态，未误标为本轮新增。

## 通过项

- AC1-AC7 主路径仍被满足：导出服务、schemaVersion、ISO exportedAt、documents/relations、camelCase/null 保留、CLI 命令注册、默认项目根输出和空图谱测试均存在。
- `cord export --output` 的常规相对路径、`./` 相对路径、项目内绝对路径和 POSIX 项目外路径测试覆盖已明显增强。
- Round 1 #2 在 macOS/Unix 语义下的修复持续有效。
- 已知既有问题仍为非阻塞：默认 `localeCompare` 排序、直接 `writeFile()` 覆盖输出、symlink 物理逃逸硬化均建议进入 CR TODO 或后续加固，不作为本轮 AC 主路径阻塞。

## 结论

- **结论：不通过**
- **阻塞项**：
  - Round 1 #1：`project` 字段来源仍需产品/架构裁决。
  - Round 2 #1：Windows 跨盘符/UNC 绝对输出路径可能绕过 projectRoot 边界检查。
- **建议**：先裁决并处理 `project` 字段来源；随后补齐 Windows 跨 root 输出路径拒绝逻辑与测试，再进入下一轮复审。

---
Story: 3-4
Round: 3
Date: 2026-05-13
Model Used: GitHub Copilot (VS Code Chat)
Type: Code Review Summary
---

## 审查结论

本轮为复审。三层审查均完成（blind / edge / auditor，无失败层）。Round 2 新发现 #1（Windows 跨盘符 / UNC 绝对输出路径绕过 projectRoot 边界）已修复完整；`npm test`、`npm run lint`、`npm run build` 均通过。本轮未发现新的阻塞项或中高优先级问题，但 Round 1 #1 的 `project` 字段来源仍处于产品/架构待裁决状态，因此建议暂不通过。

## 上轮问题回顾

### 已修复

1. Round 2 / Finding #1 — Windows 跨盘符或 UNC 绝对输出路径可绕过 projectRoot 边界检查
   - 修复位置：`src/cli/commands/export.ts:69-101`、`tests/unit/cli/commands/export.test.ts:293-332`。
   - 修复方式：`normalizeOutputPath()` 现在额外使用运行时 `pathApi.isAbsolute(relativeOutputPath)` 拒绝 win32 跨盘符与 UNC 跨 root 的 `relative()` 结果；`createExportCommand()` 增加可注入 `pathApi`，测试使用 `path.win32` 复现 Windows 语义。
   - 验证结果：新增 `D:\outside.json` 与 `\\server\share\outside.json` 两条回归测试，并断言拒绝时不调用 `serviceFactory()`。

2. Round 1 / Finding #2 — `--output` 可解析到 projectRoot 外
   - 修复持续有效：常规相对路径、`./` 相对路径、项目内绝对路径、POSIX 项目外路径和 win32 跨 root 路径均有入口层覆盖。

### 仍遗留阻塞项

1. Round 1 / Finding #1 — `project` 字段来源与 Story Dev Notes 裁决不一致
   - 当前状态：仍为 `decision_needed`。
   - 证据：`src/services/export-service.ts:96-109` 仍使用 `basename(resolve(projectRoot))`；Round 1 与 Round 2 评估均确认现有 `cord.config` 契约不存在可直接接入的项目名字段。
   - 后续：必须先完成产品/架构裁决，再同步实现、测试和契约文档。

### 仍为非阻塞待办

1. Round 1 / Finding #3 — 快照排序使用默认 `localeCompare`
   - 维持既有评估结论：P2 / CR TODO / 非阻塞。

2. Round 1 / defer — 快照写入缺少原子写入或覆盖语义测试
   - 维持既有评估结论：可靠性增强项 / 非阻塞。

3. Round 2 / defer — symlink 物理逃逸硬化
   - 维持既有评估结论：后续加固项 / 非阻塞。

4. Round 3 / defer — UNC projectRoot 与目录形态 `--output` 测试硬化
   - 本轮盲审提出的低风险观察：可后续补 UNC projectRoot 组合测试，并明确 `--output snapshots/` 这类目录形态语义；不阻塞当前 AC 主路径。

## 新发现

本轮未发现新的阻塞项或中高优先级问题。

## 验证摘要

- `npm test` ✅ 通过（342 / 342，35 个测试文件）
- `npm run lint` ✅ 通过
- `npm run build` ✅ 通过（ESM 与 DTS 构建成功）
- 额外复核：
  - Pylance/VS Code 问题检查：`src/cli/commands/export.ts`、`tests/unit/cli/commands/export.test.ts`、`src/services/export-service.ts` 无错误。
  - Edge Case Hunter 输出为空数组，未发现新的路径边界缺口。
  - Acceptance Auditor 确认 AC1-AC7 主路径仍满足，Round 2 新发现 #1 已修复完整。

## 通过项

- AC1-AC7 主路径仍被满足：导出服务、`schemaVersion: "1.0"`、ISO `exportedAt`、`project/documents/relations` 字段、camelCase/null 保留、CLI 命令注册、默认项目根输出和空图谱测试均存在。
- `cord export --output` 的入口层边界测试覆盖已扩展到 POSIX 项目外路径、win32 跨盘符路径和 win32 UNC 路径，且拒绝时不会初始化 `serviceFactory()`。
- Round 1 #2 与 Round 2 #1 的路径边界修复均持续有效。
- 非阻塞观察均已归入待办，不影响本轮 AC 主路径判断。

## 结论

- **结论：不通过**
- **阻塞项**：Round 1 #1 — `project` 字段来源仍需产品/架构裁决。
- **建议**：先裁决 `project` 字段来源（目录名、配置字段、`package.json name` 或其它明确来源），再同步实现、测试和相关契约文档；完成后进入下一轮复审。

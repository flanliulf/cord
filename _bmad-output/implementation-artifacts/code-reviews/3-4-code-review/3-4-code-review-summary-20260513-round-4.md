---
Story: 3-4
Round: 4
Date: 2026-05-13
Model Used: GitHub Copilot (VS Code Chat)
Type: Code Review Summary
---

## 审查结论

本轮为复审。审查层状态：blind / auditor 完成，edge 层子代理超时失败，已按降级规则使用剩余层继续，并在当前上下文中补做 projectName 边界复核。Round 3 唯一遗留阻塞项（`project` 字段来源待裁决）已完成裁决并落地为 `cord.config.projectName` 优先、缺失回退项目根目录名；`npm test`、`npm run lint`、`npm run build` 均通过。本轮未发现新的阻塞项或中高优先级问题，建议通过。

## 上轮问题回顾

### 已修复

1. Round 1 / Finding #1 — `project` 字段来源与 Story Dev Notes 裁决不一致
   - 修复位置：`src/types/config.ts:8-16`、`src/schemas/config.ts:18-21`、`src/services/export-service.ts:117-120`、`tests/unit/services/export-service.test.ts:263-281`。
   - 修复方式：裁决落地为 `cord.config.projectName` 作为快照 `project` 字段优先来源；配置缺失时回退项目根目录名。
   - 验证结果：schema、config loader、ExportService 测试均覆盖；Rule Document Registry 三份文档已同步加入 `projectName`。

2. Round 2 / Finding #1 — Windows 跨盘符或 UNC 绝对输出路径可绕过 projectRoot 边界检查
   - 修复持续有效：`normalizeOutputPath()` 使用 `pathApi.isAbsolute(relativeOutputPath)` 拒绝 win32 跨 root 结果，相关回归测试仍存在。

3. Round 1 / Finding #2 — `--output` 可解析到 projectRoot 外
   - 修复持续有效：拒绝路径仍在 `serviceFactory()` 初始化前完成。

### 仍为非阻塞待办

1. Round 1 / Finding #3 — 快照排序使用默认 `localeCompare`
   - 维持既有评估结论：P2 / CR TODO / 非阻塞。

2. Round 1 / defer — 快照写入缺少原子写入或覆盖语义测试
   - 维持既有评估结论：可靠性增强项 / 非阻塞。

3. Round 2 / defer — symlink 物理逃逸硬化
   - 维持既有评估结论：后续加固项 / 非阻塞。

4. Round 3 / defer — UNC projectRoot 与目录形态 `--output` 测试硬化
   - 维持既有评估结论：低风险测试/语义硬化项 / 非阻塞。

5. Round 4 / defer — `loadConfig()` 错误路径副作用测试硬化
   - 本轮盲审提出的低风险观察：`ExportService` 在读取仓储后解析 `projectName`，若配置非法会在仓储读取之后抛错；CLI 默认 service 初始化也会更早创建 `.cord`。建议后续补充配置错误路径的副作用、退出码和错误输出测试，不阻塞当前 AC 主路径。

## 新发现

本轮未发现新的阻塞项或中高优先级问题。

## 验证摘要

- `npm test` ✅ 通过（345 / 345，35 个测试文件）
- `npm run lint` ✅ 通过
- `npm run build` ✅ 通过（ESM 与 DTS 构建成功）
- 额外复核：
  - VS Code 问题检查：`src/types/config.ts`、`src/schemas/config.ts`、`src/services/export-service.ts`、`tests/unit/services/export-service.test.ts`、`tests/unit/schemas/config.test.ts`、`tests/unit/utils/config-loader.test.ts` 无错误。
  - 确认 `src/schemas/config.ts` 当前已包含 `projectName: z.string().trim().min(1).optional()`，Blind Hunter 关于 schema 未接入的判断为基于 diff 可见范围的误报。
  - 确认 `_bmad-output/project-context.md`、`03-core-architectural-decisions.md`、`04-implementation-patterns-consistency-rules.md` 均已同步 `projectName` 配置基线。

## 通过项

- AC1-AC7 主路径仍被满足：导出服务、`schemaVersion: "1.0"`、ISO `exportedAt`、`project/documents/relations` 字段、camelCase/null 保留、CLI 命令注册、默认项目根输出和空图谱测试均存在。
- `project` 字段来源已与 Story Dev Notes 完成裁决一致：优先读取配置项目名，缺失时回退目录名。
- `projectName` 新配置字段已同步到类型、schema、config loader 测试、ExportService 测试和 Rule Document Registry 相关文档。
- 路径边界相关历史修复（POSIX 项目外路径、win32 跨盘符/UNC）持续有效。

## 结论

- **结论：通过**
- **阻塞项**：无
- **建议**：进入后续 CR 评估/收尾流程；非阻塞 CR TODO 可继续跟踪排序稳定性、原子写入、symlink 硬化、UNC projectRoot 测试、目录形态 `--output` 语义和配置错误路径副作用测试。

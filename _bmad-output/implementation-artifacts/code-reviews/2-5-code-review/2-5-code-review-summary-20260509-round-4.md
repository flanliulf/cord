---
Story: 2-5
Round: 4
Date: 2026-05-09
Model Used: GitHub Copilot (current VS Code agent)
Type: Code Review Summary
---

## 审查结论

本轮为复审。Round 1 的两项阻塞问题仍确认已关闭；Round 2/3 遗留的真实 CLI 入口未使用 `parseAsync()` 驱动 async `scan` action 的阻塞问题，本轮确认已修复。三层审查均成功完成（blind / edge / auditor，3/3 可用）。

结论：**通过**。

## 上轮问题回顾

### 已修复

1. Round 1 / Finding #1 — 缺失关系端点会提前结束事务回调并提交不完整写入
   - 修复状态：仍确认已关闭。
   - 代码证据：`src/services/scan-service.ts` 在事务外通过 `collectPersistableRelations()` 过滤缺失端点关系并记录 warning；事务内关系端点映射失配会抛出 `ScanError`，避免提交不一致写入计划。
   - 测试证据：`tests/unit/services/scan-service.test.ts` 覆盖缺失端点关系时 warning、实际关系计数和 sync_states 写入。

2. Round 1 / Finding #2 — Commander 解析错误未统一映射为参数错误退出码 2
   - 修复状态：仍确认已关闭。
   - 代码证据：`src/cli/index.ts` 递归安装 Commander `exitOverride()`，并将非 0 Commander parse error 映射为退出码 `2`。
   - 测试证据：`tests/unit/cli/index.test.ts` 覆盖 `cord scan --unknown` 的入口级 parse error 退出码。

3. Round 2 / Round 3 Finding #1 — 真实 CLI 入口未使用 `parseAsync()` 驱动异步 scan action
   - 修复状态：本轮确认已关闭。
   - 代码证据：`src/cli/index.ts` 的 `runCli()` 已改为 `async`，并 `await program.parseAsync(process.argv)`；入口 guard 使用 `void runCli().catch(reportUnhandledCliError)` 兜底未捕获异步错误。
   - 测试证据：`tests/unit/cli/index.test.ts` 覆盖 `parseAsync` 调用、async scan 成功、ConfigError 映射为退出码 `2`、runtime error 映射为退出码 `1`。

### 仍未修复（阻塞）

无。

### 仍为非阻塞待办

1. `--verbose` 生效时机：`runCli()` 当前先等待 `parseAsync()` 完成再调用 `applyVerboseFlag()`，因此 `cord --verbose scan` 的 debug 状态不会在 async scan action 内生效。`CORD_DEBUG=1` 不受影响，因为 logger 构造时已读取环境变量。该问题不影响 Story 2.5 AC 通过，但建议后续修复。
2. 默认非 rebuild 重复执行 `cord scan`：当前冷启动写入会再次调用 `addDocument()`，遇到 `documents.path UNIQUE` 会失败。该行为属于 Story 2.6 的“自动判断冷启动/增量扫描”和增量幂等语义范围，本轮不作为 Story 2.5 阻塞。

## 新发现

### 非阻塞 / TODO

1. `--verbose` 在 async 子命令执行完成后才生效
   - 来源：Blind Hunter + Edge Case Hunter。
   - 分类：P3 / 非阻塞。
   - 影响：`cord --verbose scan` 的 debug 输出在 scan action 执行期间仍被抑制；环境变量 `CORD_DEBUG=1` 正常。
   - 建议：在 root program 上注册 Commander `preAction` hook，或在 parse 前预解析 root verbose flag；补充真实子命令 action 内 debug 行为测试。

### 延后 / 非本 Story 范围

1. 默认非 rebuild 重复扫描会撞唯一约束
   - 来源：Blind Hunter。
   - 分类：P3 / 延后到 Story 2.6。
   - 影响：在已有图谱的项目中重复执行默认 `cord scan` 可能因 `documents.path UNIQUE` 失败。
   - 范围判断：Story 2.5 明确是冷启动扫描与从零建立图谱；规划中的 Story 2.6 承接已有图谱下的增量扫描、无变更快速返回、生命周期检测和幂等语义。

### 误报 / 已覆盖

无。

## 验证摘要

- `npm test` ✅ 通过（27 个测试文件，266 / 266）
- `npm run type-check` ✅ 通过
- `npm run lint` ✅ 通过
- `npm run build` ✅ 通过
- Acceptance Auditor：未发现 AC 阻塞问题；确认 Round 2/3 `parseAsync` 问题已关闭。
- Edge Case Hunter：确认遗留 async entrypoint 问题关闭；仅提出 `--verbose` 生效时机的非阻塞缺口。
- Blind Hunter：提出重复默认扫描与 verbose 时机两个候选；经去重分类后均非 Story 2.5 阻塞。

## 通过项

- ScanService 冷启动扫描编排、事务保护、缺失端点过滤、关系计数和 sync_states 写入保持有效。
- `cord scan` 命令工厂层覆盖人类可读输出、JSON 输出、参数错误和运行时错误。
- CLI 真实入口现在等待 async scan action 完成，并覆盖成功、ConfigError、runtime error、Commander parse error 路径。
- AC1-AC11 在本轮未发现阻塞缺口。

## 结论

- **结论：通过**
- **阻塞项**：0 个。
- **非阻塞 TODO**：1 个 — `--verbose` 应在 async command action 执行前生效。
- **延后范围项**：1 个 — 默认非 rebuild 重复扫描的增量/幂等语义应由 Story 2.6 处理。
- **建议**：Story 2.5 可进入后续流程；将上述非阻塞项纳入 CR TODO 或后续 Story 跟踪。

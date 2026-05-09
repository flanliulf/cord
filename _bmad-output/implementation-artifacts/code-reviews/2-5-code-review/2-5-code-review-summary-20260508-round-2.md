---
Story: 2-5
Round: 2
Date: 2026-05-08
Model Used: GitHub Copilot (current VS Code agent)
Type: Code Review Summary
---

## 审查结论

本轮为复审。Round 1 的两项阻塞问题均已修复，`npm test`、`npm run lint`、`npm run build` 均通过。三层审查均成功完成（blind / edge / auditor，3/3 可用），但本轮发现 1 个新的中严重性 CLI 入口异步执行契约问题；建议修复后再进入下一轮复审。

## 上轮问题回顾

### 已修复

1. Round 1 / Finding #1 — 缺失关系端点会提前结束事务回调并提交不完整写入
   - 修复位置：`src/services/scan-service.ts` 将关系端点完整性校验移动到事务外，新增 `collectPersistableRelations()` 预过滤不可持久化关系并追加 warning；`relationsDiscovered` 改为实际可持久化关系数。
   - 事务内防御：若关系计划与已持久化文档映射失配，会抛出 `ScanError`，避免正常提交不一致状态。
   - 验证结果：`tests/unit/services/scan-service.test.ts` 新增缺失端点回归测试，确认 warning 可见、关系计数正确且 sync_states 仍写入。

2. Round 1 / Finding #2 — Commander 解析错误未统一映射为参数错误退出码 2
   - 修复位置：`src/cli/index.ts` 在 CLI 入口递归启用 Commander `exitOverride()`，识别非 0 Commander parse error 并映射为退出码 2，同时保留 help 的 0 退出语义。
   - 验证结果：`tests/unit/cli/index.test.ts` 新增 `cord scan --unknown` 入口级回归测试，覆盖 AC8 的 parse error 退出码契约。

### 仍为非阻塞待办

无。

## 新发现

### 1. [中][新] 真实 CLI 入口未使用 parseAsync 驱动异步 scan action

- **来源**：blind
- **分类**：patch

- **证据**
  - `src/cli/index.ts:32-36` 的 `runCli()` 调用 `program.parse(process.argv)` 后立即执行 verbose 处理并返回。
  - `src/cli/commands/scan.ts` 的 scan 子命令 action 是 `async`，内部会 `await service.scan(...)`；Commander 异步 action 应由 `parseAsync()` 驱动，才能让入口等待 action 完成。
  - `tests/unit/cli/commands/scan.test.ts` 的命令测试使用 `program.parseAsync(...)`，而 `tests/unit/cli/index.test.ts` 新增入口测试只覆盖未知 option 的 parse error，未覆盖真实 `runCli()` 执行 scan 成功、ConfigError 或运行时错误这些 async action 路径。

- **影响**
  - 真实 CLI 入口与测试路径不一致：调用方无法等待 `runCli()` 完成扫描、输出和 exitCode 设置。
  - 异步 action 中的 stdout/stderr 和 `process.exitCode` 可能在 `runCli()` 返回后才发生，入口级测试无法稳定断言成功/失败路径，后续改动也更容易引入未被测试捕获的 CLI 行为回归。

- **建议**
  - 将 `runCli()` 改为 async，并使用 `await program.parseAsync(process.argv)` 驱动 Commander。
  - 入口 guard 调用处同步调整为处理返回 Promise 的形式，确保异步失败不会被吞掉。
  - 补充入口级测试覆盖 `cord scan --json` 成功、业务 `ConfigError` 退出码 2、运行时错误退出码 1，避免只在 command factory 层使用 `parseAsync()` 覆盖。

## 验证摘要

- `npm test` ✅ 通过（263 / 263）
- `npm run lint` ✅ 通过
- `npm run build` ✅ 通过
- 额外复核：
  - Round 1 Finding #1 已关闭：缺失端点关系在事务外过滤，sync_states 写入不再被提前跳过。
  - Round 1 Finding #2 已关闭：Commander parse error 已映射为退出码 2，并有入口级未知 option 测试。
  - Edge Case Hunter 与 Acceptance Auditor 本轮未发现遗留阻塞或 AC 缺口。

## 通过项

- ScanService 的缺失端点处理、关系计数和 sync_states 写入已具备回归测试覆盖。
- AC1-AC11 在当前实现中均有对应实现或测试证据；manual 关系确认逻辑仍按 Story 文本归属 Story 4.2。
- 当前质量门禁通过，且 Round 1 两个 P1 阻塞项均已关闭。

## 结论

- **结论：不通过**
- **阻塞项**：1 个新发现 — 真实 CLI 入口未使用 `parseAsync()` 驱动异步 scan action。
- **建议**：修复 CLI 入口异步解析/等待语义并补充入口级 async action 测试后，执行第 3 轮复审。

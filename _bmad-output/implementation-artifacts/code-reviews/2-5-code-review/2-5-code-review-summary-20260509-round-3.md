---
Story: 2-5
Round: 3
Date: 2026-05-09
Model Used: GitHub Copilot (current VS Code agent)
Type: Code Review Summary
---

## 审查结论

本轮为复审。Round 1 的两项阻塞问题仍确认已修复，但 Round 2 新增的 CLI 入口异步执行契约问题未关闭，属于上轮遗留阻塞项。三层审查均成功完成（blind / edge / auditor，3/3 可用）。`npm test`、`npm run type-check`、`npm run lint`、`npm run build` 均通过；建议修复遗留问题后再进入下一轮复审。

## 上轮问题回顾

### 已修复

1. Round 1 / Finding #1 — 缺失关系端点会提前结束事务回调并提交不完整写入
   - 修复位置：`src/services/scan-service.ts` 已在事务外通过 `collectPersistableRelations()` 过滤缺失端点关系并记录 warning；事务内映射失配会抛出 `ScanError`。
   - 验证结果：`tests/unit/services/scan-service.test.ts` 覆盖缺失端点关系时 warning、实际关系计数和 sync_states 写入；本轮复审未发现回归。

2. Round 1 / Finding #2 — Commander 解析错误未统一映射为参数错误退出码 2
   - 修复位置：`src/cli/index.ts` 已递归安装 Commander `exitOverride()`，并将非 0 parse error 映射为退出码 2。
   - 验证结果：`tests/unit/cli/index.test.ts` 覆盖 `cord scan --unknown` 的入口级 parse error 退出码；本轮复审未发现回归。

### 仍未修复（阻塞）

1. Round 2 / Finding #1 — 真实 CLI 入口未使用 `parseAsync` 驱动异步 scan action
   - 维持既有评估结论：P1 / 阻塞交付。
   - 当前证据：`src/cli/index.ts` 的 `runCli()` 仍声明为同步 `void` 并调用 `program.parse(process.argv)`；入口 guard 仍直接调用 `runCli()`，没有处理异步 Promise。
   - 测试缺口：入口级测试仍只覆盖 Commander parse error；真实 `runCli()` 驱动 async scan action 的成功、ConfigError、runtime error 路径仍未覆盖。

### 仍为非阻塞待办

无。

## 新发现

本轮未发现新的阻塞项或中高优先级问题。

## 验证摘要

- `npm test` ✅ 通过（263 / 263）
- `npm run type-check` ✅ 通过
- `npm run lint` ✅ 通过
- `npm run build` ✅ 通过
- 额外复核：
  - Round 1 两项阻塞修复仍有效。
  - Round 2 Finding #1 仍遗留：真实 CLI 入口没有使用 `parseAsync()` 等待 async scan action。
  - Blind Hunter 提出的 `--rebuild` manual 保护与默认非 rebuild 重复扫描风险，仍分别落在 Story 4.2 manual 检测和 Story 2.6 增量/幂等语义范围内，本轮未升级为 Story 2.5 阻塞。

## 通过项

- ScanService 冷启动扫描、缺失端点过滤、关系计数、sync_states 写入和事务回滚路径已有测试覆盖。
- `cord scan` 命令工厂层覆盖成功输出、JSON 输出、业务配置错误和运行时错误。
- AC1-AC11 除真实入口等待 async action 的 AC8 入口级保障缺口外，均有实现或测试证据支撑。

## 结论

- **结论：不通过**
- **阻塞项**：1 个上轮遗留阻塞项 — 真实 CLI 入口未使用 `parseAsync()` 驱动异步 scan action。
- **建议**：将 `runCli()` 改为 async 并 `await program.parseAsync(process.argv)`；入口 guard 处理返回 Promise；补充真实 `runCli()` 层的 async scan 成功、ConfigError 退出码 2、runtime error 退出码 1 测试后，执行第 4 轮复审。

---
Story: 2-5
Round: 2
Date: 2026-05-08
Model Used: GitHub Copilot (current VS Code agent)
Review Source: 2-5-code-review-summary-20260508-round-2.md
Review Model: GitHub Copilot (current VS Code agent)
Type: Code Review Evaluation
---

## 评估总结

对 Story 2-5 的第 2 轮 CR 代码审查结果（复审）进行逐条评估。本轮审查确认 Round 1 的两个阻塞问题已修复，并新增 1 个中严重性 CLI 入口异步执行契约问题。经独立代码验证，上轮两个问题均可确认关闭；新增发现确认有效，建议作为阻塞交付修复项处理。

---

## 上轮问题回顾确认

### Round 1 Finding #1 — 缺失关系端点会提前结束事务回调并提交不完整写入：已修复

经代码验证，`src/services/scan-service.ts:99-104` 已在事务外调用 `collectPersistableRelations()` 预过滤可持久化关系；`src/services/scan-service.ts:365-386` 会仅保留 source/target 均在当前已分类文档集合内的关系，并对缺失端点关系追加 warning。事务内 `src/services/scan-service.ts:131-141` 也保留防御性 `ScanError`，避免关系计划与已持久化文档映射不一致时正常提交。返回值已改为 `src/services/scan-service.ts:180` 的 `persistableRelations.length`。

测试验证也已补齐：`tests/unit/services/scan-service.test.ts:322-340` 构造缺失端点关系，`tests/unit/services/scan-service.test.ts:441-448` 断言缺失端点 warning、实际关系计数为 1，且 sync_states 仍写入 2 条。该问题可关闭。

### Round 1 Finding #2 — Commander 解析错误未统一映射为参数错误退出码 2：已修复

经代码验证，`src/cli/index.ts:32-47` 已在 `runCli()` 中递归安装 `exitOverride()` 并捕获 Commander parse error，将非 0 parse error 映射为 `process.exitCode = 2`；`src/cli/index.ts:50-75` 区分了非 0 parse error 与 help 的 0 退出语义。`tests/unit/cli/index.test.ts:104-118` 覆盖了真实 CLI 入口 `cord scan --unknown` 的退出码 2 行为。该问题可关闭。

### 历史 CR TODO（非阻塞）

| # | 发现 | 状态 | 评估意见 |
|---|------|------|---------|
| - | - | - | 本轮审查未列出历史非阻塞 TODO。 |

---

## 发现 #1 评估

### 审查原文

> **[中][新] 真实 CLI 入口未使用 parseAsync 驱动异步 scan action**
> - 来源：blind
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：准确**

代码验证确认该问题存在。`src/cli/index.ts:32-47` 的 `runCli()` 仍是同步函数，核心调用为 `src/cli/index.ts:37` 的 `program.parse(process.argv)`。与此同时，scan 子命令在 `src/cli/commands/scan.ts:43` 注册的是 `async` action，内部会 `await service.scan(...)`、写 stdout/stderr 并设置 `process.exitCode`。

测试路径也支持审查判断：`tests/unit/cli/commands/scan.test.ts:25-34` 的 command factory 层测试通过 `program.parseAsync(...)` 驱动 async action，因此这些测试不能证明真实 `runCli()` 入口会等待 scan action 完成。`tests/unit/cli/index.test.ts:104-118` 当前只覆盖未知 option 的 parse error 映射，未覆盖真实入口的 scan 成功、业务 `ConfigError`、运行时错误等 async action 路径。

**严重性判断：合理**

原始严重性标为中等合理。该问题不直接破坏 ScanService 写库逻辑，但会造成真实 CLI 入口与测试驱动路径不一致，使调用方无法可靠等待 `runCli()` 的扫描完成、输出完成和 exitCode 设置完成。由于 Story 2-5 已引入 async scan command，CLI 入口契约和测试覆盖属于本 Story 交付面，评估后建议按 P1 阻塞交付处理。

**修复建议：可行**

修复建议可行。建议将 `runCli()` 改为 async，使用 `await program.parseAsync(process.argv)` 驱动 Commander；入口 guard 调用处应处理返回 Promise，确保异步失败不会静默丢失。同时应补充入口级测试，覆盖 `cord scan --json` 成功、业务 `ConfigError` 退出码 2、运行时错误退出码 1，以保证真实入口与 command factory 层行为一致。

**误报评估：非误报**

不是误报。当前真实入口确实没有使用 `parseAsync()`，也没有提供可等待的 `runCli()` Promise；现有入口测试未覆盖 async scan action 的成功/失败路径。

---

## 整体评估结论

### 需要修复（阻塞交付）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 1 | 真实 CLI 入口未使用 parseAsync 驱动异步 scan action | [中] | **P1** | 真实入口无法可靠等待 async scan action 完成，CLI 入口契约和测试覆盖不足。 |

### 建议纳入 CR TODO 跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| - | - | - | - | 本轮无建议延后到 CR TODO 的发现。 |

### 可忽略（误报）

| # | 发现 | 原始严重性 | 忽略理由 |
|---|------|----------|---------|
| - | - | - | 本轮无误报。 |

### 评估决定

- **Round 1 Finding #1（缺失关系端点会提前结束事务回调并提交不完整写入）**：确认已修复，可关闭。
- **Round 1 Finding #2（Commander 解析错误未统一映射为参数错误退出码 2）**：确认已修复，可关闭。
- **发现 #1（真实 CLI 入口未使用 parseAsync 驱动异步 scan action）**：确认有效，需修复后复审。建议将 `runCli()` 改为 async 并使用 `parseAsync()`，同时补充入口级 async action 成功/失败测试。
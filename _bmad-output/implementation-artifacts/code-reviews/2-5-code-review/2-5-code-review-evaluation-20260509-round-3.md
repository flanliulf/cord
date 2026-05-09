---
Story: 2-5
Round: 3
Date: 2026-05-09
Model Used: GitHub Copilot (current VS Code agent)
Review Source: 2-5-code-review-summary-20260509-round-3.md
Review Model: GitHub Copilot (current VS Code agent)
Type: Code Review Evaluation
---

## 评估总结

对 Story 2-5 的第 3 轮 CR 代码审查结果（复审）进行逐条评估。本轮审查未提出新的阻塞项或中高优先级问题，但指出 Round 2 的 CLI 入口异步执行契约问题仍未关闭。经独立代码验证，Round 1 的两个阻塞问题仍保持关闭；Round 2 遗留问题确认仍有效，建议继续作为阻塞交付修复项处理。

---

## 上轮问题回顾确认

### Round 1 Finding #1 — 缺失关系端点会提前结束事务回调并提交不完整写入：仍确认已修复

经代码验证，`src/services/scan-service.ts:99` 仍在事务外计算 `persistableRelations`，`src/services/scan-service.ts:365` 定义的 `collectPersistableRelations()` 会过滤缺失端点关系，`src/services/scan-service.ts:384` 会为被跳过关系追加 warning。事务内 `src/services/scan-service.ts:137` 保留映射失配时抛出 `ScanError` 的防御逻辑，返回值也保持为 `src/services/scan-service.ts:180` 的 `persistableRelations.length`。

测试验证仍在位：`tests/unit/services/scan-service.test.ts:435` 覆盖缺失端点关系场景，`tests/unit/services/scan-service.test.ts:446` 断言 warning，`tests/unit/services/scan-service.test.ts:448` 断言 sync_states 仍写入 2 条。该问题仍可关闭。

### Round 1 Finding #2 — Commander 解析错误未统一映射为参数错误退出码 2：仍确认已修复

经代码验证，`src/cli/index.ts:34` 仍在 `runCli()` 中递归安装 Commander `exitOverride()`，`src/cli/index.ts:40` 识别 Commander parse error，`src/cli/index.ts:48` 将非 0 parse error 映射为退出码 2。`tests/unit/cli/index.test.ts:104` 覆盖真实 CLI 入口 parse error 映射，`tests/unit/cli/index.test.ts:106` 使用 `cord scan --unknown` 场景验证该契约。该问题仍可关闭。

### Round 2 Finding #1 — 真实 CLI 入口未使用 parseAsync 驱动异步 scan action：仍未修复

经代码验证，`src/cli/index.ts:32` 的 `runCli()` 仍声明为同步 `void`，`src/cli/index.ts:37` 仍调用 `program.parse(process.argv)`，入口 guard 在 `src/cli/index.ts:95` 仍直接调用 `runCli()`，没有处理 Promise。与此同时，`src/cli/commands/scan.ts:43` 的 scan command action 仍是 `async`，内部会等待 `service.scan(...)` 后写输出和设置 `process.exitCode`。因此真实 CLI 入口仍没有使用 `parseAsync()` 驱动并等待 async action 完成。

测试缺口也仍存在：`tests/unit/cli/commands/scan.test.ts:31` 的 command factory 层测试使用 `program.parseAsync(...)`，但 `tests/unit/cli/index.test.ts:104` 的真实入口测试仍只覆盖未知 option parse error；未覆盖 `runCli()` 层面的 scan 成功、业务 `ConfigError` 和 runtime error async action 路径。

### 历史 CR TODO（非阻塞）

| # | 发现 | 状态 | 评估意见 |
|---|------|------|---------|
| - | - | - | 本轮审查未列出历史非阻塞 TODO。 |

---

## 发现 #1 评估

### 审查原文

> **[遗留][P1] 真实 CLI 入口未使用 parseAsync 驱动异步 scan action**
> - 来源：blind+edge+auditor
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：准确**

审查结论准确。当前 `runCli()` 仍是同步入口，调用 `program.parse(process.argv)` 后即执行 verbose 处理并返回；真实入口 guard 也直接调用 `runCli()`。由于 scan 子命令 action 是 async，当前实现无法给调用方提供一个可等待的 CLI 执行完成点，也无法用入口级测试稳定断言 action 完成后的 stdout/stderr 与 `process.exitCode`。

**严重性判断：合理**

严重性维持 P1 合理。该问题属于 CLI 真实入口契约缺陷和测试覆盖缺口，不影响 ScanService 内部写库逻辑，但会影响 `cord scan` 作为用户命令的完成语义，也会削弱 AC8 退出码契约在真实入口 async action 路径上的保障。

**修复建议：可行**

审查建议可行。建议将 `runCli()` 改为 async，使用 `await program.parseAsync(process.argv)`；入口 guard 调用处处理返回 Promise，至少确保异步错误不会被吞掉。同时补充真实 `runCli()` 层测试，覆盖 scan 成功、业务 `ConfigError` 映射为 2、runtime error 映射为 1。

**误报评估：非误报**

不是误报。当前源码和测试均显示该问题仍存在，Round 2 评估中的阻塞结论未被新的代码修改关闭。

---

## 整体评估结论

### 需要修复（阻塞交付）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 1 | 真实 CLI 入口未使用 parseAsync 驱动异步 scan action | [中/遗留] | **P1** | `runCli()` 仍同步调用 `parse()`，真实入口无法可靠等待 async scan action 完成。 |

### 建议纳入 CR TODO 跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| - | - | - | - | 本轮无建议延后到 CR TODO 的发现。 |

### 可忽略（误报）

| # | 发现 | 原始严重性 | 忽略理由 |
|---|------|----------|---------|
| - | - | - | 本轮无误报。 |

### 评估决定

- **Round 1 Finding #1（缺失关系端点会提前结束事务回调并提交不完整写入）**：仍确认已修复，可继续关闭。
- **Round 1 Finding #2（Commander 解析错误未统一映射为参数错误退出码 2）**：仍确认已修复，可继续关闭。
- **Round 2 Finding #1（真实 CLI 入口未使用 parseAsync 驱动异步 scan action）**：确认仍有效且未关闭，需修复后复审。建议将 `runCli()` 改为 async 并使用 `parseAsync()`，入口 guard 处理 Promise，并补充真实入口 async action 成功/失败测试。

## 修复执行记录

### 修复执行记录
- **Date**: 2026-05-09
- **Model Used**: GPT-5.4
- **Fix Items**: 1

#### 1. 修复真实 CLI 入口未使用 parseAsync 驱动异步 scan action
- **涉及文件**:
	- `src/cli/index.ts`
	- `tests/unit/cli/index.test.ts`
- **修改说明**:
	- 将 `runCli()` 从同步入口改为 `async`，使用 `await program.parseAsync(process.argv)`，确保真实 CLI 入口会等待 async `scan` action 完成。
	- 保留并适配 Commander parse error → 退出码 `2` 的映射逻辑，对 `commander.helpDisplayed` 保持 `exitCode = 0`。
	- 在入口 guard 处改为处理 `runCli()` 返回的 Promise，并为未捕获的异步错误补充 stderr 输出与退出码 `1` 的兜底处理，避免 async error 被吞掉。
	- 扩展 `runCli` 层回归测试，覆盖 async scan 成功、业务 `ConfigError`、runtime error 以及 `parseAsync` 调用路径。
- **执行结果**: 已完成，验证通过。

#### 验证记录
- `npm test && npm run type-check && npm run lint`
- 结果：27 个测试文件、266 个测试全部通过；`type-check` 通过；`lint` 通过。
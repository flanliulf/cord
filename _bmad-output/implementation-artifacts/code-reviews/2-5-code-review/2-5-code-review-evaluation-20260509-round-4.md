---
Story: 2-5
Round: 4
Date: 2026-05-09
Model Used: GitHub Copilot (current VS Code agent)
Review Source: 2-5-code-review-summary-20260509-round-4.md
Review Model: GitHub Copilot (current VS Code agent)
Type: Code Review Evaluation
---

## 评估总结

对 Story 2-5 的第 4 轮 CR 代码审查结果（复审）进行逐条评估。本轮审查确认 Round 1 的两个阻塞问题仍关闭，Round 2/3 遗留的真实 CLI 入口未使用 `parseAsync()` 驱动 async `scan` action 的阻塞问题已修复；同时提出 1 个 P3 非阻塞 TODO 和 1 个延后到 Story 2.6 的范围项。经独立代码验证，阻塞项均可关闭，本轮无误报，Story 2-5 可通过。

---

## 上轮问题回顾确认

### Round 1 Finding #1 — 缺失关系端点会提前结束事务回调并提交不完整写入：仍确认已修复

经代码验证，`src/services/scan-service.ts:99` 仍在事务外计算 `persistableRelations`，`src/services/scan-service.ts:365` 定义的 `collectPersistableRelations()` 会过滤缺失端点关系，`src/services/scan-service.ts:384` 会为被跳过关系追加 warning；事务内 `src/services/scan-service.ts:137` 保留映射失配时抛出 `ScanError` 的防御逻辑，返回值仍是 `src/services/scan-service.ts:180` 的 `persistableRelations.length`。

测试验证仍在位：`tests/unit/services/scan-service.test.ts:435` 覆盖缺失端点关系场景，`tests/unit/services/scan-service.test.ts:445-448` 断言实际关系计数、warning 与 sync_states 写入。该问题仍可关闭。

### Round 1 Finding #2 — Commander 解析错误未统一映射为参数错误退出码 2：仍确认已修复

经代码验证，`src/cli/index.ts:34` 仍在 `runCli()` 中递归安装 Commander `exitOverride()`，`src/cli/index.ts:42-44` 将非 0 Commander parse error 映射为退出码 2。`tests/unit/cli/index.test.ts:205-219` 覆盖真实 CLI 入口 `cord scan --unknown` 的 parse error 退出码 2 行为。该问题仍可关闭。

### Round 2 / Round 3 Finding #1 — 真实 CLI 入口未使用 parseAsync 驱动异步 scan action：已修复

经代码验证，`src/cli/index.ts:32` 的 `runCli()` 已改为 `async` 并返回 `Promise<void>`，`src/cli/index.ts:37` 使用 `await program.parseAsync(process.argv)` 驱动 Commander，`src/cli/index.ts:101` 的入口 guard 使用 `void runCli().catch(reportUnhandledCliError)` 兜底未捕获异步错误。`src/cli/commands/scan.ts:43` 的 scan action 仍是 async，因此真实入口现在具备等待 async action 完成的语义。

测试验证已补齐：`tests/unit/cli/index.test.ts:110-117` 验证 `runCli()` 调用 `parseAsync`；`tests/unit/cli/index.test.ts:141-160` 覆盖 async scan 成功；`tests/unit/cli/index.test.ts:162-183` 覆盖业务 `ConfigError` 映射为退出码 2；`tests/unit/cli/index.test.ts:185-203` 覆盖 runtime error 映射为退出码 1。该问题可关闭。

### 历史 CR TODO（非阻塞）

| # | 发现 | 状态 | 评估意见 |
|---|------|------|---------|
| R4-#1 | `--verbose` 在 async 子命令执行完成后才生效 | CR TODO / 非阻塞 | 同意纳入 P3 TODO；不阻塞 Story 2.5。 |
| R4-#2 | 默认非 rebuild 重复扫描会撞唯一约束 | 延后 / Story 2.6 范围 | 同意延后到 Story 2.6 的增量/幂等语义处理。 |

---

## 发现 #1 评估

### 审查原文

> **[P3 / 非阻塞] `--verbose` 在 async 子命令执行完成后才生效**
> - 来源：Blind Hunter + Edge Case Hunter
> - 分类：defer

### 评估结论：⚠️ 有效但降级 — 建议纳入 CR TODO 跟踪（P3 优先级）

### 评估分析

**问题描述准确性：基本准确**

代码验证确认时机问题存在。`src/cli/index.ts:37-38` 先 `await program.parseAsync(process.argv)`，随后才调用 `applyVerboseFlag()`；`src/cli/verbose.ts:14-16` 会在 `opts.verbose` 或 `CORD_DEBUG=1` 时调用 `logger.setVerbose(true)`。因此通过 `--verbose` 开启的 debug 状态会晚于 async action 执行。`src/utils/logger.ts:20` 在 logger 构造时读取 `CORD_DEBUG=1`，所以环境变量路径不受该时机影响。

需要降级的一点是，当前代码中未发现 scan action 内已有 `logger.debug()` 调用，因此该问题目前更像调试体验与后续可观测性缺口，而不是 Story 2.5 的功能阻塞。

**严重性判断：合理**

作为 P3 非阻塞合理。它不影响扫描写库、关系计数、退出码或 JSON 输出，只影响 `cord --verbose scan` 对 async action 内 debug 输出的预期时机。

**修复建议：可行**

建议可行。可在 root program 上注册 Commander `preAction` hook，或在调用 `parseAsync()` 前预解析 root-level verbose flag，再补充真实子命令 action 内 debug 行为测试。

**误报评估：非误报**

不是误报，但当前用户可见影响有限，适合纳入 CR TODO 而非阻塞交付。

---

## 发现 #2 评估

### 审查原文

> **[P3 / 延后] 默认非 rebuild 重复扫描会撞唯一约束**
> - 来源：Blind Hunter
> - 分类：defer

### 评估结论：⚠️ 有效但降级 — 建议纳入 CR TODO 跟踪（P3 优先级）

### 评估分析

**问题描述准确性：准确**

代码验证确认该风险存在。`src/repositories/sqlite-graph-repository.ts:46` 的 `addDocument()` 使用普通 `INSERT INTO documents`；`src/repositories/migrations/001-initial-schema.sql:14` 定义 `documents.path` 为 `TEXT NOT NULL UNIQUE`。因此在已有相同 path 文档的数据库中，默认非 rebuild 再次冷启动式插入会触发唯一约束。

**严重性判断：合理**

作为 P3 延后项合理。Story 2.5 的目标是冷启动扫描和从零建立图谱；已有图谱下的增量、幂等、无变更快速返回和生命周期检测明确更接近 Story 2.6 的职责边界。本项不应阻塞 Story 2.5 通过。

**修复建议：可行但非必要**

修复方向应放在 Story 2.6：引入增量扫描判断、document upsert 或变化检测，并明确默认非 rebuild 的幂等语义。若在 Story 2.5 内临时修补，容易越界改变后续增量设计。

**误报评估：非误报**

不是误报，但属于后续 Story 范围，建议跟踪而非本轮修复。

---

## 整体评估结论

### 需要修复（阻塞交付）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| - | - | - | - | 本轮无阻塞交付项。 |

### 建议纳入 CR TODO 跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 1 | `--verbose` 在 async 子命令执行完成后才生效 | [P3] | **P3** | 调试体验缺口，不影响 Story 2.5 AC 通过。 |
| 2 | 默认非 rebuild 重复扫描会撞唯一约束 | [P3 / defer] | **P3** | 风险真实，但应由 Story 2.6 增量/幂等语义承接。 |

### 可忽略（误报）

| # | 发现 | 原始严重性 | 忽略理由 |
|---|------|----------|---------|
| - | - | - | 本轮无误报。 |

### 评估决定

- **Round 1 Finding #1（缺失关系端点会提前结束事务回调并提交不完整写入）**：仍确认已修复，可继续关闭。
- **Round 1 Finding #2（Commander 解析错误未统一映射为参数错误退出码 2）**：仍确认已修复，可继续关闭。
- **Round 2 / Round 3 Finding #1（真实 CLI 入口未使用 parseAsync 驱动异步 scan action）**：确认已修复，可关闭。
- **发现 #1（`--verbose` 在 async 子命令执行完成后才生效）**：确认有效但非阻塞，建议纳入 CR TODO。
- **发现 #2（默认非 rebuild 重复扫描会撞唯一约束）**：确认有效但属于 Story 2.6 范围，建议纳入后续增量/幂等跟踪。
- **总体决定**：同意 round-4 审查结论，Story 2-5 本轮 CR 评估通过；阻塞项为 0。

## 修复执行记录

### 修复执行记录
- **Date**: 2026-05-09
- **Model Used**: GPT-5.4
- **Fix Items**: 0

#### 本轮执行结论
- 已按最新一轮评估文件复核：round 4 中没有任何被标记为“需要修复”的阻塞项。
- 本轮仅存在 2 个非阻塞结论：
	- `--verbose` 在 async 子命令执行完成后才生效：评估结论为 P3 CR TODO，未进入本次 fixer 的源码修复范围。
	- 默认非 rebuild 重复扫描会撞唯一约束：评估结论为 Story 2.6 范围项，未进入本次 fixer 的源码修复范围。
- 因此本轮 **无源码修改**，也未改动任何 Story 文档。

#### 处理结果
- 最新评估结论已确认：Story 2-5 round 4 阻塞项为 0，可通过本轮 CR。
- 本次 fixer 执行完成后，无需追加代码验证命令，因为工作区没有新增代码变更。
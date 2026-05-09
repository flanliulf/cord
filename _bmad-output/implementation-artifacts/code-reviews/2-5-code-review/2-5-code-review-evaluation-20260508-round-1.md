---
Story: 2-5
Round: 1
Date: 2026-05-08
Model Used: GitHub Copilot (current VS Code agent)
Review Source: 2-5-code-review-summary-20260508-round-1.md
Review Model: GitHub Copilot (current VS Code agent)
Type: Code Review Evaluation
---

## 评估总结

对 Story 2-5 的第 1 轮 CR 代码审查结果（首轮）进行逐条评估。本轮审查提出 2 个新发现：1 个 ScanService 事务内提前返回导致不完整写入的数据一致性问题，1 个 Commander 解析错误未映射为参数错误退出码的 CLI 契约问题。经独立代码验证，两项均确认有效，建议均作为阻塞交付修复项处理。

---

## 发现 #1 评估

### 审查原文

> **[高] 缺失关系端点会提前结束事务回调并提交不完整写入**
> - 来源：blind+edge
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：准确**

代码验证确认该问题存在。`src/services/scan-service.ts:129-130` 在持久化关系时，如果 `sourceDoc` 或 `targetDoc` 缺失，会直接执行 `return`。该语句位于 `repository.transaction(() => { ... })` 回调内部，会结束整个事务回调，而不是跳过当前 relation。随后 `src/services/scan-service.ts:159` 的 `upsertSyncState()` 循环不会执行，方法最终仍在 `src/services/scan-service.ts:165` 返回 `relationsDiscovered: filteredRelations.length`。

事务语义也支持审查判断：`src/repositories/sqlite-graph-repository.ts:268-269` 直接使用 `better-sqlite3` 的 `db.transaction(fn)()`，只有抛出异常才会回滚；普通 `return` 会被视为正常完成并提交。单元测试当前只验证抛错时回滚，未覆盖缺失端点导致事务回调提前正常返回的路径。

**严重性判断：合理**

该问题会导致 documents 已写入、部分 relations 已写入、sync_states 未写入，同时返回值仍可能报告发现了所有过滤后的关系。它直接破坏 AC2 的事务保护语义和 AC3 的 documents / relations / sync_states 一致落库要求，因此作为高严重性数据一致性阻塞项合理。按评估模板优先级映射，建议标记为 P1 阻塞交付。

**修复建议：可行**

审查建议可行。更稳妥的修复方向是在事务外预过滤缺失端点关系并记录 warning，或在事务内对当前 relation 跳过而不是从事务回调整体返回。修复时还需要明确 `relationsDiscovered` 的语义：若跳过缺失端点，应返回实际成功计划/写入的关系数量，或至少用 warning 明确存在被跳过关系。

**误报评估：非误报**

不是误报。代码中确实存在事务回调内 `return`，且该 `return` 可绕过后续 sync state 写入。

---

## 发现 #2 评估

### 审查原文

> **[中] Commander 解析错误未统一映射为参数错误退出码 2**
> - 来源：auditor
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：准确**

代码验证确认该问题存在。`src/cli/index.ts:32` 的 `runCli()` 直接调用 `program.parse(process.argv)`，外层没有 `try/catch`，也未对 Commander 解析错误配置统一的 `exitOverride()` 处理。当前参数错误映射逻辑只存在于 scan action 内：`src/cli/commands/scan.ts:65-67` 将 action 执行阶段的 `ConfigError` 映射为退出码 2，其他错误映射为 1。

测试覆盖也与审查描述一致。`tests/unit/cli/commands/scan.test.ts:102-157` 覆盖了 `--force` 业务组合错误、`ConfigError` 和运行时错误，但这些都发生在 action 阶段；测试辅助函数在 `tests/unit/cli/commands/scan.test.ts:25-28` 自行对测试用 program 调用 `exitOverride()`，没有覆盖真实 `runCli()` 入口面对未知 option 等 Commander 解析错误时的退出码映射。

**严重性判断：合理**

原始严重性标为中等合理，因为它不影响核心扫描写库路径，但会违反 AC8 对 `2=参数/配置错误` 的 CLI 契约。由于这是验收标准明确要求，评估时应作为 P1 交付阻塞处理，而不是延后 TODO。

**修复建议：可行**

审查建议可行。可在 CLI 入口集中配置 Commander `exitOverride()` / `configureOutput()`，捕获 Commander 解析错误并统一设置退出码 2；同时补充入口级或集成级测试，例如 `cord scan --unknown` 应以参数错误退出码 2 结束并输出参数错误信息。

**误报评估：非误报**

不是误报。当前实现没有在真实 CLI 入口统一处理 Commander parse 阶段错误，现有测试也没有覆盖该契约。

---

## 整体评估结论

### 需要修复（阻塞交付）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 1 | 缺失关系端点会提前结束事务回调并提交不完整写入 | [高] | **P1** | 破坏事务一致性和 sync_states 落库，直接影响 AC2 / AC3。 |
| 2 | Commander 解析错误未统一映射为参数错误退出码 2 | [中] | **P1** | 违反 AC8 的 CLI 退出码契约，需要在交付前修复。 |

### 建议纳入 CR TODO 跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| - | - | - | - | 本轮无建议延后到 CR TODO 的发现。 |

### 可忽略（误报）

| # | 发现 | 原始严重性 | 忽略理由 |
|---|------|----------|---------|
| - | - | - | 本轮无误报。 |

### 评估决定

- **发现 #1（缺失关系端点会提前结束事务回调并提交不完整写入）**：确认有效，需修复后复审。建议避免事务回调内提前 `return`，并补充缺失端点关系的回归测试。
- **发现 #2（Commander 解析错误未统一映射为参数错误退出码 2）**：确认有效，需修复后复审。建议在 CLI 入口统一处理 Commander parse errors，并补充未知 option 的退出码测试。

## 修复执行记录

### 修复执行记录
- **Date**: 2026-05-08
- **Model Used**: GPT-5.4
- **Fix Items**: 2

#### 1. 修复缺失关系端点导致事务回调提前结束的问题
- **涉及文件**:
	- `src/services/scan-service.ts`
	- `tests/unit/services/scan-service.test.ts`
- **修改说明**:
	- 将关系写入前的端点完整性校验移动到事务外，新增 `collectPersistableRelations()` 预过滤不可持久化关系，并把被跳过的关系写入 warning。
	- 将 `relationsDiscovered` 从“过滤后计划数”改为“实际可持久化关系数”。
	- 在事务内补充不可达状态防御断言，若关系计划与已持久化文档映射失配则抛出 `ScanError`，确保回滚而不是提交部分写入。
	- 新增缺失端点回归测试，验证 sync state 仍会写入、关系计数正确且 warning 可见。
- **执行结果**: 已完成，验证通过。

#### 2. 修复 Commander 解析错误未映射为退出码 2 的问题
- **涉及文件**:
	- `src/cli/index.ts`
	- `tests/unit/cli/index.test.ts`
- **修改说明**:
	- 在 CLI 入口递归启用 Commander `exitOverride()`，覆盖根命令与子命令的 parse 阶段错误拦截。
	- 在 `runCli()` 中识别 Commander 真正的 parse error（`exitCode !== 0`）并统一映射为退出码 `2`。
	- 对 `commander.helpDisplayed` 保持 `exitCode = 0` 的正常行为，避免影响 `--help`。
	- 新增真实入口级回归测试，覆盖 `cord scan --unknown` 时的退出码契约。
- **执行结果**: 已完成，验证通过。

#### 验证记录
- `npm test && npm run type-check && npm run lint`
- 结果：27 个测试文件、263 个测试全部通过；`type-check` 通过；`lint` 通过。

### 修复执行记录
- **Date**: 2026-05-08
- **Model Used**: GPT-5.4
- **Fix Items**: 0

#### 本次复核结论
- 按最新一轮评估文件复核 2 个“需要修复”条目，当前工作区中的对应修复仍然存在：
	- `src/services/scan-service.ts` 已在事务外预过滤缺失端点关系，并以 warning 记录被跳过关系，`relationsDiscovered` 也已改为实际可持久化数量。
	- `src/cli/index.ts` 已在 CLI 入口统一处理 Commander parse error，并将真实参数解析错误映射为退出码 `2`。
- 当前评估文件已包含前一条完整修复执行记录，本次复核未发现需要追加的源码修改，因此 **无新增代码变更**。
- 最近一次验证结果仍然有效：`npm test && npm run type-check && npm run lint` 全部通过。
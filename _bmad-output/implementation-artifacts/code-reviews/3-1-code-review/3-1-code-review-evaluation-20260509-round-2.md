---
Story: 3-1
Round: 2
Date: 2026-05-09
Model Used: GitHub Copilot (model id not exposed)
Review Source: 3-1-code-review-summary-20260509-round-2.md
Review Model: GitHub Copilot (model id not exposed)
Type: Code Review Evaluation
---

## 评估总结

对 Story 3-1 的第 2 轮 CR 代码审查结果（复审）进行逐条评估。本轮审查确认 Round 1 的 3 个低严重度问题均已修复，并新增 2 条低严重度 patch 发现：项目外路径未显式拒绝、默认 QueryService 未关闭底层 SQLite repository。经代码验证，Round 1 修复确认成立；Round 2 新发现均为有效问题，但均不构成 P0/P1 阻塞，建议作为 P2 非阻塞 CR TODO 或后续小补丁处理。评估结论如下。

---

## 上轮问题回顾确认

### Round 1 / Finding #1 — 关系类型 schema 类型契约退化：已修复

`src/schemas/query-input.ts:12-22` 已改为显式 `relationTypeValues` 字面量元组，并使用 `satisfies readonly [RelationType, ...RelationType[]]` 约束元素类型；`src/schemas/query-input.ts:30` 继续用该元组构造 `z.enum`。`tests/unit/schemas/query-input.test.ts:21` 增加 `RelationType | undefined` 赋值断言，可在 `type-check` 中验证 `QueryInput.type` 未退化为普通 `string`。

### Round 1 / Finding #2 — 无效 `--type` 先初始化数据库：已修复

`src/cli/commands/query.ts:51-56` 已调整为先调用 `validateQueryInput(...)`，再执行 `serviceFactory(projectRoot)`。`tests/unit/cli/commands/query.test.ts:187-199` 覆盖无效 `--type invalid_type` 时 `serviceFactory` 不被调用，并返回配置错误路径。

### Round 1 / Finding #3 — 查询 `docPath` 未规范化：已修复

`src/cli/commands/query.ts:52` 在进入 schema 校验和 service 调用前先执行 `normalizeQueryDocPath(projectRoot, docPath)`；`src/cli/commands/query.ts:78-80` 将输入路径转换为相对于 projectRoot 的 POSIX 路径。`tests/unit/cli/commands/query.test.ts:203-219` 覆盖 `./docs/source.md` 被归一化为 `docs/source.md` 后传给 QueryService。

### 历史 CR TODO（非阻塞）

| # | 发现 | 状态 | 评估意见 |
|---|------|------|---------|
| R1-#1 | 关系类型 schema 类型契约退化 | 已修复 | 同意关闭。 |
| R1-#2 | 无效 `--type` 先初始化数据库 | 已修复 | 同意关闭。 |
| R1-#3 | 查询 `docPath` 未规范化 | 已修复 | 同意关闭；项目外路径边界作为本轮新发现单独跟踪。 |

---

## 发现 #1 评估

### 审查原文

> **[低][新] projectRoot 外路径会以 ../ 形式进入 QueryService**
> - 来源：edge
> - 分类：patch

### 评估结论：⚠️ 有效但降级 — 建议纳入 CR TODO 跟踪（P2 优先级）

### 评估分析

**问题描述准确性：准确**

`src/cli/commands/query.ts:78-80` 的 `normalizeQueryDocPath(projectRoot, docPath)` 使用 `resolve(projectRoot, docPath)` 计算绝对路径，再使用 `relative(projectRoot, absoluteDocPath).replaceAll('\\', '/')` 生成传给 QueryService 的路径。当前实现没有检查 `relative(...)` 的结果是否为 `..` 或以 `../` 开头，因此 `../outside.md` 或 projectRoot 外部绝对路径会被归一化为 `../outside.md` 这类值。

该值随后会进入 `validateQueryInput`，而 `src/schemas/query-input.ts:9` 只要求 `docPath` 为非空字符串，不能拒绝项目外路径。验证通过后，`src/cli/commands/query.ts:56` 会初始化 service，并将该路径传给 QueryService。现有测试只覆盖 `./docs/source.md` 归一化（`tests/unit/cli/commands/query.test.ts:203-219`），没有覆盖项目外路径拒绝。

**严重性判断：合理**

当前 QueryService 只是通过仓储精确查询文档路径，不会直接读取传入路径对应的文件系统内容，因此不构成路径穿越安全问题或数据完整性风险。但错误体验会退化为普通文档不存在，且会触发 service 初始化。原审查标为低严重度合理，评估为 P2。

**修复建议：可行**

在 `normalizeQueryDocPath` 或其调用点检查 `relativePath === ''`、`relativePath === '..'`、`relativePath.startsWith('../')`，并抛出 `ConfigError`，修复成本低且边界清晰。补充 projectRoot 外相对路径和绝对路径均不调用 `serviceFactory` 的测试可行。

**误报评估：非误报**

当前路径归一化确实会产生 `../...` 形式并继续进入 QueryService，非误报。

---

## 发现 #2 评估

### 审查原文

> **[低][新] 默认 QueryService 未关闭底层 SQLite repository**
> - 来源：edge
> - 分类：patch

### 评估结论：⚠️ 有效但降级 — 建议纳入 CR TODO 跟踪（P2 优先级）

### 评估分析

**问题描述准确性：准确**

`src/cli/commands/query.ts:71-75` 的默认工厂返回 `new QueryService(new SqliteGraphRepository(dbPath))`。`src/cli/commands/query.ts:65-66` 的 finally 块只会调用 `service?.close?.()`，但 `src/services/query-service.ts:20-21` 的 `QueryService` 只保存 `repository` 并没有实现 `close()` 方法。因此默认路径下，CLI 无法经由 QueryService 转发关闭底层 repository。

底层 `SqliteGraphRepository` 本身实现了关闭能力：`src/repositories/sqlite-graph-repository.ts:290-291` 调用 `this.db.close()`。同一项目中的 `ScanService` 已有类似生命周期转发：`src/services/scan-service.ts:377-379` 调用 `this.repository.close()`，说明该资源释放契约在服务层转发是现有模式。当前 query 命令测试未覆盖默认 service 的资源释放；注入 service 也没有显式覆盖成功/错误路径 close 调用。

**严重性判断：合理**

单次 CLI 进程退出时资源会随进程释放，影响有限；但在测试、嵌入式 CLI program 或长生命周期进程中，未关闭 SQLite 连接可能造成资源泄漏或文件句柄滞留。原审查标为低严重度合理，评估为 P2。

**修复建议：可行**

为 `QueryService` 增加 `close(): void { this.repository.close(); }` 与 `ScanService` 模式对齐，或让默认工厂返回带 close 转发的适配对象，均可行。更一致的方案是服务层转发 repository lifecycle，并补充成功和错误路径都会调用 close 的 CLI 测试。

**误报评估：非误报**

QueryService 当前没有 `close()`，而默认工厂返回的正是 QueryService 实例；CLI 的可选 close 调用无法触达底层 SQLite 连接，非误报。

---

## 整体评估结论

### 需要修复（阻塞交付）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| - | 无 | - | - | 本轮未确认 P0/P1 阻塞项。 |

### 建议纳入 CR TODO 跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 1 | projectRoot 外路径会以 `../` 形式进入 QueryService | [低] | **P2** | 不构成文件系统访问风险，但错误语义不清晰且会初始化 service，建议显式拒绝项目外路径。 |
| 2 | 默认 QueryService 未关闭底层 SQLite repository | [低] | **P2** | 单次 CLI 影响有限，但与 repository lifecycle 契约不一致，建议补 `close()` 转发和测试。 |

### 可忽略（误报）

| # | 发现 | 原始严重性 | 忽略理由 |
|---|------|----------|---------|
| - | 无 | - | 本轮 2 条新发现均经代码验证为有效。 |

### 评估决定

- **上轮问题回顾**：Round 1 的 3 条发现均已修复并有对应测试/类型检查证据，同意关闭。
- **发现 #1（projectRoot 外路径会以 `../` 形式进入 QueryService）**：确认有效，建议作为 P2 非阻塞项处理；修复时应在 service 初始化前返回稳定 `ConfigError`。
- **发现 #2（默认 QueryService 未关闭底层 SQLite repository）**：确认有效，建议作为 P2 非阻塞项处理；优先采用与 `ScanService` 一致的 service 层 `close()` 转发方案。

## 修复执行记录

### 修复执行记录
- **Date**: 2026-05-09
- **Model Used**: GPT-5.4
- **Fix Items**: 2

1. 已修复发现 #1：在 `src/cli/commands/query.ts` 的 `normalizeQueryDocPath` 中新增 projectRoot 外路径拒绝逻辑；当归一化结果为空、为 `..` 或以 `../` 开头时，直接抛出 `ConfigError`，确保在 `serviceFactory` 调用前返回稳定配置错误。
2. 已修复发现 #2：在 `src/services/query-service.ts` 中新增 `close()`，按与 `ScanService` 一致的模式转发到底层 `repository.close()`，让 query CLI 的 `finally` 块能够真正释放默认 SQLite repository。
3. 已补充回归测试：
	- `tests/unit/cli/commands/query.test.ts` 新增项目外相对路径和绝对路径被拒绝、且不初始化 service 的用例。
	- `tests/unit/cli/commands/query.test.ts` 新增 query 成功/失败路径都会调用 `close()` 的用例。
	- `tests/unit/services/query-service.test.ts` 新增 `QueryService.close()` 转发到底层 repository 的用例。
4. 验证结果：`npm test`、`npm run lint`、`npm run type-check`、`npm run build` 全部通过。
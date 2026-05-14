---
Story: 3-5
Round: 1
Date: 2026-05-14
Model Used: GitHub Copilot (model not exposed)
Review Source: 3-5-code-review-summary-20260514-round-1.md
Review Model: GitHub Copilot (model not exposed)
Type: Code Review Evaluation
---

## 评估总结

对 Story 3-5 的第 1 轮 CR 代码审查结果（首轮）进行逐条评估。审查共提出 4 条发现，均确认为有效问题并要求本轮给出明确修复；未发现明确误报。评估结论如下。

---

## 发现 #1 评估

### 审查原文

> **[中] `cord status` 在查看状态时会创建 `.cord/cord.db` 并触发迁移**
> - 来源：blind+edge
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：准确**

代码验证确认该问题成立。[src/cli/commands/status.ts](src/cli/commands/status.ts#L63) 在默认 service factory 中无条件 `mkdirSync(dataDirectory, { recursive: true })`，随后 [src/cli/commands/status.ts](src/cli/commands/status.ts#L65) 用 `.cord/cord.db` 构造 `SqliteGraphRepository`。仓储构造函数会在 [src/repositories/sqlite-graph-repository.ts](src/repositories/sqlite-graph-repository.ts#L28) 打开数据库，并在 [src/repositories/sqlite-graph-repository.ts](src/repositories/sqlite-graph-repository.ts#L34) 运行迁移。因此，`cord status` 的默认路径确实会在仅查看状态时创建数据目录/数据库并执行迁移。

**严重性判断：合理**

`status` 的语义是查看当前项目状态，Story 也将 CLI 描述为状态/健康检查展示。无初始化项目执行状态查询后产生 `.cord/cord.db` 属于可见副作用；旧数据库在状态查询时隐式迁移也会改变被观察对象，使输出无法表达查询前状态。该问题会影响用户信任和诊断准确性，评为 P1 合理。

**修复建议：可行**

审查建议可行：默认 status 路径应先检测数据库文件是否存在；不存在时返回空图谱/未初始化状态，不创建 `.cord` 或 `cord.db`。若数据库存在，再决定是否需要只读打开方式或显式标注迁移状态。建议同时补充 `cord status --json` 不创建 `.cord/cord.db` 的回归测试。

**误报评估：非误报**

该发现由 blind+edge 双来源命中，且源码证据直接支持，非误报。

---

## 发现 #2 评估

### 审查原文

> **[中] `StatusService` 状态快照由多次非事务读取拼装，可能输出互相矛盾的指标**
> - 来源：blind+edge
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：准确**

代码验证确认读取确实不是单一事务快照。[src/services/status-service.ts](src/services/status-service.ts#L36-L38) 先后读取 documents、relations、syncStates，随后 [src/services/status-service.ts](src/services/status-service.ts#L64-L66) 再独立查询 documentCount、relationCount 并基于前面读取的 relations 计算 `relationsByType`。仓储本身支持事务接口，[src/repositories/sqlite-graph-repository.ts](src/repositories/sqlite-graph-repository.ts#L268) 已提供 `transaction<T>()`，但 StatusService 当前没有使用。

**严重性判断：偏高**

原始问题描述成立。虽然问题依赖并发写入窗口，但 `cord status` 的职责是给出可信健康快照；若 `relationCount` 与 `relationsByType`、`staleRelations`、`orphanedNodes` 来源口径不一致，会直接损害健康检查输出的诊断价值。该问题不作为 CR TODO 延后处理，评估为 P1，本轮应修复。

**修复建议：可行**

审查建议可行。明确修复方案：

1. 在 [src/services/status-service.ts](src/services/status-service.ts) 中将所有数据库读取和图谱健康指标计算包进 `this.repository.transaction(() => { ... })`，确保 `documents`、`relations`、`syncStates`、`migrationVersion` 来自同一数据库快照。
2. 删除 `getDocumentCount()` / `getRelationCount()` 在 status 路径中的二次统计口径，改为从事务内已读取的 `documents.length` 和 `relations.length` 派生 `documentCount` / `relationCount`。
3. 保持 `loadConfig(validatedInput.projectRoot)` 和 `resolveConfigFilePath(...)` 在事务外或事务后执行，因为它们是文件系统配置读取，不属于数据库快照边界。
4. 补充单元测试：构造一个 fake repository，使 `getDocumentCount()` / `getRelationCount()` 与 `getAllDocuments()` / `getAllRelations()` 故意返回不同口径；修复后 `StatusService` 不应再依赖二次 count 查询，输出应来自同一批数组快照。

**误报评估：非误报**

该发现由 blind+edge 双来源命中，代码存在多次独立读取，非误报。

---

## 发现 #3 评估

### 审查原文

> **[中] 悬空关系会把仍存在的一端计为 connected，导致 `orphanedNodes` 低估**
> - 来源：blind
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：准确**

代码验证确认该问题成立。[src/services/status-service.ts](src/services/status-service.ts#L48-L57) 在发现任一端缺失后会增加 `danglingEdges`，但仍分别把存在的 source/target 加入 `connectedDocumentIds`。最终 [src/services/status-service.ts](src/services/status-service.ts#L70) 用 `connectedDocumentIds` 排除孤立节点，因此“唯一关系指向缺失节点”的文档会被视为 connected，不会计入 `orphanedNodes`。Story AC4 要求报告孤立节点、悬空关系边，[_bmad-output/implementation-artifacts/stories/3-5-statusservice-health-check.md](_bmad-output/implementation-artifacts/stories/3-5-statusservice-health-check.md#L16) 是直接验收依据。

现有测试未覆盖该边界。[tests/unit/services/status-service.test.ts](tests/unit/services/status-service.test.ts#L283) 的 dangling 场景中，`doc-a` 同时参与一条有效关系和一条 dangling 关系；[tests/unit/services/status-service.test.ts](tests/unit/services/status-service.test.ts#L315-L316) 只断言孤立节点为单独的 `doc-orphan` 且 danglingEdges 为 1，没有覆盖“文档唯一关系是 dangling”的情况。

**严重性判断：合理**

这是 AC4 直接相关的健康指标错误。对用户而言，孤立节点和悬空关系边是状态诊断的核心输出；当前实现会在特定不一致图谱下低估孤立节点，属于功能语义缺陷，评为 P1 合理。

**修复建议：可行**

审查建议可行：只有关系两端文档都存在时，才将 source 和 target 加入 `connectedDocumentIds`。同时补充测试：一个存在文档仅连接到缺失目标时，应报告 `danglingEdges = 1`，且该文档按 AC4 口径计入 `orphanedNodes`。

**误报评估：非误报**

虽然来源为单层 blind，但代码路径和测试缺口均清晰，非误报。

---

## 发现 #4 评估

### 审查原文

> **[低] `finally` 中 `close()` 抛错会覆盖成功输出或原始错误**
> - 来源：blind
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P2 优先级）

### 评估分析

**问题描述准确性：准确**

代码验证确认 `finally` 中直接调用 close。[src/cli/commands/status.ts](src/cli/commands/status.ts#L56) 在 try/catch 之后执行 `service?.close?.()`，没有捕获 close 异常。JavaScript/TypeScript 的 `finally` 若抛错，会覆盖 try/catch 中已经处理或正在传播的结果，因此该问题描述成立。现有测试仅覆盖 close 会被调用，[tests/unit/cli/commands/status.test.ts](tests/unit/cli/commands/status.test.ts#L177) 和 [tests/unit/cli/commands/status.test.ts](tests/unit/cli/commands/status.test.ts#L204) 没有覆盖 close 失败路径。

**严重性判断：合理**

原始严重性为低是合理的：SQLite close 失败概率较低，并且该问题不影响核心 AC 的常规路径。但它会影响 CLI 诊断稳定性，尤其在失败路径中可能遮蔽原始业务错误。该问题不作为 CR TODO 延后处理，评估为 P2，本轮应修复。

**修复建议：可行**

审查建议可行。明确修复方案：

1. 在 [src/cli/commands/status.ts](src/cli/commands/status.ts) 中不要让 `finally` 直接调用 `service?.close?.()`；改为调用一个小的 `closeServiceSafely(service, stderr, asJson)` 辅助函数或在 `finally` 内局部 `try/catch`。
2. 若 `getStatus()` 已经成功并写出结果，`close()` 失败不应覆盖成功输出，也不应把 `process.exitCode` 从 0 改成 1；最多可静默忽略，或按项目 CLI 规范写入非 JSON 诊断到 stderr。
3. 若 `getStatus()` 已经失败并设置了原始错误输出/exitCode，`close()` 失败不应覆盖原始错误 payload 和 exitCode。
4. 补充两个单元测试：成功路径中 `close()` 抛错仍保留成功输出和 exitCode 0；失败路径中 `getStatus()` 抛出的原始错误仍保留在 stderr，且 exitCode 不被 close 错误改写。

**误报评估：非误报**

该发现虽为低频异常路径，但行为机制和代码证据明确，非误报。

---

## 整体评估结论

### 需要修复（阻塞交付）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 1 | `cord status` 查看状态时创建 `.cord/cord.db` 并触发迁移 | [中] | **P1** | 状态查询产生可见副作用，并可能改变被观察数据库状态 |
| 2 | `StatusService` 状态快照由多次非事务读取拼装 | [中] | **P1** | 健康检查必须返回同一数据库快照口径，避免自相矛盾的诊断输出 |
| 3 | 悬空关系会把仍存在的一端计为 connected，导致 `orphanedNodes` 低估 | [中] | **P1** | AC4 相关健康指标在不一致图谱下会输出错误结果 |
| 4 | `finally` 中 `close()` 抛错会覆盖成功输出或原始错误 | [低] | **P2** | CLI 资源释放失败不应覆盖主流程结果或原始错误 |

### 建议纳入 CR TODO 跟踪（非阻塞）

无。

### 可忽略（误报）

无。

### 评估决定

- **发现 #1（`cord status` 查看状态时创建 `.cord/cord.db` 并触发迁移）**：确认有效，建议本轮修复后再进入收尾。
- **发现 #2（`StatusService` 多次非事务读取导致快照口径可能漂移）**：确认有效，不作为 CR TODO；本轮应通过事务快照和数组派生 count 修复。
- **发现 #3（悬空关系导致 `orphanedNodes` 低估）**：确认有效，属于 AC4 健康指标语义缺陷，建议本轮修复。
- **发现 #4（`close()` 异常覆盖原始结果）**：确认有效，不作为 CR TODO；本轮应捕获 close 异常，确保不覆盖成功输出或原始错误。

## 修复执行记录

### 修复执行记录
- **Date**: 2026-05-14
- **Model Used**: GPT-5.4 (GitHub Copilot)
- **Fix Items**: 4

1. **发现 #1：`cord status` 查看状态时创建 `.cord/cord.db` 并触发迁移**
	- 修改文件：`src/cli/commands/status.ts`、`src/services/status-service.ts`、`src/services/index.ts`
	- 修复内容：默认 service factory 改为先检查 `.cord/cord.db` 是否存在；不存在时返回空图谱状态，不创建 `.cord` 目录或数据库文件。
	- 结果：已修复，并补充 `status --json` 在未初始化项目上不创建 `.cord/cord.db` 的回归测试。

2. **发现 #2：`StatusService` 状态快照由多次非事务读取拼装**
	- 修改文件：`src/services/status-service.ts`、`tests/unit/services/status-service.test.ts`
	- 修复内容：将状态读取与健康指标计算收口到单次 `repository.transaction(() => ...)` 中，并改为从同一批 `documents`/`relations` 数组派生 `documentCount` 与 `relationCount`。
	- 结果：已修复，并补充回归测试验证 status 输出不再依赖二次 count 查询。

3. **发现 #3：悬空关系会把仍存在的一端计为 connected，导致 `orphanedNodes` 低估**
	- 修改文件：`src/services/status-service.ts`、`tests/unit/services/status-service.test.ts`
	- 修复内容：仅当关系两端文档都存在时，才将 source/target 计入 `connectedDocumentIds`；单边悬空关系只计入 `danglingEdges`。
	- 结果：已修复，并补充“文档唯一关系为 dangling 时仍计入 orphanedNodes”的回归测试。

4. **发现 #4：`finally` 中 `close()` 抛错会覆盖成功输出或原始错误**
	- 修改文件：`src/cli/commands/status.ts`、`tests/unit/cli/commands/status.test.ts`
	- 修复内容：新增安全关闭逻辑，在 `finally` 中捕获并忽略 `close()` 异常，避免资源释放失败覆盖主流程输出与退出码。
	- 结果：已修复，并补充成功路径/失败路径下 `close()` 抛错的两条回归测试。

**验证记录**

- `node_modules/.bin/vitest run tests/unit/cli/commands/status.test.ts`
- `node_modules/.bin/vitest run tests/unit/services/status-service.test.ts`
- `node_modules/.bin/vitest run tests/integration/cli/status.test.ts`
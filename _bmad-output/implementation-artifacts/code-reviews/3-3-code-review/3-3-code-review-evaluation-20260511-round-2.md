---
Story: 3-3
Round: 2
Date: 2026-05-11
Model Used: GitHub Copilot (unspecified)
Review Source: 3-3-code-review-summary-20260511-round-2.md
Review Model: GitHub Copilot (unspecified)
Type: Code Review Evaluation
---

## 评估总结

对 Story 3-3 的第 2 轮 CR 代码审查结果（复审）进行逐条评估。本轮审查先确认 Round 1 的 3 个 P1 问题已经修复，又新增 2 个边界条件/入口契约相关发现。经独立代码验证，上轮 3 个修复项均可关闭；本轮 2 个新增发现均准确且非误报，建议作为阻塞交付问题修复后再进入最终通过。

---

## 上轮问题回顾确认

### Round 1 / Finding #1 — 双向遍历导致上游文档误报：已修复关闭

经代码验证，ImpactService 已不再复用无方向 `QueryService.query()`，而是在服务内部执行固定三跳有向 BFS。遍历入口使用 `getRelationsByDocId(current.docId, 'source')`，并通过 `isTraversableRelation()` 要求 `relation.sourceDocId === sourceDocId`：[src/services/impact-service.ts:81-89](../../../../src/services/impact-service.ts#L81-L89)、[src/services/impact-service.ts:156-160](../../../../src/services/impact-service.ts#L156-L160)。对应回归测试已覆盖“起点只出现在 target 端时不得返回上游 source 端”：[tests/unit/services/impact-service.test.ts:175](../../../../tests/unit/services/impact-service.test.ts#L175)。

### Round 1 / Finding #2 — 低置信边仍参与路径扩展：已修复关闭

经代码验证，`confidenceThreshold` 已进入 `isTraversableRelation()`，与 `status === 'active'` 一起在路径扩展前过滤；低置信边不会进入 `traversableRelations`，因此既不输出也不扩展：[src/services/impact-service.ts:81-89](../../../../src/services/impact-service.ts#L81-L89)、[src/services/impact-service.ts:156-160](../../../../src/services/impact-service.ts#L156-L160)。对应回归测试已覆盖“低置信一跳 + 高置信二跳不得穿透”：[tests/unit/services/impact-service.test.ts:196](../../../../tests/unit/services/impact-service.test.ts#L196)。

### Round 1 / Finding #3 — 同一受影响文档重复输出并膨胀 totalCount：已修复关闭

经代码验证，ImpactService 现在使用 `Map<string, ImpactedDoc>` 按 `docPath` 聚合候选，并通过 `isBetterImpactCandidate()` 保留更强命中；`totalCount` 来自去重后的 `impactedDocs.length`：[src/services/impact-service.ts:73](../../../../src/services/impact-service.ts#L73)、[src/services/impact-service.ts:93-109](../../../../src/services/impact-service.ts#L93-L109)、[src/services/impact-service.ts:182-193](../../../../src/services/impact-service.ts#L182-L193)。对应回归测试已覆盖“同一文档被多条路径命中时仅输出一次”：[tests/unit/services/impact-service.test.ts:225](../../../../tests/unit/services/impact-service.test.ts#L225)。

### 历史 CR TODO（非阻塞）

| # | 发现 | 状态 | 评估意见 |
|---|------|------|---------|
| R2-TODO-1 | relationType 级传播方向策略尚未显式建模 | CR TODO / 非阻塞 | 同意维持。当前 Story 与 Round 1 修复目标是 source -> target 有向传播；是否引入按 relationType 的方向矩阵需要产品/架构裁决，不阻塞本轮实现。 |
| R2-TODO-2 | 多跳结果未保留完整路径解释 | CR TODO / 非阻塞 | 同意维持。AC2 要求受影响文档路径、关系类型、传播行为类型、建议动作；完整路径解释属于后续输出增强。 |
| R2-TODO-3 | `impact` 默认 service 会创建 `.cord` 目录 | CR TODO / 非阻塞 | 同意维持为独立体验/副作用议题；但本轮 Finding #2 涉及“错误输入绕过 serviceFactory 前拒绝”，应作为阻塞修复。 |

---

## 发现 #1 评估

### 审查原文

> **[中][新] 有向环或自环会把源文档计入自身影响结果**
> - 来源：blind+edge
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：准确**

ImpactService 初始化 `visitedDocIds` 时确实已包含源文档 ID：[src/services/impact-service.ts:74](../../../../src/services/impact-service.ts#L74)。但在遍历每条出边时，代码先解析 `targetDocument`，随即构造 `candidate` 并写入 `impactedDocsByPath`：[src/services/impact-service.ts:92-97](../../../../src/services/impact-service.ts#L92-L97)。只有在准备继续入队扩展时，才通过 `!visitedDocIds.has(targetDocument.id)` 阻止重复扩展：[src/services/impact-service.ts:100-102](../../../../src/services/impact-service.ts#L100-L102)。

因此 A -> A 自环会在 hop 1 把源文档自身写入 `impactedDocsByPath`；A -> B -> A 有向环也会在 B 的出边处理阶段把源文档写回结果。`visitedDocIds` 目前只保护“是否继续扩展”，不保护“是否输出为受影响文档”。Story AC2 要求结果是“受影响文档路径、关系类型、传播行为类型、建议动作”，语义上不应包含变更源文档自身：[_bmad-output/implementation-artifacts/stories/3-3-impactservice-change-impact-analysis.md:14](../../../stories/3-3-impactservice-change-impact-analysis.md#L14)。

**严重性判断：合理**

原始严重性为中等合理。该问题属于边界条件，但一旦图中存在自环或有向环，会直接污染 `impactedDocs` 和 `totalCount`，并在 CLI/JSON 中提示“当前文档影响当前文档自身”。评估后按 P1 处理，因为这是 ImpactService 核心结果集合的正确性问题，且修复成本低、回归测试明确。

**修复建议：可行**

建议在构造 `candidate` 之前增加源文档保护，例如 `if (targetDocument.id === sourceDocument.id) continue;`。同时补充 A -> A 自环和 A -> B -> A 两跳环回归测试，验证 `docs/source.md` 不会出现在 `impactedDocs` 中；是否允许继续探索环后的其他分支，可按现有 `visitedDocIds` 语义保持“不重复扩展”。

**误报评估：非误报**

该缺陷可由当前输出写入顺序直接推出，且现有 ImpactService 测试只覆盖上游误报、低置信穿透和去重等 Round 1 场景，没有覆盖自环或回到源文档的有向环。

---

## 发现 #2 评估

### 审查原文

> **[中][新] CLI 路径根目录校验发生在 schema trim 之前，带空白输入可绕过项目外路径拒绝**
> - 来源：blind
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：准确**

CLI action 当前先调用 `normalizeImpactDocPath(projectRoot, docPath)`，再把结果交给 `validateImpactInput()`：[src/cli/commands/impact.ts:49-54](../../../../src/cli/commands/impact.ts#L49-L54)。`normalizeImpactDocPath()` 的根目录外判断基于原始 `docPath` 执行 `resolve()` / `relative()`，没有先 trim：[src/cli/commands/impact.ts:83-94](../../../../src/cli/commands/impact.ts#L83-L94)。随后 schema 会对 `docPath` 执行 `.trim()`：[src/schemas/impact-input.ts:8](../../../../src/schemas/impact-input.ts#L8)。

因此形如 `' ../outside.md '` 的输入在 normalize 阶段会被当作项目内、包含空格的普通相对路径，通过 `normalizedRelativePath.startsWith('../')` 检查；但 schema trim 后会变成 `../outside.md`，并传入 service。项目规则 P33 明确要求项目根外路径必须在入口层、`serviceFactory()` 调用前抛 `ConfigError`，且禁止退化为普通“文档不存在”错误：[_bmad-output/planning-artifacts/architecture/04-implementation-patterns-consistency-rules.md:505-509](../../../../planning-artifacts/architecture/04-implementation-patterns-consistency-rules.md#L505-L509)。project-context 也要求所有会触发默认 Service/Repository 初始化或文件系统副作用的 CLI 命令，必须先完成输入校验与路径归一化，再调用 `serviceFactory()` 或创建数据目录：[_bmad-output/project-context.md:194-198](../../../../project-context.md#L194-L198)。

现有 CLI 测试只覆盖裸 `../outside.md` 的拒绝：[tests/unit/cli/commands/impact.test.ts:261](../../../../tests/unit/cli/commands/impact.test.ts#L261)，且 impact 命令尚未覆盖项目外绝对路径；query 命令已有相对和绝对项目外路径测试作为同类入口契约参照：[tests/unit/cli/commands/query.test.ts:313](../../../../tests/unit/cli/commands/query.test.ts#L313)、[tests/unit/cli/commands/query.test.ts:330](../../../../tests/unit/cli/commands/query.test.ts#L330)。

**严重性判断：合理**

原始严重性为中等合理。该问题本身不等同于读取项目外文件，但它破坏了 CLI 的稳定错误码和入口边界：应为 `ConfigError` / exit code 2 的非法路径会在 `serviceFactory()` 之后退化为查询错误，且默认 service 可能产生 `.cord` 副作用。评估后按 P1 处理，因为 P33 是已登记的质量门禁规则，且此 Story 新增的 `impact` CLI 应与 `query` CLI 的路径契约保持一致。

**修复建议：可行**

建议在 `normalizeImpactDocPath()` 内部先执行 `const trimmedDocPath = docPath.trim()`，后续 `resolve()`、错误消息和返回值均基于 trimmed 值；或者在 action 层先用专用解析器标准化 raw path，再做根目录边界检查，最后再进入 serviceFactory。需要补充至少两类测试：带空白的项目外相对路径 `' ../outside.md '`，以及带空白的项目外绝对路径，二者都必须在 `serviceFactory()` 调用前被拒绝并返回 exit code 2。

**误报评估：非误报**

该问题由 `normalize -> schema trim` 的调用顺序直接导致，且现有测试缺少带空白项目外路径与 impact 绝对项目外路径覆盖。

---

## 整体评估结论

### 需要修复（阻塞交付）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 1 | 有向环或自环会把源文档计入自身影响结果 | [中] | **P1** | 自环/回源环会污染 `impactedDocs` 与 `totalCount`，需禁止源文档进入自身影响结果。 |
| 2 | CLI 路径根目录校验发生在 schema trim 之前 | [中] | **P1** | 带空白项目外路径可绕过 serviceFactory 前拒绝，违反 P33 入口契约和稳定错误码要求。 |

### 建议纳入 CR TODO 跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| R2-TODO-1 | relationType 级传播方向矩阵 | 非阻塞待办 | **P2** | 需要产品/架构裁决，当前 Story 按 source -> target 有向传播已满足已裁定范围。 |
| R2-TODO-2 | 多跳结果完整路径解释 | 非阻塞待办 | **P2** | 属于输出可解释性增强，当前 AC 未要求完整路径链。 |
| R2-TODO-3 | 默认 impact service 创建 `.cord` 目录 | 非阻塞待办 | **P2** | 可后续统一评估只读命令诊断体验；但非法路径绕过初始化前拒绝已作为 Finding #2 阻塞修复。 |

### 可忽略（误报）

无。本轮 2 个新增发现均非误报。

### 评估决定

- **发现 #1（有向环或自环会把源文档计入自身影响结果）**：确认有效，需修复。修复应保证源文档永不进入自身 `impactedDocs`，并补 A -> A 与 A -> B -> A 回归测试。
- **发现 #2（CLI 路径根目录校验发生在 schema trim 之前）**：确认有效，需修复。修复应把 trim 纳入根目录边界检查之前，并补带空白项目外相对/绝对路径测试，确保 `serviceFactory()` 前返回 `ConfigError`。
- **Round 1 三项修复**：确认关闭，不再作为阻塞项。
- **总体决定**：第 2 轮 CR 发现客观成立。建议修复 2 个 P1 问题并补齐回归测试后，发起第 3 轮 CR 复审。

## 修复执行记录

### 修复执行记录
- **Date**: 2026-05-11
- **Model Used**: GPT-5.4
- **Fix Items**: 2

#### 修复项 1：有向环或自环把源文档计入自身影响结果
- **涉及文件**: `src/services/impact-service.ts`, `tests/unit/services/impact-service.test.ts`
- **处理方式**: 在 ImpactService 的有向 BFS 中，解析出边目标后、构造 impact candidate 前增加 `targetDocument.id === sourceDocument.id` 保护，确保源文档永不写入 `impactedDocsByPath`。同时补齐 A -> A 自环和 A -> B -> A 回源环回归测试。
- **结果**: 已修复；源文档不再出现在自身影响结果中，`totalCount` 也不再被自环/回源环污染。

#### 修复项 2：CLI 根目录边界检查发生在 schema trim 之前
- **涉及文件**: `src/cli/commands/impact.ts`, `tests/unit/cli/commands/impact.test.ts`
- **处理方式**: 在 `normalizeImpactDocPath()` 内部先执行 `trim()`，再进行 `resolve()` / `relative()` 根目录外判定；若 trim 后为空，则直接交回 schema 做输入校验，避免改变空输入的原有错误契约。补齐带空白的项目外相对路径和绝对路径测试，确认都在 `serviceFactory()` 调用前以 `ConfigError` 拒绝。
- **结果**: 已修复；`' ../outside.md '` 和 `' /outside.md '` 都会在入口层被稳定拒绝，默认 service 不会被初始化。

#### 验证记录
- `npx vitest run tests/unit/services/impact-service.test.ts tests/unit/cli/commands/impact.test.ts`
- `npx vitest run tests/unit/services/impact-service.test.ts tests/unit/cli/commands/impact.test.ts tests/integration/cli/impact.test.ts && npm run lint && npm run type-check && npm test`
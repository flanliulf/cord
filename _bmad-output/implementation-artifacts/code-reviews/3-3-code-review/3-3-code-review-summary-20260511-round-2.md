---
Story: 3-3
Round: 2
Date: 2026-05-11
Model Used: GitHub Copilot (unspecified)
Type: Code Review Summary
---

## 审查结论

本轮为复审。Round 1 的 3 个 P1 问题均已按评估文件中的修复执行记录落地：ImpactService 已改为有向 BFS、阈值过滤已前移到路径扩展阶段、结果已按 `docPath` 去重。`npm test`、`npm run lint`、`npm run build`、`npm run type-check` 均通过；Acceptance Auditor 未发现 AC-1 至 AC-10 的验收缺口。本轮新增 2 个中风险 `patch` 项，均为边界条件/入口契约问题，建议修复后再最终通过。

## 上轮问题回顾

### 已修复

1. Round 1 / Finding #1 — 双向遍历导致上游文档误报
   - 修复位置和方式：`src/services/impact-service.ts` 不再复用无方向 `QueryService.query()`，改为内部固定三跳有向 BFS，并通过 `getRelationsByDocId(current.docId, 'source')` / `relation.sourceDocId === sourceDocId` 限制传播方向。
   - 验证结果：`tests/unit/services/impact-service.test.ts` 新增“起点只出现在 target 端时不得返回上游 source 端”回归测试；本轮 `npm test` 通过。

2. Round 1 / Finding #2 — 低置信边仍参与路径扩展
   - 修复位置和方式：`src/services/impact-service.ts` 在遍历扩展前执行 `isTraversableRelation()`，同时过滤非 active 与低于 `confidenceThreshold` 的关系，低置信边既不输出也不扩展。
   - 验证结果：`tests/unit/services/impact-service.test.ts` 新增“低置信一跳 + 高置信二跳不得穿透”回归测试；本轮 `npm test` 通过。

3. Round 1 / Finding #3 — 同一受影响文档重复输出并膨胀 totalCount
   - 修复位置和方式：`src/services/impact-service.ts` 使用 `Map<string, ImpactedDoc>` 按 `docPath` 聚合，重复命中时按更高严重程度、更短 hopDistance、更高 confidence 保留最佳候选。
   - 验证结果：`tests/unit/services/impact-service.test.ts` 新增“同一文档被多条路径命中时仅输出一次”回归测试；本轮 `npm test` 通过。

### 仍为非阻塞待办

1. relationType 级传播方向策略尚未显式建模
   - 维持本轮评估结论：当前 Story 3.3 和 Round 1 修复记录要求 source -> target 有向传播；是否为 `must_consistent` 等类型引入双向/反向传播矩阵需要产品/架构裁决，不作为本轮阻塞。

2. 多跳结果未保留完整路径解释
   - 维持本轮评估结论：当前 AC2 只要求受影响文档路径、关系类型、传播行为类型、建议动作；完整路径解释可作为后续输出增强。

3. `impact` 默认 service 会创建 `.cord` 目录
   - 维持本轮评估结论：该行为沿用现有命令初始化模式，当前 Story 未要求改变；可后续统一评估只读命令的诊断体验。

## 新发现

### 1. [中][新] 有向环或自环会把源文档计入自身影响结果

- **来源**：blind+edge
- **分类**：patch

- **证据**
  - `src/services/impact-service.ts:73-76` 初始化 `visitedDocIds` 时已包含源文档 ID，但 `src/services/impact-service.ts:89-96` 在解析 target 后立即构造 candidate 并写入 `impactedDocsByPath`。
  - `src/services/impact-service.ts:98-100` 只在准备继续入队扩展时检查 `visitedDocIds`，没有阻止 A->A 自环或 A->B->A 有向环把源文档自身写入结果。

- **影响**
  - 源文档会出现在自己的 `impactedDocs` 中，`totalCount` 被污染，CLI 表格/JSON 会提示用户“当前变更影响当前文档自身”。
  - 该问题不影响 Round 1 三项修复是否成立，但会在合法图中出现有向环或自环时产生错误影响项。

- **建议**
  - 在构造 candidate 前增加 `if (targetDocument.id === sourceDocument.id) continue;` 或等价保护，确保源文档永不进入自身影响结果。
  - 补充回归测试：A->A 自环、A->B->A 两跳环，均断言 `docs/source.md` 不出现在 `impactedDocs`。

### 2. [中][新] CLI 路径根目录校验发生在 schema trim 之前，带空白输入可绕过项目外路径拒绝

- **来源**：blind
- **分类**：patch

- **证据**
  - `src/cli/commands/impact.ts:49-53` 先调用 `normalizeImpactDocPath(projectRoot, docPath)`，再调用 `validateImpactInput()`。
  - `src/cli/commands/impact.ts:82-94` 的项目根目录外拒绝逻辑基于未 trim 的 `docPath` 执行；`src/schemas/impact-input.ts:7-12` 随后会对 `docPath` 执行 `trim()`。
  - 因此形如 `' ../outside.md '` 的参数可在 normalize 阶段作为项目内字面路径通过检查，随后被 schema trim 成 `../outside.md` 传入 service，违反 P33 “项目根外路径必须在入口层、serviceFactory 前拒绝”的契约。

- **影响**
  - 项目外路径不再稳定得到 `ConfigError` / exit code 2，而可能退化为默认 service 初始化后的普通“文档不存在”查询错误。
  - 这会破坏 CLI 错误码契约，并可能在默认 service 初始化时产生不必要的 `.cord` 状态。

- **建议**
  - 在 `normalizeImpactDocPath()` 内部先对 `docPath.trim()` 后再 `resolve/relative`，或在 action 中先使用 schema/专用解析器标准化 raw path，再执行项目根边界检查。
  - 补充 CLI 测试：`' ../outside.md '` 与带空白的项目外绝对路径必须在 `serviceFactory()` 前被拒绝，退出码为 2。

## 验证摘要

- `npm test` ✅ 通过（319 / 319）
- `npm run lint` ✅ 通过
- `npm run build` ✅ 通过
- `npm run type-check` ✅ 通过
- 额外复核：
  - Round 1 三个修复项均有对应代码路径和回归测试。
  - Acceptance Auditor 判定 AC-1 至 AC-10 均满足，无上轮遗留验收缺口。
  - Edge Case Hunter 新增的自环/有向环问题已与 Blind Hunter 同类发现合并为本轮新发现 #1。

## 通过项

- ImpactService 已摆脱无方向 QueryService 遍历，采用内部有向 BFS，并在路径扩展阶段应用 deprecated/status 与 confidence 阈值过滤。
- 结果去重与排序已落地，`totalCount` 基于去重后的受影响文档数。
- CLI impact 命令的表格输出、JSON 输出、显式阈值、配置阈值与错误输出仍通过测试覆盖。
- 已知非阻塞待办：relationType 级传播方向矩阵、完整路径解释输出、只读命令是否应避免创建 `.cord`。

## 结论

- **结论：不通过**
- **阻塞项**：本轮新发现 #1（自环/有向环自影响）与 #2（带空白项目外路径绕过入口拒绝）
- **建议**：修复 2 个 `patch` 项并补充对应回归测试后，发起第 3 轮 CR 复审。

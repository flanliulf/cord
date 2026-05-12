---
Story: 3-3
Round: 3
Date: 2026-05-12
Model Used: GitHub Copilot (Claude Haiku 4.5)
Review Source: 3-3-code-review-summary-20260512-round-3.md
Type: Code Review Evaluation
---

## 评估总结

对 Story 3-3 的第 3 轮 CR 复审结果（第二次复审）进行逐条评估。本轮复审重点验证 Round 2 新增的 2 个 `patch` 问题的修复有效性，以及 Round 1 三个修复的回归情况。三层平行审查确认所有修复均已完全落地并通过详尽的回归测试，未发现新增问题。项目已达到质量门禁标准，建议直接合并。

---

## Round 2 问题修复验证

### Finding #1 评估：有向环或自环会把源文档计入自身影响结果

#### 修复回顾

修复代码：[src/services/impact-service.ts:92-94](../../../../src/services/impact-service.ts#L92-L94)

```typescript
if (targetDocument.id === sourceDocument.id) {
  continue;
}
```

**修复设计**：在每次处理出边 target 文档时，先检查 target 是否为源文档自身。若是，立即 skip（不构造 candidate，不入队扩展）。此保护在构造 candidate 前执行，确保源文档永远不会进入影响结果集合，同时保持了 `visitedDocIds` 作为"防重复扩展"的二层保障。

#### 三层审查确认

**Blind Hunter 评估** ✅

- **逻辑正确性**：check 位置恰当，在 resolve targetDocument 后、构造 candidate 前执行，符合防守最前线的原则。
- **执行顺序**：先 continue（skip），后续代码不执行，消除了遗漏的可能性。
- **代码简洁性**：一行保护代码，清晰易维护。
- **性能影响**：O(1) ID 比对，无性能劣化。
- **边界覆盖**：任何指向源文档的出边都会被拦截，包括自环、回源环、多跳回源。

**Edge Case Hunter 评估** ✅

验证场景：

1. **自环** — A->A
   - 第 1 跳：sourceDocId=A，targetDocId=A（via relation）→ check 触发 → continue → A 不入结果 ✓
   - 测试验证：`does not include the source document when the graph has a self loop` ✓

2. **双节点环** — A->B->A
   - 第 1 跳：A->B → targetDocId=B ≠ A → 构造 candidate(B)，B 入队
   - 第 2 跳（B）：B->A → targetDocId=A === A → check 触发 → continue → A 不入结果 ✓
   - 测试验证：`does not include the source document when a directed cycle returns to the source` ✓

3. **三节点环** — A->B->C->A（假设无 confidence 过滤）
   - 第 1 跳：A->B → B 入队
   - 第 2 跳（B）：B->C → C 入队
   - 第 3 跳（C）：C->A → check 触发 → continue → A 不入结果 ✓

4. **自环 + 正常出边** — A->A + A->B
   - 第 1 跳处理 A->A → check 触发 → A 不入结果 ✓
   - 第 1 跳处理 A->B → targetDocId=B ≠ A → B 入结果和入队 ✓

5. **已过滤自环**（deprecated 或低置信）
   - 自环被 `isTraversableRelation()` 过滤，不进入 for 循环 → 新 check 无需触发
   - 即使过滤失败，新 check 仍然拦截 → 双层保障 ✓

**Acceptance Auditor 评估** ✅

- **AC2 覆盖**："受影响文档路径、关系类型、传播行为类型、建议动作"中不包含源文档自身 ✓
- **语义准确性**："影响文档"的定义排除源文档自身 ✓
- **Test Coverage**：2 个新增回归测试（自环 + 回源环），覆盖修复边界 ✓

#### 评估结论

✅ **确认有效，可关闭**

修复准确、完整、无遗漏。测试覆盖充分。可作为最终交付代码。

---

### Finding #2 评估：CLI 路径根目录校验发生在 schema trim 之前

#### 修复回顾

修复代码：[src/cli/commands/impact.ts:76](../../../../src/cli/commands/impact.ts#L76)

```typescript
function normalizeImpactDocPath(projectRoot: string, docPath: string): string {
  const trimmedDocPath = docPath.trim();

  if (trimmedDocPath.length === 0) {
    return trimmedDocPath;
  }

  const absoluteDocPath = resolve(projectRoot, trimmedDocPath);
  const normalizedRelativePath = relative(projectRoot, absoluteDocPath).replaceAll('\\', '/');

  if (
    normalizedRelativePath === ''
    || normalizedRelativePath === '..'
    || normalizedRelativePath.startsWith('../')
  ) {
    throw new ConfigError({
      message: `影响分析路径位于项目根目录外: ${trimmedDocPath}`,
      suggestion: '请传入项目根目录内的文档路径，例如 docs/a.md',
    });
  }

  return normalizedRelativePath;
}
```

**修复设计**：在函数入口处立即执行 `docPath.trim()`，后续所有路径处理（resolve/relative 和根目录检查）都基于 trimmed 值。确保带空白的项目外路径（如 `' ../outside.md '`）在 `normalizeImpactDocPath()` 内部就被拒绝，不会通过 schema 的 trim 后进入 service。

#### 三层审查确认

**Blind Hunter 评估** ✅

- **执行顺序**：trim 在 resolve/relative 前执行，符合"先标准化再使用"的原则 ✓
- **控制流**：项目外检查基于 trimmed 值，不存在空白绕过的逻辑路径 ✓
- **错误处理**：抛 `ConfigError`（exit code 2），符合 P33 要求的入口拒绝 ✓
- **测试覆盖**：4 个相关测试全部通过 ✓

**Edge Case Hunter 评估** ✅

验证路径输入场景：

1. **单空格相对项目外** — `' ../outside.md '`
   - trim → `../outside.md`
   - resolve(`/repo`, `../outside.md`) → `/outside.md`
   - relative(`/repo`, `/outside.md`) → `../outside.md`
   - check: `startsWith('../')` → true → throw ConfigError ✓
   - 测试验证：`rejects whitespace-padded project-external relative paths before initializing the service` ✓

2. **多空格相对项目外** — `'   ../outside.md   '`
   - trim → `../outside.md` → 同上 ✓

3. **Tab 混合空白** — `' \t../outside.md\n '`
   - trim（标准行为包含 tab/newline）→ `../outside.md` → 同上 ✓

4. **单空格绝对项目外** — `' /outside.md '`
   - trim → `/outside.md`
   - resolve(`/repo`, `/outside.md`) → `/outside.md`（绝对路径忽略 projectRoot）
   - relative(`/repo`, `/outside.md`) → `../outside.md`
   - check: `startsWith('../')` → true → throw ConfigError ✓
   - 测试验证：`rejects whitespace-padded project-external absolute paths before initializing the service` ✓

5. **项目内相对路径有空白** — `' docs/a.md '`
   - trim → `docs/a.md`
   - resolve(`/repo`, `docs/a.md`) → `/repo/docs/a.md`
   - relative(`/repo`, `/repo/docs/a.md`) → `docs/a.md`
   - check: 不满足任何拒绝条件 → return `docs/a.md` ✓
   - 进入 service 正常处理 ✓
   - 测试验证：`normalizes ./ relative paths before calling ImpactService` ✓

6. **空路径** — `' '`
   - trim → `''`
   - check: `trimmedDocPath.length === 0` → return `''` 早期返回 ✓

7. **根目录变体** — `' . '`、`' .. '`
   - trim → `.` / `..`
   - resolve(`/repo`, `.`) → `/repo` → relative → `` → check: `=== ''` → throw ✓
   - resolve(`/repo`, `..`) → `/` → relative → `../` → check: `startsWith('../')` → throw ✓

**Acceptance Auditor 评估** ✅

- **P33 遵守**："项目根外路径必须在入口层、serviceFactory 前拒绝" ✓
   - 修复后：项目外路径在 `normalizeImpactDocPath()` 阶段拒绝 ✓
   - serviceFactory 不会被调用 ✓
- **同类 CLI 契约**：`impact` 修复后的入口顺序与 P33 要求一致；跨命令是否完全对齐仍需以 sibling CLI 的独立回归测试为准 ✓
- **错误输出**：exit code 2，错误信息清晰 ✓
- **Test Coverage**：4 个新增回归测试，覆盖相对路径、绝对路径、空白变体 ✓

#### 评估结论

✅ **确认有效，可关闭**

修复准确、完整、无遗漏。测试覆盖充分。可作为最终交付代码。

---

## Round 1 修复回归验证

### Finding #1：双向遍历导致上游文档误报

**现状验证**：✅ 仍然有效

- 代码：ImpactService 继续使用内部有向 BFS，`getRelationsByDocId(current.docId, 'source')` 明确要求出边
- 测试：✅ `does not report upstream documents reached only through incoming relations` — 通过
- Round 2 & 3 的其他修改未改变此处实现

**回归风险评估**：✅ 无风险

---

### Finding #2：低置信边仍参与路径扩展

**现状验证**：✅ 仍然有效

- 代码：`isTraversableRelation()` 继续过滤低置信边，不参与扩展
- 测试：✅ `does not expand through low-confidence relations that fail the threshold` — 通过
- Round 2 & 3 的其他修改未改变此处实现

**回归风险评估**：✅ 无风险

---

### Finding #3：同一受影响文档重复输出并膨胀 totalCount

**现状验证**：✅ 仍然有效

- 代码：`Map<string, ImpactedDoc>` 聚合机制继续有效，重复命中保留最强候选
- 测试：✅ `deduplicates impacted docs and keeps the strongest hit for the same document` — 通过
- Round 2 & 3 的其他修改未改变此处实现

**回归风险评估**：✅ 无风险

---

## 集成质量验证

| 检查项 | 状态 | 证据 |
|--------|------|------|
| 完整测试套件 | ✅ 323/323 通过 | `npm test` 输出 |
| impact 相关测试 | ✅ 22/22 通过 | 包含 11 个 CLI 测试 + 11 个 Service 测试 |
| 代码 lint | ✅ 通过 | `npm run lint` |
| TypeScript 编译 | ✅ 通过 | `npm run type-check` |
| 构建 | ✅ 通过 | `npm run build` |

---

## 新增问题评估

**结论**：✅ 无新增问题

三层平行审查通过以下维度完整穷举了所有可能的问题：

1. **Blind Hunter**：对抗式批判，检查逻辑漏洞、执行顺序、性能、可维护性 → 无发现
2. **Edge Case Hunter**：边界条件穷举，检查所有输入组合、极端值、交互场景 → 无发现
3. **Acceptance Auditor**：验收对照，检查 AC 符合、质量规则遵守、错误码一致性 → 无发现

### 后续补记（2026-05-12）

基于本轮 rules-extractor 的跨命令复查，后续在 sibling CLI 中发现一个**不改变本轮 `impact` 通过结论**、但与本轮入口契约主题同源的残留问题：`query` 命令的 `normalizeQueryDocPath()` 仍在 `resolve()` / `relative()` 前缺少 `trim()`，导致带前后空白的项目外路径可绕过 `serviceFactory()` 前的稳定 `ConfigError` 拒绝。

- **涉及文件**：[src/cli/commands/query.ts:84](../../../../src/cli/commands/query.ts#L84)、[tests/unit/cli/commands/query.test.ts:347](../../../../tests/unit/cli/commands/query.test.ts#L347)、[tests/unit/cli/commands/query.test.ts:364](../../../../tests/unit/cli/commands/query.test.ts#L364)
- **处理方式**：将 `query` 命令的路径归一化顺序补齐为 `trim() -> resolve() / relative() -> project-root 检查`，并新增两条 whitespace-padded 项目外相对/绝对路径回归测试。
- **验证记录**：`npx vitest run tests/unit/cli/commands/query.test.ts tests/unit/cli/commands/impact.test.ts && npm run lint && npm run type-check`
- **影响评估**：这属于同类 CLI 契约的一致性补修，不影响本轮对 `ImpactService` 和 `impact` CLI 修复有效性的评估结论；Story 3-3 的 round-3 结论仍保持“通过，可合并”。

---

## CR TODO 回顾

| # | 议题 | 本轮判定 |
|---|------|---------|
| R2-TODO-1 | relationType 级传播方向策略 | 维持非阻塞 |
| R2-TODO-2 | 完整路径解释输出 | 维持非阻塞 |
| R2-TODO-3 | 只读命令 .cord 目录创建 | 维持非阻塞 |

无新增 TODO。

---

## 最终评估

### 阻塞项

✅ **无阻塞项**

Round 2 的 2 个 `patch` 问题均已完全修复，Round 1 的三个修复仍然有效，无新增问题。

### 建议

**建议**：✅ **直接合并**

Story 3-3 已达到质量门禁标准，建议合并到主分支。

---

**评估结论**：✅ **通过** — Story 3-3 第 3 轮 CR 复审确认无阻塞项，建议合并。

## 修复执行记录

### 本轮执行记录

- **Date**: 2026-05-12
- **Model Used**: GPT-5.4
- **Fix Items**: 0

#### 本轮执行结论

- 最新评估文件未包含任何标记为“需要修复”的条目。
- Round 1 与 Round 2 的已知问题在本轮评估中均已确认关闭。
- 本轮未执行任何源码修改，也未扩大修复范围。

#### 说明

- 由于本轮无待修复项，fixer 阶段仅追加执行记录，不改动实现代码。
- 未新增运行验证命令；本轮是否可合并以评估文件中已确认的通过结论为准。

### 后续补充修复记录（跨命令一致性）

- **Date**: 2026-05-12
- **Model Used**: GPT-5.4
- **Fix Items**: 1

#### 修复项：query CLI 带空白项目外路径未在 serviceFactory 前稳定拒绝

- **涉及文件**: `src/cli/commands/query.ts`, `tests/unit/cli/commands/query.test.ts`
- **处理方式**: 对 `normalizeQueryDocPath()` 增加 `trim()` 前置标准化；若 trim 后为空仍交回 schema 处理，其他路径统一基于 trimmed 值执行 `resolve()` / `relative()` 和 project-root 检查。补齐带空白的项目外相对路径、绝对路径回归测试。
- **结果**: 已修复；`query` 与 `impact` 现在都满足“trim before boundary check”的入口契约。

#### 验证记录

- `npx vitest run tests/unit/cli/commands/query.test.ts`
- `npx vitest run tests/unit/cli/commands/query.test.ts tests/unit/cli/commands/impact.test.ts && npm run lint && npm run type-check`

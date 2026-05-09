---
Story: 2-6
Round: 1
Date: 2026-05-09
Model Used: GitHub Copilot (current session model not exposed)
Review Source: 2-6-code-review-summary-20260509-round-1.md
Review Model: GitHub Copilot (current session model not exposed)
Type: Code Review Evaluation
---

## 评估总结

对 Story 2-6 的第 1 轮 CR 代码审查结果（首轮）进行逐条评估。审查共提出 2 条中风险发现：同 contentHash 多候选 rename/move 匹配歧义、无变更快速返回在判定前全量读取并计算 contentHash。评估结论如下：发现 #1 确认为有效且建议阻塞修复；发现 #2 的性能风险描述成立，但 Story v0.1 已明确接受全量 contentHash 并将懒计算延至 v0.2，因此建议降级纳入 CR TODO 跟踪，并同步澄清 AC #7 / NFR6 的可测口径。

---

## 发现 #1 评估

### 审查原文

> **[中] 相同 contentHash 的重命名/移动匹配依赖 FIFO，可能更新错误 docId 路径**
> - 来源：blind+edge
> - 分类：patch

### 评估结论：✅ 确认有效 — 需要修复（P1 优先级）

### 评估分析

**问题描述准确性：准确**

代码验证确认该发现成立。`src/scanner/lifecycle-detector.ts:50` 先按 `contentHash` 构建 unmatched current bucket；当 stored path 不存在时，`src/scanner/lifecycle-detector.ts:71` 只用 `storedDoc.contentHash` 取候选；`src/scanner/lifecycle-detector.ts:145-155` 的 `takeGroupedSnapshot()` 对同 hash bucket 直接 `bucket.shift()`。这意味着多个 current 文件共享同一 `contentHash` 时，匹配结果由 currentFiles 的顺序决定，而不是由旧路径与新路径之间的稳定语义决定。

现有测试也支持审查结论：`tests/unit/scanner/lifecycle-detector.test.ts:79-148` 只覆盖单个同 hash rename 和单个同 hash move，没有覆盖多个 current 文件同 hash、多个 stored 文件同 hash、或多个同 hash 文件同批移动/重命名的歧义场景。

**严重性判断：合理**

原始严重性为中等，判断合理。该问题不是普通展示错误，而是可能把既有 `docId` 绑定到错误新路径，造成图谱节点身份、sync state 与路径记录错配。触发条件需要重复内容文件和同批 rename/move，概率不是最高，但一旦触发会影响后续增量扫描和关系图的一致性，因此应作为 P1 阻塞修复。

**修复建议：可行**

审查建议可行：对同 hash 多候选增加消歧策略（例如同目录、同 basename、路径距离最小），无法唯一判断时不要静默选择 FIFO，而是降级为 delete+add 并返回 warning。补充覆盖多候选歧义的单元测试也必要，能直接锁定该行为边界。

**误报评估：非误报**

该发现由 blind+edge 两层同时命中，且代码路径与测试缺口均可验证，不属于误报。

---

## 发现 #2 评估

### 审查原文

> **[中] 无变更快速返回在判定前仍全量读取并计算 contentHash，NFR6 覆盖不足**
> - 来源：edge
> - 分类：patch

### 评估结论：⚠️ 有效但降级 — 建议纳入 CR TODO 跟踪（P2 优先级）

### 评估分析

**问题描述准确性：基本准确**

实现层面的观察准确。`src/services/scan-service.ts:79-83` 在调用 `hasLifecycleChanges()` 并早返之前，先执行 `collectCurrentFileSnapshots(discoveredDocuments)`；`src/services/scan-service.ts:621-627` 对每个发现文档调用 `readCurrentFileSnapshot()`，其中 `src/services/scan-service.ts:627` 同时执行 `stat(filePath)` 与 `readFile(filePath)`；随后 `src/services/scan-service.ts:663-668` 才判断 lifecycle 是否有 renamed/moved/deleted/modified/added。因此无变更路径仍会读取所有发现文档内容并计算 hash。

测试覆盖不足的描述也基本准确。`tests/integration/cli/scan.test.ts:121-134` 的 `< 100ms` 断言只跑 `generic-project` fixture，而 `tests/fixtures/sample-projects/generic-project/` 只有 2 个 markdown 文档，无法证明中大型项目 p95。单元测试 `tests/unit/services/scan-service.test.ts:532-552` 验证了无变更时 pipeline 不再执行、不会重复 addDocument，但没有约束无变更路径的文件内容读取规模。

但该发现需要降级：Story 自身已在 `_bmad-output/implementation-artifacts/stories/2-6-incremental-scan-and-document-lifecycle-detection.md:104-107` 明确写入 v0.1 性能说明，即早期返回判定前会对所有文件完整计算 contentHash，大型仓库可能影响 NFR6，contentHash 懒计算延至 v0.2。因此这不是实现偏离当前 Story v0.1 设计，而是 AC #7 / NFR6 与 v0.1 性能说明之间仍需澄清的交付口径问题。

**严重性判断：偏高**

原审查标为中风险，可以理解为 NFR 风险；但在 Story 已显式接受全量 hash 作为 v0.1 边界的前提下，不宜与真实功能缺陷同级阻塞。更合理的处置是 P2：进入 CR TODO，明确 v0.2 懒 hash 优化或补充 AC #7 的样本规模/测试口径。

**修复建议：可行但非必要**

mtime-only 快速路径和懒 hash 方案技术上可行，也能从根上改善 NFR6；但这会改变当前 Story v0.1 已记录的实现边界，且需要重新设计 rename/move 检测何时读取 hash。若当前交付接受 v0.1 性能说明，则本轮不应强制实现；更合适的是把“大仓库懒 hash 优化 + 性能测试口径”纳入 CR TODO。

**误报评估：非误报**

实现确实在快返前全量读文件并 hash，测试也确实无法证明中大型项目 p95；只是严重性和处置方式需要降级。

---

## 整体评估结论

### 需要修复（阻塞交付）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 1 | 相同 contentHash 的重命名/移动匹配依赖 FIFO，可能更新错误 docId 路径 | [中] | **P1** | 多来源命中且代码证据明确，存在图谱节点身份错配风险，应在本轮修复并补测试。 |

### 建议纳入 CR TODO 跟踪（非阻塞）

| # | 发现 | 原始严重性 | 评估后优先级 | 说明 |
|---|------|----------|-----------|------|
| 2 | 无变更快速返回在判定前仍全量读取并计算 contentHash，NFR6 覆盖不足 | [中] | **P2** | 风险真实，但 Story v0.1 已显式将懒 hash 延至 v0.2；建议跟踪优化并澄清 AC #7 / NFR6 测试口径。 |

### 评估决定

- **发现 #1（同 contentHash rename/move FIFO 歧义）**：确认有效，建议按 P1 修复。修复方向为多候选消歧；无法唯一判断时降级 delete+add 并返回 warning，同时补充多个 current/stored 同 hash 的单元测试。
- **发现 #2（无变更快返前全量 contentHash）**：确认问题描述有效但降级为 P2。当前不建议阻塞 v0.1 交付，除非团队决定严格按大仓库 p95 < 100ms 执行 AC #7；否则应进入 CR TODO，后续补懒 hash 与性能测试。

## 修复执行记录

### 修复执行记录

- **Date**: 2026-05-09
- **Model Used**: GPT-5.4
- **Fix Items**: 1

#### Fix 1: 相同 contentHash 的 rename/move 多候选歧义

- **评估结论**: 需要修复（P1）
- **涉及文件**:
	- src/scanner/lifecycle-detector.ts
	- tests/unit/scanner/lifecycle-detector.test.ts
- **修改内容**:
	- 将按 contentHash bucket 的 FIFO `shift()` 匹配改为“互相唯一最优匹配”流程，避免仅由 currentFiles / storedDocs 顺序决定 docId 与新路径绑定关系。
	- 匹配评分改为三层消歧：优先同目录 rename，其次同 basename move，再比较 basename 编辑距离与路径距离；只有 stored 侧和 current 侧都形成唯一最优时才认定为 rename/move。
	- 当同 hash 多候选不存在唯一最优匹配时，不再错误生成 rename/move，而是保留为 delete + add 结果，避免把错误 docId 更新到错误路径。
	- 新增多候选同 hash 回归测试：一条验证可稳定消歧的 rename + move 组合，一条验证真正歧义时会降级为 delete/add。
- **修复结果**: 已完成
- **验证结果**:
	- `npm test -- tests/unit/scanner/lifecycle-detector.test.ts` ✅
	- `npm test -- tests/unit/services/scan-service.test.ts` ✅
	- `npm test && npm run type-check && npm run lint` ✅
- **备注**:
	- 评估文件中的发现 #2 维持 P2 TODO 跟踪，本次未处理，符合“只修复明确标记为需要修复的问题”的执行边界。

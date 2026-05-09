---
Story: 2-6
Round: 1
Date: 2026-05-09
Model Used: GitHub Copilot (current session model not exposed)
Type: Code Review Summary
---

## 审查结论

首轮审查。三层审查均完成（Blind Hunter / Edge Case Hunter / Acceptance Auditor，无失败层）。`npm test && npm run type-check && npm run lint` 已在当前终端上下文通过，补充执行 `npm run build` 通过。实现覆盖主要 AC，但发现 2 个中风险问题：一个会在重复内容文件的 rename/move 场景中造成路径更新歧义；一个是 AC #7 / NFR6 的无变更快速返回性能口径与当前全量 hash 实现、测试覆盖不一致。建议修复后进入下一轮评估。

## 新发现

### 1. [中] 相同 contentHash 的重命名/移动匹配依赖 FIFO，可能更新错误 docId 路径

- **来源**：blind+edge
- **分类**：patch

- **证据**
  - `src/scanner/lifecycle-detector.ts:71` 对旧路径缺失的 storedDoc 仅按 `storedDoc.contentHash` 取候选。
  - `src/scanner/lifecycle-detector.ts:145-155` 的 `takeGroupedSnapshot()` 对同 hash bucket 使用 `bucket.shift()`，没有路径相似度、唯一性校验或歧义降级。
  - `tests/unit/scanner/lifecycle-detector.test.ts:74-148` 只覆盖单个共享 hash 的 rename/move，没有覆盖多个当前文件或多个旧文件拥有相同 `contentHash` 的场景。

- **影响**
  - 当两个文档内容完全相同，并在同一次扫描中发生 rename/move，旧文档到新路径的匹配取决于 `adapter.discoverDocuments()` 与 `repository.getAllDocuments()` 的数组顺序，而不是稳定语义。结果可能把 A 的 `docId` 更新到 B 的新路径，造成图谱节点身份和路径错配。

- **建议**
  - 对同 hash 多候选增加消歧策略，例如优先同目录/同 basename/路径距离最小；无法唯一判断时不要静默 rename/move，可降级为 delete+add 并返回 warning。
  - 补充单元测试：多个 current 文件同 hash、多个 stored 文件同 hash、两个同 hash 文件同时移动/重命名。

### 2. [中] 无变更快速返回在判定前仍全量读取并计算 contentHash，NFR6 覆盖不足

- **来源**：edge
- **分类**：patch

- **证据**
  - `src/services/scan-service.ts:79-83` 在 `hasLifecycleChanges()` 早返之前先调用 `collectCurrentFileSnapshots(discoveredDocuments)`。
  - `src/services/scan-service.ts:621-638` 对所有发现文档执行 `stat + readFile + sha256`，无变更路径也会读取全量文件内容。
  - `tests/integration/cli/scan.test.ts:121-140` 只用 generic fixture 的 2 个文档断言 `durationMs < 100`，没有覆盖中大型项目或较大文件集合。

- **影响**
  - AC #7 要求无变更增量扫描 p95 < 100ms，但当前实现的早返路径仍与文档数量和文件大小线性相关。小样本测试通过不能证明 NFR6，较大仓库中很容易超过 100ms。

- **建议**
  - 将无变更判定拆成 mtime-only 快速路径：先收集 path + mtime，与 sync state 比较；只有存在删除、添加、mtime 变化或需要 rename/move 判断时，再计算相关文件 hash。
  - 或者如果 v0.1 明确接受全量 hash，将 AC #7 改为带样本规模/范围的可测口径，并把大仓库懒 hash 优化记录为非阻塞 TODO。
  - 增加性能/行为测试，至少覆盖多文件无变更场景，并断言 pipeline 未执行、事务未开启、文件内容读取被限制在必要范围内。

## 验证摘要

- `npm test` ✅ 通过（当前终端上下文显示已通过）
- `npm run lint` ✅ 通过（当前终端上下文显示已通过）
- `npm run type-check` ✅ 通过（当前终端上下文显示已通过）
- `npm run build` ✅ 通过（tsup ESM + DTS build success）
- 定向复核 ✅
  - Acceptance Auditor 对 AC #1-#8 未发现阻塞缺口。
  - SQLite Repository 的 `transaction()` 使用 better-sqlite3 transaction，事务回滚候选被判定为误报。
  - 删除文档级联清理手动关系属于“文档已删除后关系失效”的数据完整性行为，未列为缺陷。

## 通过项

- 增量模式选择已避免已有图谱重复走冷启动 INSERT ALL，降低 `documents.path` 唯一约束冲突风险。
- modified/added 路径复用扫描 pipeline，并写回完整 SyncState。
- rename/move 在 v0.1 范围内仅更新 `documents.path`，与 Story 约束一致。
- 删除路径通过 repository 级联清理孤立节点、关系和 sync state。
- 既有非阻塞项：modified 文档仅刷新 outgoing 非 manual 关系、rename/move 不做路径敏感 docType/preset 刷新，均符合 Story v0.1 边界。
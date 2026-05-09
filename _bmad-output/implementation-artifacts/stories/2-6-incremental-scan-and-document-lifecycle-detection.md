# Story 2.6: 增量扫描与文档生命周期检测

Status: done

## Story

As a 用户，
I want 增量扫描只处理变更的文档，并自动检测重命名/移动/删除的文档，
So that 日常使用中扫描速度极快，且图谱自动保持与文件系统同步。

## Acceptance Criteria (AC)

1. **Given** Story 2.5 冷启动扫描就绪 **When** 增量扫描 **Then** 仅处理 mtime 变更的文档（FR7）
2. **Given** 生命周期检测 **When** 实现 **Then** `src/scanner/lifecycle-detector.ts` 对比文件系统快照与图谱记录
3. **Given** 文档重命名 **When** 检测到 **Then** 更新图谱中的文档路径（v0.1：仅更新 `documents.path`；路径敏感的 docType 重分类与 preset 关系刷新延至 v0.2）
4. **Given** 文档移动 **When** 检测到 **Then** 更新文档路径（v0.1 约束同 AC 3）
5. **Given** 文档删除 **When** 检测到 **Then** 清理孤立节点和失效关系边（FR8）
6. **Given** cord scan **When** 在已有图谱的项目中重复执行且未传 `--rebuild` **Then** 自动判断并进入增量扫描/无变更快速返回路径，而不是再次执行冷启动 INSERT ALL；不得因重复插入 `documents.path` 触发唯一约束
7. **Given** 无变更 **When** 增量扫描 **Then** p95 < 100ms（NFR6）
8. **Given** 实现完毕 **When** 运行测试 **Then** 覆盖增量扫描 + 生命周期检测 + 无变更快速返回

## Tasks / Subtasks

- [x] Task 1: 实现 lifecycle-detector.ts (AC: #2, #3, #4, #5)
  - [x] 1.1 对比文件系统与图谱记录
  - [x] 1.2 重命名检测（相同 content_hash，不同路径）
  - [x] 1.3 移动检测
  - [x] 1.4 删除检测和清理
- [x] Task 2: 扩展 ScanService 增量模式 (AC: #1, #6)
  - [x] 2.1 检测图谱是否已有数据 → 自动选择模式；已有图谱且未传 `--rebuild` 时必须进入增量路径，不得回退到冷启动 INSERT ALL
  - [x] 2.2 对比 mtime 确定变更文档
  - [x] 2.3 仅处理变更文档；无变更时直接返回，不触发 documents/relations/sync_states 的重复冷启动写入
- [x] Task 3: 无变更优化 (AC: #7)
  - [x] 3.1 早期返回：无 mtime 变化时直接返回
- [x] Task 4: 编写测试 (AC: #8)

## Dev Notes

### 生命周期检测逻辑

#### lifecycle-detector 输入契约

```typescript
/** 当前文件系统快照 — 事务外收集 */
interface CurrentFileSnapshot {
  path: string;
  mtimeMs: number;         // fs.statSync(path).mtimeMs
  contentHash: string;     // sha256(content)
}

/** 图谱中已存储的文档记录 */
interface StoredDocRecord {
  docId: string;
  path: string;
  contentHash: string;
  lastObservedMtimeMs: number;  // 上次扫描时观测到的 mtimeMs
  status: 'synced' | 'modified';   // 对应 SyncState.status，供 renamed/moved 分支写回继承
}

interface LifecycleResult {
  renamed: { oldPath: string; newPath: string; docId: string; currentMtimeMs: number }[];
  moved: { oldPath: string; newPath: string; docId: string; currentMtimeMs: number }[];
  deleted: { path: string; docId: string }[];
  modified: CurrentFileSnapshot[];
  unchanged: string[];
  added: CurrentFileSnapshot[];
}

/**
 * lifecycle-detector 是纯函数模块，不直接操作 Repository。
 * 输入：CurrentFileSnapshot[] + StoredDocRecord[]
 * 输出：LifecycleResult
 */
function detectLifecycle(
  currentFiles: CurrentFileSnapshot[],
  storedDocs: StoredDocRecord[]
): LifecycleResult;
```

#### 检测策略

- **变更检测**：`current.mtimeMs !== stored.lastObservedMtimeMs`（语义清晰：比较同类时间戳）
- **重命名检测**：content_hash 相同但路径不同的文档对
- **content hash**：`crypto.createHash('sha256').update(content).digest('hex')`

> **说明**：`lastObservedMtimeMs` 记录上次扫描时观测到的文件修改时间，与 `lastScannedAt`（扫描操作时间）语义不同。比较 `mtimeMs vs lastObservedMtimeMs` 避免了 Story 1.4 `SyncState.lastScannedAt` 的时间语义混淆。

### 增量扫描流程（两阶段事务契约）

**阶段 1 — 事务外（可失败、可重试）**：
```
1. loadConfig(projectRoot) → resolveAdapter(config, projectRoot) → computeEffectiveScanPaths(config, adapter) → adapter.discoverDocuments(projectRoot, scanPaths, excludePaths) → 当前文件路径
   （复用 Story 2.5 步骤 1-3，冷启动与增量共享同一前置发现链路）
2. 对每个文件收集 fs.statSync + contentHash → CurrentFileSnapshot[]
3. repo 读取已存储文档 → StoredDocRecord[]  （包含 lastObservedMtimeMs）
4. detectLifecycle(currentFiles, storedDocs) → LifecycleResult
4b. 若图谱中已存在文档记录且未传 `--rebuild`，本次 `cord scan` 的默认语义即为增量扫描；禁止回退到 Story 2.5 的冷启动 INSERT ALL 路径，否则会对 `documents.path UNIQUE` 产生重复插入风险
5. 对 modified + added 文档执行与冷启动相同的完整构建子链路：
   pipeline.process → ScanPipelineResult { document, relations, warnings }
   → docType classify → preset merge → merge/dedupe → relationTypes 过滤
   （复用 Story 2.5 定义的完整链路，确保增量与冷启动结果等价）
5b. warnings 聚合: results.flatMap(r => r.warnings) → allWarnings[]
   纳入最终 ScanResult.warnings 返回给 CLI 输出层
6. 无变更（LifecycleResult 全部 unchanged）：早期返回，跳过事务
```

> **v0.1 性能说明**：步骤 2 在早期返回判定之前对所有文件完整计算 contentHash，大型仓库中此开销可能影响 p95 < 100ms（NFR6）目标；contentHash 懒计算优化（先比 mtime，mtime 变化时再读文件内容计算 hash）延至 v0.2。

**阶段 2 — 事务内（短写集、原子提交）**：
```
repo.transaction(() => {
  7. 处理删除：repo.deleteDocument(docId) + cascade 删除关联关系
  8. 处理重命名/移动：repo.updateDocument(docId, { path: newPath })
     （v0.1 约束：仅更新 documents.path，不重算 docType 或 preset 关系；路径敏感刷新延至 v0.2）
  9. 处理 modified 文档：
     a. repo.deleteRelationsByDocId(docId, 'source', { excludeSources: ['manual'] }) 仅删除 outgoing 非-manual 关系边
        （指定 'source' 方向确保仅删除该文档作为 sourceDoc 的边，不影响其他文档指向本文档的 inbound 边；
         excludeSources: ['manual'] 确保 source='manual' 的手动关系边不被删除，保留用户自定义的关联（Story 4.2 manual 保护机制））
     b. 插入新关系边
     c. repo.updateDocument(docId, { path, contentHash, title, docType, metadata }) 更新文档节点
  10. 写入新增文档和关系
  11. 按路径类型写回完整 SyncState（满足 Story 1.4 upsertSyncState(state: SyncState) 全字段契约）：
      - added:   upsertSyncState({ docId, lastScannedAt: new Date().toISOString(), lastObservedMtimeMs, contentHash, status: 'synced' })
      - modified: upsertSyncState({ docId, lastScannedAt: new Date().toISOString(), lastObservedMtimeMs, contentHash, status: 'synced' })
      - renamed/moved: 从 StoredDocRecord 继承 contentHash 和 status，更新 lastScannedAt 和 lastObservedMtimeMs：
                  upsertSyncState({ docId, lastScannedAt: new Date().toISOString(), lastObservedMtimeMs: item.currentMtimeMs, contentHash: stored.contentHash, status: stored.status })
                  （item 为迭代 LifecycleResult.renamed/moved 的当前元素，currentMtimeMs 字段见 LifecycleResult 类型定义）
      - deleted: cascade 已自动清除，无需操作
});
```

> **数据一致性保证**：对于 modified/added 文档，增量路径复用冷启动的完整构建子链路（步骤 5），确保 framework_preset 关系被正确刷新，满足 `cord scan --rebuild` 与增量扫描在 modified/added 路径上的结果等价。rename/move 在 v0.1 仅更新 `documents.path`，不保证路径敏感的 docType 与 preset 关系同步（延至 v0.2）。

### 架构约束

- 增量扫描遵循两阶段事务契约（与 Story 2.5 冷启动一致）：事务外计算、事务内短写（NFR15）
- AC #6 的 owner 在 ScanService 模式选择逻辑：已有图谱且未传 `--rebuild` 时必须进入增量/无变更快速返回语义，避免再次走冷启动插入路径触发 `documents.path UNIQUE`
- lifecycle-detector 是纯函数模块，不直接操作 Repository
- 重命名/移动只更新 `documents.path`，关系边按 `docId` 建立无需修改
- **excludeSources 依赖**：步骤 9a 使用 `deleteRelationsByDocId(docId, 'source', { excludeSources: ['manual'] })`，要求 Story 1.4 `IGraphRepository` 接口已支持 `options?.excludeSources` 可选参数，Story 4.2 Task 1.4 执行该接口升级
- **v0.1 inbound preset 边约束**：增量扫描仅刷新 modified/added 文档的非-manual outgoing 关系边（步骤 9a 指定 `'source'` 方向 + `excludeSources`）；未修改文档指向被修改文档的 inbound `framework_preset` 边在 docType 未变化时保持有效。若 rename/move 或内容变化导致 docType 改变进而影响 preset 边，可通过 `cord scan --rebuild` 修复（v0.1 假设 modified 文档 docType 不因内容变化而改变，docType 由文件名/路径 glob 模式决定）

### Project Structure Notes

- `src/scanner/lifecycle-detector.ts`
- `src/services/scan-service.ts` — 扩展增量模式

### References

- [Source: prd.md#FR7, FR8] — 增量扫描需求
- [Source: prd.md#NFR6] — 无变更性能要求
- [Source: epics.md#Story 2.6] — 验收标准来源

## Dev Agent Record

### Agent Model Used

- GPT-5.4

### Debug Log References

- `npm test -- tests/unit/scanner/lifecycle-detector.test.ts`
- `npm test -- tests/unit/services/scan-service.test.ts`
- `npm test -- tests/integration/cli/scan.test.ts`
- `npm test`
- `npm test && npm run type-check && npm run lint`

### Completion Notes List

- 完成 `src/scanner/lifecycle-detector.ts` 纯函数模块，按文件系统快照与图谱记录输出 renamed/moved/deleted/modified/unchanged/added 六类生命周期结果。
- 完成 `src/services/scan-service.ts` 增量路径：已有图谱且未传 `--rebuild` 时自动切换到 snapshot + lifecycle 模式，按 mtime 仅重处理 modified/added 文档，并在无变更时快速返回。
- 在事务内接入 rename/move/delete 生命周期写回：更新 `documents.path`、级联清理删除文档、刷新 changed 文档的 outgoing 非 manual 关系和对应 sync state。
- 新增 `tests/unit/scanner/lifecycle-detector.test.ts`，覆盖基础分类、同目录重命名和跨目录移动场景。
- 扩展 `tests/unit/services/scan-service.test.ts`，覆盖无变更快返、mtime 增量刷新、rename/move 路径更新和 delete 级联清理。
- 扩展 `tests/integration/cli/scan.test.ts`，以真实 SQLite 仓储验证重复扫描自动进入增量/无变更快返，且本地小样本耗时 < 100ms。
- 约定 rename/move 分类规则：同目录仅文件名变化记为 rename；目录变化记为 move，供 v0.1 路径更新流程复用。
- 通过最终质量门：`npm test && npm run type-check && npm run lint`。

### File List

- src/scanner/index.ts
- src/scanner/lifecycle-detector.ts
- src/services/scan-service.ts
- tests/integration/cli/scan.test.ts
- tests/unit/scanner/lifecycle-detector.test.ts
- tests/unit/services/scan-service.test.ts
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/stories/2-6-incremental-scan-and-document-lifecycle-detection.md

## Change Log

- 2026-05-09: 完成增量扫描、生命周期检测、无变更快返与对应单元/集成测试，Story 状态更新为 review。

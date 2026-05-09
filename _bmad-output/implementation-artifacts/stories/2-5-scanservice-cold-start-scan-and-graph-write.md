# Story 2.5: ScanService 冷启动扫描与图谱写入

Status: done

## Story

As a 用户，
I want 运行 `cord scan` 对项目所有文档执行冷启动扫描，
So that 文档间的关系图谱从零建立，我可以看到文档之间有哪些关联。

## Acceptance Criteria (AC)

1. **Given** Story 2.2 扫描引擎和 Story 2.4 配置加载就绪 **When** 执行冷启动扫描 **Then** `src/services/scan-service.ts` 编排完整扫描流程
2. **Given** 扫描执行中 **When** 发生异常 **Then** 事务保护，异常中断不产生脏数据（NFR15）
3. **Given** 扫描完成 **When** 检查数据库 **Then** 结果写入 documents、relations、sync_states 表
4. **Given** 关系记录 **When** 检查来源 **Then** scan rule 产出的关系来源标记为 `auto_scan`，adapter preset rule 产出的关系来源标记为 `framework_preset`（FR21 + Story 1.3 RelationSource 三值契约）
5. **Given** CLI 命令 **When** 实现 **Then** `src/cli/commands/scan.ts` 薄壳命令
6. **Given** CLI 输出 **When** 完成 **Then** 人类可读格式：发现关系数 + 耗时 + 警告
7. **Given** --json flag **When** 传入 **Then** 输出 JSON 格式
8. **Given** 退出码 **When** 不同结果 **Then** 0=成功、1=运行时错误、2=参数/配置错误
9. **Given** 性能 **When** 测量 **Then** ≥ 4 文档/秒（NFR5）
10. **Given** --rebuild **When** 传入 **Then** 完全重建图谱（NFR18）；若库中存在 manual 关系边，提示确认或使用 `--force` 跳过（实际检测逻辑由 Story 4.2 Task 3 实现，v0.1 接口预留）
11. **Given** 端到端 **When** 集成测试 **Then** fixtures/sample-projects/ 验证

## Tasks / Subtasks

- [x] Task 1: 实现 ScanService (AC: #1, #2, #3, #4)
  - [x] 1.1 `src/services/scan-service.ts` — 构造函数注入 IGraphRepository + pipeline + adapter registry
  - [x] 1.2 resolveAdapter() 选择适配器（参见 Story 2.1 Adapter Resolution 契约）
  - [x] 1.3 scan() 方法：loadConfig → resolveAdapter → computeEffectiveScanPaths → discoverDocuments → pipeline.process → docType classify → preset merge → merge/dedupe → relationTypes 过滤 → 事务写入
  - [x] 1.4 docType classify：用 adapter.getDocumentTypes() 对 ParsedDocument 匹配文档类型
  - [x] 1.5 preset merge：用 adapter.getPresetRules() 根据已分类文档生成预设关系（source: 'framework_preset'）
  - [x] 1.6 merge/dedupe：scan results + preset results 去重，同 (sourceDoc, targetDoc, relationType) 保留高置信度
  - [x] 1.6b relationTypes 过滤：按 config.relationTypes 移除 enabled: false 的关系类型条目
  - [x] 1.7 事务包装保证原子性（参见下方事务契约）
  - [x] 1.8 --rebuild：同事务内 `deleteAllDocuments()`（级联清除全部关系和同步状态）+ INSERT ALL 全量重建
- [x] Task 2: 实现 CLI 命令 (AC: #5, #6, #7, #8)
  - [x] 2.1 `src/cli/commands/scan.ts` — 薄壳：参数解析（--rebuild、--force、--json）→ ScanService → 格式化输出
- [x] Task 3: 创建测试 fixtures (AC: #11)
  - [x] 3.1 `tests/fixtures/sample-projects/bmad-project/` — BMAD 样本
  - [x] 3.2 `tests/fixtures/sample-projects/generic-project/` — 通用样本
- [x] Task 4: 更新 index.ts 门面
- [x] Task 5: 编写单元 + 集成测试 (AC: #9)

## Dev Notes

### ScanService 流程

```
scan(input: ScanInput): Promise<ScanResult>
1. loadConfig(projectRoot)
2. adapter = resolveAdapter(config, projectRoot)
2b. computeEffectiveScanPaths(config, adapter) → { scanPaths: string[], excludePaths: string[] }
    （依据 Story 2.4 effectiveScanPaths 契约：基础路径 + framework/IDE 预设追加 + 排除过滤）
3. adapter.discoverDocuments(projectRoot, scanPaths, excludePaths) → filePaths[]
4. for each filePath:
   - 预检（大小 > 1MB 或非 .md）→ 跳过，追加到 allWarnings[]，继续下一文件
   - pipeline.process(filePath) → ScanPipelineResult | null
     null（编码错误）→ 跳过，追加到 allWarnings[]，继续下一文件
     非 null → ScanPipelineResult { document, relations (source: 'auto_scan'), warnings }
5. docType classify: adapter.getDocumentTypes() → 对每个 document 匹配文档类型
6. preset merge: adapter.getPresetRules() → 根据文档类型匹配生成预设关系 (source: 'framework_preset')
7. merge/dedupe: scan results + preset results → 去重（同 source+target+type 以高置信度优先）
7b. warnings 聚合: allResults.flatMap(r => r.warnings) 合并到 allWarnings[]（与步骤 4 中跳过产生的 warnings 追加到同一数组，最终统一返回给 CLI）
7c. relationTypes 过滤: 按 config.relationTypes 对 relations 过滤，移除 enabled: false 的类型条目
8. transaction { 批量写入 documents / relations / sync_states }
9. return ScanResult { documentsFound, relationsDiscovered, warnings: allWarnings, duration }
```

> **数据流说明**：步骤 4 产出的 scan relations 标记 `source: 'auto_scan'`，步骤 6 产出的 preset relations 标记 `source: 'framework_preset'`。去重规则：同 `(sourceDoc, targetDoc, relationType)` 组合时保留置信度更高的记录，**保留该记录的原始 source 值**（不合并、不覆盖）。
>
> **rebuild 范围说明**：v0.1 的 `--rebuild` 执行全量重建——`deleteAllDocuments()` 通过 `ON DELETE CASCADE` 级联清除所有关系边和同步状态，然后 INSERT ALL 重新写入。v0.1 不保留 `manual` 边（Epic 4 实现手动关系后再细化 rebuild 策略，届时可引入基于 source 的条件删除或 upsert 模式）。

### CLI 薄壳模式

```typescript
// src/cli/commands/scan.ts
import { Command } from 'commander';
export const scanCommand = new Command('scan')
  .option('--rebuild', '完全重建图谱')
  .option('--force', '跳过 manual 关系确认，直接执行 rebuild（需与 --rebuild 配合使用）')
  .option('--json', 'JSON 格式输出')
  .action(async (options) => {
    // 1. 解析参数 → ScanInput
    // 2. [v0.1 manual 关系检测预留点]：--rebuild 时检测库中是否存在 source='manual' 的关系边
    //    实际检测 + 确认逻辑由 Story 4.2 Task 3 实现（ScanService.getManualRelationsCount() + CLI 交互）
    // 3. 调用 ScanService.scan()
    // 4. 格式化输出
    // 5. process.exit(exitCode)
  });
```

### 架构约束

- **P7**: ScanService 构造函数注入 IGraphRepository
- **P11**: 输入用 Zod schema 类型，输出用明确返回类型
- **P12**: CLI 薄壳不含业务逻辑
- **P13**: ScanService 可为 async（调用 async scanner pipeline）

### 两阶段事务契约

为满足 NFR15（异常中断不产生脏数据）和 NFR18（完全重建）：

**阶段 1 — 事务外（可失败、可重试）**：
- loadConfig、resolveAdapter、computeEffectiveScanPaths、discoverDocuments
- pipeline.process（文件读取 + AST 解析 + 规则求值）
- docType classify + preset merge + merge/dedupe + relationTypes 过滤
- 产出：完整的写入计划（documents[] + relations[] + syncStates[]）

**阶段 2 — 事务内（短写集、原子提交）**：
- 一个 better-sqlite3 同步事务
- 正常扫描：`INSERT/UPDATE documents + INSERT relations + UPSERT sync_states`
- `--rebuild`：同一事务内 `deleteAllDocuments()`（级联清除全部）+ INSERT ALL（全量原子重建）
- 事务失败自动回滚，阶段 1 产物无副作用

```typescript
// 伪代码
const plan = await buildScanPlan(...);   // 阶段 1：事务外
repo.transaction(() => {                  // 阶段 2：事务内短写
  if (rebuild) {
    repo.deleteAllDocuments(); // ON DELETE CASCADE 级联清除 relations + sync_states
  }
  for (const doc of plan.documents) repo.addDocument(doc);
  for (const rel of plan.relations) repo.addRelation(rel);
  for (const ss of plan.syncStates) repo.upsertSyncState(ss);
});
```

### Project Structure Notes

- `src/services/scan-service.ts`
- `src/cli/commands/scan.ts`
- `src/services/index.ts` — 更新导出

### References

- [Source: architecture/implementation-patterns-consistency-rules.md#P7, P11-P13] — Service 层规范
- [Source: prd.md#FR6, FR21, FR24-FR27] — 扫描和存储需求
- [Source: prd.md#NFR5, NFR15, NFR18] — 性能和可靠性
- [Source: epics.md#Story 2.5] — 验收标准来源

## Dev Agent Record

### Agent Model Used

- GPT-5.4

### Debug Log References

- `npm test -- tests/unit/services/scan-service.test.ts`
- `npm test -- tests/unit/cli/commands/scan.test.ts`
- `npm test -- tests/unit/cli/index.test.ts`
- `npm test -- tests/integration/cli/scan.test.ts`
- `npm test && npm run type-check && npm run lint`
- `npm test`

### Completion Notes List

- 完成 `src/services/scan-service.ts`，实现冷启动扫描编排、文档类型匹配、framework preset 关系生成、去重、relationTypes 过滤与事务写入。
- 新增 `tests/unit/services/scan-service.test.ts`，覆盖冷启动写库、source 优先级/去重、禁用关系过滤、rebuild 顺序和事务回滚。
- 完成 `src/cli/commands/scan.ts` 薄壳命令，接入 `createProgram()`，实现 `--rebuild`、`--force`、`--json` 参数解析、成功/失败输出与 0/1/2 退出码映射。
- 新增 `tests/unit/cli/commands/scan.test.ts`，覆盖人类可读输出、JSON 输出、参数错误和运行时错误路径；补充 `tests/unit/cli/index.test.ts` 覆盖主程序命令注册。
- 创建 `tests/fixtures/sample-projects/bmad-project/` 与 `generic-project/` 实际样本内容，用于真实 adapter + CLI 冷启动链路验证。
- 新增 `tests/integration/cli/scan.test.ts`，覆盖 BMAD 冷启动写库、generic CLI 默认 `.cord/cord.db` 创建，以及 4 docs/s 的性能门槛验证。
- 通过最终回归：`npm test && npm run type-check && npm run lint`。

### File List

- src/services/scan-service.ts
- src/services/index.ts
- src/schemas/scan-input.ts
- src/cli/commands/scan.ts
- src/cli/commands/index.ts
- src/cli/index.ts
- tests/unit/cli/commands/scan.test.ts
- tests/unit/cli/index.test.ts
- tests/unit/services/scan-service.test.ts
- tests/unit/schemas/scan-input.test.ts
- tests/integration/cli/scan.test.ts
- tests/fixtures/sample-projects/bmad-project/_bmad/config.yaml
- tests/fixtures/sample-projects/bmad-project/_bmad-output/prd.md
- tests/fixtures/sample-projects/bmad-project/_bmad-output/architecture/overview-architecture.md
- tests/fixtures/sample-projects/bmad-project/_bmad-output/epics/epic-1.md
- tests/fixtures/sample-projects/bmad-project/_bmad-output/stories/2-1-scan-core.md
- tests/fixtures/sample-projects/generic-project/docs/overview.md
- tests/fixtures/sample-projects/generic-project/docs/notes.md
- _bmad-output/implementation-artifacts/stories/2-5-scanservice-cold-start-scan-and-graph-write.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

## Change Log

- 2026-05-08: 完成 ScanService 冷启动扫描、scan CLI、sample-project fixtures 与端到端测试，Story 状态更新为 review。

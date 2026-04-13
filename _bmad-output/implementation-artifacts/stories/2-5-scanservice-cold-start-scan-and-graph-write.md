# Story 2.5: ScanService 冷启动扫描与图谱写入

Status: ready-for-dev

## Story

As a 用户，
I want 运行 `cord scan` 对项目所有文档执行冷启动扫描，
So that 文档间的关系图谱从零建立，我可以看到文档之间有哪些关联。

## Acceptance Criteria (AC)

1. **Given** Story 2.2 扫描引擎和 Story 2.4 配置加载就绪 **When** 执行冷启动扫描 **Then** `src/services/scan-service.ts` 编排完整扫描流程
2. **Given** 扫描执行中 **When** 发生异常 **Then** 事务保护，异常中断不产生脏数据（NFR15）
3. **Given** 扫描完成 **When** 检查数据库 **Then** 结果写入 documents、relations、sync_states 表
4. **Given** 关系记录 **When** 检查来源 **Then** 来源标记为 auto_scan（FR21）
5. **Given** CLI 命令 **When** 实现 **Then** `src/cli/commands/scan.ts` 薄壳命令
6. **Given** CLI 输出 **When** 完成 **Then** 人类可读格式：发现关系数 + 耗时 + 警告
7. **Given** --json flag **When** 传入 **Then** 输出 JSON 格式
8. **Given** 退出码 **When** 不同结果 **Then** 0=成功、1=运行时错误、2=参数/配置错误
9. **Given** 性能 **When** 测量 **Then** ≥ 4 文档/秒（NFR5）
10. **Given** --rebuild **When** 传入 **Then** 完全重建图谱（NFR18）
11. **Given** 端到端 **When** 集成测试 **Then** fixtures/sample-projects/ 验证

## Tasks / Subtasks

- [ ] Task 1: 实现 ScanService (AC: #1, #2, #3, #4)
  - [ ] 1.1 `src/services/scan-service.ts` — 构造函数注入 IGraphRepository + pipeline + adapter
  - [ ] 1.2 scan() 方法：loadConfig → discoverDocuments → pipeline.process → repo 写入
  - [ ] 1.3 事务包装保证原子性
  - [ ] 1.4 --rebuild：先清空数据再全量扫描
- [ ] Task 2: 实现 CLI 命令 (AC: #5, #6, #7, #8)
  - [ ] 2.1 `src/cli/commands/scan.ts` — 薄壳：参数解析 → ScanService → 格式化输出
- [ ] Task 3: 创建测试 fixtures (AC: #11)
  - [ ] 3.1 `tests/fixtures/sample-projects/bmad-project/` — BMAD 样本
  - [ ] 3.2 `tests/fixtures/sample-projects/generic-project/` — 通用样本
- [ ] Task 4: 更新 index.ts 门面
- [ ] Task 5: 编写单元 + 集成测试 (AC: #9)

## Dev Notes

### ScanService 流程

```
scan(input: ScanInput): Promise<ScanResult>
1. loadConfig(projectRoot)
2. adapter.discoverDocuments(projectRoot, config) → filePaths[]
3. for each filePath: pipeline.process(filePath) → ParsedDocument + DiscoveredRelation[]
4. transaction {
     for each doc: repo.addDocument(doc)
     for each relation: repo.addRelation(relation)
     for each doc: repo.upsertSyncState(state)
   }
5. return ScanResult { documentsFound, relationsDiscovered, warnings, duration }
```

### CLI 薄壳模式

```typescript
// src/cli/commands/scan.ts
import { Command } from 'commander';
export const scanCommand = new Command('scan')
  .option('--rebuild', '完全重建图谱')
  .option('--json', 'JSON 格式输出')
  .action(async (options) => {
    // 1. 解析参数 → ScanInput
    // 2. 调用 ScanService.scan()
    // 3. 格式化输出
    // 4. process.exit(exitCode)
  });
```

### 架构约束

- **P7**: ScanService 构造函数注入 IGraphRepository
- **P11**: 输入用 Zod schema 类型，输出用明确返回类型
- **P12**: CLI 薄壳不含业务逻辑
- **P13**: ScanService 可为 async（调用 async scanner pipeline）

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

### Debug Log References

### Completion Notes List

### File List

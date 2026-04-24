# Story 4.2: 收敛保护机制与来源优先级

Status: ready-for-dev

## Story

As a 用户，
I want 增量扫描时系统保护我手动修正过的关系，
So that 自动扫描不会覆盖我的手动修正，图谱准确度随使用自然收敛。

## Acceptance Criteria (AC)

1. **Given** Story 4.1 关系管理和 Story 2.6 增量扫描就绪 **When** 增量扫描 **Then** 手动添加的关系不被自动删除（FR22）
2. **Given** 增量扫描 **When** 检查 deprecated **Then** 手动标记为 deprecated（status='deprecated'）的关系不被自动恢复（FR22）
3. **Given** 优先级规则 **When** 冲突 **Then** 手动修正 > 框架预设 > 自动扫描发现（FR22）
4. **Given** 关系来源 **When** 区分 **Then** 三种类型：auto_scan / manual / framework_preset
5. **Given** 扩展性 **When** 新增传播类型 **Then** 本 Story 实现不破坏新增 relationType 时已有数据无需迁移即可正常查询的保证（NFR9 非回归验证）
6. **Given** source 文档被修改 **When** 增量扫描 **Then** 该文档的 manual outgoing 边仍然保留，不被删除（FR22）
7. **Given** `cord scan --rebuild` **When** 库中存在 manual 关系（source='manual'）时 **Then** 输出警告提示并要求用户确认，方可继续执行（FR22 数据保护）
8. **Given** `cord scan --rebuild --force` **When** 库中存在 manual 关系 **Then** 跳过确认直接执行 rebuild，CLI 仍输出已删除 manual 关系数量的提示
9. **Given** 实现完毕 **When** 测试 **Then** 手动关系增量扫描保持 + deprecated 不恢复 + 优先级冲突 + source 文档修改后 manual 边保留 + rebuild 有 manual 关系时警告确认 + `--force` 跳过确认

## Tasks / Subtasks

- [ ] Task 1: 扩展 ScanService 收敛保护逻辑 (AC: #1, #2, #3, #6)
  - [ ] 1.1 增量扫描开始前快照 manual 边（取出所有 source='manual' 的关系）
  - [ ] 1.2 **覆盖 Story 2.6 删边契约**：将 2.6 步骤 9a 的 `deleteRelationsByDocId(docId, 'source')` 改为排除式删除，跳过 source='manual' 的关系；修改地点在 scan-service.ts 的删边调用处
  - [ ] 1.3 优先级冲突解决（写入时跳过）
  - [ ] 1.4 **升级 IGraphRepository 接口**：为 `deleteRelationsByDocId` 新增可选参数 `options?: { excludeSources?: RelationSource[] }`，同步更新 Story 1.4 的 repository 实现和接口签名（此为正式接口变更，不仅是 Dev Notes 提及）
- [ ] Task 2: 来源类型标记 (AC: #4)
- [ ] Task 3: 实现 rebuild 前 manual 关系警告与确认 (AC: #7, #8)
  - [ ] 3.1 `cord scan --rebuild` 执行前，检测库中是否存在 `source='manual'` 的关系
  - [ ] 3.2 若存在，输出警告并通过交互式提示要求用户确认（`@clack/prompts` confirm）
  - [ ] 3.3 `cord scan --rebuild --force` flag：跳过确认直接执行，提示已删除 manual 关系数量
  - [ ] 3.4 CLI owner 在 `src/cli/commands/scan.ts`，新增 `--force` option 并处理上述逻辑
- [ ] Task 4: 编写测试 (AC: #5, #6, #9)
  - [ ] 4.1 手动关系在增量扫描后保持不变
  - [ ] 4.2 manual deprecated 关系不被恢复
  - [ ] 4.3 优先级冲突场景
  - [ ] 4.4 **source 文档被修改时，manual outgoing 边不被删除**（最常见场景）
  - [ ] 4.5 rebuild 有 manual 关系时抛出警告并等待确认（mock @clack/prompts confirm）
  - [ ] 4.6 `--force` 跳过确认并输出已删数量提示

## Dev Notes

### 关键设计决策：manual 保护时序修复（发现#3 裁决）

Story 2.6 增量扫描在步骤 9a 执行 `deleteRelationsByDocId(docId, 'source')`，该操作**无差别删除所有 outgoing 边**，包括 source='manual' 的边。

Story 4.2 的修复方案：将 2.6 删边逻辑改为"排除式删除"，具体拥有逃脱点在 `scan-service.ts` 中：

```
// 之前（Story 2.6 原具）
repo.deleteRelationsByDocId(docId, 'source');

// 修改后（Story 4.2 扩展）
// 删除前排除 manual 边（无论 status='active' 还是 'deprecated'）
repo.deleteRelationsByDocId(docId, 'source', { excludeSources: ['manual'] });
```

IGraphRepository 的 `deleteRelationsByDocId` 操作需要支持 `excludeSources` 可选参数（Story 1.4 库层接口升级）。

### 关键设计决策：rebuild 与 manual 边的处理方案（发现#4 裁决）

> **v0.1 明确裁决：NFR18 中的"重建后与全量扫描结果一致"仅约束自动发现的关系图谱，不包含 manual 状态。**

具体行为：
- `--rebuild` 执行前，CLI 工具**必须检测当前库中是否存在 manual 关系（source='manual'）**
- 若存在，输出警告：`ℹ️ 注意：检测到 N 条手动关系，--rebuild 将删除这些关系。如需保留，请先导出备份。`
- 用户确认后方可继续 rebuild（或通过 `--force` 跳过确认）
- manual 关系的备份/回放能力属于后续版本范畴，不在 v0.1 范围内

**CLI owner 明确**：warning/confirm/`--force` 逻辑的实现入口在 `src/cli/commands/scan.ts`（scan 命令的 `--rebuild` 分支），不在 ScanService 内。ScanService 提供 `getManualRelationsCount()` 查询接口供 CLI 调用，保持 Service 层无 CLI 依赖。

### 收敛保护逻辑（写入阶段）

```
增量扫描写入关系时：
1. 检查是否已存在相同 source+target+type 的关系
2. 如果存在且来源为 manual → 跳过（不覆盖）
3. 如果存在且来源为 framework_preset → 仅当新发现来源也是 framework_preset 或 manual 时更新
4. 如果存在且来源为 auto_scan → 可覆盖
5. 如果关系 status='deprecated' 且来源为 manual → 不恢复（跳过）
```

### Project Structure Notes

- `src/services/scan-service.ts` — 扩展收敛保护

### References

- [Source: prd.md#FR22] — 收敛保护
- [Source: prd.md#NFR9] — 传播类型扩展性
- [Source: epics.md#Story 4.2] — 验收标准

## Dev Agent Record

### Agent Model Used
### Debug Log References
### Completion Notes List
### File List

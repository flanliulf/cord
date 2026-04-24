# Story 4.1: RelationService 手动添加与移除关系

Status: ready-for-dev

## Story

As a 用户，
I want 手动添加文档间的关系或移除/标记已有关系为 deprecated，
So that 我可以修正自动扫描的误判，让图谱更准确。

## Acceptance Criteria (AC)

1. **Given** 已有图谱 **When** 手动管理 **Then** `src/services/relation-service.ts` 实现手动添加关系（FR18）
2. **Given** 管理操作 **When** 移除/deprecated **Then** 支持移除（硬删除）或标记为 deprecated（FR19）
   - `removeRelation`：物理删除关系记录（硬删除），无历史保留
   - `deprecateRelation`：保留原 `relationType`，新增 `status: 'deprecated'` 状态位，不改变关系类型字段
3. **Given** 添加关系 **When** 检查来源 **Then** 标记为 manual（FR21）
4. **Given** 修改关系 **When** 检查历史 **Then** 对**保留中**（status='active'）的关系记录修改历史（FR21）；`removeRelation` 为硬删除，不保留历史记录
5. **Given** 添加时 **When** 验证 **Then** 验证源/目标文档存在于图谱
6. **Given** 重复添加 **When** 检测 **Then** 返回明确提示
7. **Given** 错误 **When** 格式 **Then** `[错误码] 描述 → 建议`（NFR19）
8. **Given** 实现完毕 **When** 测试 **Then** 覆盖添加/移除/deprecated + 文档不存在 + 重复 + 来源和历史 + deprecated 状态保留原 relationType 验证

## Tasks / Subtasks

- [ ] Task 1: 扩展 RelationEdge 类型与持久化契约 (AC: #2, #4)
  - [ ] 1.1 在 `RelationEdge` 中添加 `status: 'active' | 'deprecated'` 状态位字段（保留原 `relationType` 不变）
  - [ ] 1.2 更新 Story 1.3 的 Zod schema 和 `IGraphRepository` 接口以支持 status 字段
  - [ ] 1.3 新增数据库 migration：为 `relations` 表添加 `status TEXT NOT NULL DEFAULT 'active'` 列（兼容已有数据库，存量记录默认 'active'）
  - [ ] 1.4 更新 SQLite row ↔ RelationEdge mapper，确保 status 字段读写正确映射
- [ ] Task 2: 实现 RelationService (AC: #1-#7)
  - [ ] 2.1 addRelation(input: AddRelationInput) — 手动添加，source='manual'，status='active'
  - [ ] 2.2 removeRelation(input: RemoveRelationInput) — 硬删除，不保留历史
  - [ ] 2.3 deprecateRelation(input: DeprecateRelationInput) — 设置 status='deprecated'，保留原 relationType
  - [ ] 2.4 修改历史记录（仅对 status='active' 关系有效，存储在 metadata.history）
- [ ] Task 3: 更新 index.ts 门面
- [ ] Task 4: 编写测试 (AC: #8)

## Dev Notes

### RelationEdge 状态位模型（发现#1 裁决）

deprecated 不改变 `relationType` 字段，而是通过独立的 `status` 字段标记：

```typescript
interface RelationEdge {
  // ... 已有字段 ...
  relationType: RelationType;        // 原始关系类型，deprecated 后保持不变
  status: 'active' | 'deprecated';  // 新增状态位，默认 'active'
  source: 'auto_scan' | 'manual' | 'framework_preset';
  metadata?: {
    history?: RelationHistory[];  // 仅 status='active' 时追加修改记录
    [key: string]: unknown;
  };
}
```

这样 auto_scan 重新发现同一 `source+target+relationType` 三元组时，能正确命中 deprecated 记录，保护逻辑可靠。

### remove 语义裁决（发现#2 裁决）

`removeRelation` 是**硬删除**，物理删除关系记录。FR21 的历史追溯**仅对活跃关系（status='active'）有效**，不覆盖 remove 路径。

> 若未来需要 remove 审计能力，应引入独立审计表，属于后续版本范畴（不在 v0.1 范围内）。

### RelationService 设计（P11 规范，对象入参，发现#7 修订）

```typescript
interface RemoveRelationInput  { relationId: string; }
interface DeprecateRelationInput { relationId: string; }
// AddRelationInput 已有定义，保持不变

export class RelationService {
  constructor(private readonly repo: IGraphRepository) {}
  addRelation(input: AddRelationInput): RelationEdge { ... }
  removeRelation(input: RemoveRelationInput): void { ... }        // 硬删除，不保留历史
  deprecateRelation(input: DeprecateRelationInput): RelationEdge { ... } // 设置 status='deprecated'
}
```

- 所有操作前验证文档存在
- 重复检查：同一 source+target+type 组合（无论 status 如何）
- 修改历史（metadata.history）仅对 status='active' 关系追加，remove 不写历史

### Project Structure Notes

- `src/services/relation-service.ts`

### References

- [Source: prd.md#FR18-FR21] — 关系管理需求
- [Source: epics.md#Story 4.1] — 验收标准

## Dev Agent Record

### Agent Model Used
### Debug Log References
### Completion Notes List
### File List

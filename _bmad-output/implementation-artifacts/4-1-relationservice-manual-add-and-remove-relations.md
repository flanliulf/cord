# Story 4.1: RelationService 手动添加与移除关系

Status: ready-for-dev

## Story

As a 用户，
I want 手动添加文档间的关系或移除/标记已有关系为 deprecated，
So that 我可以修正自动扫描的误判，让图谱更准确。

## Acceptance Criteria (AC)

1. **Given** 已有图谱 **When** 手动管理 **Then** `src/services/relation-service.ts` 实现手动添加关系（FR18）
2. **Given** 管理操作 **When** 移除/deprecated **Then** 支持移除或标记为 deprecated（FR19）
3. **Given** 添加关系 **When** 检查来源 **Then** 标记为 manual（FR21）
4. **Given** 修改关系 **When** 检查历史 **Then** 记录修改历史（FR21）
5. **Given** 添加时 **When** 验证 **Then** 验证源/目标文档存在于图谱
6. **Given** 重复添加 **When** 检测 **Then** 返回明确提示
7. **Given** 错误 **When** 格式 **Then** `[错误码] 描述 → 建议`（NFR19）
8. **Given** 实现完毕 **When** 测试 **Then** 覆盖添加/移除/deprecated + 文档不存在 + 重复 + 来源和历史

## Tasks / Subtasks

- [ ] Task 1: 实现 RelationService (AC: #1-#7)
  - [ ] 1.1 addRelation() — 手动添加，source='manual'
  - [ ] 1.2 removeRelation() — 删除关系
  - [ ] 1.3 deprecateRelation() — 标记 deprecated
  - [ ] 1.4 修改历史记录（metadata 字段存储）
- [ ] Task 2: 更新 index.ts 门面
- [ ] Task 3: 编写测试 (AC: #8)

## Dev Notes

### RelationService 设计

```typescript
export class RelationService {
  constructor(private readonly repo: IGraphRepository) {}
  addRelation(input: AddRelationInput): RelationEdge { ... }
  removeRelation(relationId: string): void { ... }
  deprecateRelation(relationId: string): RelationEdge { ... }
}
```

- 所有操作前验证文档存在
- 重复检查：同一 source+target+type 组合
- 修改历史存储在 metadata.history 数组中

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

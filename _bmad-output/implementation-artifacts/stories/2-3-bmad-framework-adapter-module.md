# Story 2.3: BMAD 框架适配模块

Status: ready-for-dev

## Story

As a BMAD-Method 用户，
I want CORD 开箱即用地识别 BMAD 文档类型并应用预设关系规则，
So that 我的 BMAD 项目文档关系可以被准确识别，无需手动配置。

## Acceptance Criteria (AC)

1. **Given** Story 2.1 适配器接口和 Story 2.2 扫描引擎就绪 **When** 实现 BMAD 适配器 **Then** `src/adapters/framework/bmad/adapter.ts` 实现 BmadFrameworkAdapter（extends AbstractFrameworkAdapter）
2. **Given** 适配器实现 **When** 定义文档类型 **Then** `src/adapters/framework/bmad/doc-types.ts` 定义 18 种 BMAD 文档类型
3. **Given** 文档类型定义 **When** 定义预设规则 **Then** `src/adapters/framework/bmad/preset-rules.ts` 定义预设关系规则
4. **Given** 框架检测需求 **When** 实现检测 **Then** `src/adapters/framework/bmad/detector.ts` 实现 5 层递进检测策略
5. **Given** 预设规则 **When** 检查置信度 **Then** 框架预设规则的置信度 ≥ 0.90
6. **Given** 实现完毕 **When** 运行测试 **Then** 覆盖率 ≥ 80%

## Tasks / Subtasks

- [ ] Task 1: 定义 18 种 BMAD 文档类型 (AC: #2)
  - [ ] 1.1 `src/adapters/framework/bmad/doc-types.ts`
- [ ] Task 2: 定义预设关系规则 (AC: #3, #5)
  - [ ] 2.1 `src/adapters/framework/bmad/preset-rules.ts`
- [ ] Task 3: 实现 5 层递进检测 (AC: #4)
  - [ ] 3.1 `src/adapters/framework/bmad/detector.ts`
- [ ] Task 4: 实现 BmadFrameworkAdapter (AC: #1)
  - [ ] 4.1 `src/adapters/framework/bmad/adapter.ts`
- [ ] Task 5: 更新 index.ts 门面
- [ ] Task 6: 编写测试 (AC: #6)

## Dev Notes

### 18 种 BMAD 文档类型

| # | 类型名 | 文件模式 | 典型路径 |
|---|--------|---------|---------|
| 1 | prd | `**/prd*.md` | `_bmad-output/planning-artifacts/prd.md` |
| 2 | architecture | `**/architecture*.md` | `_bmad-output/planning-artifacts/architecture/` |
| 3 | epic | `**/epic*.md` | `_bmad-output/planning-artifacts/epics.md` |
| 4 | story | `**/[0-9]-[0-9]-*.md` | `_bmad-output/implementation-artifacts/1-1-*.md` |
| 5 | sprint-plan | `**/sprint-plan*.md` | `_bmad-output/planning-artifacts/` |
| 6 | sprint-status | `**/sprint-status*.yaml` | `_bmad-output/implementation-artifacts/` |
| 7 | technical-research | `**/technical-*research*.md` | `_bmad-output/planning-artifacts/research/` |
| 8 | domain-research | `**/domain-*research*.md` | `_bmad-output/planning-artifacts/research/` |
| 9 | market-research | `**/market-*research*.md` | `_bmad-output/planning-artifacts/research/` |
| 10 | product-brief | `**/product-brief*.md` | `_bmad-output/planning-artifacts/` |
| 11 | project-context | `**/project-context*.md` | 项目根或 docs/ |
| 12 | brainstorming | `**/brainstorming*.md` | `_bmad-output/brainstorming/` |
| 13 | ux-design | `**/ux*.md` | `_bmad-output/planning-artifacts/` |
| 14 | retrospective | `**/retrospective*.md` | `_bmad-output/implementation-artifacts/` |
| 15 | index | `**/index.md` | 各目录 |
| 16 | validation-report | `**/validation*.md` | `_bmad-output/planning-artifacts/` |
| 17 | distillate | `**/distillat*.md` | `_bmad-output/planning-artifacts/` |
| 18 | config | `**/config.yaml`, `**/module.yaml` | `_bmad/` |

### 预设关系规则（示例）

```typescript
const BMAD_PRESET_RULES: PresetRule[] = [
  { sourceDocType: 'prd', targetDocType: 'architecture', relationType: 'sync_required', confidence: 0.95 },
  { sourceDocType: 'epic', targetDocType: 'story', relationType: 'contains', confidence: 0.95 },
  { sourceDocType: 'sprint-plan', targetDocType: 'story', relationType: 'lifecycle_bound', confidence: 0.90 },
  { sourceDocType: 'prd', targetDocType: 'epic', relationType: 'derived_from', confidence: 0.90 },
  { sourceDocType: 'architecture', targetDocType: 'epic', relationType: 'context_for', confidence: 0.90 },
  { sourceDocType: 'project-context', targetDocType: '*', relationType: 'context_for', confidence: 0.90 },
  { sourceDocType: 'product-brief', targetDocType: 'prd', relationType: 'derived_from', confidence: 0.90 },
  { sourceDocType: 'technical-research', targetDocType: 'architecture', relationType: 'context_for', confidence: 0.90 },
  { sourceDocType: 'prd', targetDocType: 'ux-design', relationType: 'sync_required', confidence: 0.90 },
  // ... 更多规则
];
```

### 5 层递进检测策略

1. **Layer 1**: 检查 `_bmad/` 目录是否存在
2. **Layer 2**: 检查 `_bmad-output/` 目录是否存在
3. **Layer 3**: 检查 `.claude/skills/bmad-*` 文件是否存在
4. **Layer 4**: 检查 package.json 中是否有 bmad 相关依赖
5. **Layer 5**: 检查文档中是否有 BMAD 风格的 frontmatter

匹配 ≥ 2 层 → 高置信度检测为 BMAD 项目

### 参考：CORD 项目自身就是 BMAD 项目

可以参考 `/Users/fancyliu/Repos/cord/_bmad-output/` 的实际结构作为真实 BMAD 文档类型样本。

### Project Structure Notes

- `src/adapters/framework/bmad/adapter.ts`
- `src/adapters/framework/bmad/doc-types.ts`
- `src/adapters/framework/bmad/preset-rules.ts`
- `src/adapters/framework/bmad/detector.ts`

### References

- [Source: prd.md#FR33-FR36] — 框架适配需求
- [Source: prd.md#FR34] — BMAD 18 种文档类型
- [Source: architecture/project-structure-boundaries.md] — bmad 适配模块目录
- [Source: epics.md#Story 2.3] — 验收标准来源

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

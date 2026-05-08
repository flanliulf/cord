# Story 2.3: BMAD 框架适配模块

Status: done

## Story

As a BMAD-Method 用户，
I want CORD 开箱即用地识别 BMAD 文档类型并应用预设关系规则，
So that 我的 BMAD 项目文档关系可以被准确识别，无需手动配置。

## Acceptance Criteria (AC)

1. **Given** Story 2.1 适配器接口和 Story 2.2 扫描引擎就绪 **When** 实现 BMAD 适配器 **Then** `src/adapters/framework/bmad/adapter.ts` 实现 BmadFrameworkAdapter（extends AbstractFrameworkAdapter）
2. **Given** 适配器实现 **When** 定义文档类型 **Then** `src/adapters/framework/bmad/doc-types.ts` 定义 16 种 v0.1 Markdown BMAD 文档类型（YAML 类型延至 v0.2）
3. **Given** 文档类型定义 **When** 定义预设规则 **Then** `src/adapters/framework/bmad/preset-rules.ts` 定义预设关系规则
4. **Given** 框架检测需求 **When** 实现检测 **Then** `src/adapters/framework/bmad/detector.ts` 实现 5 层递进检测策略
5. **Given** 预设规则 **When** 检查置信度 **Then** 框架预设规则的置信度 ≥ 0.90
6. **Given** 实现完毕 **When** 运行测试 **Then** 16 种 v0.1 文档类型识别 + 预设规则匹配 + 框架检测逻辑，覆盖率 ≥ 80%。测试须包含：基于当前仓库真实 BMAD 文件的正例命中测试 + 非 BMAD 文件（如 `_bmad/` 模板目录）的误匹配反例排除测试

## Tasks / Subtasks

- [x] Task 1: 定义 16 种 v0.1 Markdown BMAD 文档类型 (AC: #2)
  - [x] 1.1 `src/adapters/framework/bmad/doc-types.ts`（v0.1 仅包含 Markdown 类型，YAML 类型 #6/#18 延至 v0.2）
- [x] Task 2: 定义预设关系规则 (AC: #3, #5)
  - [x] 2.1 `src/adapters/framework/bmad/preset-rules.ts`
- [x] Task 3: 实现 5 层递进检测 (AC: #4)
  - [x] 3.1 `src/adapters/framework/bmad/detector.ts`
- [x] Task 4: 实现 BmadFrameworkAdapter (AC: #1)
  - [x] 4.1 `src/adapters/framework/bmad/adapter.ts`
- [x] Task 5: 更新 index.ts 门面
- [x] Task 6: 编写测试 (AC: #6)
  - [x] 6.1 正例测试：当前仓库真实 BMAD 文件（prd.md, architecture/*.md, epic-*.md 等）正确命中对应文档类型
  - [x] 6.2 反例测试：非 BMAD 文件（`_bmad/` 模板、流程说明等）不被误识别为 BMAD 文档类型
  - [x] 6.3 预设规则匹配 + 框架检测 + 覆盖率验证

## Dev Notes

### 18 种 BMAD 文档类型

> **v0.1 范围约束**：v0.1 仅支持 Markdown 文档类型（16 种）。YAML 类型（#6 sprint-status、#18 config）标记为 v0.2 扩展，v0.1 中 BmadFrameworkAdapter 的 `getDocumentTypes()` 不返回这两种类型，发现阶段（Story 2.1）和扫描管道（Story 2.2）仅处理 `.md` 文件。

> **glob 范围护栏**：下表中的文件模式（如 `**/*validation*.md`）不在全仓库范围执行，而是仅对 Story 2.4 `effectiveScanPaths` 产出的候选文件列表进行匹配。这确保宽泛的包含式 glob 不会误识别 `_bmad/` 模板目录或其他非目标文档。实现时 `adapter.getDocumentTypes()` 返回的 patterns 由 ScanService 在已发现的文件列表上逐一匹配，而非直接做文件系统 glob 扫描。

| # | 类型名 | 文件模式 | 典型路径 | v0.1 支持 |
|---|--------|---------|---------|-----------|
| 1 | prd | `**/prd*.md` | `_bmad-output/planning-artifacts/prd.md` | ✅ |
| 2 | architecture | `**/*architecture*.md`, `**/architecture/**/*.md` | `_bmad-output/planning-artifacts/architecture/` | ✅ |
| 3 | epic | `**/epic*.md` | `_bmad-output/planning-artifacts/epics/` | ✅ |
| 4 | story | `**/[0-9]-[0-9]-*.md` | `_bmad-output/implementation-artifacts/1-1-*.md` | ✅ |
| 5 | sprint-plan | `**/sprint-plan*.md` | `_bmad-output/planning-artifacts/` | ✅ |
| 6 | sprint-status | `**/sprint-status*.yaml` | `_bmad-output/implementation-artifacts/` | ⏳ v0.2 |
| 7 | technical-research | `**/technical-*research*.md` | `_bmad-output/planning-artifacts/research/` | ✅ |
| 8 | domain-research | `**/domain-*research*.md` | `_bmad-output/planning-artifacts/research/` | ✅ |
| 9 | market-research | `**/market-*research*.md` | `_bmad-output/planning-artifacts/research/` | ✅ |
| 10 | product-brief | `**/product-brief*.md` | `_bmad-output/planning-artifacts/` | ✅ |
| 11 | project-context | `**/project-context*.md` | 项目根或 docs/ | ✅ |
| 12 | brainstorming | `**/brainstorming*.md` | `_bmad-output/brainstorming/` | ✅ |
| 13 | ux-design | `**/ux*.md` | `_bmad-output/planning-artifacts/` | ✅ |
| 14 | retrospective | `**/retrospective*.md` | `_bmad-output/implementation-artifacts/` | ✅ |
| 15 | index | `**/index.md` | 各目录 | ✅ |
| 16 | validation-report | `**/*validation*.md` | `_bmad-output/planning-artifacts/` | ✅ |
| 17 | distillate | `**/*distillat*.md` | `_bmad-output/planning-artifacts/` | ✅ |
| 18 | config | `**/config.yaml`, `**/module.yaml` | `_bmad/` | ⏳ v0.2 |

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

GPT-5.4

### Debug Log References

- `npm test -- tests/unit/adapters/framework/bmad/doc-types.test.ts`
- `npm test -- tests/unit/adapters/framework/bmad/preset-rules.test.ts`
- `npm test -- tests/unit/adapters/framework/bmad/detector.test.ts`
- `npm test -- tests/unit/adapters/framework/bmad/adapter.test.ts`
- `npm test -- tests/unit/adapters/framework.test.ts`
- `npm test -- tests/unit/adapters/framework/bmad/classification.test.ts`
- `npm test`
- `npm run test:coverage`
- `npm run lint`
- `npm run type-check`

### Completion Notes List

- 实现 `BmadFrameworkAdapter`、`BMAD_DOCUMENT_TYPES`、`BMAD_PRESET_RULES` 与 5 层检测器，默认注册到 framework 门面并优先于 Generic 兜底。
- 为当前仓库真实 BMAD 文件补充正例分类测试，并通过 `_bmad/` 模板目录排除测试验证误匹配护栏。
- 基于真实仓库样本收窄 `epic` glob 到 `**/epics/epic*.md`，并为 retrospective 增加 `**/retrospectives/**/*.md` 目录模式，消除现有 `epic-*-retro-*.md` 的分类歧义。
- 以 fixture 覆盖仓库当前不存在的 `sprint-plan` 与 `ux-design` 两类 v0.1 文档，保证 16 种类型全部有测试命中。
- 完成全量测试、覆盖率、lint、type-check 验证；`src/adapters/framework/bmad/*` 覆盖率为 95%+。

### File List

- `src/adapters/framework/bmad/adapter.ts`
- `src/adapters/framework/bmad/detector.ts`
- `src/adapters/framework/bmad/doc-types.ts`
- `src/adapters/framework/bmad/preset-rules.ts`
- `src/adapters/framework/index.ts`
- `tests/unit/adapters/framework.test.ts`
- `tests/unit/adapters/framework/bmad/adapter.test.ts`
- `tests/unit/adapters/framework/bmad/classification.test.ts`
- `tests/unit/adapters/framework/bmad/detector.test.ts`
- `tests/unit/adapters/framework/bmad/doc-types.test.ts`
- `tests/unit/adapters/framework/bmad/preset-rules.test.ts`
- `_bmad-output/implementation-artifacts/stories/2-3-bmad-framework-adapter-module.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-05-07: 完成 Story 2.3 BMAD 框架适配模块实现、测试与验证，状态更新为 review。

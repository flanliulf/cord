# Story 2.2: 扫描引擎核心管道（remark AST + 规则引擎）

Status: done

## Story

As a 用户，
I want 一个基于 remark/unified 的文档解析管道和规则引擎，
So that 系统可以解析 Markdown 文档并通过规则识别文档间的关系。

## Acceptance Criteria (AC)

1. **Given** Story 2.1 框架适配层就绪 **When** 实现扫描管道 **Then** `src/scanner/pipeline.ts` 实现 remark/unified 处理管道编排
2. **Given** 管道就绪 **When** 实现插件 **Then** 三个 remark 插件就绪：extract-frontmatter、extract-links、extract-headings
3. **Given** 插件就绪 **When** 实现规则引擎 **Then** `src/scanner/rules/index.ts` 定义 IScanRule 接口和规则注册机制
4. **Given** 规则接口定义 **When** 实现规则 **Then** frontmatter-rule（置信度 ≥ 0.95）、markdown-link-rule（≥ 0.85）、directory-rule（0.50-0.70）
5. **Given** 规则发现关系 **When** 分类 **Then** 每条关系按 9 种传播行为类型分类（FR10）
6. **Given** 关系发现 **When** 标记 **Then** 每条关系标记置信度分数（FR11，0.0-1.0）
7. **Given** 关系粒度 **When** 检查 **Then** 关系粒度为文档级（FR12）
8. **Given** 异常文档 **When** 扫描 **Then** 跳过并记录 WARNING（NFR16：编码错误/非 Markdown/超大 > 1MB）
9. **Given** 实现完毕 **When** 运行测试 **Then** 覆盖率 ≥ 90%

## Tasks / Subtasks

- [x] Task 1: 创建扫描管道 (AC: #1)
  - [x] 1.1 `src/scanner/pipeline.ts` — unified + remarkParse + remarkFrontmatter + remarkGfm 编排
  - [x] 1.2 管道流程：读文件 → 解析 AST → 提取元数据 → 运行规则 → 返回发现的关系
- [x] Task 2: 创建 remark 插件 (AC: #2)
  - [x] 2.1 `src/scanner/plugins/extract-frontmatter.ts` — 提取 YAML frontmatter 引用
  - [x] 2.2 `src/scanner/plugins/extract-links.ts` — 提取 Markdown 链接
  - [x] 2.3 `src/scanner/plugins/extract-headings.ts` — 提取标题结构
- [x] Task 3: 定义 IScanRule 和规则注册 (AC: #3)
  - [x] 3.1 `src/scanner/rules/index.ts` — IScanRule 接口 + 注册机制
- [x] Task 4: 实现三种规则 (AC: #4, #5, #6, #7)
  - [x] 4.1 `src/scanner/rules/frontmatter-rule.ts` — frontmatter 引用解析，置信度 ≥ 0.95
  - [x] 4.2 `src/scanner/rules/markdown-link-rule.ts` — Markdown 链接提取，置信度 ≥ 0.85
  - [x] 4.3 `src/scanner/rules/directory-rule.ts` — 目录结构推断，置信度 0.50-0.70
- [x] Task 5: 异常文档处理 (AC: #8)
  - [x] 5.1 文件大小检查（> 1MB 跳过）
  - [x] 5.2 非 .md 文件跳过
  - [x] 5.3 编码错误处理（try-catch + WARNING 日志）
- [x] Task 6: 定义扫描类型 (AC: #7)
  - [x] 6.1 `src/scanner/types.ts` — ParsedDocument、DiscoveredRelation、ScanPipelineResult
- [x] Task 7: 更新 index.ts 门面
- [x] Task 8: 编写测试 (AC: #9)

## Dev Notes

### 管道流程

```
文件路径 → readFile → unified().use(remarkParse).use(remarkFrontmatter).use(remarkGfm)
    → AST → extract-frontmatter plugin → extract-links plugin → extract-headings plugin
    → ParsedDocument → [frontmatter-rule, markdown-link-rule, directory-rule]
    → DiscoveredRelation[]
```

### 扫描类型定义

```typescript
// src/scanner/types.ts
export interface ParsedDocument {
  path: string;
  frontmatter: Record<string, unknown>;
  links: string[];           // 文档内所有 Markdown 链接目标
  headings: { depth: number; text: string }[];
  contentHash: string;
}

export interface DiscoveredRelation {
  sourceDoc: string;         // 源文档路径
  targetDoc: string;         // 目标文档路径
  relationType: RelationType;
  confidence: number;        // 0.0 - 1.0
  source: RelationSource;    // 'auto_scan' | 'framework_preset'（默认 'auto_scan'）
  ruleName: string;          // 发现该关系的规则名
  metadata?: Record<string, unknown>;
}

export interface ScanPipelineResult {
  document: ParsedDocument;
  relations: DiscoveredRelation[];
  warnings: string[];
}

/**
 * pipeline.process 返回 ScanPipelineResult | null
 * - null（跳过）：文件大小 > 1MB 或非 .md 扩展名 → 调用 pipeline.process 前预检过滤直接返回 null
 *                 编码错误 → pipeline 内部 try-catch 捕获后返回 null 并记录 warning
 * - 非 null（成功）：结果进入 docType classify 和写入计划
 *
 * 跳过形状契约（预检前移方案）：
 * - Task 5.1（大小）/ Task 5.2（非 .md）：在 ScanService 步骤 3→4 之间进行预检，跳过条件命中时
 *   直接推入 warnings（不调用 pipeline.process），继续处理下一个文件
 * - Task 5.3（编码错误）：pipeline 内部 try-catch，catch 时返回 null，调用方判断 null 后跳过
 */
```

### IScanRule 接口

```typescript
export interface IScanRule {
  readonly name: string;
  evaluate(doc: ParsedDocument, allDocPaths: string[]): DiscoveredRelation[];
}
```

### 规则实现要点

**frontmatter-rule（≥ 0.95）：**
- 查找 frontmatter 中的引用字段：`inputDocuments`、`references`、`dependencies`、`relatedDocs`
- 解析引用路径，匹配已知文档
- 关系类型推断：`inputDocuments` → `derived_from`，`references` → `references`

**markdown-link-rule（≥ 0.85）：**
- 提取所有 `[text](path)` 格式的链接
- 同时处理相对路径和绝对路径的 .md 文件链接
- 相对路径：基于文档所在目录解析为项目根相对路径
- 绝对路径（以 `/` 开头）：相对于项目根目录解析
- 跳过外部链接（http/https）和锚点链接（#）
- 关系类型默认 `references`

**directory-rule（0.50-0.70）：**
- 同目录下的文档：`references`（0.50）
- 父目录 index.md → 子目录文档：`contains`（0.70）
- 同一命名前缀的文档：`lifecycle_bound`（0.60）

### unified/remark 使用要点

- **纯 ESM**——import 时使用 ESM 语法
- gray-matter 解析 frontmatter（CJS 包，需 esModuleInterop）
- 管道是 **async**（P13：Scanner 引擎使用 async 模式）
- 文件读取使用 `node:fs/promises.readFile`

### 架构约束

- **P13**: Scanner 引擎使用 async 模式
- **P15**: 公共 API 必须有 JSDoc
- **P16**: 测试命名 describe > describe > it('should...')

### Project Structure Notes

- `src/scanner/pipeline.ts` — 管道编排
- `src/scanner/types.ts` — 扫描类型
- `src/scanner/plugins/extract-frontmatter.ts`
- `src/scanner/plugins/extract-links.ts`
- `src/scanner/plugins/extract-headings.ts`
- `src/scanner/rules/index.ts` — IScanRule + 注册
- `src/scanner/rules/frontmatter-rule.ts`
- `src/scanner/rules/markdown-link-rule.ts`
- `src/scanner/rules/directory-rule.ts`

### References

- [Source: architecture/core-architectural-decisions.md#D5] — scanner 目录结构
- [Source: architecture/implementation-patterns-consistency-rules.md#P13] — async 模式
- [Source: architecture/project-structure-boundaries.md] — scanner 模块布局
- [Source: prd.md#FR6, FR9-FR12] — 扫描和关系发现需求
- [Source: prd.md#NFR16] — 异常文档处理
- [Source: epics.md#Story 2.2] — 验收标准来源

## Dev Agent Record

### Agent Model Used

GPT-5.4

### Debug Log References

- `npm test -- tests/unit/scanner/pipeline.test.ts tests/unit/scanner/rules.test.ts`
- `npm run type-check`
- `npm run lint`
- `npm test`
- `npx vitest run tests/unit/scanner/pipeline.test.ts tests/unit/scanner/rules.test.ts --coverage '--coverage.include=src/scanner/pipeline.ts' '--coverage.include=src/scanner/plugins/*.ts' '--coverage.include=src/scanner/rules/*.ts'`

### Completion Notes List

- 已实现 `ScanPipeline`，串联 unified/remarkParse/remarkFrontmatter/remarkGfm 与三类提取插件，输出文档级 `ParsedDocument` 和规则发现关系。
- 已实现 `extract-frontmatter`、`extract-links`、`extract-headings` 三个 remark 插件，并为 malformed frontmatter 保留 warning、不阻断扫描。
- 已实现 `IScanRule`、`ScanRuleRegistry` 与默认规则注册，补齐 frontmatter-rule、markdown-link-rule、directory-rule 三种关系发现逻辑，满足文档级粒度与置信度要求。
- 已实现异常文档处理辅助：非 `.md`、大于 1MB 预检 warning，UTF-8 解码失败记录 warning 并跳过。
- 已新增 scanner 单测 15 条；最终回归结果为 `npm test` 226/226 通过，scanner 可执行逻辑覆盖率为 statements 98.52%、branches 91.26%、functions 100%、lines 98.51%。

### File List

- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/stories/2-2-scan-engine-core-pipeline-remark-ast-and-rules.md
- src/scanner/index.ts
- src/scanner/pipeline.ts
- src/scanner/plugins/extract-frontmatter.ts
- src/scanner/plugins/extract-headings.ts
- src/scanner/plugins/extract-links.ts
- src/scanner/rules/directory-rule.ts
- src/scanner/rules/frontmatter-rule.ts
- src/scanner/rules/index.ts
- src/scanner/rules/markdown-link-rule.ts
- src/scanner/types.ts
- tests/unit/scanner/pipeline.test.ts
- tests/unit/scanner/rules.test.ts

### Change Log

- 2026-05-07: 完成 Story 2.2 扫描引擎核心管道、规则引擎与测试，状态更新为 review。

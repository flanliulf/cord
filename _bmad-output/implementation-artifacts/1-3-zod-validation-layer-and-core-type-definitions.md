# Story 1.3: Zod 统一验证层与核心类型定义

Status: ready-for-dev

## Story

As a 开发者，
I want 统一的 Zod schema 验证层和全局类型定义，
So that CLI/MCP/Service 层可以共享同一套输入验证和类型系统。

## Acceptance Criteria (AC)

1. **Given** Story 1.2 的错误体系已就绪 **When** 定义关系类型 **Then** `src/types/relations.ts` 定义 9 种关系类型常量（RELATION_TYPES as const）和 RelationType 类型
2. **Given** 类型系统开始定义 **When** 定义文档类型 **Then** `src/types/documents.ts` 定义 DocumentNode 类型
3. **Given** 类型系统开始定义 **When** 定义图遍历类型 **Then** `src/types/graph.ts` 定义图遍历相关类型
4. **Given** 类型系统开始定义 **When** 定义配置类型 **Then** `src/types/config.ts` 定义配置相关类型
5. **Given** 类型定义就绪 **When** 创建 Zod schema **Then** `src/schemas/` 目录下提供 document、relation、config、scan-input、query-input、impact-input 的 Zod schema
6. **Given** Zod schema 已定义 **When** 验证失败 **Then** 抛出 CordError 子类（ConfigError 或对应子类）
7. **Given** Zod schema 已定义 **When** 导出 JSON Schema **Then** 所有 Zod schema 可通过 zod-to-json-schema 导出为 JSON Schema（为 MCP Tools 预备）
8. **Given** 所有 schema 和类型已定义 **When** 运行测试 **Then** 单元测试覆盖每个 schema 的有效/无效输入路径

## Tasks / Subtasks

- [ ] Task 1: 定义核心类型 (AC: #1, #2, #3, #4)
  - [ ] 1.1 `src/types/relations.ts` — RELATION_TYPES 常量和 RelationType 类型
  - [ ] 1.2 `src/types/documents.ts` — DocumentNode 接口
  - [ ] 1.3 `src/types/graph.ts` — GraphTraversalResult、RelationEdge 等
  - [ ] 1.4 `src/types/config.ts` — CordConfig 接口
  - [ ] 1.5 更新 `src/types/index.ts` 门面导出
- [ ] Task 2: 创建 Zod schema (AC: #5, #6)
  - [ ] 2.1 `src/schemas/document.ts` — documentSchema
  - [ ] 2.2 `src/schemas/relation.ts` — relationSchema
  - [ ] 2.3 `src/schemas/config.ts` — configSchema（cord.config 7 项配置）
  - [ ] 2.4 `src/schemas/scan-input.ts` — scanInputSchema
  - [ ] 2.5 `src/schemas/query-input.ts` — queryInputSchema
  - [ ] 2.6 `src/schemas/impact-input.ts` — impactInputSchema
  - [ ] 2.7 更新 `src/schemas/index.ts` 门面导出
  - [ ] 2.8 Zod 验证失败封装为 CordError（创建辅助函数 `validateWithCordError`）
- [ ] Task 3: JSON Schema 导出能力 (AC: #7)
  - [ ] 3.1 安装 `zod-to-json-schema` 依赖
  - [ ] 3.2 创建导出工具函数或脚本（为 MCP Tools inputSchema 预备）
- [ ] Task 4: 编写单元测试 (AC: #8)
  - [ ] 4.1 `tests/unit/schemas/` — 每个 schema 的有效/无效输入测试
  - [ ] 4.2 测试 Zod 验证失败时是否正确抛出 CordError
  - [ ] 4.3 测试 JSON Schema 导出是否正确

## Dev Notes

### 9 种关系类型定义（P9 规范）

```typescript
// src/types/relations.ts
export const RELATION_TYPES = {
  SYNC_REQUIRED: 'sync_required',
  CONTEXT_FOR: 'context_for',
  LIFECYCLE_BOUND: 'lifecycle_bound',
  CONTAINS: 'contains',
  MUST_CONSISTENT: 'must_consistent',
  SYNC_SUGGESTED: 'sync_suggested',
  DERIVED_FROM: 'derived_from',
  DEPRECATED: 'deprecated',
  REFERENCES: 'references',
} as const;

export type RelationType = typeof RELATION_TYPES[keyof typeof RELATION_TYPES];
```

### DocumentNode 类型

```typescript
// src/types/documents.ts
export interface DocumentNode {
  id: string;
  path: string;              // 相对于项目根目录的路径
  title?: string;            // 文档标题（从 frontmatter 或 heading 提取）
  docType?: string;          // 框架定义的文档类型（如 'prd'、'architecture'）
  framework?: string;        // 所属框架（'bmad'、'generic'）
  contentHash?: string;      // 内容哈希（用于增量扫描变更检测）
  metadata?: Record<string, unknown>;  // 扩展元数据
  createdAt: string;         // ISO 8601
  updatedAt: string;         // ISO 8601
}
```

### RelationEdge 类型

```typescript
// src/types/graph.ts
export interface RelationEdge {
  id: string;
  sourceDocId: string;
  targetDocId: string;
  relationType: RelationType;
  confidence: number;        // 0.0 - 1.0
  source: RelationSource;    // 'auto_scan' | 'manual' | 'framework_preset'
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type RelationSource = 'auto_scan' | 'manual' | 'framework_preset';

export interface GraphTraversalResult {
  startDocId: string;
  depth: number;
  relations: RelationEdge[];
  visitedDocIds: string[];
}
```

### CordConfig 类型

```typescript
// src/types/config.ts
export interface CordConfig {
  framework?: string;        // 检测到的开发框架
  ide?: string;              // 检测到的 IDE 类型
  scanPaths?: string[];      // 文档扫描路径
  excludePaths?: string[];   // 排除路径，默认 ["src/", "node_modules/", ".git/", "dist/"]
  confidenceThreshold?: number;  // 影响分析最低置信度阈值，默认 0.50
  relationTypes?: Record<string, unknown>;  // 自定义关系类型扩展
  adapters?: string[];       // 启用的框架适配模块
}
```

### Zod 验证失败封装

```typescript
// src/schemas/helpers.ts
import { ZodError, ZodSchema } from 'zod';
import { ConfigError } from '../utils/errors.js';

export function validateWithCordError<T>(
  schema: ZodSchema<T>,
  data: unknown,
  errorCode: string,
): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ConfigError({
        message: `验证失败: ${error.issues.map(i => i.message).join(', ')}`,
        code: errorCode,
        suggestion: '请检查输入数据是否符合预期格式',
        context: { issues: error.issues },
        cause: error,
      });
    }
    throw error;
  }
}
```

### Zod 版本注意

- 如果 Story 1.1 选择了 Zod v3.x：使用 `z.object()` / `z.string()` 等标准 API
- 如果选择了 Zod v4.x：注意 `.parse()` 行为变化，部分高级 API 有 breaking changes
- `zod-to-json-schema` 依赖需与 Zod 大版本匹配

### P11 Service 方法签名规范

所有 Zod schema 生成的类型将作为 Service 方法的输入类型。Service 方法签名规范：
- 输入：单一对象参数，类型由 Zod schema 推导（`z.infer<typeof xxxSchema>`）
- 输出：明确的 TypeScript 类型

### 架构约束提醒

- **P2**: Zod Schema 命名：camelCase + `Schema` 后缀（如 `documentSchema`、`configSchema`）
- **P6**: 通过 index.ts 门面导出
- **P8**: Service 层使用 camelCase TypeScript 接口
- **P9**: 关系类型值使用 snake_case
- **P15**: 所有公共 API 和类型必须有 JSDoc

### 依赖项（Story 1.1 应已安装）

- `zod` — 核心验证库
- `zod-to-json-schema` — JSON Schema 导出（需作为新依赖安装）

### Project Structure Notes

- `src/types/relations.ts` — 9 种关系类型常量
- `src/types/documents.ts` — DocumentNode 接口
- `src/types/graph.ts` — 图遍历相关类型
- `src/types/config.ts` — 配置类型
- `src/schemas/document.ts` — 文档 Zod schema
- `src/schemas/relation.ts` — 关系 Zod schema
- `src/schemas/config.ts` — 配置 Zod schema
- `src/schemas/scan-input.ts` — 扫描输入 schema
- `src/schemas/query-input.ts` — 查询输入 schema
- `src/schemas/impact-input.ts` — 影响分析输入 schema
- `src/schemas/helpers.ts` — 验证辅助函数
- `src/schemas/index.ts` — 门面导出
- `src/types/index.ts` — 门面导出

### References

- [Source: architecture/core-architectural-decisions.md#D1] — Zod 数据验证策略
- [Source: architecture/implementation-patterns-consistency-rules.md#P2] — Zod Schema 命名约定
- [Source: architecture/implementation-patterns-consistency-rules.md#P8] — 内部数据传递格式
- [Source: architecture/implementation-patterns-consistency-rules.md#P9] — 关系类型值格式
- [Source: architecture/implementation-patterns-consistency-rules.md#P11] — Service 方法签名规范
- [Source: prd.md#FR10] — 9 种传播行为类型
- [Source: prd.md#FR11] — 置信度分数定义
- [Source: prd.md#cord.config] — 配置 schema 概览
- [Source: epics.md#Story 1.3] — 验收标准来源

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

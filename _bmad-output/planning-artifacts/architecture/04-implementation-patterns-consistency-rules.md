# Implementation Patterns & Consistency Rules

## Pattern Categories Defined

**Critical Conflict Points Identified:** 5 大类 16 个冲突点，确保多个 AI Agent 写出兼容一致的代码。

## Naming Patterns

**P1. 数据库命名约定：**

| 维度 | 规则 | 示例 |
|------|------|------|
| 表名 | snake_case 复数 | `documents`、`relations`、`sync_states` |
| 列名 | snake_case | `doc_id`、`source_path`、`relation_type`、`created_at` |
| 外键 | `{referenced_table}_id` | `source_doc_id`、`target_doc_id` |
| 索引 | `idx_{table}_{columns}` | `idx_relations_source_doc_id`、`idx_documents_path` |
| 主键 | `id`（每表统一） | `documents.id`、`relations.id` |

**P2. 代码命名约定：**

| 维度 | 规则 | 示例 |
|------|------|------|
| 文件名 | kebab-case | `scan-service.ts`、`sqlite-graph-repository.ts`、`errors.ts` |
| 类名 | PascalCase | `ScanService`、`SqliteGraphRepository`、`CordError` |
| 函数/方法 | camelCase | `analyzeImpact()`、`queryRelations()`、`getDocumentById()` |
| 变量 | camelCase | `docPath`、`relationType`、`scanResult` |
| 常量 | SCREAMING_SNAKE_CASE | `RELATION_TYPES`、`MAX_TRAVERSAL_DEPTH`、`DEFAULT_CONFIDENCE` |
| 接口 | `I` 前缀 + PascalCase | `IGraphRepository`、`IFrameworkAdapter`、`IScanRule` |
| 类型 | PascalCase（无前缀） | `RelationType`、`DocumentNode`、`ScanResult` |
| Enum 值 | snake_case | `RelationType.sync_required`、`RelationType.context_for` |
| Zod Schema | camelCase + `Schema` 后缀 | `documentSchema`、`relationSchema`、`configSchema` |

**P3. CLI 命令命名约定：**

| 维度 | 规则 | 示例 |
|------|------|------|
| 命令名 | kebab-case 单词 | `cord init`、`cord scan`、`cord query`、`cord impact` |
| 选项长名 | `--kebab-case` | `--output-format`、`--relation-type`、`--max-depth` |
| 选项短名 | 单字母 `-x` | `-f`（format）、`-t`（type）、`-d`（depth） |

**P4. MCP Tool 命名约定：**

| 维度 | 规则 | 示例 |
|------|------|------|
| Tool 名 | snake_case（意图驱动） | `analyze_impact`、`query_relations`、`sync_docs`、`init_graph` |
| 参数名 | camelCase | `docPath`、`relationType`、`maxDepth` |

## Structure Patterns

**P5. 测试文件组织：独立 `tests/` 目录**

测试文件统一存放在项目根目录的 `tests/` 下，镜像 `src/` 目录结构：

```
tests/
├── unit/
│   ├── services/
│   │   ├── scan-service.test.ts
│   │   ├── query-service.test.ts
│   │   └── impact-service.test.ts
│   ├── repositories/
│   │   └── graph-repository.test.ts
│   ├── scanner/
│   │   ├── pipeline.test.ts
│   │   └── rules/
│   ├── adapters/
│   │   └── framework/
│   │       └── bmad/
│   └── utils/
│       ├── errors.test.ts
│       └── logger.test.ts
├── integration/
│   ├── cli/
│   │   └── init-command.test.ts
│   ├── mcp/
│   │   └── tools.test.ts
│   └── scan-to-query-flow.test.ts
└── fixtures/
    ├── sample-project/       # 模拟项目目录结构
    ├── documents/            # 测试用 Markdown 文档
    └── configs/              # 测试用配置文件
```

- 单元测试：`tests/unit/` 镜像 `src/` 结构
- 集成测试：`tests/integration/` 按场景组织
- 测试数据：`tests/fixtures/` 统一存放
- 测试文件命名：`{source}.test.ts`

**P6. 模块导出模式：**

每个架构层有一个 `index.ts` 作为公共 API 门面：

```typescript
// src/services/index.ts — Service 层公共 API
export { ScanService } from './scan-service.js';
export { QueryService } from './query-service.js';
export { ImpactService } from './impact-service.js';
```

跨层引用**必须通过 index.ts**，禁止直接引用内部文件。

**P7. 依赖注入模式：**

Service 层通过构造函数注入 Repository：

```typescript
// ✅ 正确：构造函数注入
class ScanService {
  constructor(private readonly repo: IGraphRepository) {}
}

// ❌ 错误：直接 import 具体实现
import { SqliteGraphRepository } from '../repositories/sqlite-graph-repository.js';
```

## Format Patterns

**P8. 内部数据传递格式：**

| 维度 | 规则 | 说明 |
|------|------|------|
| Service 返回值 | camelCase TypeScript 接口 | `{ docId, sourcePath, relationType }` |
| DB ↔ Repository | snake_case（与 DB 列名一致） | `{ doc_id, source_path, relation_type }` |
| 转换边界 | Repository 层负责 snake ↔ camelCase | 映射逻辑集中在 Repository 层 |

**P9. 关系类型值格式：**

```typescript
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
```

**P10. JSON 快照导出格式：**

```json
{
  "schemaVersion": "1.0",
  "exportedAt": "2026-04-07T10:00:00Z",
  "project": "cord-project-name",
  "documents": [],
  "relations": []
}
```

- 所有日期时间：ISO 8601 字符串
- JSON 字段：camelCase
- null 值：保留（不省略键）

## Communication & Process Patterns

**P11. Service 方法签名规范：**

```typescript
// ✅ 正确：输入用 Zod schema 类型，输出用明确的返回类型
async scanDocuments(input: ScanInput): Promise<ScanResult>

// ❌ 错误：散装参数
async scanDocuments(path: string, incremental: boolean, framework?: string): Promise<any>
```

所有 Service 方法：
- 输入：单一对象参数，类型由 Zod schema 推导
- 输出：明确的 TypeScript 类型（`Promise<T>` 或同步 `T`）
- 不抛非 `CordError` 的异常

**P12. 错误处理流程：**

```
Service 层 → throw CordError 子类（携带 code + suggestion）
    ↓
CLI 入口 → catch → chalk 格式化输出 → process.exit(1)
MCP 入口 → catch → 转换为 MCP 标准错误响应
```

**绝不：**
- Service 层直接 `console.log` 或 `process.exit`
- MCP 层直接输出到 stdout（stdout 是 JSON-RPC 通道）
- 吞掉异常不处理

**P13. 异步 vs 同步模式：**

| 层 | 模式 | 理由 |
|---|------|------|
| Repository 层 | **同步** | better-sqlite3 是同步 API |
| Service 层 | **同步为主**（文件 I/O 用 async） | 数据库操作同步，文件读写可能需要 async |
| Scanner 引擎 | **async** | unified/remark 处理管道是异步的 |
| CLI 入口 | **async** | Commander action 支持 async，可调用任何 Service |
| MCP 入口 | **async** | MCP SDK handler 是 async |

## Quality Patterns

**P14. 导入排序：**

```typescript
// 1. Node.js 内置模块
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// 2. 第三方依赖
import { z } from 'zod';
import { Command } from 'commander';

// 3. 内部模块（按层级从外到内）
import { ScanService } from '../services/index.js';
import { CordError } from '../utils/errors.js';

// 4. 同级模块
import { formatOutput } from './helpers.js';
```

**P15. 注释规范：**

```typescript
// ✅ 公共 API 必须有 JSDoc
/**
 * 分析文档变更的影响范围
 * @param input - 影响分析输入参数
 * @returns 受影响文档列表及建议动作
 * @throws {QueryError} 当文档不存在时
 */
async analyzeImpact(input: ImpactInput): Promise<ImpactResult> { ... }

// ✅ 复杂逻辑用行内注释解释 WHY，不解释 WHAT
// 使用 BFS 而非 DFS，因为影响分析需要按距离排序结果
const affected = this.bfsTraverse(docId, maxDepth);

// ❌ 错误：解释显而易见的代码
// 获取文档 ID
const docId = input.docId;
```

**P16. 测试命名规范：**

```typescript
describe('ScanService', () => {
  describe('scanDocuments', () => {
    it('should discover frontmatter references as relations', () => { ... });
    it('should skip unparseable documents and log warning', () => { ... });
    it('should throw ScanError when project root is invalid', () => { ... });
  });
});
```

- describe: 类名 → 方法名
- it: `should + 行为描述`
- 测试文件名：`{source}.test.ts`

## Enforcement Guidelines

**所有 AI Agent 必须遵守：**

1. **跨层引用必须通过 index.ts 门面**，禁止直接 import 内部文件
2. **Service 层禁止直接引用具体 Repository 实现**，只依赖 `IGraphRepository` 接口
3. **CLI/MCP 入口层是薄壳**，只负责参数解析 → 调用 Service → 格式化输出，不含业务逻辑
4. **所有用户输入必须经过 Zod schema 验证**，在进入 Service 层之前
5. **所有错误必须是 CordError 子类**，携带 `code` 和 `suggestion`
6. **MCP Server 的 stdout 只用于 JSON-RPC**，所有日志/调试信息走 stderr
7. **数据库列名用 snake_case，TypeScript 代码用 camelCase**，Repository 层负责转换
8. **新增功能必须附带测试**，覆盖正常路径 + 至少一个异常路径

**Anti-Patterns（禁止事项）：**

```typescript
// ❌ Service 层直接操作终端
console.log('Scanning...');  // 禁止
process.exit(1);             // 禁止

// ❌ 跨层直接引用内部文件
import { scanDocumentsImpl } from '../services/scan-service.js';  // 禁止，应通过 index.ts

// ❌ Repository 返回 camelCase 或 Service 返回 snake_case
return { source_path: '...' };  // Repository 层：✅ 正确
return { source_path: '...' };  // Service 层：❌ 错误，应已转换为 sourcePath

// ❌ 散装参数代替输入对象
async queryRelations(docPath: string, type?: string, depth?: number)  // 禁止

// ❌ 吞掉异常
try { ... } catch (e) { /* 静默忽略 */ }  // 禁止
```

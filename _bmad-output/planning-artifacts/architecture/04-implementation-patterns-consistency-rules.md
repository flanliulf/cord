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
| 类型常量值 | snake_case 字符串字面量 | `'sync_required'`、`'context_for'`（`RELATION_TYPES as const` 推导的字符串联合类型） |
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
│   └── flows/
└── fixtures/
    ├── sample-projects/      # 模拟项目目录结构（bmad-project/、generic-project/、empty-project/）
    ├── documents/            # 测试用 Markdown 文档
    └── configs/              # 测试用配置文件
```

- 单元测试：`tests/unit/` 镜像 `src/` 结构
- 集成测试：`tests/integration/` 按场景组织
- 测试数据：`tests/fixtures/` 统一存放
- 测试文件命名：`{source}.test.ts`

**P41. 测试 helper 的时间/序列数据必须用数值偏移生成，并覆盖跨位数边界（CR-TEST-01）：**

适用范围：fixture factory、in-memory repository、fake clock、递增 ID helper 等测试基础设施。

- 当 helper 需要生成时间戳、递增序列或其他单调数据时，必须使用“固定基准值 + 数值偏移”模式；**禁止**依赖字符串拼接日期、编号或其他随位数变化的文本格式
- 只要 helper 逻辑依赖计数器增长，回归测试至少覆盖一条跨位数边界（如 9→10、99→100），确保 fixture 不会在边界值先于业务断言失效
- 若业务本身要求格式化字符串输出，应把“数值推进”和“字符串展示”分层，测试 helper 只负责生成稳定源数据

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

Impact propagation 必须通过 `src/types/relations.ts` 的显式矩阵建模。v0.1 所有内置 relationType 均按 `source -> target` 传播，且仅 `status='active'` 可传播；`derived_from` 表示目标文档从源文档派生，`contains` 表示源文档逻辑包含目标文档，二者均不反向传播。`status='deprecated'` 是状态位，不得通过改写 `relationType` 表达关系下线。

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
- `DocumentNode.createdAt` / `updatedAt` 必须通过 ISO 8601 datetime 校验
- `DocumentNode.path` 必须是 normalized project-relative POSIX path；禁止绝对路径、Win32/UNC 路径、反斜杠与 `..` 逃逸
- `ScanInput.projectRoot` 必须是跨平台绝对路径，允许 POSIX / Win32 absolute 形式
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

Repository mapper 遇到 metadata JSON 损坏或枚举越界时必须抛 `StorageError`，并携带稳定 `code`、`suggestion` 与 `table/id/column` 等结构化 context；禁止继续抛普通 `Error` 让上层依赖字符串匹配。

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

**P17. CordConfig 配置字段重要规则：**

cord.config.yaml / cord.config.json 共 9 个项（均可选）：

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| projectName | string | 无 | 项目显示名，供导出快照等面向用户的输出优先使用，缺失时由调用方回退到项目根目录名 |
| framework | string | 自动检测 | 框架类型 |
| ide | string | 自动检测 | IDE 类型 |
| scanPaths | string[] | adapter 预设 | 扫描路径 |
| excludePaths | string[] | `["src/","node_modules/",".git/","dist/"]` | 排除路径 |
| confidenceThreshold | number | 0.50 | 影响分析最低置信度阈值 |
| relationTypes | Record<RelationType, {enabled: boolean}> | 全部启用 | 9 个内置类型启用/禁用 |
| adapters | string[] | [] | 启用的框架适配模块 |
| updateStrategies | Record<docType, UpdateStrategy> | `{}` | Story 4.3 引入，键允许任意 docType 字符串；字段可省略，未配置的 docType 回退到 `suggest` |

- 若用户可见输出字段需要引入新的配置来源（例如快照 `project` 字段依赖 `projectName`），必须先完成产品/架构裁决并将字段纳入 schema，再进入实现和测试；禁止使用临时 fallback 逻辑绕过未裁决契约

```typescript
type UpdateStrategy = 'auto' | 'suggest' | 'log_only';
// 'auto': 自动更新  'suggest': 生成建议后人工确认  'log_only': 仅记录不触发
// 允许自定义 docType key；目标 docType 未配置或未命中时回退到 suggest
```

`cord init` 生成的配置模板必须包含如下示例块：

```yaml
updateStrategies:
  prd: auto
  story: suggest
  technical-research: log_only
```

## Repository 层开发规则（来源：Story 1-4、2-5 CR 历史）

**P24. update 方法禁止接受不可变字段（CR-REPO-01）：**

所有 Repository `update*` 方法签名必须使用 `Omit<Partial<EntityType>, 'id' | 'createdAt' | 'updatedAt'>`，排除不可变字段；实现层解构丢弃不可变字段，显式透传 `existing.createdAt`。

```typescript
// ✅ 正确：收窄类型，禁止传入不可变字段
updateDocument(
  id: string,
  updates: Omit<Partial<DocumentNode>, 'id' | 'createdAt' | 'updatedAt'>
): DocumentNode {
  const existing = this.getDocumentById(id)!;
  const { id: _id, createdAt: _ca, updatedAt: _ua, ...safeUpdates } = updates as DocumentNode;
  void _id; void _ca; void _ua;
  const merged = { ...existing, ...safeUpdates, id, createdAt: existing.createdAt, updatedAt: new Date().toISOString() };
  // ... SQL UPDATE ...
  return merged;
}

// ❌ 禁止：允许传入 createdAt，内存/DB 状态漂移
updateDocument(id: string, updates: Partial<DocumentNode>): DocumentNode
```

**根因**：`Partial<EntityType>` 包含 `createdAt` 等不可变字段，调用方传入后会被 spread 进返回对象，而 SQL UPDATE 不含 `created_at` 列，导致内存态与 DB 持久态不一致，污染上层缓存和日志。

**P25. Mapper 层必须对 DB 值做运行时防御校验（CR-REPO-02）：**

DB 数据可能被外部工具直接篡改或含有历史脏数据，不能假设其合法性。

- **JSON 字段**：必须用 `try/catch` 包裹，失败时抛出含 `{ cause }` 的上下文错误（`{ table, id, column }`）
- **枚举字段**：必须通过白名单常量校验（`assertEnum<T>`），禁止裸 `as EnumType` 断言
- **DB `CHECK` 约束**：必须与 TS 枚举白名单保持对称，两处必须同步更新

```typescript
// ✅ 正确：带上下文的防御校验辅助函数
function parseJsonMetadata(
  raw: string | null,
  context: { table: string; id: string; column: string }
): Record<string, unknown> | undefined {
  if (raw == null) return undefined;
  try { return JSON.parse(raw) as Record<string, unknown>; }
  catch (err) { throw new Error(`[mappers] Failed to parse JSON in ${context.table}.${context.column} for id="${context.id}"`, { cause: err }); }
}

function assertEnum<T extends string>(value: string, valid: Set<string>, context: string): T {
  if (!valid.has(value)) throw new Error(`[mappers] Invalid value "${value}" for ${context}. Allowed: [${[...valid].join(', ')}]`);
  return value as T;
}

// ❌ 禁止：裸断言，脏数据让整个 getAllDocuments() 崩溃
return { relationType: row.relation_type as RelationType, ... };
```

**P26. 构建产物中的静态资源必须内联为 TS 模块（CR-REPO-03）：**

tsup 打包产物（`dist/`）中只包含编译后的 JS/TS 文件，`.sql`、`.json` 等资源文件不会被复制。

- **迁移 SQL**：必须以 TS 模块字符串常量内联，由编译器在构建时绑定，彻底规避运行时路径漂移
- **其他静态资源**（`.json` 模板等）同理，内联为 TS 常量或在构建流程中显式配置复制

```typescript
// ✅ 正确：内联为 TS 模块常量（src/repositories/migrations/001-initial-schema.ts）
export const MIGRATION_001_SQL = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version     INTEGER PRIMARY KEY,
    applied_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  -- ...
`;

// ✅ 正确：runner.ts 从 TS 模块导入
import { MIGRATION_001_SQL } from './001-initial-schema.js';

// ❌ 禁止：运行时文件系统读取，dist/ 中不存在该文件
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const sql = readFileSync(join(fileURLToPath(import.meta.url), '..', '001.sql'), 'utf-8');
```

**P27. 唯一索引维度必须与接口 source 语义契约对齐（CR-REPO-04）：**

当 Repository 接口暴露了「按 source 区分保留/删除」能力（如 `deleteRelationsByDocId(id, { excludeSources })`），唯一索引必须包含 `source` 维度，否则「不同 source 的同类型关系并存」语义无法落地。

```sql
-- ✅ 正确：含 source 维度，允许 manual + auto_scan 在同一对节点间并存
CREATE UNIQUE INDEX IF NOT EXISTS idx_relations_unique_pair
  ON relations(source_doc_id, target_doc_id, relation_type, source);

-- ❌ 禁止：缺少 source，插入 manual 时会触发 UNIQUE constraint failed
CREATE UNIQUE INDEX idx_relations_unique_pair
  ON relations(source_doc_id, target_doc_id, relation_type);
```

**P30. 批量写入事务必须先收敛可持久化 workset（CR-REPO-05）：**

涉及 documents / relations / sync_states 的多阶段批量写入时，必须先在事务外过滤不可持久化项，并记录 warning；事务内只执行已经验证过的完整写入计划。

- **禁止**在 transaction callback 中用普通 `return` 表达“跳过当前项”
- 若事务内发现端点映射或写入计划失配，必须 `throw` 触发回滚
- 对外返回的统计字段（如 discovered / written counts）必须与过滤后的实际写入策略一致

```typescript
// ✅ 正确：事务外先收敛 workset，事务内只执行完整计划
const persistableRelations = collectPersistableRelations(relations, documentMap, warnings);

repository.transaction(() => {
  for (const relation of persistableRelations) {
    const sourceDoc = persistedDocuments.get(relation.sourceDoc);
    const targetDoc = persistedDocuments.get(relation.targetDoc);
    if (!sourceDoc || !targetDoc) {
      throw new ScanError('Persistable relation endpoints are missing');
    }
    repository.addRelation({ ...relation, sourceDocId: sourceDoc.id, targetDocId: targetDoc.id });
  }
});

// ❌ 禁止：在事务回调内 return，会把“跳过当前项”变成“提前正常提交”
repository.transaction(() => {
  for (const relation of relations) {
    if (!sourceDoc || !targetDoc) {
      return;
    }
  }
});
```

**P40. 迁移子步骤必须独立幂等，并覆盖部分迁移数据库场景（CR-REPO-06）：**

适用范围：所有会同时触达列新增、索引创建、数据回填等多个 schema 工件的 migration。

- 列新增、索引创建、数据回填等子步骤必须分别保持幂等；**禁止**因某个工件已存在就提前返回，导致其他仍可能缺失的工件无法补建
- 迁移回归测试除标准旧库升级外，还必须覆盖“部分迁移数据库”场景，例如列已存在但索引缺失，确保应用启动后可自愈到完整目标 schema
- 若某步天然不可重入，必须显式用 schema 探测或 `IF NOT EXISTS` 语义把风险隔离到该步，而不是整条 migration 直接短路
- v0.1 pre-release 阶段允许直接重写 baseline migration；为兼容早期旧 v1 baseline，已通过 `003-fix-v1-baseline` 补齐约束/索引自愈迁移；首个稳定 release 后切换为只增不改的增量迁移模式

## Scanner / 增量扫描规则（来源：Story 2-6 CR 历史）

**P31. 生命周期重绑定必须使用双向唯一最优匹配，歧义时降级为 delete + add（CR-SCAN-01）：**

当增量扫描基于 `contentHash`、路径、basename 等弱身份信号推断 rename / move 时，正确性优先于“稳定但任意”的配对结果。

- **禁止**依赖数组顺序、FIFO `shift()`、字典序 tiebreaker 等非语义排序，直接决定既有 `docId` 与新路径绑定关系
- 只有 stored 侧与 current 侧都选出**唯一最优**候选时，才允许输出 rename / move
- 评分信号可以包含同目录、同 basename、basename 编辑距离、路径距离等；但若第一名与第二名仍并列，则必须视为歧义
- 歧义场景必须保守降级为 delete + add，避免把错误 `docId` 绑定到错误路径
- 测试必须同时覆盖：
  - 可稳定消歧的多候选同 hash 场景
  - 无法唯一判断时的 delete + add 降级场景

**P42. 人工修正必须落成扫描保护可识别的持久化信号（CR-SCAN-02）：**

适用范围：`RelationService`、`ScanService`、增量扫描/重建的数据保护逻辑、人工修正相关 API。

- 当业务要求“人工修正优先于自动扫描”时，必须把人工语义写成跨流程可复用的持久化信号（如 `source='manual'` 或等价标记）；**禁止**只在调用约定、临时内存态或局部 metadata 分支里隐含表达
- 删边保护、写回冲突处理、rebuild 警告等路径必须消费同一套人工修正判定标准，避免一处按 `source`、另一处按临时状态，导致收敛保护语义漂移
- 测试必须覆盖真实 service mutation 路径：先由扫描生成自动关系，再调用手动修正 API，再执行增量扫描/重建，断言人工修正仍被保留

**P43. 批内候选裁剪必须先比较来源优先级，再比较置信度（CR-SCAN-03）：**

适用范围：所有进入持久化前的关系 dedupe / merge / 候选裁剪逻辑。

- 对同一业务键的候选关系，必须先比较业务来源优先级（如 `manual > framework_preset > auto_scan`），仅在同来源内再比较 `confidence` 或其他次级启发式
- **禁止**让前置裁剪与最终持久化使用两套不同的优先级规则；若最终写入依赖 `getRelationSourcePriority()`，前置 dedupe 必须复用同一函数或等价实现
- 同批次冲突测试必须覆盖“低优先级候选 `confidence` 更高”的逆向场景，确保业务优先级不会在进入最终写入逻辑前被提前截断

**P44. MCP Tool I/O 契约必须镜像 CLI JSON DTO，不得为 MCP 侧重新裁剪字段（CR-MCP-01）：**

- `src/mcp/tools/schemas.ts` 中的命名 Zod input/output schema 是 CLI `--json`、MCP Tool 与后续新增 Tool 的共享契约源
- **禁止**为了“更像 Tool”而删减现有 Service / CLI DTO 字段；若 CLI JSON 已对外暴露字段，MCP output schema 必须保持同名同层级
- `query_relations` 必须保留 `depth` 输入以及 `relationId`、`hopDistance` 输出，保证 FR14 / FR16 与后续关系管理句柄闭环不漂移
- `analyze_impact` 必须保留 `severity` 与 `hopDistance`，不得退化为只剩建议文本
- `init_graph` 必须直接镜像 `ScanResult` 字段名，包含 `durationMs`；禁止另起 `duration` 等别名
- `sync_docs.reason` 直接复用 `AnalyzeImpactResult.suggestedAction`，`action` 仅由 `updateStrategy` 推导，避免平行定义第二套建议语义
- 相关测试至少覆盖：MCP output 与 CLI JSON 的字段同构检查、schema 冻结检查、以及新增 Tool 时已有 4 个 Tool schema 不变

## CLI 入口规则（来源：Story 1-2、2-5 CR 历史）

**P19. ESM CLI entrypoint 守卫三步归一化（CR-CLI-01）：**

⚠️ 禁止使用以下写法作为 entrypoint 守卫：
- `` `file://${process.argv[1]}` ``（字符串拼接，空格路径失效）
- `pathToFileURL(process.argv[1]).href`（无判空，`argv[1]` 缺失时崩溃）

✅ 必须使用三步归一化写法：

```ts
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Step 1: 判空 — argv[1] 缺失时（stdin/--eval/--input-type=module）静默跳过
const entryArg = process.argv[1];
if (entryArg) {
  let entryUrl: string;
  try {
    // Step 2: realpathSync 解析 symlink 真实路径（与 import.meta.url 对齐）
    // Step 3: pathToFileURL 处理 RFC 3986 百分号编码（空格 → %20）
    entryUrl = pathToFileURL(realpathSync(entryArg)).href;
  } catch {
    entryUrl = pathToFileURL(entryArg).href; // 兜底：realpathSync 失败时回退
  }
  if (import.meta.url === entryUrl) {
    runCli();
  }
}
```

**根因**：`import.meta.url` 始终是 Node.js 解析后的真实文件 file URL（含 RFC 3986 编码）；`process.argv[1]` 可能是 symlink 路径且未编码。两侧不做归一化在特殊路径（含空格、symlink）下必然静默失效（exitcode=0，无输出）。

**P20. CLI 入口文件副作用隔离（CR-CLI-02）：**

- `src/cli/index.ts` 等 CLI 入口文件**禁止**在模块顶层执行 `program.parse()` 或任何会调用 `process.exit()` 的代码
- 所有 CLI 执行逻辑必须封装在函数中，并由 entrypoint 守卫（P19）保护
- 无副作用的 CLI helper（如 `applyVerboseFlag`）必须提取到独立模块（如 `src/cli/verbose.ts`），测试直接导入 helper，不导入 CLI 入口
- 若 Commander 树中存在任何 `async` action，`runCli()` 必须返回 `Promise<void>` 并使用 `await program.parseAsync(process.argv)`；entrypoint 守卫使用 `void runCli().catch(reportUnhandledCliError)` 或等效方式兜底异步失败（CR-CLI-04）
- 真实 CLI 入口是退出码契约与异步完成语义的最终 owner；入口级回归测试必须直接覆盖成功路径、Commander parse error、业务 `ConfigError` 与 runtime error（CR-CLI-04）

```ts
// ✅ 正确结构：
export function createProgram(): Command { ... }
export async function runCli(program = createProgram()): Promise<void> {
  await program.parseAsync(process.argv);
}
// entrypoint 守卫（P19 三步写法）
const entryArg = process.argv[1];
// ...
if (import.meta.url === entryUrl) {
  void runCli().catch(reportUnhandledCliError);
}

// ❌ 禁止：顶层直接执行
const program = new Command();
program.parse(process.argv);  // 任何导入都会触发，破坏可测试性
```

**P21. Commander.js `preAction` 钩子使用约束（CR-CLI-03）：**

- 禁止在**没有任何 `.action()` 或 subcommand action 注册**的情况下，依赖 `preAction` 处理全局选项（如 `--verbose`）
- `preAction` 只在 Commander 执行某个 action handler 之前触发；无 action 时该钩子永不触发
- 替代方案：在 `program.parse()` 之后同步读取 `program.opts()` 处理全局选项；或在引入首条 subcommand 时改用 `program.hook('preAction', ...)`

**P32. CLI 必须在副作用前完成输入校验与路径归一化（CR-QUERY-01）：**

- 适用范围：任何 command factory 中会创建默认 Service、Repository、数据库目录或其他文件系统副作用的 CLI 命令
- 必须遵守顺序：`normalize input -> validate schema -> create service -> execute business logic`
- **禁止**先调用 `serviceFactory()`，再把原始输入交给 Service 内部校验；否则纯输入错误会先触发目录创建、数据库连接或迁移副作用
- 回归测试至少覆盖：无效枚举/缺失必填字段时，`serviceFactory` 不被调用，且返回稳定 `ConfigError`

```ts
// ✅ 正确：先归一化与校验，再创建默认 service
const validatedInput = validateQueryInput({
  docPath: normalizeQueryDocPath(projectRoot, docPath),
  type: options.type,
});
const service = serviceFactory(projectRoot);
return service.query(validatedInput);

// ❌ 禁止：先创建 service，再依赖 Service 内部抛校验错误
const service = serviceFactory(projectRoot);
return service.query({ docPath, type: options.type });
```

**P33. project-root 相对路径契约必须同时定义归一化与拒绝规则（CR-QUERY-02）：**

- 当 Repository / Service 的查询契约以 project-relative path 为准时，CLI 层必须先把 `./docs/a.md`、绝对路径等输入归一化为 project-relative POSIX path
- 对原始路径文本必须先做 `trim()` 等标准化，再执行 `resolve()` / `relative()`；禁止先做 project-root 边界判断，再依赖 schema 或 Service 隐式清理空白
- 若归一化结果为 `''`、`'..'` 或以 `'../'` 开头，必须在入口层抛出 `ConfigError`，并且发生在 `serviceFactory()` 调用前
- 跨平台回归必须覆盖 win32 语义：至少包含跨盘符路径（如 `D:\outside.json`）与 UNC 路径（如 `\\server\share\outside.json`）；若 `relative(projectRoot, input)` 结果仍为绝对路径，必须视为 project-root 外路径并在 `serviceFactory()` 前拒绝
- **禁止**把项目根外路径以 `'../...'` 形式继续传给 Service，再退化为普通“文档不存在”错误
- 回归测试至少覆盖：`./` 命中同一文档、项目外相对路径被拒绝、项目外绝对路径被拒绝、带前后空白的项目外相对/绝对路径被拒绝

**P34. 默认 Service 必须转发生命周期方法到持久化资源（CR-QUERY-03）：**

- 若默认 Service 内部持有实现了 `close()` 的 Repository、数据库连接或其他持久化资源，Service 必须显式暴露并转发 `close()`
- **禁止**仅在 CLI 层写 `service?.close?.()`，却让默认 Service 本身不实现 `close()`，导致 finally 对默认实现无效
- 优先与同层现有 Service 生命周期模式保持一致，例如 `ScanService.close() -> repository.close()`
- 回归测试至少覆盖：Service 层 `close()` 转发、CLI 成功路径调用 `close()`、CLI 失败路径调用 `close()`

**P35. CLI 与 Service 测试必须按层保护契约，避免重复端到端覆盖（CR-QUERY-04）：**

- Service 层负责测试业务语义、过滤规则、错误码、suggestion 与异常分支
- CLI 层负责测试参数转发、退出码、stdout/stderr 文本格式、JSON 序列化
- 若 CLI 已验证 flag 正确转发，且 Service 层已验证过滤语义，则可豁免重复的 CLI 端到端语义输出测试；此类豁免必须以现有 Service 测试覆盖为前提
- 新增错误路径时，至少在对应层补一条契约测试，保护 `CordError.code`、`suggestion` 或 JSON 错误载荷

## 只读命令 / 健康检查规则（来源：Story 3-5 CR 历史 + TODO-028 治理）

**CR-STATUS-01：声明为观测型的 status / health 命令不得因读取而初始化存储**

- 适用范围：`status`、`query`、`impact`、`export`、health check、diagnostic summary 等只读/观测命令
- 若持久化存储不存在，必须返回“未初始化”或空状态；禁止为读取创建 `.cord`、数据库文件或隐式执行迁移；`query` / `impact` / `export` 默认 CLI 路径必须先检查 `.cord/cord.db` 是否存在，再创建 repository
- 若命令语义需要区分“未初始化”和“已初始化但空图谱”，必须在结果字段或文本输出中显式保留该边界
- 回归测试至少覆盖：未初始化项目执行只读命令后不创建 `.cord/cord.db`，且返回稳定状态载荷
- 输入错误和配置错误必须在默认 service / repository 初始化前完成校验；`export` 的 `projectName` 配置错误不得先读取 repository 或创建 `.cord`

**CR-STATUS-02：健康检查统计必须来自同一持久化快照**

- 文档数、关系数、按类型分布、过时关系、孤立节点、悬空边、迁移版本等对外展示字段，必须由单次 `repository.transaction(() => ...)` 或等价 snapshot 一致派生
- `StatusService` 是持久化图谱库存与健康快照，`relationCount`、`relationsByType`、`staleRelations`、`orphanedNodes`、`danglingEdges` 均使用 active + deprecated 全量关系口径；`status='deprecated'` 是状态位，不重写 `relationType`
- 禁止用前序数组读取计算派生指标，再用后续独立 count 查询回填总数，形成混合口径
- 图健康判断中，只有双端都存在的关系才能证明节点 connected；dangling relation 只能计入异常指标，不能降低 `orphanedNodes`
- 回归测试至少覆盖：fake repository 在二次 count 查询时返回不同口径时，status 输出仍来自同一快照；文档唯一关系为 dangling 时仍计入 `orphanedNodes`

**CR-STATUS-03：资源清理失败不得覆盖 status 主结果**

- 任何 `finally` 中的 `close()` / `dispose()` / `release()` 都属于 best-effort cleanup；清理失败不得覆盖已经写出的成功输出、原始错误 payload 或 exit code
- 若需要上报 cleanup failure，只能作为附加诊断信息，不能替换主流程错误
- 回归测试至少覆盖：成功路径 cleanup 抛错仍保持 exitCode 0 和原输出；失败路径 cleanup 抛错仍保留原始业务错误

**P36. 图遍历必须分离“可扩展边”和“可输出边”（CR-QUERY-05）：**

- 适用范围：所有基于关系图的 BFS / DFS 查询
- `type`、标签或展示过滤等结果语义只控制是否写入输出，不默认裁剪 traversal；除非需求明确要求“过滤即截断路径”
- 可扩展边应由 `includeDeprecated`、方向、深度、状态等路径语义决定，而不是由最终输出过滤直接决定
- 测试必须覆盖：`depth + type` 查询经非匹配中间边仍可抵达深层匹配关系

**P37. 既不输出也不扩展的非匹配边，必须在端点解析前跳过（CR-QUERY-06）：**

- 在循环中先计算 `hopDistance`、`shouldOutput`、`shouldExpand`
- 当 `!shouldOutput && !shouldExpand` 时，直接跳过该边；禁止先 `resolveRelatedDocument(...)` 再因为过滤条件丢弃结果
- 这样可以避免无关坏边触发缺失端点错误，阻断本应成功的过滤查询
- 测试必须覆盖：匹配有效边与非匹配缺失端点边并存时，过滤查询返回匹配结果而不是抛错

**P38. 性能验收必须命中真实热路径，而不是只扩大图总量（CR-PERF-01）：**

- 当 Story / NFR 要求验证“200 → 2000 文档退化不超过 X%”这类扩展性目标时，测试必须证明规模差异会进入实际访问的节点、边或底层查询成本
- 仅扩大图总量、但仍从固定起点测量常数大小局部子图，不足以证明真实扩展性
- 内存索引或 mock 性能用例可以保留为补充，但不能作为唯一证据；必要时必须增加真实 repository 路径验证
- 若 benchmark 仅存在环境敏感性而不影响运行时正确性，可降级为 CR TODO 跟踪，但前提是热路径验证已经存在

**P39. 受影响文档集合类分析必须自有定向遍历语义（CR-QUERY-07）：**

- 适用范围：impact / affected-doc / downstream propagation 这类输出“文档集合”的分析服务
- 若路径资格依赖 `status`、`confidence`、方向等传播语义，必须在扩展前判断；**禁止**先执行通用双向查询再对结果做后过滤
- Impact 的 relationType 级传播方向必须由 `src/types/relations.ts` 中的显式矩阵定义；v0.1 所有内置 relationType 均按 `source -> target` 传播，且仅 `status='active'` 可传播。`derived_from` 表示目标文档从源文档派生，`contains` 表示源文档逻辑包含目标文档，二者都不反向传播
- 结果若按文档计数，必须按 impacted document 聚合去重；`totalCount` 等基数字段必须与去重后的文档集合一致
- 源文档不得因自环、回源环或多路径回流出现在自身结果中
- 若同一文档可经多条路径命中且结果仍需保留关系元数据，必须定义稳定候选优先级，禁止依赖遍历偶然顺序
- 测试必须覆盖：反向边不误报、低置信桥接边不继续扩展、自环/回源环不回写源文档、多路径命中同一文档只计一次

## 覆盖率配置规则（来源：Story 1-2 CR 历史）

**P22. coverage.exclude 必须显式枚举（CR-COV-01）：**

⚠️ **禁止**使用 blanket glob（如 `src/**/index.ts`）作为覆盖率排除规则——此类写法会将含业务逻辑的文件（如 `src/cli/index.ts`）一并排除，导致 coverage gate 形同虚设。

✅ **只排除**纯 re-export barrel 文件（零业务逻辑），逐一显式列举：

```ts
// vitest.config.ts — ✅ 正确：显式枚举纯 barrel 文件
coverage: {
  exclude: [
    'src/**/*.d.ts',
    // 仅排除纯 re-export barrel 文件（无业务逻辑）：
    'src/adapters/index.ts', 'src/adapters/framework/index.ts', 'src/adapters/ide/index.ts',
    'src/mcp/index.ts', 'src/repositories/index.ts', 'src/scanner/index.ts',
    'src/schemas/index.ts', 'src/services/index.ts', 'src/types/index.ts', 'src/utils/index.ts',
    // ⚠️ 含业务逻辑的文件（src/cli/index.ts 等）禁止出现在此列表中
  ],
}
```

**P23. Story 级覆盖率 AC 优先于架构 D8 分级（CR-COV-02）：**

架构 D8 表定义了各层覆盖率**最低下限**。若单 Story 的 AC 明文要求更高覆盖率（如某 Story 要求整体 ≥ 90%），以 Story AC 为准，该 Story 验收时不可用 D8 下限豁免。

## CI/CD 发布链路规则（来源：Story 1-5 CR 历史）

**P24. semantic-release Node engines 对齐（CR-CI-01）：**

升级 `semantic-release` / `@semantic-release/*` 后，必须核对 `package-lock.json` 中相关包的 `engines.node`，并确保 `.github/workflows/release.yml` 的 `actions/setup-node` 版本满足发布工具要求。CI / cross-platform 工作流可按自身运行需求独立选择 Node 基线，但 release workflow 必须满足发布工具 engines。

```yaml
# ✅ semantic-release@25 要求 Node ^22.14.0 || >=24.10.0
- uses: actions/setup-node@v4
  with:
    node-version: '22'
```

**P25. semantic-release 版本提交必须包含 lockfile（CR-CI-02）：**

npm 项目使用 `package-lock.json` 且流水线使用 `npm ci` 时，`@semantic-release/git` 的 `assets` 必须同时包含 `CHANGELOG.md`、`package.json`、`package-lock.json`，避免 release 提交后 `package.json` 与 lockfile 版本漂移。

```json
{
  "assets": ["CHANGELOG.md", "package.json", "package-lock.json"]
}
```

**P26. Release workflow 必须声明质量门禁关系（CR-CI-03）：**

Release workflow 应显式依赖 CI 质量门禁成功，例如通过 `workflow_run` 监听 CI 成功，或在同一 workflow 中通过 `needs` 串联 lint / type-check / test / coverage 与 release。若暂不串联，必须记录为工程加固 TODO/豁免，避免 main 上未通过测试的提交被发布。

**P27. Release workflow 必须串行化发布任务（CR-CI-04）：**

push 到 main 触发 semantic-release 的项目，应配置 `concurrency` 串行化发布任务，通常按 workflow + ref 分组，并设置 `cancel-in-progress: false`，避免连续合并时多个 semantic-release 实例竞争 tag/version。

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: false
```

**P28. `[skip ci]` 跳过 release 的条件必须窄化（CR-CI-05）：**

禁止仅凭 `contains(github.event.head_commit.message, '[skip ci]')` 跳过整个 release job。若需要跳过 semantic-release 生成的版本提交，应窄化到 `chore(release):` 提交、bot actor，或评估直接移除该条件并依赖 commit-analyzer 默认规则防循环。

**P29. PR 模板质量门禁必须使用可执行命令（CR-CI-06）：**

PR 模板中的本地验证清单必须写出项目实际脚本名。覆盖率校验当前使用 `npm run test:coverage`，不要只写「覆盖率未下降」而不提供可执行命令。

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

// ❌ CLI 入口顶层执行 parse（CR-CLI-02）
const program = new Command();
program.parse(process.argv);  // 顶层执行，任何导入都会触发副作用

// ❌ CLI entrypoint 守卫字符串拼接（CR-CLI-01）
if (import.meta.url === `file://${process.argv[1]}`) { ... }  // 空格路径静默失效

// ❌ CLI entrypoint 守卫无判空调用（CR-CLI-01）
if (import.meta.url === pathToFileURL(process.argv[1]).href) { ... }  // argv[1] 缺失时崩溃

// ❌ coverage.exclude blanket glob（CR-COV-01）
exclude: ['src/**/index.ts']  // 误伤含业务逻辑的 src/cli/index.ts

// ❌ Repository update 方法接受不可变字段（CR-REPO-01）
updateDocument(id: string, updates: Partial<DocumentNode>): DocumentNode  // 禁止，Partial 含 id/createdAt

// ❌ Mapper 裸断言 DB 枚举值（CR-REPO-02）
return { relationType: row.relation_type as RelationType };  // 脏数据导致全链路崩溃

// ❌ 运行时读取静态资源文件（CR-REPO-03）
const sql = readFileSync(join(fileURLToPath(import.meta.url), '..', '001.sql'), 'utf-8');  // dist/ 中不存在

// ❌ 唯一索引缺少 source 维度（CR-REPO-04）
CREATE UNIQUE INDEX idx_relations ON relations(source_doc_id, target_doc_id, relation_type);  // manual+auto_scan 并存时冲突
```

**P18. AGENTS.md 共享文件处理规则（NFR12 appendable 例外）：**

`AGENTS.md` 是 Copilot 与 Codex CLI 共享的指令文件，属于 NFR12 零侵入策略的显式例外，必须按以下规则处理：

| 场景 | 行为 |
|------|------|
| 文件不存在 | **create-if-absent**：创建文件，写入 CORD 所需内容 |
| 文件已存在，格式兼容 | **preserve-if-exists**：保留原内容，以 `<!-- CORD:START -->...<!-- CORD:END -->` 注释边界追加 CORD 专属配置段 |
| 文件已存在，格式冲突 | **explicit-conflict**：返回 `AGENTS_MD_CONFLICT` 结构化错误，不自动覆盖；非 TTY 场景同样适用 |

```typescript
// ✅ 正确：AGENTS.md 追加 CORD 配置段（注释边界保护）
const existing = fs.readFileSync('AGENTS.md', 'utf-8');
const cordSection = `\n<!-- CORD:START -->\n${cordContent}\n<!-- CORD:END -->\n`;
fs.writeFileSync('AGENTS.md', existing + cordSection);

// ❌ 禁止：直接覆盖已有 AGENTS.md
fs.writeFileSync('AGENTS.md', newContent);  // 禁止（会丢失用户原有内容）
```

测试断言要求：必须覆盖 create-if-absent / preserve-if-exists / explicit-conflict 三个分支（见 Story 5.3 共享文件处理契约）。

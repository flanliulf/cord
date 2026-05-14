---
project_name: 'CORD'
user_name: 'Fancyliu'
date: '2026-04-09'
sections_completed: ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'code_quality', 'workflow_rules', 'critical_rules']
status: 'complete'
rule_count: 54
optimized_for_llm: true
---

# Project Context for AI Agents

_此文件包含 AI Agent 在本项目中编写代码时必须遵守的关键规则和模式。聚焦于 Agent 可能遗漏的非显而易见的细节。_

---

## Rule Document Registry

**凡是确认/修改/新增任何规则、约定或豁免，必须同步更新以下所有文档：**

| 文档 | 职责 |
|------|------|
| `_bmad-output/project-context.md` | AI agent 主规则文件，优化为 LLM 消费 |
| `_bmad-output/planning-artifacts/architecture/04-implementation-patterns-consistency-rules.md` | 实现模式，面向人类可读 |
| `_bmad-output/planning-artifacts/architecture/03-core-architectural-decisions.md` | 技术决策事项记录，面向人类可读 |

> 两份文档内容互为镜像，任何一处规则变更必须同时更新另一处。

---

## 技术栈与版本

### 核心技术

| 技术 | 用途 | 版本约束 |
|------|------|---------|
| Node.js | 运行时 | ≥ 20 LTS |
| TypeScript | 开发语言 | 严格模式, ESNext target, NodeNext 模块解析 |
| ESM | 模块系统 | `"type": "module"`, 所有 import 必须带 `.js` 后缀 |

### 核心运行时依赖

| 依赖 | 用途 | 版本说明 |
|------|------|---------|
| commander | CLI 框架 | v14 |
| @clack/prompts | 交互式向导 | cord init 专用 |
| chalk | 终端着色 | v5+（纯 ESM，与项目 ESM-first 一致） |
| better-sqlite3 | SQLite 存储 | 同步 API, WAL 模式, native addon |
| @modelcontextprotocol/sdk | MCP Server | ⚠️ 注意包名（非 @anthropic-ai/mcp-sdk） |
| zod | 数据验证 | v3.x（⚠️ 避免 v4，有破坏性变更） |
| unified + remark-parse | Markdown AST | 纯 ESM |
| remark-frontmatter + remark-gfm | remark 插件 | 纯 ESM |
| gray-matter | Frontmatter 解析 | YAML 配置复用 |

### 开发依赖

| 依赖 | 用途 | 版本说明 |
|------|------|---------|
| tsup | 构建打包 | ESM 输出 |
| vitest | 测试框架 | 兼容 Jest API |
| eslint | 静态分析 | ⚠️ v10 仅支持 flat config（无 .eslintrc） |
| prettier | 代码格式化 | — |
| semantic-release | 自动版本管理 | npm provenance 从第一天启用 |

### 关键版本决策点

1. **Zod v3 vs v4** — 锁定 v3.x；v4 存在破坏性变更（`z.object` API 变化）
2. **ESLint ≥ v10** — 已移除 `.eslintrc` 支持，只能使用 flat config（`eslint.config.js`）
3. **MCP SDK 包名** — `@modelcontextprotocol/sdk`（不是 `@anthropic-ai/mcp-sdk`）
4. **chalk v5+** — 纯 ESM 模块，不支持 `require()`；架构文档原指定 picocolors，所有引用处需替换为 chalk
5. **TypeScript 6.0** — 已发布，需评估与 NodeNext 解析的兼容性

## 关键实现规则

### 语言特定规则（TypeScript / ESM）

**ESM 模块要求：**
- 所有 import 路径**必须带 `.js` 后缀**（即使源文件是 `.ts`）：`import { ScanService } from './scan-service.js'`
- 使用 `node:` 前缀引用 Node.js 内置模块：`import { readFileSync } from 'node:fs'`
- 禁止使用 `require()` / `module.exports`

**TypeScript 严格模式：**
- `strict: true` — 无隐式 any、严格 null 检查
- 所有公共 API 方法必须有显式返回类型声明
- 禁止使用 `any` 类型，用 `unknown` + 类型守卫代替

**Import 排序规范（P14）：**
```typescript
// 1. Node.js 内置模块
import { readFileSync } from 'node:fs';
// 2. 第三方依赖
import { z } from 'zod';
// 3. 内部模块（通过 index.ts 门面）
import { ScanService } from '../services/index.js';
// 4. 同级模块
import { formatOutput } from './helpers.js';
```

**跨层引用规则（P6 强制执行）：**
- 跨层引用**必须通过 `index.ts` 门面**，禁止直接 import 内部文件
- Service 层**只依赖接口**（`IGraphRepository`），禁止 import 具体实现（`SqliteGraphRepository`）

**异步 vs 同步模式（P13）：**

| 层 | 模式 | 理由 |
|---|------|------|
| Repository 层 | **同步** | better-sqlite3 同步 API |
| Service 层 | **同步为主**（文件 I/O 用 async） | 数据库操作同步 |
| Scanner 引擎 | **async** | unified/remark 管道是异步的 |
| CLI / MCP 入口 | **async** | Commander action / MCP handler 均 async |

**错误处理（P12）：**
- 所有异常必须是 `CordError` 子类，携带 `code` + `suggestion`
- Service 层禁止 `console.log` / `process.exit`
- MCP Server 的 stdout 只用于 JSON-RPC，日志走 stderr
- 禁止静默吞掉异常

**Service 方法签名（P11）：**
```typescript
// ✅ 输入：单一对象参数，Zod schema 推导类型
async scanDocuments(input: ScanInput): Promise<ScanResult>

// ❌ 禁止散装参数
async scanDocuments(path: string, incremental: boolean): Promise<any>
```

### 框架特定规则（双入口架构 + 适配器模式）

**双入口共享 Service 层（核心架构）：**
```
CLI (Commander.js)  ──→  Service 层  ←──  MCP Server (@modelcontextprotocol/sdk)
         ↓                    ↓                    ↓
    L3 薄壳层            L2 业务逻辑          L3 薄壳层
```
- CLI 和 MCP 入口**都是薄壳**：只负责参数解析 → 调用 Service → 格式化输出
- **零业务逻辑**允许存在于 L3 入口层
- 所有业务逻辑集中在 L2 Service 层

**依赖注入模式（P7）：**
```typescript
// ✅ 构造函数注入接口
class ScanService {
  constructor(private readonly repo: IGraphRepository) {}
}

// ❌ 禁止直接 import 具体实现
import { SqliteGraphRepository } from '../repositories/sqlite-graph-repository.js';
```

**框架适配器模式（Epic 2）：**
- `IFrameworkAdapter` 接口 → `AbstractFrameworkAdapter` 基类 → 具体适配器
- `GenericFrameworkAdapter` 作为兜底（无预设规则，仅基础 frontmatter 扫描）
- `BmadFrameworkAdapter` 作为参考实现（18 种文档类型，v0.1 仅实现 Markdown 16 种，YAML 2 种延至 v0.2；5 层检测；详见 Story 2.3）
- 新增框架适配**不得修改核心模块源码**（NFR8）

**IDE 适配器模式（Epic 5）：**
- `IIdeAdapter` 接口 → 4 种 IDE 适配器（Claude Code / Cursor / VS Code Copilot / Codex CLI）
- 零侵入策略：不修改 IDE 现有配置，只新增 CORD 相关文件；**例外**：`AGENTS.md` 为 NFR12 appendable 例外共享文件（Copilot + Codex CLI 共享），已存在时追加 CORD 专属注释段（<!-- CORD:START --> ... <!-- CORD:END -->），格式冲突时返回 `AGENTS_MD_CONFLICT` 结构化错误，不自动覆盖
- `cord init` 自动检测 IDE 并选择适配器

**MCP Server 关键约束：**
- stdout **专用于 JSON-RPC 通信**，绝不输出日志
- 所有日志 / 调试信息通过 `console.error()` → stderr
- MCP Tool 名使用 snake_case：`analyze_impact`、`query_relations`
- MCP Tool 参数使用 camelCase：`docPath`、`relationType`
- SIGTERM 优雅退出处理

**CLI 关键约束：**
- 命令名 kebab-case：`cord init`、`cord scan`、`cord impact`
- 选项 `--kebab-case`：`--output-format`、`--relation-type`
- 所有命令支持 `--json` 标志输出 JSON 格式
- 错误输出使用 chalk 着色 + CordError 的 suggestion 字段

**CLI 入口文件约束（CR-CLI-01/02/03/04，来源：Story 1-2、2-5 CR 历史）：**

- **禁止**在 `src/cli/index.ts` 等入口模块的顶层直接执行 `program.parse()`；所有 `parse()` / `process.exit()` 调用必须封装在函数内，并由 entrypoint 守卫保护（CR-CLI-02）
- **若 Commander 树中存在任何 `async` action，`runCli()` 必须为 `async` 并使用 `await program.parseAsync(process.argv)`；entrypoint 守卫必须以 `void runCli().catch(reportUnhandledCliError)` 或等效方式兜底未捕获异步错误**（CR-CLI-04）
- **CLI 退出码契约的最终 owner 是真实入口 `runCli()`**：不能只在单个 command factory 中处理 `ConfigError` / parse error；入口级测试必须直接覆盖这些路径（CR-CLI-04）
- **ESM entrypoint 守卫必须使用三步归一化写法**（CR-CLI-01）：
  ```ts
  import { realpathSync } from 'node:fs';
  import { pathToFileURL } from 'node:url';
  const entryArg = process.argv[1];
  if (entryArg) {
    let entryUrl: string;
    try { entryUrl = pathToFileURL(realpathSync(entryArg)).href; }
    catch { entryUrl = pathToFileURL(entryArg).href; }
    if (import.meta.url === entryUrl) { void runCli().catch(reportUnhandledCliError); }
  }
  ```
  ⚠️ 禁止使用 `` `file://${process.argv[1]}` `` 或无判空的 `pathToFileURL(process.argv[1]).href`
- **CLI helper 函数**（如 `applyVerboseFlag`）必须抽到独立的无副作用模块（如 `src/cli/verbose.ts`），测试直接导入 helper，不导入入口文件（CR-BP-01）
- **禁止依赖 Commander `preAction` 处理全局选项**（如 `--verbose`），除非已注册至少一个 `.action()`；无 action 时改用 `parse()` 之后 `program.opts()` 同步处理（CR-CLI-03）

**Query / CLI 边界约束（CR-QUERY-01/02/03，来源：Story 3-1 CR 历史）：**

- **所有会触发默认 Service / Repository 初始化或文件系统副作用的 CLI 命令，必须先完成输入校验与路径归一化，再调用 `serviceFactory()` 或创建数据目录**（CR-QUERY-01）
- **凡是以 project-root 相对路径作为仓储查询契约的命令，CLI 层必须先把 `./...`、绝对路径等输入归一化为 project-relative POSIX path，并显式拒绝 `''`、`'..'`、`'../...'` 这类项目根外路径；拒绝必须发生在 service 初始化之前，并返回稳定 `ConfigError`**（CR-QUERY-02）
  - 对原始路径文本必须先做 `trim()` 等标准化，再执行 `resolve()` / `relative()`、project-root 边界判断与 schema 校验；禁止先做边界判断、再依赖 schema 或 Service 隐式清理空白
  - 回归测试至少覆盖：带前后空白的项目外相对路径输入、带前后空白的项目外绝对路径输入，都必须在 `serviceFactory()` 前稳定返回 `ConfigError`
  - 跨平台回归必须覆盖 win32 语义：至少验证跨盘符路径（如 `D:\outside.json`）与 UNC 路径（如 `\\server\share\outside.json`）会在入口层被拒绝；若 `relative(projectRoot, input)` 结果仍为绝对路径，必须判定为 project-root 外路径并在 `serviceFactory()` 前返回 `ConfigError`
- **若默认 Service 封装了带 `close()` 的 Repository / 连接资源，Service 层必须显式转发生命周期方法；禁止让入口层的 `finally { service?.close?.(); }` 在默认实现上退化为空调用**（CR-QUERY-03）

**Query / Traversal 语义规则（CR-QUERY-05/06/07，CR-PERF-01，来源：Story 3-2、3-3 CR 历史）：**

- **CR-QUERY-05：图遍历必须分离“可扩展边”与“可输出边”**
  - 适用范围：所有基于关系图的 BFS / DFS 查询
  - `type`、标签或展示过滤等结果语义只控制输出，不默认裁剪遍历；除非需求明确声明“过滤即截断路径”
  - 可扩展边必须由路径有效性语义决定，例如 `includeDeprecated`、方向、深度或状态约束，而不是由最终展示过滤直接决定
  - 回归测试至少覆盖：`depth + type` 场景下，经非匹配中间边仍可抵达深层匹配关系

- **CR-QUERY-06：既不输出也不扩展的非匹配边必须在端点解析前跳过**
  - 先计算 `hopDistance`、`shouldOutput`、`shouldExpand` 等派生条件，再决定是否解析 relation 另一端文档
  - 当 `!shouldOutput && !shouldExpand` 时，必须直接跳过；禁止先解析端点再因过滤条件丢弃
  - 回归测试至少覆盖：匹配有效边与非匹配缺失端点边并存时，过滤查询返回匹配结果，而不是被无关坏边阻断

- **CR-QUERY-07：受影响文档集合类分析必须自有定向遍历语义**
  - 适用范围：impact / affected-doc / downstream propagation 这类输出“文档集合”的分析服务
  - 若路径资格依赖 `status`、`confidence`、方向等传播语义，必须在扩展前判断；禁止先执行通用双向查询再对结果做后过滤
  - 结果若按文档计数，必须按 impacted document 聚合去重；`totalCount` 等基数字段必须与去重后的文档集合一致
  - 源文档不得因自环、回源环或多路径回流出现在自身结果中；若同一文档可经多条路径命中且需保留关系元数据，必须定义稳定候选优先级
  - 回归测试至少覆盖：反向边不误报、低置信桥接边不继续扩展、自环/回源环不回写源文档、多路径命中同一文档只计一次

- **CR-PERF-01：性能 AC 必须让规模差异进入被测热路径，必要时补真实仓储路径验证**
  - 性能回归/扩展性测试必须证明数据规模变化会改变实际访问的节点、边或底层查询成本；禁止只扩大图总量却仍测量常数大小局部子图
  - 若内存仓储、预建索引或 mock 无法代表真实查询成本，必须补至少一条真实 repository 路径验证，覆盖实际 `getRelationsByDocId`、索引或 IO 行为
  - 环境敏感但不影响运行时正确性的 benchmark 抖动可作为 CR TODO 跟踪，但不得替代当前 Story 的热路径验证

### Repository 层开发规则（来源：Story 1-4、2-5 CR 历史）

**CR-REPO-01：update 方法禁止接受不可变字段**
- 所有 `update*` 接口签名必须使用 `Omit<Partial<EntityType>, 'id' | 'createdAt' | 'updatedAt'>`，排除不可变字段
- 实现层解构丢弃不可变字段，显式透传 `existing.createdAt`（避免 spread merge 覆盖）
- 返回值必须与 DB 持久态完全一致，禁止返回「看似更新成功但实未写库」的值
```typescript
// ✅ 正确
updateDocument(id: string, updates: Omit<Partial<DocumentNode>, 'id' | 'createdAt' | 'updatedAt'>): DocumentNode

// ❌ 禁止：允许传入不可变字段
updateDocument(id: string, updates: Partial<DocumentNode>): DocumentNode
```

**CR-REPO-02：Mapper 层必须对 DB 值做运行时防御校验**
- JSON 字段：`try/catch` + 含 `{ cause }` 的上下文错误，禁止裸 `JSON.parse(raw) as T`
- 枚举字段：白名单 `assertEnum<T>(value, VALID_SET, context)` 校验，禁止裸 `as EnumType`
- DB 层 `CHECK` 约束必须与 TS 枚举白名单保持对称（两处必须同步更新）
```typescript
// ✅ 正确：带上下文的防御校验
function parseJsonMetadata(raw, context): Record<string, unknown> | undefined {
  try { return JSON.parse(raw); } catch (err) { throw new Error(`...`, { cause: err }); }
}
function assertEnum<T extends string>(value: string, valid: Set<string>, context: string): T {
  if (!valid.has(value)) throw new Error(`[mappers] Invalid value "${value}" for ${context}`);
  return value as T;
}

// ❌ 禁止：裸断言，脏数据会让整个查询链路崩溃
return { relationType: row.relation_type as RelationType };
```

**CR-REPO-03：构建产物中的静态资源必须内联为 TS 模块（禁止运行时 readFileSync）**
- 迁移 SQL 等构建时已知的静态文本：以 TS 模块字符串常量内联，编译时绑定
- tsup 仅打包 TS/JS 文件，`.sql`/`.json` 等资源文件不会出现在 `dist/` 中
- 见「数据库迁移（D2）」中的 CR-REPO-03 条目
```typescript
// ✅ 正确：内联为 TS 模块常量
export const MIGRATION_001_SQL = `CREATE TABLE IF NOT EXISTS schema_migrations (...)`;

// ❌ 禁止：运行时文件系统读取，dist/ 中不存在该文件
const sql = readFileSync(join(fileURLToPath(import.meta.url), '..', '001.sql'), 'utf-8');
```

**CR-REPO-04：唯一索引维度必须与接口 source 语义契约对齐**
- 当接口暴露了「按 source 区分保留/删除」能力（如 `excludeSources` 参数），唯一索引必须包含 `source` 维度
- DB `CHECK` 约束的枚举值必须与 TS 类型白名单完全一致，不得只改一处

**CR-REPO-05：批量写入必须先计算可持久化 workset，再进入事务**
- 涉及 documents / relations / sync_states 等多阶段批量写入时，必须先在事务外过滤不可持久化项，并为被跳过项记录 warning
- 事务内只处理已经验证过的完整 workset；若发现端点映射或写入计划失配，必须抛错回滚，禁止用普通 `return` 提前结束 transaction callback
- 对外暴露的统计字段（如 discovered / written counts）必须与过滤后的实际写入策略一致，不能返回“计划总数”却只提交部分结果

### Scanner / 增量扫描开发规则（来源：Story 2-6 CR 历史）

**CR-SCAN-01：生命周期重绑定必须满足双向唯一最优，歧义时降级为 delete + add**
- 适用范围：所有基于 `contentHash`、路径、basename 等弱身份信号推断 rename / move / merge 的逻辑
- **禁止**使用数组顺序、FIFO `shift()`、字典序 tiebreaker 等非语义排序直接决定既有 `docId` 与新路径的绑定关系
- 只有 stored 侧与 current 侧都形成**唯一最优匹配**时，才允许认定为 rename / move；可使用同目录、同 basename、basename 编辑距离、路径距离等语义信号做评分
- 若第一名与第二名并列，或多候选下无法形成双向唯一最优匹配，必须保守降级为 delete + add，禁止静默强配对
- 相关测试必须同时覆盖两类场景：
  - 存在稳定路径信号时可正确消歧
  - 真正歧义时降级为 delete + add，而不是错误更新 `docId`

### 测试规则

**测试框架与组织（P5）：**
- 测试框架：**Vitest**（兼容 Jest API）
- 独立 `tests/` 目录，镜像 `src/` 结构：
```
tests/
├── unit/          # 镜像 src/ 结构
│   ├── services/
│   ├── repositories/
│   ├── scanner/
│   ├── adapters/
│   └── utils/
├── integration/   # 按场景组织
│   ├── cli/
│   ├── mcp/
│   └── flows/
└── fixtures/      # 统一测试数据
    ├── sample-projects/  # 模拟项目目录结构（bmad-project/、generic-project/、empty-project/）
    ├── documents/
    └── configs/
```

**测试命名规范（P16）：**
```typescript
describe('ScanService', () => {
  describe('scanDocuments', () => {
    it('should discover frontmatter references as relations', () => {});
    it('should skip unparseable documents and log warning', () => {});
    it('should throw ScanError when project root is invalid', () => {});
  });
});
```
- describe: `类名` → `方法名`
- it: `should + 行为描述`
- 测试文件名：`{source}.test.ts`

**覆盖率分级要求（D8）：**

| 层 | 目标 | 说明 |
|---|------|------|
| Service + Scanner | ≥ 90% | 核心业务逻辑 |
| Repository | ≥ 85% | 数据访问关键路径 |
| Adapters | ≥ 80% | 适配逻辑需可靠 |
| CLI / MCP 入口 | ≥ 70% | 薄壳，主要是参数转发 |
| **整体** | **≥ 80%** | CI 质量门禁 |

> ⚠️ **Story 级 AC 优先**：单 Story 若明文要求更高覆盖率（如 Story 1-2 AC8 要求 ≥ 90%），以 Story AC 为准，高于 D8 分层下限（CR-COV-02）。

**覆盖率排除规则（CR-COV-01，来源：Story 1-2 CR 历史）：**
- **禁止**使用 `src/**/index.ts` 等 blanket glob 作为 `coverage.exclude`；此类规则会将含业务逻辑的文件一并排除，导致 coverage gate 形同虚设
- 只可显式枚举**纯 re-export barrel 文件**（零业务逻辑的 `index.ts`）：
  ```ts
  // vitest.config.ts — ✅ 正确：显式枚举纯 barrel 文件
  coverage: {
    exclude: [
      'src/**/*.d.ts',
      'src/adapters/index.ts', 'src/adapters/framework/index.ts', 'src/adapters/ide/index.ts',
      'src/mcp/index.ts', 'src/repositories/index.ts', 'src/scanner/index.ts',
      'src/schemas/index.ts', 'src/services/index.ts', 'src/types/index.ts', 'src/utils/index.ts',
      // ⚠️ 含业务逻辑的文件（如 src/cli/index.ts）禁止出现在此列表中
    ],
  }
  // ❌ 禁止：'src/**/index.ts'（会把含逻辑的 cli/index.ts 一并排除）
  ```

**必须遵守的测试原则：**
- 新增功能**必须附带测试**，覆盖正常路径 + 至少一个异常路径
- Repository 层测试使用**内存 SQLite**（`:memory:`），不依赖文件系统数据库
- Scanner 引擎测试使用 `tests/fixtures/documents/` 下的真实 Markdown 文件
- 集成测试验证跨层调用流程（如 scan → query → impact 完整链路）
- Mock 策略：Service 测试 mock `IGraphRepository` 接口；CLI/MCP 测试 mock Service 层
- 含 `async` Commander action 或自定义退出码契约的 CLI 命令，必须同时覆盖 command factory 层与真实 `runCli()` 入口层；入口层至少断言成功路径、Commander parse error、业务 `ConfigError` 和 runtime error
- 事务性批量写入流程必须覆盖“部分输入无效”回归测试，断言返回计数与 documents / relations / sync_states 的最终落库结果一致，防止部分提交被误判为成功
- **按层测试错误契约与过滤语义**：Service 层负责覆盖业务语义、错误码、suggestion 与异常分支；CLI 层负责覆盖参数转发、退出码、文本/JSON 序列化。若 CLI 已验证参数转发，且 Service 层已覆盖核心过滤语义，可豁免重复的 CLI 端到端输出测试（CR-QUERY-04）
- **所有新增错误路径都必须至少有一条契约测试**：若实现暴露新的 `CordError.code` / `suggestion` 或 JSON 错误载荷，必须在对应层补齐回归测试，避免 happy-path 通过但对外错误契约无保护（CR-QUERY-04）

### 代码质量与风格规则

**命名约定汇总（P1-P4）：**

| 维度 | 规则 | 示例 |
|------|------|------|
| 文件名 | kebab-case | `scan-service.ts`、`errors.ts` |
| 类名 | PascalCase | `ScanService`、`CordError` |
| 函数/方法 | camelCase | `analyzeImpact()`、`queryRelations()` |
| 常量 | SCREAMING_SNAKE_CASE | `RELATION_TYPES`、`MAX_TRAVERSAL_DEPTH` |
| 接口 | `I` 前缀 + PascalCase | `IGraphRepository`、`IFrameworkAdapter` |
| 类型 | PascalCase（无前缀） | `RelationType`、`DocumentNode` |
| Zod Schema | camelCase + `Schema` 后缀 | `documentSchema`、`configSchema` |
| DB 表名 | snake_case 复数 | `documents`、`relations` |
| DB 列名 | snake_case | `doc_id`、`source_path` |
| CLI 命令 | kebab-case | `cord scan`、`cord impact` |
| MCP Tool 名 | snake_case | `analyze_impact`、`query_relations` |
| MCP Tool 参数 | camelCase | `docPath`、`relationType` |

**数据格式转换边界（P8）：**
- DB ↔ Repository 层：snake_case（`doc_id`、`relation_type`）
- Repository → Service 层：转换为 camelCase（`docId`、`relationType`）
- **转换逻辑集中在 Repository 层**，其他层不处理格式转换

**模块导出（P6）：**
- 每个架构层有一个 `index.ts` 作为公共 API 门面
- 跨层引用**只通过 `index.ts`**，禁止直接引用内部文件

**注释规范（P15）：**
- 公共 API **必须**有 JSDoc（含 `@param`、`@returns`、`@throws`）
- 行内注释解释 **WHY**（为什么这样做），不解释 WHAT（代码在做什么）
- 禁止对显而易见的代码添加冗余注释

**ESLint / Prettier：**
- ESLint：flat config（`eslint.config.js`），禁止生成 `.eslintrc`
- Prettier：统一代码格式化
- CI 中 `lint + type-check` 作为 PR 质量门禁

**关系类型值（P9）——9 种固定值：**
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

### 开发工作流规则

**目录结构（D5）：**
```
src/
├── cli/            # L3 CLI 入口层（薄壳）
│   ├── commands/   # Commander.js 命令定义
│   └── index.ts
├── mcp/            # L3 MCP Server 入口层（薄壳）
│   ├── tools/      # MCP Tool 定义
│   └── server.ts
├── services/       # L2 Service 层（核心业务逻辑）
├── repositories/   # L1 Repository 层（数据访问）
│   └── migrations/ # SQL 迁移脚本
├── scanner/        # 扫描引擎（策略模式）
│   └── rules/
├── adapters/       # 可插拔适配层
│   ├── framework/  # IFrameworkAdapter + 实现
│   └── ide/        # IIdeAdapter + 实现
├── schemas/        # Zod schema 定义
├── utils/          # 公共工具（logger、errors、config）
└── types/          # 全局类型定义
```

**架构层依赖方向（严格单向）：**
```
L3 入口层（CLI / MCP） → L2 Service 层 → L1 Repository 层
                              ↓
                    Scanner / Adapters（同级调用）
```
- **禁止反向依赖**：L1 不得引用 L2，L2 不得引用 L3
- **禁止同层跨域引用**：CLI 不得直接调用 MCP 内部模块

**数据库迁移（D2）：**
- 迁移脚本存放在 `src/repositories/migrations/`
- 按编号顺序命名：`001-initial-schema.sql`、`002-add-index.sql`（kebab-case，与项目文件命名约定 P2 一致）
- 迁移状态使用 `schema_migrations` 历史表追踪（非单值 schema_version），支持审计和部分回滚
- 应用启动时查询 `schema_migrations` 表已执行版本后，按序执行未执行的迁移脚本
- 迁移在事务中执行，失败可回滚
- **迁移 SQL 内联规则（CR-REPO-03）**：迁移 SQL 以 TS 模块字符串常量内联（`export const MIGRATION_XXX_SQL = \`...\``），禁止运行时 `readFileSync`；tsup 仅打包 TS/JS 文件，`.sql` 资源不会出现在 `dist/` 中
- **pre-release schema 重写约定**：v0.1 发布前可直接重写已有 migration；首个稳定 release 后切换为只增不改的增量迁移模式（参见 TODO-007）

**配置管理（D6）：**
- 支持 `cord.config.yaml`（推荐）和 `cord.config.json`
- 加载优先级：YAML > JSON（同时存在时 YAML 优先）
- 配置加载后通过 Zod schema 验证
- `cord init` 默认生成 YAML 格式
- 配置字段基线（9 项）：`projectName`（项目显示名，供导出快照等面向用户的输出优先使用，缺失时由调用方回退到项目根目录名）+ 初始 7 项（framework、ide、scanPaths、excludePaths、confidenceThreshold、relationTypes、adapters）+ updateStrategies（Story 4.3 引入，按文档类别配置更新策略，键为 docType，值为 'auto' | 'suggest' | 'log_only'，缺省 suggest，未知 key 宽容处理）
- 若用户可见输出字段依赖新的配置来源（例如 `projectName`）且当前 schema/契约尚未定义，必须先完成产品/架构裁决并更新 schema，再进入实现与测试；禁止用临时 fallback 逻辑替代未裁决契约

**CI/CD（D7）：**
- GitHub Actions 作为唯一 CI/CD 平台
- PR 检查：`lint` + `type-check` + `test` + `coverage`
- 发布：semantic-release 为唯一发布 owner（自动化版本 + npm publish + GitHub Release）
- Release workflow 权限：必须同时声明 `permissions.id-token: write`（npm provenance OIDC）和 `permissions.contents: write`（GitHub Release / tags 创建）；显式声明任意权限时，未声明权限收缩为 `none`
- 跨平台矩阵：ubuntu / macos / windows（better-sqlite3 native addon 验证）
- npm provenance 从第一天启用
- 发布工具版本约束：升级 `semantic-release` / `@semantic-release/*` 后，必须核对 lockfile 中 `engines.node`，并确保 release workflow 的 `actions/setup-node` 版本满足要求；CI/cross-platform 可按运行需求独立选择 Node 基线
- semantic-release 提交版本变更时，`@semantic-release/git` 的 `assets` 必须包含 `CHANGELOG.md`、`package.json`、`package-lock.json`，避免 `npm ci` 因 lockfile 漂移失败
- Release workflow 应显式依赖 CI 质量门禁成功（`workflow_run`、同工作流 `needs` 或等效机制）；若暂不串联，必须记录为工程加固 TODO/豁免
- Release workflow 应配置 `concurrency` 串行化发布任务，通常按 workflow + ref 分组且 `cancel-in-progress: false`
- 避免用宽泛 `contains(head_commit.message, '[skip ci]')` 跳过 release；如需跳过，必须窄化到 semantic-release 版本提交或 bot actor
- PR 模板中的质量门禁必须写成可执行命令，覆盖率校验使用项目实际脚本（当前为 `npm run test:coverage`）

### 关键易错规则

**禁止事项（Anti-Patterns）：**

```typescript
// ❌ Service 层直接操作终端
console.log('Scanning...');  // 禁止——用 Logger
process.exit(1);             // 禁止——抛 CordError，由入口层处理

// ❌ 跨层直接引用内部文件
import { scanDocumentsImpl } from '../services/scan-service.js';
// 应通过：import { ScanService } from '../services/index.js';

// ❌ Repository 返回 camelCase
return { sourcePath: '...' };  // Repository 层应返回 snake_case，再由自己转换

// ❌ Service 返回 snake_case
return { source_path: '...' };  // Service 层应已转换为 camelCase

// ❌ 散装参数代替输入对象
async queryRelations(docPath: string, type?: string, depth?: number)

// ❌ 静默吞掉异常
try { ... } catch (e) { /* 忽略 */ }

// ❌ 抛非 CordError 异常
throw new Error('something wrong');  // 应使用 CordError 子类

// ❌ MCP Server 向 stdout 输出非 JSON-RPC 内容
console.log('debug info');  // stdout 专用于 JSON-RPC，日志用 console.error → stderr

// ❌ 使用 require() 或 .eslintrc
const chalk = require('chalk');  // ESM 项目禁止 require
```

**易忽略的边界情况：**

1. **ESM import 后缀** — 即使源文件是 `.ts`，import 路径必须写 `.js`
2. **better-sqlite3 是同步 API** — Repository 方法不要声明为 async
3. **unified/remark 是异步管道** — Scanner 引擎方法必须是 async
4. **MCP SDK 包名** — `@modelcontextprotocol/sdk`，不是 `@anthropic-ai/mcp-sdk`
5. **chalk v5+ 纯 ESM** — 不支持 `require()`；架构文档原指定 picocolors 的地方均需替换
6. **Zod v3 锁定** — 不要使用 v4 的 API（如 `z.string().brand()` 行为变化）
7. **snake_case ↔ camelCase 边界** — 只在 Repository 层转换，其他层保持各自格式
8. **CordError 必须携带 `code` + `suggestion`** — 错误码格式：`CORD_SCAN_001`
9. **新增框架适配器不得修改核心源码** — NFR8 合规要求
10. **Zod schema 文件必须同时导出 `validateXxx` 包装入口** — 裸 `xxxSchema.parse()` 抛 `ZodError`，违反统一错误体系（AC6）；必须通过 `validateWithCordError` 包装为 `ConfigError` 并携带 `CORD_SCHEMA_xxx` 错误码（如 `CORD_SCHEMA_001`）。禁止只导出裸 schema 对象作为对外验证接口
11. **互斥可选字段必须收紧类型 + refine 双重约束** — `z.string().optional()` 允许空字符串，`Boolean('')===false` 使 refine 互斥判定失效；必须改为 `z.string().trim().min(1).optional()`，并补测 mixed-empty 分支（`{ fieldA: '', fieldB: '有效值' }`）以及 `neither`、`both`、`both-empty` 三类非法分支
12. **测试数据缺字段用显式对象字面量，禁止 `_ 解构`** — `const { k: _, ...rest } = obj` 触发 `@typescript-eslint/no-unused-vars` lint 报错，应直接构造缺目标字段的对象字面量
13. **Zod helper 泛型用 `ZodType<T, ZodTypeDef, unknown>` 不用 `ZodSchema<T>`** — `ZodSchema<T>` 将 Input=Output=T，与含 `.default()` / `.transform()` 的 schema（Input 为 `T|undefined`）类型不兼容，会导致 TypeScript 编译错误

**安全规则：**
- SQLite WAL 模式——数据目录 `.cord/` 应在 `.gitignore` 中
- 配置文件不包含敏感信息，但 `.cord/cord.db` 包含项目结构信息
- npm provenance 从第一天启用，确保供应链安全

---

## 使用指南

**AI Agent 须知：**
- 在实现任何代码之前，先阅读此文件
- 严格遵守所有规则，不得自行变通
- 存疑时选择更严格的选项
- 发现新模式时更新此文件

**维护者须知：**
- 保持此文件精简，聚焦于 Agent 需要的信息
- 技术栈变更时及时更新
- 定期审查，移除已变得显而易见的规则
- 新增规则时确保其具有可操作性

最后更新：2026-04-09

# Integration Patterns Analysis（集成模式分析）

本节聚焦 CORD 冷启动扫描器的系统集成模式：各技术组件之间如何通信、数据如何流转、接口如何设计。从 CORD 的双入口架构（CLI ↔ MCP Server）和分层设计（入口层 → 命令层 → 服务层 → 数据层 → 基础设施层）出发，分析关系发现引擎的集成接口规范。

## 1. 核心管道集成：unified / remark 插件 API

CORD 的关系发现引擎构建在 unified.js 管道之上，通过 mdast 节点遍历实现关系提取。

### 1.1 插件管道模型

unified.js 采用 **线性管道（Pipeline）** 模式，插件按注册顺序链式执行：

```
文件内容
  → remark-parse（Parser：text → mdast）
  → remark-frontmatter（Frontmatter AST 节点）
  → cord-frontmatter-parser（CORD 关系声明提取）
  → cord-heading-extractor（章节锚点提取）
  → cord-link-extractor（链接/引用提取）
  → cord-relation-analyzer（🆕 关系分析与分类）
  → VFile.data（结构化输出数据总线）
```

**管道内通信协议**：
- **输入**：每个插件接收 `(tree: mdast.Root, file: VFile)` 两个参数
- **输出**：插件可修改 tree（AST 变换）或向 `file.data` 写入结构化数据
- **VFile.data 作为数据总线**：插件间通过 `file.data.cordLinks`、`file.data.cordHeadings`、`file.data.cordRelations` 等命名空间传递中间结果
- **无副作用原则**：每个插件仅关注自己的提取逻辑，不直接访问数据库或外部服务

_Source: [unified.js 管道规范](https://github.com/unifiedjs/unified) — TR3 已验证_
_置信度：**HIGH**_

### 1.2 AST 遍历接口：unist-util-visit

CORD 插件的核心遍历 API 基于 `unist-util-visit`：

```typescript
import { visit, CONTINUE, SKIP, EXIT } from 'unist-util-visit';

// 函数签名
visit(tree, test?, visitor, reverse?);

// visitor 回调参数
type Visitor = (
  node: Node,        // 当前节点
  index?: number,    // 在父节点 children 中的索引
  parent?: Parent    // 父节点
) => VisitorAction;

// 返回值控制
type VisitorAction =
  | void         // CONTINUE - 继续遍历
  | typeof EXIT  // false - 立即终止遍历
  | typeof SKIP  // 'skip' - 跳过子节点
  | number;      // 跳转到指定兄弟节点索引
```

**CORD 关系提取遍历模式**：

```typescript
// cord-link-extractor 插件核心逻辑
function cordLinkExtractor() {
  return (tree: Root, file: VFile) => {
    const links: CordLink[] = [];

    // 提取 Markdown 链接 [text](url)
    visit(tree, 'link', (node: Link, index, parent) => {
      if (isRelativeLink(node.url)) {
        links.push({
          target: resolveRelativePath(file.path, node.url),
          anchor: extractAnchor(node.url),
          text: toString(node),
          position: node.position
        });
      }
    });

    // 提取 Wiki Links [[page]]
    visit(tree, 'wikiLink', (node: WikiLink) => {
      links.push({
        target: resolveWikiLink(node.value),
        alias: node.data?.alias,
        position: node.position
      });
    });

    file.data.cordLinks = links;
  };
}
```

_Source: [unist-util-visit GitHub](https://github.com/syntax-tree/unist-util-visit)_
_置信度：**HIGH** — 官方 API 文档直接验证_

## 2. 双入口集成模式：CLI ↔ MCP Server

### 2.1 共享 Service 层架构（TR5 已确认）

CORD 的核心设计是 CLI 和 MCP Server 共享同一个 Service 层，关系发现引擎作为 Service 层组件，被两个入口同时调用：

```
┌─────────────────────────────────────────────────┐
│                 Entry Layer                       │
│  ┌──────────────┐    ┌───────────────────────┐   │
│  │ CLI (cord)    │    │ MCP Server (stdio)     │   │
│  │ Commander.js  │    │ @modelcontextprotocol  │   │
│  └──────┬───────┘    └───────────┬───────────┘   │
│         │                        │                │
│         └──────────┬─────────────┘                │
│                    ↓                              │
│  ┌─────────────────────────────────────────┐     │
│  │            Service Layer                 │     │
│  │  ┌────────────────────────────────────┐ │     │
│  │  │      ScanService                    │ │     │
│  │  │  - scanAll(options)                 │ │     │
│  │  │  - scanIncremental(changedFiles)    │ │     │
│  │  │  - analyzeRelations(docId)          │ │     │
│  │  └────────────────────────────────────┘ │     │
│  │  ┌────────────────────────────────────┐ │     │
│  │  │    RelationDiscoveryService         │ │     │
│  │  │  - discoverByRules(doc)             │ │     │
│  │  │  - discoverByEmbedding(doc)         │ │     │
│  │  │  - discoverByLLM(doc)               │ │     │
│  │  │  - mergeResults(ruleR, embR, llmR)  │ │     │
│  │  └────────────────────────────────────┘ │     │
│  └─────────────────────────────────────────┘     │
│                    ↓                              │
│  ┌─────────────────────────────────────────┐     │
│  │          Repository Layer                │     │
│  │  IDocumentRepository / IRelationRepository│    │
│  └──────────────────┬──────────────────────┘     │
│                     ↓                             │
│  ┌─────────────────────────────────────────┐     │
│  │      Infrastructure Layer                │     │
│  │  SQLite + better-sqlite3                  │    │
│  └─────────────────────────────────────────┘     │
└─────────────────────────────────────────────────┘
```

### 2.2 CLI 入口集成接口

```typescript
// cord scan 命令 → ScanService 调用
// Commander.js 命令定义（TR5 已设计）
program
  .command('scan')
  .description('扫描文档并发现关系')
  .option('--full', '全量扫描（忽略增量缓存）')
  .option('--dry-run', '仅预览发现的关系，不写入数据库')
  .option('--level <level>', '分析级别: rules | embedding | llm', 'rules')
  .option('--confidence <threshold>', '最低置信度阈值', '0.5')
  .action(async (options) => {
    const scanService = container.resolve(ScanService);
    const result = options.full
      ? await scanService.scanAll(options)
      : await scanService.scanIncremental(options);
    renderScanResult(result); // @clack/prompts 渲染
  });
```

### 2.3 MCP Server 入口集成接口

```typescript
// MCP Tool 定义 → 同一个 ScanService
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'cord_scan') {
    const scanService = container.resolve(ScanService);
    const result = await scanService.scanAll({
      level: request.params.arguments?.level ?? 'rules',
      confidence: request.params.arguments?.confidence ?? 0.5,
    });
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  }
});
```

**关键集成约束**：
- CLI 输出使用 `@clack/prompts` + `picocolors` 人类可读格式
- MCP Server 输出使用 JSON 结构化格式（供 AI IDE 消费）
- **Service 层接口完全一致**，仅入口层负责格式转换

_置信度：**HIGH** — 基于 TR2 + TR5 已确认的架构设计_

## 3. Embedding Provider 集成接口（策略模式）

### 3.1 Provider 抽象接口

CORD 采用 **策略模式（Strategy Pattern）** 封装三级 Embedding 提供者，实现运行时切换：

```typescript
// Embedding Provider 抽象接口
interface IEmbeddingProvider {
  readonly name: string;
  readonly dimensions: number;
  readonly isAvailable: () => Promise<boolean>;

  embed(text: string): Promise<Float32Array>;
  embedBatch(texts: string[]): Promise<Float32Array[]>;
}

// Provider 工厂
class EmbeddingProviderFactory {
  // 按优先级自动检测可用 Provider
  async resolveProvider(config: CordConfig): Promise<IEmbeddingProvider> {
    // Level 3: 云端 API
    if (config.openaiApiKey) {
      return new OpenAIEmbeddingProvider(config.openaiApiKey);
    }
    // Level 2.5: Ollama（本地 LLM 运行时）
    if (await this.isOllamaRunning()) {
      return new OllamaEmbeddingProvider();
    }
    // Level 2: Transformers.js（纯 JS 本地推理）
    return new TransformersJsEmbeddingProvider();
  }
}
```

### 3.2 各 Provider 集成接口详情

**Transformers.js Provider（Level 2 默认）**

```typescript
class TransformersJsEmbeddingProvider implements IEmbeddingProvider {
  readonly name = 'transformers.js';
  readonly dimensions = 384; // all-MiniLM-L6-v2

  private pipeline: FeatureExtractionPipeline | null = null;

  async embed(text: string): Promise<Float32Array> {
    if (!this.pipeline) {
      // 懒加载：首次调用时加载模型（~2-5s）
      const { pipeline } = await import('@huggingface/transformers');
      this.pipeline = await pipeline('feature-extraction',
        'Xenova/all-MiniLM-L6-v2', { dtype: 'q8' }
      );
    }
    const output = await this.pipeline(text, {
      pooling: 'mean',
      normalize: true
    });
    return output.data as Float32Array;
  }

  async isAvailable(): Promise<boolean> {
    return true; // 纯 JS，始终可用
  }
}
```

**Ollama Provider（Level 2.5 可选增强）**

```typescript
class OllamaEmbeddingProvider implements IEmbeddingProvider {
  readonly name = 'ollama';
  readonly dimensions = 768; // nomic-embed-text-v1.5
  private baseUrl = 'http://localhost:11434';

  async embed(text: string): Promise<Float32Array> {
    const response = await fetch(`${this.baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'nomic-embed-text',
        prompt: text
      })
    });
    const data = await response.json();
    return new Float32Array(data.embedding);
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`);
      return res.ok;
    } catch { return false; }
  }
}
```

**OpenAI Provider（Level 3 云端）**

```typescript
class OpenAIEmbeddingProvider implements IEmbeddingProvider {
  readonly name = 'openai';
  readonly dimensions = 1536; // text-embedding-3-small

  constructor(private apiKey: string) {}

  async embed(text: string): Promise<Float32Array> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text
      })
    });
    const data = await response.json();
    return new Float32Array(data.data[0].embedding);
  }

  async embedBatch(texts: string[]): Promise<Float32Array[]> {
    // OpenAI API 原生支持批量（max 2048 inputs）
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: texts
      })
    });
    const data = await response.json();
    return data.data.map((d: any) => new Float32Array(d.embedding));
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }
}
```

_Source: [Ollama API 文档](https://github.com/ollama/ollama/blob/main/docs/api.md)、[OpenAI Embeddings API](https://platform.openai.com/docs/api-reference/embeddings)、[Transformers.js 文档](https://huggingface.co/docs/transformers.js)_
_置信度：**HIGH** — API 接口通过官方文档直接验证_

## 4. 规则引擎集成模式

### 4.1 可插拔规则架构

CORD 的规则引擎采用 **注册 - 执行** 模式，支持内置规则和用户自定义规则：

```typescript
// 关系发现规则接口
interface IRelationRule {
  readonly id: string;
  readonly name: string;
  readonly priority: number;  // 执行优先级（越小越先）
  readonly category: 'structural' | 'naming' | 'content' | 'semantic';

  // 判断规则是否适用于当前文档
  applies(doc: DocumentMeta): boolean;

  // 执行规则，返回发现的关系候选
  execute(context: RuleExecutionContext): RelationCandidate[];
}

// 规则执行上下文
interface RuleExecutionContext {
  sourceDoc: DocumentMeta;       // 当前文档
  allDocs: DocumentMeta[];       // 所有已注册文档
  astData: VFileData;            // remark 管道输出的 AST 数据
  projectConfig: ProjectConfig;  // 项目配置（含框架适配规则）
}

// 规则引擎
class RuleEngine {
  private rules: IRelationRule[] = [];

  register(rule: IRelationRule): void {
    this.rules.push(rule);
    this.rules.sort((a, b) => a.priority - b.priority);
  }

  execute(context: RuleExecutionContext): RelationCandidate[] {
    return this.rules
      .filter(rule => rule.applies(context.sourceDoc))
      .flatMap(rule => rule.execute(context));
  }
}
```

### 4.2 内置规则分类

| 规则类别 | 规则 ID | 输入数据 | 输出关系类型 | 置信度 |
|---------|---------|---------|-------------|--------|
| **链接规则** | `link-forward` | `cordLinks`（AST 链接） | `references` | 1.0（显式） |
| **链接规则** | `link-backlink` | 全局链接索引反向查询 | `references`（反向） | 1.0（显式） |
| **Frontmatter 规则** | `frontmatter-relations` | `cordFrontmatter.relations` | 任意（用户声明） | 1.0（显式） |
| **目录规则** | `directory-contains` | 文件路径层级 | `contains` | 0.8 |
| **命名规则** | `naming-hierarchy` | 文件名数字前缀 | `contains`/`derived_from` | 0.7 |
| **命名规则** | `naming-suffix` | 文件名后缀模式 | `must_consistent` | 0.6 |
| **内容规则** | `code-block-reference` | AST 代码块中的文件路径 | `references` | 0.9 |
| **框架规则** | `bmad-document-chain` | BMAD 文档类型识别 | `derived_from`/`lifecycle_bound` | 0.85 |

_置信度：**HIGH** — 基于 CORD 9 种关系类型（TR1）和 remark 插件架构（TR3）的推导设计_

## 5. 数据层集成：Repository Pattern

### 5.1 Repository 接口（TR1 已设计）

```typescript
// 意图驱动的关系仓库接口
interface IRelationRepository {
  // 写入发现的关系
  upsertRelation(relation: RelationEntity): void;
  upsertRelationsBatch(relations: RelationEntity[]): void;

  // 查询关系图
  getRelationsFrom(docId: string): RelationEntity[];
  getRelationsTo(docId: string): RelationEntity[];  // 反向链接
  getRelationsByType(type: RelationType): RelationEntity[];

  // 置信度管理
  updateConfidence(relationId: string, confidence: number, source: 'rule' | 'embedding' | 'llm' | 'user'): void;

  // 扫描状态
  getLastScanTimestamp(): number;
  updateScanState(docId: string, contentHash: string): void;
}
```

### 5.2 批量写入优化

冷启动扫描涉及大量关系批量入库，需要利用 SQLite 事务和 better-sqlite3 的同步 API 优势：

```typescript
class SqliteRelationRepository implements IRelationRepository {
  upsertRelationsBatch(relations: RelationEntity[]): void {
    // better-sqlite3 的 transaction() 自动包装事务
    const upsertMany = this.db.transaction((rels: RelationEntity[]) => {
      const stmt = this.db.prepare(`
        INSERT INTO relations (source_id, target_id, type, confidence, discovered_by)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT (source_id, target_id, type)
        DO UPDATE SET confidence = excluded.confidence,
                      discovered_by = excluded.discovered_by,
                      updated_at = CURRENT_TIMESTAMP
      `);
      for (const rel of rels) {
        stmt.run(rel.sourceId, rel.targetId, rel.type, rel.confidence, rel.discoveredBy);
      }
    });
    upsertMany(relations); // 单事务批量执行，性能 ~10x 优于逐条
  }
}
```

_置信度：**HIGH** — 基于 TR1 确认的 SQLite + better-sqlite3 方案和 Repository Pattern_

## 6. 事件驱动集成：文件变更 → 增量更新

### 6.1 MCP Server 常驻模式的事件流

```
文件系统事件 (chokidar)
  → FileWatcher
  → 事件过滤（.md 文件 + gitignore 排除）
  → ScanService.scanIncremental([changedFile])
  → remark 管道重解析
  → RuleEngine.execute()
  → EmbeddingProvider.embed()（可选）
  → RelationRepository.upsertRelationsBatch()
  → 通知层（MCP notification / CLI 输出）
```

### 6.2 IDE Hooks 触发集成（TR4 已设计）

```typescript
// Claude Code PostToolUse Hook 触发增量扫描
// 当 AI 修改了 Markdown 文件后自动更新关系
{
  event: 'PostToolUse',
  hooks: [{
    type: 'command',
    command: 'cord scan --incremental --changed-file "$TOOL_INPUT_FILE"'
  }]
}
```

_置信度：**MEDIUM-HIGH** — 基于 TR4 IDE Hooks 架构和 chokidar 文件监控方案_

## 7. 置信度与反馈集成

### 7.1 置信度聚合协议

当多个来源（规则 / Embedding / LLM / 用户）对同一关系给出不同置信度时，采用加权聚合：

```typescript
interface ConfidenceSource {
  source: 'rule' | 'embedding' | 'llm' | 'user';
  confidence: number;  // 0.0 - 1.0
  weight: number;       // 来源权重
}

function aggregateConfidence(sources: ConfidenceSource[]): number {
  // 用户反馈具有最高优先级（覆盖式）
  const userSource = sources.find(s => s.source === 'user');
  if (userSource) return userSource.confidence;

  // 其他来源加权平均
  const totalWeight = sources.reduce((sum, s) => sum + s.weight, 0);
  const weightedSum = sources.reduce((sum, s) => sum + s.confidence * s.weight, 0);
  return weightedSum / totalWeight;
}

// 默认权重配置
const DEFAULT_WEIGHTS = {
  rule: 1.0,       // 规则发现——确定性高
  embedding: 0.6,  // 语义相似度——参考性
  llm: 0.8,        // LLM 推断——较可靠
  user: Infinity   // 用户校正——绝对覆盖
};
```

### 7.2 用户反馈回路接口

```typescript
// MCP Tool: 用户确认/拒绝/修正关系
server.tool('cord_confirm_relation', {
  relationId: z.string(),
  action: z.enum(['confirm', 'reject', 'retype']),
  newType: z.string().optional()  // action='retype' 时的新类型
});

// CLI 命令: cord review
program
  .command('review')
  .description('交互式审查低置信度关系')
  .option('--threshold <n>', '审查阈值', '0.7')
  .action(async (options) => {
    const lowConfidence = await relationRepo
      .getRelationsBelowConfidence(options.threshold);
    // @clack/prompts 逐条展示，用户 confirm/reject/retype
  });
```

_置信度：**MEDIUM** — 置信度聚合算法为设计方案，需实际场景验证权重参数_

## 8. 集成模式总结

| 集成点 | 模式 | 通信协议 | 数据格式 |
|--------|------|---------|---------|
| remark 插件 ↔ 插件 | Pipeline + VFile 数据总线 | 函数调用（同步） | mdast AST + VFile.data |
| CLI ↔ Service 层 | 依赖注入 | 函数调用（异步） | TypeScript 接口 |
| MCP Server ↔ Service 层 | 依赖注入 | 函数调用（异步） | TypeScript 接口 |
| Service ↔ Embedding Provider | Strategy Pattern | HTTP/本地推理 | Float32Array |
| Service ↔ Repository | Repository Pattern | 函数调用（同步） | Entity 对象 |
| Repository ↔ SQLite | better-sqlite3 直连 | 同步 API | SQL 语句 |
| FileWatcher ↔ ScanService | Observer Pattern | 事件回调 | 文件路径列表 |
| IDE Hooks ↔ CLI | Shell Command | Stdio | 命令行参数 |
| 用户 ↔ 置信度系统 | 反馈回路 | MCP Tool / CLI | JSON / 交互式 |

---

**集成模式分析完成日期：** 2026-04-01

---

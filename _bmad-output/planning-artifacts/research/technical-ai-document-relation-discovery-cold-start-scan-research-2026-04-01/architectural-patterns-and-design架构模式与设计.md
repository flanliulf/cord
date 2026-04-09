# Architectural Patterns and Design（架构模式与设计）

本节从 CORD 冷启动扫描器的全局视角出发，分析系统级架构模式、设计原则、可扩展性策略和数据架构决策。所有模式选择均基于前序研究（TR1-TR5）已确认的技术约束和 Step 2-3 的技术栈/集成分析结论。

## 1. 系统架构模式

### 1.1 主架构：分层架构（Layered Architecture）

CORD 冷启动扫描器继承 TR5 已确认的五层分层架构，并在此基础上为关系发现引擎细化每层职责：

```
┌─────────────────────────────────────────────────────────┐
│  Layer 1: Entry Layer（入口层）                          │
│  ┌─────────────┐  ┌──────────────────────────────────┐ │
│  │ CLI (cord)   │  │ MCP Server (@modelcontextprotocol)│ │
│  │ cord scan    │  │ cord_scan / cord_discover tools   │ │
│  └──────┬──────┘  └──────────────┬───────────────────┘ │
│         └────────────┬───────────┘                      │
├──────────────────────┼──────────────────────────────────┤
│  Layer 2: Command Layer（命令层）                        │
│  ┌───────────────────┴──────────────────────────────┐  │
│  │ ScanCommand / DiscoverCommand / ReviewCommand     │  │
│  │ 参数校验 · 进度展示 · 结果格式化                     │  │
│  └───────────────────┬──────────────────────────────┘  │
├──────────────────────┼──────────────────────────────────┤
│  Layer 3: Service Layer（服务层）⭐ 核心                 │
│  ┌───────────────────┴──────────────────────────────┐  │
│  │ ScanService        — 扫描编排                      │  │
│  │ DocumentParserService — remark 管道调度             │  │
│  │ RelationDiscoveryService — 关系发现编排              │  │
│  │   ├── RuleEngine      — 规则执行引擎               │  │
│  │   ├── EmbeddingService — 语义相似度计算             │  │
│  │   └── LLMService      — LLM 推断（可选）           │  │
│  │ ConfidenceService  — 置信度聚合                    │  │
│  │ FeedbackService    — 用户反馈处理                   │  │
│  └───────────────────┬──────────────────────────────┘  │
├──────────────────────┼──────────────────────────────────┤
│  Layer 4: Repository Layer（数据仓库层）                 │
│  ┌───────────────────┴──────────────────────────────┐  │
│  │ IDocumentRepository — 文档 CRUD + 内容哈希管理      │  │
│  │ IRelationRepository — 关系图谱 CRUD + 批量操作      │  │
│  │ IScanStateRepository — 扫描状态追踪                 │  │
│  └───────────────────┬──────────────────────────────┘  │
├──────────────────────┼──────────────────────────────────┤
│  Layer 5: Infrastructure Layer（基础设施层）              │
│  ┌───────────────────┴──────────────────────────────┐  │
│  │ SQLiteDatabase     — better-sqlite3 连接管理       │  │
│  │ FileSystem         — fast-glob / chokidar          │  │
│  │ EmbeddingProvider  — Transformers.js / Ollama / API│  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**分层约束规则**：
- ✅ 上层只能依赖直接下层（不可跨层调用）
- ✅ 下层对上层完全无感知
- ✅ 每层通过 TypeScript 接口（interface）定义契约
- ✅ 依赖注入容器管理实例化（可考虑 tsyringe 或手动 DI）

_置信度：**HIGH** — 基于 TR5 已确认的分层架构和本研究 Step 3 的集成分析_

### 1.2 子架构 A：管道架构（Pipeline Architecture）

文档解析子系统采用 **管道 + 过滤器（Pipes and Filters）** 模式，这是 unified.js 的原生架构：

```
Input: Markdown 文件内容
  │
  ▼
┌──────────────┐   ┌──────────────────────┐   ┌───────────────────┐
│ remark-parse │ → │ remark-frontmatter   │ → │ cord-frontmatter  │
│ (Parser)     │   │ (AST Transformer)    │   │ -parser           │
└──────────────┘   └──────────────────────┘   └────────┬──────────┘
                                                       │
  ┌────────────────────────────────────────────────────┘
  ▼
┌───────────────────┐   ┌───────────────────┐   ┌──────────────────┐
│ cord-heading      │ → │ cord-link         │ → │ cord-relation    │
│ -extractor        │   │ -extractor        │   │ -analyzer (🆕)   │
└───────────────────┘   └───────────────────┘   └────────┬─────────┘
                                                         │
  ┌──────────────────────────────────────────────────────┘
  ▼
Output: VFile.data {
  cordFrontmatter, cordHeadings, cordLinks, cordRelations
}
```

**管道架构优势**：
| 优势 | 说明 |
|------|------|
| 可组合性 | 插件可自由组合，按需启用/禁用 |
| 可测试性 | 每个插件独立单元测试，输入 AST → 输出 VFile.data |
| 可扩展性 | 新增规则只需添加新插件，不修改现有代码 |
| 关注点分离 | 每个插件只做一件事（Single Responsibility） |

_置信度：**HIGH** — unified.js 管道模式是成熟的工业实践_

### 1.3 子架构 B：策略架构（Strategy Architecture）

关系发现的三级方案（规则 / Embedding / LLM）采用 **策略模式** 封装，运行时动态选择：

```
RelationDiscoveryService
  │
  ├── IDiscoveryStrategy
  │     ├── RuleBasedStrategy      (Level 1 — 始终可用)
  │     ├── EmbeddingStrategy      (Level 2 — 需 Embedding Provider)
  │     └── LLMStrategy            (Level 3 — 需 LLM Provider)
  │
  └── StrategyOrchestrator
        ├── 检测可用策略
        ├── 按用户配置级别执行
        └── 合并多策略结果（置信度聚合）
```

```typescript
// 策略接口
interface IDiscoveryStrategy {
  readonly level: 1 | 2 | 3;
  readonly name: string;
  isAvailable(): Promise<boolean>;
  discover(context: DiscoveryContext): Promise<RelationCandidate[]>;
}

// 编排器：渐进增强模式
class StrategyOrchestrator {
  async discover(context: DiscoveryContext, maxLevel: 1 | 2 | 3): Promise<RelationCandidate[]> {
    const results: RelationCandidate[] = [];

    // Level 1: 规则引擎（始终执行）
    results.push(...await this.ruleStrategy.discover(context));

    // Level 2: Embedding 相似度（仅当 maxLevel >= 2 且可用时）
    if (maxLevel >= 2 && await this.embeddingStrategy.isAvailable()) {
      const embeddingResults = await this.embeddingStrategy.discover(context);
      results.push(...embeddingResults);
    }

    // Level 3: LLM 推断（仅当 maxLevel >= 3 且可用时）
    if (maxLevel >= 3 && await this.llmStrategy.isAvailable()) {
      const llmResults = await this.llmStrategy.discover(context);
      results.push(...llmResults);
    }

    return this.deduplicateAndMerge(results);
  }
}
```

**策略模式的设计决策**：
- **渐进增强而非互斥选择**：Level 2/3 的结果叠加在 Level 1 之上，不是替代
- **独立可用性检测**：每个策略自行判断是否可用（API Key？Ollama 运行中？）
- **结果去重与合并**：相同 source-target-type 的关系取最高置信度

_置信度：**HIGH** — 策略模式 + 渐进增强是 CORD Local-First 约束下的最优解_

## 2. 设计原则

### 2.1 渐进增强原则（Progressive Enhancement）

CORD 冷启动扫描器的核心设计哲学——**零配置可用，逐级增强**：

```
Level 0: cord init           → 注册项目，零扫描
Level 1: cord scan            → 纯规则扫描（零外部依赖，即开即用）
Level 2: cord scan --level embedding → 规则 + 本地 Embedding（首次需下载模型 ~22MB）
Level 3: cord scan --level llm       → 规则 + Embedding + LLM 推断（需 API Key 或 Ollama）
```

| 级别 | 依赖 | 首次延迟 | 准确率（估算） | 场景 |
|------|------|---------|-------------|------|
| Level 1 | 零 | <3s（100 docs） | ~70% | 日常使用、CI/CD |
| Level 2 | Transformers.js 模型 | <10s（含模型加载） | ~85% | 深度分析 |
| Level 3 | API Key / Ollama | <30s（含 LLM 调用） | ~95% | 全面发现 |

_置信度：**MEDIUM** — 准确率为估算值，需实际场景基准测试验证_

### 2.2 Local-First 原则

所有核心功能必须在完全离线环境下可用：

| 功能 | 离线可用 | 说明 |
|------|---------|------|
| 规则扫描 | ✅ | 纯本地文件系统 + SQLite |
| Embedding 相似度 | ✅ | Transformers.js 本地推理（模型需预下载） |
| LLM 推断 | 🟡 | Ollama 本地可用；云端 API 需网络 |
| 数据存储 | ✅ | SQLite 嵌入式数据库 |
| 关系查询 | ✅ | 纯 SQLite 查询 |
| 用户反馈 | ✅ | 直接写入 SQLite |

### 2.3 SOLID 原则应用

| 原则 | CORD 冷启动扫描器中的体现 |
|------|--------------------------|
| **S** — 单一职责 | 每个 remark 插件只负责一种提取；每个 Rule 只识别一种模式 |
| **O** — 开放封闭 | RuleEngine 对新规则开放（register），对已有规则封闭（不修改） |
| **L** — 里氏替换 | 所有 IEmbeddingProvider 实现可互换；所有 IDiscoveryStrategy 可互换 |
| **I** — 接口隔离 | IDocumentRepository / IRelationRepository / IScanStateRepository 各自独立 |
| **D** — 依赖反转 | Service 层依赖 Repository 接口，不依赖 SQLite 具体实现 |

_置信度：**HIGH** — SOLID 原则在 TR1/TR5 架构中已有先例验证_

## 3. 冷启动扫描器状态机架构

冷启动扫描是一个多阶段过程，采用 **状态机（State Machine）** 模式管理：

```
┌──────────┐     ┌──────────┐     ┌──────────────┐     ┌───────────┐
│  IDLE    │────→│ DISCOVER │────→│ PARSE        │────→│ ANALYZE   │
│          │     │ FILES    │     │ DOCUMENTS    │     │ RELATIONS │
└──────────┘     └──────────┘     └──────────────┘     └─────┬─────┘
                                                             │
     ┌───────────┐     ┌──────────┐     ┌──────────────┐    │
     │ COMPLETE  │←────│ PERSIST  │←────│ AGGREGATE    │←───┘
     │           │     │ RESULTS  │     │ CONFIDENCE   │
     └───────────┘     └──────────┘     └──────────────┘
```

**各阶段职责**：

| 阶段 | 输入 | 处理 | 输出 | 性能目标 |
|------|------|------|------|---------|
| **DISCOVER_FILES** | 项目根路径 | fast-glob 扫描 + gitignore 过滤 | 文件路径列表 | <500ms（1000 files） |
| **PARSE_DOCUMENTS** | 文件路径列表 | remark 管道批量解析 | VFile.data 数组 | <3s（100 docs） |
| **ANALYZE_RELATIONS** | VFile.data + 全局上下文 | RuleEngine + Embedding + LLM | RelationCandidate[] | <5s（Level 1）|
| **AGGREGATE_CONFIDENCE** | RelationCandidate[] | 置信度聚合 + 去重 | RelationEntity[] | <100ms |
| **PERSIST_RESULTS** | RelationEntity[] | 批量 UPSERT 入 SQLite | 持久化完成 | <500ms |
| **COMPLETE** | — | 统计报告生成 | ScanReport | <50ms |

**性能总目标**：100 文档全量冷启动扫描（Level 1）< 10s ✅

_置信度：**HIGH** — 基于 TR1 性能约束和各阶段工具的已知性能特征_

## 4. 数据架构模式

### 4.1 关系图谱数据模型

CORD 使用 SQLite 的 **邻接表模型（Adjacency List）** 存储关系图谱，这是 TR1 已确认的方案：

```sql
-- 文档表（节点）
CREATE TABLE documents (
  id TEXT PRIMARY KEY,          -- 文件相对路径（归一化）
  title TEXT,                    -- 文档标题（首个 H1）
  content_hash TEXT NOT NULL,    -- SHA-256 内容哈希
  doc_type TEXT,                 -- 文档类型标签
  last_scanned_at INTEGER,       -- 最后扫描时间戳
  metadata TEXT                  -- JSON 扩展元数据
);

-- 关系表（边）
CREATE TABLE relations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id TEXT NOT NULL REFERENCES documents(id),
  target_id TEXT NOT NULL REFERENCES documents(id),
  type TEXT NOT NULL,             -- 9 种关系类型之一
  confidence REAL NOT NULL DEFAULT 1.0,  -- 0.0-1.0
  discovered_by TEXT NOT NULL,    -- 'rule' | 'embedding' | 'llm' | 'user'
  rule_id TEXT,                   -- 发现此关系的规则 ID
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(source_id, target_id, type)
);

-- 扫描状态表
CREATE TABLE scan_state (
  doc_id TEXT PRIMARY KEY REFERENCES documents(id),
  content_hash TEXT NOT NULL,     -- 上次扫描时的内容哈希
  scanned_at INTEGER NOT NULL,
  scan_level INTEGER NOT NULL DEFAULT 1  -- 上次扫描级别
);
```

**索引策略**：
```sql
CREATE INDEX idx_relations_source ON relations(source_id);
CREATE INDEX idx_relations_target ON relations(target_id);
CREATE INDEX idx_relations_type ON relations(type);
CREATE INDEX idx_relations_confidence ON relations(confidence);
CREATE INDEX idx_scan_state_hash ON scan_state(content_hash);
```

### 4.2 增量扫描数据流

```
cord scan（增量模式）
  │
  ├─ 1. 读取 scan_state 表获取所有已知文档的 content_hash
  ├─ 2. fast-glob 扫描获取当前文件列表
  ├─ 3. 对比：
  │     ├─ 新增文件 → 标记为 ADDED
  │     ├─ content_hash 变化 → 标记为 MODIFIED
  │     ├─ 文件不存在 → 标记为 DELETED
  │     └─ content_hash 相同 → 标记为 UNCHANGED（跳过）
  ├─ 4. 仅对 ADDED + MODIFIED 文件执行 remark 解析 + 关系分析
  ├─ 5. 对 DELETED 文件清理相关关系
  └─ 6. 更新 scan_state 表
```

**增量效率估算**：

| 场景 | 全量扫描 | 增量扫描 | 加速比 |
|------|---------|---------|--------|
| 100 docs，改 1 个 | ~5s | ~200ms | 25x |
| 500 docs，改 5 个 | ~25s | ~500ms | 50x |
| 1000 docs，改 10 个 | ~50s | ~800ms | 62x |

_置信度：**MEDIUM-HIGH** — 效率估算基于工具已知性能特征，实际值需基准测试_

## 5. 可扩展性架构模式

### 5.1 框架适配器模式（Adapter Pattern）

CORD 通过 **适配器模式** 支持不同项目框架的文档结构识别：

```typescript
// 框架适配器接口
interface IFrameworkAdapter {
  readonly frameworkId: string;
  readonly displayName: string;

  // 检测项目是否使用此框架
  detect(projectRoot: string): Promise<boolean>;

  // 返回此框架的预设关系规则
  getPresetRules(): IRelationRule[];

  // 返回此框架的文档类型映射
  getDocTypeMapping(): Map<string, DocTypePattern>;
}

// BMAD-Method 适配器（参考实现）
class BmadFrameworkAdapter implements IFrameworkAdapter {
  readonly frameworkId = 'bmad-method';
  readonly displayName = 'BMAD Method';

  async detect(root: string): Promise<boolean> {
    return existsSync(join(root, '_bmad'));
  }

  getPresetRules(): IRelationRule[] {
    return [
      new BmadDocumentChainRule(),    // Product Brief → PRD → Epics → Stories
      new BmadLifecycleRule(),        // 文档生命周期绑定
      new BmadDerivedFromRule(),      // 派生关系（PRD → Epic → Story）
    ];
  }

  getDocTypeMapping(): Map<string, DocTypePattern> {
    return new Map([
      ['product-brief', { glob: '**/product-brief*.md', type: 'product-brief' }],
      ['prd', { glob: '**/prd*.md', type: 'prd' }],
      ['epic', { glob: '**/epic*.md', type: 'epic' }],
      ['story', { glob: '**/story*.md', type: 'story' }],
      ['architecture', { glob: '**/architecture*.md', type: 'architecture' }],
    ]);
  }
}
```

**适配器注册机制**：
```typescript
class FrameworkRegistry {
  private adapters: IFrameworkAdapter[] = [];

  register(adapter: IFrameworkAdapter): void {
    this.adapters.push(adapter);
  }

  // 自动检测项目使用的框架
  async detectFrameworks(projectRoot: string): Promise<IFrameworkAdapter[]> {
    const detected: IFrameworkAdapter[] = [];
    for (const adapter of this.adapters) {
      if (await adapter.detect(projectRoot)) {
        detected.push(adapter);
      }
    }
    return detected;
  }
}
```

**内置适配器清单**：

| 适配器 | 检测方式 | 预设规则数 | 优先级 |
|--------|---------|----------|--------|
| **BMAD-Method** | `_bmad/` 目录存在 | 3-5 条 | MVP Phase 1 |
| **通用 Markdown** | 默认（无检测条件） | 2-3 条 | MVP Phase 1 |
| **React/Next.js** | `package.json` 含 react | 2-3 条 | V1.0 扩展 |
| **Vue/Nuxt** | `package.json` 含 vue | 2-3 条 | V1.0 扩展 |
| **Spring Boot** | `pom.xml` / `build.gradle` | 2-3 条 | V1.0 扩展 |

_置信度：**HIGH** — 适配器模式是 TR4 已验证的跨 IDE 兼容性方案的延伸_

### 5.2 用户自定义规则扩展点

```typescript
// cord.config.ts — 用户自定义规则
export default {
  rules: [
    {
      id: 'my-custom-rule',
      name: 'My Custom Naming Rule',
      priority: 50,
      category: 'naming',
      pattern: /^spec-(.+)\.md$/,
      targetPattern: 'impl-$1.md',
      relationType: 'must_consistent',
      confidence: 0.8,
    }
  ],
  frameworks: ['bmad-method'],  // 启用的框架适配器
  scan: {
    defaultLevel: 'rules',       // 默认扫描级别
    include: ['docs/**/*.md', '*.md'],
    exclude: ['node_modules', '.git', 'dist'],
  }
};
```

_置信度：**MEDIUM-HIGH** — 配置文件设计方案，具体语法需在实现阶段确定_

## 6. 安全与隐私架构

### 6.1 数据安全模型

| 安全关注点 | 设计决策 | 说明 |
|-----------|---------|------|
| **文档内容不上传** | ✅ Local-First | 规则/Embedding 分析完全本地执行 |
| **云端 LLM 最小暴露** | ✅ 仅发送摘要 | Level 3 仅发送文档标题 + 摘要，不发送全文 |
| **API Key 安全** | ✅ 环境变量 | `CORD_OPENAI_API_KEY` 通过环境变量注入 |
| **SQLite 数据库** | ✅ 本地文件 | `.cord/cord.db` 在项目目录内，不外传 |
| **扫描范围限制** | ✅ gitignore 尊重 | 默认排除 `.env`、`credentials` 等敏感文件 |

### 6.2 LLM 数据最小化原则

```typescript
// Level 3 LLM 调用时，仅发送文档摘要，不发送全文
function buildLLMPrompt(doc: DocumentMeta, candidates: DocumentMeta[]): string {
  return `
    Source document:
    - Title: ${doc.title}
    - Type: ${doc.docType}
    - Headings: ${doc.headings.map(h => h.text).join(', ')}
    - Frontmatter keys: ${Object.keys(doc.frontmatter).join(', ')}

    Candidate documents:
    ${candidates.map(c => `- ${c.title} (${c.docType})`).join('\n')}

    What relationships exist between the source and candidates?
    Respond in JSON: [{ target, type, confidence, reasoning }]
  `;
}
```

_置信度：**HIGH** — 数据最小化是 Local-First 架构的直接推论_

## 7. 架构模式总结与决策矩阵

| 架构层面 | 选定模式 | 备选方案 | 选择理由 |
|---------|---------|---------|---------|
| **整体架构** | 五层分层架构 | Clean Architecture | TR5 已确认，团队已熟悉 |
| **解析子系统** | 管道 + 过滤器 | 责任链 | unified.js 原生模式，生态兼容 |
| **关系发现** | 策略模式 + 渐进增强 | 模板方法 | 三级方案运行时动态选择 |
| **框架适配** | 适配器模式 + 注册表 | 工厂方法 | 支持自动检测 + 用户显式配置 |
| **文件监控** | 观察者模式 | 轮询 | chokidar 事件驱动，实时响应 |
| **数据模型** | 邻接表（SQLite） | 图数据库 | TR1 已否决 Kuzu，SQLite 性能充足 |
| **扫描流程** | 状态机 | 简单顺序 | 清晰的阶段划分，便于进度报告和错误恢复 |
| **置信度** | 加权聚合 + 用户覆盖 | 投票制 | 支持多源融合和用户最终决策权 |
| **配置管理** | 配置文件 + 环境变量 | 纯 CLI 参数 | 支持持久化配置和 CI/CD 场景 |

---

**架构模式分析完成日期：** 2026-04-01

---

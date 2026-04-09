# Integration Patterns Analysis（集成模式分析）

本节聚焦 BMAD 适配器模块与 CORD 核心系统的集成接口设计：适配器如何嵌入冷启动扫描管道、如何与规则引擎协作、如何向 `RelationDiscoveryService` 提供框架特有的关系规则、以及如何通过 `FrameworkRegistry` 实现自动检测和注册。

## 1. 核心集成接口：IFrameworkAdapter

### 1.1 接口规格（继承 TR6 设计）

BMAD 适配器实现 TR6 已定义的 `IFrameworkAdapter` 接口，作为框架适配层的首个参考实现：

```typescript
// TR6 已定义的框架适配器接口
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
```

### 1.2 BMAD 适配器的接口实现要求

BMAD 适配器需在 `IFrameworkAdapter` 的三个方法中注入 BMAD 特有的逻辑：

| 方法 | BMAD 实现要点 | 输入 | 输出 |
|------|-------------|------|------|
| `detect()` | 检查 `_bmad/` + `_bmad/core/` + `_bmad/bmm/config.yaml` | 项目根路径 | `boolean`（98% 置信度组合检测） |
| `getPresetRules()` | 返回 BMAD 文档产出链的 5-8 条预设规则 | — | `IRelationRule[]` |
| `getDocTypeMapping()` | 返回 18 种文档类型的 glob + frontmatter 检测模式 | — | `Map<string, DocTypePattern>` |

**关键设计决策**：`IFrameworkAdapter` 接口是**无状态**的——它不持有项目数据，仅提供检测逻辑和规则定义。实际的关系发现执行由 `RuleEngine` 驱动。

_置信度：**HIGH** — 接口设计直接继承 TR6 已验证的架构_

### 1.3 扩展接口：IFrameworkAdapterV2（BMAD 专属增强）

BMAD 框架的结构化程度远超通用 Markdown 项目，需要在基础接口之上扩展 BMAD 特有能力：

```typescript
// BMAD 适配器扩展接口（向下兼容 IFrameworkAdapter）
interface IBmadFrameworkAdapter extends IFrameworkAdapter {
  // BMAD 特有：读取 config.yaml 获取输出目录配置
  getOutputConfig(projectRoot: string): Promise<BmadOutputConfig>;

  // BMAD 特有：获取文档产出链的阶段拓扑
  getPhaseTopology(): BmadPhaseTopology;

  // BMAD 特有：解析 module-help.csv 获取工作流依赖关系
  getWorkflowDependencies(): BmadWorkflowDependency[];

  // BMAD 特有：获取 BMAD 版本号
  getVersion(projectRoot: string): Promise<string | null>;
}

interface BmadOutputConfig {
  outputFolder: string;           // _bmad-output/
  planningArtifacts: string;      // _bmad-output/planning-artifacts/
  implementationArtifacts: string; // _bmad-output/implementation-artifacts/
  projectKnowledge: string;        // docs/
  brainstorming: string;           // _bmad-output/brainstorming/
}

interface BmadPhaseTopology {
  phases: BmadPhase[];
  transitions: BmadPhaseTransition[];
}

interface BmadPhase {
  id: 1 | 2 | 3 | 4;
  name: string;
  docTypes: string[];  // 该阶段产出的文档类型 ID
}

interface BmadPhaseTransition {
  from: number;  // 阶段编号
  to: number;
  requiredDocs: string[];  // 必须完成的文档类型
  optionalDocs: string[];
}
```

**设计理由**：扩展接口通过 `extends` 继承基础接口，确保 BMAD 适配器可以作为普通 `IFrameworkAdapter` 使用（供 `FrameworkRegistry` 统一管理），同时在 BMAD 特有场景中暴露更丰富的元数据。

_置信度：**HIGH** — 接口扩展模式是 TypeScript 最佳实践_

## 2. FrameworkRegistry 注册与自动检测集成

### 2.1 注册时序

BMAD 适配器在 CORD 启动时通过 `FrameworkRegistry` 注册：

```
CORD 启动
  → FrameworkRegistry.registerBuiltIn()
    → registry.register(new BmadFrameworkAdapter())    ← BMAD 适配器注册
    → registry.register(new GenericMarkdownAdapter())  ← 通用适配器注册
  → FrameworkRegistry.detectFrameworks(projectRoot)
    → 逐个调用 adapter.detect()
    → 返回检测到的框架列表
  → 将检测到的框架的 getPresetRules() 注入 RuleEngine
```

### 2.2 自动检测与手动配置的优先级

```typescript
// cord.config.ts 中的框架配置
interface FrameworkConfig {
  // 自动检测（默认启用）
  autoDetect: boolean;

  // 显式启用/禁用特定框架（覆盖自动检测）
  frameworks: {
    'bmad-method'?: boolean | BmadAdapterOptions;
    'generic-markdown'?: boolean;
  };
}

interface BmadAdapterOptions {
  // 自定义 BMAD 输出目录（覆盖 config.yaml 中的配置）
  outputFolder?: string;
  // 启用的阶段（默认全部）
  enabledPhases?: number[];
  // 自定义文档类型规则（追加）
  customDocTypes?: DocTypePattern[];
}
```

**优先级链**：用户显式配置 > 自动检测结果 > 默认值

_置信度：**HIGH** — 配置覆盖模式是 CLI 工具的标准实践_

## 3. remark 管道集成：cord-relation-analyzer 插件

### 3.1 BMAD 适配器在 remark 管道中的位置

BMAD 适配器不直接作为 remark 插件存在，而是通过 `cord-relation-analyzer` 插件间接集成。管道中的数据流：

```
文件内容
  → remark-parse（text → mdast）
  → remark-frontmatter（Frontmatter AST 节点）
  → cord-frontmatter-parser（提取 CORD 关系声明 + BMAD 元数据）
  → cord-heading-extractor（章节锚点提取）
  → cord-link-extractor（链接/引用提取）
  → cord-relation-analyzer（🎯 BMAD 适配器在此介入）
  → VFile.data（结构化输出）
```

### 3.2 cord-frontmatter-parser 中的 BMAD 数据提取

`cord-frontmatter-parser` 插件需要识别 BMAD 特有的 frontmatter 字段并写入 `VFile.data`：

```typescript
// cord-frontmatter-parser 插件中的 BMAD 数据提取逻辑
function cordFrontmatterParser(options: { adapters: IFrameworkAdapter[] }) {
  return (tree: Root, file: VFile) => {
    const frontmatter = file.data.cordFrontmatter as Record<string, unknown>;
    if (!frontmatter) return;

    // 通用数据提取（所有框架共享）
    file.data.cordMeta = {
      title: extractTitle(tree),
      frontmatter,
    };

    // BMAD 特有数据提取（当检测到 BMAD 框架时）
    if (frontmatter.workflowType || frontmatter.research_type
        || frontmatter.session_topic) {
      file.data.cordBmad = {
        workflowType: frontmatter.workflowType as string | undefined,
        researchType: frontmatter.research_type as string | undefined,
        stepsCompleted: frontmatter.stepsCompleted as number[] | undefined,
        inputDocuments: frontmatter.inputDocuments as string[] | undefined,
        sessionTopic: frontmatter.session_topic as string | undefined,
        techniquesUsed: frontmatter.techniques_used as string[] | undefined,
        productName: frontmatter.product_name as string | undefined,
      };
    }
  };
}
```

**VFile.data 命名空间约定**：

| 命名空间 | 写入者 | 说明 |
|---------|--------|------|
| `file.data.cordLinks` | cord-link-extractor | 提取的链接列表 |
| `file.data.cordHeadings` | cord-heading-extractor | 提取的标题层级 |
| `file.data.cordFrontmatter` | cord-frontmatter-parser | 原始 frontmatter 数据 |
| `file.data.cordMeta` | cord-frontmatter-parser | 通用文档元数据 |
| `file.data.cordBmad` | cord-frontmatter-parser | **BMAD 特有元数据** |
| `file.data.cordRelations` | cord-relation-analyzer | 发现的关系候选列表 |

_置信度：**HIGH** — VFile.data 数据总线模式已在 TR3/TR6 中验证_

### 3.3 cord-relation-analyzer 中的框架规则执行

`cord-relation-analyzer` 是管道中最后一个分析插件，负责调用 `RuleEngine` 执行所有规则（包括 BMAD 预设规则）：

```typescript
function cordRelationAnalyzer(options: {
  ruleEngine: RuleEngine;
  allDocs: DocumentMeta[];
  projectConfig: ProjectConfig;
}) {
  return (tree: Root, file: VFile) => {
    const context: RuleExecutionContext = {
      sourceDoc: buildDocumentMeta(file),
      allDocs: options.allDocs,
      astData: file.data,
      projectConfig: options.projectConfig,
    };

    // RuleEngine 内部已包含 BMAD 预设规则
    const candidates = options.ruleEngine.execute(context);

    file.data.cordRelations = candidates;
  };
}
```

**关键点**：BMAD 适配器的规则通过 `RuleEngine.register()` 注入，`cord-relation-analyzer` 不需要直接了解 BMAD——它只调用 `RuleEngine`，实现了**框架无关性**。

_置信度：**HIGH** — 策略模式解耦，框架适配器对管道透明_

## 4. RuleEngine 集成：BMAD 预设规则注入

### 4.1 规则注入时序

```
FrameworkRegistry.detectFrameworks(projectRoot)
  → 检测到 BmadFrameworkAdapter
  → adapter.getPresetRules() 返回 BMAD 规则列表
  → RuleEngine.register(rule) 逐条注册
  → 规则按 priority 排序，BMAD 规则与通用规则混合执行
```

### 4.2 BMAD 预设规则与 RuleEngine 的接口契约

每条 BMAD 预设规则实现 TR6 已定义的 `IRelationRule` 接口：

```typescript
interface IRelationRule {
  readonly id: string;       // e.g., 'bmad-document-chain'
  readonly name: string;     // e.g., 'BMAD Document Chain Rule'
  readonly priority: number; // 执行优先级
  readonly category: 'structural' | 'naming' | 'content' | 'semantic';

  applies(doc: DocumentMeta): boolean;
  execute(context: RuleExecutionContext): RelationCandidate[];
}
```

**BMAD 规则的 `applies()` 判断逻辑**：

```typescript
// BMAD 规则仅对 BMAD 类型文档生效
applies(doc: DocumentMeta): boolean {
  // 方式 1：检查 VFile.data.cordBmad 是否存在
  // 方式 2：检查文档路径是否在 BMAD 输出目录下
  // 方式 3：检查文档已被识别为 BMAD 文档类型
  return doc.frameworkId === 'bmad-method'
    || doc.metadata?.cordBmad !== undefined;
}
```

**规则优先级分配约定**：

| 优先级范围 | 分配给 | 说明 |
|-----------|--------|------|
| 0-19 | 核心结构规则（link-forward、link-backlink） | 最高优先级，显式链接 |
| 20-39 | Frontmatter 规则（frontmatter-relations） | 显式声明 |
| 40-59 | **BMAD 预设规则** | 框架特有的推断规则 |
| 60-79 | 通用推断规则（directory、naming） | 通用启发式 |
| 80-99 | 用户自定义规则 | 最低优先级 |

_置信度：**HIGH** — 优先级分配延续 TR6 规则引擎设计_

## 5. inputDocuments 显式关系提取集成

### 5.1 最高价值集成点

`inputDocuments` 是 BMAD frontmatter 中最有价值的关系信号——它是 BMAD 工作流**自动生成**的文档引用列表，直接声明了"本文档源自哪些文档"：

```yaml
# PRD 的 frontmatter 示例
---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
inputDocuments:
  - '_bmad-output/planning-artifacts/research/technical-sqlite-vs-kuzu-research.md'
  - '_bmad-output/brainstorming/brainstorming-session-2026-03-29-001.md'
workflowType: 'prd'
---
```

### 5.2 集成接口

```typescript
// BMAD inputDocuments 规则
class BmadInputDocumentsRule implements IRelationRule {
  readonly id = 'bmad-input-documents';
  readonly name = 'BMAD Input Documents Reference';
  readonly priority = 25;  // 介于显式链接和框架规则之间
  readonly category = 'structural' as const;

  applies(doc: DocumentMeta): boolean {
    const bmadMeta = doc.metadata?.cordBmad;
    return bmadMeta?.inputDocuments !== undefined
      && bmadMeta.inputDocuments.length > 0;
  }

  execute(context: RuleExecutionContext): RelationCandidate[] {
    const inputDocs = context.sourceDoc.metadata?.cordBmad?.inputDocuments;
    if (!inputDocs) return [];

    return inputDocs
      .map(inputPath => {
        const targetDoc = context.allDocs.find(d =>
          d.relativePath === inputPath
          || d.relativePath.endsWith(inputPath)
        );
        if (!targetDoc) return null;

        return {
          sourceId: context.sourceDoc.id,
          targetId: targetDoc.id,
          type: 'derived_from' as RelationType,
          confidence: 1.0,         // 显式声明 = 最高置信度
          discoveredBy: 'rule',
          ruleId: this.id,
          metadata: {
            declaredIn: 'frontmatter.inputDocuments',
            framework: 'bmad-method',
          },
        };
      })
      .filter(Boolean) as RelationCandidate[];
  }
}
```

**关键价值**：`inputDocuments` 是**零推测、零歧义**的关系来源——BMAD 工作流在创建文档时自动写入引用列表，CORD 直接读取即可，无需任何启发式推断。置信度固定为 1.0。

_置信度：**HIGH** — 基于 CORD 项目中实际 BMAD 输出文件的 frontmatter 验证_

## 6. RelationDiscoveryService 集成

### 6.1 BMAD 适配器在关系发现服务中的位置

```
RelationDiscoveryService
  ├─ discoverByRules(doc)
  │   └─ RuleEngine.execute()
  │       ├─ 通用规则（link-forward, link-backlink, directory...）
  │       ├─ ★ BMAD 预设规则（document-chain, input-documents, lifecycle...）
  │       └─ 用户自定义规则
  ├─ discoverByEmbedding(doc)    ← BMAD 适配器不直接参与
  ├─ discoverByLLM(doc)          ← BMAD 适配器不直接参与
  └─ mergeResults(ruleR, embR, llmR)
      └─ 置信度聚合（BMAD 规则发现的关系 confidence=0.85-1.0）
```

### 6.2 BMAD 规则与 Embedding/LLM 的协作模式

BMAD 预设规则发现的关系具有高置信度（0.85-1.0），在 `mergeResults()` 聚合时：

| 场景 | 处理方式 |
|------|---------|
| BMAD 规则 + Embedding 都发现同一关系 | 置信度加权聚合（取更高值） |
| 仅 BMAD 规则发现（无 Embedding 确认） | 直接采用规则置信度（0.85-1.0） |
| 仅 Embedding 发现（非 BMAD 文档对） | 正常 Embedding 置信度（0.3-0.8） |
| BMAD 规则发现 + 用户拒绝 | 用户覆盖，置信度设为 0 |

**设计原则**：BMAD 预设规则因基于框架约定（非启发式猜测），其置信度天然高于通用规则。`inputDocuments` 规则更是达到 1.0（等同于显式 frontmatter 声明）。

_置信度：**HIGH** — 置信度聚合协议继承 TR6 已验证的设计_

## 7. SQLite 数据层集成

### 7.1 BMAD 文档类型在 documents 表中的表示

```sql
-- documents 表需要扩展以支持框架元数据
CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  relative_path TEXT UNIQUE NOT NULL,
  title TEXT,
  content_hash TEXT,
  doc_type TEXT,           -- BMAD 文档类型 ID (e.g., 'prd', 'story')
  framework_id TEXT,       -- 'bmad-method' | 'generic-markdown' | null
  phase INTEGER,           -- BMAD 阶段编号 (1-4) | null
  updated_at INTEGER,
  scanned_at INTEGER
);
```

### 7.2 BMAD 关系在 relations 表中的表示

```sql
-- relations 表中 BMAD 发现的关系记录
INSERT INTO relations (source_id, target_id, type, confidence, discovered_by, rule_id, metadata)
VALUES (
  'prd.md',                              -- 源文档
  'brainstorming-session-2026-03-29.md', -- 目标文档
  'derived_from',                         -- 关系类型
  1.0,                                    -- 置信度（inputDocuments = 1.0）
  'rule',                                 -- 发现方式
  'bmad-input-documents',                 -- 规则 ID
  '{"declaredIn":"frontmatter.inputDocuments","framework":"bmad-method"}'
);
```

_置信度：**HIGH** — 基于 TR1 已确认的 SQLite 三表设计_

## 8. CLI / MCP 双入口集成

### 8.1 CLI 集成（cord scan 输出增强）

当检测到 BMAD 框架时，`cord scan` 的输出应包含 BMAD 特有信息：

```
$ cord scan --full

📁 Project: CORD
🔧 Framework: BMAD Method v6.2.2

📊 Scan Results:
  Documents: 15 scanned (18 types recognized)
  Relations: 23 discovered

  Phase 1 (Analysis):     8 docs, 12 relations
  Phase 2 (Planning):     2 docs,  5 relations
  Phase 3 (Solutioning):  3 docs,  4 relations
  Phase 4 (Implementation): 2 docs, 2 relations

  🔗 Key Relations:
    brainstorming-session → product-brief  (informs, 0.85)
    product-brief → prd                    (derived_from, 1.0)
    prd → architecture                     (derived_from, 1.0)
    architecture → epics-and-stories       (derived_from, 1.0)
```

### 8.2 MCP Tool 集成（结构化 JSON 输出）

```typescript
// MCP Tool: cord_scan 输出中包含 BMAD 框架元数据
{
  content: [{
    type: 'text',
    text: JSON.stringify({
      project: 'CORD',
      frameworks: [{
        id: 'bmad-method',
        version: '6.2.2',
        phases: [
          { id: 1, name: 'Analysis', docCount: 8, relationCount: 12 },
          { id: 2, name: 'Planning', docCount: 2, relationCount: 5 },
          { id: 3, name: 'Solutioning', docCount: 3, relationCount: 4 },
          { id: 4, name: 'Implementation', docCount: 2, relationCount: 2 },
        ]
      }],
      totalDocuments: 15,
      totalRelations: 23,
      relations: [/* ... */]
    }, null, 2)
  }]
}
```

_置信度：**HIGH** — CLI/MCP 双入口模式继承 TR2/TR5 已验证的架构_

## 9. 事件驱动增量集成

### 9.1 BMAD 文档变更的增量扫描

当 BMAD 工作流产出新文档或修改现有文档时，CORD 通过 chokidar 或 IDE Hooks 触发增量扫描：

```
BMAD 工作流产出 prd.md
  → chokidar 检测到 _bmad-output/planning-artifacts/prd.md 变更
  → ScanService.scanIncremental(['prd.md'])
  → remark 管道重解析 prd.md
  → cord-frontmatter-parser 提取 inputDocuments
  → BmadInputDocumentsRule 发现 prd → brainstorming-session 关系
  → BmadDocumentChainRule 发现 prd → architecture 预期关系
  → RelationRepository.upsertRelationsBatch()
  → 通知层：新发现 2 条关系
```

### 9.2 BMAD 级联变更检测

当 PRD 被修改时，CORD 应检测下游文档（Architecture、Epics、Stories）是否需要同步更新：

```typescript
// 级联变更检测逻辑
async function detectCascadeChanges(
  changedDocId: string,
  relationRepo: IRelationRepository
): Promise<CascadeAlert[]> {
  const downstreamRelations = relationRepo.getRelationsFrom(changedDocId)
    .filter(r => r.type === 'derived_from' || r.type === 'must_consistent');

  return downstreamRelations.map(r => ({
    sourceDoc: changedDocId,
    affectedDoc: r.targetId,
    relationType: r.type,
    severity: r.confidence >= 0.9 ? 'high' : 'medium',
    message: `${changedDocId} 已变更，${r.targetId} 可能需要同步更新`,
  }));
}
```

_置信度：**HIGH** — 增量扫描和级联检测是 CORD 核心功能需求_

---

**集成模式分析完成日期：** 2026-04-02

---

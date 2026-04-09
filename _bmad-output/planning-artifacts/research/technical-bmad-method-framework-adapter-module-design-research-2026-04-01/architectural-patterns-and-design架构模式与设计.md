# Architectural Patterns and Design（架构模式与设计）

本节聚焦 `BmadFrameworkAdapter` 的完整架构设计——包括适配器内部结构、预设关系规则的声明式 DSL、文档产出链的关系拓扑模型、多版本兼容策略，以及为后续框架适配器树立的参考实现标杆。

## 1. 适配器内部架构

### 1.1 模块分解

`BmadFrameworkAdapter` 内部采用**职责分离**的模块化设计，将检测、规则、类型映射三大职责解耦：

```
BmadFrameworkAdapter/
  ├─ BmadDetector              ← 框架检测（detect）
  ├─ BmadDocTypeRegistry       ← 文档类型注册表（getDocTypeMapping）
  ├─ BmadRuleFactory           ← 预设规则工厂（getPresetRules）
  ├─ BmadConfigReader          ← config.yaml 读取（getOutputConfig）
  ├─ BmadPhaseModel            ← 阶段拓扑模型（getPhaseTopology）
  └─ rules/                    ← 预设规则实现
      ├─ BmadInputDocumentsRule
      ├─ BmadDocumentChainRule
      ├─ BmadPhaseGateRule
      ├─ BmadLifecycleRule
      └─ BmadNamingConventionRule
```

### 1.2 类图

```
┌─────────────────────────────────────────────────┐
│         «interface» IFrameworkAdapter            │
│  ─────────────────────────────────────────────── │
│  + frameworkId: string                           │
│  + displayName: string                           │
│  + detect(root): Promise<boolean>                │
│  + getPresetRules(): IRelationRule[]             │
│  + getDocTypeMapping(): Map<string,DocTypePattern>│
└──────────────────────┬──────────────────────────┘
                       │ extends
┌──────────────────────┴──────────────────────────┐
│       «interface» IBmadFrameworkAdapter           │
│  ─────────────────────────────────────────────── │
│  + getOutputConfig(root): Promise<BmadOutputConfig>│
│  + getPhaseTopology(): BmadPhaseTopology         │
│  + getWorkflowDependencies(): BmadWorkflowDep[]  │
│  + getVersion(root): Promise<string|null>        │
└──────────────────────┬──────────────────────────┘
                       │ implements
┌──────────────────────┴──────────────────────────┐
│            BmadFrameworkAdapter                   │
│  ─────────────────────────────────────────────── │
│  - detector: BmadDetector                        │
│  - docTypeRegistry: BmadDocTypeRegistry          │
│  - ruleFactory: BmadRuleFactory                  │
│  - configReader: BmadConfigReader                │
│  - phaseModel: BmadPhaseModel                    │
│  ─────────────────────────────────────────────── │
│  + detect(root): Promise<boolean>                │
│  + getPresetRules(): IRelationRule[]             │
│  + getDocTypeMapping(): Map<string,DocTypePattern>│
│  + getOutputConfig(root): Promise<BmadOutputConfig>│
│  + getPhaseTopology(): BmadPhaseTopology         │
│  + getWorkflowDependencies(): BmadWorkflowDep[]  │
│  + getVersion(root): Promise<string|null>        │
└─────────────────────────────────────────────────┘
```

_置信度：**HIGH** — 标准的接口继承 + 组合模式_

## 2. BmadDetector：框架检测设计

### 2.1 三层递进检测算法

```typescript
class BmadDetector {
  /**
   * 三层递进检测：
   * L1: _bmad/ 目录存在 → 初筛（95%）
   * L2: core/ + bmm/config.yaml 存在 → 确认（98%）
   * L3: config.yaml 版本注释解析 → 精确版本（99%）
   */
  async detect(projectRoot: string): Promise<BmadDetectResult> {
    const bmadDir = path.join(projectRoot, '_bmad');

    // L1: 根目录检测
    if (!await this.directoryExists(bmadDir)) {
      return { detected: false, confidence: 0 };
    }

    // L2: 核心结构验证
    const coreExists = await this.directoryExists(
      path.join(bmadDir, 'core'));
    const configExists = await this.fileExists(
      path.join(bmadDir, 'bmm', 'config.yaml'));

    if (!coreExists || !configExists) {
      return { detected: true, confidence: 0.5,
        note: '_bmad/ 存在但缺少核心结构，可能是非标准安装' };
    }

    // L3: 版本解析
    const version = await this.parseVersion(
      path.join(bmadDir, 'bmm', 'config.yaml'));

    return {
      detected: true,
      confidence: version ? 0.99 : 0.98,
      version,
      hasOutputDir: await this.directoryExists(
        path.join(projectRoot, '_bmad-output')),
    };
  }

  private async parseVersion(configPath: string): Promise<string | null> {
    try {
      const content = await fs.readFile(configPath, 'utf-8');
      const match = content.match(/# Version:\s*([\d.]+)/);
      return match ? match[1] : null;
    } catch { return null; }
  }
}

interface BmadDetectResult {
  detected: boolean;
  confidence: number;
  version?: string;
  hasOutputDir?: boolean;
  note?: string;
}
```

_置信度：**HIGH** — 基于实际 BMAD v6.2.2 目录结构验证_

## 3. BmadDocTypeRegistry：文档类型注册表设计

### 3.1 声明式文档类型定义

采用**声明式配置**而非硬编码方式定义 18 种文档类型，便于后续版本适配和用户扩展：

```typescript
interface DocTypeDefinition {
  id: string;                    // 类型 ID
  displayName: string;           // 显示名称
  phase: 1 | 2 | 3 | 4;        // 所属阶段
  format: 'markdown' | 'yaml';  // 文件格式

  // 检测策略（按优先级组合）
  detection: {
    // Layer 1: Frontmatter 字段检测
    frontmatter?: {
      field: string;
      value?: string;
      combineWith?: { field: string; value?: string };
    };
    // Layer 2: 文件位置模式
    locationPattern?: string;     // glob 相对于 outputConfig 的路径
    // Layer 3: 标题检测
    headerPattern?: RegExp;
    // Layer 5: 文件名模式
    filenamePattern?: RegExp;
  };

  // 该类型文档在产出链中的位置
  chain?: {
    derivedFrom?: string[];      // 源文档类型
    feedsInto?: string[];        // 下游文档类型
    requiredBefore?: string[];   // 必须先于哪些类型完成
  };
}
```

### 3.2 完整 18 种文档类型的声明式注册

```typescript
const BMAD_DOC_TYPES: DocTypeDefinition[] = [
  // ─── Phase 1: Analysis ───
  {
    id: 'product-brief',
    displayName: '产品概要',
    phase: 1,
    format: 'markdown',
    detection: {
      filenamePattern: /brief/i,
      headerPattern: /^#\s+Product\s+Brief/i,
      locationPattern: '{planningArtifacts}/*brief*.md',
    },
    chain: {
      feedsInto: ['prd', 'research-technical', 'research-market',
                  'research-domain'],
    },
  },
  {
    id: 'brainstorming-session',
    displayName: '头脑风暴',
    phase: 1,
    format: 'markdown',
    detection: {
      frontmatter: { field: 'session_topic' },
      filenamePattern: /^brainstorming-session-\d{4}-\d{2}-\d{2}/,
      headerPattern: /^#\s+Brainstorming\s+Session\s+Results/i,
      locationPattern: '{brainstorming}/brainstorming-session-*.md',
    },
    chain: {
      feedsInto: ['product-brief'],
    },
  },
  {
    id: 'research-technical',
    displayName: '技术研究',
    phase: 1,
    format: 'markdown',
    detection: {
      frontmatter: {
        field: 'workflowType', value: 'research',
        combineWith: { field: 'research_type', value: 'technical' },
      },
      filenamePattern: /^technical-.*-research/,
      locationPattern: '{planningArtifacts}/research/technical-*.md',
    },
    chain: {
      feedsInto: ['architecture', 'prd'],
    },
  },
  {
    id: 'research-market',
    displayName: '市场研究',
    phase: 1,
    format: 'markdown',
    detection: {
      frontmatter: {
        field: 'workflowType', value: 'research',
        combineWith: { field: 'research_type', value: 'market' },
      },
      filenamePattern: /^market-.*-research/,
      locationPattern: '{planningArtifacts}/research/market-*.md',
    },
    chain: { feedsInto: ['prd'] },
  },
  {
    id: 'research-domain',
    displayName: '领域研究',
    phase: 1,
    format: 'markdown',
    detection: {
      frontmatter: {
        field: 'workflowType', value: 'research',
        combineWith: { field: 'research_type', value: 'domain' },
      },
      filenamePattern: /^domain-.*-research/,
      locationPattern: '{planningArtifacts}/research/domain-*.md',
    },
    chain: { feedsInto: ['prd'] },
  },
  {
    id: 'project-documentation-index',
    displayName: '项目文档索引',
    phase: 1,
    format: 'markdown',
    detection: {
      filenamePattern: /^index\.md$/,
      headerPattern: /Documentation\s+Index/i,
      locationPattern: '{projectKnowledge}/index.md',
    },
    chain: {},
  },
  {
    id: 'project-overview',
    displayName: '项目概览',
    phase: 1,
    format: 'markdown',
    detection: {
      filenamePattern: /^project-overview\.md$/,
      headerPattern: /Project\s+Overview/i,
      locationPattern: '{projectKnowledge}/project-overview.md',
    },
    chain: {},
  },
  {
    id: 'source-tree-analysis',
    displayName: '源码树分析',
    phase: 1,
    format: 'markdown',
    detection: {
      filenamePattern: /^source-tree/i,
      headerPattern: /Source\s+Tree\s+Analysis/i,
      locationPattern: '{projectKnowledge}/source-tree-analysis.md',
    },
    chain: { feedsInto: ['project-context'] },
  },
  {
    id: 'deep-dive-documentation',
    displayName: '深度分析文档',
    phase: 1,
    format: 'markdown',
    detection: {
      filenamePattern: /deep-dive/i,
      headerPattern: /Deep\s+Dive\s+Documentation/i,
      locationPattern: '{projectKnowledge}/*deep-dive*.md',
    },
    chain: { feedsInto: ['project-context'] },
  },

  // ─── Phase 2: Planning ───
  {
    id: 'prd',
    displayName: '产品需求文档',
    phase: 2,
    format: 'markdown',
    detection: {
      frontmatter: { field: 'workflowType', value: 'prd' },
      filenamePattern: /^prd\.md$/,
      headerPattern: /^#\s+Product\s+Requirements\s+Document/i,
      locationPattern: '{planningArtifacts}/prd.md',
    },
    chain: {
      derivedFrom: ['product-brief', 'research-technical',
                    'research-market', 'research-domain'],
      feedsInto: ['ux-design', 'architecture', 'epics-and-stories'],
      requiredBefore: ['architecture'],
    },
  },
  {
    id: 'ux-design',
    displayName: 'UX 设计规格',
    phase: 2,
    format: 'markdown',
    detection: {
      filenamePattern: /^ux-design/i,
      headerPattern: /UX\s+Design\s+Specification/i,
      locationPattern: '{planningArtifacts}/ux-design.md',
    },
    chain: {
      derivedFrom: ['prd'],
      feedsInto: ['architecture', 'epics-and-stories'],
    },
  },
  {
    id: 'prd-validation-report',
    displayName: 'PRD 验证报告',
    phase: 2,
    format: 'markdown',
    detection: {
      filenamePattern: /prd.*validation/i,
      locationPattern: '{planningArtifacts}/*validation*.md',
    },
    chain: { derivedFrom: ['prd'] },
  },

  // ─── Phase 3: Solutioning ───
  {
    id: 'architecture',
    displayName: '架构决策文档',
    phase: 3,
    format: 'markdown',
    detection: {
      frontmatter: { field: 'workflowType', value: 'architecture' },
      filenamePattern: /^architecture\.md$/,
      headerPattern: /^#\s+Architecture\s+Decision\s+Document/i,
      locationPattern: '{planningArtifacts}/architecture.md',
    },
    chain: {
      derivedFrom: ['prd', 'research-technical'],
      feedsInto: ['epics-and-stories', 'project-context'],
      requiredBefore: ['epics-and-stories'],
    },
  },
  {
    id: 'epics-and-stories',
    displayName: '史诗/故事分解',
    phase: 3,
    format: 'markdown',
    detection: {
      filenamePattern: /epic/i,
      headerPattern: /Epic\s+Breakdown/i,
      locationPattern: '{planningArtifacts}/epics-and-stories.md',
    },
    chain: {
      derivedFrom: ['prd', 'architecture'],
      feedsInto: ['sprint-status', 'story'],
      requiredBefore: ['sprint-status'],
    },
  },
  {
    id: 'project-context',
    displayName: 'AI 项目上下文',
    phase: 3,
    format: 'markdown',
    detection: {
      frontmatter: { field: 'sections_completed' },
      filenamePattern: /^project-context\.md$/,
      headerPattern: /Project\s+Context.*AI\s+Agents/i,
    },
    chain: {
      derivedFrom: ['architecture', 'source-tree-analysis'],
      feedsInto: ['story'],
    },
  },
  {
    id: 'readiness-report',
    displayName: '就绪评估报告',
    phase: 3,
    format: 'markdown',
    detection: {
      filenamePattern: /readiness/i,
      headerPattern: /Implementation\s+Readiness/i,
      locationPattern: '{planningArtifacts}/readiness-report.md',
    },
    chain: {
      derivedFrom: ['prd', 'architecture', 'epics-and-stories'],
      requiredBefore: ['sprint-status'],
    },
  },

  // ─── Phase 4: Implementation ───
  {
    id: 'sprint-status',
    displayName: 'Sprint 状态',
    phase: 4,
    format: 'yaml',
    detection: {
      filenamePattern: /^sprint.*\.ya?ml$/,
      locationPattern: '{implementationArtifacts}/sprint-*.yaml',
    },
    chain: {
      derivedFrom: ['epics-and-stories'],
      feedsInto: ['story'],
    },
  },
  {
    id: 'story',
    displayName: '用户故事',
    phase: 4,
    format: 'markdown',
    detection: {
      filenamePattern: /^story-\d+-\d+\.md$/,
      headerPattern: /^#\s+Story\s+\d+\.\d+/,
      locationPattern: '{implementationArtifacts}/story-*.md',
    },
    chain: {
      derivedFrom: ['epics-and-stories', 'architecture', 'project-context'],
    },
  },
  {
    id: 'retrospective',
    displayName: '回顾总结',
    phase: 4,
    format: 'markdown',
    detection: {
      filenamePattern: /retrospective/i,
      locationPattern: '{implementationArtifacts}/retrospective-*.md',
    },
    chain: {},
  },
];
```

_置信度：**HIGH** — 所有 18 种类型的检测签名基于 BMAD v6.2.2 模板和实际输出文件验证_

## 4. BMAD 预设关系规则设计

### 4.1 规则清单与 CORD 9 种关系类型映射

基于 BMAD 4 阶段工作流分析，设计 5 条预设关系规则：

| 规则 ID | 规则名称 | 类别 | 优先级 | 映射的关系类型 | 置信度 |
|---------|---------|------|--------|-------------|--------|
| `bmad-input-documents` | inputDocuments 显式引用 | structural | 25 | `derived_from` | 1.0 |
| `bmad-document-chain` | 文档产出链推断 | structural | 40 | `derived_from` / `informs` | 0.85 |
| `bmad-phase-gate` | 阶段门约束 | structural | 45 | `must_consistent` | 0.80 |
| `bmad-lifecycle` | 文档生命周期绑定 | semantic | 50 | `lifecycle_bound` | 0.75 |
| `bmad-naming-convention` | 命名约定层级推断 | naming | 55 | `belongs_to` / `contains` | 0.70 |

### 4.2 规则 1：BmadInputDocumentsRule（置信度 1.0）

已在 Step 3 集成模式分析中详细设计（参见第 5 节）。此规则直接提取 `inputDocuments` frontmatter 字段，无推断成分。

### 4.3 规则 2：BmadDocumentChainRule（置信度 0.85）

基于 `DocTypeDefinition.chain` 声明的产出链关系，推断同一项目中文档间的 `derived_from` 和 `informs` 关系：

```typescript
class BmadDocumentChainRule implements IRelationRule {
  readonly id = 'bmad-document-chain';
  readonly name = 'BMAD Document Production Chain';
  readonly priority = 40;
  readonly category = 'structural' as const;

  constructor(private docTypes: DocTypeDefinition[]) {}

  applies(doc: DocumentMeta): boolean {
    return doc.frameworkId === 'bmad-method';
  }

  execute(context: RuleExecutionContext): RelationCandidate[] {
    const sourceType = this.resolveDocType(context.sourceDoc);
    if (!sourceType?.chain) return [];

    const candidates: RelationCandidate[] = [];

    // 正向关系：feedsInto → 寻找下游文档
    if (sourceType.chain.feedsInto) {
      for (const targetTypeId of sourceType.chain.feedsInto) {
        const targetDocs = context.allDocs.filter(d =>
          d.metadata?.bmadDocType === targetTypeId
        );
        for (const target of targetDocs) {
          candidates.push({
            sourceId: context.sourceDoc.id,
            targetId: target.id,
            type: 'informs',
            confidence: 0.85,
            discoveredBy: 'rule',
            ruleId: this.id,
          });
        }
      }
    }

    // 反向关系：derivedFrom → 寻找源文档
    if (sourceType.chain.derivedFrom) {
      for (const sourceTypeId of sourceType.chain.derivedFrom) {
        const sourceDocs = context.allDocs.filter(d =>
          d.metadata?.bmadDocType === sourceTypeId
        );
        for (const source of sourceDocs) {
          candidates.push({
            sourceId: context.sourceDoc.id,
            targetId: source.id,
            type: 'derived_from',
            confidence: 0.85,
            discoveredBy: 'rule',
            ruleId: this.id,
          });
        }
      }
    }

    return candidates;
  }

  private resolveDocType(doc: DocumentMeta): DocTypeDefinition | undefined {
    return this.docTypes.find(dt => dt.id === doc.metadata?.bmadDocType);
  }
}
```

_置信度：**HIGH** — 产出链关系直接来源于 BMAD module-help.csv 的 `after` 字段_

### 4.4 规则 3：BmadPhaseGateRule（置信度 0.80）

检测跨阶段文档的一致性约束——当上游文档（如 PRD）变更时，标记下游文档（如 Architecture、Epics）需要重新验证：

```typescript
class BmadPhaseGateRule implements IRelationRule {
  readonly id = 'bmad-phase-gate';
  readonly name = 'BMAD Phase Gate Consistency';
  readonly priority = 45;
  readonly category = 'structural' as const;

  applies(doc: DocumentMeta): boolean {
    return doc.frameworkId === 'bmad-method'
      && doc.metadata?.bmadPhase !== undefined;
  }

  execute(context: RuleExecutionContext): RelationCandidate[] {
    const sourcePhase = context.sourceDoc.metadata?.bmadPhase as number;
    const sourceType = context.sourceDoc.metadata?.bmadDocType as string;

    // 查找 requiredBefore 声明的下游文档
    const docTypeDef = BMAD_DOC_TYPES.find(dt => dt.id === sourceType);
    if (!docTypeDef?.chain?.requiredBefore) return [];

    const candidates: RelationCandidate[] = [];
    for (const requiredBeforeType of docTypeDef.chain.requiredBefore) {
      const downstreamDocs = context.allDocs.filter(d =>
        d.metadata?.bmadDocType === requiredBeforeType
      );
      for (const downstream of downstreamDocs) {
        candidates.push({
          sourceId: context.sourceDoc.id,
          targetId: downstream.id,
          type: 'must_consistent',
          confidence: 0.80,
          discoveredBy: 'rule',
          ruleId: this.id,
          metadata: {
            constraint: 'phase-gate',
            sourcePhase,
            targetPhase: downstream.metadata?.bmadPhase,
          },
        });
      }
    }

    return candidates;
  }
}
```

_置信度：**HIGH** — 阶段门约束直接从 BMAD 工作流依赖关系推导_

### 4.5 规则 4：BmadLifecycleRule（置信度 0.75）

识别 BMAD 文档间的生命周期绑定关系——同一 Epic 下的 Story 与 Sprint Status 之间、PRD 与 PRD Validation Report 之间：

```typescript
class BmadLifecycleRule implements IRelationRule {
  readonly id = 'bmad-lifecycle';
  readonly name = 'BMAD Document Lifecycle Binding';
  readonly priority = 50;
  readonly category = 'semantic' as const;

  applies(doc: DocumentMeta): boolean {
    return doc.frameworkId === 'bmad-method';
  }

  execute(context: RuleExecutionContext): RelationCandidate[] {
    const candidates: RelationCandidate[] = [];
    const docType = context.sourceDoc.metadata?.bmadDocType;

    // Story ↔ Sprint Status 生命周期绑定
    if (docType === 'story') {
      const sprintDocs = context.allDocs.filter(d =>
        d.metadata?.bmadDocType === 'sprint-status'
      );
      for (const sprint of sprintDocs) {
        candidates.push({
          sourceId: context.sourceDoc.id,
          targetId: sprint.id,
          type: 'lifecycle_bound',
          confidence: 0.75,
          discoveredBy: 'rule',
          ruleId: this.id,
        });
      }
    }

    // PRD ↔ PRD Validation Report 生命周期绑定
    if (docType === 'prd') {
      const validationDocs = context.allDocs.filter(d =>
        d.metadata?.bmadDocType === 'prd-validation-report'
      );
      for (const validation of validationDocs) {
        candidates.push({
          sourceId: context.sourceDoc.id,
          targetId: validation.id,
          type: 'lifecycle_bound',
          confidence: 0.75,
          discoveredBy: 'rule',
          ruleId: this.id,
        });
      }
    }

    return candidates;
  }
}
```

### 4.6 规则 5：BmadNamingConventionRule（置信度 0.70）

基于 BMAD 文件命名约定推断层级关系——`story-{N}-{M}.md` 中的 `{N}` 关联到 Epics 文档中的 Epic N：

```typescript
class BmadNamingConventionRule implements IRelationRule {
  readonly id = 'bmad-naming-convention';
  readonly name = 'BMAD Naming Convention Hierarchy';
  readonly priority = 55;
  readonly category = 'naming' as const;

  applies(doc: DocumentMeta): boolean {
    return doc.frameworkId === 'bmad-method'
      && doc.metadata?.bmadDocType === 'story';
  }

  execute(context: RuleExecutionContext): RelationCandidate[] {
    const filename = path.basename(context.sourceDoc.relativePath);
    const match = filename.match(/^story-(\d+)-(\d+)\.md$/);
    if (!match) return [];

    const epicNum = parseInt(match[1]);

    // 查找 Epics 文档
    const epicsDocs = context.allDocs.filter(d =>
      d.metadata?.bmadDocType === 'epics-and-stories'
    );

    return epicsDocs.map(epicDoc => ({
      sourceId: context.sourceDoc.id,
      targetId: epicDoc.id,
      type: 'belongs_to' as RelationType,
      confidence: 0.70,
      discoveredBy: 'rule' as const,
      ruleId: this.id,
      metadata: { epicNumber: epicNum },
    }));
  }
}
```

_置信度：**HIGH** — 命名约定直接从 BMAD story 模板的文件名模式提取_

## 5. BMAD 文档产出链关系拓扑

### 5.1 完整关系拓扑图

```
Phase 1: Analysis
  ┌──────────────┐     ┌───────────────┐
  │ Brainstorming │────→│ Product Brief │
  └──────────────┘     └───────┬───────┘
                               │ informs
  ┌──────────────┐             ↓
  │ Market       │────→┌──────────────┐
  │ Research     │     │              │
  └──────────────┘     │              │
  ┌──────────────┐     │              │
  │ Domain       │────→│     PRD      │ ← Phase 2: Planning
  │ Research     │     │              │
  └──────────────┘     │              │
  ┌──────────────┐     │              │
  │ Technical    │────→│              │
  │ Research     │     └──┬───────┬───┘
  └──────┬───────┘        │       │
         │                │       ↓
         │                │  ┌──────────┐
         │                │  │UX Design │
         │                │  └────┬─────┘
         │                │       │
         ↓                ↓       ↓
    ┌────────────────────────────────┐
    │        Architecture            │ ← Phase 3: Solutioning
    └───────────┬────────────────────┘
                │ derived_from
                ↓
    ┌────────────────────────────────┐
    │      Epics & Stories           │
    └───────────┬────────────────────┘
                │
    ┌───────────┴────────────────────┐
    │      Readiness Report          │
    └───────────┬────────────────────┘
                │
                ↓
    ┌────────────────────────────────┐
    │      Sprint Status (YAML)      │ ← Phase 4: Implementation
    └───────────┬────────────────────┘
                │
    ┌───────────┴────────────┐
    │  Story 1-1 │ Story 1-2 │ ...
    └────────────┴───────────┘
                │
    ┌───────────┴────────────┐
    │     Retrospective       │
    └─────────────────────────┘
```

### 5.2 关系拓扑的 19 条预设关系对

基于完整文档产出链分析，BMAD 适配器预设 **19 条文档间关系对**：

| # | 源文档类型 | 目标文档类型 | 关系类型 | 强度 |
|---|-----------|------------|---------|------|
| 1 | brainstorming-session | product-brief | `informs` | 弱 |
| 2 | product-brief | prd | `informs` | 中 |
| 3 | research-technical | prd | `informs` | 中 |
| 4 | research-market | prd | `informs` | 弱 |
| 5 | research-domain | prd | `informs` | 弱 |
| 6 | research-technical | architecture | `informs` | 强 |
| 7 | prd | ux-design | `informs` | 中 |
| 8 | prd | architecture | `derived_from` | 强 |
| 9 | ux-design | architecture | `informs` | 中 |
| 10 | prd | epics-and-stories | `derived_from` | 强 |
| 11 | architecture | epics-and-stories | `derived_from` | 强 |
| 12 | prd + architecture + epics | readiness-report | `derived_from` | 强 |
| 13 | architecture | project-context | `informs` | 中 |
| 14 | source-tree-analysis | project-context | `informs` | 中 |
| 15 | epics-and-stories | sprint-status | `derived_from` | 强 |
| 16 | epics-and-stories | story | `derived_from` | 强 |
| 17 | architecture | story | `informs` | 中 |
| 18 | project-context | story | `informs` | 中 |
| 19 | prd | prd-validation-report | `lifecycle_bound` | 强 |

_置信度：**HIGH** — 所有关系对直接从 BMAD module-help.csv 的 `after`/`before` 字段和模板 `inputDocuments` 推导_

## 6. 多版本兼容策略

### 6.1 版本适配架构

```typescript
class BmadFrameworkAdapter implements IBmadFrameworkAdapter {
  // 版本特定行为通过策略模式隔离
  private getVersionStrategy(
    version: string | null
  ): BmadVersionStrategy {
    if (!version) return new BmadDefaultStrategy();
    const major = parseInt(version.split('.')[0]);
    if (major >= 7) return new BmadV7Strategy();
    if (major >= 6) return new BmadV6Strategy();
    return new BmadLegacyStrategy();
  }
}

interface BmadVersionStrategy {
  // 不同版本的目录结构差异
  getExpectedStructure(): BmadDirectoryStructure;
  // 不同版本的 frontmatter 字段差异
  getFrontmatterFields(): BmadFrontmatterSchema;
  // 不同版本的文档类型清单差异
  getDocTypes(): DocTypeDefinition[];
}

class BmadV6Strategy implements BmadVersionStrategy {
  // BMAD v6.x（当前版本）的具体实现
  getExpectedStructure() {
    return {
      root: '_bmad',
      core: '_bmad/core',
      method: '_bmad/bmm',
      config: '_bmad/bmm/config.yaml',
      helpIndex: '_bmad/bmm/module-help.csv',
    };
  }
  // ...
}
```

### 6.2 向前兼容设计原则

| 原则 | 实现方式 | 说明 |
|------|---------|------|
| **宽松检测** | 仅依赖 `_bmad/` 根目录 + 少量稳定结构 | 新版本增加子目录不影响检测 |
| **稳定字段优先** | 仅依赖 `workflowType`、`inputDocuments` 等核心字段 | 新增字段不破坏现有规则 |
| **声明式类型定义** | 文档类型通过配置数组定义 | 新版本增加文档类型仅需追加配置 |
| **版本策略隔离** | 不同版本行为通过 Strategy 模式隔离 | 新版本适配不修改核心代码 |
| **降级容忍** | 检测失败时降级到通用 Markdown 适配器 | 不因版本不兼容而中断扫描 |

_置信度：**MEDIUM-HIGH** — 版本策略为前瞻性设计，具体版本差异需随 BMAD 演进持续跟踪_

## 7. 架构模式总结与决策矩阵

| 架构层面 | 选定模式 | 备选方案 | 选择理由 |
|---------|---------|---------|---------|
| **适配器整体** | 适配器模式 + 接口继承 | 直接硬编码 | TR6 已确认，可扩展性强 |
| **内部分解** | 组合模式（Detector + Registry + Factory） | 单体类 | 职责分离，便于测试 |
| **文档类型定义** | 声明式配置数组 | 硬编码 if-else | 易扩展、易维护、用户可覆盖 |
| **预设规则** | 策略模式（IRelationRule） | 模板方法 | TR6 已确认的规则引擎 API |
| **版本兼容** | 策略模式（VersionStrategy） | 条件分支 | 隔离版本差异，开闭原则 |
| **检测算法** | 三层递进 | 单层检测 | 兼顾速度和准确性 |
| **关系拓扑** | 声明式 chain 配置 | 代码内推断 | 关系对可配置、可验证 |

---

**架构模式分析完成日期：** 2026-04-02

---

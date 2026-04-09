# Architectural Patterns and Design（架构模式与设计）

本节聚焦 `SuperpowersFrameworkAdapter` 的完整架构设计——适配器内部结构、技能类型注册表、预设关系规则的声明式 DSL、7 阶段工作流的关系拓扑模型，以及与 TR10 BMAD 适配器共享抽象基类的设计方案。

## 1. 适配器内部架构

### 1.1 模块分解

`SuperpowersFrameworkAdapter` 采用与 BMAD 适配器**相同的职责分离**模块化设计，但针对技能驱动范式调整了各模块的职责：

```
SuperpowersFrameworkAdapter/
  ├─ SuperpowersDetector          ← 框架检测（detect）
  ├─ SuperpowersSkillRegistry     ← 技能类型注册表（getDocTypeMapping）
  ├─ SuperpowersRuleFactory       ← 预设规则工厂（getPresetRules）
  ├─ SuperpowersSkillParser       ← SKILL.md 元数据解析（getSkillCatalog）
  ├─ SuperpowersWorkflowModel     ← 7 阶段工作流模型（getSkillDependencyGraph）
  └─ rules/                       ← 预设规则实现
      ├─ SpSkillDependenciesRule
      ├─ SpWorkflowSequenceRule
      ├─ SpWhenToUseSemanticRule
      └─ SpPlatformConfigRule
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
└────────────┬──────────────────────┬─────────────┘
             │ implements            │ implements
             │ (TR10)                │ (TR11)
┌────────────┴─────────┐  ┌─────────┴────────────────────┐
│  BmadFrameworkAdapter │  │  SuperpowersFrameworkAdapter  │
│  ─────────────────── │  │  ──────────────────────────── │
│  - detector           │  │  - detector                   │
│  - docTypeRegistry    │  │  - skillRegistry              │
│  - ruleFactory        │  │  - ruleFactory                │
│  - configReader       │  │  - skillParser                │
│  - phaseModel         │  │  - workflowModel              │
└──────────────────────┘  └───────────────────────────────┘
```

**设计原则**：两个适配器都实现相同的 `IFrameworkAdapter` 接口，`FrameworkRegistry` 统一管理，对 CORD 核心完全透明。

_置信度：**HIGH** — 接口实现模式继承 TR10 已验证的架构_

### 1.3 AbstractFrameworkAdapter 抽象基类（TR11 新增建议）

TR10 建议在 BMAD 适配器完成后抽取公共基类，TR11 提供了实现机会：

```typescript
// 抽取公共逻辑到抽象基类（TR11 引入）
abstract class AbstractFrameworkAdapter implements IFrameworkAdapter {
  abstract readonly frameworkId: string;
  abstract readonly displayName: string;

  // 通用的文件存在检测工具
  protected async fileExists(path: string): Promise<boolean> {
    try { await fs.access(path); return true; } catch { return false; }
  }

  protected async dirExists(path: string): Promise<boolean> {
    try {
      const stat = await fs.stat(path);
      return stat.isDirectory();
    } catch { return false; }
  }

  // 通用的 glob 文件发现
  protected async findFiles(
    pattern: string, cwd: string
  ): Promise<string[]> {
    return glob(pattern, { cwd, ignore: ['node_modules/**'] });
  }

  // 抽象方法（子类实现）
  abstract detect(projectRoot: string): Promise<boolean>;
  abstract getPresetRules(): IRelationRule[];
  abstract getDocTypeMapping(): Map<string, DocTypePattern>;
}

// 两个适配器都继承基类
class BmadFrameworkAdapter extends AbstractFrameworkAdapter { /* TR10 */ }
class SuperpowersFrameworkAdapter extends AbstractFrameworkAdapter { /* TR11 */ }
```

_置信度：**HIGH** — 抽象基类是消除代码重复的标准 OOP 模式_

## 2. SuperpowersDetector：框架检测设计

### 2.1 三层递进检测算法

```typescript
class SuperpowersDetector {
  /**
   * 三层递进检测：
   * L1: skills/ 目录 + SKILL.md 存在 → 初筛（85%）
   * L2: package.json name = "superpowers" → 精确确认（99%）
   * L3: 平台目录存在 → 辅助确认（90%）
   */
  async detect(projectRoot: string): Promise<SuperpowersDetectResult> {
    const skillsDir = path.join(projectRoot, 'skills');

    // L1: skills/ 目录检测
    if (!await this.dirExists(skillsDir)) {
      return { detected: false, confidence: 0 };
    }

    // 检查是否含 SKILL.md 文件
    const skillFiles = await glob('*/SKILL.md', { cwd: skillsDir });
    if (skillFiles.length === 0) {
      return { detected: false, confidence: 0 };
    }

    // L2: package.json 精确确认
    const pkgPath = path.join(projectRoot, 'package.json');
    if (await this.fileExists(pkgPath)) {
      try {
        const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8'));
        if (pkg.name === 'superpowers') {
          return {
            detected: true,
            confidence: 0.99,
            version: pkg.version,
            skillCount: skillFiles.length,
          };
        }
      } catch { /* 继续 L3 */ }
    }

    // L3: 平台目录辅助确认
    const platformDirs = ['.claude-plugin', '.cursor-plugin', '.codex', '.opencode'];
    const platforms: SuperpowersPlatform[] = [];
    for (const dir of platformDirs) {
      if (await this.dirExists(path.join(projectRoot, dir))) {
        platforms.push(dir.replace('.', '').replace('-plugin', '') as SuperpowersPlatform);
      }
    }

    return {
      detected: true,
      confidence: platforms.length > 0 ? 0.90 : 0.85,
      skillCount: skillFiles.length,
      installedPlatforms: platforms,
    };
  }
}

interface SuperpowersDetectResult {
  detected: boolean;
  confidence: number;
  version?: string;
  skillCount?: number;
  installedPlatforms?: SuperpowersPlatform[];
}
```

_置信度：**HIGH** — 检测算法基于 Superpowers 仓库实际结构验证_

## 3. SuperpowersSkillRegistry：技能类型注册表设计

### 3.1 声明式技能类型定义

采用**声明式配置**（类比 TR10 的 `DocTypeDefinition`）定义 14 个技能类型：

```typescript
interface SuperpowersSkillDefinition {
  id: string;              // 技能目录名（与 SKILL.md 所在目录同名）
  displayName: string;     // 人类可读名称
  workflowStage?: number;  // 所属工作流阶段（1-7），null 表示横切关注点
  skillType: 'collaboration' | 'technical' | 'debugging' | 'meta';

  // 检测策略
  detection: {
    // 技能目录名精确匹配（置信度 100%）
    directoryName: string;
    // SKILL.md frontmatter.name 匹配
    skillNamePattern?: RegExp;
    // SKILL.md frontmatter.when_to_use 关键词
    whenToUseKeywords?: string[];
  };

  // 工作流依赖关系（用于推断规则）
  workflow?: {
    precedes?: string[];   // 此技能在哪些技能之前使用
    follows?: string[];    // 此技能在哪些技能之后使用
    canParallel?: string[]; // 可以并行使用的技能
  };
}
```

### 3.2 14 个技能类型的声明式定义

```typescript
const SUPERPOWERS_SKILLS: SuperpowersSkillDefinition[] = [
  // ─── Stage 1: Brainstorming ───
  {
    id: 'brainstorming',
    displayName: '头脑风暴',
    workflowStage: 1,
    skillType: 'collaboration',
    detection: {
      directoryName: 'brainstorming',
      whenToUseKeywords: ['brainstorm', 'unclear', 'refine', 'explore'],
    },
    workflow: { precedes: ['writing-plans', 'using-git-worktrees'] },
  },

  // ─── Stage 2: Git Worktrees ───
  {
    id: 'using-git-worktrees',
    displayName: 'Git 工作树',
    workflowStage: 2,
    skillType: 'technical',
    detection: {
      directoryName: 'using-git-worktrees',
      whenToUseKeywords: ['worktree', 'isolation', 'parallel', 'branch'],
    },
    workflow: {
      follows: ['brainstorming'],
      precedes: ['writing-plans', 'subagent-driven-development'],
    },
  },

  // ─── Stage 3: Planning ───
  {
    id: 'writing-plans',
    displayName: '编写计划',
    workflowStage: 3,
    skillType: 'collaboration',
    detection: {
      directoryName: 'writing-plans',
      whenToUseKeywords: ['plan', 'decompose', 'tasks', 'breakdown'],
    },
    workflow: {
      follows: ['brainstorming', 'using-git-worktrees'],
      precedes: ['executing-plans', 'subagent-driven-development'],
    },
  },
  {
    id: 'executing-plans',
    displayName: '执行计划',
    workflowStage: 3,
    skillType: 'collaboration',
    detection: {
      directoryName: 'executing-plans',
      whenToUseKeywords: ['execute', 'implement', 'follow plan'],
    },
    workflow: {
      follows: ['writing-plans'],
      precedes: ['test-driven-development'],
    },
  },

  // ─── Stage 4: Subagent Development ───
  {
    id: 'subagent-driven-development',
    displayName: '子代理驱动开发',
    workflowStage: 4,
    skillType: 'technical',
    detection: {
      directoryName: 'subagent-driven-development',
      whenToUseKeywords: ['subagent', 'spawn', 'delegate', 'parallel tasks'],
    },
    workflow: {
      follows: ['writing-plans', 'using-git-worktrees'],
      canParallel: ['dispatching-parallel-agents'],
    },
  },
  {
    id: 'dispatching-parallel-agents',
    displayName: '并行代理派遣',
    workflowStage: 4,
    skillType: 'collaboration',
    detection: {
      directoryName: 'dispatching-parallel-agents',
      whenToUseKeywords: ['parallel', 'dispatch', 'concurrent', 'multiple agents'],
    },
    workflow: { canParallel: ['subagent-driven-development'] },
  },

  // ─── Stage 5: TDD ───
  {
    id: 'test-driven-development',
    displayName: '测试驱动开发',
    workflowStage: 5,
    skillType: 'technical',
    detection: {
      directoryName: 'test-driven-development',
      whenToUseKeywords: ['test', 'TDD', 'red-green-refactor', 'failing test'],
    },
    workflow: {
      follows: ['writing-plans', 'subagent-driven-development'],
      precedes: ['requesting-code-review'],
    },
  },

  // ─── Stage 6: Code Review ───
  {
    id: 'requesting-code-review',
    displayName: '请求代码审查',
    workflowStage: 6,
    skillType: 'collaboration',
    detection: {
      directoryName: 'requesting-code-review',
      whenToUseKeywords: ['review', 'request review', 'before merge'],
    },
    workflow: {
      follows: ['test-driven-development'],
      precedes: ['finishing-a-development-branch'],
    },
  },
  {
    id: 'receiving-code-review',
    displayName: '接受代码审查',
    workflowStage: 6,
    skillType: 'collaboration',
    detection: {
      directoryName: 'receiving-code-review',
      whenToUseKeywords: ['receive review', 'address feedback', 'review comments'],
    },
    workflow: { follows: ['requesting-code-review'] },
  },

  // ─── Stage 7: Branch Completion ───
  {
    id: 'finishing-a-development-branch',
    displayName: '完成开发分支',
    workflowStage: 7,
    skillType: 'technical',
    detection: {
      directoryName: 'finishing-a-development-branch',
      whenToUseKeywords: ['finish', 'complete branch', 'merge', 'PR'],
    },
    workflow: {
      follows: ['receiving-code-review', 'verification-before-completion'],
    },
  },
  {
    id: 'verification-before-completion',
    displayName: '完成前验证',
    workflowStage: 7,
    skillType: 'technical',
    detection: {
      directoryName: 'verification-before-completion',
      whenToUseKeywords: ['verify', 'check before', 'validation', 'done criteria'],
    },
    workflow: {
      follows: ['test-driven-development'],
      precedes: ['finishing-a-development-branch'],
    },
  },

  // ─── Cross-cutting: Debugging ───
  {
    id: 'systematic-debugging',
    displayName: '系统化调试',
    workflowStage: undefined,  // 横切关注点，适用于任意阶段
    skillType: 'debugging',
    detection: {
      directoryName: 'systematic-debugging',
      whenToUseKeywords: ['bug', 'debug', 'race condition', 'flaky', 'error'],
    },
    workflow: {},
  },

  // ─── Meta Skills ───
  {
    id: 'using-superpowers',
    displayName: 'Superpowers 入门',
    workflowStage: undefined,
    skillType: 'meta',
    detection: {
      directoryName: 'using-superpowers',
    },
    workflow: {},
  },
  {
    id: 'writing-skills',
    displayName: '编写新技能',
    workflowStage: undefined,
    skillType: 'meta',
    detection: {
      directoryName: 'writing-skills',
      whenToUseKeywords: ['new skill', 'create skill', 'skill authoring'],
    },
    workflow: {},
  },
];
```

_置信度：**HIGH** — 14 个技能定义基于 Superpowers v5.0.7 仓库 skills/ 目录直接枚举_

## 4. 预设关系规则设计

### 4.1 规则清单与 CORD 9 种关系类型映射

| 规则 ID | 规则名称 | 类别 | 优先级 | 映射的关系类型 | 置信度 |
|---------|---------|------|--------|-------------|--------|
| `sp-skill-dependencies` | dependencies 显式依赖 | structural | 28 | `derived_from` | 0.95 |
| `sp-workflow-sequence` | 工作流阶段顺序推断 | structural | 42 | `informs` / `derived_from` | 0.75 |
| `sp-when-to-use-semantic` | when_to_use 语义触发关系 | semantic | 52 | `informs` | 0.65 |
| `sp-platform-config` | 平台配置文件绑定 | structural | 58 | `belongs_to` | 0.70 |

### 4.2 规则 2：SpWorkflowSequenceRule（置信度 0.75）

基于 `SuperpowersSkillDefinition.workflow` 声明的顺序关系，推断 SKILL.md 文件间的工作流关联：

```typescript
class SpWorkflowSequenceRule implements IRelationRule {
  readonly id = 'sp-workflow-sequence';
  readonly name = 'Superpowers Workflow Sequence';
  readonly priority = 42;
  readonly category = 'structural' as const;

  constructor(private skills: SuperpowersSkillDefinition[]) {}

  applies(doc: DocumentMeta): boolean {
    return doc.frameworkId === 'superpowers'
      && doc.metadata?.cordSuperpowers !== undefined;
  }

  execute(context: RuleExecutionContext): RelationCandidate[] {
    const sourceSkillId = this.resolveSkillId(context.sourceDoc);
    if (!sourceSkillId) return [];

    const skillDef = this.skills.find(s => s.id === sourceSkillId);
    if (!skillDef?.workflow) return [];

    const candidates: RelationCandidate[] = [];

    // precedes: 此技能 → informs → 后续技能
    if (skillDef.workflow.precedes) {
      for (const targetSkillId of skillDef.workflow.precedes) {
        const targetDocs = context.allDocs.filter(d =>
          d.metadata?.cordSuperpowers?.skillId === targetSkillId
        );
        for (const target of targetDocs) {
          candidates.push({
            sourceId: context.sourceDoc.id,
            targetId: target.id,
            type: 'informs',
            confidence: 0.75,
            discoveredBy: 'rule',
            ruleId: this.id,
            metadata: { relationship: 'workflow-precedes', framework: 'superpowers' },
          });
        }
      }
    }

    return candidates;
  }

  private resolveSkillId(doc: DocumentMeta): string | undefined {
    return doc.metadata?.cordSuperpowers?.skillId
      || doc.relativePath.match(/skills\/([^/]+)\/SKILL\.md/)?.[1];
  }
}
```

### 4.3 规则 3：SpWhenToUseSemanticRule（置信度 0.65）

分析 `when_to_use` 字段的语义，推断哪些技能在特定场景下会共同触发：

```typescript
class SpWhenToUseSemanticRule implements IRelationRule {
  readonly id = 'sp-when-to-use-semantic';
  readonly name = 'Superpowers When-To-Use Semantic Analysis';
  readonly priority = 52;
  readonly category = 'semantic' as const;

  // 语义相关的关键词组
  private readonly SEMANTIC_CLUSTERS = [
    ['bug', 'debug', 'race condition', 'flaky'],       // → systematic-debugging
    ['test', 'TDD', 'failing test', 'red-green'],      // → test-driven-development
    ['plan', 'breakdown', 'decompose', 'tasks'],        // → writing-plans
    ['review', 'code review', 'feedback'],              // → receiving/requesting-code-review
    ['parallel', 'concurrent', 'dispatch'],             // → dispatching-parallel-agents
  ];

  applies(doc: DocumentMeta): boolean {
    return doc.frameworkId === 'superpowers'
      && !!doc.metadata?.cordSuperpowers?.whenToUse;
  }

  execute(context: RuleExecutionContext): RelationCandidate[] {
    const whenToUse = context.sourceDoc.metadata?.cordSuperpowers?.whenToUse;
    if (!whenToUse) return [];

    const candidates: RelationCandidate[] = [];
    const lowerWtu = whenToUse.toLowerCase();

    for (const cluster of this.SEMANTIC_CLUSTERS) {
      const matches = cluster.filter(kw => lowerWtu.includes(kw));
      if (matches.length === 0) continue;

      // 找到该语义簇对应的其他技能文档
      const relatedDocs = context.allDocs.filter(d =>
        d.id !== context.sourceDoc.id
        && d.frameworkId === 'superpowers'
        && cluster.some(kw =>
          d.metadata?.cordSuperpowers?.whenToUse?.toLowerCase().includes(kw)
        )
      );

      for (const related of relatedDocs) {
        candidates.push({
          sourceId: context.sourceDoc.id,
          targetId: related.id,
          type: 'informs',
          confidence: 0.65,
          discoveredBy: 'rule',
          ruleId: this.id,
          metadata: { semanticCluster: cluster[0], matchedKeywords: matches },
        });
      }
    }

    return candidates;
  }
}
```

_置信度：**MEDIUM-HIGH** — `when_to_use` 语义分析是启发式推断，置信度 0.65 反映了推断的不确定性_

## 5. Superpowers 技能工作流关系拓扑

### 5.1 完整关系拓扑图

```
Stage 1: Brainstorming
  ┌──────────────┐
  │ brainstorming │
  └──────┬───────┘
         │ informs
         ↓
Stage 2: Git Worktrees
  ┌──────────────────┐
  │ using-git-worktrees│
  └────────┬─────────┘
           │ informs
           ↓
Stage 3: Planning
  ┌──────────────┐    ┌────────────────┐
  │ writing-plans│───→│ executing-plans│
  └──────┬───────┘    └───────┬────────┘
         │                    │
         ↓                    ↓
Stage 4: Subagent Development
  ┌───────────────────────┐   ┌──────────────────────────┐
  │subagent-driven-       │   │dispatching-parallel-agents│
  │development            │   │                          │
  └───────────┬───────────┘   └──────────────────────────┘
              │ informs
              ↓
Stage 5: TDD
  ┌──────────────────────┐
  │ test-driven-development│
  └────────────┬──────────┘
               │ informs
               ↓
Stage 5→7: Verification
  ┌──────────────────────────┐
  │ verification-before-     │
  │ completion               │
  └────────────┬─────────────┘
               │ informs
               ↓
Stage 6: Code Review
  ┌───────────────────────┐   ┌─────────────────────────┐
  │ requesting-code-review│───→│ receiving-code-review   │
  └───────────────────────┘   └───────────┬─────────────┘
                                           │ informs
                                           ↓
Stage 7: Branch Completion
  ┌──────────────────────────────┐
  │ finishing-a-development-     │
  │ branch                       │
  └──────────────────────────────┘

Cross-cutting:
  ┌──────────────────────┐
  │ systematic-debugging  │ ← 适用于任意阶段（横切关注点）
  └──────────────────────┘
```

### 5.2 预设关系对清单

基于 7 阶段工作流分析，Superpowers 适配器预设 **12 条技能间关系对**：

| # | 源技能 | 目标技能 | 关系类型 | 强度 |
|---|-------|---------|---------|------|
| 1 | brainstorming | writing-plans | `informs` | 中 |
| 2 | brainstorming | using-git-worktrees | `informs` | 弱 |
| 3 | using-git-worktrees | writing-plans | `informs` | 中 |
| 4 | writing-plans | executing-plans | `informs` | 强 |
| 5 | writing-plans | subagent-driven-development | `informs` | 强 |
| 6 | executing-plans | subagent-driven-development | `informs` | 中 |
| 7 | subagent-driven-development | test-driven-development | `informs` | 强 |
| 8 | test-driven-development | verification-before-completion | `informs` | 强 |
| 9 | test-driven-development | requesting-code-review | `informs` | 强 |
| 10 | requesting-code-review | receiving-code-review | `derived_from` | 强 |
| 11 | receiving-code-review | finishing-a-development-branch | `informs` | 强 |
| 12 | verification-before-completion | finishing-a-development-branch | `informs` | 中 |

_置信度：**MEDIUM-HIGH** — 关系对基于 Superpowers 工作流文档推导，部分隐式关系需实证验证_

## 6. 架构模式总结与决策矩阵

| 架构层面 | 选定模式 | 备选方案 | 选择理由 |
|---------|---------|---------|---------|
| **适配器整体** | 适配器模式 + 接口继承（复用 TR10） | 全新设计 | 零侵入 CORD 核心；FrameworkRegistry 统一管理 |
| **基类抽取** | AbstractFrameworkAdapter（TR11 新增） | 代码重复 | 消除 BMAD/Superpowers 适配器间的重复工具代码 |
| **技能类型定义** | 声明式配置数组（类比 TR10 DocTypeDefinition） | 硬编码 if-else | 易扩展（社区新技能）；与 BMAD 范式对称 |
| **预设规则** | 策略模式（IRelationRule），4 条 | 模板方法 | TR6/TR10 已确认的规则引擎 API |
| **语义分析** | 关键词簇匹配（when_to_use） | LLM 语义嵌入 | MVP 阶段轻量可行；后续可升级为 Embedding |
| **检测算法** | 三层递进（skills/→package.json→平台目录） | 单层检测 | 兼顾速度（<10ms）和准确性 |
| **关系拓扑** | 声明式 workflow 配置 | 代码内推断 | 可配置、可验证；与 BMAD chain 对称设计 |

---

**架构模式分析完成日期：** 2026-04-02

---

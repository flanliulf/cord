# Integration Patterns Analysis（集成模式分析）

本节聚焦 Superpowers 适配器模块与 CORD 核心系统的集成接口设计：适配器如何嵌入冷启动扫描管道、如何与规则引擎协作、如何向 `RelationDiscoveryService` 提供框架特有的关系规则、以及如何通过 `FrameworkRegistry` 实现自动检测和注册。同时与 TR10 BMAD 适配器进行对比分析。

## 1. 核心集成接口：IFrameworkAdapter（继承 TR10）

### 1.1 接口复用（零修改）

Superpowers 适配器实现 TR10 已设计的 `IFrameworkAdapter` 接口，**无需修改接口定义**，直接作为第二个参考实现：

```typescript
// TR6/TR10 已定义的框架适配器接口（Superpowers 适配器直接实现）
interface IFrameworkAdapter {
  readonly frameworkId: string;      // 'superpowers'
  readonly displayName: string;      // 'Superpowers'

  detect(projectRoot: string): Promise<boolean>;
  getPresetRules(): IRelationRule[];
  getDocTypeMapping(): Map<string, DocTypePattern>;
}
```

### 1.2 Superpowers 扩展接口：ISuperpowersFrameworkAdapter

Superpowers 框架的技能驱动特性需要在基础接口之上扩展技能特有能力：

```typescript
// Superpowers 适配器扩展接口（向下兼容 IFrameworkAdapter）
interface ISuperpowersFrameworkAdapter extends IFrameworkAdapter {
  // Superpowers 特有：获取所有已安装技能的元数据
  getSkillCatalog(projectRoot: string): Promise<SuperpowersSkillMeta[]>;

  // Superpowers 特有：获取技能依赖图
  getSkillDependencyGraph(): SuperpowersSkillGraph;

  // Superpowers 特有：获取 Superpowers 版本号
  getVersion(projectRoot: string): Promise<string | null>;

  // Superpowers 特有：获取已安装的平台列表
  getInstalledPlatforms(projectRoot: string): Promise<SuperpowersPlatform[]>;
}

interface SuperpowersSkillMeta {
  skillId: string;              // 技能目录名（如 'systematic-debugging'）
  name: string;                 // SKILL.md frontmatter.name
  description: string;         // SKILL.md frontmatter.description
  whenToUse: string;           // SKILL.md frontmatter.when_to_use
  version: string;             // SKILL.md frontmatter.version
  languages: string | string[]; // SKILL.md frontmatter.languages
  dependencies?: string[];     // SKILL.md frontmatter.dependencies
  skillPath: string;           // 技能目录的完整路径
  stage?: number;              // 推断的工作流阶段（1-7）
}

interface SuperpowersSkillGraph {
  nodes: SuperpowersSkillMeta[];
  edges: Array<{ from: string; to: string; type: 'depends_on' }>;
}

type SuperpowersPlatform =
  | 'claude-code' | 'cursor' | 'codex' | 'opencode' | 'gemini' | 'copilot';
```

**设计理由**：Superpowers 技能目录与 BMAD 文档产出目录的本质不同——BMAD 产出**固定位置的文档文件**，而 Superpowers 安装的是**行为定义文件（SKILL.md）**，不产生用户文档。这使得 `getSkillCatalog()` 比 BMAD 的 `getOutputConfig()` 更贴近 Superpowers 的框架语义。

_置信度：**HIGH** — 接口扩展模式继承 TR10 已验证的设计范式_

### 1.3 BMAD vs Superpowers 适配器接口对比

| 维度 | BMAD 适配器（TR10） | Superpowers 适配器（TR11） |
|------|------------------|------------------------|
| 框架范式 | 文档驱动 | 技能驱动 |
| 核心产出 | 18 种文档类型（.md + .yaml） | 14 个 SKILL.md 定义文件 |
| 关系信号来源 | `inputDocuments` frontmatter（显式，1.0）| `dependencies` frontmatter（显式，0.95） |
| 推断关系来源 | 4 阶段文档产出链（0.85） | 7 阶段工作流顺序（0.75） |
| 检测关键目录 | `_bmad/` + `_bmad/bmm/config.yaml` | `skills/*/SKILL.md` + `package.json` |
| 扩展接口特有方法 | `getOutputConfig()` `getPhaseTopology()` | `getSkillCatalog()` `getSkillDependencyGraph()` |
| 版本检测方式 | `config.yaml` 注释 `# Version: x.y.z` | `package.json` `version` 字段 |

_置信度：**HIGH** — 对比基于 TR10 已完成研究 + Superpowers 实证分析_

## 2. FrameworkRegistry 注册与自动检测集成

### 2.1 双适配器共存注册时序

```
CORD 启动
  → FrameworkRegistry.registerBuiltIn()
    → registry.register(new BmadFrameworkAdapter())         ← TR10 BMAD 适配器
    → registry.register(new SuperpowersFrameworkAdapter())  ← TR11 Superpowers 适配器
    → registry.register(new GenericMarkdownAdapter())       ← 通用适配器
  → FrameworkRegistry.detectFrameworks(projectRoot)
    → adapter.detect() 逐个调用（并行或顺序）
    → 一个项目可能同时检测到多个框架（BMAD + Superpowers 共存场景）
  → 将所有检测到的框架的 getPresetRules() 注入 RuleEngine
```

**关键设计点**：BMAD 和 Superpowers 可能在同一项目中共存（如 CORD 项目本身同时安装了 BMAD 和 Superpowers），FrameworkRegistry 支持多框架并发激活，RuleEngine 合并所有框架的预设规则。

_置信度：**HIGH** — CORD 项目 `_bmad/` + `.claude-plugin/`（假设安装 Superpowers）可验证共存场景_

### 2.2 Superpowers 自动检测策略

```typescript
// Superpowers 适配器的三层检测逻辑
async detect(projectRoot: string): Promise<boolean> {
  // L1: skills/ 目录 + SKILL.md 存在（85% 置信度）
  const skillsDir = path.join(projectRoot, 'skills');
  if (!await dirExists(skillsDir)) return false;
  const skillFiles = await glob('skills/*/SKILL.md', { cwd: projectRoot });
  if (skillFiles.length === 0) return false;

  // L2: package.json name 确认（98% 置信度）
  const pkgPath = path.join(projectRoot, 'package.json');
  if (await fileExists(pkgPath)) {
    const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8'));
    if (pkg.name === 'superpowers') return true;  // 100% 确认
  }

  // L3: 平台目录辅助确认（90% 置信度）
  const platformDirs = ['.claude-plugin', '.cursor-plugin', '.codex', '.opencode'];
  const hasPlatformDir = await Promise.any(
    platformDirs.map(d => dirExists(path.join(projectRoot, d)))
  ).catch(() => false);

  // L2 未命中但 L1 + L3 组合满足，返回 true（90% 置信度）
  return hasPlatformDir;
}
```

_置信度：**HIGH** — 检测逻辑基于 Superpowers 仓库目录结构设计_

## 3. remark 管道集成：SKILL.md 解析

### 3.1 SKILL.md 在 remark 管道中的处理

Superpowers 适配器的核心数据来源是 `skills/*/SKILL.md` 文件的 frontmatter。这些文件通过标准 remark 管道处理，与 BMAD 文档处理路径**完全相同**：

```
SKILL.md 文件内容
  → remark-parse（text → mdast）
  → remark-frontmatter（Frontmatter AST 节点）
  → cord-frontmatter-parser（提取 CORD 关系声明 + Superpowers 技能元数据）
  → cord-heading-extractor（章节锚点提取）
  → cord-link-extractor（链接/引用提取）
  → cord-relation-analyzer（🎯 Superpowers 适配器规则在此介入）
  → VFile.data（结构化输出）
```

### 3.2 cord-frontmatter-parser 中的 Superpowers 数据提取

```typescript
// cord-frontmatter-parser 插件中追加 Superpowers 数据提取逻辑
function extractSuperpowersMeta(frontmatter: Record<string, unknown>, file: VFile): void {
  // 检测是否为 SKILL.md（判断依据：含 when_to_use 字段）
  if (!frontmatter.when_to_use && !frontmatter.name) return;

  file.data.cordSuperpowers = {
    skillName: frontmatter.name as string | undefined,
    description: frontmatter.description as string | undefined,
    whenToUse: frontmatter.when_to_use as string | undefined,
    version: frontmatter.version as string | undefined,
    languages: frontmatter.languages as string | string[] | undefined,
    dependencies: frontmatter.dependencies as string[] | undefined,
  };
}
```

**VFile.data 命名空间扩展**：

| 命名空间 | 写入者 | 说明 |
|---------|--------|------|
| `file.data.cordBmad` | cord-frontmatter-parser | **BMAD 特有元数据**（TR10） |
| `file.data.cordSuperpowers` | cord-frontmatter-parser | **Superpowers 特有元数据**（TR11） |
| `file.data.cordRelations` | cord-relation-analyzer | 发现的关系候选列表 |

_置信度：**HIGH** — VFile.data 命名空间扩展模式继承 TR10 已验证的约定_

## 4. RuleEngine 集成：Superpowers 预设规则注入

Superpowers 预设规则通过 `RuleEngine.register()` 注入，与 BMAD 规则共存，优先级范围相同（40-59）：

| 规则 ID | 规则名称 | 类别 | 优先级 | 映射的关系类型 | 置信度 |
|---------|---------|------|--------|-------------|--------|
| `sp-skill-dependencies` | SKILL.md dependencies 显式依赖 | structural | 28 | `derived_from` | 0.95 |
| `sp-workflow-sequence` | 工作流阶段顺序推断 | structural | 42 | `informs` / `derived_from` | 0.75 |
| `sp-when-to-use-semantic` | when_to_use 语义触发关系 | semantic | 52 | `informs` | 0.65 |
| `sp-platform-config` | 平台配置文件绑定 | structural | 58 | `belongs_to` | 0.70 |

**注意**：Superpowers 适配器规则的优先级（28-58）与 BMAD 规则（25-55）部分重叠，由 RuleEngine 的优先级排序保证一致性执行顺序。

_置信度：**HIGH** — 优先级分配延续 TR6/TR10 规则引擎设计_

## 5. dependencies 显式依赖提取集成

### 5.1 最高价值集成点（类比 BMAD 的 inputDocuments）

`dependencies` 是 Superpowers SKILL.md 中最有价值的关系信号——它直接声明了"本技能依赖哪些技能"：

```yaml
# systematic-debugging 的 SKILL.md frontmatter 示例（假设）
---
name: Systematic Debugging
description: Four-phase debugging methodology for complex issues
when_to_use: when encountering bugs that resist obvious fixes or race conditions
version: 2.1.0
dependencies:
  - verification-before-completion
  - test-driven-development
---
```

### 5.2 集成实现

```typescript
class SpSkillDependenciesRule implements IRelationRule {
  readonly id = 'sp-skill-dependencies';
  readonly name = 'Superpowers SKILL Dependencies Reference';
  readonly priority = 28;
  readonly category = 'structural' as const;

  applies(doc: DocumentMeta): boolean {
    const spMeta = doc.metadata?.cordSuperpowers;
    return spMeta?.dependencies !== undefined && spMeta.dependencies.length > 0;
  }

  execute(context: RuleExecutionContext): RelationCandidate[] {
    const deps = context.sourceDoc.metadata?.cordSuperpowers?.dependencies;
    if (!deps) return [];

    return deps
      .map(depSkillId => {
        // 依赖 ID 是技能目录名（如 'test-driven-development'）
        const targetDoc = context.allDocs.find(d =>
          d.metadata?.cordSuperpowers?.skillId === depSkillId
          || d.relativePath.includes(`/skills/${depSkillId}/SKILL.md`)
        );
        if (!targetDoc) return null;

        return {
          sourceId: context.sourceDoc.id,
          targetId: targetDoc.id,
          type: 'derived_from' as RelationType,
          confidence: 0.95,         // 显式 dependencies 声明 = 高置信度
          discoveredBy: 'rule',
          ruleId: this.id,
          metadata: {
            declaredIn: 'frontmatter.dependencies',
            framework: 'superpowers',
          },
        };
      })
      .filter(Boolean) as RelationCandidate[];
  }
}
```

**关键对比**：BMAD 的 `inputDocuments`（置信度 1.0）vs Superpowers 的 `dependencies`（置信度 0.95）——两者都是显式声明，但 `inputDocuments` 由工作流**自动生成**（零推测），而 `dependencies` 由技能作者**手动声明**（可能遗漏）。

_置信度：**HIGH** — 置信度差异基于关系声明方式的可靠性分析_

## 6. 事件驱动增量集成

当 Superpowers 技能文件更新时，CORD 通过 chokidar 或 IDE Hooks 触发增量扫描：

```
SKILL.md 文件变更（如新增 dependencies 字段）
  → chokidar 检测到 skills/systematic-debugging/SKILL.md 变更
  → ScanService.scanIncremental(['skills/systematic-debugging/SKILL.md'])
  → remark 管道重解析 SKILL.md
  → cord-frontmatter-parser 提取新的 dependencies 字段
  → SpSkillDependenciesRule 发现新增技能依赖关系
  → RelationRepository.upsertRelationsBatch()
  → 通知层：新发现 N 条技能依赖关系
```

_置信度：**HIGH** — 增量扫描模式继承 TR10 已验证的设计_

---

**集成模式分析完成日期：** 2026-04-02

---

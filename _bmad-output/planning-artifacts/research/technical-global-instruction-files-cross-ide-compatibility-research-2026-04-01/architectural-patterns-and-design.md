# Architectural Patterns and Design

> 本章节从架构设计角度分析 CORD 指令文件适配层的核心设计模式、共性抽象模型、AGENTS.md 标准化评估，以及关键架构决策记录。

## 1. 核心架构模式：适配器模式 + 抽象工厂模式

CORD 指令文件适配层的核心挑战是：**同一套指令语义需要转换为 4+ 种不同的文件格式、Frontmatter 结构和目录约定**。这完美契合 **适配器模式（Adapter Pattern）** 与 **抽象工厂模式（Abstract Factory）** 的组合应用。

```
┌──────────────────────────────────────────────────────────────┐
│                CORD Instruction Engine                        │
│                                                              │
│  ┌──────────────────────────────────┐                        │
│  │     CordInstructionIR            │                        │
│  │   (统一内部表示)                   │                        │
│  │                                  │                        │
│  │  id / version / description      │                        │
│  │  filePatterns / triggerMode       │                        │
│  │  content / contentLanguage        │                        │
│  └────────────┬─────────────────────┘                        │
│               │                                              │
│  ┌────────────▼─────────────────────┐                        │
│  │   InstructionFormatterFactory    │  ← 抽象工厂             │
│  │   create(ide: IDEType)           │                        │
│  └────────────┬─────────────────────┘                        │
│               │                                              │
│  ┌────────────▼─────────────────────────────────────────┐    │
│  │              Formatter Adapters                       │    │
│  │                                                       │    │
│  │  ┌─────────────┐ ┌─────────────┐ ┌──────────────┐   │    │
│  │  │ ClaudeCode   │ │ Cursor      │ │ Copilot      │   │    │
│  │  │ Formatter    │ │ Formatter   │ │ Formatter    │   │    │
│  │  │              │ │             │ │              │   │    │
│  │  │ paths: glob  │ │ globs: arr  │ │ applyTo: str │   │    │
│  │  │ .md file     │ │ .mdc file   │ │ .inst.md     │   │    │
│  │  └─────────────┘ └─────────────┘ └──────────────┘   │    │
│  │                                                       │    │
│  │  ┌─────────────┐ ┌─────────────┐                    │    │
│  │  │ Windsurf    │ │ AgentsMd    │                    │    │
│  │  │ Formatter   │ │ Formatter   │                    │    │
│  │  │             │ │             │                    │    │
│  │  │ trigger:    │ │ <!-- CORD   │                    │    │
│  │  │ glob+globs  │ │ :BEGIN -->  │                    │    │
│  │  └─────────────┘ └─────────────┘                    │    │
│  └───────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

**设计决策理由：**

| 决策 | 选择 | 理由 |
|------|------|------|
| **为什么用适配器而非策略？** | IR → Formatter 的转换是 **格式适配**（同一语义、不同表现），非 **行为策略**（不同算法选择） | 适配器模式语义更精确 |
| **为什么用抽象工厂？** | 每个 IDE 需要一组相关对象（Formatter + Detector + Writer） | 抽象工厂封装一族对象创建 |
| **与 TR4 策略模式的关系？** | TR4 的 `TriggerStrategy` 处理 Hook 触发行为（行为差异），TR7 的 Formatter 处理指令格式转换（数据适配）。两者互补不冲突 | 正交职责 |

_置信度：🟢 高 — 适配器+工厂模式是跨平台数据格式转换的经典组合_

---

## 2. 指令抽象模型：CORD Instruction Model

基于 Step 2 各 IDE 的格式分析，提炼出跨 IDE 的 **共性抽象模型**——CORD Instruction Model：

### 2.1 共性维度提炼

通过分析四大 IDE 的指令文件体系，识别出 **5 个共性维度** 和 **3 个差异维度**：

**共性维度（所有 IDE 都有）：**

| 维度 | Claude Code | Cursor | Copilot | Windsurf | 抽象名称 |
|------|------------|--------|---------|----------|----------|
| 指令正文 | Markdown 内容 | Markdown 内容 | Markdown 内容 | Markdown 内容 | `content` |
| 文件匹配 | `paths` | `globs` | `applyTo` | `globs` | `filePatterns` |
| 作用域层级 | 策略/用户/项目/目录 | 团队/项目/用户 | 组织/仓库/个人 | 系统/用户/工作区 | `scope` |
| 优先级方向 | 具体 > 宽泛 | 团队 > 项目 > 用户 | 个人 > 仓库 > 组织 | 系统 → 用户 → 工作区 | `precedence` |
| 版本控制 | `.claude/` 可 Git | `.cursor/` 可 Git | `.github/` 可 Git | `.windsurf/` 可 Git | `versionControlled` |

**差异维度（部分 IDE 有）：**

| 维度 | Claude Code | Cursor | Copilot | Windsurf | 抽象处理 |
|------|------------|--------|---------|----------|----------|
| 智能判断触发 | ❌ | ✅ `description` | ❌ | ✅ `model_decision` | 可选字段 `description` |
| 手动触发 | ❌ | ✅ `@规则名` | ❌ | ✅ `@规则名` | 可选字段 `manualTrigger` |
| Agent 排除 | ❌ | ❌ | ✅ `excludeAgent` | ❌ | 可选字段 `excludeAgents` |

### 2.2 统一抽象模型定义

```typescript
/**
 * CORD Instruction Model — 跨 IDE 指令的统一抽象表示
 *
 * 设计原则：
 * 1. 共性字段为必填，差异字段为可选
 * 2. 内部格式与任何 IDE 的原生格式解耦
 * 3. 支持 IR → 各 IDE 格式的无损转换
 */
interface CordInstructionModel {
  // === 元数据 ===
  id: string;                       // 全局唯一标识 "cord-relations"
  version: string;                  // 语义化版本 "1.0.0"
  cordVersion: string;              // CORD CLI 版本约束 ">=0.1.0"

  // === 共性字段（所有 IDE 均映射）===
  content: string;                  // Markdown 指令正文
  filePatterns: string[];           // Glob 模式数组（统一为数组格式）
  scope: InstructionScope;          // 'project' | 'user' | 'global'
  versionControlled: boolean;       // 是否纳入 Git 版本控制

  // === 差异字段（可选，部分 IDE 映射）===
  description?: string;             // 规则描述（Cursor/Windsurf 智能判断模式）
  triggerMode?: TriggerMode;        // 触发模式
  manualTrigger?: string;           // 手动触发标识（@name）
  excludeAgents?: string[];         // 排除特定 Agent（Copilot）
  contentLanguage?: string;         // 内容语言（i18n 支持）
}

type InstructionScope = 'project' | 'user' | 'global';
type TriggerMode = 'always' | 'file_match' | 'intelligent' | 'manual';
```

### 2.3 IR → IDE 格式转换规则表

| IR 字段 | Claude Code `.md` | Cursor `.mdc` | Copilot `.instructions.md` | Windsurf `.md` | AGENTS.md |
|---------|-------------------|---------------|---------------------------|----------------|-----------|
| `content` | 正文 | 正文 | 正文 | 正文 | `<!-- CORD:BEGIN -->` 区块 |
| `filePatterns` | `paths: [...]` | `globs: [...]` | `applyTo: "p1,p2"` | `globs: "p1,p2"` | 忽略（无此能力） |
| `description` | 忽略 | `description: "..."` | 忽略 | 可选正文首段 | 忽略 |
| `triggerMode: always` | 无 frontmatter | `alwaysApply: true` | 仓库级文件 | `trigger: always_on` | 直接写入 |
| `triggerMode: file_match` | `paths: [...]` | `globs: [...]` | `applyTo: "..."` | `trigger: glob` | 忽略 |
| `triggerMode: intelligent` | 降级为 always | `description` + 无 glob | 降级为 always | `trigger: model_decision` | 降级为 always |
| `triggerMode: manual` | 降级为 always | 无 frontmatter | 降级为 always | `trigger: manual` | 降级为 always |
| `excludeAgents` | 忽略 | 忽略 | `excludeAgent: "..."` | 忽略 | 忽略 |
| `version` | `<!-- cord:1.0.0 -->` | `<!-- cord:1.0.0 -->` | `<!-- cord:1.0.0 -->` | `<!-- cord:1.0.0 -->` | 标记区块内 |

**降级策略原则：** 当目标 IDE 不支持某触发模式时，降级为 **更宽泛的模式**（如 `intelligent` → `always`），确保指令始终被加载，不丢失。

_置信度：🟢 高 — 降级策略遵循"宽容原则"：宁可多加载（浪费少量 Token）也不遗漏_

---

## 3. 文件系统交互模式：模板方法模式 + 防御性编程

### 3.1 配置文件写入流程（模板方法）

所有 IDE 的指令文件写入共享同一流程骨架，差异部分由子类实现：

```typescript
abstract class InstructionWriter {
  /**
   * 模板方法 — 定义统一的写入流程
   */
  async write(ir: CordInstructionModel, projectPath: string): Promise<WriteResult> {
    // 1. 确保目标目录存在
    await this.ensureDirectory(projectPath);

    // 2. 检查已有文件
    const existing = await this.readExisting(projectPath);

    // 3. 格式化 IR 为目标格式
    const formatted = this.format(ir);

    // 4. 决定合并策略
    const strategy = this.decideMergeStrategy(existing, formatted);

    // 5. 执行写入
    return this.executeWrite(formatted, strategy, projectPath);
  }

  // 抽象方法 — 各 IDE 实现差异
  abstract format(ir: CordInstructionModel): string;
  abstract getTargetPath(projectPath: string): string;
  abstract decideMergeStrategy(existing: string | null, formatted: string): MergeStrategy;

  // 共享方法
  protected async ensureDirectory(projectPath: string): Promise<void> {
    const dir = path.dirname(this.getTargetPath(projectPath));
    await fs.mkdir(dir, { recursive: true });
  }
}
```

### 3.2 防御性编程原则

| 原则 | 实现 | 目的 |
|------|------|------|
| **不删除用户文件** | 仅操作 CORD 标识的文件/区块 | 防止误删用户指令 |
| **不覆盖用户内容** | 独立文件或标记区块 | 保护用户自定义指令 |
| **原子性写入** | 写入临时文件 → 重命名 | 防止半写入导致损坏 |
| **备份机制** | 升级前备份 `.cord/backups/` | 支持回退 |
| **幂等性** | 多次执行 `cord init` 结果一致 | 安全重复执行 |
| **版本保护** | 检测到更高版本时警告不覆盖 | 防止降级覆盖用户修改 |

---

## 4. AGENTS.md 标准化评估与战略定位

### 4.1 标准化成熟度评估

| 评估维度 | 当前状态 | 成熟度 |
|----------|----------|--------|
| **治理结构** | Agentic AI Foundation（Linux Foundation 旗下），OpenAI/Cursor/Factory 等贡献 | 🟢 高 |
| **工具支持广度** | 25+ 工具原生支持（几乎覆盖所有主流 AI IDE 和 Agent） | 🟢 高 |
| **格式规范** | 仅"纯 Markdown，无 Schema"——极简但缺乏精确性 | 🟡 中 |
| **版本管理** | 无版本号、无 changelog、无兼容性承诺 | 🔴 低 |
| **验证工具** | 无 linter、无 validator、无 Schema 验证 | 🔴 低 |
| **内容约定** | 仅有"示例"级别的推荐结构（Dev / Testing / PR 章节） | 🟡 中 |
| **目录层级行为** | "最近的 AGENTS.md 优先"——但各 IDE 实现可能不一致 | 🟡 中 |

**综合成熟度：** 🟡 **早期采用阶段**（Early Adoption）

- 治理和工具覆盖已达生产水平
- 格式规范和验证工具仍处于 MVP 状态
- 预期 2026-2027 年将出现更正式的 Schema 和版本化规范

### 4.2 AGENTS.md 对比各 IDE 原生指令文件

| 维度 | AGENTS.md | 各 IDE 原生规则 |
|------|-----------|---------------|
| **覆盖范围** | 25+ 工具 | 仅该 IDE |
| **触发控制** | ❌ 无 | ✅ 精细控制 |
| **文件匹配** | ❌ 无 | ✅ Glob 模式 |
| **智能判断** | ❌ 无 | ✅ Cursor/Windsurf |
| **上下文开销** | 🔴 全量加载 | 🟢 按需加载 |
| **Frontmatter** | ❌ 无 | ✅ 结构化元数据 |
| **标准化** | ✅ 开放标准 | ❌ 各自为政 |

**结论：AGENTS.md 是"最大公约数"，但不是"最优解"。**

### 4.3 CORD 对 AGENTS.md 的战略定位

| 策略 | 描述 | 推荐度 |
|------|------|--------|
| **A: AGENTS.md 优先** | 仅维护 AGENTS.md，各 IDE 自动读取 | ❌ 不推荐 — 丧失触发控制能力 |
| **B: AGENTS.md 兜底** | 各 IDE 原生规则为主，AGENTS.md 为通用兜底 | ✅ 推荐 — 最佳覆盖 + 最优体验 |
| **C: 不使用 AGENTS.md** | 仅维护各 IDE 原生规则 | ❌ 不推荐 — 丧失对 25+ 工具的兼容 |

**选择方案 B 的理由：**

```
用户使用 Claude Code?
  └── ✅ → .claude/rules/cord-relations.md（精准触发 + 路径匹配）

用户使用 Cursor?
  └── ✅ → .cursor/rules/cord-relations.mdc（智能判断 + Glob 匹配）

用户使用 Copilot?
  └── ✅ → .github/instructions/cord-relations.instructions.md（路径匹配）

用户使用 Windsurf?
  └── ✅ → .windsurf/rules/cord-relations.md（Glob 触发）

用户使用其他 25+ 工具中的任何一个?
  └── ✅ → AGENTS.md 兜底（全量加载，无触发控制，但功能可用）
```

_置信度：🟢 高 — "原生规则 + 通用兜底"是跨平台兼容性的最优策略_

---

## 5. 跨 IDE 指令一致性架构

### 5.1 语义一致性保证

同一条 CORD 指令在不同 IDE 中的表现应 **语义等价**，即使格式不同：

```
┌─────────────────────────────────────────────────────────┐
│           语义等价层（Semantic Equivalence）              │
│                                                          │
│  "当修改 Markdown 文档时，调用 cord_update_relations"    │
│                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │Claude    │ │Cursor    │ │Copilot   │ │Windsurf  │   │
│  │          │ │          │ │          │ │          │   │
│  │ paths 限 │ │ globs 限 │ │ applyTo  │ │ trigger  │   │
│  │ 定到 .md │ │ 定到 .md │ │ 限定 .md │ │ glob .md │   │
│  │          │ │          │ │          │ │          │   │
│  │ 按需加载 │ │ 按需加载 │ │ 按需加载 │ │ 按需加载 │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│                                                          │
│  ✅ 相同触发条件 → 相同指令内容 → 相同 AI 行为           │
└─────────────────────────────────────────────────────────┘
```

### 5.2 行为差异不可避免的领域

| 领域 | 差异表现 | CORD 应对 |
|------|----------|----------|
| **AI 遵循率** | 各 AI 模型对指令的遵循率不同 | 接受差异，指令写法针对性优化 |
| **上下文加载时机** | Claude Code 按需 vs AGENTS.md 全量 | 按 IDE 能力最优化 |
| **智能判断** | 仅 Cursor/Windsurf 支持 | 无智能判断的 IDE 降级为文件匹配 |
| **指令可见性** | 用户在各 IDE 中看到的指令展示方式不同 | 文档化各 IDE 的查看方式 |

---

## 6. 关键架构决策记录（ADR）

### ADR-TR7-001: CORD 指令文件命名约定

| 选项 | 示例 | 优势 | 劣势 | 结论 |
|------|------|------|------|------|
| **cord-relations** | `.claude/rules/cord-relations.md` | 清晰表达 CORD 用途 | 名称较长 | ✅ 推荐 |
| **cord** | `.claude/rules/cord.md` | 简短 | 不够描述性 | ❌ |
| **document-relations** | `.claude/rules/document-relations.md` | 描述功能 | 不包含 CORD 品牌 | ❌ |

**决策：** 统一使用 `cord-relations` 作为文件名前缀（不含后缀）。各 IDE 的后缀由格式决定。

### ADR-TR7-002: Frontmatter Glob 语法标准化

| 问题 | 决策 |
|------|------|
| IR 内部用什么格式？ | **数组格式** `["**/*.md", "**/*.mdx"]` |
| 为什么不用逗号字符串？ | 数组更安全（Glob 模式可能包含逗号） |
| 转换到 Copilot/Windsurf 的逗号格式？ | Formatter 负责 `array.join(',')` |

### ADR-TR7-003: 指令内容是否随 IDE 差异化

| 选项 | 描述 | 结论 |
|------|------|------|
| **A: 统一内容** | 所有 IDE 使用完全相同的 Markdown 指令正文 | ✅ 推荐 |
| **B: 差异化内容** | 根据 IDE 能力差异调整指令措辞 | ❌ 不推荐（维护成本高） |

**决策：** 指令正文保持 **内容一致**，差异仅体现在 Frontmatter 格式上。

### ADR-TR7-004: CORD 在 AGENTS.md 中的位置策略

| 选项 | 描述 | 结论 |
|------|------|------|
| **文件末尾追加** | 在已有内容后追加 CORD 区块 | ✅ 推荐 |
| **文件开头插入** | 在已有内容前插入 | ❌ 不推荐（改变用户内容的相对位置） |
| **按字母序插入** | 找到合适的章节位置插入 | ❌ 不推荐（解析复杂度高，易出错） |

**决策：** 始终在 AGENTS.md **末尾追加** CORD 标记区块。

### ADR-TR7-005: 指令内容的 i18n（国际化）策略

| 选项 | 描述 | 结论 |
|------|------|------|
| **A: 仅英文** | 所有指令片段仅英文 | 🟡 可接受（AI 理解英文最佳） |
| **B: 跟随项目语言** | 检测项目主要语言，使用对应语言 | ✅ 推荐 |
| **C: 用户选择** | `cord init --lang zh` 指定语言 | ✅ 推荐（作为 B 的覆盖选项） |

**决策：** 默认英文（方案 A），支持 `--lang` 参数覆盖（方案 C）。IR 中的 `contentLanguage` 字段控制。

_Source: 基于 Gang of Four 设计模式、CORD 项目需求分析及 TR4 架构基础_

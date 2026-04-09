# Implementation Approaches and Technology Adoption（实现方案与技术采纳）

本节将前四步的技术栈、集成模式和架构设计转化为可执行的实施计划——分阶段交付路线图、开发工作流、测试策略、性能约束和风险评估。

## 1. 分阶段实现路线图

### 1.1 与 TR6 冷启动扫描器路线图的对齐

TR10 BMAD 适配器已嵌入 TR6 的 Phase A（MVP）和 Phase D（完善）。TR11 Superpowers 适配器同样遵循这一策略，但由于工作量更小，可**整体在 Phase A 或 Phase D 一次性交付**：

```
Phase A（2-3 周）：规则引擎核心 ← Superpowers 适配器基础版可选嵌入
  ├─ SuperpowersDetector（三层检测）
  ├─ SuperpowersSkillRegistry（14 个技能声明式配置）
  ├─ SpSkillDependenciesRule（置信度 0.95）
  └─ SpWorkflowSequenceRule（置信度 0.75）

Phase D（2-3 周）：LLM + 反馈 ← Superpowers 适配器完善版
  ├─ SpWhenToUseSemanticRule（置信度 0.65）
  ├─ SpPlatformConfigRule（置信度 0.70）
  ├─ ISuperpowersFrameworkAdapter 扩展接口
  ├─ SuperpowersWorkflowModel（7 阶段拓扑）
  └─ AbstractFrameworkAdapter 基类抽取
```

**推荐策略**：优先在 Phase D 一次性交付（4-6 天），避免两阶段分散增加协调成本；若 Phase A 进度宽裕，可提前交付 MVP 版本（2-3 天）。

### 1.2 Superpowers 适配器单阶段交付策略

**Phase 1：完整交付（4-6 天总工作量）**

| 交付物 | 优先级 | 工作量 | 说明 |
|--------|--------|--------|------|
| `AbstractFrameworkAdapter` 基类 | P0 | 0.5 天 | 从 BMAD 适配器抽取公共工具方法 |
| `SuperpowersDetector` | P0 | 0.5 天 | 三层递进检测，85-99% 置信度 |
| `SuperpowersSkillRegistry` | P0 | 1 天 | 14 个技能声明式配置 + 检测逻辑 |
| `SpSkillDependenciesRule` | P0 | 0.5 天 | frontmatter.dependencies → derived_from |
| `SpWorkflowSequenceRule` | P1 | 0.5 天 | 基于 workflow 配置的顺序推断 |
| `SuperpowersSkillParser` | P1 | 0.5 天 | SKILL.md 元数据解析 |
| `SpWhenToUseSemanticRule` | P2 | 0.5 天 | when_to_use 关键词簇匹配 |
| `SpPlatformConfigRule` | P2 | 0.5 天 | 平台目录绑定关系 |
| 单元测试 | P0 | 0.5 天 | 每个组件独立测试 |

**总工作量**：4-6 天（单阶段，比 BMAD 适配器 6-9 天更轻量）

**工作量差异原因**：
- Superpowers 技能数量（14）< BMAD 文档类型（18），类型定义工作量更小
- SKILL.md 结构比 BMAD 文档更简单（单一文件格式，frontmatter 字段少）
- 无需处理多输出目录配置（无 config.yaml 等价物）
- `AbstractFrameworkAdapter` 基类抽取可复用 BMAD 适配器代码

_置信度：**MEDIUM-HIGH** — 工作量估算基于与 TR10 BMAD 适配器（6-9 天）的复杂度对比，浮动 ±30%_

## 2. 开发工作流

### 2.1 文件结构规划

```
src/
  frameworks/
    ├─ framework-adapter.interface.ts         ← IFrameworkAdapter 接口定义
    ├─ abstract-framework-adapter.ts          ← ★ TR11 新增：抽象基类
    ├─ framework-registry.ts                  ← FrameworkRegistry 实现
    ├─ generic-markdown/
    │   └─ generic-markdown-adapter.ts
    ├─ bmad/                                  ← TR10 BMAD 适配器（已有）
    │   └─ ...
    └─ superpowers/                           ← TR11 Superpowers 适配器
        ├─ index.ts                           ← 模块入口
        ├─ superpowers-framework-adapter.ts   ← 适配器主类
        ├─ superpowers-detector.ts            ← 框架检测
        ├─ superpowers-skill-registry.ts      ← 技能类型注册表
        ├─ superpowers-skill-parser.ts        ← SKILL.md 元数据解析
        ├─ superpowers-workflow-model.ts      ← 7 阶段工作流模型
        ├─ superpowers-skills.ts              ← 14 个技能声明式定义
        ├─ rules/                             ← 预设规则
        │   ├─ sp-skill-dependencies.rule.ts
        │   ├─ sp-workflow-sequence.rule.ts
        │   ├─ sp-when-to-use-semantic.rule.ts
        │   └─ sp-platform-config.rule.ts
        └─ __tests__/                         ← 测试
            ├─ superpowers-detector.test.ts
            ├─ superpowers-skill-registry.test.ts
            ├─ sp-skill-dependencies.rule.test.ts
            ├─ sp-workflow-sequence.rule.test.ts
            └─ superpowers-framework-adapter.integration.test.ts
```

### 2.2 开发顺序（依赖关系驱动）

```
Step 1: 基础设施（依赖 TR10）
  ├─ 从 BmadFrameworkAdapter 抽取 AbstractFrameworkAdapter
  └─ BmadFrameworkAdapter 改继承 AbstractFrameworkAdapter（零功能变更）

Step 2: 检测（无外部依赖）
  └─ SuperpowersDetector

Step 3: 技能类型系统
  ├─ SuperpowersSkillDefinition 数据结构
  ├─ SUPERPOWERS_SKILLS 声明式定义数组
  └─ SuperpowersSkillRegistry

Step 4: 元数据解析
  └─ SuperpowersSkillParser（解析 SKILL.md frontmatter）

Step 5: 预设规则（依赖 Step 3-4）
  ├─ SpSkillDependenciesRule（P0）
  └─ SpWorkflowSequenceRule（P1）

Step 6: 适配器主类组装
  └─ SuperpowersFrameworkAdapter（组合 Step 2-5）

Step 7: 增强规则（可选，Phase D）
  ├─ SpWhenToUseSemanticRule
  └─ SpPlatformConfigRule

Step 8: 集成验证
  └─ 端到端测试（Superpowers 适配器 + RuleEngine + remark 管道）
```

## 3. 测试策略

### 3.1 测试金字塔

```
           /\
          /  \
         / E2E\          ← 1-2 个端到端测试
        / 集成  \         ← 3-5 个集成测试
       / 测试    \
      /──────────\
     /  单元测试   \      ← 12-16 个单元测试（略少于 BMAD 的 15-20，技能数量更少）
    /──────────────\
```

### 3.2 单元测试策略

| 模块 | 测试重点 | 测试用例数 |
|------|---------|----------|
| SuperpowersDetector | 三层检测的各种场景（有/无 package.json；有/无平台目录） | 5-7 |
| SuperpowersSkillRegistry | 14 个技能的检测准确性 | 14+ |
| SpSkillDependenciesRule | dependencies 解析与技能文档匹配 | 3-5 |
| SpWorkflowSequenceRule | 工作流顺序推断准确性 | 4-6 |
| SpWhenToUseSemanticRule | 语义关键词簇匹配 | 3-5 |
| SuperpowersSkillParser | SKILL.md frontmatter 解析与容错 | 3-5 |

### 3.3 测试数据策略

| 策略 | 说明 | 适用场景 |
|------|------|---------|
| **Superpowers 仓库本身** | clone obra/superpowers 作为集成测试 fixture | 集成测试、E2E 测试 |
| **Fixture 文件** | 在 `__tests__/fixtures/superpowers/` 构造最小化 SKILL.md 文件 | 单元测试 |
| **Mock 工厂** | `createMockSkillDoc(skillId, overrides)` 工厂函数 | 单元测试 |

**关键测试场景**：
- ✅ 标准 Superpowers 安装（含 package.json）→ detect() = true, confidence = 0.99
- ✅ 仅 skills/ 目录（无 package.json）→ detect() = true, confidence = 0.85
- ✅ skills/ 目录存在但无 SKILL.md → detect() = false
- ✅ BMAD + Superpowers 共存项目 → 两个适配器均返回 true
- ✅ 含 dependencies 的 SKILL.md → SpSkillDependenciesRule 发现正确关系
- ✅ 非 Superpowers 项目（如 React 项目有 src/skills/ 目录）→ detect() = false（通过 package.json name 鉴别）

## 4. 性能约束与优化

| 指标 | 目标 | 说明 |
|------|------|------|
| **检测延迟** | < 15ms | 比 BMAD 略慢（需要 glob `skills/*/SKILL.md`） |
| **技能解析延迟** | < 3ms/SKILL.md | frontmatter 字段匹配，文件小 |
| **规则执行延迟** | < 30ms/文档 | 4 条规则对单个 SKILL.md 的执行时间 |
| **全量扫描** | < 200ms（14 个 SKILL.md） | 包括检测 + 解析 + 规则执行 |
| **内存占用** | < 3MB 增量 | 技能元数据体积小（每个 SKILL.md < 500 词） |

**性能优势**：Superpowers 适配器处理的是**小型 SKILL.md 文件**（严格的 Token 效率要求：<500 词），比 BMAD 的大型分析文档（数万字）处理速度快得多。

## 5. 风险评估与缓解

| 风险 | 概率 | 影响 | 缓解策略 |
|------|------|------|---------|
| **R1: Superpowers 版本升级（v6+）改变 SKILL.md schema** | 中 | 中 | 仅依赖核心稳定字段（name、when_to_use、dependencies）；新字段作为可选增强 |
| **R2: dependencies 字段未被技能作者填写** | 高 | 中 | `dependencies` 未填写时降级到工作流顺序推断（0.75）；不影响适配器运行 |
| **R3: skills/ 目录命名与其他项目冲突** | 中 | 低 | 通过 package.json name 字段精确排除非 Superpowers 项目；three-layer 检测兜底 |
| **R4: when_to_use 语义分析误判（false positive）** | 中 | 低 | 关键词簇匹配置信度已设置为 0.65（低于其他规则）；用户 `cord review` 可校正 |
| **R5: 社区技能库（obra/superpowers-skills 已归档）** | — | 低 | 社区扩展技能可通过用户自定义 `customSkills` 配置项追加 |
| **R6: BMAD + Superpowers 共存时规则优先级冲突** | 低 | 低 | 规则优先级范围区分（BMAD: 25-55，Superpowers: 28-58），RuleEngine 按优先级排序执行 |

## 6. 成功指标与验收标准

| 指标 | 标准 | 验证方式 |
|------|------|---------|
| **检测准确率** | 标准 Superpowers 安装检测到 = true | 集成测试（使用 obra/superpowers fixture） |
| **技能识别率** | 14 个已知技能识别率 ≥ 90% | 单元测试 |
| **dependencies 提取率** | 含 dependencies 的 SKILL.md 100% 提取 | 集成测试 |
| **工作流推断率** | 12 条关系对中 ≥ 75% 被正确推断 | 集成测试 |
| **零误判** | 非 Superpowers 项目中 detect() = false | 负面测试（React/Vue 项目） |
| **共存测试** | BMAD + Superpowers 共存时两个适配器均正常工作 | 共存集成测试 |
| **基类无回归** | AbstractFrameworkAdapter 引入后 BMAD 适配器测试全部通过 | 回归测试 |

---

**实现方案分析完成日期：** 2026-04-02

---

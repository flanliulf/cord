# Implementation Approaches and Technology Adoption（实现方案与技术采纳）

本节将前四步的技术栈、集成模式和架构设计转化为可执行的实施计划——分阶段交付路线图、开发工作流、测试策略、性能约束和风险评估。

## 1. 分阶段实现路线图

### 1.1 与 TR6 冷启动扫描器路线图的对齐

TR6 规划了冷启动扫描器的 4 阶段实现路线图（Phase A-D，8-11 周），并明确建议：「**Phase A 即包含 BMAD 适配器基础版，Phase D 完善**」。本研究对此建议进行细化：

```
Phase A（2-3 周）：规则引擎核心 ← BMAD 适配器 Phase 1 嵌入
  ├─ BmadDetector（三层检测）
  ├─ BmadDocTypeRegistry（18 种类型，声明式配置）
  ├─ BmadInputDocumentsRule（置信度 1.0）
  └─ BmadDocumentChainRule（置信度 0.85，基础版）

Phase B（1-2 周）：增量扫描 + CLI
  └─ BMAD 增量扫描支持（BMAD 文档变更检测）

Phase D（2-3 周）：LLM + 反馈 ← BMAD 适配器 Phase 2 完善
  ├─ BmadPhaseGateRule（置信度 0.80）
  ├─ BmadLifecycleRule（置信度 0.75）
  ├─ BmadNamingConventionRule（置信度 0.70）
  ├─ IBmadFrameworkAdapter 扩展接口
  ├─ BmadPhaseModel（阶段拓扑）
  └─ 多版本兼容（BmadVersionStrategy）
```

### 1.2 BMAD 适配器两阶段交付策略

**Phase 1：MVP 基础（随 Phase A 交付，3-5 天工作量）**

| 交付物 | 优先级 | 工作量 | 说明 |
|--------|--------|--------|------|
| `BmadDetector` | P0 | 0.5 天 | 三层递进检测，98% 置信度 |
| `BmadDocTypeRegistry` | P0 | 1 天 | 18 种类型声明式配置 + 5 层检测 |
| `BmadInputDocumentsRule` | P0 | 0.5 天 | frontmatter.inputDocuments → derived_from |
| `BmadDocumentChainRule` | P1 | 1 天 | 基于 chain 配置的产出链推断 |
| `BmadConfigReader` | P1 | 0.5 天 | 读取 config.yaml 输出目录配置 |
| 单元测试 | P0 | 0.5 天 | 每个组件独立测试 |

**Phase 2：完善增强（随 Phase D 交付，3-4 天工作量）**

| 交付物 | 优先级 | 工作量 | 说明 |
|--------|--------|--------|------|
| `BmadPhaseGateRule` | P2 | 0.5 天 | 阶段门一致性约束 |
| `BmadLifecycleRule` | P2 | 0.5 天 | 文档生命周期绑定 |
| `BmadNamingConventionRule` | P2 | 0.5 天 | story-N-M 命名层级推断 |
| `IBmadFrameworkAdapter` 扩展接口 | P2 | 0.5 天 | getPhaseTopology() 等 |
| `BmadPhaseModel` | P2 | 0.5 天 | 阶段拓扑数据模型 |
| 多版本兼容 | P3 | 0.5 天 | BmadVersionStrategy |
| 集成测试 | P1 | 0.5 天 | 与 RuleEngine + remark 管道端到端测试 |

**总工作量**：6-9 天（分散在 Phase A 和 Phase D 中）

_置信度：**MEDIUM-HIGH** — 工作量估算基于模块复杂度分析，实际可能因实现细节浮动 ±30%_

## 2. 开发工作流

### 2.1 文件结构规划

```
src/
  frameworks/
    ├─ framework-adapter.interface.ts    ← IFrameworkAdapter 接口定义
    ├─ framework-registry.ts             ← FrameworkRegistry 实现
    ├─ generic-markdown/                 ← 通用 Markdown 适配器
    │   └─ generic-markdown-adapter.ts
    └─ bmad/                             ← BMAD 适配器模块
        ├─ index.ts                      ← 模块入口（导出 BmadFrameworkAdapter）
        ├─ bmad-framework-adapter.ts     ← 适配器主类
        ├─ bmad-detector.ts              ← 框架检测
        ├─ bmad-config-reader.ts         ← config.yaml 读取
        ├─ bmad-doc-type-registry.ts     ← 文档类型注册表
        ├─ bmad-phase-model.ts           ← 阶段拓扑模型
        ├─ bmad-doc-types.ts             ← 18 种类型的声明式定义
        ├─ rules/                        ← 预设规则
        │   ├─ bmad-input-documents.rule.ts
        │   ├─ bmad-document-chain.rule.ts
        │   ├─ bmad-phase-gate.rule.ts
        │   ├─ bmad-lifecycle.rule.ts
        │   └─ bmad-naming-convention.rule.ts
        ├─ strategies/                   ← 版本策略
        │   ├─ bmad-version-strategy.interface.ts
        │   ├─ bmad-v6-strategy.ts
        │   └─ bmad-default-strategy.ts
        └─ __tests__/                    ← 测试
            ├─ bmad-detector.test.ts
            ├─ bmad-doc-type-registry.test.ts
            ├─ bmad-input-documents.rule.test.ts
            ├─ bmad-document-chain.rule.test.ts
            └─ bmad-framework-adapter.integration.test.ts
```

### 2.2 开发顺序（依赖关系驱动）

```
Step 1: 接口与基础设施
  ├─ IFrameworkAdapter 接口定义
  ├─ IBmadFrameworkAdapter 扩展接口
  └─ FrameworkRegistry 实现

Step 2: 检测与配置（无外部依赖）
  ├─ BmadDetector
  └─ BmadConfigReader

Step 3: 文档类型系统
  ├─ DocTypeDefinition 数据结构
  ├─ BMAD_DOC_TYPES 声明式定义数组
  └─ BmadDocTypeRegistry

Step 4: 预设规则（依赖 Step 3）
  ├─ BmadInputDocumentsRule
  └─ BmadDocumentChainRule

Step 5: 适配器主类组装
  └─ BmadFrameworkAdapter（组合 Step 2-4）

Step 6: 集成验证
  └─ 端到端测试（BmadAdapter + RuleEngine + remark 管道）
```

_置信度：**HIGH** — 基于模块依赖关系的标准开发顺序_

## 3. 测试策略

### 3.1 测试金字塔

```
           /\
          /  \
         / E2E\          ← 1-2 个端到端测试
        / 集成  \         ← 3-5 个集成测试
       / 测试    \
      /──────────\
     /  单元测试   \      ← 15-20 个单元测试
    /──────────────\
```

### 3.2 单元测试策略

| 模块 | 测试重点 | 测试用例数 | Mock 依赖 |
|------|---------|----------|----------|
| BmadDetector | 三层检测算法的各种场景 | 5-8 | 文件系统 Mock |
| BmadDocTypeRegistry | 18 种类型的检测准确性 | 18+ | — |
| BmadInputDocumentsRule | inputDocuments 解析与匹配 | 3-5 | DocumentMeta Mock |
| BmadDocumentChainRule | 产出链推断准确性 | 5-8 | DocumentMeta Mock |
| BmadPhaseGateRule | 阶段门约束检测 | 3-5 | DocumentMeta Mock |
| BmadConfigReader | config.yaml 解析与容错 | 3-5 | 文件系统 Mock |

### 3.3 集成测试策略

```typescript
// 集成测试：BMAD 适配器 + RuleEngine + 真实 BMAD 文件
describe('BmadFrameworkAdapter Integration', () => {
  it('should detect BMAD framework in CORD project', async () => {
    const adapter = new BmadFrameworkAdapter();
    const result = await adapter.detect('/path/to/cord');
    expect(result).toBe(true);
  });

  it('should discover inputDocuments relations from real PRD', async () => {
    const ruleEngine = new RuleEngine();
    const adapter = new BmadFrameworkAdapter();
    adapter.getPresetRules().forEach(r => ruleEngine.register(r));

    const prdDoc = buildDocMetaFromFile('_bmad-output/planning-artifacts/prd.md');
    const allDocs = scanAllBmadOutputDocs();

    const relations = ruleEngine.execute({
      sourceDoc: prdDoc,
      allDocs,
      astData: parsedVFileData,
      projectConfig,
    });

    expect(relations.some(r =>
      r.type === 'derived_from' && r.confidence === 1.0
    )).toBe(true);
  });
});
```

### 3.4 测试数据策略

| 策略 | 说明 | 适用场景 |
|------|------|---------|
| **CORD 项目自身** | 使用 CORD 项目的 `_bmad-output/` 作为真实测试数据 | 集成测试、E2E 测试 |
| **Fixture 文件** | 在 `__tests__/fixtures/` 中构造最小化的 BMAD 文件结构 | 单元测试 |
| **Mock 工厂** | `createMockBmadDoc(type, overrides)` 工厂函数 | 单元测试 |

**关键优势**：CORD 项目本身就是 BMAD 框架的使用者——拥有完整的 `_bmad/` 目录和 `_bmad-output/` 产出文件，是天然的集成测试场景。

_置信度：**HIGH** — 使用自身项目作为测试场景是最佳的 dogfooding 策略_

## 4. 性能约束与优化

### 4.1 性能目标

| 指标 | 目标 | 说明 |
|------|------|------|
| **检测延迟** | < 10ms | `detect()` 仅涉及 2-3 次 `fs.existsSync()` |
| **类型识别延迟** | < 5ms/文档 | Frontmatter 字段匹配 + 文件路径匹配 |
| **规则执行延迟** | < 50ms/文档 | 5 条规则对单文档的执行时间 |
| **全量扫描** | < 500ms（50 BMAD 文档） | 包括检测 + 类型识别 + 规则执行 |
| **内存占用** | < 5MB 增量 | 适配器加载后的额外内存 |

### 4.2 优化策略

| 优化点 | 策略 | 预期收益 |
|--------|------|---------|
| **检测缓存** | `detect()` 结果缓存，项目生命周期内不重复检测 | 消除重复 IO |
| **类型缓存** | 文档类型识别结果缓存到 `DocumentMeta.bmadDocType` | 避免重复正则匹配 |
| **懒加载** | config.yaml / module-help.csv 首次访问时才读取 | 减少启动开销 |
| **批量规则** | `RuleEngine.execute()` 已支持批量过滤 + 批量执行 | TR6 已优化 |

_置信度：**HIGH** — 性能目标基于纯内存计算和少量文件 IO 的场景分析_

## 5. 风险评估与缓解

| 风险 | 概率 | 影响 | 缓解策略 |
|------|------|------|---------|
| **R1: BMAD 版本大改（v7+）导致适配器失效** | 中 | 高 | 版本策略模式隔离；宽松检测仅依赖稳定信号（`_bmad/` 目录） |
| **R2: inputDocuments 字段在新版本中改名/移除** | 低 | 高 | 作为可选字段处理；无此字段时降级到文档链推断（0.85 vs 1.0） |
| **R3: BMAD 输出目录结构变更** | 中 | 中 | 从 config.yaml 动态读取路径而非硬编码 |
| **R4: 文档类型检测误判（false positive）** | 低 | 中 | 5 层递进检测 + 置信度加权；最终由用户 `cord review` 校正 |
| **R5: 规则数量膨胀导致性能下降** | 低 | 低 | 5 条 BMAD 规则对性能无实质影响（<50ms/文档）；设置规则上限警告 |
| **R6: 19 条预设关系对的覆盖不完整** | 中 | 低 | Phase 2 根据实际使用反馈补充；用户可通过 cord.config.ts 追加 |

### 5.1 最高风险详解：R1 — BMAD 版本大改

**场景**：BMAD v7 可能重构目录结构（如 `_bmad/bmm/` → `_bmad/method/`），导致检测和类型识别失效。

**缓解方案**：

```typescript
// 版本策略模式 — 新版本仅需添加新 Strategy 类
class BmadV7Strategy implements BmadVersionStrategy {
  getExpectedStructure() {
    return {
      root: '_bmad',
      core: '_bmad/core',
      method: '_bmad/method',   // v7 可能的新路径
      config: '_bmad/method/config.yaml',
    };
  }
  // ...
}

// 检测器 — 尝试所有已知版本的结构
class BmadDetector {
  private strategies = [new BmadV7Strategy(), new BmadV6Strategy()];

  async detect(root: string): Promise<BmadDetectResult> {
    for (const strategy of this.strategies) {
      const structure = strategy.getExpectedStructure();
      if (await this.matchesStructure(root, structure)) {
        return { detected: true, strategy };
      }
    }
    // 兜底：仅检查 _bmad/ 目录
    if (await this.directoryExists(path.join(root, '_bmad'))) {
      return { detected: true, confidence: 0.5, note: '未知版本' };
    }
    return { detected: false };
  }
}
```

_置信度：**MEDIUM-HIGH** — 风险评估基于框架演进模式分析，具体概率需持续跟踪_

## 6. 成功指标与验收标准

### 6.1 Phase 1 MVP 验收标准

| 指标 | 标准 | 验证方式 |
|------|------|---------|
| **检测准确率** | CORD 项目中检测到 BMAD = true | 集成测试 |
| **类型识别率** | 18 种已知类型识别率 ≥ 90% | 单元测试 |
| **inputDocuments 提取率** | 含 inputDocuments 的文档 100% 提取 | 集成测试 |
| **产出链推断率** | 19 条关系对中 ≥ 80% 被正确推断 | 集成测试 |
| **性能** | 50 文档全量扫描 < 500ms | 基准测试 |
| **零误判** | 非 BMAD 项目中 detect() = false | 负面测试 |

### 6.2 Phase 2 完善验收标准

| 指标 | 标准 | 验证方式 |
|------|------|---------|
| **阶段门检测** | PRD 变更时标记 Architecture 需同步 | 集成测试 |
| **生命周期绑定** | PRD ↔ Validation Report 正确关联 | 集成测试 |
| **命名推断** | story-1-1.md → belongs_to epics-and-stories.md | 单元测试 |
| **版本兼容** | v6.2.2 和未来 v7.x 均可工作 | 版本策略测试 |
| **参考实现质量** | 后续框架适配器可直接参照 BMAD 适配器的代码结构 | 代码评审 |

_置信度：**HIGH** — 验收标准直接对应本研究定义的架构和规则_

---

**实现方案分析完成日期：** 2026-04-02

---

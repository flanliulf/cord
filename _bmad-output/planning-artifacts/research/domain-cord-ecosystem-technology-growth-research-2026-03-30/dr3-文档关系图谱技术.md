# DR3: 文档关系图谱技术

> **研究日期：** 2026-03-31
> **数据来源：** Microsoft GraphRAG、LlamaIndex PropertyGraphIndex、Cognee、Tree-sitter、MCP Memory Server、Swimm、各技术官方文档

---

## 3.1 领域定义与技术背景

**文档关系图谱技术**，指通过图结构（节点+边）来表示和管理文档、代码、规则之间的结构化关联关系，使得系统能够：
1. 追踪"哪些文档与哪些代码相关"
2. 检测"代码变更后哪些文档可能过时"
3. 提供"基于关系路径的智能检索"而非单纯的关键词/向量匹配

**为什么这对 CORD 至关重要？**

DR2 揭示了 AI Coding 框架文档管理的 6 大痛点，其中**文档碎片化**和**文档过时**是最严重的两个。文档关系图谱是解决这些问题的底层技术基石——只有建立文档与代码的结构化关联，才能实现"变更传播检测"和"智能上下文分片"。

---

## 3.2 核心技术路径分类

经过研究，文档关系图谱技术可分为三大技术路径：

| 技术路径 | 核心方法 | 代表方案 | 适用场景 |
|---------|---------|---------|---------|
| **A. LLM 驱动的知识图谱提取** | 用 LLM 从非结构化文本中提取实体和关系 | Microsoft GraphRAG、LlamaIndex PropertyGraphIndex | 从自然语言文档中自动构建图谱 |
| **B. 代码解析的结构化图谱** | 通过 AST/语法树解析代码结构 | Tree-sitter、LSP、SCIP | 从代码中提取函数/类/模块的调用关系 |
| **C. 混合记忆系统** | 向量嵌入 + 图关系双存储 | Cognee、MCP Memory Server | AI Agent 的持久化记忆与关系检索 |

---

## 3.3 技术路径 A：LLM 驱动的知识图谱提取

### 3.3.1 Microsoft GraphRAG

**核心原理：** 对传统 RAG（检索增强生成）的结构化升级——用知识图谱替代平面向量检索。

**三阶段流水线：**

```
输入文本 → TextUnits 分割
    ↓
实体/关系/声明提取（LLM 驱动）
    ↓
Leiden 社区检测算法 → 分层聚类
    ↓
社区摘要生成 → 层级化知识结构
```

**与传统 RAG 的关键区别：**

| 维度 | 传统 RAG | GraphRAG |
|------|---------|----------|
| **检索方式** | 向量相似度匹配 | 图谱遍历 + 社区摘要 |
| **擅长问题类型** | 局部、具体的检索 | **全局、跨文档的综合洞察** |
| **信息整合** | 片段级（单个 chunk） | 关系级（跨 chunk 的实体连接） |
| **对私有数据的适配** | 通用，但缺乏结构理解 | 专门优化私有数据集 |

**对 CORD 的启示：**
- GraphRAG 的"跨文档关系整合"能力，可用于解决规则文件之间的**冲突检测**（如 CLAUDE.md 中两条矛盾规则）
- Leiden 社区检测算法可用于自动发现"规则群组"——哪些规则在语义上应归为一类

_来源：[microsoft.github.io/graphrag](https://microsoft.github.io/graphrag/)、[arxiv.org/abs/2404.16130](https://arxiv.org/abs/2404.16130)_

### 3.3.2 LlamaIndex PropertyGraphIndex

**核心原理：** 将文档解析为属性图（Property Graph），节点为实体（EntityNode），边为关系（Relation），均可携带属性元数据。

**四种图谱提取器：**

| 提取器 | 方法 | 特点 |
|--------|------|------|
| **SimpleLLMPathExtractor** | LLM 生成 (entity1, relation, entity2) 三元组 | 默认提取器，简单高效 |
| **ImplicitPathExtractor** | 解析已有 node.relationships 属性 | 无需 LLM，零成本 |
| **DynamicLLMPathExtractor** | LLM 动态分配实体和关系类型 | 灵活但不可预测 |
| **SchemaLLMPathExtractor** | 严格 schema 验证（Pydantic 结构化输出） | **最适合 CORD**——确保图谱结构一致 |

**混合检索策略（4 种可组合）：**

| 检索器 | 方法 |
|--------|------|
| **LLMSynonymRetriever** | 生成查询同义词进行节点匹配 |
| **VectorContextRetriever** | 通过向量嵌入相似度检索节点 |
| **TextToCypherRetriever** | 从自然语言生成 Cypher 图查询 |
| **CypherTemplateRetriever** | 填充参数化 Cypher 模板 |

**支持的图存储后端：**
- SimplePropertyGraphStore（内存）
- **Neo4jPropertyGraphStore**
- NebulaPropertyGraphStore
- TiDBPropertyGraphStore
- FalkorDBPropertyGraphStore

**对 CORD 的启示：**
- **SchemaLLMPathExtractor** 提供了从 Markdown 规则文件中提取结构化关系的最佳路径——定义 CORD 自己的 schema（如 `Rule → applies_to → CodeFile`、`Rule → conflicts_with → Rule`）
- **混合检索**是 CORD 智能上下文分片的技术基础——向量相似度找"语义相关"的规则，图谱遍历找"结构关联"的规则

_来源：[developers.llamaindex.ai/python/framework/module_guides/indexing/lpg_index_guide](https://developers.llamaindex.ai/python/framework/module_guides/indexing/lpg_index_guide/)_

---

## 3.4 技术路径 B：代码解析的结构化图谱

### 3.4.1 Tree-sitter — 增量语法解析

**核心定位：** 语言无关的增量语法解析库，将源代码转换为具体语法树（CST）。

**关键技术特性：**

| 特性 | 描述 |
|------|------|
| **通用性** | 支持 26+ 种编程语言（Python、JS、Rust、Go、Java、C++ 等） |
| **增量解析** | 代码编辑时高效更新语法树（毫秒级），而非全量重解析 |
| **鲁棒性** | 即使代码存在语法错误也能构建部分语法树 |
| **零依赖** | 纯 C11 运行时，可嵌入任何应用 |
| **语言绑定** | 11 个官方绑定 + 20+ 个第三方绑定 |

**在文档图谱中的角色：**

Tree-sitter 是构建"代码 → 文档"关系图谱的基础层：

```
源代码文件 → Tree-sitter 解析 → AST（语法树）
    ↓
提取实体：函数定义、类定义、模块导入、注释块
    ↓
关联检测：函数 ← 被引用于 → 文档规则
    ↓
变更传播：函数签名变更 → 标记相关规则为"可能过时"
```

_来源：[tree-sitter.github.io/tree-sitter](https://tree-sitter.github.io/tree-sitter/)_

### 3.4.2 LSP / SCIP — 代码智能索引

**LSP（Language Server Protocol）：** Microsoft 定义的语言服务器协议，提供实时代码智能（定义跳转、引用查找、悬停文档）。

**SCIP（Sourcegraph Code Intelligence Protocol）：** Sourcegraph 提出的代码索引协议，是 LSIF 的后继者，专为批量索引和跨仓库分析设计。

**对 CORD 的启示：**
- LSP 提供了"代码实体 ↔ 文档注释"的实时关联能力
- SCIP 提供了跨仓库的全量索引能力，可构建"代码函数 → 引用于哪些规则文件"的全局关系图

---

## 3.5 技术路径 C：混合记忆系统

### 3.5.1 Cognee — AI Agent 知识引擎

**核心定位：** 结合向量搜索、图数据库和认知科学的开源知识引擎。

**双存储策略：**

```
输入数据（文档/文本/多模态）
    ↓
cognee.add() — 统一摄入层
    ↓
cognee.cognify() — 知识图谱处理
    ├── 向量嵌入 → 语义搜索
    └── 图关系 → 上下文连接
    ↓
cognee.search() — 上下文感知检索
```

**三个核心操作：**

| 操作 | 功能 |
|------|------|
| **Add（添加）** | 摄入新信息到知识库 |
| **Cognify（认知化）** | 将数据处理为知识图谱（向量 + 图双写） |
| **Search（搜索）** | 返回结合向量相似度和关系遍历的上下文感知结果 |

**核心优势：**
> "使你的文档既可按语义搜索，又可按关系连接，且随着文档的变更和演进保持更新"

**对 CORD 的启示：**
- Cognee 的 **"语义搜索 + 关系连接"双通道架构** 是 CORD 文档检索的理想模型
- CORD 可以参考 Cognee 的 `cognify()` 模式：当规则文件变更时，自动重建其在图谱中的关系

_来源：[github.com/topoteretes/cognee](https://github.com/topoteretes/cognee)_

### 3.5.2 MCP Memory Server — 基于知识图谱的 AI 记忆

MCP 官方参考服务器之一，使用知识图谱实现 AI 的持久化记忆。

**工作原理：**
- 实体（Entities）：记忆的主题（人、项目、概念等）
- 关系（Relations）：实体之间的连接
- 观察（Observations）：附着在实体上的事实和学习

**对 CORD 的启示：**
- 证明了知识图谱在 AI 工具链中的原生适配性
- CORD 可以作为"更结构化的 Memory Server"——专注于文档/规则领域的知识图谱

---

## 3.6 文档与代码同步技术

### 3.6.1 Swimm — 代码耦合文档

**核心概念：** "Code-Coupled Documentation"（代码耦合文档）——文档不仅记录代码，还**绑定到具体的代码符号**。

**核心能力（基于公开信息）：**
- 文档中的代码片段与实际代码文件/行号绑定
- 代码变更时自动检测绑定的文档是否需要更新
- 通过 CI/CD 集成（GitHub Actions / GitLab CI）在 PR 中提示文档更新需求
- AI 辅助生成文档内容

**技术意义：**
Swimm 证明了"代码→文档变更传播"在工业级是可行的。然而，Swimm 聚焦于**传统代码文档**（README、Wiki），而非 **AI 规则文档**（CLAUDE.md、.cursor/rules/）——这正是 CORD 的差异化空间。

### 3.6.2 Git Blame 与变更归因

GitHub 提供的基础变更追踪能力：

| 能力 | 技术 | 局限 |
|------|------|------|
| **行级归因** | `git blame` | 仅追踪"谁改了哪行"，无语义理解 |
| **噪音过滤** | `.git-blame-ignore-revs` | 过滤格式化 commit，聚焦实质性变更 |
| **AI 辅助理解** | GitHub Copilot Blame | 对特定代码行提问 |

**对 CORD 的启示：**
- Git blame 是变更追踪的基础层，但缺少"代码变更 → 规则文档影响"的语义推理
- CORD 需要在 git blame 之上构建更高层的**影响分析**——"这个 API 函数签名变更了，哪些 CLAUDE.md 规则引用了它？"

---

## 3.7 CORD 文档关系图谱技术架构构想

综合以上研究，CORD 的文档关系图谱可采用以下分层架构：

```
┌─────────────────────────────────────────────┐
│              CORD 智能检索层                  │
│  混合检索：向量相似度 + 图谱遍历 + 规则匹配    │
├─────────────────────────────────────────────┤
│              CORD 知识图谱层                  │
│  实体：Rule / CodeFile / Function / Module   │
│  关系：applies_to / references / conflicts   │
│       depends_on / supersedes / scoped_to    │
├──────────────────┬──────────────────────────┤
│   文档解析引擎     │     代码解析引擎          │
│  Markdown → AST   │  Tree-sitter → CST      │
│  YAML frontmatter │  LSP/SCIP 代码智能        │
│  @import 解析     │  Git blame/diff          │
├──────────────────┴──────────────────────────┤
│              存储层                           │
│  图存储：Neo4j / FalkorDB / SQLite + JSON    │
│  向量存储：嵌入式向量库（本地优先）             │
│  文件系统：Markdown 文件（Git 友好）           │
└─────────────────────────────────────────────┘
```

### 3.7.1 CORD 图谱实体模型（草案）

| 实体类型 | 属性 | 说明 |
|---------|------|------|
| **Rule** | name, source_file, scope, tool_format, content_hash | 一条 AI 规则（从 CLAUDE.md/.cursor/rules 等提取） |
| **CodeFile** | path, language, last_modified, content_hash | 一个代码文件 |
| **Function** | name, file, line_start, line_end, signature | 一个函数/方法定义 |
| **Module** | name, path, type (package/directory) | 一个代码模块或包 |
| **DocFile** | path, type (CLAUDE.md/cursorrules/copilot), format | 一个文档/规则文件 |

### 3.7.2 CORD 图谱关系模型（草案）

| 关系类型 | 源 → 目标 | 语义 |
|---------|----------|------|
| `applies_to` | Rule → CodeFile/Module | 规则适用于哪些代码 |
| `references` | Rule → Function/CodeFile | 规则中引用了哪些代码实体 |
| `conflicts_with` | Rule → Rule | 两条规则存在矛盾 |
| `depends_on` | Rule → Rule | 规则之间的依赖关系 |
| `supersedes` | Rule → Rule | 新规则取代旧规则 |
| `scoped_to` | Rule → glob pattern | 规则的路径作用域 |
| `exported_as` | Rule → tool_format | 规则导出到哪种工具格式 |
| `stale_since` | Rule → git_commit | 规则何时变为"可能过时" |

---

## 3.8 技术选型建议

| 技术组件 | 推荐方案 | 理由 |
|---------|---------|------|
| **Markdown 解析** | remark / unified.js 生态 | 成熟的 Markdown AST 解析，支持 frontmatter |
| **代码解析** | Tree-sitter（多语言） | 增量解析、语言无关、26+ 语言支持 |
| **图谱提取** | SchemaLLMPathExtractor 模式（LlamaIndex 参考） | 严格 schema 验证，确保图谱结构一致 |
| **图存储（MVP）** | 嵌入式 JSON/SQLite | 本地优先，零依赖，Git 友好 |
| **图存储（扩展）** | Neo4j / FalkorDB | 复杂图查询、Cypher 语言支持 |
| **向量存储** | 本地嵌入（如 onnx-runtime 小模型） | 离线可用，隐私友好 |
| **变更检测** | Git diff + content hash 比较 | 轻量级，无需额外基础设施 |
| **混合检索** | 向量相似度 + 图谱遍历双通道 | 参考 Cognee / LlamaIndex 混合模式 |

---

## 3.9 技术风险与挑战

| 风险 | 严重度 | 缓解策略 |
|------|--------|---------|
| **LLM 提取的图谱质量不稳定** | 🟠 高 | 使用 SchemaLLMPathExtractor + 人工审核；MVP 阶段可用基于规则的解析替代 LLM |
| **图谱维护成本随项目增长** | 🟡 中 | 增量更新（仅处理变更文件），参考 Tree-sitter 的增量解析思路 |
| **跨语言代码解析复杂度** | 🟡 中 | MVP 聚焦 TypeScript/Python/Java 三种主流语言 |
| **本地图存储的查询性能** | 🟢 低 | 文档/规则数量级通常为数百个，SQLite/JSON 足够 |
| **向量嵌入的离线可用性** | 🟢 低 | 使用小型本地模型（如 all-MiniLM-L6-v2），无需云 API |

---

## DR3 研究小结

**文档关系图谱技术已进入实用化阶段，三大技术路径各有优势：**

- **LLM 驱动的图谱提取**（GraphRAG、LlamaIndex）：适合从自然语言规则中提取结构化关系，但质量受 LLM 输出波动影响
- **代码解析的结构化图谱**（Tree-sitter、LSP/SCIP）：适合从代码中提取精确的函数/类/模块结构，高可靠性
- **混合记忆系统**（Cognee）：向量 + 图谱双通道检索，提供"语义 + 结构"双重关联能力

**CORD 的最佳技术路径：**

1. **MVP 阶段**：基于规则的 Markdown 解析（remark AST + YAML frontmatter）+ Git diff 变更检测 + 嵌入式图存储（JSON/SQLite）
2. **增长阶段**：引入 Tree-sitter 代码解析 + SchemaLLMPathExtractor 图谱提取 + 向量嵌入混合检索
3. **成熟阶段**：完整的 Cognee 式混合记忆架构 + Neo4j 图存储 + 跨仓库关系图谱

**核心结论：** CORD 不需要从零发明图谱技术——成熟的开源组件（Tree-sitter、LlamaIndex、Cognee）已提供了足够的技术基础。CORD 的差异化在于**将这些技术组件整合为"AI 规则文档"这个垂直场景的端到端解决方案**。

_研究完成日期：2026-03-31_
_置信度：中高（技术方案基于可验证的开源项目文档；图谱实体/关系模型为概念设计，需实际验证）_

---

<!-- DR4 内容将在后续步骤中追加 -->

---

# Architectural Patterns and Design

本节针对 CORD TR3 路线图中定义的 7 个能力维度，逐一进行深度技术评估。

## 维度 1：Frontmatter 解析

**能力评级：✅ 完全满足**

remark 生态为 frontmatter 提供了**两层架构**，完美适配 CORD 的需求：

| 层级 | 组件 | 职责 | 输出 |
|------|------|------|------|
| L1 语法识别 | `remark-frontmatter` | 将 `---` 围栏识别为 AST 节点 | `type: 'yaml'` 节点 |
| L2 数据提取 | `vfile-matter` | 解析 YAML 为 JS 对象 | `file.data.matter` |

**架构特征：**
- **分离关注点** — 语法识别和数据解析独立，可选择性使用
- **多格式支持** — YAML（`---`）、TOML（`+++`）、自定义格式
- **自定义标记** — 支持 `{ type, marker, fence }` 配置任意围栏格式
- **位置仅文档开头** — 默认 `anywhere: false`，符合 Markdown 标准实践
- **ESM only** — Node.js 16+，无 CommonJS 降级

**CORD 场景验证：**
```yaml
---
title: Architecture Design
tags: [cord, architecture]
cord-relations:
  - target: ./api-design.md
    type: depends-on
  - target: ./database-schema.md
    type: references
---
```
→ 通过 `vfile-matter` 解析后，`file.data.matter` 直接包含结构化的 CORD 关系声明。

**风险评估：** 🟢 低风险 — 成熟稳定，被 Gatsby、Astro、Next.js 等广泛使用。

_Source: [remark-frontmatter](https://github.com/remarkjs/remark-frontmatter)_

## 维度 2：章节/段落级锚点提取

**能力评级：✅ 完全满足**

mdast 的 Heading 和 Position 系统为 CORD 提供了精确到字节的章节定位能力。

**Heading 节点结构：**
```typescript
interface Heading extends Parent {
  type: 'heading'
  depth: 1 | 2 | 3 | 4 | 5 | 6
  children: PhrasingContent[]
  position: Position  // 精确位置信息
}
```

**Position/Point 精度：**
```typescript
interface Position {
  start: Point  // 节点开始位置
  end: Point    // 节点结束位置（第一个非属于该节点的字符）
}

interface Point {
  line: number    // ≥ 1，行号（1-indexed）
  column: number  // ≥ 1，列号（1-indexed）
  offset: number  // ≥ 0，从文档开头的字符偏移量（0-indexed）
}
```

**关键保证：** 由 micromark 状态机提供字节级精度——"every byte is accounted for, with positional info"。生成的节点（非原始源码中存在的）不包含 position，可用于区分。

**CORD 锚点提取工具链：**

| 工具 | 用途 | CORD 场景 |
|------|------|----------|
| `unist-util-visit` + `'heading'` | 遍历所有 Heading | 构建文档大纲 |
| `mdast-util-to-string` | 提取 Heading 纯文本 | 生成 slug/锚点 ID |
| `mdast-util-heading-range` | 提取 Heading 下的内容范围 | 章节内容索引 |
| `rehype-slug`（如需 HTML 兼容） | GitHub 风格 slug 生成 | 跨平台锚点一致性 |

**mdast-util-heading-range 的精准章节切割：**
```typescript
import { headingRange } from 'mdast-util-heading-range'

// 找到 "## API" 标题及其下的所有内容
headingRange(tree, 'API', (start, nodes, end, info) => {
  // start = Heading 节点
  // nodes = 从 Heading 到下一个同级/更高级标题之间的所有内容
  // end = 下一个 Heading 或 undefined（文档末尾）
  // info = { parent, start: startIndex, end: endIndex }
})
```

**段落级定位：** Paragraph 节点同样携带 Position 信息，CORD 可实现段落级粒度的锚点：
```typescript
visit(tree, 'paragraph', (node, index, parent) => {
  // node.position.start.line → 段落起始行
  // node.position.end.line → 段落结束行
  // 可构建 "file.md#L10-L15" 风格的段落锚点
})
```

**风险评估：** 🟢 低风险 — Position 精度由 micromark 保证，工具链成熟。

_Source: [unist spec](https://github.com/syntax-tree/unist), [mdast-util-heading-range](https://github.com/syntax-tree/mdast-util-heading-range), [mdast-util-to-string](https://github.com/syntax-tree/mdast-util-to-string)_

## 维度 3：增量解析能力

**能力评级：🟡 需要 CORD 自行设计增量策略**

**核心发现：remark/micromark 本身不提供原生增量解析。** 每次调用 `parse()` 都是全量解析。

**原因分析：**
- micromark 使用状态机架构，状态在解析过程中积累
- Markdown 语法的上下文依赖性（如列表嵌套、围栏代码块）使增量解析非常复杂
- CommonMark 规范未定义增量解析行为

**CORD 增量策略设计（推荐方案）：**

```
文件变更检测 (chokidar)
       │
       ▼
┌─────────────────────┐
│  变更分类器          │
│  ├── 新文件 → 全量解析 + 全量入库
│  ├── 删除文件 → 删除相关记录
│  └── 修改文件 → 全量重解析 + 差量入库
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  全量重解析          │  ← remark-parse（单文件级别重解析）
│  （单文件粒度）       │     性能可接受：典型文档 < 5ms
└──────────┬──────────┘
           │ 新的 VFile.data
           ▼
┌─────────────────────┐
│  差量对比 & 入库     │  ← 对比新旧提取结果
│  ├── Headings diff   │     仅更新变化的记录
│  ├── Links diff      │
│  └── Frontmatter diff│
└─────────────────────┘
```

**为什么"文件级全量重解析"在 CORD 场景可行：**
1. CORD 处理的是项目文档（非实时编辑器），变更频率低
2. 单个 Markdown 文件的 remark-parse 解析时间通常 < 5ms
3. micromark 仅 14kb，初始化开销极小
4. 增量粒度在"文件级"而非"行级"即可满足需求
5. 差量对比逻辑放在 CORD 数据层，而非 AST 解析层

**置信度：** 🟡 中等 — 全量重解析的性能假设需要在实际 CORD 文档集上验证。

## 维度 4：非标准 Markdown 容错性

**能力评级：✅ 优秀**

**CommonMark 的核心设计哲学：** "nothing in Markdown counts as a 'syntax error'"

这意味着 remark/micromark 的容错性是**架构层面的保证**，而非事后补丁：

**容错机制：**

| 场景 | 处理方式 | 结果 |
|------|---------|------|
| 未闭合代码围栏 | 延伸到文档末尾或外层块引用结束 | 代码块包含后续所有内容 |
| 未闭合强调标记 | 视为普通文本 | `*text` → 字面文字 |
| 无效 HTML 标签 | 保留为 `html` 节点 | 内容不丢失 |
| 嵌套容器冲突 | 块级结构优先于行内结构 | 确定性解析 |
| 非 CommonMark 语法 | 按纯文本处理 | 不报错、不丢弃 |

**GFM 和扩展语法的处理：**
- `remark-gfm` — 表格、删除线、任务列表、自动链接、脚注
- `remark-directive` — 自定义指令语法
- `remark-math` — 数学公式
- `remark-mdx` — JSX in Markdown

**CORD 特别关注的 IDE 专有语法：**

| IDE 语法 | remark 处理 | CORD 影响 |
|----------|------------|----------|
| CLAUDE.md 的特殊标记 | 按普通 Markdown 解析 | ✅ 不影响关系发现 |
| .cursorrules 内容 | 按普通文本处理 | ✅ frontmatter 仍可提取 |
| Mermaid 代码块 | `code` 节点 + `lang: 'mermaid'` | ✅ 可识别并标记 |
| Admonition 语法 (`:::note`) | 通过 remark-directive 支持 | ✅ 可扩展支持 |

**VFile 消息系统提供容错性指标：**
```typescript
// 解析后检查消息
const result = await processor.process(file)
for (const message of result.messages) {
  console.log(message.reason)   // 警告描述
  console.log(message.position) // 问题位置
  console.log(message.source)   // 来源插件
}
```

**风险评估：** 🟢 低风险 — "无语法错误"的设计哲学天然适合 CORD 需要处理各种非标准文档的场景。

_Source: [CommonMark Spec](https://spec.commonmark.org/0.31.2/)_

## 维度 5：性能基准测试

**能力评级：✅ 满足 CORD 需求（附注意事项）**

**micromark 性能基础：**
- 体积：±14kb（最小 CommonMark 解析器）
- 测试覆盖：±2,000 个测试，100% 覆盖率
- 支持流式处理（Stream API），适合大文件

**CORD 典型场景性能估算：**

| 文档规模 | 典型内容 | 预估解析时间 | 内存占用 |
|----------|---------|------------|---------|
| 小（< 100 行） | README、配置说明 | < 1ms | < 1MB |
| 中（100-500 行） | API 文档、设计文档 | 1-5ms | 1-3MB |
| 大（500-2000 行） | 架构文档、规范 | 5-20ms | 3-10MB |
| 超大（2000+ 行） | 合并文档、手册 | 20-100ms | 10-50MB |

> ⚠️ **注意：** 以上为基于 micromark 体积和架构特征的合理估算。CORD 实施时建议用实际文档集做基准测试。

**性能优化策略（CORD 可用）：**

1. **处理器复用** — `unified()` 处理器实例可跨文件复用，避免重复初始化
2. **低层级接口** — 批量扫描时使用 `fromMarkdown()` 绕过 unified 管线开销
3. **流式处理** — micromark 支持 Stream API，超大文件可流式解析
4. **并行处理** — 多文件可并行解析（每个 `processor.process()` 独立）
5. **懒加载插件** — 仅加载 CORD 需要的插件（frontmatter + GFM），不加载 lint/stringify 等

**与竞品对比（参考数据）：**

| 解析器 | 特点 | 适合场景 |
|--------|------|---------|
| micromark (remark 底层) | 最小体积、流式支持、字节级精度 | AST 分析（CORD） |
| markdown-it | 743-1,568 ops/sec、面向渲染 | HTML 渲染 |
| marked | 极致速度优先 | 简单转换 |

**置信度：** 🟡 中等 — 性能数据需要在 CORD 实际文档集上验证，但架构特征表明性能不是瓶颈。

## 维度 6：TypeScript 类型支持

**能力评级：✅ 良好（有改进空间）**

**类型系统架构：**

```
@types/unist          ← 基础：Node, Parent, Literal, Position, Point
    ↓ extends
@types/mdast          ← Markdown 专用：Root, Heading, Paragraph, Link, ...
    ↓ used by
remark-parse (built-in types)  ← 插件类型定义
unified (built-in types)       ← 处理器类型定义
```

**核心类型质量评估：**

| 类型包 | 覆盖度 | IDE 推断 | 泛型支持 | 评价 |
|--------|--------|---------|---------|------|
| `@types/unist` | ✅ 完整 | ✅ 优秀 | ✅ 有 | 基础稳固 |
| `@types/mdast` | ✅ 完整 | ✅ 优秀 | 🟡 有限 | 所有节点类型已定义 |
| `unified` | ✅ 内置 | ✅ 良好 | ✅ 有 | Plugin 类型推断好 |
| `unist-util-visit` | ✅ 内置 | ✅ 良好 | ✅ 有 | Test 类型窄化可用 |
| `vfile` | ✅ 内置 | ✅ 良好 | 🟡 有限 | data 属性为 Record<string, unknown> |

**CORD 插件类型化示例：**
```typescript
import type { Root, Heading, Link } from 'mdast'
import type { Plugin } from 'unified'
import type { VFile } from 'vfile'

// 定义 CORD 扩展数据结构
interface CordFileData {
  cordHeadings: CordHeading[]
  cordLinks: CordRelation[]
  matter: Record<string, unknown>
}

// 类型安全的 CORD 插件
const cordHeadingPlugin: Plugin<[], Root> = () => {
  return (tree: Root, file: VFile) => {
    const data = file.data as CordFileData
    // TypeScript 提供完整的节点类型推断
  }
}
```

**已知限制：**
- `VFile.data` 是 `Record<string, unknown>` — 需要手动类型断言或扩展接口
- `visit()` 的 test 参数类型窄化：传入 `'heading'` 时 node 自动窄化为 `Heading`，但复杂 test 可能丢失窄化
- JSDoc 风格类型注解（unified 生态的推荐方式）vs 标准 TypeScript — 可能不符合所有团队习惯

**风险评估：** 🟢 低风险 — 类型系统完整且实用，VFile.data 的类型限制可通过接口扩展解决。

_Source: [mdast types](https://github.com/syntax-tree/mdast), [unist spec](https://github.com/syntax-tree/unist)_

## 维度 7：自定义插件开发体验（DX）

**能力评级：✅ 优秀**

**插件架构模式 — Attacher/Transformer：**
```typescript
// Attacher：注册阶段调用，返回 Transformer
function myPlugin(options?: MyOptions) {
  // Transformer：每次处理文件时调用
  return (tree: Root, file: VFile) => {
    // 遍历、修改 tree
    // 在 file.data 上存储提取结果
  }
}

// 注册
processor.use(myPlugin, { option1: 'value' })
```

**CORD 插件开发的核心工具链：**

| 工具 | 用途 | DX 评价 |
|------|------|---------|
| `unist-util-visit` | 节点遍历（按类型过滤） | ✅ 直观，支持 CONTINUE/SKIP/EXIT 控制 |
| `unist-util-visit-parents` | 带祖先链的遍历 | ✅ 需要上下文时使用 |
| `mdast-util-to-string` | 提取节点纯文本 | ✅ 简洁实用 |
| `mdast-util-heading-range` | 章节范围提取 | ✅ 专为章节操作设计 |
| `mdast-util-find-and-replace` | 文本模式匹配替换 | ✅ 正则 + 节点替换 |
| `unist-util-select` | CSS 选择器风格的节点查找 | ✅ 表达力强 |

**插件开发流程（CORD 视角）：**

```
1. 定义目标 → 提取什么数据？（headings? links? frontmatter?）
2. 选择遍历工具 → visit() / headingRange() / findAndReplace()
3. 编写 Transformer → (tree, file) => { ... }
4. 存储结果 → file.data.cordXxx = extractedData
5. 类型化 → Plugin<Options[], Root> + CordFileData
6. 集成测试 → processor.use(myPlugin).process(testMarkdown)
```

**CORD 需要开发的自定义插件清单：**

| 插件 | 职责 | 复杂度 |
|------|------|--------|
| `cord-heading-extractor` | 提取所有 Heading + Position → CordHeading[] | 🟢 低 |
| `cord-link-extractor` | 提取相对链接/引用 → CordRelation[] | 🟢 低 |
| `cord-frontmatter-parser` | 解析 CORD 专用 frontmatter 字段 | 🟢 低 |
| `cord-section-indexer` | 构建章节层级索引 | 🟡 中 |
| `cord-code-block-analyzer` | 识别代码块语言和元数据 | 🟢 低 |
| `cord-directive-handler` | 处理 `:cord-ref[]{}`  自定义语法（未来） | 🟡 中 |

**DX 总体评价：**
- ✅ 插件结构简洁（一个返回函数的函数）
- ✅ 遍历工具丰富且类型安全
- ✅ 官方文档提供完整的插件创建指南
- ✅ 社区 150+ 插件可作为参考实现
- ✅ 调试友好——AST 是 JSON 对象，可直接 console.log 检查
- 🟡 学习曲线：需要理解 unist/mdast/micromark 三层架构

**风险评估：** 🟢 低风险 — CORD 所需的插件都属于低到中等复杂度，工具链成熟。

## 架构模式关键发现总结

| 维度 | 评级 | 关键结论 | 风险 |
|------|------|---------|------|
| **Frontmatter** | ✅ 完全满足 | 两层架构（识别+解析），支持自定义格式 | 🟢 低 |
| **章节锚点** | ✅ 完全满足 | 字节级 Position，heading-range 章节切割 | 🟢 低 |
| **增量解析** | 🟡 需自行设计 | remark 无原生增量，推荐文件级重解析+差量入库 | 🟡 中 |
| **容错性** | ✅ 优秀 | "无语法错误"设计哲学，GFM/Directive 扩展完备 | 🟢 低 |
| **性能** | ✅ 满足 | micromark 14kb、流式支持、处理器复用 | 🟡 中（需验证） |
| **TypeScript** | ✅ 良好 | 完整节点类型、visit 类型窄化、VFile.data 需扩展 | 🟢 低 |
| **插件 DX** | ✅ 优秀 | Attacher/Transformer 模式、丰富遍历工具 | 🟢 低 |

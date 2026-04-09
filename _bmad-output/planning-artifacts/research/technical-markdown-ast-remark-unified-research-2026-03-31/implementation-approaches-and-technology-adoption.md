# Implementation Approaches and Technology Adoption

## CORD Markdown 解析引擎 — npm 依赖清单

### 核心依赖（必须）

| 包名 | 版本 | 用途 | 体积影响 |
|------|------|------|---------|
| `unified` | ^11.x | 处理器管线框架 | 轻量 |
| `remark-parse` | ^11.x | Markdown → mdast 解析 | 含 micromark |
| `remark-frontmatter` | ^5.x | YAML/TOML frontmatter 语法识别 | 轻量 |
| `remark-gfm` | ^4.x | GFM 扩展支持 | 含 micromark-extension-gfm |
| `vfile` | ^6.x | 虚拟文件格式 | 轻量 |
| `vfile-matter` | ^5.x | frontmatter 数据解析（YAML → JS Object） | 轻量 |
| `to-vfile` | ^8.x | 文件系统 ↔ VFile 桥接 | 轻量 |
| `unist-util-visit` | ^5.x | AST 遍历工具 | 极轻量 |
| `mdast-util-to-string` | ^4.x | 节点纯文本提取 | 极轻量 |

### 推荐依赖（按需引入）

| 包名 | 版本 | 用途 | 引入时机 |
|------|------|------|---------|
| `mdast-util-heading-range` | ^4.x | 章节范围提取 | 需要章节内容索引时 |
| `mdast-util-from-markdown` | ^2.x | 低层级直接解析 | 性能优化路径 |
| `remark-directive` | ^3.x | 自定义指令语法 | V2+ CORD 自定义语法 |
| `unist-util-select` | ^5.x | CSS 选择器风格查找 | 复杂查询场景 |
| `unist-util-visit-parents` | ^6.x | 带祖先链的遍历 | 需要上下文分析时 |

### 开发依赖

| 包名 | 用途 |
|------|------|
| `@types/mdast` | mdast 节点 TypeScript 类型 |
| `@types/unist` | unist 基础 TypeScript 类型 |

**总依赖体积估算：** 核心依赖约 50-80KB（minified），因为 micromark 仅 14KB，其他工具包均为极轻量设计。

_Source: [unified](https://github.com/unifiedjs/unified), [remark](https://github.com/remarkjs/remark), [remark plugins](https://github.com/remarkjs/remark/blob/main/doc/plugins.md)_

## ESM 兼容性与项目配置

**关键约束：unified 11.x 生态全线 ESM only。**

| 约束 | 影响 | CORD 应对 |
|------|------|----------|
| ESM only | 无法使用 `require()` | CORD 项目需 `"type": "module"` in package.json |
| Node.js 16+ | 不支持 14 及更早 | CORD 已计划 Node.js 18 LTS+，无影响 |
| 无 CommonJS 降级 | 不能混用 CJS/ESM | 所有 CORD 代码使用 `import/export` |
| Dynamic import 可用 | `await import()` | 插件可懒加载 |

**CORD 项目 tsconfig.json 关键配置：**
```json
{
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler",
    "target": "ES2022",
    "strict": true,
    "esModuleInterop": true,
    "declaration": true,
    "outDir": "./dist"
  }
}
```

**package.json 关键配置：**
```json
{
  "type": "module",
  "engines": {
    "node": ">=18"
  }
}
```

## CORD 自定义插件实现路径

### 插件 1：cord-heading-extractor（复杂度 🟢 低）

```typescript
// src/plugins/cord-heading-extractor.ts
import type { Root, Heading } from 'mdast'
import type { Plugin } from 'unified'
import type { VFile } from 'vfile'
import { visit } from 'unist-util-visit'
import { toString } from 'mdast-util-to-string'

export interface CordHeading {
  depth: 1 | 2 | 3 | 4 | 5 | 6
  text: string
  slug: string
  position: { startLine: number; endLine: number; startOffset: number; endOffset: number }
}

const cordHeadingExtractor: Plugin<[], Root> = () => {
  return (tree: Root, file: VFile) => {
    const headings: CordHeading[] = []

    visit(tree, 'heading', (node: Heading) => {
      const text = toString(node)
      headings.push({
        depth: node.depth,
        text,
        slug: slugify(text),
        position: {
          startLine: node.position!.start.line,
          endLine: node.position!.end.line,
          startOffset: node.position!.start.offset!,
          endOffset: node.position!.end.offset!,
        },
      })
    })

    ;(file.data as any).cordHeadings = headings
  }
}

export default cordHeadingExtractor
```

### 插件 2：cord-link-extractor（复杂度 🟢 低）

```typescript
// src/plugins/cord-link-extractor.ts
import type { Root, Link, LinkReference, Definition } from 'mdast'
import type { Plugin } from 'unified'
import { visit } from 'unist-util-visit'

export interface CordRelation {
  source: string
  target: string
  type: 'references' | 'link-reference' | 'definition'
  anchorText?: string
  position: { startLine: number; endLine: number }
}

const cordLinkExtractor: Plugin<[], Root> = () => {
  return (tree: Root, file: VFile) => {
    const relations: CordRelation[] = []

    visit(tree, 'link', (node: Link) => {
      if (isRelativeMarkdownLink(node.url)) {
        relations.push({
          source: file.path,
          target: resolveRelativePath(file.path, node.url),
          type: 'references',
          anchorText: toString(node),
          position: {
            startLine: node.position!.start.line,
            endLine: node.position!.end.line,
          },
        })
      }
    })

    ;(file.data as any).cordLinks = relations
  }
}

export default cordLinkExtractor
```

### 插件 3：cord-frontmatter-parser（复杂度 🟢 低）

```typescript
// src/plugins/cord-frontmatter-parser.ts
import type { Root } from 'mdast'
import type { Plugin } from 'unified'
import { matter } from 'vfile-matter'

export interface CordFrontmatter {
  title?: string
  tags?: string[]
  cordRelations?: Array<{ target: string; type: string }>
  [key: string]: unknown
}

const cordFrontmatterParser: Plugin<[], Root> = () => {
  return (_tree: Root, file: VFile) => {
    matter(file)
    // file.data.matter 现在包含解析后的 YAML 对象
    // CORD 可进一步验证和规范化
    const raw = (file.data as any).matter as CordFrontmatter | undefined
    ;(file.data as any).cordFrontmatter = raw ?? {}
  }
}

export default cordFrontmatterParser
```

## CORD 文档处理器组装

```typescript
// src/core/markdown-processor.ts
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import cordHeadingExtractor from '../plugins/cord-heading-extractor.js'
import cordLinkExtractor from '../plugins/cord-link-extractor.js'
import cordFrontmatterParser from '../plugins/cord-frontmatter-parser.js'

// 创建可复用的处理器实例（单例）
export const cordProcessor = unified()
  .use(remarkParse)
  .use(remarkFrontmatter, ['yaml'])
  .use(remarkGfm)
  .use(cordFrontmatterParser)
  .use(cordHeadingExtractor)
  .use(cordLinkExtractor)

// 处理单个文件
export async function processMarkdownFile(filePath: string): Promise<CordDocumentData> {
  const file = await read(filePath, 'utf8')
  const result = await cordProcessor.process(file)

  return {
    path: filePath,
    frontmatter: (result.data as any).cordFrontmatter,
    headings: (result.data as any).cordHeadings,
    links: (result.data as any).cordLinks,
    warnings: result.messages.map(m => ({
      reason: m.reason,
      line: m.position?.start.line,
      source: m.source,
    })),
  }
}

// 批量处理（并行）
export async function processMarkdownFiles(paths: string[]): Promise<CordDocumentData[]> {
  return Promise.all(paths.map(processMarkdownFile))
}
```

## 测试策略

**推荐测试框架：** Vitest（ESM 原生支持，与 unified ESM-only 生态无缝兼容）

**测试层级：**

| 层级 | 对象 | 策略 |
|------|------|------|
| 单元测试 | 每个 CORD 插件 | 固定 Markdown 输入 → 验证 VFile.data 输出 |
| 集成测试 | cordProcessor 管线 | 端到端：Markdown 文件 → CordDocumentData |
| fixture 测试 | 各种 Markdown 变体 | GFM、frontmatter、非标准语法的容错验证 |
| 性能测试 | 大文件场景 | 1000+ 行文档的解析时间基准 |

**测试示例：**
```typescript
// tests/plugins/cord-heading-extractor.test.ts
import { describe, it, expect } from 'vitest'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import cordHeadingExtractor from '../../src/plugins/cord-heading-extractor.js'

describe('cord-heading-extractor', () => {
  const processor = unified().use(remarkParse).use(cordHeadingExtractor)

  it('should extract headings with correct depth and position', async () => {
    const result = await processor.process('# Title\n\n## Section 1\n\n### Subsection')
    const headings = (result.data as any).cordHeadings

    expect(headings).toHaveLength(3)
    expect(headings[0]).toMatchObject({ depth: 1, text: 'Title' })
    expect(headings[1]).toMatchObject({ depth: 2, text: 'Section 1' })
    expect(headings[2]).toMatchObject({ depth: 3, text: 'Subsection' })
    expect(headings[0].position.startLine).toBe(1)
  })

  it('should handle empty document gracefully', async () => {
    const result = await processor.process('')
    expect((result.data as any).cordHeadings).toEqual([])
  })
})
```

## 风险评估与缓解

| 风险 | 可能性 | 影响 | 缓解策略 |
|------|--------|------|---------|
| **ESM 兼容性问题** | 🟡 中 | 🟠 高 | CORD 全线 ESM，确保 tsconfig 和 package.json 正确配置 |
| **大文件性能瓶颈** | 🟢 低 | 🟡 中 | micromark 流式支持 + 处理器复用；MVP 阶段做基准测试验证 |
| **unified 大版本升级** | 🟢 低 | 🟡 中 | 锁定 ^11.x，关注 changelog；unified 生态版本发布保守 |
| **自定义插件维护负担** | 🟢 低 | 🟢 低 | 插件复杂度低，Attacher/Transformer 模式简洁 |
| **非标准 Markdown 边缘情况** | 🟡 中 | 🟢 低 | "无语法错误"哲学兜底，VFile.messages 提供诊断信息 |
| **TypeScript 类型不完整** | 🟢 低 | 🟢 低 | `@types/mdast` 覆盖完整，VFile.data 可通过接口扩展解决 |

## 实现路线图（与 CORD MVP Phase 对齐）

```
MVP Phase 2: 基础解析能力
├── 安装核心依赖包（unified + remark-parse + frontmatter + gfm）
├── 实现 cordProcessor 单例
├── 实现 cord-heading-extractor 插件
├── 实现 cord-link-extractor 插件
├── 实现 cord-frontmatter-parser 插件
├── 编写单元测试 + fixture 测试
└── 性能基准测试（验证大文件场景）

MVP Phase 3: 文件监控集成
├── chokidar 检测 → to-vfile 读取 → cordProcessor 处理
├── 差量对比逻辑（新旧 CordDocumentData 比较）
├── SQLite 增量写入
└── 集成测试

V2+: 高级功能
├── remark-directive 自定义 CORD 语法
├── cord-section-indexer 章节内容索引
├── fromMarkdown() 低层级性能优化路径
└── 流式处理超大文件
```

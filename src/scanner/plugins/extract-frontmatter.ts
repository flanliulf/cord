import matter from 'gray-matter';

interface MarkdownAstNode {
  type: string;
  value?: string;
  children?: MarkdownAstNode[];
}

interface ExtractFrontmatterContext {
  frontmatter: Record<string, unknown>;
  warnings: string[];
  filePath: string;
}

/**
 * unified/remark 插件：从 YAML frontmatter 节点提取键值对。
 *
 * @param context - 外部收集器
 * @returns remark transformer
 */
export function extractFrontmatterPlugin(context: ExtractFrontmatterContext) {
  return (tree: MarkdownAstNode): void => {
    visitAst(tree, (node) => {
      if (node.type !== 'yaml' || typeof node.value !== 'string') {
        return;
      }

      try {
        const parsed = matter(`---\n${node.value}\n---\n`);
        Object.assign(context.frontmatter, toRecord(parsed.data));
      } catch {
        context.warnings.push(`跳过无法解析的 frontmatter: ${context.filePath}`);
      }
    });
  };
}

function visitAst(node: MarkdownAstNode, visitor: (node: MarkdownAstNode) => void): void {
  visitor(node);

  if (!Array.isArray(node.children)) {
    return;
  }

  for (const child of node.children) {
    visitAst(child, visitor);
  }
}

function toRecord(input: unknown): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return {};
  }

  return { ...input };
}
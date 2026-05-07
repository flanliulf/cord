import type { ParsedDocument } from '../types.js';

interface MarkdownAstNode {
  type: string;
  value?: string;
  depth?: number;
  children?: MarkdownAstNode[];
}

interface ExtractHeadingsContext {
  headings: ParsedDocument['headings'];
}

/**
 * unified/remark 插件：提取 Markdown 标题层级结构。
 *
 * @param context - 外部收集器
 * @returns remark transformer
 */
export function extractHeadingsPlugin(context: ExtractHeadingsContext) {
  return (tree: MarkdownAstNode): void => {
    visitAst(tree, (node) => {
      if (node.type !== 'heading' || typeof node.depth !== 'number') {
        return;
      }

      const text = collectNodeText(node).trim();
      if (text.length === 0) {
        return;
      }

      context.headings.push({ depth: node.depth, text });
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

function collectNodeText(node: MarkdownAstNode): string {
  const ownValue = typeof node.value === 'string' ? node.value : '';
  if (!Array.isArray(node.children) || node.children.length === 0) {
    return ownValue;
  }

  return `${ownValue}${node.children.map((child) => collectNodeText(child)).join('')}`;
}
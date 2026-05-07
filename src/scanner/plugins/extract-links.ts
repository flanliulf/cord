interface MarkdownAstNode {
  type: string;
  url?: string;
  children?: MarkdownAstNode[];
}

interface ExtractLinksContext {
  links: string[];
}

/**
 * unified/remark 插件：提取 Markdown link 节点中的目标地址。
 *
 * @param context - 外部收集器
 * @returns remark transformer
 */
export function extractLinksPlugin(context: ExtractLinksContext) {
  return (tree: MarkdownAstNode): void => {
    visitAst(tree, (node) => {
      if (node.type === 'link' && typeof node.url === 'string') {
        context.links.push(node.url);
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
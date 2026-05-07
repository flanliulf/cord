import { dirname, resolve } from 'node:path';
import { RELATION_TYPES } from '../../types/index.js';
import type { DiscoveredRelation, ParsedDocument } from '../types.js';
import type { IScanRule } from './index.js';

/**
 * markdown-link-rule：根据 Markdown 链接生成引用关系。
 */
export class MarkdownLinkRule implements IScanRule {
  readonly name = 'markdown-link-rule';

  /**
   * @param doc - 当前文档
   * @param allDocPaths - 已知文档绝对路径列表
   * @returns 推断出的关系列表
   */
  evaluate(doc: ParsedDocument, allDocPaths: string[]): DiscoveredRelation[] {
    const resolvedPaths = createResolvedPathLookup(allDocPaths);
    const dedupedRelations = new Map<string, DiscoveredRelation>();

    for (const link of doc.links) {
      const targetDoc = resolveDocumentReference(link, doc.path, allDocPaths, resolvedPaths);
      if (!targetDoc || targetDoc === doc.path) {
        continue;
      }

      const relation: DiscoveredRelation = {
        confidence: 0.85,
        metadata: { link },
        relationType: RELATION_TYPES.REFERENCES,
        ruleName: this.name,
        source: 'auto_scan',
        sourceDoc: doc.path,
        targetDoc,
      };
      dedupedRelations.set(createRelationKey(relation), relation);
    }

    return Array.from(dedupedRelations.values());
  }
}

function createResolvedPathLookup(allDocPaths: string[]): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const filePath of allDocPaths) {
    lookup.set(resolve(filePath), filePath);
  }
  return lookup;
}

function resolveDocumentReference(
  reference: string,
  sourceDocPath: string,
  allDocPaths: string[],
  resolvedPathLookup: Map<string, string>,
): string | undefined {
  const sanitizedReference = sanitizeReference(reference);
  if (!sanitizedReference) {
    return undefined;
  }

  const directCandidate = sanitizedReference.startsWith('/')
    ? resolveAbsoluteReference(sanitizedReference, sourceDocPath, resolvedPathLookup)
    : resolvedPathLookup.get(resolve(dirname(sourceDocPath), sanitizedReference));
  if (directCandidate) {
    return directCandidate;
  }

  const normalizedSuffix = sanitizedReference.replace(/^\/+/, '').replaceAll('\\', '/');
  const suffixMatches = allDocPaths.filter((filePath) => {
    const normalizedFilePath = filePath.replaceAll('\\', '/');
    return normalizedFilePath === normalizedSuffix || normalizedFilePath.endsWith(`/${normalizedSuffix}`);
  });

  return suffixMatches.length === 1 ? suffixMatches[0] : undefined;
}

function resolveAbsoluteReference(
  reference: string,
  sourceDocPath: string,
  resolvedPathLookup: Map<string, string>,
): string | undefined {
  let currentDirectory = dirname(sourceDocPath);

  while (true) {
    const candidate = resolvedPathLookup.get(resolve(currentDirectory, `.${reference}`));
    if (candidate) {
      return candidate;
    }

    const parentDirectory = dirname(currentDirectory);
    if (parentDirectory === currentDirectory) {
      return undefined;
    }

    currentDirectory = parentDirectory;
  }
}

function sanitizeReference(reference: string): string | undefined {
  const trimmed = reference.trim();
  if (trimmed.length === 0 || trimmed.startsWith('#')) {
    return undefined;
  }

  const lowerCased = trimmed.toLowerCase();
  if (lowerCased.startsWith('http://') || lowerCased.startsWith('https://')) {
    return undefined;
  }

  const withoutFragment = trimmed.split('#', 1)[0]?.trim() || '';
  const withoutQuery = withoutFragment.split('?', 1)[0]?.trim() || '';
  return withoutQuery.length > 0 ? withoutQuery : undefined;
}

function createRelationKey(relation: DiscoveredRelation): string {
  return [relation.sourceDoc, relation.targetDoc, relation.relationType].join('::');
}
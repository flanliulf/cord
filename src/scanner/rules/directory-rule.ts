import { basename, dirname, relative } from 'node:path';
import { RELATION_TYPES } from '../../types/index.js';
import type { DiscoveredRelation, ParsedDocument } from '../types.js';
import type { IScanRule } from './index.js';

/**
 * directory-rule：根据目录结构推断低至中等置信度关系。
 */
export class DirectoryRule implements IScanRule {
  readonly name = 'directory-rule';

  /**
   * @param doc - 当前文档
   * @param allDocPaths - 已知文档绝对路径列表
   * @returns 推断出的关系列表
   */
  evaluate(doc: ParsedDocument, allDocPaths: string[]): DiscoveredRelation[] {
    const relations = new Map<string, DiscoveredRelation>();
    const sourceDirectory = dirname(doc.path);
    const sourcePrefix = extractPrefix(doc.path);
    const sourceIsIndex = basename(doc.path).toLowerCase() === 'index.md';

    for (const candidatePath of allDocPaths) {
      if (candidatePath === doc.path) {
        continue;
      }

      if (sourceIsIndex && isDescendantDocument(candidatePath, sourceDirectory)) {
        const relation = createRelation(doc.path, candidatePath, RELATION_TYPES.CONTAINS, 0.7, this.name);
        relations.set(createRelationKey(relation), relation);
        continue;
      }

      if (dirname(candidatePath) === sourceDirectory) {
        const candidatePrefix = extractPrefix(candidatePath);
        if (sourcePrefix && candidatePrefix === sourcePrefix) {
          const relation = createRelation(
            doc.path,
            candidatePath,
            RELATION_TYPES.LIFECYCLE_BOUND,
            0.6,
            this.name,
          );
          relations.set(createRelationKey(relation), relation);
          continue;
        }

        const relation = createRelation(doc.path, candidatePath, RELATION_TYPES.REFERENCES, 0.5, this.name);
        relations.set(createRelationKey(relation), relation);
      }
    }

    return Array.from(relations.values());
  }
}

function createRelation(
  sourceDoc: string,
  targetDoc: string,
  relationType: DiscoveredRelation['relationType'],
  confidence: number,
  ruleName: string,
): DiscoveredRelation {
  return {
    confidence,
    relationType,
    ruleName,
    source: 'auto_scan',
    sourceDoc,
    targetDoc,
  };
}

function isDescendantDocument(candidatePath: string, sourceDirectory: string): boolean {
  const relativePath = relative(sourceDirectory, candidatePath);
  return relativePath.length > 0 && !relativePath.startsWith('..') && dirname(relativePath) !== '.';
}

function extractPrefix(filePath: string): string | undefined {
  const name = basename(filePath, '.md');
  const [prefix] = name.split(/[-_]/, 1);
  return prefix && prefix !== name ? prefix : undefined;
}

function createRelationKey(relation: DiscoveredRelation): string {
  return [relation.sourceDoc, relation.targetDoc, relation.relationType].join('::');
}
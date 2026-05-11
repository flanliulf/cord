import type { IGraphRepository } from '../repositories/index.js';
import { type QueryInput, validateQueryInput } from '../schemas/index.js';
import type { DocumentNode, RelationEdge, RelationType } from '../types/index.js';
import { QueryError } from '../utils/index.js';

export interface QueryResultItem {
  relationId: string;
  targetPath: string;
  relationType: RelationType;
  confidence: number;
  source: RelationEdge['source'];
  status: RelationEdge['status'];
  hopDistance: number;
}

export interface QueryRelationsOutput {
  relations: QueryResultItem[];
  totalCount: number;
}

export class QueryService {
  constructor(private readonly repository: IGraphRepository) {}

  query(input: QueryInput): QueryRelationsOutput {
    const validatedInput = validateQueryInput(input);
    const sourceDocument = this.repository.getDocumentByPath(validatedInput.docPath);

    if (sourceDocument === null) {
      throw new QueryError({
        message: `[CORD_QUERY_001] 未找到文档: ${validatedInput.docPath} → 请先运行 cord scan 确认文档路径`,
        code: 'CORD_QUERY_001',
        suggestion: '请先运行 cord scan 确认文档路径',
        context: { docPath: validatedInput.docPath },
      });
    }

    const visitedDocIds = new Set<string>([sourceDocument.id]);
    const seenRelationIds = new Set<string>();
    const relations: QueryResultItem[] = [];
    const queue: Array<{ docId: string; depth: number }> = [{ docId: sourceDocument.id, depth: 0 }];
    let queueIndex = 0;

    while (queueIndex < queue.length) {
      const current = queue[queueIndex];
      queueIndex += 1;

      if (current === undefined || current.depth >= validatedInput.depth) {
        continue;
      }

      const traversableEdges = this.repository
        .getRelationsByDocId(current.docId, 'both')
        .filter((relation) => validatedInput.includeDeprecated || relation.status === 'active');

      for (const relation of traversableEdges) {
        if (seenRelationIds.has(relation.id)) {
          continue;
        }

        const hopDistance = current.depth + 1;
        const shouldOutput = validatedInput.type === undefined || relation.relationType === validatedInput.type;
        const shouldExpand = hopDistance < validatedInput.depth;

        if (!shouldOutput && !shouldExpand) {
          seenRelationIds.add(relation.id);
          continue;
        }

        const relatedDocument = this.resolveRelatedDocument(current.docId, relation);

        if (shouldOutput) {
          relations.push({
            relationId: relation.id,
            targetPath: relatedDocument.path,
            relationType: relation.relationType,
            confidence: relation.confidence,
            source: relation.source,
            status: relation.status,
            hopDistance,
          });
        }

        seenRelationIds.add(relation.id);

        if (!visitedDocIds.has(relatedDocument.id) && shouldExpand) {
          visitedDocIds.add(relatedDocument.id);
          queue.push({ docId: relatedDocument.id, depth: hopDistance });
        }
      }
    }

    return {
      relations,
      totalCount: relations.length,
    };
  }

  private resolveRelatedDocument(sourceDocId: string, relation: RelationEdge): DocumentNode {
    const targetDocId = relation.sourceDocId === sourceDocId ? relation.targetDocId : relation.sourceDocId;
    const targetDocument = this.repository.getDocumentById(targetDocId);

    if (targetDocument === null) {
      throw new QueryError({
        message: `[CORD_QUERY_002] 关系端点文档不存在: ${relation.id} → 请重新运行 cord scan 重建关系图谱`,
        code: 'CORD_QUERY_002',
        suggestion: '请重新运行 cord scan 重建关系图谱',
        context: {
          relationId: relation.id,
          sourceDocId,
          targetDocId,
        },
      });
    }

    return targetDocument;
  }

  close(): void {
    this.repository.close();
  }
}
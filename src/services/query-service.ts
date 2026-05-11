import type { IGraphRepository } from '../repositories/index.js';
import { type QueryInput, validateQueryInput } from '../schemas/index.js';
import type { RelationEdge, RelationType } from '../types/index.js';
import { QueryError } from '../utils/index.js';

export interface QueryResultItem {
  relationId: string;
  targetPath: string;
  relationType: RelationType;
  confidence: number;
  source: RelationEdge['source'];
  status: RelationEdge['status'];
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

    const relations = this.repository
      .getRelationsByDocId(sourceDocument.id, 'both')
      .filter((relation) => validatedInput.includeDeprecated || relation.status === 'active')
      .filter((relation) => validatedInput.type === undefined || relation.relationType === validatedInput.type)
      .map((relation) => ({
        relationId: relation.id,
        targetPath: this.resolveTargetPath(sourceDocument.id, relation),
        relationType: relation.relationType,
        confidence: relation.confidence,
        source: relation.source,
        status: relation.status,
      }));

    return {
      relations,
      totalCount: relations.length,
    };
  }

  private resolveTargetPath(sourceDocId: string, relation: RelationEdge): string {
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

    return targetDocument.path;
  }

  close(): void {
    this.repository.close();
  }
}
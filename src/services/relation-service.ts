import type { IGraphRepository } from '../repositories/index.js';
import {
  type AddRelationInput,
  type DeprecateRelationInput,
  type RemoveRelationInput,
  validateAddRelationInput,
  validateDeprecateRelationInput,
  validateRemoveRelationInput,
} from '../schemas/index.js';
import type { DocumentNode, RelationEdge, RelationType } from '../types/index.js';
import { RelationError, StorageError } from '../utils/index.js';

interface RelationHistoryEntry {
  action: 'deprecated';
  timestamp: string;
  previousSource: RelationEdge['source'];
  nextSource: 'manual';
  previousStatus: 'active';
  nextStatus: 'deprecated';
}

export class RelationService {
  constructor(private readonly repository: IGraphRepository) {}

  addRelation(input: AddRelationInput): RelationEdge {
    const validatedInput = validateAddRelationInput(input);

    return this.repository.transaction(() => {
      const sourceDocument = this.requireDocumentByPath(validatedInput.sourcePath);
      const targetDocument = this.requireDocumentByPath(validatedInput.targetPath);

      this.ensureNoDuplicateRelation(
        sourceDocument.id,
        targetDocument.id,
        validatedInput.relationType,
        validatedInput.sourcePath,
        validatedInput.targetPath,
      );

      try {
        return this.repository.addRelation({
          sourceDocId: sourceDocument.id,
          targetDocId: targetDocument.id,
          relationType: validatedInput.relationType,
          confidence: 1,
          source: 'manual',
          status: 'active',
        });
      } catch (error) {
        throw this.createStorageError('addRelation', error, { input: validatedInput });
      }
    });
  }

  removeRelation(input: RemoveRelationInput): void {
    const validatedInput = validateRemoveRelationInput(input);

    this.repository.transaction(() => {
      this.requireRelation(validatedInput.relationId);

      try {
        this.repository.deleteRelation(validatedInput.relationId);
      } catch (error) {
        throw this.createStorageError('removeRelation', error, { input: validatedInput });
      }
    });
  }

  deprecateRelation(input: DeprecateRelationInput): RelationEdge {
    const validatedInput = validateDeprecateRelationInput(input);

    return this.repository.transaction(() => {
      const relation = this.requireRelation(validatedInput.relationId);

      if (relation.status === 'deprecated') {
        return relation;
      }

      try {
        return this.repository.updateRelation(validatedInput.relationId, {
          source: 'manual',
          status: 'deprecated',
          metadata: this.appendDeprecatedHistory(relation),
        });
      } catch (error) {
        throw this.createStorageError('deprecateRelation', error, { input: validatedInput });
      }
    });
  }

  close(): void {
    this.repository.close();
  }

  private requireDocumentByPath(docPath: string): DocumentNode {
    const document = this.repository.getDocumentByPath(docPath);

    if (document === null) {
      throw new RelationError({
        message: `[CORD_RELATION_001] 文档不存在: ${docPath} → 请先运行 cord scan 确认文档已入库`,
        code: 'CORD_RELATION_001',
        suggestion: '请先运行 cord scan 确认文档已入库',
        context: { docPath },
      });
    }

    return document;
  }

  private requireRelation(relationId: string): RelationEdge {
    const relation = this.repository.getRelationById(relationId);

    if (relation === null) {
      throw new RelationError({
        message: `[CORD_RELATION_003] 关系不存在: ${relationId} → 请先查询最新关系列表后重试`,
        code: 'CORD_RELATION_003',
        suggestion: '请先查询最新关系列表后重试',
        context: { relationId },
      });
    }

    return relation;
  }

  private ensureNoDuplicateRelation(
    sourceDocId: string,
    targetDocId: string,
    relationType: RelationType,
    sourcePath: string,
    targetPath: string,
  ): void {
    const duplicate = this.repository.getRelationsByDocId(sourceDocId, 'source').find((relation) => (
      relation.targetDocId === targetDocId && relation.relationType === relationType
    ));

    if (duplicate !== undefined) {
      throw new RelationError({
        message: `[CORD_RELATION_002] 重复关系: ${sourcePath} -> ${targetPath} (${relationType}) → 请改用 removeRelation 或 deprecateRelation 管理现有关系`,
        code: 'CORD_RELATION_002',
        suggestion: '请改用 removeRelation 或 deprecateRelation 管理现有关系',
        context: {
          sourceDocId,
          targetDocId,
          relationType,
          duplicateRelationId: duplicate.id,
        },
      });
    }
  }

  private appendDeprecatedHistory(relation: RelationEdge): Record<string, unknown> {
    const historyEntry: RelationHistoryEntry = {
      action: 'deprecated',
      timestamp: new Date().toISOString(),
      previousSource: relation.source,
      nextSource: 'manual',
      previousStatus: 'active',
      nextStatus: 'deprecated',
    };
    const metadata = relation.metadata ?? {};
    const existingHistory = Array.isArray(metadata.history) ? metadata.history : [];

    return {
      ...metadata,
      history: [...existingHistory, historyEntry],
    };
  }

  private createStorageError(operation: string, error: unknown, context: Record<string, unknown>): StorageError {
    return new StorageError({
      message: `[CORD_RELATION_005] 关系存储失败: ${operation} → 请检查数据库状态后重试`,
      code: 'CORD_RELATION_005',
      suggestion: '请检查数据库状态后重试',
      context,
      cause: error instanceof Error ? error : undefined,
    });
  }
}

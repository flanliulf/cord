import type { IGraphRepository } from '../repositories/index.js';
import { type ImpactInput, validateImpactInput } from '../schemas/index.js';
import {
  DEFAULT_UPDATE_STRATEGY,
  type DocumentNode,
  RELATION_IMPACT_PROPAGATION_MATRIX,
  type RelationEdge,
  type RelationImpactPropagationRule,
  type RelationType,
  type UpdateStrategy,
} from '../types/index.js';
import { QueryError } from '../utils/index.js';

const DEFAULT_IMPACT_DEPTH = 3;
const DEFAULT_CONFIDENCE_THRESHOLD = 0.5;

export type PropagationType = RelationType;

export type ImpactSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info' | 'none';

export interface ImpactedDoc {
  docPath: string;
  relationType: RelationType;
  propagationType: PropagationType;
  suggestedAction: string;
  updateStrategy: UpdateStrategy;
  severity: ImpactSeverity;
  confidence: number;
  hopDistance: number;
}

export interface ImpactResult {
  impactedDocs: ImpactedDoc[];
  totalCount: number;
}

interface ImpactServiceOptions {
  defaultConfidenceThreshold?: number;
  defaultUpdateStrategy?: UpdateStrategy;
  updateStrategies?: Record<string, UpdateStrategy>;
}

const IMPACT_ACTIONS: Record<RelationType, { suggestedAction: string; severity: ImpactSeverity }> = {
  sync_required: { suggestedAction: '需要同步更新', severity: 'critical' },
  must_consistent: { suggestedAction: '必须保持一致', severity: 'critical' },
  lifecycle_bound: { suggestedAction: '检查生命周期影响', severity: 'high' },
  contains: { suggestedAction: '检查包含内容', severity: 'medium' },
  sync_suggested: { suggestedAction: '建议同步更新', severity: 'medium' },
  derived_from: { suggestedAction: '检查源文档变更', severity: 'low' },
  context_for: { suggestedAction: '仅供参考', severity: 'info' },
  references: { suggestedAction: '仅供参考', severity: 'info' },
  deprecated: { suggestedAction: '已废弃，忽略', severity: 'none' },
};

const SEVERITY_PRIORITY: Record<ImpactSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
  none: 5,
};

export class ImpactService {
  private readonly defaultConfidenceThreshold: number;

  private readonly defaultUpdateStrategy: UpdateStrategy;

  private readonly updateStrategies: Record<string, UpdateStrategy>;

  constructor(
    private readonly repository: IGraphRepository,
    options: ImpactServiceOptions = {},
  ) {
    this.defaultConfidenceThreshold = options.defaultConfidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;
    this.defaultUpdateStrategy = options.defaultUpdateStrategy ?? DEFAULT_UPDATE_STRATEGY;
    this.updateStrategies = { ...options.updateStrategies };
  }

  /**
   * 计算指定文档在三跳传播范围内的受影响文档集合。
   *
   * @param input - 影响分析输入；depth 在 v0.1 固定为 3，不对外暴露
   * @returns 按严重程度排序的影响分析结果
   */
  analyzeImpact(input: ImpactInput): ImpactResult {
    const validatedInput = validateImpactInput(input);
    const confidenceThreshold = validatedInput.confidenceThreshold ?? this.defaultConfidenceThreshold;
    const sourceDocument = this.resolveSourceDocument(validatedInput.docPath);
    const impactedDocsByPath = new Map<string, ImpactedDoc>();
    const visitedDocIds = new Set<string>([sourceDocument.id]);
    const queue: Array<{ docId: string; depth: number }> = [{ docId: sourceDocument.id, depth: 0 }];
    let queueIndex = 0;

    while (queueIndex < queue.length) {
      const current = queue[queueIndex];
      queueIndex += 1;

      if (current === undefined || current.depth >= DEFAULT_IMPACT_DEPTH) {
        continue;
      }

      const traversableRelations = this.repository
        .getRelationsByDocId(current.docId, 'source')
        .filter((relation) => isTraversableRelation(relation, current.docId, confidenceThreshold));

      for (const relation of traversableRelations) {
        const hopDistance = current.depth + 1;
        const targetDocument = this.resolveTargetDocument(current.docId, relation);

        if (targetDocument.id === sourceDocument.id) {
          continue;
        }

        const candidate = toImpactedDoc(
          targetDocument,
          relation,
          hopDistance,
          resolveUpdateStrategy(targetDocument.docType, this.updateStrategies, this.defaultUpdateStrategy),
        );
        const existing = impactedDocsByPath.get(targetDocument.path);

        if (existing === undefined || isBetterImpactCandidate(candidate, existing)) {
          impactedDocsByPath.set(targetDocument.path, candidate);
        }

        if (hopDistance < DEFAULT_IMPACT_DEPTH && !visitedDocIds.has(targetDocument.id)) {
          visitedDocIds.add(targetDocument.id);
          queue.push({ docId: targetDocument.id, depth: hopDistance });
        }
      }
    }

    const impactedDocs = [...impactedDocsByPath.values()].sort(compareImpactedDocs);

    return {
      impactedDocs,
      totalCount: impactedDocs.length,
    };
  }

  /**
   * 释放 ImpactService 关联的查询服务或仓储资源。
   */
  close(): void {
    this.repository.close();
  }

  private resolveSourceDocument(docPath: string): DocumentNode {
    const sourceDocument = this.repository.getDocumentByPath(docPath);

    if (sourceDocument === null) {
      throw new QueryError({
        message: `[CORD_QUERY_001] 未找到文档: ${docPath} → 请先运行 cord scan 确认文档路径`,
        code: 'CORD_QUERY_001',
        suggestion: '请先运行 cord scan 确认文档路径',
        context: { docPath },
      });
    }

    return sourceDocument;
  }

  private resolveTargetDocument(sourceDocId: string, relation: RelationEdge): DocumentNode {
    const targetDocument = this.repository.getDocumentById(relation.targetDocId);

    if (targetDocument === null) {
      throw new QueryError({
        message: `[CORD_QUERY_002] 关系端点文档不存在: ${relation.id} → 请重新运行 cord scan 重建关系图谱`,
        code: 'CORD_QUERY_002',
        suggestion: '请重新运行 cord scan 重建关系图谱',
        context: {
          relationId: relation.id,
          sourceDocId,
          targetDocId: relation.targetDocId,
        },
      });
    }

    return targetDocument;
  }
}

function isTraversableRelation(relation: RelationEdge, sourceDocId: string, confidenceThreshold: number): boolean {
  const propagationRule: RelationImpactPropagationRule = RELATION_IMPACT_PROPAGATION_MATRIX[relation.relationType];

  return propagationRule.direction === 'source_to_target'
    && relation.sourceDocId === sourceDocId
    && propagationRule.traversableStatuses.includes(relation.status)
    && relation.confidence >= confidenceThreshold;
}

function toImpactedDoc(
  targetDocument: DocumentNode,
  relation: RelationEdge,
  hopDistance: number,
  updateStrategy: UpdateStrategy,
): ImpactedDoc {
  const propagationType = relation.relationType;
  const action = IMPACT_ACTIONS[propagationType];

  return {
    docPath: targetDocument.path,
    relationType: relation.relationType,
    propagationType,
    suggestedAction: action.suggestedAction,
    updateStrategy,
    severity: action.severity,
    confidence: relation.confidence,
    hopDistance,
  };
}

function resolveUpdateStrategy(
  docType: string | undefined,
  updateStrategies: Record<string, UpdateStrategy>,
  defaultUpdateStrategy: UpdateStrategy,
): UpdateStrategy {
  if (docType === undefined) {
    return defaultUpdateStrategy;
  }

  return updateStrategies[docType] ?? defaultUpdateStrategy;
}

function isBetterImpactCandidate(candidate: ImpactedDoc, existing: ImpactedDoc): boolean {
  return SEVERITY_PRIORITY[candidate.severity] < SEVERITY_PRIORITY[existing.severity]
    || (
      SEVERITY_PRIORITY[candidate.severity] === SEVERITY_PRIORITY[existing.severity]
      && candidate.hopDistance < existing.hopDistance
    )
    || (
      SEVERITY_PRIORITY[candidate.severity] === SEVERITY_PRIORITY[existing.severity]
      && candidate.hopDistance === existing.hopDistance
      && candidate.confidence > existing.confidence
    );
}

function compareImpactedDocs(left: ImpactedDoc, right: ImpactedDoc): number {
  return SEVERITY_PRIORITY[left.severity] - SEVERITY_PRIORITY[right.severity]
    || left.hopDistance - right.hopDistance
    || right.confidence - left.confidence
    || left.docPath.localeCompare(right.docPath);
}

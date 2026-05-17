import { isAbsolute, relative, resolve } from 'node:path';
import { z } from 'zod';
import { toJsonSchema } from '../../schemas/index.js';
import { RELATION_TYPES, type RelationType, UPDATE_STRATEGY_VALUES, type UpdateStrategy } from '../../types/index.js';
import { ConfigError } from '../../utils/index.js';

const relationTypeValues = Object.values(RELATION_TYPES) as [RelationType, ...RelationType[]];
const updateStrategyValues = [...UPDATE_STRATEGY_VALUES] as [UpdateStrategy, ...UpdateStrategy[]];

export const RelationTypeSchema = z.enum(relationTypeValues);
export const RelationSourceSchema = z.enum(['auto_scan', 'manual', 'framework_preset']);
export const RelationStatusSchema = z.enum(['active', 'deprecated']);
export const UpdateStrategySchema = z.enum(updateStrategyValues);

const projectRelativePathSchema = z.string().trim().min(1);

export const AnalyzeImpactInput = z.object({
  docPath: projectRelativePathSchema.describe('待分析的文档路径'),
  confidenceThreshold: z.number().min(0).max(1).optional().describe('最低置信度阈值'),
});

// 为满足 NFR13，MCP output 直接镜像当前 ImpactService / CLI JSON 结构。
export const AnalyzeImpactResult = z.object({
  impactedDocs: z.array(z.object({
    docPath: z.string(),
    relationType: RelationTypeSchema,
    propagationType: RelationTypeSchema,
    suggestedAction: z.string(),
    updateStrategy: UpdateStrategySchema,
    severity: z.enum(['critical', 'high', 'medium', 'low', 'info', 'none']),
    confidence: z.number(),
    hopDistance: z.number().int().min(1),
  })),
  totalCount: z.number().int().min(0),
});

export const QueryRelationsInput = z.object({
  docPath: projectRelativePathSchema.describe('查询文档路径'),
  type: RelationTypeSchema.optional().describe('按关系类型过滤（FR14）'),
  includeDeprecated: z.boolean().optional().default(false).describe('是否包含 deprecated 状态的关系'),
  depth: z.number().int().min(1).max(3).optional().default(1).describe('遍历深度（1-3）'),
});

// 为满足 NFR13，MCP output 直接镜像当前 QueryService / CLI JSON 结构。
export const QueryRelationsResult = z.object({
  relations: z.array(z.object({
    relationId: z.string(),
    targetPath: z.string(),
    relationType: RelationTypeSchema,
    confidence: z.number(),
    source: RelationSourceSchema,
    status: RelationStatusSchema,
    hopDistance: z.number().int().min(1),
  })),
  totalCount: z.number().int().min(0),
});

export const InitGraphInput = z.object({
  rebuild: z.boolean().optional().default(false).describe('是否重建图谱'),
  force: z.boolean().optional().default(false).describe('rebuild 时是否跳过 manual 关系确认'),
});

// 为满足 NFR13，MCP output 直接镜像当前 ScanService / CLI JSON 结构。
export const InitGraphResult = z.object({
  documentsFound: z.number().int().min(0),
  relationsDiscovered: z.number().int().min(0),
  warnings: z.array(z.string()),
  durationMs: z.number().min(0).describe('扫描耗时（ms）'),
});

export const SyncDocsInput = z.object({
  filePath: projectRelativePathSchema.describe('已变更的文档路径（单文档）'),
});

export const AddRelationInput = z.object({
  sourcePath: projectRelativePathSchema.describe('源文档路径'),
  targetPath: projectRelativePathSchema.describe('目标文档路径'),
  relationType: RelationTypeSchema.describe('关系类型'),
});

export const RemoveRelationInput = z.object({
  relationId: z.string().trim().min(1).describe('要移除关系的 ID'),
});

export const DeprecateRelationInput = z.object({
  relationId: z.string().trim().min(1).describe('要标记为 deprecated 关系的 ID'),
});

export const SyncDocsResult = z.object({
  suggestions: z.array(z.object({
    targetPath: z.string(),
    action: z.enum(['update', 'review', 'log_only']),
    updateStrategy: UpdateStrategySchema,
    reason: z.string(),
  })),
  affectedCount: z.number().int().min(0),
});

export const AddRelationResult = z.object({
  relationId: z.string(),
  sourcePath: z.string(),
  targetPath: z.string(),
  relationType: RelationTypeSchema,
  source: z.literal('manual'),
  status: z.literal('active'),
});

export const RemoveRelationResult = z.object({
  success: z.literal(true),
  relationId: z.string().describe('已物理删除的 relationId'),
});

export const DeprecateRelationResult = z.object({
  relationId: z.string(),
  status: z.literal('deprecated'),
  relationType: RelationTypeSchema.describe('保留原始关系类型不变'),
});

export const AnalyzeImpactInputJsonSchema = toJsonSchema(AnalyzeImpactInput, 'AnalyzeImpactInput');
export const AnalyzeImpactResultJsonSchema = toJsonSchema(AnalyzeImpactResult, 'AnalyzeImpactResult');
export const QueryRelationsInputJsonSchema = toJsonSchema(QueryRelationsInput, 'QueryRelationsInput');
export const QueryRelationsResultJsonSchema = toJsonSchema(QueryRelationsResult, 'QueryRelationsResult');
export const InitGraphInputJsonSchema = toJsonSchema(InitGraphInput, 'InitGraphInput');
export const InitGraphResultJsonSchema = toJsonSchema(InitGraphResult, 'InitGraphResult');
export const SyncDocsInputJsonSchema = toJsonSchema(SyncDocsInput, 'SyncDocsInput');
export const SyncDocsResultJsonSchema = toJsonSchema(SyncDocsResult, 'SyncDocsResult');
export const AddRelationInputJsonSchema = toJsonSchema(AddRelationInput, 'AddRelationInput');
export const AddRelationResultJsonSchema = toJsonSchema(AddRelationResult, 'AddRelationResult');
export const RemoveRelationInputJsonSchema = toJsonSchema(RemoveRelationInput, 'RemoveRelationInput');
export const RemoveRelationResultJsonSchema = toJsonSchema(RemoveRelationResult, 'RemoveRelationResult');
export const DeprecateRelationInputJsonSchema = toJsonSchema(DeprecateRelationInput, 'DeprecateRelationInput');
export const DeprecateRelationResultJsonSchema = toJsonSchema(DeprecateRelationResult, 'DeprecateRelationResult');

export const MCP_TOOL_SCHEMAS = {
  analyze_impact: {
    inputSchema: AnalyzeImpactInput,
    outputSchema: AnalyzeImpactResult,
    inputJsonSchema: AnalyzeImpactInputJsonSchema,
    outputJsonSchema: AnalyzeImpactResultJsonSchema,
  },
  query_relations: {
    inputSchema: QueryRelationsInput,
    outputSchema: QueryRelationsResult,
    inputJsonSchema: QueryRelationsInputJsonSchema,
    outputJsonSchema: QueryRelationsResultJsonSchema,
  },
  init_graph: {
    inputSchema: InitGraphInput,
    outputSchema: InitGraphResult,
    inputJsonSchema: InitGraphInputJsonSchema,
    outputJsonSchema: InitGraphResultJsonSchema,
  },
  sync_docs: {
    inputSchema: SyncDocsInput,
    outputSchema: SyncDocsResult,
    inputJsonSchema: SyncDocsInputJsonSchema,
    outputJsonSchema: SyncDocsResultJsonSchema,
  },
  add_relation: {
    inputSchema: AddRelationInput,
    outputSchema: AddRelationResult,
    inputJsonSchema: AddRelationInputJsonSchema,
    outputJsonSchema: AddRelationResultJsonSchema,
  },
  remove_relation: {
    inputSchema: RemoveRelationInput,
    outputSchema: RemoveRelationResult,
    inputJsonSchema: RemoveRelationInputJsonSchema,
    outputJsonSchema: RemoveRelationResultJsonSchema,
  },
  deprecate_relation: {
    inputSchema: DeprecateRelationInput,
    outputSchema: DeprecateRelationResult,
    inputJsonSchema: DeprecateRelationInputJsonSchema,
    outputJsonSchema: DeprecateRelationResultJsonSchema,
  },
} as const;

export function normalizeProjectRelativePath(projectRoot: string, rawPath: string, actionLabel: string): string {
  const absolutePath = resolve(projectRoot, rawPath);
  const relativePath = relative(projectRoot, absolutePath);
  const normalizedRelativePath = relativePath.replaceAll('\\', '/');

  if (
    normalizedRelativePath === ''
    || normalizedRelativePath === '..'
    || normalizedRelativePath.startsWith('../')
    || isAbsolute(relativePath)
  ) {
    throw new ConfigError({
      message: `${actionLabel}路径位于项目根目录外: ${rawPath}`,
      suggestion: '请传入项目根目录内的文档路径，例如 docs/a.md',
    });
  }

  return normalizedRelativePath;
}

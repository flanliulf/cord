import { ZodError, z } from 'zod';
import { RELATION_TYPES } from '../types/relations.js';
import type { RelationType } from '../types/index.js';
import { RelationError } from '../utils/index.js';

const relationTypeValues = Object.values(RELATION_TYPES) as [RelationType, ...RelationType[]];

export const addRelationInputSchema = z.object({
  sourcePath: z.string().trim().min(1, 'sourcePath 不能为空'),
  targetPath: z.string().trim().min(1, 'targetPath 不能为空'),
  relationType: z.enum(relationTypeValues),
});

export const removeRelationInputSchema = z.object({
  relationId: z.string().trim().min(1, 'relationId 不能为空'),
});

export const deprecateRelationInputSchema = z.object({
  relationId: z.string().trim().min(1, 'relationId 不能为空'),
});

export type AddRelationInput = z.infer<typeof addRelationInputSchema>;
export type RemoveRelationInput = z.infer<typeof removeRelationInputSchema>;
export type DeprecateRelationInput = z.infer<typeof deprecateRelationInputSchema>;

function validateRelationInput<T>(schema: z.ZodType<T>, data: unknown, code: string): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new RelationError({
        message: `[${code}] 输入无效: ${error.issues.map((issue) => issue.message).join(', ')} → 请检查传入参数格式`,
        code,
        suggestion: '请检查传入参数格式',
        context: { issues: error.issues },
        cause: error,
      });
    }

    throw error;
  }
}

export function validateAddRelationInput(data: unknown): AddRelationInput {
  return validateRelationInput(addRelationInputSchema, data, 'CORD_RELATION_004');
}

export function validateRemoveRelationInput(data: unknown): RemoveRelationInput {
  return validateRelationInput(removeRelationInputSchema, data, 'CORD_RELATION_004');
}

export function validateDeprecateRelationInput(data: unknown): DeprecateRelationInput {
  return validateRelationInput(deprecateRelationInputSchema, data, 'CORD_RELATION_004');
}
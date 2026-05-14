import { z } from 'zod';
import { validateWithCordError } from './helpers.js';

export const exportInputSchema = z.object({
  projectRoot: z.string().trim().min(1),
  outputPath: z.string().trim().min(1).optional(),
});

export type ExportInput = z.infer<typeof exportInputSchema>;

export function validateExportInput(data: unknown): ExportInput {
  return validateWithCordError(exportInputSchema, data, 'CORD_SCHEMA_007');
}
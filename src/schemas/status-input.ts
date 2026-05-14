import { z } from 'zod';
import { validateWithCordError } from './helpers.js';

export const statusInputSchema = z.object({
  projectRoot: z.string().trim().min(1),
});

export type StatusInput = z.infer<typeof statusInputSchema>;

export function validateStatusInput(data: unknown): StatusInput {
  return validateWithCordError(statusInputSchema, data, 'CORD_SCHEMA_008');
}
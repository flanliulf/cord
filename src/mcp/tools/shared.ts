export type ToolStructuredContent = Record<string, unknown>;

export interface ToolTextResult extends Record<string, unknown> {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent: ToolStructuredContent;
}

export function createStructuredResult<T extends object>(structuredContent: T): ToolTextResult {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(structuredContent, null, 2),
      },
    ],
    structuredContent: structuredContent as ToolStructuredContent,
  };
}

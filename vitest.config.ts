import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      include: ['src/**/*.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
      exclude: [
        'src/**/*.d.ts',
        // Explicitly exclude known pure re-export barrel files (no business logic).
        // src/cli/index.ts is intentionally NOT listed here because it contains
        // real logic (runCli, entrypoint guard) and must remain inside the gate.
        'src/adapters/index.ts',
        'src/adapters/framework/index.ts',
        'src/adapters/ide/index.ts',
        'src/mcp/index.ts',
        'src/repositories/index.ts',
        'src/scanner/index.ts',
        'src/schemas/index.ts',
        'src/services/index.ts',
        'src/types/index.ts',
        'src/utils/index.ts',
      ],
    },
  },
});

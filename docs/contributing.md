# Contributing Guide

[English](contributing.md) | [简体中文](contributing.zh.md)

This guide explains how to contribute code, documentation, tests, and framework adapters to CORD. Before starting, identify the goal of your change: fixing an existing issue, improving documentation, extending CLI/MCP behavior, or adding a framework adapter.

The core rule for framework adapter contributions is: extend through the adapter layer, without modifying the core scanner, query service, or impact service.

## Before You Start

Confirm the following:

- You are using Node.js 20 LTS or later.
- Dependencies are installed with `npm install`.
- You have read the user-facing docs related to your change:
  - CLI changes: read [CLI Reference](cli-reference.md).
  - MCP Tool changes: read [MCP Tools Reference](mcp-tools-reference.md).
  - Configuration changes: read [Configuration Reference](configuration.md).
  - Framework adapter changes: read [Framework Adapter Guide](adapter-guide.md).

## Contribution Types

| Type              | Common changes                                          | Required documentation checks                                                                          |
| ----------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Docs              | README, getting started, references, contribution guide | Links are valid; examples match actual CLI/MCP behavior.                                               |
| CLI               | `src/cli/**`, CLI output, exit codes                    | [CLI Reference](cli-reference.md), tests, and JSON output examples.                                    |
| MCP               | `src/mcp/**`, tool schema, structured output            | [MCP Tools Reference](mcp-tools-reference.md), schema names, and examples.                             |
| Configuration     | `cord.config.*` parsing, defaults, IDE templates        | [Configuration Reference](configuration.md), getting-started initialization notes.                     |
| Framework adapter | `src/adapters/framework/<framework-name>/`              | [Framework Adapter Guide](adapter-guide.md), integration tests, and core no-modification confirmation. |

## Local Development Flow

1. Install dependencies: `npm install`.
2. Before editing, read the relevant docs and tests to confirm behavior ownership.
3. Change code, tests, and docs in small steps. User-visible behavior changes must update user docs.
4. Run validation commands that match the change scope.
5. In the PR, describe the purpose, test results, and documentation synchronization.

Common commands are listed in [Development Guide](../knowledge-base/development-guide.md).

## Documentation Synchronization Rules

User-visible behavior changes must update the corresponding docs:

- New or changed CLI command, option, or exit code: update [CLI Reference](cli-reference.md).
- New or changed MCP Tool, field, schema, or example: update [MCP Tools Reference](mcp-tools-reference.md).
- Changed configuration field, default, scan boundary, or IDE template: update [Configuration Reference](configuration.md).
- Changed first-run path: update [Getting Started](getting-started.md) and [README](../README.md).
- Changed contribution flow or test requirement: update this guide and related development docs.

Documentation examples should prefer copyable commands and project-relative paths. Avoid examples that depend on a developer's local absolute path.

## Framework Adapter Contribution Boundary

Before adding framework capability, confirm:

- The new framework can be expressed through `src/adapters/framework/<framework-name>/`.
- You do not need to modify `src/scanner/**`, `src/services/query-service.ts`, or `src/services/impact-service.ts`.
- You can provide at least one fixture project and one verifiable preset relationship.

## Integration Test Guide

Framework adapters must include integration tests proving that they work in realistic scan paths. Prefer `tests/integration/cli/` or `tests/integration/`, using fixture projects under `tests/fixtures/sample-projects/`.

Integration tests should cover at least:

- `resolveAdapter(config, projectRoot)` selects the target adapter.
- Target document types are recognized after scanning.
- At least one preset rule creates a relationship.
- Repeated scans do not break the existing graph.
- Tests do not depend on developer-local absolute paths.

### Integration Test Template

```ts
import { cpSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { SqliteGraphRepository } from '../../../src/repositories/index.js';
import { ScanService } from '../../../src/services/index.js';

function createTempProjectFromFixture(fixtureName: string): string {
  const targetRoot = mkdtempSync(join(tmpdir(), `cord-${fixtureName}-`));
  const fixtureRoot = join(process.cwd(), 'tests', 'fixtures', 'sample-projects', fixtureName);
  cpSync(fixtureRoot, targetRoot, { recursive: true });
  return targetRoot;
}

describe('example framework scan integration', () => {
  const createdRoots: string[] = [];

  afterEach(() => {
    for (const projectRoot of createdRoots.splice(0)) {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('scans the example fixture and persists documents and preset relations', async () => {
    const projectRoot = createTempProjectFromFixture('example-project');
    createdRoots.push(projectRoot);
    mkdirSync(join(projectRoot, '.cord'), { recursive: true });

    const repo = new SqliteGraphRepository(join(projectRoot, '.cord', 'cord.db'));
    const service = new ScanService(repo);

    try {
      const result = await service.scan({ projectRoot, rebuild: true, force: true });
      const relationCountAfterFirstScan = repo.getRelationCount();

      expect(result.documentsFound).toBeGreaterThan(0);
      expect(result.relationsDiscovered).toBeGreaterThanOrEqual(1);
      expect(repo.getAllDocuments().some((doc) => doc.docType === 'example-spec')).toBe(true);
      expect(
        repo.getAllRelations().some((relation) => relation.source === 'framework_preset'),
      ).toBe(true);

      const repeatedResult = await service.scan({ projectRoot });

      expect(repeatedResult.documentsFound).toBe(0);
      expect(repeatedResult.relationsDiscovered).toBe(0);
      expect(repo.getRelationCount()).toBe(relationCountAfterFirstScan);
    } finally {
      service.close();
    }
  });
});
```

Replace `example-project` with your fixture name and `example-spec` with your document type name.

## Validation Commands

Before submitting, run the commands that match the change scope. Documentation changes should at least run format checks; code changes should at least run tests.

General validation:

```bash
npm run format:check
npm run type-check
npm run test
```

Framework adapter contributions must also confirm that core modules were not modified:

```bash
git diff -- src/scanner src/services/query-service.ts src/services/impact-service.ts
```

The second command must produce no output. If it does, the adapter contribution crossed the extension boundary and should be redesigned at the adapter layer.

For release or packaging changes, also run:

```bash
npm run lint
npm run build
npm run smoke:bin
npm run pack:check
```

## PR Requirements

PR descriptions should include:

- Purpose: what user, contributor, or maintainer problem the change solves.
- Scope: CLI, MCP, configuration, documentation, framework adapter, or internal implementation.
- Documentation synchronization: which user docs were updated or confirmed as not needed.
- Test notes: commands run and results.

Framework adapter PRs should also include:

- Adapter name: the value used by `config.framework`.
- Document type list: added or changed `DocTypeDefinition` values.
- Preset rule list: added or changed `PresetRule` values, including relationship type and confidence.
- Core no-modification confirmation: `src/scanner/**`, `src/services/query-service.ts`, and `src/services/impact-service.ts` were not modified.

Suggested commit granularity:

- `feat(adapter): add <framework> framework adapter`
- `test(adapter): cover <framework> scan integration`
- `docs(adapter): document <framework> usage notes`
- `docs(readme): clarify public documentation entry points`
- `fix(cli): reject invalid project paths before service init`

## Common Minimal PR Checklists

### Docs-Only PR

- Explain the reader problem solved by the documentation change.
- Check all new or updated local links.
- Run `npm run format:check`.
- If README, Getting Started, Contributing, or reference docs changed, explain whether related entry points were synchronized.

### CLI Bugfix PR

- Describe the command, options, and expected exit code that trigger the bug.
- Add or update CLI unit or integration tests.
- Update affected command output, options, or exit codes in [CLI Reference](cli-reference.md).
- Run `npm run type-check`, `npm run test`, and, when needed, `npm run lint`.

### MCP Schema PR

- Describe the added or changed tool, input/output fields, and compatibility impact.
- Update tests related to `src/mcp/tools/schemas.ts`.
- Update schema tables and call examples in [MCP Tools Reference](mcp-tools-reference.md).
- Run `npm run type-check` and `npm run test`.

## Review Flow

Maintainers review in this order:

1. User impact: the behavior change is clear, necessary, and compatible.
2. Contract consistency: CLI/MCP/config/schema and docs are synchronized.
3. Test coverage: success paths, error paths, and key boundaries are covered.
4. Regression risk: validation commands pass and unrelated changes are avoided.
5. Documentation experience: new users or contributors can complete the task from the docs.

Framework adapter PRs are also reviewed for:

1. Extension boundary: the adapter extends only through `src/adapters/framework/**`.
2. Activation chain: registration order is correct and `GenericFrameworkAdapter` remains the final fallback.
3. Detection logic: `detectFramework()` is specific enough to avoid false positives in ordinary projects.
4. Data declarations: document types and preset rules are stable, explainable, and testable.
5. Test coverage: fixture and integration tests prove scan results.
6. Core path diff: `src/scanner/**`, `src/services/query-service.ts`, and `src/services/impact-service.ts` remain unchanged.
7. Documentation experience: a contributor can follow `docs/adapter-guide.md` to finish a minimal adapter within 4 hours.

Reviews may ask for more fixtures, narrower detection signals, smaller document type boundaries, or lower confidence for unstable preset rules. Non-blocking suggestions can become follow-up issues, but issues affecting core boundaries, test reliability, or user configuration semantics must be fixed before merge.

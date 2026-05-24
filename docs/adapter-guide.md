# Framework Adapter Guide

[English](adapter-guide.md) | [简体中文](adapter-guide.zh.md)

This guide is for contributors who want to add support for a new documentation framework in CORD. The goal is to build a minimal adapter module without modifying core scanning, querying, or impact analysis code. A minimal adapter includes document type registration, at least one preset relationship rule, and integration-test validation.

## Adapter Model

CORD's framework adapter layer has three parts:

1. `IFrameworkAdapter`: the shared interface every adapter implements.
2. `AbstractFrameworkAdapter`: the recommended base class. It provides default scan path handling, exclude path merging, and Markdown file discovery.
3. Concrete adapters: for example `BmadFrameworkAdapter`, or the fallback `GenericFrameworkAdapter`.

When adding a framework, place framework-specific files under `src/adapters/framework/<framework-name>/`, then register the adapter in `src/adapters/framework/index.ts`. Do not modify core modules such as `src/scanner/**`, `src/services/query-service.ts`, or `src/services/impact-service.ts`.

## `IFrameworkAdapter` API

The interface is defined in `src/adapters/framework/interfaces.ts`.

| Member                                                    | Type                                                                             | Purpose                                                           | Minimal implementation guidance                                                   |
| --------------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `readonly name`                                           | `string`                                                                         | Unique adapter name and matching value for `config.framework`     | Use lowercase kebab-case or a single lowercase word, such as `bmad` or `generic`. |
| `detectFramework(projectRoot)`                            | `(projectRoot: string) => boolean`                                               | Auto-detect whether the current project belongs to this framework | Check config files, directory structure, dependencies, or frontmatter signals.    |
| `getDocumentTypes()`                                      | `() => DocTypeDefinition[]`                                                      | Declare document types recognized by this framework               | Export constants from a separate `doc-types.ts`.                                  |
| `getPresetRules()`                                        | `() => PresetRule[]`                                                             | Declare built-in framework relationship rules                     | Export constants from a separate `preset-rules.ts`.                               |
| `getScanPaths(config)`                                    | `(config: CordConfig) => string[]`                                               | Provide default scan paths and allow user configuration override  | Usually inherit the default implementation from `AbstractFrameworkAdapter`.       |
| `getExcludePaths(config)`                                 | `(config: CordConfig) => string[]`                                               | Provide default exclude paths and merge user configuration        | Usually inherit the default implementation from `AbstractFrameworkAdapter`.       |
| `discoverDocuments(projectRoot, scanPaths, excludePaths)` | `(projectRoot: string, scanPaths: string[], excludePaths: string[]) => string[]` | Discover final Markdown files to scan                             | Usually inherit the default implementation from `AbstractFrameworkAdapter`.       |

Related data structures:

```ts
interface DocTypeDefinition {
  name: string;
  patterns: string[];
  description: string;
}

interface PresetRule {
  sourceDocType: string;
  targetDocType: string;
  relationType: RelationType;
  confidence: number;
}
```

## `AbstractFrameworkAdapter` Base Class

`AbstractFrameworkAdapter` lives in `src/adapters/framework/abstract-base.ts`. It already handles common logic that is easy to get wrong:

- Deduplicate and clean scan paths.
- Merge default exclude paths with user configuration.
- Recursively discover Markdown files.
- Skip symlinks.
- Sort file results for stable tests and scan output.

Each new adapter should usually inherit it and override only these methods:

```ts
protected override getDefaultScanPaths(): string[] {
  return ['docs'];
}

protected override getDefaultExcludePaths(): string[] {
  return ['src/', 'node_modules/', '.git/', 'dist/'];
}
```

Override `discoverDocuments()` only when the framework must scan non-Markdown files or has special discovery rules.

## Activation Chain And Selection Order

Adapter activation starts in the registry and is selected by `resolveAdapter(config, projectRoot)`.

1. Import and register the adapter in `src/adapters/framework/index.ts`. Registry order matters. `GenericFrameworkAdapter` must always be last.
2. `resolveAdapter(config, projectRoot)` checks `config.framework` first.
3. If `config.framework` is set, CORD searches only for an adapter with that name. If none exists, it throws `ConfigError` and does not continue with auto-detection.
4. If `config.framework` is unset, CORD calls `detectFramework()` on each adapter in registry order.
5. The first adapter returning `true` is selected.
6. `GenericFrameworkAdapter.detectFramework()` always returns `true`, so it is the final fallback.

This means `config.framework` has the highest priority. Auto-detection only runs when no explicit framework is configured.

## Create A Minimal Adapter From Scratch

The examples below use an `example` framework.

### 1. Create The Directory

```text
src/adapters/framework/example/
  adapter.ts
  doc-types.ts
  preset-rules.ts
```

### 2. Register Document Types

```ts
// src/adapters/framework/example/doc-types.ts
import type { DocTypeDefinition } from '../interfaces.js';

export const EXAMPLE_DOCUMENT_TYPES: DocTypeDefinition[] = [
  {
    name: 'example-spec',
    patterns: ['**/specs/**/*.md'],
    description: 'Example framework specification documents',
  },
  {
    name: 'example-task',
    patterns: ['**/tasks/**/*.md'],
    description: 'Example framework task documents',
  },
];
```

`name` is the document type value stored in the CORD graph. `patterns` classify candidate files; they should not expand scan scope. Scan scope is controlled by `getScanPaths()` and user configuration.

### 3. Add One Preset Rule

```ts
// src/adapters/framework/example/preset-rules.ts
import { RELATION_TYPES } from '../../../types/index.js';
import type { PresetRule } from '../interfaces.js';

export const EXAMPLE_PRESET_RULES: PresetRule[] = [
  {
    sourceDocType: 'example-spec',
    targetDocType: 'example-task',
    relationType: RELATION_TYPES.DERIVED_FROM,
    confidence: 0.9,
  },
];
```

Preset rules should represent stable and repeatable framework relationships. A confidence of at least `0.9` is recommended to avoid presenting weak conventions as strong relationships.

### 4. Implement The Adapter

```ts
// src/adapters/framework/example/adapter.ts
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { AbstractFrameworkAdapter } from '../abstract-base.js';
import type { DocTypeDefinition, PresetRule } from '../interfaces.js';
import { EXAMPLE_DOCUMENT_TYPES } from './doc-types.js';
import { EXAMPLE_PRESET_RULES } from './preset-rules.js';

const EXAMPLE_DEFAULT_SCAN_PATHS = ['docs', 'specs'];
const EXAMPLE_DEFAULT_EXCLUDE_PATHS = ['src/', 'node_modules/', '.git/', 'dist/'];

export class ExampleFrameworkAdapter extends AbstractFrameworkAdapter {
  readonly name = 'example';

  detectFramework(projectRoot: string): boolean {
    return existsSync(join(projectRoot, 'example.config.json'));
  }

  getDocumentTypes(): DocTypeDefinition[] {
    return EXAMPLE_DOCUMENT_TYPES;
  }

  getPresetRules(): PresetRule[] {
    return EXAMPLE_PRESET_RULES;
  }

  protected override getDefaultScanPaths(): string[] {
    return EXAMPLE_DEFAULT_SCAN_PATHS;
  }

  protected override getDefaultExcludePaths(): string[] {
    return EXAMPLE_DEFAULT_EXCLUDE_PATHS;
  }
}
```

### 5. Register The Adapter

Register it in `src/adapters/framework/index.ts`:

```ts
import { ExampleFrameworkAdapter } from './example/adapter.js';

export { ExampleFrameworkAdapter } from './example/adapter.js';

export const frameworkAdapters: IFrameworkAdapter[] = [
  new BmadFrameworkAdapter(),
  new ExampleFrameworkAdapter(),
  new GenericFrameworkAdapter(),
];
```

Keep `GenericFrameworkAdapter` last. If your adapter has broad detection conditions, place it after more specific adapters.

## 4-Hour Minimal Path

This sequence usually produces a minimal usable adapter within 4 hours:

| Timebox         | Goal                                                  | Completion standard                                                    |
| --------------- | ----------------------------------------------------- | ---------------------------------------------------------------------- |
| 0-30 minutes    | Read this guide and the BMAD reference implementation | You can explain `resolveAdapter(config, projectRoot)` selection order. |
| 30-90 minutes   | Create adapter directory and `adapter.ts`             | `detectFramework()` matches a local fixture.                           |
| 90-150 minutes  | Register document types                               | At least one `DocTypeDefinition` classifies fixture documents.         |
| 150-210 minutes | Add preset rules                                      | At least one `PresetRule` creates a relationship after scanning.       |
| 210-240 minutes | Write and run integration tests                       | `npm run test` passes and core source paths have no modifications.     |

For acceptance, confirm: document types are registered, at least one preset rule works, integration tests pass, and core modules were not modified.

## Self-Check

- [ ] The new adapter implements `IFrameworkAdapter`, preferably by extending `AbstractFrameworkAdapter`.
- [ ] It is registered in `src/adapters/framework/index.ts`, and `GenericFrameworkAdapter` remains last.
- [ ] Explicit `config.framework` can select the new adapter.
- [ ] `detectFramework()` can auto-detect when no explicit framework is configured.
- [ ] It includes at least one `DocTypeDefinition`.
- [ ] It includes at least one `PresetRule`.
- [ ] Integration tests cover scan results.
- [ ] `npm run test` passes.
- [ ] `src/scanner/**`, `src/services/query-service.ts`, and `src/services/impact-service.ts` are unchanged.

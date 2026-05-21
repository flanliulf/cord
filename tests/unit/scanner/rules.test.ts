import { describe, expect, it } from 'vitest';
import type { ParsedDocument } from '../../../src/scanner/types.js';
import {
  DirectoryRule,
  FrontmatterRule,
  MarkdownLinkRule,
  ScanRuleRegistry,
  createDefaultScanRules,
} from '../../../src/scanner/rules/index.js';

function createDocument(overrides?: Partial<ParsedDocument>): ParsedDocument {
  return {
    contentHash: 'hash',
    frontmatter: {},
    headings: [],
    links: [],
    path: '/project/docs/guide.md',
    ...overrides,
  };
}

describe('ScanRuleRegistry', () => {
  it('should register rules and expose them in insertion order', () => {
    const registry = new ScanRuleRegistry();
    const frontmatterRule = new FrontmatterRule();
    const markdownLinkRule = new MarkdownLinkRule();

    registry.register(frontmatterRule);
    registry.register(markdownLinkRule);

    expect(registry.getRules()).toEqual([frontmatterRule, markdownLinkRule]);
  });

  it('should expose the default rule set', () => {
    expect(createDefaultScanRules().map((rule) => rule.name)).toEqual([
      'frontmatter-rule',
      'markdown-link-rule',
      'directory-rule',
    ]);
  });
});

describe('FrontmatterRule', () => {
  it('should convert frontmatter references into document-level relations', () => {
    const rule = new FrontmatterRule();
    const document = createDocument({
      frontmatter: {
        inputDocuments: ['/docs/source.md'],
        references: ['./overview.md'],
        relatedDocs: ['./appendix.md'],
      },
    });

    const relations = rule.evaluate(document, [
      '/project/docs/source.md',
      '/project/docs/overview.md',
      '/project/docs/appendix.md',
    ]);

    expect(relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          confidence: 0.95,
          relationType: 'derived_from',
          ruleName: 'frontmatter-rule',
          source: 'auto_scan',
          sourceDoc: '/project/docs/guide.md',
          targetDoc: '/project/docs/source.md',
        }),
        expect.objectContaining({
          confidence: 0.95,
          relationType: 'references',
          targetDoc: '/project/docs/overview.md',
        }),
        expect.objectContaining({
          confidence: 0.95,
          relationType: 'references',
          targetDoc: '/project/docs/appendix.md',
        }),
      ]),
    );
  });

  it('should ignore invalid references and resolve unique suffix matches', () => {
    const rule = new FrontmatterRule();
    const document = createDocument({
      frontmatter: {
        dependencies: ['https://example.com/spec', '   ', ['docs/other.md?mode=full#section', './guide.md', '#local']],
      },
      path: '/project/notes/guide.md',
    });

    const relations = rule.evaluate(document, ['/project/notes/guide.md', '/project/docs/other.md']);

    expect(relations).toEqual([
      expect.objectContaining({
        confidence: 0.95,
        relationType: 'references',
        targetDoc: '/project/docs/other.md',
      }),
    ]);
  });
});

describe('MarkdownLinkRule', () => {
  it('should resolve relative and project-root links while skipping external or anchor links', () => {
    const rule = new MarkdownLinkRule();
    const document = createDocument({
      links: ['./overview.md', '/docs/source.md', 'https://example.com/spec', '#heading'],
    });

    const relations = rule.evaluate(document, [
      '/project/docs/guide.md',
      '/project/docs/overview.md',
      '/project/docs/source.md',
    ]);

    expect(relations).toEqual([
      expect.objectContaining({
        confidence: 0.85,
        relationType: 'references',
        sourceDoc: '/project/docs/guide.md',
        targetDoc: '/project/docs/overview.md',
      }),
      expect.objectContaining({
        confidence: 0.85,
        relationType: 'references',
        sourceDoc: '/project/docs/guide.md',
        targetDoc: '/project/docs/source.md',
      }),
    ]);
  });

  it('should ignore unresolved and invalid links while resolving unique suffix matches', () => {
    const rule = new MarkdownLinkRule();
    const document = createDocument({
      links: ['docs/other.md?mode=1#usage', '/missing.md', '   ', 'mailto:test@example.com'],
      path: '/project/notes/guide.md',
    });

    const relations = rule.evaluate(document, ['/project/notes/guide.md', '/project/docs/other.md']);

    expect(relations).toEqual([
      expect.objectContaining({
        confidence: 0.85,
        relationType: 'references',
        sourceDoc: '/project/notes/guide.md',
        targetDoc: '/project/docs/other.md',
      }),
    ]);
  });

  it('should ignore non-file URI schemes even when they resemble local document names', () => {
    const rule = new MarkdownLinkRule();
    const document = createDocument({
      links: [
        'mailto:other.md',
        'tel:other.md',
        'file:other.md',
        'custom+scheme:other.md',
        './colon:name.md',
      ],
    });

    const relations = rule.evaluate(document, [
      '/project/docs/guide.md',
      '/project/docs/mailto:other.md',
      '/project/docs/tel:other.md',
      '/project/docs/file:other.md',
      '/project/docs/custom+scheme:other.md',
      '/project/docs/colon:name.md',
    ]);

    expect(relations).toEqual([
      expect.objectContaining({
        confidence: 0.85,
        relationType: 'references',
        sourceDoc: '/project/docs/guide.md',
        targetDoc: '/project/docs/colon:name.md',
      }),
    ]);
  });
});

describe('DirectoryRule', () => {
  it('should infer same-directory, contains, and naming-prefix relations', () => {
    const rule = new DirectoryRule();

    const indexRelations = rule.evaluate(createDocument({ path: '/project/docs/index.md' }), [
      '/project/docs/index.md',
      '/project/docs/guide.md',
      '/project/docs/sub/child.md',
    ]);
    const prefixedRelations = rule.evaluate(
      createDocument({ path: '/project/docs/spec-overview.md' }),
      ['/project/docs/spec-overview.md', '/project/docs/spec-details.md'],
    );

    expect(indexRelations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          confidence: 0.5,
          relationType: 'references',
          targetDoc: '/project/docs/guide.md',
        }),
        expect.objectContaining({
          confidence: 0.7,
          relationType: 'contains',
          targetDoc: '/project/docs/sub/child.md',
        }),
      ]),
    );
    expect(prefixedRelations).toEqual([
      expect.objectContaining({
        confidence: 0.6,
        relationType: 'lifecycle_bound',
        targetDoc: '/project/docs/spec-details.md',
      }),
    ]);
  });

  it('should return no relations for isolated documents without heuristics', () => {
    const rule = new DirectoryRule();

    expect(rule.evaluate(createDocument({ path: '/project/docs/solo.md' }), ['/project/docs/solo.md'])).toEqual([]);
  });
});
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ScanPipeline, precheckScannableFile } from '../../../src/scanner/pipeline.js';
import { ScanError } from '../../../src/utils/index.js';

function createTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'cord-scanner-pipeline-'));
}

describe('ScanPipeline', () => {
  const createdRoots: string[] = [];

  afterEach(() => {
    for (const projectRoot of createdRoots.splice(0)) {
      rmSync(projectRoot, { force: true, recursive: true });
    }
  });

  it('should parse markdown and produce extracted metadata plus discovered relations', async () => {
    const projectRoot = createTempProject();
    createdRoots.push(projectRoot);
    mkdirSync(join(projectRoot, 'docs'), { recursive: true });

    const guidePath = join(projectRoot, 'docs', 'guide.md');
    const overviewPath = join(projectRoot, 'docs', 'overview.md');
    const sourcePath = join(projectRoot, 'docs', 'source.md');

    writeFileSync(
      guidePath,
      ['---', 'references:', '  - ./overview.md', 'inputDocuments:', '  - /docs/source.md', '---', '# Guide', '', 'See [Overview](./overview.md) and [Source](/docs/source.md).', '', '## Usage Notes'].join('\n'),
      'utf8',
    );
    writeFileSync(overviewPath, '# Overview\n', 'utf8');
    writeFileSync(sourcePath, '# Source\n', 'utf8');

    const pipeline = new ScanPipeline();
    const result = await pipeline.process(guidePath, [guidePath, overviewPath, sourcePath]);

    expect(result).not.toBeNull();
    expect(result?.document.frontmatter).toEqual({
      inputDocuments: ['/docs/source.md'],
      references: ['./overview.md'],
    });
    expect(result?.document.links).toEqual(['./overview.md', '/docs/source.md']);
    expect(result?.document.headings).toEqual([
      { depth: 1, text: 'Guide' },
      { depth: 2, text: 'Usage Notes' },
    ]);
    expect(result?.relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetDoc: overviewPath,
          relationType: 'references',
          sourceDoc: guidePath,
        }),
        expect.objectContaining({
          targetDoc: sourcePath,
          relationType: 'derived_from',
          sourceDoc: guidePath,
        }),
      ]),
    );
    expect(result?.warnings).toEqual([]);
  });

  it('should return null when the file contains invalid utf-8 bytes', async () => {
    const projectRoot = createTempProject();
    createdRoots.push(projectRoot);
    mkdirSync(join(projectRoot, 'docs'), { recursive: true });

    const invalidPath = join(projectRoot, 'docs', 'broken.md');
    writeFileSync(invalidPath, Buffer.from([0xc3, 0x28]));

    const pipeline = new ScanPipeline();

    await expect(pipeline.process(invalidPath, [invalidPath])).resolves.toBeNull();
    expect(pipeline.takeWarnings()).toEqual([`跳过编码错误的 Markdown 文件: ${invalidPath}`]);
    expect(pipeline.takeWarnings()).toEqual([]);
  });

  it('should keep scanning when frontmatter is malformed and report a warning', async () => {
    const projectRoot = createTempProject();
    createdRoots.push(projectRoot);
    mkdirSync(join(projectRoot, 'docs'), { recursive: true });

    const malformedPath = join(projectRoot, 'docs', 'malformed.md');
    writeFileSync(malformedPath, ['---', 'references: [./overview.md', '---', '# Broken Frontmatter'].join('\n'), 'utf8');

    const pipeline = new ScanPipeline();
    const result = await pipeline.process(malformedPath, [malformedPath]);

    expect(result).not.toBeNull();
    expect(result?.document.frontmatter).toEqual({});
    expect(result?.warnings).toEqual([`跳过无法解析的 frontmatter: ${malformedPath}`]);
  });

  it('should throw ScanError when the file cannot be read', async () => {
    const pipeline = new ScanPipeline();

    await expect(pipeline.process('/tmp/does-not-exist.md')).rejects.toMatchObject({
      code: 'CORD_SCAN_002',
      name: 'ScanError',
    } satisfies Partial<ScanError>);
  });

  it('should wrap rule evaluation failures as ScanError', async () => {
    const projectRoot = createTempProject();
    createdRoots.push(projectRoot);
    mkdirSync(join(projectRoot, 'docs'), { recursive: true });

    const filePath = join(projectRoot, 'docs', 'guide.md');
    writeFileSync(filePath, '# Guide\n', 'utf8');

    const pipeline = new ScanPipeline([
      {
        evaluate() {
          throw new Error('boom');
        },
        name: 'exploding-rule',
      },
    ]);

    await expect(pipeline.process(filePath, [filePath])).rejects.toMatchObject({
      code: 'CORD_SCAN_001',
      name: 'ScanError',
    } satisfies Partial<ScanError>);
  });

  it('should skip non-markdown files before reading and record a warning', async () => {
    const projectRoot = createTempProject();
    createdRoots.push(projectRoot);
    mkdirSync(join(projectRoot, 'docs'), { recursive: true });

    const textFilePath = join(projectRoot, 'docs', 'notes.txt');
    writeFileSync(textFilePath, 'plain text', 'utf8');

    const pipeline = new ScanPipeline();

    await expect(pipeline.process(textFilePath, [textFilePath])).resolves.toBeNull();
    expect(pipeline.takeWarnings()).toEqual([`跳过非 Markdown 文件: ${textFilePath}`]);
  });

  it('should skip oversized markdown files before parsing and record a warning', async () => {
    const projectRoot = createTempProject();
    createdRoots.push(projectRoot);
    mkdirSync(join(projectRoot, 'docs'), { recursive: true });

    const largeFilePath = join(projectRoot, 'docs', 'large.md');
    writeFileSync(largeFilePath, `# Large\n${'a'.repeat(1024 * 1024 + 32)}`, 'utf8');

    const pipeline = new ScanPipeline();

    await expect(pipeline.process(largeFilePath, [largeFilePath])).resolves.toBeNull();
    expect(pipeline.takeWarnings()).toEqual([`跳过超过 1MB 的 Markdown 文件: ${largeFilePath}`]);
  });
});

describe('precheckScannableFile', () => {
  it('should return null for scannable markdown files within the size limit', () => {
    expect(precheckScannableFile('/tmp/notes.md', 128)).toBeNull();
  });

  it('should return warnings for oversized or non-markdown files', () => {
    expect(precheckScannableFile('/tmp/notes.txt', 128)).toContain('非 Markdown');
    expect(precheckScannableFile('/tmp/notes.md', 1024 * 1024 + 1)).toContain('超过 1MB');
  });
});
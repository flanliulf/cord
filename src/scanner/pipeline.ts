import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { unified } from 'unified';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { extractFrontmatterPlugin } from './plugins/extract-frontmatter.js';
import { extractHeadingsPlugin } from './plugins/extract-headings.js';
import { extractLinksPlugin } from './plugins/extract-links.js';
import { createDefaultScanRules, type IScanRule } from './rules/index.js';
import type { ParsedDocument, ScanPipelineResult } from './types.js';
import { ScanError, logger } from '../utils/index.js';

const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });

/** 允许扫描的单文件最大体积。 */
export const MAX_SCANNABLE_FILE_SIZE_BYTES = 1024 * 1024;

/**
 * 对文件做扫描前预检。
 *
 * @param filePath - 文件路径
 * @param fileSizeBytes - 文件字节数
 * @returns 命中跳过条件时返回 warning，否则返回 null
 */
export function precheckScannableFile(filePath: string, fileSizeBytes: number): string | null {
  if (!filePath.toLowerCase().endsWith('.md')) {
    return `跳过非 Markdown 文件: ${filePath}`;
  }

  if (fileSizeBytes > MAX_SCANNABLE_FILE_SIZE_BYTES) {
    return `跳过超过 1MB 的 Markdown 文件: ${filePath}`;
  }

  return null;
}

interface ExtractionContext {
  filePath: string;
  frontmatter: ParsedDocument['frontmatter'];
  links: ParsedDocument['links'];
  headings: ParsedDocument['headings'];
  warnings: string[];
}

/**
 * ScanPipeline 编排 remark AST 提取与规则求值。
 */
export class ScanPipeline {
  private readonly rules: IScanRule[];
  private pendingWarnings: string[] = [];

  /**
   * @param rules - 可选规则列表；缺省使用 Story 2.2 默认规则集
   */
  constructor(rules: IScanRule[] = createDefaultScanRules()) {
    this.rules = rules;
  }

  /**
   * 读取并清空最近一次失败扫描累积的 warning。
   *
   * @returns warning 列表
   */
  takeWarnings(): string[] {
    const warnings = [...this.pendingWarnings];
    this.pendingWarnings = [];
    return warnings;
  }

  /**
   * 处理单个 Markdown 文档。
   *
   * @param filePath - 待处理文件的绝对路径
   * @param allDocPaths - 用于规则解析目标的全量文档路径列表
   * @returns 成功时返回扫描结果；编码错误时返回 null
   * @throws {@link ScanError} 当文件读取或 AST 处理失败时
   */
  async process(filePath: string, allDocPaths: string[] = [filePath]): Promise<ScanPipelineResult | null> {
    const fileSizeBytes = await this.statFileSizeOrThrow(filePath);
    const precheckWarning = precheckScannableFile(filePath, fileSizeBytes);
    if (precheckWarning) {
      this.pendingWarnings.push(precheckWarning);
      logger.warn(precheckWarning);
      return null;
    }

    const rawFile = await this.readFileOrThrow(filePath);
    const content = this.decodeUtf8OrSkip(filePath, rawFile);
    if (content === null) {
      return null;
    }

    const extractionContext: ExtractionContext = {
      filePath,
      frontmatter: {},
      headings: [],
      links: [],
      warnings: [],
    };

    try {
      const processor = unified()
        .use(remarkParse)
        .use(remarkFrontmatter, ['yaml'])
        .use(remarkGfm)
        .use(extractFrontmatterPlugin, extractionContext)
        .use(extractLinksPlugin, extractionContext)
        .use(extractHeadingsPlugin, extractionContext);

      const tree = processor.parse(content);
      await processor.run(tree);

      const document: ParsedDocument = {
        contentHash: createHash('sha256').update(rawFile).digest('hex'),
        frontmatter: extractionContext.frontmatter,
        headings: extractionContext.headings,
        links: extractionContext.links,
        path: filePath,
      };

      return {
        document,
        relations: this.rules.flatMap((rule) => rule.evaluate(document, allDocPaths)),
        warnings: extractionContext.warnings,
      };
    } catch (cause) {
      throw new ScanError({
        cause: cause instanceof Error ? cause : undefined,
        code: 'CORD_SCAN_001',
        context: { filePath },
        message: `扫描 Markdown AST 失败: ${filePath}`,
        suggestion: '请检查文档内容或扫描插件实现是否符合 unified/remark 约束。',
      });
    }
  }

  private async readFileOrThrow(filePath: string): Promise<Buffer> {
    try {
      return await readFile(filePath);
    } catch (cause) {
      throw new ScanError({
        cause: cause instanceof Error ? cause : undefined,
        code: 'CORD_SCAN_002',
        context: { filePath },
        message: `读取扫描文件失败: ${filePath}`,
        suggestion: '请确认文件存在且当前进程具备读取权限。',
      });
    }
  }

  private async statFileSizeOrThrow(filePath: string): Promise<number> {
    try {
      return (await stat(filePath)).size;
    } catch (cause) {
      throw new ScanError({
        cause: cause instanceof Error ? cause : undefined,
        code: 'CORD_SCAN_002',
        context: { filePath },
        message: `读取扫描文件失败: ${filePath}`,
        suggestion: '请确认文件存在且当前进程具备读取权限。',
      });
    }
  }

  private decodeUtf8OrSkip(filePath: string, rawFile: Buffer): string | null {
    try {
      return UTF8_DECODER.decode(rawFile);
    } catch {
      const warning = `跳过编码错误的 Markdown 文件: ${filePath}`;
      this.pendingWarnings.push(warning);
      logger.warn(warning);
      return null;
    }
  }
}
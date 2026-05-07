import type { RelationSource, RelationType } from '../types/index.js';

/**
 * ParsedDocument 表示单个 Markdown 文档经扫描管道提取后的文档级结果。
 */
export interface ParsedDocument {
  /** 被扫描文档的绝对路径。 */
  path: string;

  /** YAML frontmatter 解析后的键值对。 */
  frontmatter: Record<string, unknown>;

  /** 文档内提取到的 Markdown 链接目标。 */
  links: string[];

  /** 文档标题结构。 */
  headings: Array<{ depth: number; text: string }>;

  /** 文档内容哈希。 */
  contentHash: string;
}

/**
 * DiscoveredRelation 表示扫描规则在文档级粒度上发现的关系。
 */
export interface DiscoveredRelation {
  /** 源文档绝对路径。 */
  sourceDoc: string;

  /** 目标文档绝对路径。 */
  targetDoc: string;

  /** 关系类型。 */
  relationType: RelationType;

  /** 关系置信度，范围 0.0 ~ 1.0。 */
  confidence: number;

  /** 关系来源，扫描管道默认为 auto_scan。 */
  source: RelationSource;

  /** 发现该关系的规则名。 */
  ruleName: string;

  /** 可选规则元数据。 */
  metadata?: Record<string, unknown>;
}

/**
 * ScanPipelineResult 表示单文档扫描结果。
 */
export interface ScanPipelineResult {
  /** 解析后的文档。 */
  document: ParsedDocument;

  /** 从该文档中发现的关系。 */
  relations: DiscoveredRelation[];

  /** 扫描期间产生的警告。 */
  warnings: string[];
}
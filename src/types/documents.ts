/**
 * CORD 文档节点类型定义。
 */

/**
 * DocumentNode 表示被 CORD 扫描和追踪的单个文档。
 *
 * `path` 为相对于项目根目录的路径。
 * 时间字段使用 ISO 8601 格式字符串。
 */
export interface DocumentNode {
  /** 唯一标识符（通常为文件路径的哈希或 UUID）。 */
  id: string;

  /** 相对于项目根目录的文件路径。 */
  path: string;

  /** 文档标题（从 frontmatter 或第一个标题提取）。 */
  title?: string;

  /** 框架定义的文档类型，例如 `'prd'`、`'architecture'`。 */
  docType?: string;

  /** 所属框架名称，例如 `'bmad'`、`'generic'`。 */
  framework?: string;

  /** 内容哈希，用于增量扫描时检测变更。 */
  contentHash?: string;

  /** 扩展元数据，存储框架相关的附加信息。 */
  metadata?: Record<string, unknown>;

  /** 记录创建时间（ISO 8601）。 */
  createdAt: string;

  /** 最后更新时间（ISO 8601）。 */
  updatedAt: string;
}

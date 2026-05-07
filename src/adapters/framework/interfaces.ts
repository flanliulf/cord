import type { CordConfig, RelationType } from '../../types/index.js';

/** 文档类型声明，用于框架适配器以声明式方式注册分类规则。 */
export interface DocTypeDefinition {
  /** 文档类型名称，例如 `prd`。 */
  name: string;

  /** 仅对候选文件列表匹配的 glob 模式。 */
  patterns: string[];

  /** 文档类型的业务含义描述。 */
  description: string;
}

/** 框架预设关系规则定义。 */
export interface PresetRule {
  /** 源文档类型。 */
  sourceDocType: string;

  /** 目标文档类型。 */
  targetDocType: string;

  /** 关系类型。 */
  relationType: RelationType;

  /** 预设关系置信度。 */
  confidence: number;
}

/**
 * 框架适配器统一接口。
 *
 * 适配器负责声明文档类型、预设关系和文档发现规则，供 ScanService 统一编排。
 */
export interface IFrameworkAdapter {
  /** 适配器唯一名称。 */
  readonly name: string;

  /** 判断给定项目根目录是否命中当前框架。 */
  detectFramework(projectRoot: string): boolean;

  /** 返回适配器声明的文档类型定义列表。 */
  getDocumentTypes(): DocTypeDefinition[];

  /** 返回适配器声明的预设关系规则列表。 */
  getPresetRules(): PresetRule[];

  /** 根据配置给出扫描路径列表。 */
  getScanPaths(config: CordConfig): string[];

  /** 根据配置给出排除路径列表。 */
  getExcludePaths(config: CordConfig): string[];

  /**
   * 发现最终参与扫描的 Markdown 文件。
   *
   * `scanPaths` / `excludePaths` 由 ScanService 的 effectiveScanPaths 计算结果提供。
   */
  discoverDocuments(projectRoot: string, scanPaths: string[], excludePaths: string[]): string[];
}
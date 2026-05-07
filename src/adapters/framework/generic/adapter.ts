import type { DocTypeDefinition, PresetRule } from '../interfaces.js';
import { AbstractFrameworkAdapter } from '../abstract-base.js';

const GENERIC_EXCLUDE_PATHS = ['src/', 'node_modules/', '.git/', 'dist/'];

/**
 * 通用框架适配器。
 *
 * 当没有任何特定框架命中时，它作为兜底适配器参与扫描。
 */
export class GenericFrameworkAdapter extends AbstractFrameworkAdapter {
  /** 适配器名称。 */
  readonly name = 'generic';

  /** Generic 适配器恒定命中，用作最后兜底。 */
  detectFramework(): boolean {
    return true;
  }

  /** Generic 不声明框架专属文档类型。 */
  getDocumentTypes(): DocTypeDefinition[] {
    return [];
  }

  /** Generic 不声明框架专属预设关系。 */
  getPresetRules(): PresetRule[] {
    return [];
  }

  /** 返回 Generic 适配器的默认排除路径。 */
  protected override getDefaultExcludePaths(): string[] {
    return GENERIC_EXCLUDE_PATHS;
  }
}
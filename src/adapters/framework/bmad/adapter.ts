import { AbstractFrameworkAdapter } from '../abstract-base.js';
import type { DocTypeDefinition, PresetRule } from '../interfaces.js';
import { detectBmadFramework } from './detector.js';
import { BMAD_DOCUMENT_TYPES } from './doc-types.js';
import { BMAD_PRESET_RULES } from './preset-rules.js';

const BMAD_DEFAULT_SCAN_PATHS = ['_bmad-output', 'docs'];
const BMAD_DEFAULT_EXCLUDE_PATHS = ['src/', 'node_modules/', '.git/', 'dist/', '_bmad/'];

/**
 * BMAD 框架适配器参考实现。
 *
 * 贡献者实现新框架时可复制此结构：适配器只编排检测、文档类型、预设规则和默认扫描边界，
 * 不把框架专属逻辑写入 scanner / service 核心模块。
 */
export class BmadFrameworkAdapter extends AbstractFrameworkAdapter {
  /** `config.framework` 显式选择和自动检测结果都会使用此名称。 */
  readonly name = 'bmad';

  /** 通过多层 BMAD 信号检测项目，避免单一目录名导致误判。 */
  detectFramework(projectRoot: string): boolean {
    return detectBmadFramework(projectRoot);
  }

  /** 返回 BMAD 的声明式文档类型表，供扫描阶段分类 Markdown 文档。 */
  getDocumentTypes(): DocTypeDefinition[] {
    return BMAD_DOCUMENT_TYPES;
  }

  /** 返回 BMAD 的稳定预设关系，供扫描阶段生成 framework_preset 关系。 */
  getPresetRules(): PresetRule[] {
    return BMAD_PRESET_RULES;
  }

  /** 默认只扫描 BMAD 输出文档和用户文档目录，降低误扫源码的概率。 */
  protected override getDefaultScanPaths(): string[] {
    return BMAD_DEFAULT_SCAN_PATHS;
  }

  /** 默认排除源码、依赖、构建产物和 BMAD 模板目录。 */
  protected override getDefaultExcludePaths(): string[] {
    return BMAD_DEFAULT_EXCLUDE_PATHS;
  }
}
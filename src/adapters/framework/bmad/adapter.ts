import { AbstractFrameworkAdapter } from '../abstract-base.js';
import type { DocTypeDefinition, PresetRule } from '../interfaces.js';
import { detectBmadFramework } from './detector.js';
import { BMAD_DOCUMENT_TYPES } from './doc-types.js';
import { BMAD_PRESET_RULES } from './preset-rules.js';

const BMAD_DEFAULT_EXCLUDE_PATHS = ['src/', 'node_modules/', '.git/', 'dist/', '_bmad/'];

/** BMAD 框架适配器。 */
export class BmadFrameworkAdapter extends AbstractFrameworkAdapter {
  readonly name = 'bmad';

  detectFramework(projectRoot: string): boolean {
    return detectBmadFramework(projectRoot);
  }

  getDocumentTypes(): DocTypeDefinition[] {
    return BMAD_DOCUMENT_TYPES;
  }

  getPresetRules(): PresetRule[] {
    return BMAD_PRESET_RULES;
  }

  protected override getDefaultExcludePaths(): string[] {
    return BMAD_DEFAULT_EXCLUDE_PATHS;
  }
}
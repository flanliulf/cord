import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const BMAD_FRONTMATTER_KEYS = ['project_name', 'user_name', 'sections_completed', 'source'];
const MARKDOWN_EXTENSIONS = new Set(['.md']);
const PACKAGE_JSON_DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const;
const SKIPPED_DIRECTORIES = new Set(['.git', 'coverage', 'dist', 'node_modules']);
const MAX_FRONTMATTER_FILES = 64;

export const BMAD_DETECTION_THRESHOLD = 2;

export type BmadDetectionSignal =
  | 'bmad-directory'
  | 'bmad-output-directory'
  | 'bmad-skills-directory'
  | 'bmad-package-json'
  | 'bmad-frontmatter';

/** 收集 BMAD 框架检测命中的声明式信号。 */
export function collectBmadDetectionSignals(projectRoot: string): BmadDetectionSignal[] {
  const resolvedRoot = resolve(projectRoot);
  const signals: BmadDetectionSignal[] = [];

  if (existsSync(join(resolvedRoot, '_bmad'))) {
    signals.push('bmad-directory');
  }

  if (existsSync(join(resolvedRoot, '_bmad-output'))) {
    signals.push('bmad-output-directory');
  }

  if (hasBmadSkillsDirectory(resolvedRoot)) {
    signals.push('bmad-skills-directory');
  }

  if (hasBmadPackageDependency(resolvedRoot)) {
    signals.push('bmad-package-json');
  }

  if (hasBmadFrontmatter(resolvedRoot)) {
    signals.push('bmad-frontmatter');
  }

  return signals;
}

/** BMAD 框架命中规则：至少 2 个检测层信号。 */
export function detectBmadFramework(projectRoot: string): boolean {
  return collectBmadDetectionSignals(projectRoot).length >= BMAD_DETECTION_THRESHOLD;
}

function hasBmadSkillsDirectory(projectRoot: string): boolean {
  return [join(projectRoot, '.claude', 'skills'), join(projectRoot, '.agents', 'skills')].some(
    (skillsPath) => {
      if (!existsSync(skillsPath)) {
        return false;
      }

      return readdirSync(skillsPath).some((entryName) => entryName.startsWith('bmad-'));
    },
  );
}

function hasBmadPackageDependency(projectRoot: string): boolean {
  const packageJsonPath = join(projectRoot, 'package.json');

  if (!existsSync(packageJsonPath)) {
    return false;
  }

  try {
    const raw = readFileSync(packageJsonPath, 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    return PACKAGE_JSON_DEPENDENCY_FIELDS.some((fieldName) => {
      const deps = parsed[fieldName];

      if (!isStringRecord(deps)) {
        return false;
      }

      return Object.keys(deps).some((dependencyName) => dependencyName.includes('bmad'));
    });
  } catch {
    return false;
  }
}

function hasBmadFrontmatter(projectRoot: string): boolean {
  const filesToCheck = collectMarkdownCandidates(projectRoot, MAX_FRONTMATTER_FILES);

  return filesToCheck.some((filePath) => {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const frontmatter = extractYamlFrontmatter(content);

      if (frontmatter === null) {
        return false;
      }

      return BMAD_FRONTMATTER_KEYS.some((key) => frontmatter.includes(`${key}:`));
    } catch {
      return false;
    }
  });
}

function collectMarkdownCandidates(projectRoot: string, maxFiles: number): string[] {
  const results: string[] = [];
  const pending = [projectRoot];

  while (pending.length > 0 && results.length < maxFiles) {
    const currentPath = pending.pop();

    if (!currentPath) {
      continue;
    }

    const stats = lstatSync(currentPath);

    if (stats.isSymbolicLink()) {
      continue;
    }

    if (stats.isDirectory()) {
      const entryNames = readdirSync(currentPath).sort().reverse();

      for (const entryName of entryNames) {
        if (SKIPPED_DIRECTORIES.has(entryName)) {
          continue;
        }

        pending.push(join(currentPath, entryName));
      }

      continue;
    }

    if (MARKDOWN_EXTENSIONS.has(currentPath.slice(currentPath.lastIndexOf('.')).toLowerCase())) {
      results.push(currentPath);
    }
  }

  return results;
}

function extractYamlFrontmatter(content: string): string | null {
  if (!content.startsWith('---\n')) {
    return null;
  }

  const closingIndex = content.indexOf('\n---', 4);

  if (closingIndex === -1) {
    return null;
  }

  return content.slice(4, closingIndex);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every((entry) => typeof entry === 'string');
}
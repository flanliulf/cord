import { existsSync, lstatSync, readdirSync, type Stats } from 'node:fs';
import { extname, relative, resolve } from 'node:path';
import type { CordConfig } from '../../types/index.js';
import type { DocTypeDefinition, IFrameworkAdapter, PresetRule } from './interfaces.js';

const DEFAULT_SCAN_PATHS = ['.'];

/**
 * 框架适配器抽象基类。
 *
 * 统一提供扫描路径默认值、排除路径合并和 Markdown 文件发现逻辑。
 */
export abstract class AbstractFrameworkAdapter implements IFrameworkAdapter {
  /** 适配器名称。 */
  abstract readonly name: string;

  /** 判断是否命中当前框架。 */
  abstract detectFramework(projectRoot: string): boolean;

  /** 返回文档类型声明。 */
  abstract getDocumentTypes(): DocTypeDefinition[];

  /** 返回预设关系声明。 */
  abstract getPresetRules(): PresetRule[];

  /**
   * 返回扫描路径。
   *
   * 默认回退到项目根目录，由具体适配器或用户配置进一步收窄。
   */
  getScanPaths(config: CordConfig): string[] {
    return dedupePaths(config.scanPaths ?? this.getDefaultScanPaths());
  }

  /** 返回排除路径，合并适配器默认值和用户扩展值。 */
  getExcludePaths(config: CordConfig): string[] {
    return dedupePaths([...this.getDefaultExcludePaths(), ...(config.excludePaths ?? [])]);
  }

  /** 递归发现 scanPaths 下未被排除的 Markdown 文件。 */
  discoverDocuments(projectRoot: string, scanPaths: string[], excludePaths: string[]): string[] {
    const discoveredFiles = new Set<string>();
    const normalizedExcludePaths = excludePaths.map(normalizeForMatch);

    for (const scanPath of dedupePaths(scanPaths)) {
      const absoluteScanPath = resolve(projectRoot, scanPath);

      if (!existsSync(absoluteScanPath)) {
        continue;
      }

      this.collectMarkdownFiles(projectRoot, absoluteScanPath, normalizedExcludePaths, discoveredFiles);
    }

    return [...discoveredFiles].sort();
  }

  /** 返回适配器默认扫描路径。 */
  protected getDefaultScanPaths(): string[] {
    return DEFAULT_SCAN_PATHS;
  }

  /** 返回适配器默认排除路径。 */
  protected getDefaultExcludePaths(): string[] {
    return [];
  }

  private collectMarkdownFiles(
    projectRoot: string,
    currentPath: string,
    excludePaths: string[],
    discoveredFiles: Set<string>,
  ): void {
    const relativePath = toProjectRelativePath(projectRoot, currentPath);

    if (relativePath === null) {
      return;
    }

    if (relativePath !== '' && isExcludedPath(relativePath, excludePaths)) {
      return;
    }

    const entryStats = safeLstatSync(currentPath);

    if (entryStats === null) {
      return;
    }

    if (entryStats.isSymbolicLink()) {
      return;
    }

    if (entryStats.isDirectory()) {
      for (const entryName of safeReadDirectory(currentPath)) {
        this.collectMarkdownFiles(
          projectRoot,
          resolve(currentPath, entryName),
          excludePaths,
          discoveredFiles,
        );
      }

      return;
    }

    if (entryStats.isFile() && extname(currentPath).toLowerCase() === '.md') {
      discoveredFiles.add(resolve(currentPath));
    }
  }
}

function safeLstatSync(pathValue: string): Stats | null {
  try {
    return lstatSync(pathValue);
  } catch {
    return null;
  }
}

function safeReadDirectory(pathValue: string): string[] {
  try {
    return readdirSync(pathValue).sort();
  } catch {
    return [];
  }
}

function dedupePaths(paths: string[]): string[] {
  const normalizedToOriginal = new Map<string, string>();

  for (const pathValue of paths) {
    const trimmed = pathValue.trim();

    if (trimmed === '') {
      continue;
    }

    const normalized = normalizeForIdentity(trimmed);

    if (!normalizedToOriginal.has(normalized)) {
      normalizedToOriginal.set(normalized, trimmed);
    }
  }

  return [...normalizedToOriginal.values()];
}

function toProjectRelativePath(projectRoot: string, targetPath: string): string | null {
  const relativePath = relative(projectRoot, targetPath).replaceAll('\\', '/');

  if (relativePath === '') {
    return '';
  }

  if (relativePath === '..' || relativePath.startsWith('../')) {
    return null;
  }

  return relativePath;
}

function isExcludedPath(relativePath: string, excludePaths: string[]): boolean {
  const normalizedRelativePath = normalizeForMatch(relativePath);

  return excludePaths.some((excludePath) => {
    if (excludePath === '') {
      return false;
    }

    return (
      normalizedRelativePath === excludePath ||
      normalizedRelativePath.startsWith(`${excludePath}/`)
    );
  });
}

function normalizeForIdentity(pathValue: string): string {
  const normalizedPath = pathValue.replaceAll('\\', '/').replace(/^\.\//, '');

  if (normalizedPath === '.') {
    return '.';
  }

  return normalizedPath.replace(/\/+$/, '');
}

function normalizeForMatch(pathValue: string): string {
  const normalizedPath = normalizeForIdentity(pathValue);

  if (normalizedPath === '.') {
    return '';
  }

  return normalizedPath.replace(/^\//, '');
}
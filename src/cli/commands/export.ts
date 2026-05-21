import { existsSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { Command } from 'commander';
import { SqliteGraphRepository } from '../../repositories/index.js';
import { type ExportInput, validateExportInput } from '../../schemas/index.js';
import { DEFAULT_EXPORT_FILENAME, ExportService, type ExportResult } from '../../services/index.js';
import { ConfigError, loadConfig, type CordError } from '../../utils/index.js';

interface ExportServiceLike {
  exportSnapshot(input: ExportInput): Promise<ExportResult>;
  close?(): void;
}

interface WriterLike {
  write(chunk: string): boolean;
}

interface CreateExportCommandDependencies {
  cwd?: () => string;
  serviceFactory?: (projectRoot: string) => ExportServiceLike;
  stdout?: WriterLike;
  stderr?: WriterLike;
  pathApi?: PathApi;
}

interface PathApi {
  resolve(from: string, to: string): string;
  relative(from: string, to: string): string;
  isAbsolute(path: string): boolean;
}

interface NormalizeOutputPathOptions {
  enforcePhysicalBoundary: boolean;
}

const SUCCESS_EXIT_CODE = 0;
const RUNTIME_ERROR_EXIT_CODE = 1;
const CONFIG_ERROR_EXIT_CODE = 2;
const CORD_DATA_DIR = '.cord';
const CORD_DB_FILE = 'cord.db';
const DEFAULT_PATH_API: PathApi = { resolve, relative, isAbsolute };

export function createExportCommand(
  dependencies: CreateExportCommandDependencies = {},
): Command {
  const cwd = dependencies.cwd ?? (() => process.cwd());
  const serviceFactory = dependencies.serviceFactory ?? createDefaultExportService;
  const stdout = dependencies.stdout ?? process.stdout;
  const stderr = dependencies.stderr ?? process.stderr;
  const pathApi = dependencies.pathApi ?? DEFAULT_PATH_API;

  return new Command('export')
    .description('导出完整关系图谱为 JSON 快照文件')
    .option('--output <path>', '导出文件路径，默认为项目根目录下的 cord-snapshot.json')
    .option('--json', 'JSON 格式输出')
    .action(async (options: { output?: string; json?: boolean }) => {
      let service: ExportServiceLike | undefined;

      try {
        const projectRoot = cwd();
        const validatedInput = validateExportInput({
          projectRoot,
          outputPath: normalizeOutputPath(projectRoot, options.output, pathApi, {
            enforcePhysicalBoundary: dependencies.pathApi === undefined,
          }),
        });
        void loadConfig(projectRoot);
        service = serviceFactory(projectRoot);
        const result = await service.exportSnapshot(validatedInput);

        writeSuccess(stdout, result, options.json ?? false);
        process.exitCode = SUCCESS_EXIT_CODE;
      } catch (error) {
        const exitCode = error instanceof ConfigError ? CONFIG_ERROR_EXIT_CODE : RUNTIME_ERROR_EXIT_CODE;
        writeFailure(stderr, error, options.json ?? false);
        process.exitCode = exitCode;
      } finally {
        service?.close?.();
      }
    });
}

function createDefaultExportService(projectRoot: string): ExportService {
  const dbPath = resolveGraphDatabasePath(projectRoot);
  assertGraphDatabaseInitialized(dbPath);
  return new ExportService(new SqliteGraphRepository(dbPath));
}

function resolveGraphDatabasePath(projectRoot: string): string {
  return join(projectRoot, CORD_DATA_DIR, CORD_DB_FILE);
}

function assertGraphDatabaseInitialized(dbPath: string): void {
  if (!existsSync(dbPath)) {
    throw new ConfigError({
      message: `[CORD_CONFIG_011] CORD 图谱尚未初始化: ${dbPath}`,
      code: 'CORD_CONFIG_011',
      suggestion: '请先运行 cord scan 建立本地图谱后再执行导出命令',
      context: { dbPath },
    });
  }
}

function normalizeOutputPath(
  projectRoot: string,
  outputPath: string | undefined,
  pathApi: PathApi,
  options: NormalizeOutputPathOptions,
): string | undefined {
  if (outputPath === undefined) {
    return undefined;
  }

  const trimmedOutputPath = outputPath.trim();

  if (trimmedOutputPath.length === 0) {
    return trimmedOutputPath;
  }

  const effectiveOutputPath = isDirectoryLikeOutputPath(trimmedOutputPath)
    ? `${trimmedOutputPath}${DEFAULT_EXPORT_FILENAME}`
    : trimmedOutputPath;
  const absoluteOutputPath = pathApi.resolve(projectRoot, effectiveOutputPath);
  const relativeOutputPath = pathApi.relative(projectRoot, absoluteOutputPath);
  const normalizedRelativePath = relativeOutputPath.replaceAll('\\', '/');

  if (
    relativeOutputPath === ''
    || pathApi.isAbsolute(relativeOutputPath)
    || normalizedRelativePath === '..'
    || normalizedRelativePath.startsWith('../')
  ) {
    throw new ConfigError({
      message: `导出路径位于项目根目录外: ${trimmedOutputPath}`,
      suggestion: '请传入项目根目录内的输出路径，例如 snapshots/graph.json',
    });
  }

  if (options.enforcePhysicalBoundary) {
    assertOutputPathPhysicallyInsideProject(projectRoot, absoluteOutputPath);
  }

  return normalizedRelativePath;
}

function isDirectoryLikeOutputPath(outputPath: string): boolean {
  return outputPath.endsWith('/') || outputPath.endsWith('\\');
}

function assertOutputPathPhysicallyInsideProject(projectRoot: string, absoluteOutputPath: string): void {
  if (!existsSync(projectRoot)) {
    return;
  }

  const projectRealPath = realpathSync(projectRoot);
  const existingAncestor = findExistingAncestor(dirname(absoluteOutputPath));

  if (existingAncestor === null) {
    return;
  }

  const ancestorRealPath = realpathSync(existingAncestor);

  if (!isPathInside(projectRealPath, ancestorRealPath)) {
    throw new ConfigError({
      message: `导出路径物理位置位于项目根目录外: ${absoluteOutputPath}`,
      code: 'CORD_CONFIG_010',
      suggestion: '请避免将导出路径指向项目外的符号链接目录',
      context: {
        projectRoot,
        outputPath: absoluteOutputPath,
        projectRealPath,
        outputAncestorRealPath: ancestorRealPath,
      },
    });
  }
}

function findExistingAncestor(startPath: string): string | null {
  let currentPath = startPath;

  while (!existsSync(currentPath)) {
    const parentPath = dirname(currentPath);

    if (parentPath === currentPath) {
      return null;
    }

    currentPath = parentPath;
  }

  return currentPath;
}

function isPathInside(parentPath: string, childPath: string): boolean {
  const relativePath = relative(parentPath, childPath);

  return relativePath === '' || (!relativePath.startsWith('..') && !isAbsolute(relativePath));
}

function writeSuccess(stdout: WriterLike, result: ExportResult, asJson: boolean): void {
  if (asJson) {
    stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }

  stdout.write(
    [
      '导出成功',
      `文件: ${result.outputPath}`,
      `schemaVersion: ${result.snapshot.schemaVersion}`,
      `文档: ${result.snapshot.documents.length}`,
      `关系: ${result.snapshot.relations.length}`,
    ].join('\n') + '\n',
  );
}

function writeFailure(stderr: WriterLike, error: unknown, asJson: boolean): void {
  if (asJson) {
    stderr.write(`${JSON.stringify(toErrorPayload(error))}\n`);
    return;
  }

  const payload = toErrorPayload(error);
  const lines = [payload.message];

  if (payload.suggestion) {
    lines.push(`建议: ${payload.suggestion}`);
  }

  stderr.write(`${lines.join('\n')}\n`);
}

function toErrorPayload(error: unknown): {
  message: string;
  code?: string;
  suggestion?: string;
} {
  if (error instanceof ConfigError) {
    return {
      message: error.message,
      code: error.code,
      suggestion: error.suggestion,
    };
  }

  if (isCordError(error)) {
    return {
      message: error.message,
      code: error.code,
      suggestion: error.suggestion,
    };
  }

  if (error instanceof Error) {
    return { message: error.message };
  }

  return { message: '未知错误' };
}

function isCordError(error: unknown): error is CordError {
  return error instanceof Error && 'code' in error && 'suggestion' in error;
}
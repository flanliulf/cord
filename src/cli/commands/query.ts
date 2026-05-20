import { existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import chalk from 'chalk';
import { Command } from 'commander';
import { SqliteGraphRepository } from '../../repositories/index.js';
import { QueryService, type QueryRelationsOutput } from '../../services/index.js';
import { validateQueryInput, type QueryInput } from '../../schemas/index.js';
import { ConfigError, type CordError } from '../../utils/index.js';

interface QueryServiceLike {
  query(input: QueryInput): QueryRelationsOutput;
  close?(): void;
}

interface WriterLike {
  write(chunk: string): boolean;
}

interface CreateQueryCommandDependencies {
  cwd?: () => string;
  serviceFactory?: (projectRoot: string) => QueryServiceLike;
  stdout?: WriterLike;
  stderr?: WriterLike;
}

const SUCCESS_EXIT_CODE = 0;
const RUNTIME_ERROR_EXIT_CODE = 1;
const CONFIG_ERROR_EXIT_CODE = 2;
const CORD_DATA_DIR = '.cord';
const CORD_DB_FILE = 'cord.db';

export function createQueryCommand(
  dependencies: CreateQueryCommandDependencies = {},
): Command {
  const cwd = dependencies.cwd ?? (() => process.cwd());
  const serviceFactory = dependencies.serviceFactory ?? createDefaultQueryService;
  const stdout = dependencies.stdout ?? process.stdout;
  const stderr = dependencies.stderr ?? process.stderr;

  return new Command('query')
    .description('查询指定文档的关联关系（支持 1~3 跳）')
    .argument('<doc>', '待查询的文档路径')
    .option('--type <relationType>', '按关系类型过滤')
    .option('--depth <depth>', '遍历深度（1-3，默认 1）', parseDepthOption)
    .option('--include-deprecated', '包含 status=deprecated 的关系')
    .option('--json', 'JSON 格式输出')
    .action((docPath: string, options: { type?: string; depth?: number; includeDeprecated?: boolean; json?: boolean }) => {
      let service: QueryServiceLike | undefined;

      try {
        const projectRoot = cwd();
        const validatedInput = validateQueryInput({
          docPath: normalizeQueryDocPath(projectRoot, docPath),
          type: options.type,
          depth: options.depth,
          includeDeprecated: options.includeDeprecated ?? false,
        });
        service = serviceFactory(projectRoot);
        const result = service.query(validatedInput);

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

function parseDepthOption(rawValue: string): number {
  return Number(rawValue);
}

function createDefaultQueryService(projectRoot: string): QueryService {
  const dbPath = resolveGraphDatabasePath(projectRoot);
  assertGraphDatabaseInitialized(dbPath);
  return new QueryService(new SqliteGraphRepository(dbPath));
}

function resolveGraphDatabasePath(projectRoot: string): string {
  return join(projectRoot, CORD_DATA_DIR, CORD_DB_FILE);
}

function assertGraphDatabaseInitialized(dbPath: string): void {
  if (!existsSync(dbPath)) {
    throw new ConfigError({
      message: `[CORD_CONFIG_011] CORD 图谱尚未初始化: ${dbPath}`,
      code: 'CORD_CONFIG_011',
      suggestion: '请先运行 cord scan 建立本地图谱后再执行只读查询命令',
      context: { dbPath },
    });
  }
}

function normalizeQueryDocPath(projectRoot: string, docPath: string): string {
  const trimmedDocPath = docPath.trim();

  if (trimmedDocPath.length === 0) {
    return trimmedDocPath;
  }

  const absoluteDocPath = resolve(projectRoot, trimmedDocPath);
  const normalizedRelativePath = relative(projectRoot, absoluteDocPath).replaceAll('\\', '/');

  if (
    normalizedRelativePath === '' ||
    normalizedRelativePath === '..' ||
    normalizedRelativePath.startsWith('../')
  ) {
    throw new ConfigError({
      message: `查询路径位于项目根目录外: ${trimmedDocPath}`,
      suggestion: '请传入项目根目录内的文档路径，例如 docs/a.md',
    });
  }

  return normalizedRelativePath;
}

function writeSuccess(stdout: WriterLike, result: QueryRelationsOutput, asJson: boolean): void {
  if (asJson) {
    stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }

  const lines = formatRelationTable(result);
  stdout.write(`${lines.join('\n')}\n`);
}

function formatRelationTable(result: QueryRelationsOutput): string[] {
  const headers = ['relationId', 'targetPath', 'relationType', 'confidence', 'source', 'status', 'hopDistance'];
  const rows = result.relations.map((relation) => [
    relation.relationId,
    relation.targetPath,
    relation.relationType,
    relation.confidence.toFixed(2),
    relation.source,
    relation.status,
    relation.hopDistance.toString(),
  ]);
  const widths = headers.map((header, index) => {
    const values = rows.map((row) => row[index] ?? '');
    return Math.max(header.length, ...values.map((value) => value.length));
  });
  const headerLine = chalk.bold(formatRow(headers, widths));
  const dividerLine = widths.map((width) => '-'.repeat(width)).join('-+-');

  if (rows.length === 0) {
    return [headerLine, dividerLine, '(no relations)', `总数: ${result.totalCount}`];
  }

  return [
    headerLine,
    dividerLine,
    ...rows.map((row) => formatRow(row, widths)),
    `总数: ${result.totalCount}`,
  ];
}

function formatRow(columns: string[], widths: number[]): string {
  return columns
    .map((column, index) => column.padEnd(widths[index] ?? column.length))
    .join(' | ');
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
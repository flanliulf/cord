import { mkdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import chalk from 'chalk';
import { Command } from 'commander';
import { SqliteGraphRepository } from '../../repositories/index.js';
import { type ImpactInput, validateImpactInput } from '../../schemas/index.js';
import { ImpactService, type ImpactResult } from '../../services/index.js';
import { ConfigError, loadConfig, type CordError } from '../../utils/index.js';

interface ImpactServiceLike {
  analyzeImpact(input: ImpactInput): ImpactResult;
  close?(): void;
}

interface WriterLike {
  write(chunk: string): boolean;
}

interface CreateImpactCommandDependencies {
  cwd?: () => string;
  serviceFactory?: (projectRoot: string) => ImpactServiceLike;
  stdout?: WriterLike;
  stderr?: WriterLike;
}

const SUCCESS_EXIT_CODE = 0;
const RUNTIME_ERROR_EXIT_CODE = 1;
const CONFIG_ERROR_EXIT_CODE = 2;
const CORD_DATA_DIR = '.cord';
const CORD_DB_FILE = 'cord.db';

export function createImpactCommand(
  dependencies: CreateImpactCommandDependencies = {},
): Command {
  const cwd = dependencies.cwd ?? (() => process.cwd());
  const serviceFactory = dependencies.serviceFactory ?? createDefaultImpactService;
  const stdout = dependencies.stdout ?? process.stdout;
  const stderr = dependencies.stderr ?? process.stderr;

  return new Command('impact')
    .description('分析指定文档变更的影响范围')
    .argument('<doc>', '发生变更的文档路径')
    .option('--confidence-threshold <value>', '最低置信度阈值（0.0 ~ 1.0）', parseConfidenceThresholdOption)
    .option('--json', 'JSON 格式输出')
    .action((docPath: string, options: { confidenceThreshold?: number; json?: boolean }) => {
      let service: ImpactServiceLike | undefined;

      try {
        const projectRoot = cwd();
        const validatedInput = validateImpactInput({
          docPath: normalizeImpactDocPath(projectRoot, docPath),
          confidenceThreshold: options.confidenceThreshold,
        });
        service = serviceFactory(projectRoot);
        const result = service.analyzeImpact(validatedInput);

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

function parseConfidenceThresholdOption(rawValue: string): number {
  return Number(rawValue);
}

function createDefaultImpactService(projectRoot: string): ImpactService {
  const config = loadConfig(projectRoot);
  const dataDirectory = join(projectRoot, CORD_DATA_DIR);
  mkdirSync(dataDirectory, { recursive: true });
  const dbPath = join(dataDirectory, CORD_DB_FILE);
  return new ImpactService(new SqliteGraphRepository(dbPath), {
    defaultConfidenceThreshold: config.confidenceThreshold,
    updateStrategies: config.updateStrategies,
  });
}

function normalizeImpactDocPath(projectRoot: string, docPath: string): string {
  const trimmedDocPath = docPath.trim();

  if (trimmedDocPath.length === 0) {
    return trimmedDocPath;
  }

  const absoluteDocPath = resolve(projectRoot, trimmedDocPath);
  const normalizedRelativePath = relative(projectRoot, absoluteDocPath).replaceAll('\\', '/');

  if (
    normalizedRelativePath === ''
    || normalizedRelativePath === '..'
    || normalizedRelativePath.startsWith('../')
  ) {
    throw new ConfigError({
      message: `影响分析路径位于项目根目录外: ${trimmedDocPath}`,
      suggestion: '请传入项目根目录内的文档路径，例如 docs/a.md',
    });
  }

  return normalizedRelativePath;
}

function writeSuccess(stdout: WriterLike, result: ImpactResult, asJson: boolean): void {
  if (asJson) {
    stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }

  const lines = formatImpactTable(result);
  stdout.write(`${lines.join('\n')}\n`);
}

function formatImpactTable(result: ImpactResult): string[] {
  const headers = ['docPath', 'relationType', 'propagationType', 'suggestedAction', 'updateStrategy', 'severity', 'confidence', 'hopDistance'];
  const rows = result.impactedDocs.map((doc) => [
    doc.docPath,
    doc.relationType,
    doc.propagationType,
    doc.suggestedAction,
    doc.updateStrategy,
    doc.severity,
    doc.confidence.toFixed(2),
    doc.hopDistance.toString(),
  ]);
  const widths = headers.map((header, index) => {
    const values = rows.map((row) => row[index] ?? '');
    return Math.max(header.length, ...values.map((value) => value.length));
  });
  const headerLine = chalk.bold(formatRow(headers, widths));
  const dividerLine = widths.map((width) => '-'.repeat(width)).join('-+-');

  if (rows.length === 0) {
    return [headerLine, dividerLine, '(no impacted docs)', `总数: ${result.totalCount}`];
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

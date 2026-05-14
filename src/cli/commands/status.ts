import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Command } from 'commander';
import { SqliteGraphRepository } from '../../repositories/index.js';
import { StatusService, createEmptyStatusResult, type StatusResult } from '../../services/index.js';
import { ConfigError, type CordError } from '../../utils/index.js';

interface StatusServiceLike {
  getStatus(input: { projectRoot: string }): StatusResult;
  close?(): void;
}

interface WriterLike {
  write(chunk: string): boolean;
}

interface CreateStatusCommandDependencies {
  cwd?: () => string;
  serviceFactory?: (projectRoot: string) => StatusServiceLike;
  stdout?: WriterLike;
  stderr?: WriterLike;
}

const SUCCESS_EXIT_CODE = 0;
const RUNTIME_ERROR_EXIT_CODE = 1;
const CONFIG_ERROR_EXIT_CODE = 2;
const CORD_DATA_DIR = '.cord';
const CORD_DB_FILE = 'cord.db';

export function createStatusCommand(
  dependencies: CreateStatusCommandDependencies = {},
): Command {
  const cwd = dependencies.cwd ?? (() => process.cwd());
  const serviceFactory = dependencies.serviceFactory ?? createDefaultStatusService;
  const stdout = dependencies.stdout ?? process.stdout;
  const stderr = dependencies.stderr ?? process.stderr;

  return new Command('status')
    .description('查看当前项目的 CORD 配置状态与图谱健康信息')
    .option('--json', 'JSON 格式输出')
    .action((options: { json?: boolean }) => {
      let service: StatusServiceLike | undefined;

      try {
        const projectRoot = cwd();
        service = serviceFactory(projectRoot);
        const result = service.getStatus({ projectRoot });

        writeSuccess(stdout, result, options.json ?? false);
        process.exitCode = SUCCESS_EXIT_CODE;
      } catch (error) {
        const exitCode = error instanceof ConfigError ? CONFIG_ERROR_EXIT_CODE : RUNTIME_ERROR_EXIT_CODE;
        writeFailure(stderr, error, options.json ?? false);
        process.exitCode = exitCode;
      } finally {
        closeServiceSafely(service);
      }
    });
}

function createDefaultStatusService(projectRoot: string): StatusServiceLike {
  const dbPath = join(projectRoot, CORD_DATA_DIR, CORD_DB_FILE);

  if (!existsSync(dbPath)) {
    return {
      getStatus: ({ projectRoot: currentProjectRoot }) => createEmptyStatusResult(currentProjectRoot),
    };
  }

  return new StatusService(new SqliteGraphRepository(dbPath));
}

function closeServiceSafely(service: StatusServiceLike | undefined): void {
  if (!service?.close) {
    return;
  }

  try {
    service.close();
  } catch {
    // Ignore close errors so resource cleanup does not override the command result.
  }
}

function writeSuccess(stdout: WriterLike, result: StatusResult, asJson: boolean): void {
  if (asJson) {
    stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }

  stdout.write(`${formatDashboard(result).join('\n')}\n`);
}

function formatDashboard(result: StatusResult): string[] {
  return [
    'CORD 状态概览',
    '图谱健康',
    `文档数: ${result.documentCount}`,
    `关系总数: ${result.relationCount}`,
    `按类型分布: ${formatRelationsByType(result.relationsByType)}`,
    `最后扫描: ${result.lastScanTime ?? '(never scanned)'}`,
    `迁移版本: ${result.migrationVersion}`,
    `过时关系: ${result.staleRelations}`,
    `孤立节点: ${result.orphanedNodes}`,
    `悬空关系: ${result.danglingEdges}`,
    '配置状态',
    `配置文件: ${result.configFilePath ?? '(not initialized)'}`,
    `framework: ${result.framework ?? '(unset)'}`,
    `scanPaths: ${formatPathList(result.scanPaths)}`,
    `excludePaths: ${formatPathList(result.excludePaths)}`,
    `confidenceThreshold: ${result.confidenceThreshold.toFixed(2)}`,
  ];
}

function formatRelationsByType(relationsByType: Record<string, number>): string {
  const entries = Object.entries(relationsByType).sort(([left], [right]) => left.localeCompare(right));

  if (entries.length === 0) {
    return '(none)';
  }

  return entries.map(([relationType, count]) => `${relationType}=${count}`).join(', ');
}

function formatPathList(paths: string[]): string {
  if (paths.length === 0) {
    return '(none)';
  }

  return paths.join(', ');
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
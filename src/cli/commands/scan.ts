import { confirm, isCancel } from '@clack/prompts';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Command } from 'commander';
import { SqliteGraphRepository } from '../../repositories/index.js';
import { ScanService, type ScanResult } from '../../services/index.js';
import { ConfigError, type CordError } from '../../utils/index.js';

interface ScanServiceLike {
  scan(input: { projectRoot: string; rebuild?: boolean; force?: boolean }): Promise<ScanResult>;
  getManualRelationsCount(): number;
  close?(): void;
}

interface WriterLike {
  write(chunk: string): boolean;
}

interface ConfirmPromptLike {
  (options: { message: string }): Promise<boolean | symbol>;
}

interface CreateScanCommandDependencies {
  cwd?: () => string;
  serviceFactory?: (projectRoot: string) => ScanServiceLike;
  confirmPrompt?: ConfirmPromptLike;
  stdout?: WriterLike;
  stderr?: WriterLike;
}

const SUCCESS_EXIT_CODE = 0;
const RUNTIME_ERROR_EXIT_CODE = 1;
const CONFIG_ERROR_EXIT_CODE = 2;
const CORD_DATA_DIR = '.cord';
const CORD_DB_FILE = 'cord.db';
const REBUILD_CONFIRM_MESSAGE = '是否继续执行 rebuild？';

export function createScanCommand(
  dependencies: CreateScanCommandDependencies = {},
): Command {
  const cwd = dependencies.cwd ?? (() => process.cwd());
  const serviceFactory = dependencies.serviceFactory ?? createDefaultScanService;
  const confirmPrompt = dependencies.confirmPrompt ?? confirm;
  const stdout = dependencies.stdout ?? process.stdout;
  const stderr = dependencies.stderr ?? process.stderr;

  return new Command('scan')
    .description('扫描项目文档并构建关系图谱')
    .option('--rebuild', '完全重建图谱')
    .option('--force', '跳过 manual 关系确认，直接执行 rebuild')
    .option('--json', 'JSON 格式输出')
    .action(async (options: { rebuild?: boolean; force?: boolean; json?: boolean }) => {
      let service: ScanServiceLike | undefined;

      try {
        if (options.force && !options.rebuild) {
          throw new ConfigError({
            message: '--force 只能与 --rebuild 一起使用',
            suggestion: '请改用 `cord scan --rebuild --force`，或移除 --force。',
          });
        }

        const projectRoot = cwd();
        service = serviceFactory(projectRoot);
        const deletedManualRelationsCount = await prepareRebuildGuard({
          service,
          stdout,
          stderr,
          confirmPrompt,
          rebuild: options.rebuild ?? false,
          force: options.force ?? false,
          asJson: options.json ?? false,
        });

        if (deletedManualRelationsCount === null) {
          process.exitCode = RUNTIME_ERROR_EXIT_CODE;
          return;
        }

        const result = await service.scan({
          projectRoot,
          rebuild: options.rebuild ?? false,
          force: options.force ?? false,
        });

        writeSuccess(stdout, result, options.json ?? false);
        writeManualDeletionNotice(
          options.json ?? false ? stderr : stdout,
          deletedManualRelationsCount,
        );
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

function createDefaultScanService(projectRoot: string): ScanService {
  const dataDirectory = join(projectRoot, CORD_DATA_DIR);
  mkdirSync(dataDirectory, { recursive: true });
  const dbPath = join(dataDirectory, CORD_DB_FILE);
  return new ScanService(new SqliteGraphRepository(dbPath));
}

function writeSuccess(stdout: WriterLike, result: ScanResult, asJson: boolean): void {
  if (asJson) {
    stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }

  const warningLines = result.warnings.length === 0
    ? '警告: 0'
    : ['警告:', ...result.warnings.map((warning) => `- ${warning}`)].join('\n');

  stdout.write(
    ['扫描完成', `文档数: ${result.documentsFound}`, `关系数: ${result.relationsDiscovered}`, `耗时: ${result.durationMs}ms`, warningLines].join('\n') + '\n',
  );
}

async function prepareRebuildGuard(input: {
  service: ScanServiceLike;
  stdout: WriterLike;
  stderr: WriterLike;
  confirmPrompt: ConfirmPromptLike;
  rebuild: boolean;
  force: boolean;
  asJson: boolean;
}): Promise<number | null> {
  if (!input.rebuild) {
    return 0;
  }

  const manualRelationsCount = input.service.getManualRelationsCount();

  if (manualRelationsCount === 0) {
    return 0;
  }

  const warningWriter = input.asJson ? input.stderr : input.stdout;
  warningWriter.write(
    `注意：检测到 ${manualRelationsCount} 条手动关系，--rebuild 将删除这些关系。如需保留，请先导出备份。\n`,
  );

  if (input.force) {
    return manualRelationsCount;
  }

  const confirmed = await input.confirmPrompt({ message: REBUILD_CONFIRM_MESSAGE });

  if (isCancel(confirmed) || confirmed !== true) {
    input.stderr.write('已取消 rebuild。\n');
    return null;
  }

  return manualRelationsCount;
}

function writeManualDeletionNotice(writer: WriterLike, deletedManualRelationsCount: number): void {
  if (deletedManualRelationsCount <= 0) {
    return;
  }

  writer.write(`已删除 ${deletedManualRelationsCount} 条 manual 关系。\n`);
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

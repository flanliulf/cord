import * as p from '@clack/prompts';
import { Command } from 'commander';
import { collectDetectedIdes, IDE_NAMES, type IdeName } from '../../adapters/ide/index.js';
import { InitService, type InitConfigFormat, type InitResult } from '../../services/index.js';
import { ConfigError, type CordError } from '../../utils/index.js';

interface InitServiceLike {
  init(input: { projectRoot: string; ide?: IdeName; format?: InitConfigFormat }): Promise<InitResult>;
}

interface WriterLike {
  write(chunk: string): boolean;
}

interface SpinnerLike {
  start(message: string): void;
  stop(message?: string): void;
}

interface PromptModuleLike {
  intro(message: string): void;
  outro(message: string): void;
  cancel(message: string): void;
  isCancel(value: unknown): boolean;
  select(options: {
    message: string;
    options: Array<{ value: IdeName; label: string; hint?: string }>;
  }): Promise<IdeName | symbol>;
  spinner(): SpinnerLike;
}

interface CreateInitCommandDependencies {
  cwd?: () => string;
  isInteractive?: () => boolean;
  serviceFactory?: () => InitServiceLike;
  collectDetectedIdes?: (projectRoot: string) => IdeName[];
  promptModule?: PromptModuleLike;
  stdout?: WriterLike;
  stderr?: WriterLike;
}

const SUCCESS_EXIT_CODE = 0;
const RUNTIME_ERROR_EXIT_CODE = 1;
const CONFIG_ERROR_EXIT_CODE = 2;

const defaultPromptModule: PromptModuleLike = {
  intro: (message) => {
    p.intro(message);
  },
  outro: (message) => {
    p.outro(message);
  },
  cancel: (message) => {
    p.cancel(message);
  },
  isCancel: (value) => p.isCancel(value),
  select: async (options) => {
    const result = await p.select(options);
    return result as IdeName | symbol;
  },
  spinner: () => p.spinner() as SpinnerLike,
};

export function createInitCommand(
  dependencies: CreateInitCommandDependencies = {},
): Command {
  const cwd = dependencies.cwd ?? (() => process.cwd());
  const isInteractive = dependencies.isInteractive ?? (() => Boolean(process.stdout.isTTY && process.stdin.isTTY));
  const serviceFactory = dependencies.serviceFactory ?? (() => new InitService());
  const detectIdes = dependencies.collectDetectedIdes ?? collectDetectedIdes;
  const promptModule = dependencies.promptModule ?? defaultPromptModule;
  const stdout = dependencies.stdout ?? process.stdout;
  const stderr = dependencies.stderr ?? process.stderr;

  return new Command('init')
    .description('一键初始化当前项目的 CORD 配置、IDE 集成与数据目录')
    .option('--ide <name>', '显式指定 IDE（claude-code | cursor | vscode-copilot | codex-cli）')
    .option('--format <format>', '配置文件格式（yaml | json）', 'yaml')
    .option('--json', '输出机器可读 JSON，且跳过交互向导')
    .action(async (options: { ide?: string; format?: string; json?: boolean }) => {
      try {
        const projectRoot = cwd();
        const format = normalizeFormat(options.format);
        const interactive = isInteractive();
        const jsonMode = options.json ?? false;
        let selectedIde = normalizeIde(options.ide);
        let spinner: SpinnerLike | undefined;

        if (!jsonMode && interactive) {
          promptModule.intro('🔗 CORD 初始化');
          spinner = promptModule.spinner();
          spinner.start('检测 IDE...');
        } else if (!jsonMode) {
          stdout.write('执行初始化...\n');
        }

        if (!selectedIde && interactive && !jsonMode) {
          const candidates = detectIdes(projectRoot);

          if (candidates.length > 1) {
            spinner?.stop('检测到多个 IDE');

            const selection = await promptModule.select({
              message: '检测到多个 IDE，请选择当前要初始化的目标 IDE',
              options: candidates.map((candidate) => ({
                value: candidate,
                label: candidate,
                hint: candidate === 'claude-code' ? '支持 Hooks 与后续 Skills 编排' : undefined,
              })),
            });

            if (promptModule.isCancel(selection)) {
              promptModule.cancel('已取消初始化。');
              process.exitCode = RUNTIME_ERROR_EXIT_CODE;
              return;
            }

            selectedIde = selection as IdeName;
            spinner = promptModule.spinner();
            spinner.start('执行初始化...');
          }
        }

        const service = serviceFactory();
        const result = await service.init({
          projectRoot,
          ide: selectedIde,
          format,
        });

        if (jsonMode) {
          stdout.write(`${JSON.stringify(result)}\n`);
        } else if (interactive) {
          spinner?.stop('初始化完成');
          promptModule.outro(formatResultSummary(result));
        } else {
          stdout.write(`${formatResultSummary(result)}\n`);
        }

        process.exitCode = SUCCESS_EXIT_CODE;
      } catch (error) {
        const exitCode = isConfigLikeError(error) ? CONFIG_ERROR_EXIT_CODE : RUNTIME_ERROR_EXIT_CODE;
        writeFailure(stderr, error, options.json ?? false);
        process.exitCode = exitCode;
      }
    });
}

function normalizeIde(rawIde: string | undefined): IdeName | undefined {
  if (!rawIde) {
    return undefined;
  }

  if ((IDE_NAMES as readonly string[]).includes(rawIde)) {
    return rawIde as IdeName;
  }

  throw new ConfigError({
    message: `不支持的 IDE: ${rawIde}`,
    suggestion: `请使用以下值之一：${IDE_NAMES.join(', ')}`,
  });
}

function normalizeFormat(rawFormat: string | undefined): InitConfigFormat {
  if (rawFormat === undefined || rawFormat === 'yaml' || rawFormat === 'json') {
    return rawFormat ?? 'yaml';
  }

  throw new ConfigError({
    message: `不支持的配置格式: ${rawFormat}`,
    suggestion: '请使用 --format yaml 或 --format json。',
  });
}

function formatResultSummary(result: InitResult): string {
  const lines = [
    '✅ CORD 初始化完成',
    `IDE: ${result.ide}`,
    `框架: ${result.framework}`,
    `配置文件: ${result.configPath}`,
    `数据目录: ${result.dataDirectory}`,
  ];

  if (result.generatedFiles.length > 0) {
    lines.push('生成/更新文件:');
    lines.push(...result.generatedFiles.map((filePath) => `- ${filePath}`));
  }

  if (result.generatedSkills.length > 0) {
    lines.push('Skills 文件:');
    lines.push(...result.generatedSkills.map((filePath) => `- ${filePath}`));
  }

  return lines.join('\n');
}

function writeFailure(stderr: WriterLike, error: unknown, asJson: boolean): void {
  const payload = toErrorPayload(error);

  if (asJson) {
    stderr.write(`${JSON.stringify(payload)}\n`);
    return;
  }

  const lines = [payload.message];

  if ('suggestion' in payload && typeof payload.suggestion === 'string') {
    lines.push(`建议: ${payload.suggestion}`);
  }

  stderr.write(`${lines.join('\n')}\n`);
}

function toErrorPayload(error: unknown): Record<string, unknown> {
  const cordLike = toCordLikeError(error);

  if (cordLike?.context?.error === 'AMBIGUOUS_IDE') {
    return {
      error: 'AMBIGUOUS_IDE',
      candidates: toCandidates(cordLike.context),
      suggestion: cordLike.suggestion,
    };
  }

  if (cordLike) {
    return {
      message: cordLike.message,
      code: cordLike.code,
      suggestion: cordLike.suggestion,
    };
  }

  if (error instanceof Error) {
    return { message: error.message };
  }

  return { message: '未知错误' };
}

function toCandidates(context: Record<string, unknown>): string[] {
  const candidates = context.candidates ?? context.detectedIdes;

  if (!Array.isArray(candidates)) {
    return [];
  }

  return candidates.filter((candidate): candidate is string => typeof candidate === 'string');
}

function isConfigLikeError(error: unknown): boolean {
  if (error instanceof ConfigError) {
    return true;
  }

  if (typeof error !== 'object' || error === null) {
    return false;
  }

  return typeof Reflect.get(error, 'code') === 'string' && String(Reflect.get(error, 'code')).startsWith('CORD_CONFIG_');
}

function toCordLikeError(error: unknown): { message: string; code?: string; suggestion?: string; context?: Record<string, unknown> } | null {
  if (error instanceof ConfigError) {
    return {
      message: error.message,
      code: error.code,
      suggestion: error.suggestion,
      context: error.context,
    };
  }

  if (isCordError(error)) {
    return {
      message: error.message,
      code: error.code,
      suggestion: error.suggestion,
      context: error.context,
    };
  }

  if (typeof error !== 'object' || error === null) {
    return null;
  }

  const message = Reflect.get(error, 'message');
  const code = Reflect.get(error, 'code');
  const suggestion = Reflect.get(error, 'suggestion');
  const context = Reflect.get(error, 'context');

  if (typeof message !== 'string') {
    return null;
  }

  return {
    message,
    code: typeof code === 'string' ? code : undefined,
    suggestion: typeof suggestion === 'string' ? suggestion : undefined,
    context: isRecord(context) ? context : undefined,
  };
}

function isCordError(error: unknown): error is CordError {
  return error instanceof Error && 'code' in error && 'suggestion' in error && 'context' in error;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
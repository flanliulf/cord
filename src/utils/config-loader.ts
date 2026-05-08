import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';
import { validateConfig } from '../schemas/config.js';
import type { CordConfig } from '../types/index.js';
import { ConfigError } from './errors.js';

const YAML_CONFIG_FILE = 'cord.config.yaml';
const JSON_CONFIG_FILE = 'cord.config.json';
const DEFAULT_SCAN_PATHS = ['.'];
const DEFAULT_EXCLUDE_PATHS = ['src/', 'node_modules/', '.git/', 'dist/'];
const DEFAULT_CONFIDENCE_THRESHOLD = 0.5;

export const DEFAULT_CONFIG: CordConfig = {
  scanPaths: [...DEFAULT_SCAN_PATHS],
  excludePaths: [...DEFAULT_EXCLUDE_PATHS],
  confidenceThreshold: DEFAULT_CONFIDENCE_THRESHOLD,
};

/**
 * 加载项目根目录下的 CORD 配置。
 *
 * 优先级：`cord.config.yaml` > `cord.config.json`。
 * 文件不存在时返回默认配置；文件存在但无法解析或验证失败时抛出 `ConfigError`。
 */
export function loadConfig(projectRoot: string): CordConfig {
  const configPath = resolveConfigPath(projectRoot);

  if (configPath === null) {
    return cloneDefaultConfig();
  }

  const parsedConfig = parseConfigFile(configPath);
  const validatedConfig = validateConfig(parsedConfig);

  return mergeWithDefaults(validatedConfig);
}

function resolveConfigPath(projectRoot: string): string | null {
  const yamlPath = join(projectRoot, YAML_CONFIG_FILE);

  if (existsSync(yamlPath)) {
    return yamlPath;
  }

  const jsonPath = join(projectRoot, JSON_CONFIG_FILE);

  if (existsSync(jsonPath)) {
    return jsonPath;
  }

  return null;
}

function parseConfigFile(configPath: string): unknown {
  const fileContent = readConfigFile(configPath);

  if (configPath.endsWith('.yaml')) {
    return parseYamlConfig(fileContent, configPath);
  }

  return parseJsonConfig(fileContent, configPath);
}

function readConfigFile(configPath: string): string {
  try {
    return readFileSync(configPath, 'utf-8');
  } catch (error) {
    throw new ConfigError({
      message: `Failed to read config file: ${configPath}`,
      code: 'CORD_CONFIG_001',
      suggestion: '请确认配置文件存在且当前进程有读取权限。',
      context: { configPath },
      cause: toErrorCause(error),
    });
  }
}

function parseYamlConfig(fileContent: string, configPath: string): unknown {
  try {
    return matter(`---\n${fileContent}\n---`).data;
  } catch (error) {
    throw new ConfigError({
      message: `Failed to parse YAML config: ${configPath}`,
      code: 'CORD_CONFIG_002',
      suggestion: '请检查 YAML 语法，确保缩进和键值格式正确。',
      context: { configPath },
      cause: toErrorCause(error),
    });
  }
}

function parseJsonConfig(fileContent: string, configPath: string): unknown {
  try {
    return JSON.parse(fileContent) as unknown;
  } catch (error) {
    throw new ConfigError({
      message: `Failed to parse JSON config: ${configPath}`,
      code: 'CORD_CONFIG_003',
      suggestion: '请检查 JSON 语法，确保逗号、引号和括号完整。',
      context: { configPath },
      cause: toErrorCause(error),
    });
  }
}

function mergeWithDefaults(config: CordConfig): CordConfig {
  return {
    ...config,
    scanPaths: config.scanPaths ?? [...DEFAULT_SCAN_PATHS],
    excludePaths: config.excludePaths ?? [...DEFAULT_EXCLUDE_PATHS],
    confidenceThreshold: config.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD,
  };
}

function cloneDefaultConfig(): CordConfig {
  return {
    scanPaths: [...DEFAULT_SCAN_PATHS],
    excludePaths: [...DEFAULT_EXCLUDE_PATHS],
    confidenceThreshold: DEFAULT_CONFIDENCE_THRESHOLD,
  };
}

function toErrorCause(error: unknown): Error | undefined {
  return error instanceof Error ? error : undefined;
}
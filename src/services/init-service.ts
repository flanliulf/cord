import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { frameworkAdapters, resolveAdapter, type IFrameworkAdapter } from '../adapters/framework/index.js';
import { ideAdapters, resolveIdeAdapter, type IIdeAdapter, type IdeName, type SkillsArtifact } from '../adapters/ide/index.js';
import { validateConfig } from '../schemas/index.js';
import type { CordConfig } from '../types/index.js';
import { ConfigError, DEFAULT_CONFIG } from '../utils/index.js';

const YAML_CONFIG_FILE = 'cord.config.yaml';
const JSON_CONFIG_FILE = 'cord.config.json';
const CORD_DATA_DIR = '.cord';

const IDE_OUTPUT_PATHS: Record<IdeName, readonly string[]> = {
  'claude-code': ['CLAUDE.md', '.claude/rules/cord-relations.md', '.claude/settings.json', '.claude/hooks/cord-post-edit.sh'],
  cursor: ['.cursor/mcp.json', '.cursor/rules/cord-relations.mdc'],
  'vscode-copilot': ['.github/copilot-instructions.md', '.vscode/mcp.json', 'AGENTS.md'],
  'codex-cli': ['AGENTS.md'],
};

export type InitConfigFormat = 'yaml' | 'json';

export interface InitInput {
  projectRoot: string;
  ide?: IdeName;
  format?: InitConfigFormat;
}

export interface InitResult {
  ide: IdeName;
  framework: string;
  configPath: string;
  dataDirectory: string;
  generatedFiles: string[];
  generatedSkills: string[];
}

interface InitServiceDependencies {
  ideRegistry?: readonly IIdeAdapter[];
  frameworkRegistry?: readonly IFrameworkAdapter[];
}

export class InitService {
  private readonly ideRegistry: readonly IIdeAdapter[];
  private readonly frameworkRegistry: readonly IFrameworkAdapter[];

  constructor(dependencies: InitServiceDependencies = {}) {
    this.ideRegistry = dependencies.ideRegistry ?? ideAdapters;
    this.frameworkRegistry = dependencies.frameworkRegistry ?? frameworkAdapters;
  }

  async init(input: InitInput): Promise<InitResult> {
    const projectRoot = resolve(input.projectRoot);
    const ideAdapter = this.resolveIde(projectRoot, input.ide);
    const frameworkAdapter = resolveAdapter(DEFAULT_CONFIG, projectRoot, this.frameworkRegistry);
    const configFormat = input.format ?? 'yaml';
    const knownOutputPaths = [
      ...IDE_OUTPUT_PATHS[ideAdapter.name],
      YAML_CONFIG_FILE,
      JSON_CONFIG_FILE,
    ];
    const beforeSnapshot = snapshotPaths(projectRoot, knownOutputPaths);

    ideAdapter.generateMcpConfig(projectRoot);
    ideAdapter.generateInstructionFile(projectRoot);
    ideAdapter.generateHooksConfig?.(projectRoot);

    const generatedSkills = writeSkillsArtifacts(projectRoot, ideAdapter.generateSkills?.(projectRoot) ?? []);
    const config = buildInitConfig(ideAdapter.name, frameworkAdapter);
    const configPath = writeConfigFile(projectRoot, config, configFormat);
    mkdirSync(join(projectRoot, CORD_DATA_DIR), { recursive: true });

    const afterSnapshot = snapshotPaths(projectRoot, [...knownOutputPaths, ...generatedSkills]);
    const generatedFiles = diffSnapshots(beforeSnapshot, afterSnapshot)
      .filter((relativePath) => !generatedSkills.includes(relativePath));

    return {
      ide: ideAdapter.name,
      framework: frameworkAdapter.name,
      configPath,
      dataDirectory: join(projectRoot, CORD_DATA_DIR),
      generatedFiles,
      generatedSkills,
    };
  }

  private resolveIde(projectRoot: string, explicitIde?: IdeName): IIdeAdapter {
    try {
      return resolveIdeAdapter({
        projectRoot,
        explicitIde,
        registry: this.ideRegistry,
      });
    } catch (error) {
      if (error instanceof ConfigError && error.context.error === 'AMBIGUOUS_IDE') {
        throw new ConfigError({
          message: error.message,
          code: error.code,
          suggestion: '请使用 --ide 标志显式指定 IDE',
          context: {
            error: 'AMBIGUOUS_IDE',
            candidates: toStringArray(error.context.detectedIdes),
          },
          cause: error,
        });
      }

      throw error;
    }
  }
}

function buildInitConfig(ide: IdeName, frameworkAdapter: IFrameworkAdapter): CordConfig {
  return validateConfig({
    framework: frameworkAdapter.name,
    ide,
    scanPaths: frameworkAdapter.getScanPaths(DEFAULT_CONFIG),
    excludePaths: frameworkAdapter.getExcludePaths(DEFAULT_CONFIG),
    confidenceThreshold: DEFAULT_CONFIG.confidenceThreshold,
  });
}

function writeConfigFile(projectRoot: string, config: CordConfig, format: InitConfigFormat): string {
  const yamlPath = join(projectRoot, YAML_CONFIG_FILE);
  const jsonPath = join(projectRoot, JSON_CONFIG_FILE);

  if (format === 'json') {
    rmSync(yamlPath, { force: true });
    writeFileSync(jsonPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
    return jsonPath;
  }

  rmSync(jsonPath, { force: true });
  writeFileSync(yamlPath, serializeYamlConfig(config), 'utf8');
  return yamlPath;
}

function serializeYamlConfig(config: CordConfig): string {
  const lines = [
    `framework: ${config.framework ?? 'generic'}`,
    `ide: ${config.ide ?? 'claude-code'}`,
    'scanPaths:',
    ...(config.scanPaths ?? ['.']).map((scanPath) => `  - ${scanPath}`),
    'excludePaths:',
    ...(config.excludePaths ?? []).map((excludePath) => `  - ${excludePath}`),
    `confidenceThreshold: ${config.confidenceThreshold ?? DEFAULT_CONFIG.confidenceThreshold ?? 0.5}`,
  ];

  return `${lines.join('\n')}\n`;
}

function writeSkillsArtifacts(projectRoot: string, artifacts: SkillsArtifact[]): string[] {
  const generatedSkills: string[] = [];

  for (const artifact of artifacts) {
    const targetPath = resolve(projectRoot, artifact.targetPath);
    const relativePath = toProjectRelativePath(projectRoot, targetPath);

    if (relativePath === null || relativePath === '') {
      throw new ConfigError({
        message: `Skills 产物路径超出项目目录: ${artifact.targetPath}`,
        code: 'CORD_CONFIG_010',
        suggestion: '请修正 Skills 产物路径，使其位于项目根目录内。',
        context: {
          targetPath: artifact.targetPath,
        },
      });
    }

    mkdirSync(dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, artifact.content, 'utf8');
    generatedSkills.push(relativePath);
  }

  return generatedSkills.sort();
}

function snapshotPaths(projectRoot: string, relativePaths: string[]): Map<string, string | null> {
  const snapshot = new Map<string, string | null>();

  for (const relativePath of new Set(relativePaths.map((value) => value.replaceAll('\\', '/')))) {
    const absolutePath = join(projectRoot, relativePath);

    if (!existsSync(absolutePath)) {
      snapshot.set(relativePath, null);
      continue;
    }

    snapshot.set(relativePath, hashFile(absolutePath));
  }

  return snapshot;
}

function diffSnapshots(before: Map<string, string | null>, after: Map<string, string | null>): string[] {
  const changedPaths: string[] = [];

  for (const [relativePath, afterHash] of after.entries()) {
    if (afterHash === null) {
      continue;
    }

    if (before.get(relativePath) !== afterHash) {
      changedPaths.push(relativePath);
    }
  }

  return changedPaths.sort();
}

function hashFile(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function toProjectRelativePath(projectRoot: string, targetPath: string): string | null {
  const relativePath = relative(projectRoot, targetPath).replaceAll('\\', '/');

  if (relativePath === '..' || relativePath.startsWith('../')) {
    return null;
  }

  return relativePath;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string');
}
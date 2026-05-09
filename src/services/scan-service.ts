import { stat } from 'node:fs/promises';
import { basename, extname, relative } from 'node:path';
import {
  frameworkAdapters,
  resolveAdapter,
  type DocTypeDefinition,
  type IFrameworkAdapter,
  type PresetRule,
} from '../adapters/index.js';
import type { IGraphRepository, SyncState } from '../repositories/index.js';
import { validateScanInput, type ScanInput } from '../schemas/index.js';
import type {
  DiscoveredRelation,
  ParsedDocument,
  ScanPipelineResult,
} from '../scanner/index.js';
import { ScanPipeline } from '../scanner/index.js';
import type { RelationEdge, RelationType } from '../types/index.js';
import { loadConfig, ScanError } from '../utils/index.js';

interface ScanPipelineLike {
  process(filePath: string, allDocPaths: string[]): Promise<ScanPipelineResult | null>;
  takeWarnings(): string[];
}

interface ClassifiedDocument {
  absolutePath: string;
  relativePath: string;
  docType?: string;
  contentHash: string;
  lastObservedMtimeMs: number;
  metadata: Record<string, unknown>;
  title?: string;
}

interface PersistedRelationPlan {
  sourceDocPath: string;
  targetDocPath: string;
  relationType: RelationType;
  confidence: number;
  source: RelationEdge['source'];
  metadata?: Record<string, unknown>;
}

export interface ScanResult {
  documentsFound: number;
  relationsDiscovered: number;
  warnings: string[];
  durationMs: number;
}

/**
 * ScanService 负责编排冷启动扫描、文档分类、预设关系生成与原子持久化。
 */
export class ScanService {
  constructor(
    private readonly repository: IGraphRepository,
    private readonly pipeline: ScanPipelineLike = new ScanPipeline(),
    private readonly adapterRegistry: readonly IFrameworkAdapter[] = frameworkAdapters,
  ) {}

  async scan(input: ScanInput): Promise<ScanResult> {
    const validatedInput = validateScanInput(input);
    const startedAt = Date.now();
    const config = loadConfig(validatedInput.projectRoot);
    const adapter = resolveAdapter(config, validatedInput.projectRoot, this.adapterRegistry);
    const effectiveScanPaths = computeEffectiveScanPaths(config.scanPaths, adapter.getScanPaths(config), validatedInput.paths);
    const effectiveExcludePaths = computeEffectiveExcludePaths(config.excludePaths, adapter.getExcludePaths(config));
    const discoveredDocuments = adapter.discoverDocuments(
      validatedInput.projectRoot,
      effectiveScanPaths,
      effectiveExcludePaths,
    );

    const warnings: string[] = [];
    const classifiedDocuments: ClassifiedDocument[] = [];
    const scanRelations: PersistedRelationPlan[] = [];

    for (const filePath of discoveredDocuments) {
      const pipelineResult = await this.pipeline.process(filePath, discoveredDocuments);
      warnings.push(...this.pipeline.takeWarnings());

      if (pipelineResult === null) {
        continue;
      }

      warnings.push(...pipelineResult.warnings);
      classifiedDocuments.push(
        await classifyDocument(validatedInput.projectRoot, filePath, pipelineResult.document, adapter),
      );
      scanRelations.push(...toScanRelationPlans(pipelineResult.relations));
    }

    const presetRelations = buildPresetRelations(classifiedDocuments, adapter.getPresetRules());
    const filteredRelations = filterDisabledRelationTypes(
      dedupeRelations([...scanRelations, ...presetRelations]),
      config.relationTypes,
    );
    const persistableRelations = collectPersistableRelations(
      validatedInput.projectRoot,
      classifiedDocuments,
      filteredRelations,
      warnings,
    );

    this.repository.transaction(() => {
      if (validatedInput.rebuild) {
        this.repository.deleteAllDocuments();
      }

      const persistedDocs = new Map<string, { id: string; contentHash: string; lastObservedMtimeMs: number }>();
      const scannedAt = new Date().toISOString();

      for (const document of classifiedDocuments) {
        const persisted = this.repository.addDocument({
          path: document.relativePath,
          title: document.title,
          docType: document.docType,
          framework: adapter.name,
          contentHash: document.contentHash,
          metadata: document.metadata,
        });

        persistedDocs.set(document.absolutePath, {
          id: persisted.id,
          contentHash: document.contentHash,
          lastObservedMtimeMs: document.lastObservedMtimeMs,
        });
      }

      for (const relation of persistableRelations) {
        const sourceDoc = persistedDocs.get(relation.sourceDocPath);
        const targetDoc = persistedDocs.get(relation.targetDocPath);

        if (sourceDoc === undefined || targetDoc === undefined) {
          throw new ScanError({
            message: '扫描写入计划与已持久化文档不一致，无法写入关系。',
            code: 'CORD_SCAN_004',
            suggestion: '请检查 ScanService 生成的关系端点是否都来自当前批次已分类文档。',
            context: {
              sourceDocPath: relation.sourceDocPath,
              targetDocPath: relation.targetDocPath,
              relationType: relation.relationType,
            },
          });
        }

        this.repository.addRelation({
          sourceDocId: sourceDoc.id,
          targetDocId: targetDoc.id,
          relationType: relation.relationType,
          confidence: relation.confidence,
          source: relation.source,
          status: 'active',
          metadata: relation.metadata,
        });
      }

      for (const document of classifiedDocuments) {
        const persisted = persistedDocs.get(document.absolutePath);

        if (persisted === undefined) {
          continue;
        }

        const state: SyncState = {
          docId: persisted.id,
          lastScannedAt: scannedAt,
          lastObservedMtimeMs: persisted.lastObservedMtimeMs,
          contentHash: persisted.contentHash,
          status: 'synced',
        };

        this.repository.upsertSyncState(state);
      }
    });

    return {
      documentsFound: classifiedDocuments.length,
      relationsDiscovered: persistableRelations.length,
      warnings,
      durationMs: Date.now() - startedAt,
    };
  }

  getManualRelationsCount(): number {
    return this.repository.getAllRelations().filter((relation) => relation.source === 'manual').length;
  }

  close(): void {
    this.repository.close();
  }
}

export function computeEffectiveScanPaths(
  configuredScanPaths: string[] | undefined,
  adapterScanPaths: string[],
  requestedPaths?: string[],
): string[] {
  const basePaths = requestedPaths ?? configuredScanPaths ?? ['.'];
  return dedupePaths([...basePaths, ...adapterScanPaths]);
}

export function computeEffectiveExcludePaths(
  configuredExcludePaths: string[] | undefined,
  adapterExcludePaths: string[],
): string[] {
  return dedupePaths([...(configuredExcludePaths ?? []), ...adapterExcludePaths]);
}

async function classifyDocument(
  projectRoot: string,
  absolutePath: string,
  document: ParsedDocument,
  adapter: IFrameworkAdapter,
): Promise<ClassifiedDocument> {
  const relativePath = toRelativePath(projectRoot, absolutePath);

  return {
    absolutePath,
    relativePath,
    docType: matchDocType(relativePath, adapter.getDocumentTypes()),
    contentHash: document.contentHash,
    lastObservedMtimeMs: await readObservedMtimeMs(absolutePath),
    metadata: {
      frontmatter: document.frontmatter,
      headings: document.headings,
      links: document.links,
    },
    title: extractTitle(relativePath, document),
  };
}

async function readObservedMtimeMs(filePath: string): Promise<number> {
  try {
    return (await stat(filePath)).mtimeMs;
  } catch (cause) {
    throw new ScanError({
      message: `读取文档元数据失败: ${filePath}`,
      code: 'CORD_SCAN_003',
      suggestion: '请确认扫描目标文件仍然存在且当前进程具备 stat 权限。',
      context: { filePath },
      cause: cause instanceof Error ? cause : undefined,
    });
  }
}

function extractTitle(relativePath: string, document: ParsedDocument): string {
  const frontmatterTitle = document.frontmatter['title'];

  if (typeof frontmatterTitle === 'string' && frontmatterTitle.trim() !== '') {
    return frontmatterTitle.trim();
  }

  const headingTitle = document.headings[0]?.text?.trim();

  if (headingTitle) {
    return headingTitle;
  }

  return basename(relativePath, extname(relativePath));
}

function matchDocType(relativePath: string, definitions: DocTypeDefinition[]): string | undefined {
  for (const definition of definitions) {
    if (definition.patterns.some((pattern) => matchesGlob(relativePath, pattern))) {
      return definition.name;
    }
  }

  return undefined;
}

function toScanRelationPlans(relations: DiscoveredRelation[]): PersistedRelationPlan[] {
  return relations.map((relation) => ({
    sourceDocPath: relation.sourceDoc,
    targetDocPath: relation.targetDoc,
    relationType: relation.relationType,
    confidence: relation.confidence,
    source: relation.source,
    metadata: relation.metadata === undefined ? { ruleName: relation.ruleName } : {
      ...relation.metadata,
      ruleName: relation.ruleName,
    },
  }));
}

function buildPresetRelations(
  documents: ClassifiedDocument[],
  presetRules: PresetRule[],
): PersistedRelationPlan[] {
  const documentsByType = new Map<string, ClassifiedDocument[]>();

  for (const document of documents) {
    if (document.docType === undefined) {
      continue;
    }

    const bucket = documentsByType.get(document.docType) ?? [];
    bucket.push(document);
    documentsByType.set(document.docType, bucket);
  }

  const presetRelations: PersistedRelationPlan[] = [];

  for (const rule of presetRules) {
    const sourceDocuments = documentsByType.get(rule.sourceDocType) ?? [];
    const targetDocuments = rule.targetDocType === '*'
      ? documents.filter((document) => document.docType !== undefined)
      : (documentsByType.get(rule.targetDocType) ?? []);

    for (const sourceDocument of sourceDocuments) {
      for (const targetDocument of targetDocuments) {
        if (sourceDocument.absolutePath === targetDocument.absolutePath) {
          continue;
        }

        presetRelations.push({
          sourceDocPath: sourceDocument.absolutePath,
          targetDocPath: targetDocument.absolutePath,
          relationType: rule.relationType,
          confidence: rule.confidence,
          source: 'framework_preset',
          metadata: {
            presetRule: `${rule.sourceDocType}->${rule.targetDocType}:${rule.relationType}`,
          },
        });
      }
    }
  }

  return presetRelations;
}

function dedupeRelations(relations: PersistedRelationPlan[]): PersistedRelationPlan[] {
  const relationMap = new Map<string, PersistedRelationPlan>();

  for (const relation of relations) {
    const key = `${relation.sourceDocPath}::${relation.targetDocPath}::${relation.relationType}`;
    const existing = relationMap.get(key);

    if (existing === undefined || relation.confidence > existing.confidence) {
      relationMap.set(key, relation);
    }
  }

  return [...relationMap.values()].sort((left, right) => {
    const leftKey = `${left.sourceDocPath}:${left.targetDocPath}:${left.relationType}`;
    const rightKey = `${right.sourceDocPath}:${right.targetDocPath}:${right.relationType}`;
    return leftKey.localeCompare(rightKey);
  });
}

function filterDisabledRelationTypes(
  relations: PersistedRelationPlan[],
  relationTypes: Partial<Record<RelationType, { enabled: boolean }>> | undefined,
): PersistedRelationPlan[] {
  if (relationTypes === undefined) {
    return relations;
  }

  return relations.filter((relation) => relationTypes[relation.relationType]?.enabled !== false);
}

function collectPersistableRelations(
  projectRoot: string,
  documents: ClassifiedDocument[],
  relations: PersistedRelationPlan[],
  warnings: string[],
): PersistedRelationPlan[] {
  const discoveredPaths = new Set(documents.map((document) => document.absolutePath));
  const persistableRelations: PersistedRelationPlan[] = [];

  for (const relation of relations) {
    if (
      discoveredPaths.has(relation.sourceDocPath) &&
      discoveredPaths.has(relation.targetDocPath)
    ) {
      persistableRelations.push(relation);
      continue;
    }

    warnings.push(
      `跳过缺失端点关系: ${relation.relationType} ${formatRelationEndpoint(projectRoot, relation.sourceDocPath)} -> ${formatRelationEndpoint(projectRoot, relation.targetDocPath)}`,
    );
  }

  return persistableRelations;
}

function dedupePaths(paths: string[]): string[] {
  const normalizedToOriginal = new Map<string, string>();

  for (const candidate of paths) {
    const trimmed = candidate.trim();

    if (trimmed === '') {
      continue;
    }

    const normalized = normalizePath(trimmed);

    if (!normalizedToOriginal.has(normalized)) {
      normalizedToOriginal.set(normalized, trimmed);
    }
  }

  return [...normalizedToOriginal.values()];
}

function toRelativePath(projectRoot: string, absolutePath: string): string {
  return relative(projectRoot, absolutePath).replaceAll('\\', '/');
}

function formatRelationEndpoint(projectRoot: string, absolutePath: string): string {
  const relativePath = toRelativePath(projectRoot, absolutePath);

  if (relativePath === '' || relativePath === '.' || relativePath.startsWith('..')) {
    return absolutePath.replaceAll('\\', '/');
  }

  return `/${relativePath}`;
}

function normalizePath(pathValue: string): string {
  const normalized = pathValue.replaceAll('\\', '/').replace(/^\.\//, '');

  if (normalized === '.') {
    return '.';
  }

  return normalized.replace(/\/+$/, '');
}

function matchesGlob(candidatePath: string, pattern: string): boolean {
  return globToRegExp(pattern).test(candidatePath);
}

function globToRegExp(pattern: string): RegExp {
  const normalizedPattern = pattern.replaceAll('\\', '/');
  let regex = '^';

  for (let index = 0; index < normalizedPattern.length; index += 1) {
    const current = normalizedPattern[index];

    if (current === '*') {
      const next = normalizedPattern[index + 1];
      const afterNext = normalizedPattern[index + 2];

      if (next === '*') {
        if (afterNext === '/') {
          regex += '(?:.*/)?';
          index += 2;
        } else {
          regex += '.*';
          index += 1;
        }
      } else {
        regex += '[^/]*';
      }

      continue;
    }

    if (current === '?') {
      regex += '[^/]';
      continue;
    }

    if (current === '[') {
      const closingBracket = normalizedPattern.indexOf(']', index + 1);

      if (closingBracket > index) {
        regex += normalizedPattern.slice(index, closingBracket + 1);
        index = closingBracket;
        continue;
      }
    }

    regex += escapeRegex(current);
  }

  regex += '$';
  return new RegExp(regex);
}

function escapeRegex(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}
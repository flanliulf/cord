import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { basename, extname, join, relative } from 'node:path';
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
  CurrentFileSnapshot,
  DiscoveredRelation,
  ParsedDocument,
  ScanPipelineResult,
  StoredDocRecord,
} from '../scanner/index.js';
import { detectLifecycle, ScanPipeline } from '../scanner/index.js';
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

    if (!validatedInput.rebuild && this.repository.getDocumentCount() > 0) {
      const currentSnapshots = await collectCurrentFileSnapshots(discoveredDocuments);
      const storedDocs = collectStoredDocRecords(validatedInput.projectRoot, this.repository);
      const lifecycle = detectLifecycle(currentSnapshots, storedDocs);

      if (!hasLifecycleChanges(lifecycle)) {
        return {
          documentsFound: 0,
          relationsDiscovered: 0,
          warnings: [],
          durationMs: Date.now() - startedAt,
        };
      }

      const batch = await buildScanBatch(
        this.pipeline,
        validatedInput.projectRoot,
        lifecycle.modified.map((snapshot) => ({
          filePath: snapshot.path,
          observedMtimeMs: snapshot.mtimeMs,
        })).concat(
          lifecycle.added.map((snapshot) => ({
            filePath: snapshot.path,
            observedMtimeMs: snapshot.mtimeMs,
          })),
        ),
        discoveredDocuments,
        adapter,
      );
      const storedDocuments = this.repository.getAllDocuments();
      const syncStates = this.repository.getAllSyncStates();
      const knownDocuments = buildKnownDocumentCatalog(
        validatedInput.projectRoot,
        storedDocuments,
        syncStates,
        lifecycle,
        batch.classifiedDocuments,
      );
      const addedDocumentPaths = new Set(lifecycle.added.map((snapshot) => snapshot.path));
      const changedDocumentPaths = new Set(batch.classifiedDocuments.map((document) => document.absolutePath));
      const presetRelations = buildIncrementalPresetRelations(
        knownDocuments,
        adapter.getPresetRules(),
        changedDocumentPaths,
        addedDocumentPaths,
      );
      const warnings = [...batch.warnings];
      const filteredRelations = filterDisabledRelationTypes(
        dedupeRelations([...batch.scanRelations, ...presetRelations]),
        config.relationTypes,
      );
      const persistableRelations = collectPersistableRelations(
        validatedInput.projectRoot,
        new Set(knownDocuments.map((document) => document.absolutePath)),
        filteredRelations,
        warnings,
      );
      const storedDocsById = new Map(storedDocs.map((document) => [document.docId, document]));
      const modifiedDocumentPaths = new Set(lifecycle.modified.map((snapshot) => snapshot.path));

      this.repository.transaction(() => {
        const scannedAt = new Date().toISOString();
        const existingDocumentsByPath = new Map(
          storedDocuments.map((document) => [toAbsolutePath(validatedInput.projectRoot, document.path), document]),
        );
        const pathToDocId = new Map(
          storedDocuments.map((document) => [toAbsolutePath(validatedInput.projectRoot, document.path), document.id]),
        );
        const processedDocIdsByPath = new Map<string, string>();

        for (const deletedDocument of lifecycle.deleted) {
          this.repository.deleteDocument(deletedDocument.docId);
          pathToDocId.delete(deletedDocument.path);
        }

        for (const pathChange of [...lifecycle.renamed, ...lifecycle.moved]) {
          this.repository.updateDocument(pathChange.docId, {
            path: toRelativePath(validatedInput.projectRoot, pathChange.newPath),
          });
          pathToDocId.delete(pathChange.oldPath);
          pathToDocId.set(pathChange.newPath, pathChange.docId);
        }

        for (const document of batch.classifiedDocuments) {
          if (modifiedDocumentPaths.has(document.absolutePath)) {
            const existingDocument = existingDocumentsByPath.get(document.absolutePath);

            if (existingDocument === undefined) {
              throw new ScanError({
                message: `增量扫描缺少待更新文档: ${document.relativePath}`,
                code: 'CORD_SCAN_004',
                suggestion: '请检查 lifecycle-detector 与仓储中的文档路径是否保持一致。',
                context: { path: document.relativePath },
              });
            }

            this.repository.deleteRelationsByDocId(existingDocument.id, 'source', {
              excludeSources: ['manual'],
            });
            this.repository.updateDocument(existingDocument.id, {
              path: document.relativePath,
              title: document.title,
              docType: document.docType,
              framework: adapter.name,
              contentHash: document.contentHash,
              metadata: document.metadata,
            });
            pathToDocId.set(document.absolutePath, existingDocument.id);
            processedDocIdsByPath.set(document.absolutePath, existingDocument.id);
            continue;
          }

          const persisted = this.repository.addDocument({
            path: document.relativePath,
            title: document.title,
            docType: document.docType,
            framework: adapter.name,
            contentHash: document.contentHash,
            metadata: document.metadata,
          });

          pathToDocId.set(document.absolutePath, persisted.id);
          processedDocIdsByPath.set(document.absolutePath, persisted.id);
        }

        for (const relation of persistableRelations) {
          const sourceDocId = pathToDocId.get(relation.sourceDocPath);
          const targetDocId = pathToDocId.get(relation.targetDocPath);

          if (sourceDocId === undefined || targetDocId === undefined) {
            throw new ScanError({
              message: '扫描写入计划与已持久化文档不一致，无法写入关系。',
              code: 'CORD_SCAN_004',
              suggestion: '请检查 ScanService 生成的关系端点是否都来自当前项目中的已知文档。',
              context: {
                sourceDocPath: relation.sourceDocPath,
                targetDocPath: relation.targetDocPath,
                relationType: relation.relationType,
              },
            });
          }

          this.repository.addRelation({
            sourceDocId,
            targetDocId,
            relationType: relation.relationType,
            confidence: relation.confidence,
            source: relation.source,
            status: 'active',
            metadata: relation.metadata,
          });
        }

        for (const document of batch.classifiedDocuments) {
          const docId = processedDocIdsByPath.get(document.absolutePath);

          if (docId === undefined) {
            continue;
          }

          this.repository.upsertSyncState({
            docId,
            lastScannedAt: scannedAt,
            lastObservedMtimeMs: document.lastObservedMtimeMs,
            contentHash: document.contentHash,
            status: 'synced',
          });
        }

        for (const pathChange of [...lifecycle.renamed, ...lifecycle.moved]) {
          const storedDocument = storedDocsById.get(pathChange.docId);

          if (storedDocument === undefined) {
            continue;
          }

          this.repository.upsertSyncState({
            docId: pathChange.docId,
            lastScannedAt: scannedAt,
            lastObservedMtimeMs: pathChange.currentMtimeMs,
            contentHash: storedDocument.contentHash,
            status: storedDocument.status,
          });
        }
      });

      return {
        documentsFound: batch.classifiedDocuments.length,
        relationsDiscovered: persistableRelations.length,
        warnings,
        durationMs: Date.now() - startedAt,
      };
    }

    const batch = await buildScanBatch(
      this.pipeline,
      validatedInput.projectRoot,
      discoveredDocuments.map((filePath) => ({ filePath })),
      discoveredDocuments,
      adapter,
    );
    const warnings = [...batch.warnings];

    const presetRelations = buildPresetRelations(batch.classifiedDocuments, adapter.getPresetRules());
    const filteredRelations = filterDisabledRelationTypes(
      dedupeRelations([...batch.scanRelations, ...presetRelations]),
      config.relationTypes,
    );
    const persistableRelations = collectPersistableRelations(
      validatedInput.projectRoot,
      new Set(batch.classifiedDocuments.map((document) => document.absolutePath)),
      filteredRelations,
      warnings,
    );

    this.repository.transaction(() => {
      if (validatedInput.rebuild) {
        this.repository.deleteAllDocuments();
      }

      const persistedDocs = new Map<string, { id: string; contentHash: string; lastObservedMtimeMs: number }>();
      const scannedAt = new Date().toISOString();

      for (const document of batch.classifiedDocuments) {
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

      for (const document of batch.classifiedDocuments) {
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
      documentsFound: batch.classifiedDocuments.length,
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
  observedMtimeMs?: number,
): Promise<ClassifiedDocument> {
  const relativePath = toRelativePath(projectRoot, absolutePath);

  return {
    absolutePath,
    relativePath,
    docType: matchDocType(relativePath, adapter.getDocumentTypes()),
    contentHash: document.contentHash,
    lastObservedMtimeMs: observedMtimeMs ?? await readObservedMtimeMs(absolutePath),
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
  knownDocumentPaths: Set<string>,
  relations: PersistedRelationPlan[],
  warnings: string[],
): PersistedRelationPlan[] {
  const persistableRelations: PersistedRelationPlan[] = [];

  for (const relation of relations) {
    if (
      knownDocumentPaths.has(relation.sourceDocPath) &&
      knownDocumentPaths.has(relation.targetDocPath)
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

async function buildScanBatch(
  pipeline: ScanPipelineLike,
  projectRoot: string,
  filesToProcess: Array<{ filePath: string; observedMtimeMs?: number }>,
  allDocPaths: string[],
  adapter: IFrameworkAdapter,
): Promise<{
  classifiedDocuments: ClassifiedDocument[];
  scanRelations: PersistedRelationPlan[];
  warnings: string[];
}> {
  const warnings: string[] = [];
  const classifiedDocuments: ClassifiedDocument[] = [];
  const scanRelations: PersistedRelationPlan[] = [];

  for (const file of filesToProcess) {
    const pipelineResult = await pipeline.process(file.filePath, allDocPaths);
    warnings.push(...pipeline.takeWarnings());

    if (pipelineResult === null) {
      continue;
    }

    warnings.push(...pipelineResult.warnings);
    classifiedDocuments.push(
      await classifyDocument(
        projectRoot,
        file.filePath,
        pipelineResult.document,
        adapter,
        file.observedMtimeMs,
      ),
    );
    scanRelations.push(...toScanRelationPlans(pipelineResult.relations));
  }

  return {
    classifiedDocuments,
    scanRelations,
    warnings,
  };
}

async function collectCurrentFileSnapshots(filePaths: string[]): Promise<CurrentFileSnapshot[]> {
  return Promise.all(filePaths.map((filePath) => readCurrentFileSnapshot(filePath)));
}

async function readCurrentFileSnapshot(filePath: string): Promise<CurrentFileSnapshot> {
  try {
    const [fileStat, rawFile] = await Promise.all([stat(filePath), readFile(filePath)]);

    return {
      path: filePath,
      mtimeMs: fileStat.mtimeMs,
      contentHash: createHash('sha256').update(rawFile).digest('hex'),
    };
  } catch (cause) {
    throw new ScanError({
      message: `读取文档快照失败: ${filePath}`,
      code: 'CORD_SCAN_003',
      suggestion: '请确认扫描目标文件仍然存在且当前进程具备读取与 stat 权限。',
      context: { filePath },
      cause: cause instanceof Error ? cause : undefined,
    });
  }
}

function collectStoredDocRecords(projectRoot: string, repository: IGraphRepository): StoredDocRecord[] {
  const syncStatesByDocId = new Map(
    repository.getAllSyncStates().map((syncState) => [syncState.docId, syncState]),
  );

  return repository.getAllDocuments().map((document) => {
    const syncState = syncStatesByDocId.get(document.id);

    return {
      docId: document.id,
      path: toAbsolutePath(projectRoot, document.path),
      contentHash: syncState?.contentHash ?? document.contentHash ?? '',
      lastObservedMtimeMs: syncState?.lastObservedMtimeMs ?? -1,
      status: syncState?.status ?? 'modified',
    };
  });
}

function hasLifecycleChanges(lifecycle: ReturnType<typeof detectLifecycle>): boolean {
  return lifecycle.renamed.length > 0
    || lifecycle.moved.length > 0
    || lifecycle.deleted.length > 0
    || lifecycle.modified.length > 0
    || lifecycle.added.length > 0;
}

function buildKnownDocumentCatalog(
  projectRoot: string,
  storedDocuments: ReturnType<IGraphRepository['getAllDocuments']>,
  syncStates: SyncState[],
  lifecycle: ReturnType<typeof detectLifecycle>,
  changedDocuments: ClassifiedDocument[],
): ClassifiedDocument[] {
  const syncStatesByDocId = new Map(syncStates.map((syncState) => [syncState.docId, syncState]));
  const deletedDocIds = new Set(lifecycle.deleted.map((document) => document.docId));
  const updatedPathsByDocId = new Map(
    [...lifecycle.renamed, ...lifecycle.moved].map((pathChange) => [pathChange.docId, pathChange.newPath]),
  );
  const catalog = new Map<string, ClassifiedDocument>();

  for (const storedDocument of storedDocuments) {
    if (deletedDocIds.has(storedDocument.id)) {
      continue;
    }

    const syncState = syncStatesByDocId.get(storedDocument.id);
    const absolutePath = updatedPathsByDocId.get(storedDocument.id)
      ?? toAbsolutePath(projectRoot, storedDocument.path);

    catalog.set(absolutePath, {
      absolutePath,
      relativePath: toRelativePath(projectRoot, absolutePath),
      docType: storedDocument.docType,
      contentHash: syncState?.contentHash ?? storedDocument.contentHash ?? '',
      lastObservedMtimeMs: syncState?.lastObservedMtimeMs ?? 0,
      metadata: storedDocument.metadata ?? {},
      title: storedDocument.title,
    });
  }

  for (const changedDocument of changedDocuments) {
    catalog.set(changedDocument.absolutePath, changedDocument);
  }

  return [...catalog.values()];
}

function buildIncrementalPresetRelations(
  knownDocuments: ClassifiedDocument[],
  presetRules: PresetRule[],
  changedDocumentPaths: Set<string>,
  addedDocumentPaths: Set<string>,
): PersistedRelationPlan[] {
  return buildPresetRelations(knownDocuments, presetRules).filter(
    (relation) => changedDocumentPaths.has(relation.sourceDocPath) || addedDocumentPaths.has(relation.targetDocPath),
  );
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

function toAbsolutePath(projectRoot: string, documentPath: string): string {
  return join(projectRoot, documentPath);
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
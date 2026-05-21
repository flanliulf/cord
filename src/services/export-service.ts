import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import type { IGraphRepository } from '../repositories/index.js';
import { type ExportInput, validateExportInput } from '../schemas/index.js';
import type { DocumentNode, RelationEdge } from '../types/index.js';
import { loadConfig } from '../utils/index.js';

const SNAPSHOT_SCHEMA_VERSION = '1.0';
export const DEFAULT_EXPORT_FILENAME = 'cord-snapshot.json';

export interface ExportedDocument {
  id: string;
  path: string;
  title: string | null;
  docType: string | null;
  framework: string | null;
  contentHash: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExportedRelation {
  id: string;
  sourceDocId: string;
  targetDocId: string;
  relationType: RelationEdge['relationType'];
  confidence: number;
  source: RelationEdge['source'];
  status: RelationEdge['status'];
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface GraphSnapshot {
  schemaVersion: typeof SNAPSHOT_SCHEMA_VERSION;
  exportedAt: string;
  project: string;
  documents: ExportedDocument[];
  relations: ExportedRelation[];
}

export interface ExportResult {
  outputPath: string;
  snapshot: GraphSnapshot;
}

interface ExportServiceOptions {
  now?: () => Date;
  mkdir?: typeof mkdir;
  rename?: typeof rename;
  rm?: typeof rm;
  writeFile?: typeof writeFile;
  defaultFileName?: string;
}

export class ExportService {
  private readonly now: () => Date;

  private readonly mkdir: typeof mkdir;

  private readonly rename: typeof rename;

  private readonly rm: typeof rm;

  private readonly writeFile: typeof writeFile;

  private readonly defaultFileName: string;

  constructor(
    private readonly repository: IGraphRepository,
    options: ExportServiceOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.mkdir = options.mkdir ?? mkdir;
    this.rename = options.rename ?? rename;
    this.rm = options.rm ?? rm;
    this.writeFile = options.writeFile ?? writeFile;
    this.defaultFileName = options.defaultFileName ?? DEFAULT_EXPORT_FILENAME;
  }

  async exportSnapshot(input: ExportInput): Promise<ExportResult> {
    const validatedInput = validateExportInput(input);
    const snapshot = this.buildSnapshot(validatedInput.projectRoot);
    const outputPath = resolveOutputPath(
      validatedInput.projectRoot,
      validatedInput.outputPath,
      this.defaultFileName,
    );

    await this.mkdir(dirname(outputPath), { recursive: true });
    await this.writeSnapshotFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`);

    return {
      outputPath,
      snapshot,
    };
  }

  close(): void {
    this.repository.close();
  }

  private buildSnapshot(projectRoot: string): GraphSnapshot {
    const project = resolveProjectName(projectRoot);
    const documents = this.repository
      .getAllDocuments()
      .map(serializeDocument)
      .sort(compareDocuments);
    const relations = this.repository
      .getAllRelations()
      .map(serializeRelation)
      .sort(compareRelations);

    return {
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
      exportedAt: this.now().toISOString(),
      project,
      documents,
      relations,
    };
  }

  private async writeSnapshotFile(outputPath: string, contents: string): Promise<void> {
    const temporaryOutputPath = createTemporaryOutputPath(outputPath);

    try {
      await this.writeFile(temporaryOutputPath, contents, 'utf-8');
      await this.rename(temporaryOutputPath, outputPath);
    } catch (error) {
      await this.rm(temporaryOutputPath, { force: true }).catch(() => undefined);
      throw error;
    }
  }
}

function resolveProjectName(projectRoot: string): string {
  const config = loadConfig(projectRoot);
  return config.projectName ?? basename(resolve(projectRoot));
}

function resolveOutputPath(projectRoot: string, outputPath: string | undefined, defaultFileName: string): string {
  if (outputPath === undefined) {
    return join(resolve(projectRoot), defaultFileName);
  }

  if (isDirectoryLikeOutputPath(outputPath)) {
    return resolve(projectRoot, outputPath, defaultFileName);
  }

  return resolve(projectRoot, outputPath);
}

function isDirectoryLikeOutputPath(outputPath: string): boolean {
  return outputPath.endsWith('/') || outputPath.endsWith('\\');
}

function createTemporaryOutputPath(outputPath: string): string {
  const nonce = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return join(dirname(outputPath), `.${basename(outputPath)}.${nonce}.tmp`);
}

function serializeDocument(document: DocumentNode): ExportedDocument {
  return {
    id: document.id,
    path: document.path,
    title: document.title ?? null,
    docType: document.docType ?? null,
    framework: document.framework ?? null,
    contentHash: document.contentHash ?? null,
    metadata: document.metadata ?? null,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

function serializeRelation(relation: RelationEdge): ExportedRelation {
  return {
    id: relation.id,
    sourceDocId: relation.sourceDocId,
    targetDocId: relation.targetDocId,
    relationType: relation.relationType,
    confidence: relation.confidence,
    source: relation.source,
    status: relation.status,
    metadata: relation.metadata ?? null,
    createdAt: relation.createdAt,
    updatedAt: relation.updatedAt,
  };
}

function compareDocuments(left: ExportedDocument, right: ExportedDocument): number {
  return compareStrings(left.path, right.path) || compareStrings(left.id, right.id);
}

function compareRelations(left: ExportedRelation, right: ExportedRelation): number {
  return compareStrings(left.sourceDocId, right.sourceDocId)
    || compareStrings(left.targetDocId, right.targetDocId)
    || compareStrings(left.relationType, right.relationType)
    || compareStrings(left.id, right.id);
}

function compareStrings(left: string, right: string): number {
  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
}

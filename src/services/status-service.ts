import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { IGraphRepository, SyncState } from '../repositories/index.js';
import { type StatusInput, validateStatusInput } from '../schemas/status-input.js';
import type { RelationEdge, RelationType } from '../types/index.js';
import { loadConfig } from '../utils/index.js';

type StatusRepository = IGraphRepository & {
  getMigrationVersion(): number;
};

export interface StatusResult {
  documentCount: number;
  relationCount: number;
  relationsByType: Record<string, number>;
  lastScanTime: string | null;
  migrationVersion: number;
  staleRelations: number;
  orphanedNodes: number;
  danglingEdges: number;
  configFilePath: string | null;
  framework: string | null;
  scanPaths: string[];
  excludePaths: string[];
  confidenceThreshold: number;
}

export function createEmptyStatusResult(projectRoot: string): StatusResult {
  const config = loadConfig(projectRoot);

  return {
    documentCount: 0,
    relationCount: 0,
    relationsByType: {},
    lastScanTime: null,
    migrationVersion: 0,
    staleRelations: 0,
    orphanedNodes: 0,
    danglingEdges: 0,
    configFilePath: resolveConfigFilePath(projectRoot),
    framework: config.framework ?? null,
    scanPaths: [...config.scanPaths ?? []],
    excludePaths: [...config.excludePaths ?? []],
    confidenceThreshold: config.confidenceThreshold ?? 0.5,
  };
}

const YAML_CONFIG_FILE = 'cord.config.yaml';
const JSON_CONFIG_FILE = 'cord.config.json';

export class StatusService {
  constructor(private readonly repository: StatusRepository) {}

  getStatus(input: StatusInput): StatusResult {
    const validatedInput = validateStatusInput(input);
    const baseResult = createEmptyStatusResult(validatedInput.projectRoot);
    const graphSnapshot = this.repository.transaction(() => {
      const documents = this.repository.getAllDocuments();
      const relations = this.repository.getAllRelations();
      const syncStates = this.repository.getAllSyncStates();
      const syncStatesByDocId = new Map(syncStates.map((syncState) => [syncState.docId, syncState]));
      const documentIds = new Set(documents.map((document) => document.id));
      const connectedDocumentIds = new Set<string>();
      let danglingEdges = 0;

      for (const relation of relations) {
        const hasSource = documentIds.has(relation.sourceDocId);
        const hasTarget = documentIds.has(relation.targetDocId);

        if (!hasSource || !hasTarget) {
          danglingEdges += 1;
          continue;
        }

        connectedDocumentIds.add(relation.sourceDocId);
        connectedDocumentIds.add(relation.targetDocId);
      }

      return {
        documentCount: documents.length,
        relationCount: relations.length,
        relationsByType: countRelationsByType(relations),
        lastScanTime: findLatestScanTime(syncStates),
        migrationVersion: this.repository.getMigrationVersion(),
        staleRelations: relations.filter((relation) => isStaleRelation(relation, syncStatesByDocId)).length,
        orphanedNodes: documents.filter((document) => !connectedDocumentIds.has(document.id)).length,
        danglingEdges,
      };
    });

    return {
      ...baseResult,
      ...graphSnapshot,
    };
  }

  close(): void {
    this.repository.close();
  }
}

function countRelationsByType(relations: RelationEdge[]): Record<string, number> {
  const counts: Partial<Record<RelationType, number>> = {};

  for (const relation of relations) {
    counts[relation.relationType] = (counts[relation.relationType] ?? 0) + 1;
  }

  return counts;
}

function findLatestScanTime(syncStates: SyncState[]): string | null {
  let latestTimestamp = Number.NEGATIVE_INFINITY;
  let latestScanTime: string | null = null;

  for (const syncState of syncStates) {
    const timestamp = Date.parse(syncState.lastScannedAt);

    if (Number.isNaN(timestamp) || timestamp <= latestTimestamp) {
      continue;
    }

    latestTimestamp = timestamp;
    latestScanTime = syncState.lastScannedAt;
  }

  return latestScanTime;
}

function isStaleRelation(
  relation: RelationEdge,
  syncStatesByDocId: Map<string, SyncState>,
): boolean {
  const relationCreatedAtMs = Date.parse(relation.createdAt);

  if (Number.isNaN(relationCreatedAtMs)) {
    return false;
  }

  const sourceSyncState = syncStatesByDocId.get(relation.sourceDocId);
  const targetSyncState = syncStatesByDocId.get(relation.targetDocId);

  return (sourceSyncState?.lastObservedMtimeMs ?? Number.NEGATIVE_INFINITY) > relationCreatedAtMs
    || (targetSyncState?.lastObservedMtimeMs ?? Number.NEGATIVE_INFINITY) > relationCreatedAtMs;
}

function resolveConfigFilePath(projectRoot: string): string | null {
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
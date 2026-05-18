// services - business logic layer
export { ScanService, computeEffectiveExcludePaths, computeEffectiveScanPaths } from './scan-service.js';
export type { ScanResult } from './scan-service.js';
export { QueryService } from './query-service.js';
export type { QueryRelationsOutput, QueryResultItem } from './query-service.js';
export { ImpactService } from './impact-service.js';
export type { ImpactResult, ImpactedDoc, ImpactSeverity, PropagationType } from './impact-service.js';
export { ExportService } from './export-service.js';
export type { ExportResult, ExportedDocument, ExportedRelation, GraphSnapshot } from './export-service.js';
export { StatusService, createEmptyStatusResult } from './status-service.js';
export type { StatusResult } from './status-service.js';
export { RelationService } from './relation-service.js';
export { InitService } from './init-service.js';
export type { InitConfigFormat, InitInput, InitResult } from './init-service.js';

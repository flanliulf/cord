// services - business logic layer
export { ScanService, computeEffectiveExcludePaths, computeEffectiveScanPaths } from './scan-service.js';
export type { ScanResult } from './scan-service.js';
export { QueryService } from './query-service.js';
export type { QueryRelationsOutput, QueryResultItem } from './query-service.js';
export { ImpactService } from './impact-service.js';
export type { ImpactResult, ImpactedDoc, ImpactSeverity, PropagationType } from './impact-service.js';

import { basename, dirname } from 'node:path';

export interface CurrentFileSnapshot {
  path: string;
  mtimeMs: number;
  contentHash: string;
}

export interface StoredDocRecord {
  docId: string;
  path: string;
  contentHash: string;
  lastObservedMtimeMs: number;
  status: 'synced' | 'modified';
}

export interface LifecyclePathChange {
  oldPath: string;
  newPath: string;
  docId: string;
  currentMtimeMs: number;
}

export interface LifecycleResult {
  renamed: LifecyclePathChange[];
  moved: LifecyclePathChange[];
  deleted: Array<{ path: string; docId: string }>;
  modified: CurrentFileSnapshot[];
  unchanged: string[];
  added: CurrentFileSnapshot[];
}

/**
 * 对比文件系统快照与已持久化文档，识别增量扫描所需的生命周期事件。
 */
export function detectLifecycle(
  currentFiles: CurrentFileSnapshot[],
  storedDocs: StoredDocRecord[],
): LifecycleResult {
  const result: LifecycleResult = {
    renamed: [],
    moved: [],
    deleted: [],
    modified: [],
    unchanged: [],
    added: [],
  };

  const currentByPath = new Map(currentFiles.map((file) => [file.path, file]));
  const unmatchedCurrentByHash = buildGroupedSnapshots(currentFiles);
  const matchedCurrentPaths = new Set<string>();
  const unresolvedStoredByHash = new Map<string, StoredDocRecord[]>();

  for (const storedDoc of storedDocs) {
    const currentFile = currentByPath.get(storedDoc.path);

    if (currentFile !== undefined) {
      matchedCurrentPaths.add(currentFile.path);
      removeGroupedSnapshot(unmatchedCurrentByHash, currentFile);

      if (currentFile.mtimeMs !== storedDoc.lastObservedMtimeMs) {
        result.modified.push(currentFile);
      } else {
        result.unchanged.push(currentFile.path);
      }

      continue;
    }
    const bucket = unresolvedStoredByHash.get(storedDoc.contentHash) ?? [];
    bucket.push(storedDoc);
    unresolvedStoredByHash.set(storedDoc.contentHash, bucket);
  }

  for (const [contentHash, unresolvedStoredDocs] of unresolvedStoredByHash.entries()) {
    const currentCandidates = unmatchedCurrentByHash.get(contentHash) ?? [];
    const resolvedMatches = resolveHashGroupMatches(unresolvedStoredDocs, currentCandidates);

    for (const match of resolvedMatches.matches) {
      matchedCurrentPaths.add(match.currentFile.path);

      const pathChange: LifecyclePathChange = {
        oldPath: match.storedDoc.path,
        newPath: match.currentFile.path,
        docId: match.storedDoc.docId,
        currentMtimeMs: match.currentFile.mtimeMs,
      };

      if (isRename(match.storedDoc.path, match.currentFile.path)) {
        result.renamed.push(pathChange);
      } else {
        result.moved.push(pathChange);
      }
    }

    for (const deletedDoc of resolvedMatches.unmatchedStoredDocs) {
      result.deleted.push({
        path: deletedDoc.path,
        docId: deletedDoc.docId,
      });
    }

    if (resolvedMatches.unmatchedCurrentFiles.length === 0) {
      unmatchedCurrentByHash.delete(contentHash);
    } else {
      unmatchedCurrentByHash.set(contentHash, resolvedMatches.unmatchedCurrentFiles);
    }
  }

  for (const currentFile of currentFiles) {
    if (matchedCurrentPaths.has(currentFile.path)) {
      continue;
    }

    result.added.push(currentFile);
  }

  return result;
}

interface HashGroupMatch {
  storedDoc: StoredDocRecord;
  currentFile: CurrentFileSnapshot;
}

interface PathScore {
  priority: number;
  basenameDistance: number;
  distance: number;
}

function buildGroupedSnapshots(currentFiles: CurrentFileSnapshot[]): Map<string, CurrentFileSnapshot[]> {
  const groupedSnapshots = new Map<string, CurrentFileSnapshot[]>();

  for (const currentFile of currentFiles) {
    const bucket = groupedSnapshots.get(currentFile.contentHash) ?? [];
    bucket.push(currentFile);
    groupedSnapshots.set(currentFile.contentHash, bucket);
  }

  return groupedSnapshots;
}

function removeGroupedSnapshot(
  groupedSnapshots: Map<string, CurrentFileSnapshot[]>,
  target: CurrentFileSnapshot,
): void {
  const bucket = groupedSnapshots.get(target.contentHash);

  if (bucket === undefined) {
    return;
  }

  const index = bucket.findIndex((item) => item.path === target.path);

  if (index < 0) {
    return;
  }

  bucket.splice(index, 1);

  if (bucket.length === 0) {
    groupedSnapshots.delete(target.contentHash);
  }
}

function isRename(oldPath: string, newPath: string): boolean {
  return dirname(oldPath) === dirname(newPath) && basename(oldPath) !== basename(newPath);
}

function resolveHashGroupMatches(
  storedDocs: StoredDocRecord[],
  currentFiles: CurrentFileSnapshot[],
): {
  matches: HashGroupMatch[];
  unmatchedStoredDocs: StoredDocRecord[];
  unmatchedCurrentFiles: CurrentFileSnapshot[];
} {
  const remainingStoredDocs = [...storedDocs];
  const remainingCurrentFiles = [...currentFiles];
  const matches: HashGroupMatch[] = [];

  while (remainingStoredDocs.length > 0 && remainingCurrentFiles.length > 0) {
    const bestCurrentByStored = new Map<string, { currentFile: CurrentFileSnapshot; score: PathScore }>();
    const bestStoredByCurrent = new Map<string, { storedDoc: StoredDocRecord; score: PathScore }>();

    for (const storedDoc of remainingStoredDocs) {
      const candidate = selectUniqueBestCurrent(storedDoc, remainingCurrentFiles);

      if (candidate !== undefined) {
        bestCurrentByStored.set(storedDoc.docId, candidate);
      }
    }

    for (const currentFile of remainingCurrentFiles) {
      const candidate = selectUniqueBestStored(currentFile, remainingStoredDocs);

      if (candidate !== undefined) {
        bestStoredByCurrent.set(currentFile.path, candidate);
      }
    }

    const roundMatches: HashGroupMatch[] = [];

    for (const storedDoc of remainingStoredDocs) {
      const bestCurrent = bestCurrentByStored.get(storedDoc.docId);

      if (bestCurrent === undefined) {
        continue;
      }

      const bestStored = bestStoredByCurrent.get(bestCurrent.currentFile.path);

      if (bestStored?.storedDoc.docId === storedDoc.docId) {
        roundMatches.push({
          storedDoc,
          currentFile: bestCurrent.currentFile,
        });
      }
    }

    if (roundMatches.length === 0) {
      break;
    }

    roundMatches.sort((left, right) => left.storedDoc.docId.localeCompare(right.storedDoc.docId));
    matches.push(...roundMatches);

    const matchedDocIds = new Set(roundMatches.map((match) => match.storedDoc.docId));
    const matchedPaths = new Set(roundMatches.map((match) => match.currentFile.path));

    removeMatchedItems(remainingStoredDocs, matchedDocIds, (item) => item.docId);
    removeMatchedItems(remainingCurrentFiles, matchedPaths, (item) => item.path);
  }

  return {
    matches,
    unmatchedStoredDocs: remainingStoredDocs,
    unmatchedCurrentFiles: remainingCurrentFiles,
  };
}

function selectUniqueBestCurrent(
  storedDoc: StoredDocRecord,
  currentFiles: CurrentFileSnapshot[],
): { currentFile: CurrentFileSnapshot; score: PathScore } | undefined {
  const rankedCandidates = currentFiles
    .map((currentFile) => ({
      currentFile,
      score: scorePathPair(storedDoc.path, currentFile.path),
    }))
    .sort((left, right) => compareScores(left.score, right.score));

  if (rankedCandidates.length === 0) {
    return undefined;
  }

  if (rankedCandidates.length > 1 && compareScores(rankedCandidates[0].score, rankedCandidates[1].score) === 0) {
    return undefined;
  }

  return rankedCandidates[0];
}

function selectUniqueBestStored(
  currentFile: CurrentFileSnapshot,
  storedDocs: StoredDocRecord[],
): { storedDoc: StoredDocRecord; score: PathScore } | undefined {
  const rankedCandidates = storedDocs
    .map((storedDoc) => ({
      storedDoc,
      score: scorePathPair(storedDoc.path, currentFile.path),
    }))
    .sort((left, right) => compareScores(left.score, right.score));

  if (rankedCandidates.length === 0) {
    return undefined;
  }

  if (rankedCandidates.length > 1 && compareScores(rankedCandidates[0].score, rankedCandidates[1].score) === 0) {
    return undefined;
  }

  return rankedCandidates[0];
}

function scorePathPair(oldPath: string, newPath: string): PathScore {
  const sameDirectory = dirname(oldPath) === dirname(newPath);
  const sameBasename = basename(oldPath) === basename(newPath);

  return {
    priority: sameDirectory ? 0 : sameBasename ? 1 : 2,
    basenameDistance: calculateLevenshteinDistance(basename(oldPath), basename(newPath)),
    distance: calculatePathDistance(oldPath, newPath),
  };
}

function compareScores(left: PathScore, right: PathScore): number {
  if (left.priority !== right.priority) {
    return left.priority - right.priority;
  }

  if (left.basenameDistance !== right.basenameDistance) {
    return left.basenameDistance - right.basenameDistance;
  }

  return left.distance - right.distance;
}

function calculatePathDistance(oldPath: string, newPath: string): number {
  const oldSegments = oldPath.split('/');
  const newSegments = newPath.split('/');
  const sharedPrefixLength = countSharedPrefix(oldSegments, newSegments);

  return (oldSegments.length - sharedPrefixLength) + (newSegments.length - sharedPrefixLength);
}

function countSharedPrefix(left: string[], right: string[]): number {
  const maxLength = Math.min(left.length, right.length);
  let index = 0;

  while (index < maxLength && left[index] === right[index]) {
    index += 1;
  }

  return index;
}

function calculateLevenshteinDistance(left: string, right: string): number {
  const previousRow = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    let diagonal = previousRow[0];
    previousRow[0] = leftIndex + 1;

    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      const saved = previousRow[rightIndex + 1];
      const substitutionCost = left[leftIndex] === right[rightIndex] ? 0 : 1;

      previousRow[rightIndex + 1] = Math.min(
        previousRow[rightIndex + 1] + 1,
        previousRow[rightIndex] + 1,
        diagonal + substitutionCost,
      );

      diagonal = saved;
    }
  }

  return previousRow[right.length];
}

function removeMatchedItems<T>(
  items: T[],
  matchedKeys: Set<string>,
  keySelector: (item: T) => string,
): void {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (matchedKeys.has(keySelector(items[index]))) {
      items.splice(index, 1);
    }
  }
}
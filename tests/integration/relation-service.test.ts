import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { SqliteGraphRepository } from '../../src/repositories/index.js';
import { RelationService } from '../../src/services/relation-service.js';
import { RELATION_TYPES } from '../../src/types/index.js';

function createTempProject(): string {
  const projectRoot = mkdtempSync(join(tmpdir(), 'cord-relation-service-'));
  mkdirSync(join(projectRoot, '.cord'), { recursive: true });
  return projectRoot;
}

describe('RelationService integration', () => {
  const createdRoots: string[] = [];

  afterEach(() => {
    for (const projectRoot of createdRoots.splice(0)) {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('通过真实 SQLite 仓储持久化 add → deprecate → remove 全流程', () => {
    const projectRoot = createTempProject();
    createdRoots.push(projectRoot);

    const repository = new SqliteGraphRepository(join(projectRoot, '.cord', 'cord.db'));

    try {
      repository.addDocument({ path: 'docs/a.md', title: 'A', docType: 'story', metadata: {} });
      repository.addDocument({ path: 'docs/b.md', title: 'B', docType: 'story', metadata: {} });

      const service = new RelationService(repository);
      const created = service.addRelation({
        sourcePath: 'docs/a.md',
        targetPath: 'docs/b.md',
        relationType: RELATION_TYPES.REFERENCES,
      });

      expect(repository.getRelationById(created.id)).toMatchObject({
        source: 'manual',
        status: 'active',
        relationType: RELATION_TYPES.REFERENCES,
      });

      const deprecated = service.deprecateRelation({ relationId: created.id });
      expect(repository.getRelationById(created.id)).toMatchObject({
        status: 'deprecated',
        relationType: RELATION_TYPES.REFERENCES,
      });
      expect(deprecated.metadata).toMatchObject({
        history: [
          expect.objectContaining({
            action: 'deprecated',
            previousStatus: 'active',
            nextStatus: 'deprecated',
          }),
        ],
      });

      service.removeRelation({ relationId: created.id });
      expect(repository.getRelationById(created.id)).toBeNull();
    } finally {
      repository.close();
    }
  });
});
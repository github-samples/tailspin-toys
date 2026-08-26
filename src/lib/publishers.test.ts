import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { publishers } from '../../db/schema';
import type { Database } from './db';
import { getAllPublishers } from './publishers';

describe('publishers data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all publishers ordered by name', async () => {
        await db.insert(publishers).values({ name: 'Zed Games', description: 'pub' });
        await db.insert(publishers).values({ name: 'Acme Games', description: 'pub' });

        const all = await getAllPublishers(db);
        expect(all.map((p) => p.name)).toEqual(['Acme Games', 'Zed Games']);
        expect(all[0]).toEqual({ id: expect.any(Number), name: 'Acme Games' });
    });

    it('returns an empty array when there are no publishers', async () => {
        expect(await getAllPublishers(db)).toEqual([]);
    });
});

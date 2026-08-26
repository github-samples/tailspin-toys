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
        // Insert in reverse alphabetical order to test ordering
        await db.insert(publishers).values({ name: 'Zeta Games', description: 'A publisher' });
        await db.insert(publishers).values({ name: 'Alpha Studios', description: 'A publisher' });
        await db.insert(publishers).values({ name: 'Mega Corp', description: 'A publisher' });

        const all = await getAllPublishers(db);

        expect(all).toHaveLength(3);
        expect(all.map((p) => p.name)).toEqual(['Alpha Studios', 'Mega Corp', 'Zeta Games']);
        expect(all[0]).toEqual({ id: expect.any(Number), name: 'Alpha Studios' });
    });

    it('returns empty array when no publishers exist', async () => {
        const all = await getAllPublishers(db);
        expect(all).toEqual([]);
    });

    it('returns only id and name fields', async () => {
        await db.insert(publishers).values({ name: 'Test Publisher', description: 'A test publisher' });

        const all = await getAllPublishers(db);

        expect(all).toHaveLength(1);
        expect(all[0]).toEqual({ id: expect.any(Number), name: 'Test Publisher' });
        expect(all[0]).not.toHaveProperty('description');
    });
});

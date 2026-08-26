/**
 * Tests publisher data-access helpers against an in-memory SQLite database.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { publishers } from '../../db/schema';
import { createTestDatabase } from '../../db/test-helpers';
import type { Database } from './db';
import { getAllPublishers } from './publishers';

describe('publisher data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns publishers ordered by name', async () => {
        await db.insert(publishers).values([
            { name: 'Zeta Games', description: 'z' },
            { name: 'Alpha Games', description: 'a' },
        ]);

        const all = await getAllPublishers(db);

        expect(all.map((publisher) => publisher.name)).toEqual([
            'Alpha Games',
            'Zeta Games',
        ]);
    });

    it('returns an empty list when no publishers exist', async () => {
        expect(await getAllPublishers(db)).toEqual([]);
    });
});

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { asc, eq } from 'drizzle-orm';
import type { Database } from '../src/lib/db';
import { categories, games, publishers } from './schema';
import { seedDatabase } from './seed';
import { createTestDatabase } from './test-helpers';

const HEADER = 'Title,Category,Publisher,Description';

type Fixture = [title: string, category: string, publisher: string, description: string];

const BASE_ROWS: Fixture[] = [
    ['Alpha Quest', 'Strategy', 'Acme Games', 'Alpha description.'],
    ['Beta Racer', 'Racing', 'Acme Games', 'Beta description.'],
    ['Gamma Tactics', 'Strategy', 'Zenith Studios', 'Gamma description.'],
];

describe('seedDatabase', () => {
    let db: Database;
    let dir: string;

    beforeEach(async () => {
        db = await createTestDatabase();
        dir = mkdtempSync(join(tmpdir(), 'seed-test-'));
    });

    afterEach(() => {
        rmSync(dir, { recursive: true, force: true });
    });

    function writeCsv(name: string, rows: Fixture[]): string {
        const lines = rows.map((row) => row.map((value) => `"${value}"`).join(','));
        const path = join(dir, name);
        writeFileSync(path, [HEADER, ...lines].join('\n'), 'utf-8');
        return path;
    }

    async function snapshot() {
        return {
            categories: await db.select().from(categories).orderBy(asc(categories.id)),
            publishers: await db.select().from(publishers).orderBy(asc(publishers.id)),
            games: await db.select().from(games).orderBy(asc(games.id)),
        };
    }

    async function gamesWithRelations() {
        const rows = await db
            .select({
                title: games.title,
                categoryId: games.categoryId,
                publisherId: games.publisherId,
                category: categories.name,
                publisher: publishers.name,
            })
            .from(games)
            .innerJoin(categories, eq(games.categoryId, categories.id))
            .innerJoin(publishers, eq(games.publisherId, publishers.id))
            .orderBy(asc(games.id));
        return rows;
    }

    it('seeds games with the correct reusable category and publisher relationships', async () => {
        await seedDatabase(db, writeCsv('base.csv', BASE_ROWS));

        const snap = await snapshot();
        expect(snap.games).toHaveLength(3);
        expect(snap.categories.map((c) => c.name).sort()).toEqual(['Racing', 'Strategy']);
        expect(snap.publishers.map((p) => p.name).sort()).toEqual(['Acme Games', 'Zenith Studios']);

        const related = await gamesWithRelations();
        expect(related.map((r) => [r.title, r.category, r.publisher])).toEqual([
            ['Alpha Quest', 'Strategy', 'Acme Games'],
            ['Beta Racer', 'Racing', 'Acme Games'],
            ['Gamma Tactics', 'Strategy', 'Zenith Studios'],
        ]);
        // Shared relations are reused rather than duplicated.
        expect(related[0].categoryId).toBe(related[2].categoryId);
        expect(related[0].publisherId).toBe(related[1].publisherId);
        expect(related[0].categoryId).not.toBe(related[1].categoryId);
        expect(related[0].publisherId).not.toBe(related[2].publisherId);
    });

    it('leaves database rows unchanged when the same CSV is seeded twice', async () => {
        const csv = writeCsv('base.csv', BASE_ROWS);
        await seedDatabase(db, csv);
        const first = await snapshot();

        await seedDatabase(db, csv);

        expect(await snapshot()).toEqual(first);
    });

    it('reuses pre-existing categories and publishers by name', async () => {
        const [category] = await db
            .insert(categories)
            .values({ name: 'Strategy', description: 'Pre-existing category' })
            .returning();
        const [publisher] = await db
            .insert(publishers)
            .values({ name: 'Acme Games', description: 'Pre-existing publisher' })
            .returning();

        await seedDatabase(db, writeCsv('one.csv', [BASE_ROWS[0]]));

        const snap = await snapshot();
        expect(snap.categories).toEqual([category]);
        expect(snap.publishers).toEqual([publisher]);
        expect(snap.games).toHaveLength(1);
        expect(snap.games[0].categoryId).toBe(category.id);
        expect(snap.games[0].publisherId).toBe(publisher.id);
    });

    it('adds a new title without changing previously seeded records', async () => {
        await seedDatabase(db, writeCsv('base.csv', BASE_ROWS));
        const before = await snapshot();

        const extended: Fixture[] = [...BASE_ROWS, ['Delta Drift', 'Racing', 'Zenith Studios', 'Delta description.']];
        await seedDatabase(db, writeCsv('extended.csv', extended));

        const after = await snapshot();
        expect(after.categories).toEqual(before.categories);
        expect(after.publishers).toEqual(before.publishers);
        expect(after.games.slice(0, 3)).toEqual(before.games);
        expect(after.games).toHaveLength(4);

        const added = after.games[3];
        expect(added.title).toBe('Delta Drift');
        expect(added.categoryId).toBe(before.categories.find((c) => c.name === 'Racing')!.id);
        expect(added.publisherId).toBe(before.publishers.find((p) => p.name === 'Zenith Studios')!.id);
    });

    it('preserves an existing game when its CSV row changes', async () => {
        await seedDatabase(db, writeCsv('base.csv', BASE_ROWS));
        const before = await snapshot();

        const changed: Fixture[] = [
            ['Alpha Quest', 'Racing', 'Zenith Studios', 'Completely rewritten description.'],
            BASE_ROWS[1],
            BASE_ROWS[2],
        ];
        await seedDatabase(db, writeCsv('changed.csv', changed));

        expect((await snapshot()).games).toEqual(before.games);
    });

    it('does not insert duplicate games for repeated identical CSV titles', async () => {
        await seedDatabase(db, writeCsv('dupes.csv', [BASE_ROWS[0], BASE_ROWS[0]]));

        const snap = await snapshot();
        expect(snap.games.filter((g) => g.title === 'Alpha Quest')).toHaveLength(1);
        expect(snap.games).toHaveLength(1);
    });
});

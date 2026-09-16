import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { categories, publishers, games } from './schema';
import { createTestDatabase } from './test-helpers';
import {
    toCatalogExport,
    serializeCatalogExport,
    writeCatalogExport,
    type CatalogExport,
} from './export-catalog';
import type { Game } from '../src/types/game';
import type { Database } from '../src/lib/db';

function makeGame(overrides: Partial<Game> = {}): Game {
    return {
        id: 1,
        title: 'Merge Conflict',
        description: 'A co-op game about resolving conflicts.',
        starRating: 4.5,
        category: { id: 1, name: 'Strategy' },
        publisher: { id: 1, name: 'Rebase Games' },
        ...overrides,
    };
}

function containsNull(value: unknown): boolean {
    if (value === null) return true;
    if (Array.isArray(value)) return value.some(containsNull);
    if (typeof value === 'object') return Object.values(value).some(containsNull);
    return false;
}

describe('toCatalogExport', () => {
    it('maps a game to a flattened catalog entry', () => {
        const exported: CatalogExport = toCatalogExport([makeGame()]);

        expect(exported.gameCount).toBe(1);
        expect(exported.games[0]).toEqual({
            id: 1,
            title: 'Merge Conflict',
            description: 'A co-op game about resolving conflicts.',
            category: 'Strategy',
            publisher: 'Rebase Games',
            starRating: 4.5,
            ratingLabel: '★★★★½',
        });
    });

    it('sorts games by title regardless of input order', () => {
        const exported = toCatalogExport([
            makeGame({ id: 2, title: 'Zero Downtime' }),
            makeGame({ id: 3, title: 'Async Await' }),
            makeGame({ id: 1, title: 'Merge Conflict' }),
        ]);

        expect(exported.games.map((game) => game.title)).toEqual([
            'Async Await',
            'Merge Conflict',
            'Zero Downtime',
        ]);
    });

    it('sorts by ordinal code unit, not locale-aware alphabetical order', () => {
        // Uppercase code units precede lowercase; accented characters sort after
        // plain ASCII. This locks in the deterministic (non-`localeCompare`)
        // comparator so it can't silently regress back to a locale-sensitive sort.
        const exported = toCatalogExport([
            makeGame({ id: 1, title: 'alpha' }),
            makeGame({ id: 2, title: 'Zebra' }),
            makeGame({ id: 3, title: 'Álpha' }),
            makeGame({ id: 4, title: 'Alpha' }),
        ]);

        expect(exported.games.map((game) => game.title)).toEqual([
            'Alpha',
            'Zebra',
            'alpha',
            'Álpha',
        ]);
    });

    it('breaks ties between identical titles by id', () => {
        const exported = toCatalogExport([
            makeGame({ id: 3, title: 'Same Title' }),
            makeGame({ id: 1, title: 'Same Title' }),
            makeGame({ id: 2, title: 'Same Title' }),
        ]);

        expect(exported.games.map((game) => game.id)).toEqual([1, 2, 3]);
    });

    it('lists distinct categories and publishers alphabetically', () => {
        const exported = toCatalogExport([
            makeGame({ id: 1, category: { id: 2, name: 'Puzzle' }, publisher: { id: 2, name: 'Stack Overflow Studios' } }),
            makeGame({ id: 2, title: 'Second', category: { id: 1, name: 'Strategy' }, publisher: { id: 1, name: 'Rebase Games' } }),
            makeGame({ id: 3, title: 'Third', category: { id: 1, name: 'Strategy' }, publisher: { id: 1, name: 'Rebase Games' } }),
        ]);

        expect(exported.categories).toEqual(['Puzzle', 'Strategy']);
        expect(exported.publishers).toEqual(['Rebase Games', 'Stack Overflow Studios']);
    });

    it('sorts distinct categories/publishers by ordinal code unit', () => {
        const exported = toCatalogExport([
            makeGame({ id: 1, category: { id: 1, name: 'zeta' }, publisher: { id: 1, name: 'zeta' } }),
            makeGame({ id: 2, title: 'Second', category: { id: 2, name: 'Zeta' }, publisher: { id: 2, name: 'Zeta' } }),
            makeGame({ id: 3, title: 'Third', category: { id: 3, name: 'Ínca' }, publisher: { id: 3, name: 'Ínca' } }),
        ]);

        expect(exported.categories).toEqual(['Zeta', 'zeta', 'Ínca']);
        expect(exported.publishers).toEqual(['Zeta', 'zeta', 'Ínca']);
    });

    it('substitutes placeholders for missing relations and omits absent ratings', () => {
        const exported = toCatalogExport([
            makeGame({ category: null, publisher: null, starRating: null }),
        ]);

        const [game] = exported.games;
        expect(game.category).toBe('Uncategorized');
        expect(game.publisher).toBe('Unknown publisher');
        expect(game.starRating).toBeUndefined();
        expect(game.ratingLabel).toBe('Not yet rated');
    });

    it('never emits null values', () => {
        const exported = toCatalogExport([
            makeGame(),
            makeGame({ id: 2, title: 'Nulls Everywhere', category: null, publisher: null, starRating: null }),
        ]);

        expect(containsNull(exported)).toBe(false);
    });

    it('returns an empty catalog for an empty database', () => {
        const exported = toCatalogExport([]);

        expect(exported.gameCount).toBe(0);
        expect(exported.games).toEqual([]);
        expect(exported.categories).toEqual([]);
        expect(exported.publishers).toEqual([]);
    });

    it('is deterministic for the same input', () => {
        const games = [makeGame({ id: 2, title: 'Beta' }), makeGame({ id: 1, title: 'Alpha' })];

        expect(serializeCatalogExport(toCatalogExport(games))).toBe(
            serializeCatalogExport(toCatalogExport(games)),
        );
    });
});

describe('serializeCatalogExport', () => {
    it('produces indented JSON with a trailing newline', () => {
        const output = serializeCatalogExport(toCatalogExport([makeGame()]));

        expect(output.endsWith('}\n')).toBe(true);
        expect(output).toContain('\n  "gameCount": 1');
        expect(JSON.parse(output).games).toHaveLength(1);
    });
});

describe('writeCatalogExport', () => {
    let tempDir: string;

    afterEach(() => {
        if (tempDir) rmSync(tempDir, { recursive: true, force: true });
    });

    it('reads the database and writes the returned catalog to a nested path', async () => {
        const db: Database = await createTestDatabase();
        const [category] = await db
            .insert(categories)
            .values({ name: 'Strategy', description: 'cat' })
            .returning({ id: categories.id });
        const [publisher] = await db
            .insert(publishers)
            .values({ name: 'Rebase Games', description: 'pub' })
            .returning({ id: publishers.id });

        await db.insert(games).values({
            title: 'Merge Conflict',
            description: 'A co-op game about resolving conflicts.',
            starRating: 4.5,
            categoryId: category.id,
            publisherId: publisher.id,
        });

        tempDir = mkdtempSync(join(tmpdir(), 'catalog-export-'));
        const outputPath = join(tempDir, 'nested', 'catalog.json');

        const returned: CatalogExport = await writeCatalogExport(db, outputPath);
        const output = readFileSync(outputPath, 'utf-8');
        const written = JSON.parse(output) as CatalogExport;

        expect(returned.gameCount).toBe(1);
        expect(returned.games[0].title).toBe('Merge Conflict');
        expect(written).toEqual(returned);
        expect(output.endsWith('}\n')).toBe(true);
    });
});

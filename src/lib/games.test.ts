import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllGames,
    getAllGameIds,
    getGameById,
    getGamesByFilters,
} from './games';

async function seedGames(db: Database, count: number): Promise<void> {
    const [category] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [publisher] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });

    // Insert titles in reverse-alphabetical order to prove ordering is applied.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

async function seedFilteredGames(db: Database): Promise<{
    strategyId: number;
    puzzleId: number;
    codeForgeId: number;
    devMastersId: number;
}> {
    const [strategy] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'Strategic games' })
        .returning({ id: categories.id });
    const [puzzle] = await db
        .insert(categories)
        .values({ name: 'Puzzle', description: 'Puzzle games' })
        .returning({ id: categories.id });
    const [codeForge] = await db
        .insert(publishers)
        .values({ name: 'CodeForge Studios', description: 'CodeForge' })
        .returning({ id: publishers.id });
    const [devMasters] = await db
        .insert(publishers)
        .values({ name: 'DevMasters Inc.', description: 'DevMasters' })
        .returning({ id: publishers.id });

    await db.insert(games).values([
        {
            title: 'Game Alpha',
            description: 'Strategy by CodeForge',
            starRating: 4.5,
            categoryId: strategy.id,
            publisherId: codeForge.id,
        },
        {
            title: 'Game Beta',
            description: 'Strategy by DevMasters',
            starRating: 4.1,
            categoryId: strategy.id,
            publisherId: devMasters.id,
        },
        {
            title: 'Game Gamma',
            description: 'Puzzle by CodeForge',
            starRating: 3.8,
            categoryId: puzzle.id,
            publisherId: codeForge.id,
        },
    ]);

    return {
        strategyId: strategy.id,
        puzzleId: puzzle.id,
        codeForgeId: codeForge.id,
        devMastersId: devMasters.id,
    };
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });

    it('filters games by a single category', async () => {
        const { strategyId } = await seedFilteredGames(db);

        const filtered = await getGamesByFilters(db, { categoryIds: [strategyId] });

        expect(filtered.map((game) => game.title)).toEqual(['Game Alpha', 'Game Beta']);
        expect(filtered.every((game) => game.category?.name === 'Strategy')).toBe(true);
    });

    it('filters games by a single publisher', async () => {
        const { codeForgeId } = await seedFilteredGames(db);

        const filtered = await getGamesByFilters(db, { publisherIds: [codeForgeId] });

        expect(filtered.map((game) => game.title)).toEqual(['Game Alpha', 'Game Gamma']);
        expect(filtered.every((game) => game.publisher?.name === 'CodeForge Studios')).toBe(true);
    });

    it('combines category and publisher filters', async () => {
        const { strategyId, codeForgeId } = await seedFilteredGames(db);

        const filtered = await getGamesByFilters(db, {
            categoryIds: [strategyId],
            publisherIds: [codeForgeId],
        });

        expect(filtered).toHaveLength(1);
        expect(filtered[0]).toMatchObject({
            title: 'Game Alpha',
            category: { name: 'Strategy' },
            publisher: { name: 'CodeForge Studios' },
        });
    });
});

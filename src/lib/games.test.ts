import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllGames,
    getAllGameIds,
    getGameById,
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
});

async function seedFilterableGames(db: Database): Promise<{
    strategyId: number;
    puzzleId: number;
    pubOneId: number;
    pubTwoId: number;
}> {
    const [strategy] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [puzzle] = await db
        .insert(categories)
        .values({ name: 'Puzzle', description: 'cat' })
        .returning({ id: categories.id });
    const [pubOne] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });
    const [pubTwo] = await db
        .insert(publishers)
        .values({ name: 'Pub Two', description: 'pub' })
        .returning({ id: publishers.id });

    await db.insert(games).values({
        title: 'Strategy One',
        description: 'd',
        starRating: 4,
        categoryId: strategy.id,
        publisherId: pubOne.id,
    });
    await db.insert(games).values({
        title: 'Strategy Two',
        description: 'd',
        starRating: 4,
        categoryId: strategy.id,
        publisherId: pubTwo.id,
    });
    await db.insert(games).values({
        title: 'Puzzle One',
        description: 'd',
        starRating: 4,
        categoryId: puzzle.id,
        publisherId: pubOne.id,
    });
    await db.insert(games).values({
        title: 'Puzzle Two',
        description: 'd',
        starRating: 4,
        categoryId: puzzle.id,
        publisherId: pubTwo.id,
    });

    return { strategyId: strategy.id, puzzleId: puzzle.id, pubOneId: pubOne.id, pubTwoId: pubTwo.id };
}

describe('getAllGames filtering', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games when no filters are provided', async () => {
        await seedFilterableGames(db);
        expect(await getAllGames(db)).toHaveLength(4);
    });

    it('filters games by a single category', async () => {
        const { strategyId } = await seedFilterableGames(db);
        const filtered = await getAllGames(db, { categoryIds: [strategyId] });
        expect(filtered.map((g) => g.title)).toEqual(['Strategy One', 'Strategy Two']);
    });

    it('filters games by multiple categories (OR within the group)', async () => {
        const { strategyId, puzzleId } = await seedFilterableGames(db);
        const filtered = await getAllGames(db, { categoryIds: [strategyId, puzzleId] });
        expect(filtered).toHaveLength(4);
    });

    it('filters games by publisher', async () => {
        const { pubOneId } = await seedFilterableGames(db);
        const filtered = await getAllGames(db, { publisherIds: [pubOneId] });
        expect(filtered.map((g) => g.title)).toEqual(['Puzzle One', 'Strategy One']);
    });

    it('combines category and publisher filters (AND across groups)', async () => {
        const { strategyId, pubTwoId } = await seedFilterableGames(db);
        const filtered = await getAllGames(db, { categoryIds: [strategyId], publisherIds: [pubTwoId] });
        expect(filtered.map((g) => g.title)).toEqual(['Strategy Two']);
    });

    it('returns an empty array when no games match the combined filters', async () => {
        const { puzzleId, pubOneId } = await seedFilterableGames(db);
        const filtered = await getAllGames(db, { categoryIds: [puzzleId], publisherIds: [pubOneId + 999] });
        expect(filtered).toEqual([]);
    });
});

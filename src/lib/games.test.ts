import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllGames,
    getAllGameIds,
    getGameById,
    getGamesByCategory,
    getGamesByPublisher,
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

    it('filters games by category and publisher', async () => {
        const [strategy] = await db.insert(categories).values({ name: 'Strategy', description: 'Strategy category' }).returning({ id: categories.id });
        const [adventure] = await db.insert(categories).values({ name: 'Adventure', description: 'Adventure category' }).returning({ id: categories.id });
        const [pubOne] = await db.insert(publishers).values({ name: 'Pub One', description: 'pub one' }).returning({ id: publishers.id });
        const [pubTwo] = await db.insert(publishers).values({ name: 'Pub Two', description: 'pub two' }).returning({ id: publishers.id });

        await db.insert(games).values([
            { title: 'Alpha', description: 'Alpha desc', starRating: 4.1, categoryId: strategy.id, publisherId: pubOne.id },
            { title: 'Bravo', description: 'Bravo desc', starRating: 4.3, categoryId: strategy.id, publisherId: pubTwo.id },
            { title: 'Charlie', description: 'Charlie desc', starRating: 4.5, categoryId: adventure.id, publisherId: pubOne.id },
            { title: 'Delta', description: 'Delta desc', starRating: 4.7, categoryId: adventure.id, publisherId: pubTwo.id },
        ]);

        const byCategory = await getGamesByCategory(db, strategy.id);
        expect(byCategory.map((game) => game.title)).toEqual(['Alpha', 'Bravo']);

        const byPublisher = await getGamesByPublisher(db, pubTwo.id);
        expect(byPublisher.map((game) => game.title)).toEqual(['Bravo', 'Delta']);

        const combined = await getAllGames(db, { categoryId: strategy.id, publisherId: pubTwo.id });
        expect(combined.map((game) => game.title)).toEqual(['Bravo']);
    });
});

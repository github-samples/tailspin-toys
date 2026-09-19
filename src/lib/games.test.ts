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

    it('filters games by one or more categories', async () => {
        const [strategy] = await db
            .insert(categories)
            .values({ name: 'Strategy', description: 'strategy' })
            .returning({ id: categories.id });
        const [party] = await db
            .insert(categories)
            .values({ name: 'Party', description: 'party' })
            .returning({ id: categories.id });
        const [publisher] = await db
            .insert(publishers)
            .values({ name: 'Pub One', description: 'pub' })
            .returning({ id: publishers.id });

        await db.insert(games).values([
            {
                title: 'Strategy Game',
                description: 'strategy',
                starRating: 4.2,
                categoryId: strategy.id,
                publisherId: publisher.id,
            },
            {
                title: 'Party Game',
                description: 'party',
                starRating: 4.2,
                categoryId: party.id,
                publisherId: publisher.id,
            },
        ]);

        const filtered = await getAllGames(db, { categoryIds: [party.id] });
        expect(filtered).toHaveLength(1);
        expect(filtered[0].title).toBe('Party Game');

        const multiple = await getAllGames(db, { categoryIds: [strategy.id, party.id] });
        expect(multiple.map((game) => game.title)).toEqual(['Party Game', 'Strategy Game']);
    });

    it('filters games by publisher', async () => {
        const [category] = await db
            .insert(categories)
            .values({ name: 'Strategy', description: 'strategy' })
            .returning({ id: categories.id });
        const [firstPublisher] = await db
            .insert(publishers)
            .values({ name: 'Pub One', description: 'pub one' })
            .returning({ id: publishers.id });
        const [secondPublisher] = await db
            .insert(publishers)
            .values({ name: 'Pub Two', description: 'pub two' })
            .returning({ id: publishers.id });

        await db.insert(games).values([
            {
                title: 'First Game',
                description: 'first',
                starRating: 4.2,
                categoryId: category.id,
                publisherId: firstPublisher.id,
            },
            {
                title: 'Second Game',
                description: 'second',
                starRating: 4.2,
                categoryId: category.id,
                publisherId: secondPublisher.id,
            },
        ]);

        const filtered = await getAllGames(db, { publisherId: secondPublisher.id });
        expect(filtered).toHaveLength(1);
        expect(filtered[0].title).toBe('Second Game');
    });

    it('combines category and publisher filters in title order', async () => {
        const [category] = await db
            .insert(categories)
            .values({ name: 'Strategy', description: 'strategy' })
            .returning({ id: categories.id });
        const [firstPublisher] = await db
            .insert(publishers)
            .values({ name: 'Pub One', description: 'pub one' })
            .returning({ id: publishers.id });
        const [secondPublisher] = await db
            .insert(publishers)
            .values({ name: 'Pub Two', description: 'pub two' })
            .returning({ id: publishers.id });

        await db.insert(games).values([
            {
                title: 'Zeta Game',
                description: 'zeta',
                starRating: 4.2,
                categoryId: category.id,
                publisherId: secondPublisher.id,
            },
            {
                title: 'Alpha Game',
                description: 'alpha',
                starRating: 4.2,
                categoryId: category.id,
                publisherId: secondPublisher.id,
            },
            {
                title: 'Other Publisher Game',
                description: 'other',
                starRating: 4.2,
                categoryId: category.id,
                publisherId: firstPublisher.id,
            },
        ]);

        const filtered = await getAllGames(db, {
            categoryIds: [category.id],
            publisherId: secondPublisher.id,
        });
        expect(filtered.map((game) => game.title)).toEqual(['Alpha Game', 'Zeta Game']);
    });

    it('returns an empty collection when filters match no games', async () => {
        await seedGames(db, 2);
        expect(await getAllGames(db, { publisherId: 99999 })).toEqual([]);
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

import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllGames,
    getAllGameIds,
    getGameById,
    type GameFilters,
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

    describe('filtering', () => {
        it('filters games by single category', async () => {
            const [cat1] = await db
                .insert(categories)
                .values({ name: 'Strategy' })
                .returning({ id: categories.id });
            const [cat2] = await db
                .insert(categories)
                .values({ name: 'Action' })
                .returning({ id: categories.id });
            const [pub] = await db
                .insert(publishers)
                .values({ name: 'Publisher' })
                .returning({ id: publishers.id });

            await db.insert(games).values({
                title: 'Strategy Game',
                description: 'A strategy game',
                categoryId: cat1.id,
                publisherId: pub.id,
            });
            await db.insert(games).values({
                title: 'Action Game',
                description: 'An action game',
                categoryId: cat2.id,
                publisherId: pub.id,
            });

            const filters: GameFilters = { categoryIds: [cat1.id] };
            const filtered = await getAllGames(db, filters);

            expect(filtered).toHaveLength(1);
            expect(filtered[0].title).toBe('Strategy Game');
        });

        it('filters games by multiple categories', async () => {
            const [cat1] = await db
                .insert(categories)
                .values({ name: 'Strategy' })
                .returning({ id: categories.id });
            const [cat2] = await db
                .insert(categories)
                .values({ name: 'Action' })
                .returning({ id: categories.id });
            const [cat3] = await db
                .insert(categories)
                .values({ name: 'Puzzle' })
                .returning({ id: categories.id });
            const [pub] = await db
                .insert(publishers)
                .values({ name: 'Publisher' })
                .returning({ id: publishers.id });

            await db.insert(games).values({
                title: 'Strategy Game',
                description: 'A strategy game',
                categoryId: cat1.id,
                publisherId: pub.id,
            });
            await db.insert(games).values({
                title: 'Action Game',
                description: 'An action game',
                categoryId: cat2.id,
                publisherId: pub.id,
            });
            await db.insert(games).values({
                title: 'Puzzle Game',
                description: 'A puzzle game',
                categoryId: cat3.id,
                publisherId: pub.id,
            });

            const filters: GameFilters = { categoryIds: [cat1.id, cat3.id] };
            const filtered = await getAllGames(db, filters);

            expect(filtered).toHaveLength(2);
            expect(filtered.map((g) => g.title).sort()).toEqual(['Puzzle Game', 'Strategy Game']);
        });

        it('filters games by publisher', async () => {
            const [cat] = await db
                .insert(categories)
                .values({ name: 'Strategy' })
                .returning({ id: categories.id });
            const [pub1] = await db
                .insert(publishers)
                .values({ name: 'Publisher One' })
                .returning({ id: publishers.id });
            const [pub2] = await db
                .insert(publishers)
                .values({ name: 'Publisher Two' })
                .returning({ id: publishers.id });

            await db.insert(games).values({
                title: 'Game from Pub1',
                description: 'A game',
                categoryId: cat.id,
                publisherId: pub1.id,
            });
            await db.insert(games).values({
                title: 'Another Game from Pub1',
                description: 'Another game',
                categoryId: cat.id,
                publisherId: pub1.id,
            });
            await db.insert(games).values({
                title: 'Game from Pub2',
                description: 'A game',
                categoryId: cat.id,
                publisherId: pub2.id,
            });

            const filters: GameFilters = { publisherId: pub1.id };
            const filtered = await getAllGames(db, filters);

            expect(filtered).toHaveLength(2);
            expect(filtered.every((g) => g.publisher?.id === pub1.id)).toBe(true);
        });

        it('filters games by both category and publisher', async () => {
            const [cat1] = await db
                .insert(categories)
                .values({ name: 'Strategy' })
                .returning({ id: categories.id });
            const [cat2] = await db
                .insert(categories)
                .values({ name: 'Action' })
                .returning({ id: categories.id });
            const [pub1] = await db
                .insert(publishers)
                .values({ name: 'Publisher One' })
                .returning({ id: publishers.id });
            const [pub2] = await db
                .insert(publishers)
                .values({ name: 'Publisher Two' })
                .returning({ id: publishers.id });

            await db.insert(games).values({
                title: 'Strategy from Pub1',
                description: 'A game',
                categoryId: cat1.id,
                publisherId: pub1.id,
            });
            await db.insert(games).values({
                title: 'Action from Pub1',
                description: 'A game',
                categoryId: cat2.id,
                publisherId: pub1.id,
            });
            await db.insert(games).values({
                title: 'Strategy from Pub2',
                description: 'A game',
                categoryId: cat1.id,
                publisherId: pub2.id,
            });

            const filters: GameFilters = { categoryIds: [cat1.id], publisherId: pub1.id };
            const filtered = await getAllGames(db, filters);

            expect(filtered).toHaveLength(1);
            expect(filtered[0].title).toBe('Strategy from Pub1');
        });

        it('returns all games when no filters are provided', async () => {
            await seedGames(db, 3);
            const all = await getAllGames(db);
            const filtered = await getAllGames(db, {});

            expect(filtered).toEqual(all);
        });

        it('returns empty array when filters match no games', async () => {
            const [cat] = await db
                .insert(categories)
                .values({ name: 'Strategy' })
                .returning({ id: categories.id });
            const [pub] = await db
                .insert(publishers)
                .values({ name: 'Publisher' })
                .returning({ id: publishers.id });

            await db.insert(games).values({
                title: 'Game',
                description: 'A game',
                categoryId: cat.id,
                publisherId: pub.id,
            });

            const filters: GameFilters = { categoryIds: [99999] };
            const filtered = await getAllGames(db, filters);

            expect(filtered).toEqual([]);
        });
    });
});

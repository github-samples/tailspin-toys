import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllGames,
    getAllGameIds,
    getGameById,
    getFilteredGames,
} from './games';

interface FilterFixtureIds {
    strategy: number;
    puzzle: number;
    simulation: number;
    publisherOne: number;
    publisherTwo: number;
}

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

async function seedFilterGames(db: Database): Promise<FilterFixtureIds> {
    const [strategy, puzzle, simulation] = await db
        .insert(categories)
        .values([
            { name: 'Strategy', description: 'Strategy games' },
            { name: 'Puzzle', description: 'Puzzle games' },
            { name: 'Simulation', description: 'Simulation games' },
        ])
        .returning({ id: categories.id });
    const [publisherOne, publisherTwo] = await db
        .insert(publishers)
        .values([
            { name: 'Publisher One', description: 'First publisher' },
            { name: 'Publisher Two', description: 'Second publisher' },
        ])
        .returning({ id: publishers.id });

    await db.insert(games).values([
        {
            title: 'Alpha Strategy',
            description: 'First strategy game',
            starRating: 4.1,
            categoryId: strategy.id,
            publisherId: publisherOne.id,
        },
        {
            title: 'Bravo Puzzle',
            description: 'First puzzle game',
            starRating: 4.2,
            categoryId: puzzle.id,
            publisherId: publisherOne.id,
        },
        {
            title: 'Charlie Strategy',
            description: 'Second strategy game',
            starRating: 4.3,
            categoryId: strategy.id,
            publisherId: publisherTwo.id,
        },
        {
            title: 'Delta Simulation',
            description: 'First simulation game',
            starRating: 4.4,
            categoryId: simulation.id,
            publisherId: publisherTwo.id,
        },
    ]);

    return {
        strategy: strategy.id,
        puzzle: puzzle.id,
        simulation: simulation.id,
        publisherOne: publisherOne.id,
        publisherTwo: publisherTwo.id,
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

    it('filters games by one category', async () => {
        const fixture = await seedFilterGames(db);

        const filtered = await getFilteredGames(db, {
            categoryIds: [fixture.strategy],
        });

        expect(filtered.map((game) => game.title)).toEqual([
            'Alpha Strategy',
            'Charlie Strategy',
        ]);
    });

    it('matches any of multiple selected categories', async () => {
        const fixture = await seedFilterGames(db);

        const filtered = await getFilteredGames(db, {
            categoryIds: [fixture.strategy, fixture.puzzle],
        });

        expect(filtered.map((game) => game.title)).toEqual([
            'Alpha Strategy',
            'Bravo Puzzle',
            'Charlie Strategy',
        ]);
    });

    it('filters games by publisher', async () => {
        const fixture = await seedFilterGames(db);

        const filtered = await getFilteredGames(db, {
            publisherId: fixture.publisherTwo,
        });

        expect(filtered.map((game) => game.title)).toEqual([
            'Charlie Strategy',
            'Delta Simulation',
        ]);
    });

    it('combines category and publisher filters', async () => {
        const fixture = await seedFilterGames(db);

        const filtered = await getFilteredGames(db, {
            categoryIds: [fixture.strategy, fixture.puzzle],
            publisherId: fixture.publisherTwo,
        });

        expect(filtered.map((game) => game.title)).toEqual(['Charlie Strategy']);
    });

    it('treats an empty category selection as unfiltered', async () => {
        await seedFilterGames(db);

        const filtered = await getFilteredGames(db, { categoryIds: [] });

        expect(filtered.map((game) => game.title)).toEqual([
            'Alpha Strategy',
            'Bravo Puzzle',
            'Charlie Strategy',
            'Delta Simulation',
        ]);
    });

    it('returns an empty collection when no games match', async () => {
        const fixture = await seedFilterGames(db);

        const filtered = await getFilteredGames(db, {
            categoryIds: [fixture.simulation],
            publisherId: fixture.publisherOne,
        });

        expect(filtered).toEqual([]);
    });
});

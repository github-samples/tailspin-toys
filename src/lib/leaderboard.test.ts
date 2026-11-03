import { describe, it, expect } from 'vitest';
import { buildLeaderboard, listGenres } from './leaderboard';
import type { Game } from '../types/game';

const action = { id: 1, name: 'Action' };
const puzzle = { id: 2, name: 'Puzzle' };

function makeGame(overrides: Partial<Game> & Pick<Game, 'id' | 'title'>): Game {
    return {
        description: '',
        publisher: null,
        category: null,
        starRating: null,
        ...overrides,
    };
}

describe('buildLeaderboard', () => {
    it('returns an empty list for no games', () => {
        expect(buildLeaderboard([])).toEqual([]);
    });

    it('orders rated games by star rating, highest first', () => {
        const result = buildLeaderboard([
            makeGame({ id: 1, title: 'Low', starRating: 2 }),
            makeGame({ id: 2, title: 'High', starRating: 4.5 }),
            makeGame({ id: 3, title: 'Mid', starRating: 3 }),
        ]);

        expect(result.map((game) => game.title)).toEqual(['High', 'Mid', 'Low']);
        expect(result.map((game) => game.rank)).toEqual([1, 2, 3]);
    });

    it('gives tied games a shared competition rank and skips the next rank', () => {
        const result = buildLeaderboard([
            makeGame({ id: 1, title: 'A', starRating: 5 }),
            makeGame({ id: 2, title: 'B', starRating: 4 }),
            makeGame({ id: 3, title: 'C', starRating: 4 }),
            makeGame({ id: 4, title: 'D', starRating: 3 }),
        ]);

        expect(result.map((game) => game.rank)).toEqual([1, 2, 2, 4]);
    });

    it('breaks rating ties alphabetically by title', () => {
        const result = buildLeaderboard([
            makeGame({ id: 1, title: 'Zebra', starRating: 4 }),
            makeGame({ id: 2, title: 'Apple', starRating: 4 }),
        ]);

        expect(result.map((game) => game.title)).toEqual(['Apple', 'Zebra']);
    });

    it('places unrated games last, sorted by title, with a null rank', () => {
        const result = buildLeaderboard([
            makeGame({ id: 1, title: 'Unrated B' }),
            makeGame({ id: 2, title: 'Rated', starRating: 1 }),
            makeGame({ id: 3, title: 'Unrated A' }),
        ]);

        expect(result.map((game) => game.title)).toEqual(['Rated', 'Unrated A', 'Unrated B']);
        expect(result.map((game) => game.rank)).toEqual([1, null, null]);
    });

    it('filters to a single category when a category id is given', () => {
        const games = [
            makeGame({ id: 1, title: 'Shooter', starRating: 5, category: action }),
            makeGame({ id: 2, title: 'Sliding', starRating: 3, category: puzzle }),
            makeGame({ id: 3, title: 'Uncategorised', starRating: 4 }),
        ];

        const result = buildLeaderboard(games, puzzle.id);

        expect(result.map((game) => game.title)).toEqual(['Sliding']);
        expect(result[0].rank).toBe(1);
    });

    it('returns an empty list when no games match the category', () => {
        expect(buildLeaderboard([makeGame({ id: 1, title: 'X', category: action })], 999)).toEqual([]);
    });

    it('does not mutate the input array', () => {
        const games = [
            makeGame({ id: 1, title: 'B', starRating: 1 }),
            makeGame({ id: 2, title: 'A', starRating: 5 }),
        ];
        const snapshot = games.map((game) => game.id);

        buildLeaderboard(games);

        expect(games.map((game) => game.id)).toEqual(snapshot);
    });
});

describe('listGenres', () => {
    it('returns distinct categories ordered by name', () => {
        const genres = listGenres([
            makeGame({ id: 1, title: 'A', category: puzzle }),
            makeGame({ id: 2, title: 'B', category: action }),
            makeGame({ id: 3, title: 'C', category: puzzle }),
            makeGame({ id: 4, title: 'D' }),
        ]);

        expect(genres).toEqual([action, puzzle]);
    });

    it('returns an empty list when no game has a category', () => {
        expect(listGenres([makeGame({ id: 1, title: 'A' })])).toEqual([]);
    });
});

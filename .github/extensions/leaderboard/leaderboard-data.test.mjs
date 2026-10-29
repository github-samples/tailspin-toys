import { describe, expect, it } from 'vitest';
import { rankGames } from './leaderboard-data.mjs';

describe('rankGames', () => {
    it('sorts ratings descending and shares ranks for ties', () => {
        const games = [
            { id: 1, title: 'Gamma', publisher: 'Studio A', category: 'Action', score: 4.2 },
            { id: 2, title: 'Beta', publisher: 'Studio B', category: 'Puzzle', score: 5 },
            { id: 3, title: 'Alpha', publisher: 'Studio C', category: 'Strategy', score: 4.2 },
            { id: 4, title: 'Delta', publisher: 'Studio D', category: 'Action', score: 3.1 },
        ];

        expect(rankGames(games).map(({ title, rank }) => [title, rank])).toEqual([
            ['Beta', 1],
            ['Alpha', 2],
            ['Gamma', 2],
            ['Delta', 4],
        ]);
    });

    it('places unrated games after rated games without assigning a rank', () => {
        const games = [
            { id: 1, title: 'Unrated', publisher: 'Studio A', category: 'Action', score: null },
            { id: 2, title: 'Rated', publisher: 'Studio B', category: 'Puzzle', score: 3.5 },
        ];

        expect(rankGames(games).map(({ title, rank }) => [title, rank])).toEqual([
            ['Rated', 1],
            ['Unrated', null],
        ]);
    });

    it('returns an empty list for an empty catalog without changing the input', () => {
        const games = [];

        expect(rankGames(games)).toEqual([]);
        expect(games).toEqual([]);
    });
});

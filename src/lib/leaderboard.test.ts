import { describe, it, expect } from 'vitest';
import { rankGames, type LeaderboardGame } from '../../.github/extensions/game-leaderboard/ranking.mjs';

function game(id: number, title: string, starRating: number | null, genre: string | null = 'Puzzle'): LeaderboardGame {
    return { id, title, starRating, genre, publisher: 'Acme' };
}

describe('rankGames', () => {
    it('ranks by star rating descending', () => {
        const ranked = rankGames([game(1, 'A', 3.5), game(2, 'B', 4.5), game(3, 'C', 4.0)]);
        expect(ranked.map((g) => g.title)).toEqual(['B', 'C', 'A']);
        expect(ranked.map((g) => g.rank)).toEqual([1, 2, 3]);
    });

    it('gives tied games the same rank and skips the next rank', () => {
        const ranked = rankGames([game(1, 'A', 5), game(2, 'B', 4), game(3, 'C', 4), game(4, 'D', 3)]);
        expect(ranked.map((g) => g.rank)).toEqual([1, 2, 2, 4]);
    });

    it('places unrated games last without a rank', () => {
        const ranked = rankGames([game(1, 'A', null), game(2, 'B', 2), game(3, 'C', null)]);
        expect(ranked.map((g) => g.title)).toEqual(['B', 'A', 'C']);
        expect(ranked.map((g) => g.rank)).toEqual([1, null, null]);
    });

    it('filters by genre case-insensitively and ranks within the filter', () => {
        const ranked = rankGames(
            [game(1, 'A', 5, 'Action'), game(2, 'B', 4, 'Puzzle'), game(3, 'C', 3, 'puzzle')],
            'PUZZLE',
        );
        expect(ranked.map((g) => [g.title, g.rank])).toEqual([['B', 1], ['C', 2]]);
    });

    it('returns an empty list for an unknown genre or no games', () => {
        expect(rankGames([game(1, 'A', 5)], 'Nope')).toEqual([]);
        expect(rankGames([])).toEqual([]);
    });

    it('is deterministic for ties and does not mutate input', () => {
        const input = [game(2, 'B', 4), game(1, 'A', 4)];
        const copy = [...input];
        expect(rankGames(input).map((g) => g.title)).toEqual(['A', 'B']);
        expect(input).toEqual(copy);
    });
});

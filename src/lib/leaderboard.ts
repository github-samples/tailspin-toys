/**
 * Pure ranking helpers for the game leaderboard.
 *
 * Ranks games by their existing star rating. Ratings are not gameplay scores
 * or popularity measures. Tied games share a competition rank (1, 2, 2, 4),
 * and unrated games are listed last without a rank. Framework-free so the
 * logic is unit-testable (see `leaderboard.test.ts`).
 */
import type { Category, Game } from '../types/game';

/** A game placed on the leaderboard. `rank` is null for unrated games. */
export interface LeaderboardEntry extends Game {
    rank: number | null;
}

/**
 * Orders games by star rating (highest first), then title. Games with a
 * rating share a competition rank; unrated games follow with a null rank.
 * When `categoryId` is provided, only games in that category are included.
 */
export function buildLeaderboard(games: Game[], categoryId: number | null = null): LeaderboardEntry[] {
    const filtered = categoryId === null ? games : games.filter((game) => game.category?.id === categoryId);

    const rated = filtered
        .filter((game): game is Game & { starRating: number } => game.starRating !== null)
        .sort((a, b) => b.starRating - a.starRating || a.title.localeCompare(b.title));
    const unrated = filtered
        .filter((game) => game.starRating === null)
        .sort((a, b) => a.title.localeCompare(b.title));

    const ranked: LeaderboardEntry[] = [];
    rated.forEach((game, index) => {
        const previous = ranked[index - 1];
        const rank = previous && previous.starRating === game.starRating ? previous.rank : index + 1;
        ranked.push({ ...game, rank });
    });

    return [...ranked, ...unrated.map((game) => ({ ...game, rank: null }))];
}

/** Distinct categories (genres) present in the games, ordered by name. */
export function listGenres(games: Game[]): Category[] {
    const byId = new Map<number, Category>();
    for (const game of games) {
        if (game.category && !byId.has(game.category.id)) {
            byId.set(game.category.id, game.category);
        }
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

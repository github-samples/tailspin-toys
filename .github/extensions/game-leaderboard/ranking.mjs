/**
 * @typedef {{ id: number, title: string, starRating: number | null, genre: string | null, publisher: string | null }} LeaderboardGame
 * @typedef {LeaderboardGame & { rank: number | null }} LeaderboardEntry
 */

/**
 * Rank games by star rating (highest first) using competition ranking
 * (e.g. 1, 2, 2, 4). Unrated games are placed last with no rank.
 * Ordering is deterministic: ties are ordered by title, then id.
 *
 * @param {LeaderboardGame[]} games
 * @param {string} [genre] Case-insensitive genre (category name) filter.
 * @returns {LeaderboardEntry[]}
 */
export function rankGames(games, genre) {
    const wanted = genre?.trim().toLowerCase();
    const filtered = wanted ? games.filter((game) => game.genre?.toLowerCase() === wanted) : [...games];

    filtered.sort((a, b) => {
        if (a.starRating === null && b.starRating !== null) return 1;
        if (a.starRating !== null && b.starRating === null) return -1;
        if (a.starRating !== null && b.starRating !== null && a.starRating !== b.starRating) {
            return b.starRating - a.starRating;
        }
        return a.title.localeCompare(b.title) || a.id - b.id;
    });

    let lastRating = null;
    let lastRank = 0;
    return filtered.map((game, index) => {
        if (game.starRating === null) {
            return { ...game, rank: null };
        }
        if (game.starRating !== lastRating) {
            lastRating = game.starRating;
            lastRank = index + 1;
        }
        return { ...game, rank: lastRank };
    });
}

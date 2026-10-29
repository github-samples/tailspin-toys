/**
 * @typedef {{
 *   id: number;
 *   title: string;
 *   publisher: string;
 *   category: string;
 *   score: number | null;
 * }} LeaderboardGame
 */

/**
 * Sorts games by rating, gives tied ratings the same competition rank, and
 * leaves unrated games at the end without assigning them a rank.
 *
 * @param {LeaderboardGame[]} games
 * @returns {(LeaderboardGame & { rank: number | null })[]}
 */
export function rankGames(games) {
    const orderedGames = [...games].sort((left, right) => {
        if (left.score === null && right.score !== null) return 1;
        if (left.score !== null && right.score === null) return -1;
        if (left.score !== null && right.score !== null && left.score !== right.score) {
            return right.score - left.score;
        }

        return left.title.localeCompare(right.title) || left.id - right.id;
    });

    let ratedPosition = 0;
    let currentRank = 0;
    let previousScore = null;

    return orderedGames.map((game) => {
        if (game.score === null) {
            return { ...game, rank: null };
        }

        ratedPosition += 1;
        if (game.score !== previousScore) {
            currentRank = ratedPosition;
            previousScore = game.score;
        }

        return { ...game, rank: currentRank };
    });
}

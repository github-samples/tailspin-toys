export interface LeaderboardGame {
    id: number;
    title: string;
    starRating: number | null;
    genre: string | null;
    publisher: string | null;
}

export interface LeaderboardEntry extends LeaderboardGame {
    rank: number | null;
}

export function rankGames(games: LeaderboardGame[], genre?: string): LeaderboardEntry[];

import { and, asc, eq, inArray, type SQL } from 'drizzle-orm';
import type { Database } from './db';
import { games, categories, publishers } from '../../db/schema';
import type { Game } from '../types/game';

/** Optional category and publisher constraints for game listings. */
export interface GameFilters {
    /** Category IDs to include. An empty array does not filter by category. */
    categoryIds?: number[];
    /** Publisher ID to include. */
    publisherId?: number;
}

const gameSelection = {
    id: games.id,
    title: games.title,
    description: games.description,
    starRating: games.starRating,
    categoryId: categories.id,
    categoryName: categories.name,
    publisherId: publishers.id,
    publisherName: publishers.name,
};

type GameSelectionRow = {
    id: number;
    title: string;
    description: string;
    starRating: number | null;
    categoryId: number | null;
    categoryName: string | null;
    publisherId: number | null;
    publisherName: string | null;
};

function mapGame(row: GameSelectionRow): Game {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        starRating: row.starRating,
        category:
            row.categoryId !== null && row.categoryName !== null
                ? { id: row.categoryId, name: row.categoryName }
                : null,
        publisher:
            row.publisherId !== null && row.publisherName !== null
                ? { id: row.publisherId, name: row.publisherName }
                : null,
    };
}

function baseGamesQuery(db: Database) {
    return db
        .select(gameSelection)
        .from(games)
        .leftJoin(categories, eq(games.categoryId, categories.id))
        .leftJoin(publishers, eq(games.publisherId, publishers.id));
}

/**
 * Retrieves games ordered by title, optionally filtered by category and publisher.
 *
 * @param db - The injectable Drizzle database connection to query.
 * @param filters - Optional category and publisher constraints.
 * @returns A promise containing matching games with their related category and publisher.
 */
export async function getAllGames(db: Database, filters: GameFilters = {}): Promise<Game[]> {
    const conditions: SQL[] = [];

    if (filters.categoryIds && filters.categoryIds.length > 0) {
        conditions.push(inArray(games.categoryId, filters.categoryIds));
    }

    if (filters.publisherId !== undefined) {
        conditions.push(eq(games.publisherId, filters.publisherId));
    }

    const query = baseGamesQuery(db);
    const rows = await (conditions.length > 0 ? query.where(and(...conditions)) : query)
        .orderBy(asc(games.title));
    return rows.map(mapGame);
}

/**
 * Retrieves all game IDs ordered by their corresponding game titles.
 *
 * @param db - The injectable Drizzle database connection to query.
 * @returns A promise containing game IDs in title order.
 */
export async function getAllGameIds(db: Database): Promise<number[]> {
    const rows = await db.select({ id: games.id }).from(games).orderBy(asc(games.title));
    return rows.map((row) => row.id);
}

/**
 * Retrieves one game by ID.
 *
 * @param db - The injectable Drizzle database connection to query.
 * @param id - The game ID to find.
 * @returns A promise containing the matching game, or null when no game exists for the ID.
 */
export async function getGameById(db: Database, id: number): Promise<Game | null> {
    const row = await baseGamesQuery(db).where(eq(games.id, id)).get();
    return row ? mapGame(row) : null;
}

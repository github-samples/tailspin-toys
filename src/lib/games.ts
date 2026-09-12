import { and, asc, eq, inArray } from 'drizzle-orm';
import type { Database } from './db';
import { games, categories, publishers } from '../../db/schema';
import type { Game } from '../types/game';

/** Criteria used to narrow the game catalog. */
export interface GameFilters {
    /** Category identifiers matched with OR semantics. */
    categoryIds?: readonly number[];
    /** Publisher identifier combined with the category criteria using AND. */
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
 * Loads every game with its category and publisher in title order.
 *
 * @param db - Injectable database supplied by an Astro page or a test.
 * @returns Games mapped to the application model in deterministic title order.
 */
export async function getAllGames(db: Database): Promise<Game[]> {
    return getFilteredGames(db);
}

/**
 * Loads games matching optional category and publisher criteria.
 *
 * Selected categories use OR semantics, while a publisher criterion is
 * combined with the categories using AND. Empty criteria return every game.
 *
 * @param db - Injectable database supplied by an Astro page or a test.
 * @param filters - Optional category identifiers and publisher identifier.
 * @returns Matching games mapped to the application model in title order.
 */
export async function getFilteredGames(
    db: Database,
    filters: GameFilters = {},
): Promise<Game[]> {
    const categoryCondition = filters.categoryIds && filters.categoryIds.length > 0
        ? inArray(games.categoryId, [...filters.categoryIds])
        : undefined;
    const publisherCondition = filters.publisherId === undefined
        ? undefined
        : eq(games.publisherId, filters.publisherId);
    const condition = and(categoryCondition, publisherCondition);
    const query = baseGamesQuery(db);
    const rows = condition
        ? await query.where(condition).orderBy(asc(games.title))
        : await query.orderBy(asc(games.title));

    return rows.map(mapGame);
}

/**
 * Loads game identifiers in title order for static route generation.
 *
 * @param db - Injectable database supplied by an Astro page or a test.
 * @returns Game identifiers in deterministic title order.
 */
export async function getAllGameIds(db: Database): Promise<number[]> {
    const rows = await db.select({ id: games.id }).from(games).orderBy(asc(games.title));
    return rows.map((row) => row.id);
}

/**
 * Loads one game and its related category and publisher.
 *
 * @param db - Injectable database supplied by an Astro page or a test.
 * @param id - Numeric identifier of the game to retrieve.
 * @returns The mapped game, or `null` when no matching game exists.
 */
export async function getGameById(db: Database, id: number): Promise<Game | null> {
    const row = await baseGamesQuery(db).where(eq(games.id, id)).get();
    return row ? mapGame(row) : null;
}

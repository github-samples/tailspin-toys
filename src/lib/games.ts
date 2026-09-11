import { eq, asc, and, inArray } from 'drizzle-orm';
import type { Database } from './db';
import { games, categories, publishers } from '../../db/schema';
import type { Game } from '../types/game';

export interface GameFilters {
    categoryId?: number | null;
    publisherId?: number | null;
    categoryIds?: number[];
    publisherIds?: number[];
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

function normalizeFilterIds(values: number | number[] | null | undefined): number[] | undefined {
    if (values === undefined || values === null) {
        return undefined;
    }

    const ids = Array.isArray(values) ? values : [values];
    const filtered = ids.filter((id): id is number => typeof id === 'number' && Number.isFinite(id) && id > 0);
    return filtered.length > 0 ? filtered : undefined;
}

function buildGameFilters(filters: GameFilters = {}): ReturnType<typeof and> | undefined {
    const clauses = [] as Parameters<typeof and>[0][];
    const categoryIds = normalizeFilterIds(filters.categoryId ?? filters.categoryIds);
    const publisherIds = normalizeFilterIds(filters.publisherId ?? filters.publisherIds);

    if (categoryIds) {
        clauses.push(inArray(games.categoryId, categoryIds));
    }

    if (publisherIds) {
        clauses.push(inArray(games.publisherId, publisherIds));
    }

    return clauses.length > 0 ? and(...clauses) : undefined;
}

/** All games ordered by title. */
export async function getAllGames(db: Database, filters: GameFilters = {}): Promise<Game[]> {
    const query = baseGamesQuery(db);
    const whereClause = buildGameFilters(filters);
    if (whereClause) {
        query.where(whereClause);
    }

    const rows = await query.orderBy(asc(games.title));
    return rows.map(mapGame);
}

/** All games in a single category ordered by title. */
export async function getGamesByCategory(db: Database, categoryId: number): Promise<Game[]> {
    return getAllGames(db, { categoryId });
}

/** All games from a single publisher ordered by title. */
export async function getGamesByPublisher(db: Database, publisherId: number): Promise<Game[]> {
    return getAllGames(db, { publisherId });
}

/** All game ids ordered by title. */
export async function getAllGameIds(db: Database): Promise<number[]> {
    const rows = await db.select({ id: games.id }).from(games).orderBy(asc(games.title));
    return rows.map((row) => row.id);
}

/** A single game by id, or null when it does not exist. */
export async function getGameById(db: Database, id: number): Promise<Game | null> {
    const row = await baseGamesQuery(db).where(eq(games.id, id)).get();
    return row ? mapGame(row) : null;
}

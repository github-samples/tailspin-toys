/**
 * Provides build-time data-access helpers for publisher records.
 */
import { asc } from 'drizzle-orm';
import type { Database } from './db';
import { publishers } from '../../db/schema';
import type { Publisher } from '../types/game';

/**
 * Retrieves all publishers ordered by name.
 *
 * @param db - The injectable Drizzle database client.
 * @returns All publishers mapped to the app-facing publisher type.
 */
export async function getAllPublishers(db: Database): Promise<Publisher[]> {
    const rows = await db
        .select({
            id: publishers.id,
            name: publishers.name,
        })
        .from(publishers)
        .orderBy(asc(publishers.name));

    return rows.map((row) => ({ id: row.id, name: row.name }));
}

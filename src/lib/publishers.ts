/**
 * Provides build-time data-access helpers for publisher summaries.
 */
import { asc } from 'drizzle-orm';
import { publishers } from '../../db/schema';
import type { Database } from './db';
import type { Publisher } from '../types/game';

/**
 * Retrieves all publisher summaries in deterministic name order.
 *
 * @param db - The Drizzle database client to query.
 * @returns A promise that resolves to publisher summaries ordered by name.
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

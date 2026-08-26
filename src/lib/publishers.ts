import { asc } from 'drizzle-orm';
import type { Publisher } from '../types/game';
import { publishers } from '../../db/schema';
import type { Database } from './db';

/**
 * Returns all publishers with their IDs and names, ordered by name.
 *
 * @param db - The database connection to query.
 * @returns The publishers' IDs and names.
 */
export async function getAllPublishers(db: Database): Promise<Publisher[]> {
    return db
        .select({ id: publishers.id, name: publishers.name })
        .from(publishers)
        .orderBy(asc(publishers.name));
}
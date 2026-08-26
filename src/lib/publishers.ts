import { asc } from 'drizzle-orm';
import { publishers } from '../../db/schema';
import type { Publisher } from '../types/game';
import type { Database } from './db';

/**
 * Return every publisher with its id and name, ordered alphabetically.
 *
 * @param db Injectable Drizzle database client.
 * @returns Publishers containing only their ids and names.
 */
export async function getAllPublishers(db: Database): Promise<Publisher[]> {
    return db
        .select({ id: publishers.id, name: publishers.name })
        .from(publishers)
        .orderBy(asc(publishers.name));
}
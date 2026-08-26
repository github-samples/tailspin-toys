import { asc } from 'drizzle-orm';
import type { Publisher } from '../types/game';
import { publishers } from '../../db/schema';
import type { Database } from './db';

/** All publishers ordered by name. */
export async function getAllPublishers(db: Database): Promise<Publisher[]> {
    return db
        .select({ id: publishers.id, name: publishers.name })
        .from(publishers)
        .orderBy(asc(publishers.name));
}
// Data-access helpers for reading publisher records.
import { asc } from 'drizzle-orm';
import { publishers } from '../../db/schema';
import type { Database } from './db';
import type { Publisher } from '../types/game';

/** All publishers ordered by name. */
export async function getAllPublishers(db: Database): Promise<Publisher[]> {
    return db.select({ id: publishers.id, name: publishers.name }).from(publishers).orderBy(asc(publishers.name));
}
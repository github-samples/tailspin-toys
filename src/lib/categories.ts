import { asc } from 'drizzle-orm';
import type { Category } from '../types/game';
import { categories } from '../../db/schema';
import type { Database } from './db';

/**
 * Returns all categories with their IDs and names, ordered by name.
 *
 * @param db - The database connection to query.
 * @returns The categories' IDs and names.
 */
export async function getAllCategories(db: Database): Promise<Category[]> {
    return db
        .select({ id: categories.id, name: categories.name })
        .from(categories)
        .orderBy(asc(categories.name));
}

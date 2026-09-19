/**
 * Provides build-time data-access helpers for category records.
 */
import { asc } from 'drizzle-orm';
import type { Database } from './db';
import { categories } from '../../db/schema';
import type { Category } from '../types/game';

/**
 * Retrieves all categories ordered by name.
 *
 * @param db - The injectable Drizzle database client.
 * @returns All categories mapped to the app-facing category type.
 */
export async function getAllCategories(db: Database): Promise<Category[]> {
    const rows = await db
        .select({
            id: categories.id,
            name: categories.name,
        })
        .from(categories)
        .orderBy(asc(categories.name));

    return rows.map((row) => ({ id: row.id, name: row.name }));
}

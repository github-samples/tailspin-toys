/**
 * Data-access helpers for category summary records used by Astro pages.
 */

import { asc } from 'drizzle-orm';
import type { Database } from './db';
import { categories } from '../../db/schema';
import type { Category } from '../types/game';

type CategorySummaryRow = {
    id: number;
    name: string;
};

/**
 * Returns all categories ordered by name.
 *
 * @param db - Drizzle database client.
 * @returns A list of category summaries including only `id` and `name`.
 */
export async function getAllCategories(db: Database): Promise<Category[]> {
    const rows = await db
        .select({ id: categories.id, name: categories.name })
        .from(categories)
        .orderBy(asc(categories.name));

    return rows.map((row: CategorySummaryRow) => ({
        id: row.id,
        name: row.name,
    }));
}

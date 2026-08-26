/**
 * Data-access helpers for publisher summary records used by Astro pages.
 */

import { asc } from 'drizzle-orm';
import type { Database } from './db';
import { publishers } from '../../db/schema';
import type { Publisher } from '../types/game';

type PublisherSummaryRow = {
    id: number;
    name: string;
};

/**
 * Returns all publishers ordered by name.
 *
 * @param db - Drizzle database client.
 * @returns A list of publisher summaries including only `id` and `name`.
 */
export async function getAllPublishers(db: Database): Promise<Publisher[]> {
    const rows = await db
        .select({ id: publishers.id, name: publishers.name })
        .from(publishers)
        .orderBy(asc(publishers.name));

    return rows.map((row: PublisherSummaryRow) => ({
        id: row.id,
        name: row.name,
    }));
}

/**
 * Provides database fixtures for data-layer tests.
 */

import { migrate } from 'drizzle-orm/sqlite-proxy/migrator';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createDatabaseConnection, executeMigrationQueries, type Database } from '../src/lib/db';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Creates a fresh in-memory Node SQLite database with the schema migrated in.
 *
 * @returns A promise resolving to the migrated in-memory database client.
 */
export async function createTestDatabase(): Promise<Database> {
    const { db, sqlite } = createDatabaseConnection(':memory:');
    await migrate(
        db,
        async (queries: string[]): Promise<void> => executeMigrationQueries(sqlite, queries),
        { migrationsFolder: join(here, 'migrations') },
    );
    return db;
}

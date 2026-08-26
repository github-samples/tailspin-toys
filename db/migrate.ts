/**
 * Applies generated Drizzle migrations to the local SQLite database.
 */

import { migrate } from 'drizzle-orm/sqlite-proxy/migrator';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createDatabaseConnection, executeMigrationQueries } from '../src/lib/db';

const here = dirname(fileURLToPath(import.meta.url));

async function run(): Promise<void> {
    const { db, sqlite } = createDatabaseConnection();
    await migrate(
        db,
        async (queries: string[]): Promise<void> => executeMigrationQueries(sqlite, queries),
        { migrationsFolder: join(here, 'migrations') },
    );
    console.log('Migrations applied.');
}

run()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Migration failed:', error);
        process.exit(1);
    });

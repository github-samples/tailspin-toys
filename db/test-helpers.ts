import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as schema from './schema';
import type { Database } from '../src/lib/db';

const here = dirname(fileURLToPath(import.meta.url));

/** Create a fresh in-memory libSQL database with the schema migrated in. */
export async function createTestDatabase(): Promise<Database> {
    const client = createClient({ url: ':memory:' });
    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: join(here, 'migrations') });
    return db;
}

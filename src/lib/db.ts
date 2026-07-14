import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import * as schema from '../../db/schema';

export type Database = LibSQLDatabase<typeof schema>;

/** Default local libSQL file used for dev/build when DATABASE_URL is unset. */
const DEFAULT_DATABASE_URL = 'file:./.data/tailspin.db';

let cachedDb: Database | undefined;

/** Ensure the parent directory exists for a local `file:` libSQL URL. */
function ensureLocalDir(url: string): void {
    if (url.startsWith('file:')) {
        const filePath = url.slice('file:'.length);
        if (filePath && filePath !== ':memory:') {
            mkdirSync(dirname(filePath), { recursive: true });
        }
    }
}

/** Create a Drizzle client for the given libSQL connection URL. */
export function createDatabase(url: string = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL): Database {
    ensureLocalDir(url);
    const client = createClient({ url });
    return drizzle(client, { schema });
}

/** Shared singleton database client used by pages at build time. */
export function getDatabase(): Database {
    if (!cachedDb) {
        cachedDb = createDatabase();
    }
    return cachedDb;
}

/**
 * Provides the Drizzle database client and SQLite connection helpers.
 */

import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import type { AsyncRemoteCallback, SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';
import * as schema from '../../db/schema';

export type Database = SqliteRemoteDatabase<typeof schema>;

export interface DatabaseConnection {
    db: Database;
    sqlite: DatabaseSync;
}

/** Default local SQLite file used for dev/build when DATABASE_URL is unset. */
const DEFAULT_DATABASE_URL = 'file:tailspin.db';

let cachedDb: Database | undefined;

/** Resolve a local SQLite URL to the path expected by Node's built-in driver. */
function databasePath(url: string): string {
    if (url === ':memory:') {
        return url;
    }

    if (!url.startsWith('file:')) {
        throw new Error('DATABASE_URL must be a local file: URL or :memory:.');
    }

    const filePath = url.startsWith('file://') ? fileURLToPath(url) : url.slice('file:'.length);
    if (!filePath) {
        throw new Error('DATABASE_URL must include a database file path.');
    }

    mkdirSync(dirname(filePath), { recursive: true });
    return filePath;
}

/** Bridge Drizzle's async SQLite adapter to Node's synchronous built-in driver. */
function createRemoteCallback(sqlite: DatabaseSync): AsyncRemoteCallback {
    return async (sql: string, params: SQLInputValue[], method: 'run' | 'all' | 'values' | 'get') => {
        const statement = sqlite.prepare(sql);

        switch (method) {
            case 'run':
                statement.run(...params);
                return { rows: [] };
            case 'all':
                return { rows: statement.all(...params).map((row) => Object.values(row)) };
            case 'values':
                return { rows: statement.all(...params).map((row) => Object.values(row)) };
            case 'get': {
                const row = statement.get(...params);
                // Drizzle's proxy type requires an array, but its get mapper accepts no row.
                return { rows: row === undefined ? (undefined as unknown as never[]) : Object.values(row) };
            }
        }
    };
}

/**
 * Runs generated migration statements atomically through Node's SQLite driver.
 *
 * @param sqlite - The SQLite connection that executes the migration statements.
 * @param queries - The SQL migration statements to execute in order.
 * @returns Nothing. The database is committed when all statements succeed.
 */
export function executeMigrationQueries(sqlite: DatabaseSync, queries: string[]): void {
    sqlite.exec('BEGIN');
    try {
        for (const query of queries) {
            sqlite.exec(query);
        }
        sqlite.exec('COMMIT');
    } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
    }
}

/**
 * Creates a Drizzle client for the given local SQLite connection URL.
 *
 * @param url - The local SQLite URL, or the configured default when omitted.
 * @returns A Drizzle database client.
 */
export function createDatabase(url: string = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL): Database {
    return createDatabaseConnection(url).db;
}

/**
 * Creates the Drizzle client and its Node SQLite connection for migration workflows.
 *
 * @param url - The local SQLite URL, or the configured default when omitted.
 * @returns The Drizzle client and its underlying SQLite connection.
 */
export function createDatabaseConnection(
    url: string = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
): DatabaseConnection {
    const sqlite = new DatabaseSync(databasePath(url));
    sqlite.exec('PRAGMA short_column_names = OFF; PRAGMA full_column_names = ON;');
    const db = drizzle(createRemoteCallback(sqlite), { schema });
    return { db, sqlite };
}

/**
 * Returns the shared singleton database client used by pages at build time.
 *
 * @returns The shared Drizzle database client.
 */
export function getDatabase(): Database {
    if (!cachedDb) {
        cachedDb = createDatabase();
    }
    return cachedDb;
}

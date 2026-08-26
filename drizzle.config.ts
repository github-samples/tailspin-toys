/**
 * Configures Drizzle Kit for the SQLite schema and migrations.
 */

import { defineConfig } from 'drizzle-kit';

const url = process.env.DATABASE_URL ?? 'file:tailspin.db';

export default defineConfig({
    dialect: 'sqlite',
    driver: 'durable-sqlite',
    schema: './db/schema.ts',
    out: './db/migrations',
    dbCredentials: { url },
});

import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { executeReadOnlyQuery } from './query-execution.mjs';

function createTestClient(database: DatabaseSync) {
    return {
        execute: async (query: string) => {
            if (query === 'PRAGMA query_only = ON') {
                database.exec(query);
                return undefined;
            }

            const statement = database.prepare(query);
            return /\b(?:DELETE|UPDATE|INSERT)\b/i.test(query)
                ? statement.run()
                : { rows: statement.all() };
        },
    };
}

describe('executeReadOnlyQuery', () => {
    let database: DatabaseSync | undefined;

    afterEach(() => {
        database?.close();
        database = undefined;
    });

    it.each([
        {
            operation: 'DELETE',
            query: 'WITH doomed AS (SELECT id FROM games) DELETE FROM games',
        },
        {
            operation: 'UPDATE',
            query: 'WITH target AS (SELECT id FROM games) UPDATE games SET id = 2 WHERE id IN (SELECT id FROM target)',
        },
        {
            operation: 'INSERT',
            query: 'WITH incoming(id) AS (SELECT 2) INSERT INTO games SELECT id FROM incoming',
        },
    ])('rejects a CTE-prefixed $operation without changing the database', async ({ query }) => {
        database = new DatabaseSync(':memory:');
        database.exec('CREATE TABLE games (id INTEGER PRIMARY KEY); INSERT INTO games VALUES (1)');
        const client = createTestClient(database);

        await expect(executeReadOnlyQuery(client, query)).rejects.toMatchObject({
            code: 'ERR_SQLITE_ERROR',
        });
        expect(database.prepare('SELECT id FROM games').all()).toEqual([{ id: 1 }]);
    });

    it('allows a read-only CTE', async () => {
        database = new DatabaseSync(':memory:');
        database.exec('CREATE TABLE games (id INTEGER PRIMARY KEY); INSERT INTO games VALUES (1)');
        const client = createTestClient(database);

        const result = await executeReadOnlyQuery(
            client,
            'WITH selected AS (SELECT id FROM games) SELECT id FROM selected',
        );

        expect(result.rows).toEqual([{ id: 1 }]);
    });
});

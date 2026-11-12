import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createClient, type Config, type Row } from '@libsql/client';
import { validateReadOnlyQuery } from './query-policy.mjs';
import { CanvasError, getRegisteredCanvas, type CanvasAction, type CanvasDefinition } from './test-support/copilot-sdk';

const boundary = vi.hoisted((): { url?: string } => ({}));

vi.mock('@libsql/client', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@libsql/client')>();
    return {
        ...actual,
        createClient: vi.fn((config: Config) => {
            if (!boundary.url || config.url !== boundary.url || !config.url.startsWith('file:')) {
                throw new Error('The extension may only open this test\'s local fixture.');
            }
            const client = actual.createClient(config);
            vi.spyOn(client, 'execute');
            vi.spyOn(client, 'close');
            return client;
        }),
    };
});

const { createClient: createFixtureClient } = await vi.importActual<typeof import('@libsql/client')>('@libsql/client');

interface QueryResult {
    columns: string[];
    rows: Record<string, string | number | null>[];
    truncated: boolean;
}

interface AcceptedCase {
    name: string;
    query: string;
    statement: string;
    expected: QueryResult;
}

interface RejectedCase {
    name: string;
    query: unknown;
    error: string;
}

interface DatabaseState {
    rows: Row[];
    schema: Row[];
}

const catalog: QueryResult = {
    columns: ['id', 'title'],
    rows: [{ id: 1, title: 'Code Quest' }, { id: 2, title: "O'Brien" }],
    truncated: false,
};

const acceptedCases: AcceptedCase[] = [
    {
        name: 'ordered SELECT',
        query: 'SELECT id, title FROM games ORDER BY id',
        statement: 'SELECT id, title FROM games ORDER BY id',
        expected: catalog,
    },
    {
        name: 'mixed case, whitespace and a terminal delimiter',
        query: '\n  sElEcT id, title FROM games ORDER BY id; \t',
        statement: 'sElEcT id, title FROM games ORDER BY id',
        expected: catalog,
    },
    {
        name: 'read-only WITH',
        query: 'WITH chosen AS (SELECT id, title FROM games) SELECT id, title FROM chosen ORDER BY id;',
        statement: 'WITH chosen AS (SELECT id, title FROM games) SELECT id, title FROM chosen ORDER BY id',
        expected: catalog,
    },
    {
        name: 'leading, interleaved and trailing comments',
        query: '/* lead */SELECT/* between */id, title FROM games -- order\nORDER BY id; /* tail */',
        statement: 'SELECT id, title FROM games  ORDER BY id',
        expected: catalog,
    },
    {
        name: 'line comment without a final newline',
        query: 'SELECT id, title FROM games ORDER BY id; -- done',
        statement: 'SELECT id, title FROM games ORDER BY id',
        expected: catalog,
    },
    {
        name: 'quoted identifiers',
        query: 'SELECT "id", `title` FROM "games" ORDER BY "id";',
        statement: 'SELECT "id", `title` FROM "games" ORDER BY "id"',
        expected: catalog,
    },
    {
        name: 'escaped apostrophe and comment markers in a value',
        query: "SELECT 'O''Brien; -- still /* text */' AS value;",
        statement: "SELECT 'O''Brien; -- still /* text */' AS value",
        expected: { columns: ['value'], rows: [{ value: "O'Brien; -- still /* text */" }], truncated: false },
    },
    {
        name: 'doubled double quote in an identifier',
        query: 'SELECT 1 AS "a"";--/*b";',
        statement: 'SELECT 1 AS "a"";--/*b"',
        expected: { columns: ['a";--/*b'], rows: [{ 'a";--/*b': 1 }], truncated: false },
    },
    {
        name: 'doubled backtick in an identifier',
        query: 'SELECT 1 AS `a``;--/*b`;',
        statement: 'SELECT 1 AS `a``;--/*b`',
        expected: { columns: ['a`;--/*b'], rows: [{ 'a`;--/*b': 1 }], truncated: false },
    },
    {
        name: 'nullable fixture value',
        query: 'SELECT notes FROM games WHERE id = 1;',
        statement: 'SELECT notes FROM games WHERE id = 1',
        expected: { columns: ['notes'], rows: [{ notes: null }], truncated: false },
    },
    {
        name: 'view read',
        query: 'SELECT id, title FROM game_titles ORDER BY id;',
        statement: 'SELECT id, title FROM game_titles ORDER BY id',
        expected: catalog,
    },
    {
        name: 'valid empty result',
        query: 'SELECT id, title FROM games WHERE id = 999;',
        statement: 'SELECT id, title FROM games WHERE id = 999',
        expected: { columns: ['id', 'title'], rows: [], truncated: false },
    },
];

const queryRequired = 'Enter a SQL query.';
const readOnlyRequired = 'Only read-only SELECT and WITH queries are allowed.';
const rejectedCases: RejectedCase[] = [
    { name: 'undefined', query: undefined, error: queryRequired },
    { name: 'null', query: null, error: queryRequired },
    { name: 'boolean', query: false, error: queryRequired },
    { name: 'number', query: 1, error: queryRequired },
    { name: 'array', query: ['SELECT 1'], error: queryRequired },
    { name: 'object', query: { query: 'SELECT 1' }, error: queryRequired },
    { name: 'empty string', query: '', error: queryRequired },
    { name: 'whitespace', query: ' \t\r\n ', error: queryRequired },
    { name: 'line comment only', query: '-- SELECT 1', error: readOnlyRequired },
    { name: 'block comment only', query: '/* SELECT 1 */', error: readOnlyRequired },
    { name: 'delimiter only', query: ';', error: readOnlyRequired },
    { name: 'unclosed string', query: "SELECT 'unfinished", error: 'The SQL string is not closed.' },
    { name: 'unclosed quoted identifier', query: 'SELECT "unfinished', error: 'The SQL string is not closed.' },
    { name: 'unclosed backtick identifier', query: 'SELECT `unfinished', error: 'The SQL string is not closed.' },
    { name: 'unclosed block comment', query: 'SELECT 1 /* unfinished', error: 'The SQL comment is not closed.' },
    { name: 'multiple reads', query: 'SELECT 1; SELECT 2', error: 'Run one SQL statement at a time.' },
    { name: 'multiple reads separated by comments', query: 'SELECT 1; -- next\n/* comment */ SELECT 2', error: 'Run one SQL statement at a time.' },
    { name: 'INSERT', query: "INSERT INTO games VALUES (3, 'New', NULL)", error: readOnlyRequired },
    { name: 'UPDATE', query: "UPDATE games SET title = 'Changed'", error: readOnlyRequired },
    { name: 'DELETE', query: 'DELETE FROM games', error: readOnlyRequired },
    { name: 'REPLACE', query: "REPLACE INTO games VALUES (1, 'Changed', NULL)", error: readOnlyRequired },
    { name: 'CREATE', query: 'CREATE TABLE extra (id INTEGER)', error: readOnlyRequired },
    { name: 'ALTER', query: 'ALTER TABLE games ADD COLUMN extra TEXT', error: readOnlyRequired },
    { name: 'DROP', query: 'DROP TABLE games', error: readOnlyRequired },
    { name: 'transaction', query: 'BEGIN', error: readOnlyRequired },
    { name: 'PRAGMA', query: 'PRAGMA user_version = 1', error: readOnlyRequired },
    { name: 'ATTACH', query: "ATTACH DATABASE ':memory:' AS extra", error: readOnlyRequired },
    { name: 'VACUUM', query: 'VACUUM', error: readOnlyRequired },
    { name: 'EXPLAIN', query: 'EXPLAIN SELECT * FROM games', error: readOnlyRequired },
];

describe('Database Explorer query policy', () => {
    it.each(acceptedCases)('accepts supported read-only single-statement queries: $name', ({ query, statement }) => {
        expect(validateReadOnlyQuery(query)).toBe(statement);
    });

    it.each(rejectedCases)('rejects invalid input and requests outside the read-only contract: $name', ({ query, error }) => {
        expect(() => validateReadOnlyQuery(query)).toThrow(error);
    });
});

async function readDatabaseState(url: string): Promise<DatabaseState> {
    const client = createFixtureClient({ url });
    try {
        return {
            rows: (await client.execute('SELECT id, title, notes FROM games ORDER BY id')).rows,
            schema: (await client.execute('SELECT type, name, tbl_name, sql FROM sqlite_master ORDER BY type, name')).rows,
        };
    } finally {
        client.close();
    }
}

describe('Database Explorer entry points', () => {
    let directory: string | undefined;
    let databaseUrl: string;
    let serverUrl: string;
    let canvas: CanvasDefinition | undefined;
    let action: CanvasAction;
    let baseline: DatabaseState;
    const context = { instanceId: 'query-policy-test' };

    beforeEach(async () => {
        vi.mocked(createClient).mockClear();
        directory = await mkdtemp(join(tmpdir(), 'database-explorer-test-'));
        databaseUrl = pathToFileURL(join(directory, 'fixture.db')).href;
        boundary.url = databaseUrl;
        vi.stubEnv('DATABASE_URL', databaseUrl);

        const client = createFixtureClient({ url: databaseUrl });
        try {
            await client.executeMultiple(`
                CREATE TABLE games (id INTEGER PRIMARY KEY, title TEXT NOT NULL, notes TEXT);
                CREATE INDEX games_title ON games(title);
                CREATE VIEW game_titles AS SELECT id, title FROM games;
            `);
            await client.batch([
                { sql: 'INSERT INTO games VALUES (?, ?, ?)', args: [1, 'Code Quest', null] },
                { sql: 'INSERT INTO games VALUES (?, ?, ?)', args: [2, "O'Brien", '--keep; /*text*/'] },
            ]);
        } finally {
            client.close();
        }
        baseline = await readDatabaseState(databaseUrl);

        await import('./extension.mjs');
        canvas = getRegisteredCanvas();
        expect(canvas.id).toBe('database-explorer');
        const registeredAction = canvas.actions.find((candidate) => candidate.name === 'run_query');
        if (!registeredAction) throw new Error('The extension did not register run_query.');
        action = registeredAction;
        serverUrl = (await canvas.open(context)).url;
    });

    afterEach(async () => {
        try {
            await canvas?.onClose(context);
            for (const result of vi.mocked(createClient).mock.results) {
                if (result.type === 'return') {
                    expect(result.value.close).toHaveBeenCalledOnce();
                    expect(result.value.closed).toBe(true);
                }
            }
        } finally {
            for (const result of vi.mocked(createClient).mock.results) {
                if (result.type === 'return' && !result.value.closed) result.value.close();
            }
            vi.restoreAllMocks();
            vi.unstubAllEnvs();
            boundary.url = undefined;
            if (directory) await rm(directory, { recursive: true, force: true });
            directory = undefined;
            canvas = undefined;
        }
    });

    async function postBody(body: string): Promise<{ status: number; body: unknown }> {
        const response = await fetch(new URL('/api/query', serverUrl), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
            signal: AbortSignal.timeout(5_000),
        });
        const responseBody: unknown = await response.json();
        return { status: response.status, body: responseBody };
    }

    it.each(acceptedCases)('applies the same policy through HTTP and canvas actions: $name', async ({ query, statement, expected }) => {
        expect(await postBody(JSON.stringify({ query }))).toEqual({ status: 200, body: expected });
        expect(await readDatabaseState(databaseUrl)).toEqual(baseline);
        expect(await action.handler({ input: { query } })).toEqual(expected);
        expect(await readDatabaseState(databaseUrl)).toEqual(baseline);

        expect(createClient).toHaveBeenCalledTimes(2);
        for (const result of vi.mocked(createClient).mock.results) {
            expect(result.type).toBe('return');
            if (result.type === 'return') {
                expect(result.value.execute).toHaveBeenCalledExactlyOnceWith(statement);
            }
        }
    });

    it.each(rejectedCases)('does not invoke the query executor after validation rejects a request: $name', async ({ query, error }) => {
        expect(await postBody(JSON.stringify({ query }))).toEqual({ status: 400, body: { error } });
        expect(createClient).not.toHaveBeenCalled();
        expect(await readDatabaseState(databaseUrl)).toEqual(baseline);

        const result = action.handler({ input: { query } });
        await expect(result).rejects.toBeInstanceOf(CanvasError);
        await expect(result).rejects.toMatchObject({ code: 'database_query_invalid', message: error });
        expect(createClient).not.toHaveBeenCalled();
        expect(await readDatabaseState(databaseUrl)).toEqual(baseline);
    });

    it('preserves fixture rows and schema while serving the read-only interface', async () => {
        expect(baseline.rows).toHaveLength(2);
        expect(baseline.schema.map((row) => row.name)).toEqual(['games_title', 'games', 'game_titles']);
        for (const { query, expected } of acceptedCases) {
            expect(await postBody(JSON.stringify({ query }))).toEqual({ status: 200, body: expected });
            expect(await readDatabaseState(databaseUrl)).toEqual(baseline);
        }
        for (const { query, error } of rejectedCases) {
            await expect(action.handler({ input: { query } })).rejects.toMatchObject({ message: error });
            expect(await readDatabaseState(databaseUrl)).toEqual(baseline);
        }
    });

    it.each(['{', '{}'])('rejects an invalid HTTP envelope without executing: %s', async (body) => {
        const response = await postBody(body);
        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: expect.stringMatching(/\S/) });
        expect(createClient).not.toHaveBeenCalled();
        expect(await readDatabaseState(databaseUrl)).toEqual(baseline);
    });

    it('rejects a missing canvas input without executing', async () => {
        await expect(action.handler({})).rejects.toMatchObject({ code: 'database_query_invalid', message: queryRequired });
        expect(createClient).not.toHaveBeenCalled();
        expect(await readDatabaseState(databaseUrl)).toEqual(baseline);
    });

    it.each(['SELECT FROM games', 'SELECT * FROM missing_table'])('surfaces database failures rather than empty success: %s', async (query) => {
        const response = await postBody(JSON.stringify({ query }));
        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: expect.stringMatching(/\S/) });
        await expect(action.handler({ input: { query } })).rejects.toThrow();
        expect(createClient).toHaveBeenCalledTimes(2);
        expect(await readDatabaseState(databaseUrl)).toEqual(baseline);
    });

    it('returns tables and views consistently through HTTP and canvas', async () => {
        const expected: QueryResult = {
            columns: ['name', 'type'],
            rows: [{ name: 'games', type: 'table' }, { name: 'game_titles', type: 'view' }],
            truncated: false,
        };
        const response = await fetch(new URL('/api/tables', serverUrl), { signal: AbortSignal.timeout(5_000) });
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual(expected);
        const listTables = canvas?.actions.find((candidate) => candidate.name === 'list_tables');
        if (!listTables) throw new Error('The extension did not register list_tables.');
        expect(await listTables.handler({})).toEqual(expected);
        expect(await readDatabaseState(databaseUrl)).toEqual(baseline);
    });

    it.each([250, 251])('preserves the displayed row limit for a read of %i rows', async (count) => {
        const query = `WITH RECURSIVE numbers(n) AS (VALUES (1) UNION ALL SELECT n + 1 FROM numbers WHERE n < ${count}) SELECT n FROM numbers ORDER BY n`;
        const expected: QueryResult = {
            columns: ['n'],
            rows: Array.from({ length: 250 }, (_, index) => ({ n: index + 1 })),
            truncated: count > 250,
        };
        expect(await postBody(JSON.stringify({ query }))).toEqual({ status: 200, body: expected });
        expect(await action.handler({ input: { query } })).toEqual(expected);
        expect(await readDatabaseState(databaseUrl)).toEqual(baseline);
    });
});

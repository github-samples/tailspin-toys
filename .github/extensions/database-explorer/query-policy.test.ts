import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    MAX_DISPLAY_ROWS,
    createDatabaseExplorerCanvas,
    executeQuery,
    listTables,
    normalizeValue,
    startServer,
    stripCommentsAndValidateSingleStatement,
    validateReadOnlyQuery,
    type CanvasActionDefinition,
    type CreateClientFn,
    type DatabaseExplorerClient,
    type NormalizedQueryResult,
    type RawQueryResult,
    type ServerEntry,
} from './query-policy.mjs';

interface DisposableFixtureDatabase {
    url: string;
    sqlite: DatabaseSync;
    createClient: CreateClientFn;
    snapshotState: () => {
        schema: Array<Record<string, unknown>>;
        publishers: Array<Record<string, unknown>>;
        games: Array<Record<string, unknown>>;
    };
    cleanup: () => void;
}

class TestCanvasError extends Error {
    public readonly code: string;

    public constructor(code: string, message: string) {
        super(message);
        this.name = 'CanvasError';
        this.code = code;
    }
}

function createSqliteClientForDb(sqlite: DatabaseSync): DatabaseExplorerClient {
    return {
        execute(query: string): RawQueryResult {
            const statement = sqlite.prepare(query);
            const rawRows = statement.all() as Array<Record<string, unknown>>;
            const columnNames =
                typeof statement.columns === 'function'
                    ? statement.columns().map((col) => col.name)
                    : rawRows.length > 0
                      ? Object.keys(rawRows[0])
                      : [];
            const rows = rawRows.map((row) => ({ ...row }));
            return { columns: columnNames, rows };
        },
        close(): void {
            // Connection lifecycle is owned by the disposable fixture helper.
        },
    };
}

function createDisposableFixtureDatabase(): DisposableFixtureDatabase {
    const tempDir = mkdtempSync(join(tmpdir(), 'tailspin-db-explorer-'));
    const dbPath = join(tempDir, 'fixture.db');
    const sqlite = new DatabaseSync(dbPath);

    sqlite.exec(`
        CREATE TABLE publishers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE
        );
        CREATE TABLE games (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            publisher_id INTEGER NOT NULL REFERENCES publishers(id),
            funding_goal INTEGER NOT NULL
        );
        CREATE VIEW game_summaries AS
            SELECT g.id, g.title, p.name AS publisher, g.funding_goal
            FROM games g
            JOIN publishers p ON p.id = g.publisher_id;
        INSERT INTO publishers (id, name) VALUES
            (1, 'Bitcraft Studio'),
            (2, 'Null Pointer Press');
        INSERT INTO games (id, title, publisher_id, funding_goal) VALUES
            (1, 'Code Quest', 1, 50000),
            (2, 'Merge Conflict; The Board Game', 2, 75000),
            (3, 'SELECT * FROM Victory -- Deluxe', 1, 120000);
    `);

    const createClient: CreateClientFn = () => createSqliteClientForDb(sqlite);

    const snapshotState = (): {
        schema: Array<Record<string, unknown>>;
        publishers: Array<Record<string, unknown>>;
        games: Array<Record<string, unknown>>;
    } => {
        const schema = sqlite
            .prepare(
                "SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name",
            )
            .all()
            .map((row) => ({ ...(row as Record<string, unknown>) }));
        const publishers = sqlite
            .prepare('SELECT id, name FROM publishers ORDER BY id')
            .all()
            .map((row) => ({ ...(row as Record<string, unknown>) }));
        const games = sqlite
            .prepare('SELECT id, title, publisher_id, funding_goal FROM games ORDER BY id')
            .all()
            .map((row) => ({ ...(row as Record<string, unknown>) }));
        return { schema, publishers, games };
    };

    const cleanup = (): void => {
        try {
            sqlite.close();
        } finally {
            rmSync(tempDir, { recursive: true, force: true });
        }
    };

    return {
        url: `file:${dbPath}`,
        sqlite,
        createClient,
        snapshotState,
        cleanup,
    };
}

function getCanvasAction(
    actions: CanvasActionDefinition[],
    name: string,
): CanvasActionDefinition {
    const found = actions.find((action) => action.name === name);
    if (!found) {
        throw new Error(`Expected canvas action "${name}" to be registered.`);
    }
    return found;
}

const REJECTED_POLICY_MATRIX: ReadonlyArray<{ label: string; input: unknown; expectedError: string }> = [
    { label: 'undefined input', input: undefined, expectedError: 'Enter a SQL query.' },
    { label: 'null input', input: null, expectedError: 'Enter a SQL query.' },
    { label: 'numeric input', input: 42, expectedError: 'Enter a SQL query.' },
    { label: 'object input', input: { query: 'SELECT 1' }, expectedError: 'Enter a SQL query.' },
    { label: 'empty string', input: '', expectedError: 'Enter a SQL query.' },
    { label: 'whitespace-only string', input: '   \n\t  ', expectedError: 'Enter a SQL query.' },
    { label: 'semicolon-only string', input: ';;;', expectedError: 'Only read-only SELECT and WITH queries are allowed.' },
    { label: 'line-comment-only query', input: '-- just a comment\n', expectedError: 'Only read-only SELECT and WITH queries are allowed.' },
    { label: 'block-comment-only query', input: '/* only a comment */', expectedError: 'Only read-only SELECT and WITH queries are allowed.' },
    { label: 'unclosed block comment', input: 'SELECT * FROM games /* unclosed', expectedError: 'The SQL comment is not closed.' },
    { label: 'unclosed single-quoted string', input: "SELECT * FROM games WHERE title = 'Code Quest", expectedError: 'The SQL string is not closed.' },
    { label: 'unclosed double-quoted identifier', input: 'SELECT "title FROM games', expectedError: 'The SQL string is not closed.' },
    { label: 'unclosed backtick identifier', input: 'SELECT `title FROM games', expectedError: 'The SQL string is not closed.' },
    { label: 'multiple SELECT statements', input: 'SELECT 1; SELECT 2;', expectedError: 'Run one SQL statement at a time.' },
    { label: 'SELECT followed by DROP TABLE', input: 'SELECT * FROM games; DROP TABLE games;', expectedError: 'Run one SQL statement at a time.' },
    { label: 'SELECT followed by comment then second statement', input: 'SELECT 1; /* comment */ DELETE FROM games', expectedError: 'Run one SQL statement at a time.' },
    { label: 'INSERT statement', input: "INSERT INTO publishers (name) VALUES ('Rogue')", expectedError: 'Only read-only SELECT and WITH queries are allowed.' },
    { label: 'UPDATE statement', input: "UPDATE games SET funding_goal = 0 WHERE id = 1", expectedError: 'Only read-only SELECT and WITH queries are allowed.' },
    { label: 'DELETE statement', input: 'DELETE FROM games WHERE id = 1', expectedError: 'Only read-only SELECT and WITH queries are allowed.' },
    { label: 'DROP TABLE statement', input: 'DROP TABLE games', expectedError: 'Only read-only SELECT and WITH queries are allowed.' },
    { label: 'ALTER TABLE statement', input: 'ALTER TABLE games ADD COLUMN hacked INTEGER', expectedError: 'Only read-only SELECT and WITH queries are allowed.' },
    { label: 'CREATE TABLE statement', input: 'CREATE TABLE hacked (id INTEGER)', expectedError: 'Only read-only SELECT and WITH queries are allowed.' },
    { label: 'REPLACE statement', input: "REPLACE INTO publishers (id, name) VALUES (1, 'Hacked')", expectedError: 'Only read-only SELECT and WITH queries are allowed.' },
    { label: 'PRAGMA statement', input: 'PRAGMA table_info(games)', expectedError: 'Only read-only SELECT and WITH queries are allowed.' },
    { label: 'ATTACH DATABASE statement', input: "ATTACH DATABASE ':memory:' AS aux", expectedError: 'Only read-only SELECT and WITH queries are allowed.' },
    { label: 'DETACH DATABASE statement', input: 'DETACH DATABASE aux', expectedError: 'Only read-only SELECT and WITH queries are allowed.' },
    { label: 'VACUUM statement', input: 'VACUUM', expectedError: 'Only read-only SELECT and WITH queries are allowed.' },
    { label: 'BEGIN TRANSACTION statement', input: 'BEGIN TRANSACTION', expectedError: 'Only read-only SELECT and WITH queries are allowed.' },
    { label: 'EXPLAIN statement', input: 'EXPLAIN QUERY PLAN SELECT * FROM games', expectedError: 'Only read-only SELECT and WITH queries are allowed.' },
];

describe('Database Explorer read-only query contract', () => {
    let fixture: DisposableFixtureDatabase | undefined;
    let activeServers: ServerEntry[] = [];

    beforeEach(() => {
        activeServers = [];
    });

    afterEach(async () => {
        for (const entry of activeServers) {
            await new Promise<void>((resolve) => entry.server.close(() => resolve()));
        }
        activeServers = [];
        if (fixture) {
            fixture.cleanup();
            fixture = undefined;
        }
    });

    it('accepts supported read-only single-statement queries', async () => {
        fixture = createDisposableFixtureDatabase();

        const selectWithCommentsAndQuotes = `
            -- Leading line comment with keywords: DROP TABLE games;
            /* Leading block comment with semicolon; */
            SELECT id, title, funding_goal
            FROM games
            WHERE title IN ('Merge Conflict; The Board Game', 'SELECT * FROM Victory -- Deluxe', 'It''s fine')
            ORDER BY id; -- trailing comment
        `;
        const validatedSelect = validateReadOnlyQuery(selectWithCommentsAndQuotes);
        expect(validatedSelect).toContain("WHERE title IN ('Merge Conflict; The Board Game', 'SELECT * FROM Victory -- Deluxe', 'It''s fine')");
        expect(validatedSelect).not.toContain('DROP TABLE games');

        const selectResult = await executeQuery(fixture.url, validatedSelect, {
            createClient: fixture.createClient,
        });
        expect(selectResult).toEqual({
            columns: ['id', 'title', 'funding_goal'],
            rows: [
                { id: 2, title: 'Merge Conflict; The Board Game', funding_goal: 75000 },
                { id: 3, title: 'SELECT * FROM Victory -- Deluxe', funding_goal: 120000 },
            ],
            truncated: false,
        });

        const cteQuery = `
            WITH high_goal_games AS (
                SELECT id, title, publisher, funding_goal
                FROM game_summaries
                WHERE funding_goal >= 75000
            )
            SELECT id, title, publisher
            FROM high_goal_games
            ORDER BY id;
        `;
        const validatedCte = validateReadOnlyQuery(cteQuery);
        const cteResult = await executeQuery(fixture.url, validatedCte, {
            createClient: fixture.createClient,
        });
        expect(cteResult).toEqual({
            columns: ['id', 'title', 'publisher'],
            rows: [
                { id: 2, title: 'Merge Conflict; The Board Game', publisher: 'Null Pointer Press' },
                { id: 3, title: 'SELECT * FROM Victory -- Deluxe', publisher: 'Bitcraft Studio' },
            ],
            truncated: false,
        });

        // Verify identifier quoting and comment stripping preserve semantics
        expect(
            stripCommentsAndValidateSingleStatement(
                'SELECT "title", `funding_goal` FROM /* inline */ games WHERE id = 1;',
            ),
        ).toBe('SELECT "title", `funding_goal` FROM   games WHERE id = 1');

        // Verify BigInt normalization and row truncation at MAX_DISPLAY_ROWS (250)
        expect(normalizeValue(9007199254740993n)).toBe('9007199254740993');
        const oversizedRows = Array.from({ length: MAX_DISPLAY_ROWS + 5 }, (_, index) => ({
            id: BigInt(index + 1),
        }));
        const truncatedResult = await executeQuery('file:synthetic.db', 'SELECT id FROM big_table', {
            createClient: () => ({
                execute: () => ({ columns: ['id'], rows: oversizedRows }),
                close: () => {},
            }),
        });
        expect(truncatedResult.truncated).toBe(true);
        expect(truncatedResult.rows).toHaveLength(MAX_DISPLAY_ROWS);
        expect(truncatedResult.rows[0]).toEqual({ id: '1' });
    });

    describe('rejects invalid input and requests outside the read-only contract', () => {
        it.each(REJECTED_POLICY_MATRIX)(
            'rejects $label with "$expectedError"',
            ({ input, expectedError }) => {
                expect(() => validateReadOnlyQuery(input)).toThrow(expectedError);
            },
        );
    });

    it('does not invoke the query executor after validation rejects a request', async () => {
        const executeSpy = vi.fn(() => ({ columns: ['ok'], rows: [{ ok: 1 }] }));
        const closeSpy = vi.fn();
        const createClientSpy = vi.fn<CreateClientFn>(() => ({
            execute: executeSpy,
            close: closeSpy,
        }));

        const canvas = createDatabaseExplorerCanvas({
            CanvasError: TestCanvasError,
            createClient: createClientSpy,
            resolveDatabaseUrl: () => 'file:unused.db',
        });
        const runQueryAction = getCanvasAction(canvas.actions, 'run_query');

        const serverEntry = await startServer('file:unused.db', {
            createClient: createClientSpy,
        });
        activeServers.push(serverEntry);

        for (const { input, expectedError } of REJECTED_POLICY_MATRIX) {
            expect(() => validateReadOnlyQuery(input)).toThrow(expectedError);

            await expect(
                runQueryAction.handler({ input: { query: input } }),
            ).rejects.toThrow(expectedError);

            const response = await fetch(`${serverEntry.url}api/query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: input }),
            });
            expect(response.status).toBe(400);
            const payload = (await response.json()) as { error: string };
            expect(payload.error).toBe(expectedError);
        }

        expect(createClientSpy).not.toHaveBeenCalled();
        expect(executeSpy).not.toHaveBeenCalled();
        expect(closeSpy).not.toHaveBeenCalled();
    });

    it('preserves fixture rows and schema while serving the read-only interface', async () => {
        fixture = createDisposableFixtureDatabase();
        const initialSnapshot = fixture.snapshotState();

        const canvas = createDatabaseExplorerCanvas({
            CanvasError: TestCanvasError,
            createClient: fixture.createClient,
            resolveDatabaseUrl: () => fixture!.url,
        });
        const listTablesAction = getCanvasAction(canvas.actions, 'list_tables');
        const runQueryAction = getCanvasAction(canvas.actions, 'run_query');

        const serverEntry = await startServer(fixture.url, {
            createClient: fixture.createClient,
        });
        activeServers.push(serverEntry);

        // 1. Exercise table listing via direct helper, canvas action, and HTTP
        const expectedTables: NormalizedQueryResult = {
            columns: ['name', 'type'],
            rows: [
                { name: 'games', type: 'table' },
                { name: 'publishers', type: 'table' },
                { name: 'game_summaries', type: 'view' },
            ],
            truncated: false,
        };
        expect(await listTables(fixture.url, { createClient: fixture.createClient })).toEqual(
            expectedTables,
        );
        expect(await listTablesAction.handler()).toEqual(expectedTables);

        const httpTablesResponse = await fetch(`${serverEntry.url}api/tables`);
        expect(httpTablesResponse.status).toBe(200);
        expect(await httpTablesResponse.json()).toEqual(expectedTables);

        // 2. Exercise supported SELECT and WITH queries
        const supportedQueries = [
            'SELECT id, title FROM games ORDER BY id;',
            'WITH top AS (SELECT title FROM games WHERE funding_goal > 60000) SELECT * FROM top ORDER BY title;',
        ];
        for (const sql of supportedQueries) {
            const canvasRes = await runQueryAction.handler({ input: { query: sql } });
            expect(canvasRes.rows.length).toBeGreaterThan(0);

            const httpRes = await fetch(`${serverEntry.url}api/query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: sql }),
            });
            expect(httpRes.status).toBe(200);
        }

        // 3. Exercise every rejected policy matrix entry against the live disposable database
        for (const { input, expectedError } of REJECTED_POLICY_MATRIX) {
            await expect(
                runQueryAction.handler({ input: { query: input } }),
            ).rejects.toThrow(expectedError);

            const httpRes = await fetch(`${serverEntry.url}api/query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: input }),
            });
            expect(httpRes.status).toBe(400);
        }

        // 4. Verify database schema and rows are completely unchanged
        const finalSnapshot = fixture.snapshotState();
        expect(finalSnapshot).toEqual(initialSnapshot);
    });

    it('applies the same policy through HTTP and canvas actions', async () => {
        fixture = createDisposableFixtureDatabase();

        const servers = new Map<string, ServerEntry>();
        const canvas = createDatabaseExplorerCanvas({
            CanvasError: TestCanvasError,
            createClient: fixture.createClient,
            resolveDatabaseUrl: () => fixture!.url,
            servers,
        });
        const listTablesAction = getCanvasAction(canvas.actions, 'list_tables');
        const runQueryAction = getCanvasAction(canvas.actions, 'run_query');

        const opened = await canvas.open({ instanceId: 'test-instance-1' });
        expect(opened.title).toBe('Database Explorer');
        expect(opened.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/);

        try {
            // Verify GET /api/tables and canvas list_tables return identical payloads
            const [httpTablesResponse, canvasTables] = await Promise.all([
                fetch(`${opened.url}api/tables`),
                listTablesAction.handler(),
            ]);
            expect(httpTablesResponse.status).toBe(200);
            const httpTables = (await httpTablesResponse.json()) as NormalizedQueryResult;
            expect(httpTables).toEqual(canvasTables);

            // Verify accepted SELECT and WITH queries produce identical results across both entry points
            const acceptedQueries = [
                'SELECT id, title, funding_goal FROM games WHERE publisher_id = 1 ORDER BY id;',
                'WITH summary AS (SELECT publisher, COUNT(*) AS total FROM game_summaries GROUP BY publisher) SELECT publisher, total FROM summary ORDER BY publisher;',
            ];

            for (const query of acceptedQueries) {
                const [httpQueryResponse, canvasQueryResult] = await Promise.all([
                    fetch(`${opened.url}api/query`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ query }),
                    }),
                    runQueryAction.handler({ input: { query } }),
                ]);

                expect(httpQueryResponse.status).toBe(200);
                const httpQueryResult = (await httpQueryResponse.json()) as NormalizedQueryResult;
                expect(httpQueryResult).toEqual(canvasQueryResult);
            }

            // Verify rejected inputs fail consistently with the exact same error message
            const representativeRejections = [
                { query: '', expectedError: 'Enter a SQL query.' },
                { query: 'DELETE FROM games WHERE id = 1', expectedError: 'Only read-only SELECT and WITH queries are allowed.' },
                { query: 'SELECT 1; DROP TABLE games;', expectedError: 'Run one SQL statement at a time.' },
                { query: 'SELECT * FROM games /* unclosed', expectedError: 'The SQL comment is not closed.' },
                { query: "SELECT 'unclosed FROM games", expectedError: 'The SQL string is not closed.' },
            ];

            for (const { query, expectedError } of representativeRejections) {
                let caughtCanvasError: unknown;
                try {
                    await runQueryAction.handler({ input: { query } });
                } catch (error) {
                    caughtCanvasError = error;
                }

                expect(caughtCanvasError).toBeInstanceOf(TestCanvasError);
                expect((caughtCanvasError as TestCanvasError).code).toBe('database_query_invalid');
                expect((caughtCanvasError as TestCanvasError).message).toBe(expectedError);

                const httpResponse = await fetch(`${opened.url}api/query`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query }),
                });
                expect(httpResponse.status).toBe(400);
                const httpErrorBody = (await httpResponse.json()) as { error: string };
                expect(httpErrorBody).toEqual({ error: (caughtCanvasError as TestCanvasError).message });
            }
        } finally {
            await canvas.onClose({ instanceId: 'test-instance-1' });
            expect(servers.size).toBe(0);
        }
    });
});

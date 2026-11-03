import { DatabaseSync } from "node:sqlite";
import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createCanvasQueryHandler, createReadOnlyQueryRunner, validateReadOnlyQuery } from "./query-policy.mjs";
import { startQueryHttpServer } from "./query-http-server.mjs";

const rejectedQueries: Array<[string, unknown]> = [
    ["empty input", ""],
    ["whitespace input", "  \n"],
    ["non-string input", null],
    ["invalid statement", "garbage"],
    ["multiple statements", "SELECT 1; DELETE FROM games"],
    ["unclosed SQL string", "SELECT 'unfinished"],
    ["unclosed comment", "SELECT 1 /* unfinished"],
    ["insert statement", "INSERT INTO games (title) VALUES ('Other')"],
    ["update statement", "UPDATE games SET title = 'Changed'"],
    ["delete statement", "DELETE FROM games"],
    ["schema statement", "DROP TABLE games"],
    ["write statement after a CTE", "WITH selected AS (SELECT id FROM games) DELETE FROM games WHERE id IN (SELECT id FROM selected)"],
];

type QueryResult = {
    columns: string[];
    rows: Array<Record<string, unknown>>;
    truncated: boolean;
};

describe("Database Explorer query policy", () => {
    let sqlite: DatabaseSync;
    let executions: number;
    let runQuery: (query: unknown) => Promise<QueryResult>;
    let server: Server | undefined;

    beforeEach(() => {
        sqlite = new DatabaseSync(":memory:");
        sqlite.exec(`
            CREATE TABLE games (id INTEGER PRIMARY KEY, title TEXT NOT NULL);
            INSERT INTO games (title) VALUES ('Code Quest'), ('Pipeline Conquest');
        `);
        executions = 0;
        runQuery = createReadOnlyQueryRunner(async (query) => {
            executions += 1;
            const statement = sqlite.prepare(query);
            return {
                columns: statement.columns().map((column) => column.name),
                rows: statement.all(),
                truncated: false,
            };
        });
    });

    afterEach(async () => {
        const activeServer = server;
        if (activeServer) {
            await new Promise<void>((resolve, reject) => {
                activeServer.close((error?: Error) => error ? reject(error) : resolve());
            });
            server = undefined;
        }
        sqlite.close();
    });

    it.each([
        ["a select query", "SELECT id, title FROM games ORDER BY id", ["Code Quest", "Pipeline Conquest"]],
        ["a read-only CTE", "WITH ordered AS (SELECT id, title FROM games) SELECT title FROM ordered ORDER BY id", ["Code Quest", "Pipeline Conquest"]],
        ["a CTE with a quoted identifier", "WITH [UPDATE] AS (SELECT id, title FROM games) SELECT title FROM [UPDATE] ORDER BY id", ["Code Quest", "Pipeline Conquest"]],
        ["comments and quoted semicolons", "/* read */ SELECT 'a;b' AS label -- trailing comment\n", ["a;b"]],
    ] as Array<[string, string, string[]]>)("accepts %s and returns fixture rows", async (_description, query, expectedTitles) => {
        const result = await runQuery(query);
        expect(result.rows.map((row) => row.title ?? row.label)).toEqual(expectedTitles);
    });

    it.each(rejectedQueries)("rejects %s explicitly", async (_description, query) => {
        expect(() => validateReadOnlyQuery(query)).toThrow();
        await expect(runQuery(query)).rejects.toThrow();
    });

    it("does not execute rejected requests", async () => {
        for (const [, query] of rejectedQueries) {
            await expect(runQuery(query)).rejects.toThrow();
        }
        expect(executions).toBe(0);
    });

    it("preserves fixture rows and schema while enforcing the policy against SQLite", async () => {
        const beforeSchema = sqlite.prepare("SELECT type, name, sql FROM sqlite_schema ORDER BY type, name").all();
        const beforeRows = sqlite.prepare("SELECT id, title FROM games ORDER BY id").all();

        await runQuery("SELECT * FROM games ORDER BY id");
        for (const [, query] of rejectedQueries) {
            await expect(runQuery(query)).rejects.toThrow();
        }

        expect(sqlite.prepare("SELECT type, name, sql FROM sqlite_schema ORDER BY type, name").all()).toEqual(beforeSchema);
        expect(sqlite.prepare("SELECT id, title FROM games ORDER BY id").all()).toEqual(beforeRows);
    });

    it("enforces the shared policy through HTTP and canvas actions", async () => {
        const entries = sqlite.prepare("SELECT id, title FROM games ORDER BY id").all();
        const beforeSchema = sqlite.prepare("SELECT type, name, sql FROM sqlite_schema ORDER BY type, name").all();
        const started = await startQueryHttpServer({
            runQuery,
            listTables: async () => ({ columns: [], rows: [], truncated: false }),
            renderHtml: () => "<!doctype html>",
        });
        server = started.server;

        const acceptedResponse = await fetch(new URL("/api/query", started.url), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: "SELECT title FROM games ORDER BY id" }),
        });
        expect(acceptedResponse.status).toBe(200);
        const acceptedData: { rows: Array<{ title: string }> } = await acceptedResponse.json();
        expect(acceptedData.rows.map((row: { title: string }) => row.title)).toEqual(["Code Quest", "Pipeline Conquest"]);

        const rejectedResponse = await fetch(new URL("/api/query", started.url), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: "DELETE FROM games" }),
        });
        expect(rejectedResponse.status).toBe(400);
        expect(await rejectedResponse.json()).toEqual({
            error: "Only read-only SELECT and WITH queries are allowed.",
        });

        class TestCanvasError extends Error {
            readonly code: string;

            constructor(code: string, message: string) {
                super(message);
                this.code = code;
            }
        }
        const canvasHandler = createCanvasQueryHandler(runQuery, TestCanvasError);
        await expect(canvasHandler({ input: { query: "SELECT title FROM games ORDER BY id" } })).resolves.toMatchObject({
            rows: [{ title: "Code Quest" }, { title: "Pipeline Conquest" }],
        });
        await expect(canvasHandler({ input: { query: "DELETE FROM games" } })).rejects.toMatchObject({
            code: "database_query_invalid",
            message: "Only read-only SELECT and WITH queries are allowed.",
        });

        expect(sqlite.prepare("SELECT id, title FROM games ORDER BY id").all()).toEqual(entries);
        expect(sqlite.prepare("SELECT type, name, sql FROM sqlite_schema ORDER BY type, name").all()).toEqual(beforeSchema);
    });
});

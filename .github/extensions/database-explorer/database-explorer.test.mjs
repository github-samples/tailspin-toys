import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHttpHandler } from "./http-handler.mjs";
import { createCanvasRunQueryHandler } from "./query-handlers.mjs";
import { validateReadOnlyQuery } from "./sql-policy.mjs";

describe("Database Explorer read-only SQL policy", () => {
    let database;
    let executeQuery;
    let canvasHandler;
    let server;
    let serverUrl;

    beforeEach(async () => {
        database = new DatabaseSync(":memory:");
        database.exec("CREATE TABLE fixtures (id INTEGER PRIMARY KEY, label TEXT NOT NULL); INSERT INTO fixtures (label) VALUES ('original');");
        executeQuery = vi.fn((_url, query) => {
            const result = database.prepare(query).all();
            return {
                columns: result.length > 0 ? Object.keys(result[0]) : [],
                rows: result,
                truncated: false,
            };
        });

        canvasHandler = createCanvasRunQueryHandler({
            getDatabaseUrl: () => ":memory:",
            executeQuery,
            CanvasError: class CanvasError extends Error {
                constructor(code, message) {
                    super(message);
                    this.code = code;
                }
            },
        });

        server = createServer(createHttpHandler({
            url: ":memory:",
            listTables: async () => [],
            executeQuery,
            renderHtml: () => "<html></html>",
        }));
        await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
        serverUrl = `http://127.0.0.1:${server.address().port}`;
    });

    afterEach(async () => {
        await new Promise((resolve, reject) => {
            server.close((error) => error ? reject(error) : resolve());
        });
        database.close();
    });

    async function postQuery(query) {
        const response = await fetch(`${serverUrl}/api/query`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query }),
        });
        return { status: response.status, body: await response.json() };
    }

    function fixtureRows() {
        return database.prepare("SELECT id, label FROM fixtures ORDER BY id").all();
    }

    function schema() {
        return database.prepare(
            "SELECT type, name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name",
        ).all();
    }

    it.each([
        ["plain SELECT", "SELECT label FROM fixtures WHERE id = 1"],
        ["read-only CTE", "WITH selected AS (SELECT label FROM fixtures) SELECT label FROM selected"],
        ["quoted CTE keyword", 'WITH "delete" AS (SELECT label FROM fixtures) SELECT label FROM "delete"'],
        ["quoted semicolon and comments", "/* safe; comment */ SELECT 'a; b' AS value -- trailing comment;\n"],
        ["bracket-quoted identifier", "SELECT [label] FROM fixtures"],
    ])("accepts %s queries", async (_description, query) => {
        const result = await executeQuery(":memory:", validateReadOnlyQuery(query));

        expect(result.rows).toHaveLength(1);
        expect(executeQuery).toHaveBeenCalledOnce();
    });

    it.each([
        ["empty input", "   ", "Enter a SQL query."],
        ["non-string input", null, "Enter a SQL query."],
        ["unclosed SQL string", "SELECT 'unfinished", "The SQL string is not closed."],
        ["unclosed SQL comment", "SELECT 1 /* unfinished", "The SQL comment is not closed."],
        ["malformed CTE", "WITH selected AS (SELECT 1 SELECT 1", "Only read-only SELECT and WITH queries are allowed."],
        ["multiple statements", "SELECT 1; DELETE FROM fixtures", "Run one SQL statement at a time."],
    ])("rejects %s with an explicit error", (_description, query, message) => {
        expect(() => validateReadOnlyQuery(query)).toThrow(message);
    });

    it.each([
        ["INSERT", "INSERT INTO fixtures (label) VALUES ('injected')"],
        ["UPDATE", "UPDATE fixtures SET label = 'changed'"],
        ["DELETE", "DELETE FROM fixtures"],
        ["CREATE", "CREATE TABLE unexpected (id INTEGER)"],
        ["ALTER", "ALTER TABLE fixtures ADD COLUMN unexpected TEXT"],
        ["DROP", "DROP TABLE fixtures"],
        ["WITH ... INSERT", "WITH source AS (SELECT 'injected' AS label) INSERT INTO fixtures (label) SELECT label FROM source"],
        ["WITH ... UPDATE", "WITH source AS (SELECT 'changed' AS label) UPDATE fixtures SET label = (SELECT label FROM source)"],
        ["WITH ... DELETE", "WITH target AS (SELECT id FROM fixtures) DELETE FROM fixtures WHERE id IN (SELECT id FROM target)"],
    ])("rejects %s consistently through HTTP and canvas without mutation", async (_description, query) => {
        const originalRows = fixtureRows();
        const originalSchema = schema();
        executeQuery.mockClear();

        const httpResult = await postQuery(query);
        expect(httpResult.status).toBe(400);
        expect(httpResult.body.error).toMatch(/read-only SELECT and WITH/);

        await expect(canvasHandler({ input: { query } })).rejects.toMatchObject({
            code: "database_query_invalid",
            message: expect.stringMatching(/read-only SELECT and WITH/),
        });

        expect(executeQuery).not.toHaveBeenCalled();
        expect(fixtureRows()).toEqual(originalRows);
        expect(schema()).toEqual(originalSchema);
    });

    it("executes accepted SQL through both entry points", async () => {
        const query = "WITH selected AS (SELECT label FROM fixtures) SELECT label FROM selected";

        const httpResult = await postQuery(query);
        const canvasResult = await canvasHandler({ input: { query } });

        expect(httpResult.status).toBe(200);
        expect(httpResult.body.rows).toEqual([{ label: "original" }]);
        expect(canvasResult.rows).toEqual([{ label: "original" }]);
        expect(executeQuery).toHaveBeenCalledTimes(2);
    });
});

import { describe, expect, it } from "vitest";
import { validateReadOnlyQuery } from "./query-validation.mjs";

describe("validateReadOnlyQuery", () => {
    it.each([
        "WITH games_to_delete AS (SELECT id FROM games) DELETE FROM games",
        "WITH games_to_update AS (SELECT id FROM games) UPDATE games SET title = 'changed'",
        "WITH new_game AS (SELECT 'new' AS title) INSERT INTO games (title) SELECT title FROM new_game",
        "WITH games_to_delete AS (SELECT id FROM games) DELETE FROM games RETURNING id",
        "DELETE FROM games",
        "UPDATE games SET title = 'changed'",
        "INSERT INTO games (title) VALUES ('new')",
        "CREATE TABLE unexpected (id INTEGER)",
        "PRAGMA query_only = OFF",
    ])("rejects writes and non-query statements: %s", (query) => {
        expect(() => validateReadOnlyQuery(query)).toThrow(
            "Only read-only SELECT and WITH queries are allowed.",
        );
    });

    it.each([
        "SELECT * FROM games",
        "WITH recent_games AS (SELECT * FROM games) SELECT * FROM recent_games",
        "WITH RECURSIVE numbers(value) AS (SELECT 1 UNION ALL SELECT value + 1 FROM numbers WHERE value < 3) SELECT * FROM numbers",
        "WITH first AS MATERIALIZED (SELECT 1), second AS NOT MATERIALIZED (SELECT 2) SELECT * FROM first UNION ALL SELECT * FROM second",
        "WITH [select] AS (SELECT 1) SELECT * FROM [select]",
    ])("allows read-only query: %s", (query) => {
        expect(validateReadOnlyQuery(query)).toBe(query);
    });

    it("preserves comments, string literals, and the single-statement guard", () => {
        expect(validateReadOnlyQuery("-- comment\nSELECT '; -- value'")).toBe("SELECT '; -- value'");
        expect(() => validateReadOnlyQuery("SELECT 1; DELETE FROM games")).toThrow(
            "Run one SQL statement at a time.",
        );
    });

    it("does not treat semicolons inside bracketed identifiers as statement separators", () => {
        expect(validateReadOnlyQuery("SELECT [value;name]")).toBe("SELECT [value;name]");
    });

    it("rejects malformed or ambiguous WITH statements", () => {
        expect(() => validateReadOnlyQuery("WITH games_to_delete")).toThrow(
            "Only read-only SELECT and WITH queries are allowed.",
        );
        expect(() => validateReadOnlyQuery("WITH games_to_delete AS (SELECT 1) DELETE FROM games")).toThrow(
            "Only read-only SELECT and WITH queries are allowed.",
        );
    });
});

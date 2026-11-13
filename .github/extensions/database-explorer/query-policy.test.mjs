import { describe, expect, it, vi } from "vitest";
import { executeReadOnlyQuery, validateReadOnlyQuery } from "./query-policy.mjs";

describe("Database Explorer query policy", () => {
    it.each([
        ["plain SELECT", "SELECT id FROM games", "SELECT id FROM games"],
        ["quoted semicolon", "SELECT ';' AS value;", "SELECT ';' AS value"],
        ["comments", "/* note */ SELECT id FROM games -- trailing comment", "SELECT id FROM games"],
        [
            "read-only CTE",
            "WITH selected AS (SELECT id FROM games) SELECT id FROM selected",
            "WITH selected AS (SELECT id FROM games) SELECT id FROM selected",
        ],
    ])("normalizes a supported %s query", (_name, input, expected) => {
        expect(validateReadOnlyQuery(input)).toBe(expected);
    });

    it.each([
        ["non-string input", null],
        ["empty input", ""],
        ["whitespace input", " \t "],
        ["direct mutation", "DELETE FROM games"],
        ["multiple statements", "SELECT id FROM games; DELETE FROM games"],
        ["unterminated string", "SELECT 'unfinished"],
        ["unterminated comment", "SELECT 1 /* unfinished"],
    ])("rejects %s", (_name, input) => {
        expect(() => validateReadOnlyQuery(input)).toThrow();
    });

    it("passes a normalized supported query to the executor", () => {
        const execute = vi.fn((query) => query);
        const rows = executeReadOnlyQuery(
            "SELECT id FROM games;",
            execute,
        );

        expect(rows).toBe("SELECT id FROM games");
        expect(execute).toHaveBeenCalledExactlyOnceWith("SELECT id FROM games");
    });

    it("does not invoke the executor for a rejected query", () => {
        const execute = vi.fn();

        expect(() => executeReadOnlyQuery("DELETE FROM games", execute)).toThrow();
        expect(execute).not.toHaveBeenCalled();
    });
});

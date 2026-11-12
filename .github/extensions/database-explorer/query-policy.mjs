export const MAX_DISPLAY_ROWS = 250;

export function stripCommentsAndValidateSingleStatement(sql) {
    let output = "";
    let quote = "";
    let statementEnded = false;

    for (let index = 0; index < sql.length; index += 1) {
        const character = sql[index];
        const next = sql[index + 1];

        if (quote) {
            output += character;
            if (character === quote) {
                if (next === quote) {
                    output += next;
                    index += 1;
                } else {
                    quote = "";
                }
            }
            continue;
        }

        if (character === "'" || character === '"' || character === "`") {
            quote = character;
            output += character;
            continue;
        }

        if (character === "-" && next === "-") {
            index = sql.indexOf("\n", index + 2);
            if (index === -1) {
                break;
            }
            output += " ";
            continue;
        }

        if (character === "/" && next === "*") {
            const end = sql.indexOf("*/", index + 2);
            if (end === -1) {
                throw new Error("The SQL comment is not closed.");
            }
            index = end + 1;
            output += " ";
            continue;
        }

        if (character === ";") {
            statementEnded = true;
            continue;
        }

        if (statementEnded && !/\s/.test(character)) {
            throw new Error("Run one SQL statement at a time.");
        }

        output += character;
    }

    if (quote) {
        throw new Error("The SQL string is not closed.");
    }

    return output.trim();
}

export function validateReadOnlyQuery(query) {
    if (typeof query !== "string" || !query.trim()) {
        throw new Error("Enter a SQL query.");
    }

    const statement = stripCommentsAndValidateSingleStatement(query);
    const keyword = statement.match(/^([a-zA-Z]+)/)?.[1]?.toUpperCase();
    if (keyword !== "SELECT" && keyword !== "WITH") {
        throw new Error("Only read-only SELECT and WITH queries are allowed.");
    }

    return statement;
}

function normalizeValue(value) {
    return typeof value === "bigint" ? value.toString() : value;
}

export async function executeQuery(url, query) {
    // Loaded lazily: the host provides @libsql/client, and tests inject their own executor.
    const { createClient } = await import("@libsql/client");
    const client = createClient({ url });
    try {
        const result = await client.execute(query);
        const columns = result.columns;
        const rows = result.rows.slice(0, MAX_DISPLAY_ROWS).map((row) =>
            Object.fromEntries(columns.map((column) => [column, normalizeValue(row[column])])),
        );
        return { columns, rows, truncated: result.rows.length > MAX_DISPLAY_ROWS };
    } finally {
        client.close();
    }
}

// Single path shared by the HTTP and canvas entry points: validate first, execute only on success.
export async function runQuery(url, query, execute = executeQuery) {
    return execute(url, validateReadOnlyQuery(query));
}

export async function listTables(url, execute = executeQuery) {
    return execute(
        url,
        "SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY type, name",
    );
}

export function createRunQueryHandler({ getUrl, execute = executeQuery, createError }) {
    return async (ctx) => {
        try {
            return await runQuery(getUrl(), ctx.input?.query, execute);
        } catch (error) {
            throw createError("database_query_invalid", error instanceof Error ? error.message : "The query is invalid.");
        }
    };
}

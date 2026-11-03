function stripCommentsAndValidateSingleStatement(sql) {
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

        if (character === "'" || character === '"' || character === "`" || character === "[") {
            quote = character === "[" ? "]" : character;
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

function firstStatementKeyword(statement) {
    const firstKeyword = statement.match(/^([a-zA-Z]+)/)?.[1]?.toUpperCase();
    if (firstKeyword !== "WITH") {
        return firstKeyword;
    }

    let depth = 0;
    let quote = "";
    for (let index = 0; index < statement.length; index += 1) {
        const character = statement[index];
        const next = statement[index + 1];

        if (quote) {
            if (character === quote) {
                if (next === quote) {
                    index += 1;
                } else {
                    quote = "";
                }
            }
            continue;
        }

        if (character === "'" || character === '"' || character === "`" || character === "[") {
            quote = character === "[" ? "]" : character;
            continue;
        }
        if (character === "(") {
            depth += 1;
            continue;
        }
        if (character === ")") {
            depth -= 1;
            continue;
        }

        if (depth === 0 && /[a-zA-Z]/.test(character)) {
            const keyword = statement.slice(index).match(/^[a-zA-Z]+/)?.[0]?.toUpperCase();
            if (keyword && ["SELECT", "INSERT", "UPDATE", "DELETE", "REPLACE"].includes(keyword)) {
                return keyword;
            }
            if (keyword) {
                index += keyword.length - 1;
            }
        }
    }

    return "WITH";
}

export function validateReadOnlyQuery(query) {
    if (typeof query !== "string" || !query.trim()) {
        throw new Error("Enter a SQL query.");
    }

    const statement = stripCommentsAndValidateSingleStatement(query);
    const keyword = firstStatementKeyword(statement);
    if (keyword !== "SELECT" && keyword !== "WITH") {
        throw new Error("Only read-only SELECT and WITH queries are allowed.");
    }

    return statement;
}

export function createReadOnlyQueryRunner(executeQuery) {
    return async (query) => executeQuery(validateReadOnlyQuery(query));
}

export function createCanvasQueryHandler(runQuery, CanvasError) {
    return async (ctx) => {
        try {
            return await runQuery(ctx.input?.query);
        } catch (error) {
            throw new CanvasError("database_query_invalid", error instanceof Error ? error.message : "The query is invalid.");
        }
    };
}

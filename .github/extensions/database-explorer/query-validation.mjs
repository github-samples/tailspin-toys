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
                if (quote !== "]" && next === quote) {
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

        if (character === "[") {
            quote = "]";
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
        throw new Error("The SQL string or identifier is not closed.");
    }

    return output.trim();
}

function tokenizeSql(sql) {
    const tokens = [];
    let index = 0;

    while (index < sql.length) {
        const character = sql[index];

        if (/\s/.test(character)) {
            index += 1;
            continue;
        }

        if (character === "'" || character === '"' || character === "`" || character === "[") {
            const closingQuote = character === "[" ? "]" : character;
            const type = character === "'" ? "string" : "identifier";
            index += 1;
            let closed = false;

            while (index < sql.length) {
                if (sql[index] === closingQuote) {
                    if (closingQuote !== "]" && sql[index + 1] === closingQuote) {
                        index += 2;
                        continue;
                    }
                    index += 1;
                    closed = true;
                    break;
                }
                index += 1;
            }

            if (!closed) {
                throw new Error("The SQL string or identifier is not closed.");
            }
            tokens.push({ type, value: "" });
            continue;
        }

        if (character === "(" || character === ")" || character === ",") {
            tokens.push({ type: "punctuation", value: character });
            index += 1;
            continue;
        }

        const start = index;
        while (
            index < sql.length
            && !/\s/.test(sql[index])
            && sql[index] !== "("
            && sql[index] !== ")"
            && sql[index] !== ","
            && sql[index] !== "'"
            && sql[index] !== '"'
            && sql[index] !== "`"
            && sql[index] !== "["
        ) {
            index += 1;
        }
        tokens.push({ type: "word", value: sql.slice(start, index) });
    }

    return tokens;
}

function skipParenthesizedExpression(tokens, start) {
    if (tokens[start]?.value !== "(") {
        return -1;
    }

    let depth = 0;
    for (let index = start; index < tokens.length; index += 1) {
        if (tokens[index].value === "(") {
            depth += 1;
        } else if (tokens[index].value === ")") {
            depth -= 1;
            if (depth === 0) {
                return index + 1;
            }
        }
    }
    return -1;
}

function mainKeywordAfterWith(tokens) {
    let index = 1;
    if (tokens[index]?.value.toUpperCase() === "RECURSIVE") {
        index += 1;
    }

    while (index < tokens.length) {
        const name = tokens[index];
        if (!name || (name.type !== "word" && name.type !== "identifier")) {
            return "";
        }
        index += 1;

        if (tokens[index]?.value === "(") {
            index = skipParenthesizedExpression(tokens, index);
            if (index === -1) {
                return "";
            }
        }

        if (tokens[index]?.value.toUpperCase() !== "AS") {
            return "";
        }
        index += 1;

        if (tokens[index]?.value.toUpperCase() === "NOT") {
            index += 1;
            if (tokens[index]?.value.toUpperCase() !== "MATERIALIZED") {
                return "";
            }
            index += 1;
        } else if (tokens[index]?.value.toUpperCase() === "MATERIALIZED") {
            index += 1;
        }

        index = skipParenthesizedExpression(tokens, index);
        if (index === -1) {
            return "";
        }

        if (tokens[index]?.value === ",") {
            index += 1;
            continue;
        }

        return tokens[index]?.type === "word" ? tokens[index].value.toUpperCase() : "";
    }

    return "";
}

export function validateReadOnlyQuery(query) {
    if (typeof query !== "string" || !query.trim()) {
        throw new Error("Enter a SQL query.");
    }

    const statement = stripCommentsAndValidateSingleStatement(query);
    const tokens = tokenizeSql(statement);
    const keyword = tokens[0]?.value.toUpperCase();
    if (keyword !== "SELECT" && keyword !== "WITH") {
        throw new Error("Only read-only SELECT and WITH queries are allowed.");
    }

    if (keyword === "WITH" && mainKeywordAfterWith(tokens) !== "SELECT") {
        throw new Error("Only read-only SELECT and WITH queries are allowed.");
    }

    return statement;
}

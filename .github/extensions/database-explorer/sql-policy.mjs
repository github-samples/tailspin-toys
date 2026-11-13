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

function tokenize(statement) {
    const tokens = [];

    for (let index = 0; index < statement.length; index += 1) {
        const character = statement[index];
        if (/\s/.test(character)) {
            continue;
        }

        if (character === "'" || character === '"' || character === "`" || character === "[") {
            const quote = character === "[" ? "]" : character;
            index += 1;
            while (index < statement.length) {
                if (statement[index] === quote) {
                    if (quote !== "]" && statement[index + 1] === quote) {
                        index += 2;
                        continue;
                    }
                    break;
                }
                index += 1;
            }
            tokens.push({ type: "quoted" });
            continue;
        }

        if (/[a-zA-Z_]/.test(character)) {
            let end = index + 1;
            while (end < statement.length && /[a-zA-Z0-9_$]/.test(statement[end])) {
                end += 1;
            }
            tokens.push({ type: "word", value: statement.slice(index, end).toUpperCase() });
            index = end - 1;
            continue;
        }

        tokens.push({ type: character === "(" || character === ")" || character === "," ? character : "other" });
    }

    return tokens;
}

function skipParenthesized(tokens, start) {
    let depth = 0;
    for (let index = start; index < tokens.length; index += 1) {
        if (tokens[index].type === "(") {
            depth += 1;
        } else if (tokens[index].type === ")") {
            depth -= 1;
            if (depth === 0) {
                return index + 1;
            }
        }
    }
    return -1;
}

function withQueryOperation(statement) {
    const tokens = tokenize(statement);
    let index = 1;

    if (tokens[index]?.value === "RECURSIVE") {
        index += 1;
    }

    while (index < tokens.length) {
        if (tokens[index].type !== "word" && tokens[index].type !== "quoted") {
            return undefined;
        }
        index += 1;

        if (tokens[index]?.type === "(") {
            index = skipParenthesized(tokens, index);
            if (index === -1) {
                return undefined;
            }
        }

        if (tokens[index]?.value !== "AS") {
            return undefined;
        }
        index += 1;

        if (tokens[index]?.value === "NOT" && tokens[index + 1]?.value === "MATERIALIZED") {
            index += 2;
        } else if (tokens[index]?.value === "MATERIALIZED") {
            index += 1;
        }

        if (tokens[index]?.type !== "(") {
            return undefined;
        }
        index = skipParenthesized(tokens, index);
        if (index === -1) {
            return undefined;
        }

        if (tokens[index]?.type !== ",") {
            return tokens[index]?.type === "word" ? tokens[index].value : undefined;
        }
        index += 1;
    }

    return undefined;
}

export function validateReadOnlyQuery(query) {
    if (typeof query !== "string" || !query.trim()) {
        throw new Error("Enter a SQL query.");
    }

    const statement = stripCommentsAndValidateSingleStatement(query);
    const keyword = statement.match(/^([a-zA-Z]+)/)?.[1]?.toUpperCase();
    const operation = keyword === "WITH" ? withQueryOperation(statement) : keyword;

    if (operation !== "SELECT") {
        throw new Error("Only read-only SELECT and WITH queries are allowed.");
    }

    return statement;
}

/**
 * @param {string} sql
 * @returns {string}
 */
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

/**
 * @param {unknown} query
 * @returns {string}
 */
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

import { createClient } from "@libsql/client";
import { CanvasError, createCanvas, joinSession } from "@github/copilot-sdk/extension";
import {
    MAX_DISPLAY_ROWS,
    createDatabaseExplorerCanvas,
    databaseUrl,
    executeQuery as executeQueryWithClient,
    listTables as listTablesWithClient,
    normalizeValue,
    readRequestBody,
    renderHtml,
    startServer as startServerWithClient,
    stripCommentsAndValidateSingleStatement,
    validateReadOnlyQuery,
} from "./query-policy.mjs";

const servers = new Map();

async function executeQuery(url, query) {
    return executeQueryWithClient(url, query, { createClient });
}

async function listTables(url) {
    return listTablesWithClient(url, { createClient });
}

async function startServer(url) {
    return startServerWithClient(url, { createClient });
}

export {
    MAX_DISPLAY_ROWS,
    databaseUrl,
    executeQuery,
    listTables,
    normalizeValue,
    readRequestBody,
    renderHtml,
    startServer,
    stripCommentsAndValidateSingleStatement,
    validateReadOnlyQuery,
};

await joinSession({
    canvases: [
        createDatabaseExplorerCanvas({
            createCanvas,
            CanvasError,
            createClient,
            resolveDatabaseUrl: databaseUrl,
            servers,
        }),
    ],
});

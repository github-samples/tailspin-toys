import { validateReadOnlyQuery } from "./sql-policy.mjs";

export function executeReadOnlyQuery(url, query, executeQuery) {
    return executeQuery(url, validateReadOnlyQuery(query));
}

export function createCanvasRunQueryHandler({ getDatabaseUrl, executeQuery, CanvasError }) {
    return async (context) => {
        try {
            return executeReadOnlyQuery(getDatabaseUrl(), context.input?.query, executeQuery);
        } catch (error) {
            throw new CanvasError(
                "database_query_invalid",
                error instanceof Error ? error.message : "The query is invalid.",
            );
        }
    };
}

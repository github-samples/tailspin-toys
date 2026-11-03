export function validateReadOnlyQuery(query: unknown): string;

export function createReadOnlyQueryRunner<T>(
    executeQuery: (query: string) => T | Promise<T>,
): (query: unknown) => Promise<T>;

export function createCanvasQueryHandler<T>(
    runQuery: (query: unknown) => Promise<T>,
    CanvasError: new (code: string, message: string) => Error,
): (ctx: { input?: { query?: unknown } }) => Promise<T>;

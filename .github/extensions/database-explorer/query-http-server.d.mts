import type { Server } from "node:http";

export function startQueryHttpServer(options: {
    runQuery: (query: unknown) => Promise<unknown>;
    listTables: () => Promise<unknown>;
    renderHtml: () => string;
}): Promise<{ server: Server; url: string }>;

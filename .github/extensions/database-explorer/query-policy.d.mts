import type { IncomingMessage, Server } from 'node:http';

export const MAX_DISPLAY_ROWS: number;

export interface RawQueryResult {
    columns: string[];
    rows: Array<Record<string, unknown>>;
}

export interface DatabaseExplorerClient {
    execute(query: string): Promise<RawQueryResult> | RawQueryResult;
    close(): void;
}

export type CreateClientFn = (options: { url: string }) => DatabaseExplorerClient;

export interface QueryExecutionOptions {
    createClient?: CreateClientFn;
}

export interface NormalizedQueryResult {
    columns: string[];
    rows: Array<Record<string, unknown>>;
    truncated: boolean;
}

export interface ServerEntry {
    server: Server;
    url: string;
}

export interface CanvasActionContext {
    input?: {
        query?: unknown;
    };
}

export interface CanvasLifecycleContext {
    instanceId: string;
}

export interface CanvasActionDefinition {
    name: string;
    description: string;
    inputSchema?: Record<string, unknown>;
    handler: (ctx?: CanvasActionContext) => Promise<NormalizedQueryResult>;
}

export interface CanvasDefinition {
    id: string;
    displayName: string;
    description: string;
    actions: CanvasActionDefinition[];
    open: (ctx: CanvasLifecycleContext) => Promise<{ title: string; url: string }>;
    onClose: (ctx: CanvasLifecycleContext) => Promise<void>;
}

export interface CanvasErrorConstructor {
    new (code: string, message: string): Error & { code?: string };
}

export interface CreateDatabaseExplorerCanvasOptions {
    createCanvas?: <T extends CanvasDefinition>(config: T) => T;
    CanvasError?: CanvasErrorConstructor;
    createClient?: CreateClientFn;
    resolveDatabaseUrl?: () => string;
    servers?: Map<string, ServerEntry>;
}

export function databaseUrl(): string;
export function readRequestBody(request: IncomingMessage): Promise<string>;
export function stripCommentsAndValidateSingleStatement(sql: string): string;
export function validateReadOnlyQuery(query: unknown): string;
export function normalizeValue(value: unknown): unknown;
export function executeQuery(
    url: string,
    query: string,
    options?: QueryExecutionOptions,
): Promise<NormalizedQueryResult>;
export function listTables(
    url: string,
    options?: QueryExecutionOptions,
): Promise<NormalizedQueryResult>;
export function renderHtml(): string;
export function startServer(
    url: string,
    options?: QueryExecutionOptions,
): Promise<ServerEntry>;
export function createDatabaseExplorerCanvas(
    options?: CreateDatabaseExplorerCanvasOptions,
): CanvasDefinition;

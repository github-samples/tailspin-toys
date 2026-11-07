import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';
import { createRunQueryHandler, runQuery, validateReadOnlyQuery } from './query-policy.mjs';
import { startServer } from './server.mjs';

interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  truncated: boolean;
}

type Executor = (url: string, query: string) => Promise<QueryResult>;

const FIXTURE_SQL = `
  CREATE TABLE games (id INTEGER PRIMARY KEY, title TEXT NOT NULL, note TEXT);
  INSERT INTO games (id, title, note) VALUES
    (1, 'Code Quest', 'plain'),
    (2, 'Merge Conflict', 'has ; semicolon and -- dashes'),
    (3, 'Null Pointer', NULL);
  CREATE VIEW game_titles AS SELECT title FROM games;
`;

const ACCEPTED_QUERIES: { name: string; query: string; rows: Record<string, unknown>[] }[] = [
  { name: 'plain select', query: 'SELECT id, title FROM games WHERE id = 1', rows: [{ id: 1, title: 'Code Quest' }] },
  { name: 'trailing semicolon', query: 'SELECT title FROM games WHERE id = 3;', rows: [{ title: 'Null Pointer' }] },
  { name: 'leading line comment', query: '-- header\nSELECT title FROM games WHERE id = 1', rows: [{ title: 'Code Quest' }] },
  { name: 'block comment', query: 'SELECT /* ignored */ title FROM games WHERE id = 1', rows: [{ title: 'Code Quest' }] },
  {
    name: 'quoted semicolon and dashes preserved',
    query: "SELECT id FROM games WHERE note = 'has ; semicolon and -- dashes'",
    rows: [{ id: 2 }],
  },
  { name: 'lowercase keyword', query: "select title from game_titles where title = 'Code Quest'", rows: [{ title: 'Code Quest' }] },
  {
    name: 'WITH query',
    query: 'WITH t AS (SELECT title FROM games WHERE id = 2) SELECT title FROM t',
    rows: [{ title: 'Merge Conflict' }],
  },
];

const REJECTED_QUERIES: { name: string; query: unknown }[] = [
  { name: 'undefined', query: undefined },
  { name: 'null', query: null },
  { name: 'number', query: 42 },
  { name: 'object', query: { sql: 'SELECT 1' } },
  { name: 'empty string', query: '' },
  { name: 'whitespace only', query: '   \n\t ' },
  { name: 'comment only', query: '-- nothing here' },
  { name: 'multiple selects', query: 'SELECT 1; SELECT 2' },
  { name: 'select then delete', query: 'SELECT 1; DELETE FROM games' },
  { name: 'unclosed block comment', query: 'SELECT 1 /* oops' },
  { name: 'unclosed string', query: "SELECT 'oops" },
  { name: 'insert', query: "INSERT INTO games (title) VALUES ('x')" },
  { name: 'update', query: "UPDATE games SET title = 'x'" },
  { name: 'delete', query: 'DELETE FROM games' },
  { name: 'drop table', query: 'DROP TABLE games' },
  { name: 'create table', query: 'CREATE TABLE extra (id INTEGER)' },
  { name: 'alter table', query: 'ALTER TABLE games ADD COLUMN extra TEXT' },
  { name: 'pragma', query: 'PRAGMA writable_schema = ON' },
  { name: 'attach', query: "ATTACH DATABASE ':memory:' AS other" },
  { name: 'vacuum', query: 'VACUUM' },
  { name: 'comment hiding delete', query: '-- SELECT 1\nDELETE FROM games' },
  { name: 'block comment hiding drop', query: '/* SELECT */ DROP TABLE games' },
];

let directory: string;
let databasePath: string;

function createExecutor(): Executor & ReturnType<typeof vi.fn> {
  return vi.fn(async (_url: string, query: string): Promise<QueryResult> => {
    const database = new DatabaseSync(databasePath);
    try {
      const rows = database.prepare(query).all().map((row) => ({ ...row }));
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
      return { columns, rows, truncated: false };
    } finally {
      database.close();
    }
  });
}

function snapshotDatabase(): { schema: unknown[]; games: unknown[] } {
  const database = new DatabaseSync(databasePath);
  try {
    const schema = database.prepare('SELECT type, name, sql FROM sqlite_master ORDER BY type, name').all();
    const games = database.prepare('SELECT id, title, note FROM games ORDER BY id').all();
    return { schema: schema.map((row) => ({ ...row })), games: games.map((row) => ({ ...row })) };
  } finally {
    database.close();
  }
}

async function messageOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error('Expected the promise to reject.');
}

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'database-explorer-'));
  databasePath = join(directory, 'fixture.db');
  const database = new DatabaseSync(databasePath);
  database.exec(FIXTURE_SQL);
  database.close();
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

describe('database explorer read-only query policy', () => {
  it('accepts supported read-only single-statement queries', async () => {
    const execute = createExecutor();

    for (const { query, rows } of ACCEPTED_QUERIES) {
      const result = await runQuery('file:fixture', query, execute);
      expect(result.rows, query).toEqual(rows);
    }
  });

  it('strips comments and trailing semicolons without changing quoted values', () => {
    expect(validateReadOnlyQuery("SELECT /* c */ 'a -- b; c' -- tail\n;")).toBe("SELECT   'a -- b; c'");
  });

  it.each(REJECTED_QUERIES)('rejects invalid input and requests outside the read-only contract: $name', async ({ query }) => {
    const message = await messageOf(runQuery('file:fixture', query as string, createExecutor()));
    expect(message).toMatch(/\S/);
  });

  it('does not invoke the query executor after validation rejects a request', async () => {
    const execute = createExecutor();

    for (const { query } of REJECTED_QUERIES) {
      await messageOf(runQuery('file:fixture', query as string, execute));
    }

    expect(execute).not.toHaveBeenCalled();
  });

  it('preserves fixture rows and schema while serving the read-only interface', async () => {
    const before = snapshotDatabase();
    const execute = createExecutor();

    for (const { query } of ACCEPTED_QUERIES) {
      await runQuery('file:fixture', query, execute);
    }
    for (const { query } of REJECTED_QUERIES) {
      await messageOf(runQuery('file:fixture', query as string, execute));
    }

    expect(snapshotDatabase()).toEqual(before);
    expect(before.games).toHaveLength(3);
  });
});

describe('database explorer entry points', () => {
  let server: Server | undefined;
  let baseUrl: string;
  let execute: ReturnType<typeof createExecutor>;

  beforeEach(async () => {
    execute = createExecutor();
    const started = await startServer('file:fixture', () => '<html></html>', execute);
    server = started.server;
    baseUrl = started.url.replace(/\/$/, '');
  });

  afterEach(async () => {
    await new Promise((resolve) => server?.close(resolve));
  });

  async function viaHttp(query: unknown): Promise<{ ok: boolean; result?: QueryResult; error?: string }> {
    const response = await fetch(`${baseUrl}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    const body = await response.json();
    return response.ok ? { ok: true, result: body as QueryResult } : { ok: false, error: (body as { error: string }).error };
  }

  async function viaCanvas(query: unknown): Promise<{ ok: boolean; result?: QueryResult; error?: string }> {
    const handler = createRunQueryHandler({
      getUrl: () => 'file:fixture',
      execute,
      createError: (code: string, message: string) => Object.assign(new Error(message), { code }),
    });
    try {
      return { ok: true, result: await handler({ input: { query } }) };
    } catch (error) {
      return { ok: false, error: (error as Error).message };
    }
  }

  it('applies the same policy through HTTP and canvas actions', async () => {
    for (const { query, rows } of ACCEPTED_QUERIES) {
      const http = await viaHttp(query);
      const canvas = await viaCanvas(query);
      expect(http.ok, query).toBe(true);
      expect(canvas.ok, query).toBe(true);
      expect(http.result?.rows, query).toEqual(rows);
      expect(canvas.result, query).toEqual(http.result);
    }

    const callsBeforeRejections = execute.mock.calls.length;
    for (const { name, query } of REJECTED_QUERIES) {
      const http = await viaHttp(query);
      const canvas = await viaCanvas(query);
      expect(http.ok, name).toBe(false);
      expect(canvas.ok, name).toBe(false);
      expect(canvas.error, name).toBe(http.error);
    }
    expect(execute.mock.calls.length).toBe(callsBeforeRejections);
  });

  it('keeps fixture rows and schema unchanged after rejected requests through both entry points', async () => {
    const before = snapshotDatabase();

    for (const { query } of REJECTED_QUERIES) {
      await viaHttp(query);
      await viaCanvas(query);
    }

    expect(snapshotDatabase()).toEqual(before);
  });
});

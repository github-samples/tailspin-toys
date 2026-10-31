---
description: 'Vitest guidelines for the Astro data layer and Database Explorer query contract'
applyTo: '**/*.test.ts'
---

# Unit Testing Guidelines (Vitest + Drizzle/Node SQLite)

Tests run with **Vitest** (`npm run test:unit`). They cover:

1. **Pure transforms** (`db/transforms.ts`) — CSV parsing, description building, de-duplication, deterministic ratings.
2. **Data-access helpers** (`src/lib/games.ts`) — ordering, lookups — exercised against a real in-memory **Node SQLite** database.
3. **Database Explorer** (`.github/extensions/database-explorer/query-policy.test.ts`) — production query policy and HTTP/canvas handlers, exercised against disposable file-backed databases with the extension's real **libSQL** driver.

> [!IMPORTANT]
> Keep tests independent of the Astro runtime. Helpers accept an **injectable `db`** argument; tests pass an in-memory database, pages pass the real client. Never start an Astro server to unit test data logic.

## File Structure

- Co-locate tests next to the code: `transforms.test.ts` beside `transforms.ts`, `games.test.ts` beside `games.ts`.
- Name pattern: `<module>.test.ts`.
- Use `describe('<module / function>')` blocks and `it('does X when Y')` cases.
- Add type annotations on helpers and fixtures — this codebase requires explicit types.

## Testing Pure Transforms

- No database needed — import the function and assert on its output.
- Cover: happy path, empty/whitespace input, rows with missing optional fields, de-duplication, and **determinism** (e.g. `ratingFromTitle` returns the same value for the same title and stays within 3.0–5.0).
- Prefer table-driven cases with `it.each` for input/output matrices.

```ts
import { describe, it, expect } from 'vitest';
import { ratingFromTitle } from './transforms';

describe('ratingFromTitle', () => {
  it('is deterministic and within range', () => {
    const a = ratingFromTitle('Code Quest');
    const b = ratingFromTitle('Code Quest');
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(3.0);
    expect(a).toBeLessThanOrEqual(5.0);
  });
});
```

## Testing Data-Access Helpers

- Build a fresh in-memory database per test with the shared helper `createTestDatabase()` (`db/test-helpers.ts`), which runs migrations on a `:memory:` Node SQLite client.
- Seed only the fixtures the test needs, then call the helper with that `db`.
- Always assert the cheap thing first (counts, totals, ordering) before deep object shape.

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { getAllGames, getGameById } from './games';

describe('getAllGames', () => {
  let db: Awaited<ReturnType<typeof createTestDatabase>>;

  beforeEach(async () => {
    db = await createTestDatabase();
    // …seed publishers, categories, games…
  });

  it('returns games ordered by title with their relations', async () => {
    const games = await getAllGames(db);
    const titles = games.map((g) => g.title);
    expect(titles).toEqual([...titles].sort());
    expect(games[0].category).not.toBeNull();
  });
});
```

## Required Coverage

- Success cases with valid data
- Not-found cases (`getGameById` for a missing id returns `null`)
- Empty database/collection scenarios
- Ordering guarantees (alphabetical by title) — static builds depend on this being deterministic
- Determinism of seed-derived values

## Testing Database Explorer

- Import the actual `query-policy.mjs` validator; do not copy it into tests or extract code by reading/slicing source files.
- Reuse typed accepted/rejected case tables across policy, HTTP, and canvas assertions. Check exact read results and explicit errors, not success-shaped empty fallbacks.
- The Vitest-only SDK alias points to `test-support/copilot-sdk.ts`, which captures registration without joining a host session. Invoke the production registered handlers and real loopback HTTP server.
- Use the locked `@libsql/client` development dependency for this existing extension path, not the application's Drizzle helper or a substitute driver.
- Create fresh, writable file-backed fixtures because execution opens a new client for each request. Assert known fixture data exists, then compare ordered rows and schema before/after accepted and rejected requests. Do not mask mutations with rollback or read-only fixtures.
- Forwarding spies at the client boundary may establish that policy rejection never reaches execution. Do not mock database effects.
- Assert that accepted requests execute the validated statement once. Check table listing and the 250-row display boundary as well as query results.
- Set the owned local `DATABASE_URL` before importing the extension, reject all other URLs at the test boundary, restore the environment, and avoid concurrent tests that mutate it.
- Close clients and servers on success and failure, await shutdown, and delete only the test's temporary directory. Do not run database setup hooks, use credentials, open project databases, or contact remote databases.
- Preserve the distinction between policy validation failures and driver failures; both must fail explicitly using their existing transport conventions.
- This finite regression matrix is not a full security audit. Handle newly discovered vulnerabilities under `SECURITY.md` without publishing reproduction details in the public suite.

## Best Practices

- Follow Arrange-Act-Assert.
- One behaviour per `it`; avoid asserting unrelated things in a single case.
- Don't mock the database — use in-memory Node SQLite for application helpers and disposable file-backed libSQL for the existing extension.
- Keep fixtures minimal but representative of relationships (game → publisher, game → category).
- If a schema change breaks tests, regenerate migrations with `npm run db:generate` and update fixtures.

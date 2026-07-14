---
description: 'Vitest unit test guidelines for the Astro + Drizzle/libSQL data layer'
applyTo: '**/*.test.ts'
---

# Unit Testing Guidelines (Vitest + Drizzle/libSQL)

Unit tests run with **Vitest** (`npm run test:unit`). They cover the two highest-value, framework-free layers:

1. **Pure transforms** (`db/transforms.ts`) — CSV parsing, description building, de-duplication, deterministic ratings.
2. **Data-access helpers** (`src/lib/games.ts`) — ordering, lookups — exercised against a real in-memory **libSQL** database.

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

- Build a fresh in-memory database per test with the shared helper `createTestDatabase()` (`db/test-helpers.ts`), which runs migrations on a `:memory:` libSQL client.
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

## Best Practices

- Follow Arrange-Act-Assert.
- One behaviour per `it`; avoid asserting unrelated things in a single case.
- Don't mock the database — an in-memory libSQL instance is fast and exercises real SQL/joins.
- Keep fixtures minimal but representative of relationships (game → publisher, game → category).
- If a schema change breaks tests, regenerate migrations with `npm run db:generate` and update fixtures.

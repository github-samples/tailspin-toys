---
name: quality-checks
description: Handles all test, lint, and quality-check execution for this project — running Vitest unit tests, Playwright E2E tests, and ESLint; debugging failures; verifying code changes; and validating readiness before commits, pushes, or merges. Use this skill instead of running test, lint, or verification commands (such as npm run test:unit, npm run test:e2e, or npm run lint) directly.
allowed-tools:
  - shell
---

# Quality Checks

This is a single Astro application (Astro 7 + Drizzle ORM/libSQL). All commands run from the repository root via npm scripts.

## Quick Reference

| Test Suite | Command | When to Use |
|------------|----------------------------|-------------|
| Unit tests (Vitest) | `npm run test:unit` | After any data-layer / transform / helper change |
| Frontend E2E tests (Playwright) | `npm run test:e2e` | After any UI / page / component change |
| Lint (ESLint) | `npm run lint` | After any TypeScript or Astro change |

All commands assume dependencies are installed (`npm ci`) and, for E2E, that Playwright's Chromium browser is available (`npx playwright install chromium`).

---

## Running the Verification Suite

### Unit Tests

```bash
npm run test:unit
```

- Runs Vitest (`vitest run`) over `db/**/*.test.ts` and `src/**/*.test.ts`.
- Covers the pure seed/transform functions and the Drizzle data-access helpers against an in-memory libSQL database.

### Frontend E2E Tests

```bash
npm run test:e2e
```

- Playwright's `webServer` first **builds** the static site (the `prebuild` script runs `db:migrate` + `db:seed`) and serves it with `astro preview` on port 4321.
- Runs all Playwright specs in `e2e-tests/` against the built `dist/` output (home page, game listing/detail pages, accessibility, 404).

### Lint

```bash
npm run lint
```

- Runs ESLint on all TypeScript and Astro files in the project.
- Must pass with zero errors before committing.

---

## Debugging & Troubleshooting

### Environment / Setup Failures

**Symptom**: `command not found`, missing modules, or `Cannot find package`.

```bash
npm ci
npx playwright install --with-deps chromium   # only needed for E2E
```

- Ensure Node 20+ is available: `node --version`.
- Run `npx astro sync` if editor/type errors reference missing generated Astro types.

---

### Database / Build-Time Data

**Symptom**: Empty pages, `no such table`, or a build that produces no game pages.

The SQLite database must be migrated and seeded **before** `astro build`. The `prebuild`/`predev` scripts do this automatically, but you can run it manually:

```bash
npm run db:setup     # db:migrate + db:seed
```

- The database lives at `.data/tailspin.db` (gitignored) and is regenerated from `db/games.csv`.
- To force a clean rebuild: `rm -rf .data dist && npm run build`.

---

### Port Conflicts

**Symptom**: `Address already in use` on port 4321.

```bash
lsof -ti :4321 | xargs kill
```

Then re-run the failing command. Watch for stale `astro dev`/`astro preview` servers left over from another checkout — Playwright reuses an existing server on 4321 locally.

---

### Playwright / E2E Test Failures

**Symptom**: Test timeouts, element not found, or wrong HTTP status.

1. **Browser not installed**: `npx playwright install --with-deps chromium`.
2. **Stale server reused**: A leftover dev/preview server on 4321 can serve outdated HTML. Kill it (see Port Conflicts) and re-run so the `webServer` rebuilds.
3. **Locator changed**: If a `data-testid` was renamed or removed, update the spec to match.
4. **404 expectations**: Non-existent game ids (e.g. `/game/99999`) are **real 404s** under static output — assert on the `not-found` testids, not in-page error messages.
5. **Flaky test**: Replace hard-coded waits with auto-retrying web-first assertions (see [playwright.instructions.md](../../instructions/playwright.instructions.md)). **Never use `waitForTimeout`.**

Run a single spec for faster iteration:

```bash
npx playwright test e2e-tests/games.spec.ts
```

---

### Unit Test Failures

**Symptom**: Assertion failures in `npm run test:unit`.

1. **Read the failing assertion** — Vitest prints expected vs received inline.
2. **In-memory database**: Helper tests build a fresh `:memory:` libSQL database, run migrations, and seed fixtures per test. If a schema change isn't reflected, regenerate migrations with `npm run db:generate`.
3. **Determinism**: Star ratings are derived from a stable hash of the title (`ratingFromTitle`) — never `Math.random`. A flaky rating assertion usually means non-deterministic data crept in.

Run a single file:

```bash
npx vitest run src/lib/games.test.ts
```

---

### Lint Failures

**Symptom**: ESLint errors from `npm run lint`.

1. **Auto-fix safe issues**: `npm run lint -- --fix`.
2. **Unused vars**: Prefix intentionally-unused identifiers with `_`.
3. **TypeScript type errors**: Add missing type annotations or correct incorrect types.
4. **Remaining errors after `--fix`**: Resolve manually — do not suppress with `eslint-disable` without justification.

---

### Local vs CI Divergence

**Symptom**: Tests pass locally but fail in CI (or vice versa).

- **Node version mismatch**: CI uses the current Node LTS release.
- **Database state**: CI always builds from a clean seed. Locally, delete `.data/` and rebuild if you suspect stale data.
- **Built vs dev**: CI tests the built `dist/` via `astro preview`. Reproduce locally with `npm run test:e2e` (which builds first) rather than against `astro dev`.

---

## Verification Policy

### Tests Must Pass Before Commit/Merge

- All existing tests must pass before committing changes
- Never skip or disable tests without explicit justification
- Broken tests block merges — fix them, don't ignore them
- Run the full test suite, not just tests for changed code
- New functionality must ship with appropriate test coverage

> [!NOTE]
> This skill covers **running, verifying, and debugging** tests. For **how to author** test code — structure, fixtures, naming, locators, and quality standards — follow the instructions files, which are the single source of truth:
> - Unit tests (`**/*.test.ts`): [unit-tests.instructions.md](../../instructions/unit-tests.instructions.md)
> - Frontend E2E (`e2e-tests/*.spec.ts`): [playwright.instructions.md](../../instructions/playwright.instructions.md)

---

## Pre-Commit Checklist

1. Run lint (if any frontend files changed): `npm run lint`
2. Run unit tests (if data layer / helpers changed): `npm run test:unit`
3. Run E2E tests (if UI changed): `npm run test:e2e`
4. Verify new functionality has appropriate test coverage
5. Confirm no tests were broken, skipped, or disabled

---
name: quality-checks
description: Handles all test, lint, and quality-check execution for this project — running Vitest unit tests and ESLint; debugging failures; verifying code changes; and validating readiness before commits, pushes, or merges. Use this skill instead of running test, lint, or verification commands (such as npm run test:unit or npm run lint) directly.
allowed-tools:
  - shell
---

# Quality Checks

This is a single Astro application (Astro 7 + Drizzle ORM/Node SQLite). All commands run from the repository root via npm scripts.

## Quick Reference

| Test Suite | Command | When to Use |
|------------|----------------------------|-------------|
| Unit tests (Vitest) | `npm run test:unit` | After any data-layer / transform / helper change |
| Lint (ESLint) | `npm run lint` | After any TypeScript or Astro change |
| Type check (tsgo + astro check) | `npm run typecheck:all` | After any TypeScript or Astro change |

All commands assume dependencies are installed (`npm ci`).

---

## Running the Verification Suite

### Unit Tests

```bash
npm run test:unit
```

- Runs Vitest (`vitest run`) over `db/**/*.test.ts` and `src/**/*.test.ts`.
- Covers the pure seed/transform functions and the Drizzle data-access helpers against an in-memory Node SQLite database.

### Lint

```bash
npm run lint
```

- Runs ESLint on all TypeScript and Astro files in the project.
- Must pass with zero errors before committing.

### Type check

```bash
npm run typecheck:all
```

- `npm run typecheck` runs the native **TypeScript 7** compiler (`tsgo`, from `@typescript/native-preview`) over the pure TypeScript (`db/`, `src/lib/`, `src/types/`, configs, tests) via `tsconfig.tsgo.json` (`--noEmit`).
- `npm run typecheck:astro` runs `astro sync` then `astro check` over `.astro` files (on the classic `typescript` package).
- Type checking is independent of linting — `tsgo` does not affect ESLint, which still uses the classic `typescript` package. Both must pass with zero errors before committing.

---

## Debugging & Troubleshooting

### Environment / Setup Failures

**Symptom**: `command not found`, missing modules, or `Cannot find package`.

```bash
npm ci
```

- Ensure Node 22.13+ is available: `node --version`.
- Run `npx astro sync` if editor/type errors reference missing generated Astro types.

---

### Database / Build-Time Data

**Symptom**: Empty pages, `no such table`, or a build that produces no game pages.

The SQLite database must be migrated and seeded **before** `astro build`. The `prebuild`/`predev` scripts do this automatically, but you can run it manually:

```bash
npm run db:setup     # db:migrate + db:seed
```

- The database lives at `tailspin.db` (gitignored) and is regenerated from `db/games.csv`.
- To force a clean rebuild: `rm -f tailspin.db && rm -rf dist && npm run build`.

---

### Unit Test Failures

**Symptom**: Assertion failures in `npm run test:unit`.

1. **Read the failing assertion** — Vitest prints expected vs received inline.
2. **In-memory database**: Helper tests build a fresh `:memory:` Node SQLite database, run migrations, and seed fixtures per test. If a schema change isn't reflected, regenerate migrations with `npm run db:generate`.
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
- **Database state**: CI always builds from a clean seed. Locally, delete `tailspin.db` and rebuild if you suspect stale data.

---

## Verification Policy

### Tests Must Pass Before Commit/Merge

- All existing tests must pass before committing changes
- Never skip or disable tests without explicit justification
- Broken tests block merges — fix them, don't ignore them
- Run the full test suite, not just tests for changed code
- New functionality must ship with appropriate test coverage

> [!NOTE]
> This skill covers **running, verifying, and debugging** tests. For **how to author** test code — structure, fixtures, naming, and quality standards — follow the instructions files, which are the single source of truth:
> - Unit tests (`**/*.test.ts`): [unit-tests.instructions.md](../../instructions/unit-tests.instructions.md)

---

## Pre-Commit Checklist

1. Run lint (if any frontend files changed): `npm run lint`
2. Run type check (if any TypeScript / Astro files changed): `npm run typecheck:all`
3. Run unit tests (if data layer / helpers changed): `npm run test:unit`
4. Verify new functionality has appropriate test coverage
5. Confirm no tests were broken, skipped, or disabled

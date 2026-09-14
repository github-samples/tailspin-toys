# Tailspin Toys

Tailspin Toys is a crowdfunding platform for games with a developer theme. The project is a website for a fictional game crowd-funding company, built as a single [Astro](https://astro.build/) site (fully prerendered/static output) styled with [Tailwind CSS](https://tailwindcss.com/). Its data lives in a local SQLite database accessed through [Drizzle ORM](https://orm.drizzle.team/) and Node.js's built-in SQLite driver; pages query the database directly in frontmatter at build time, so there is no separate backend service.

## Architecture

- **Astro 7** — pages, layouts, components, and routing. `output: 'static'`, so the whole site is prerendered to HTML at build time.
- **Drizzle ORM + Node SQLite** — the data layer. The schema lives in `db/schema.ts`; data is seeded from `db/games.csv`. Migrations are managed with `drizzle-kit`.
- **Tailwind CSS v4** — styling via utility classes (dark theme).
- **Vitest** — unit tests for the data layer and pure transforms.
- **Playwright** — end-to-end tests run against the built static site.

The database is migrated and seeded automatically before `dev`/`build` (via the `predev`/`prebuild` npm scripts) and is written to the gitignored `tailspin.db` file.

## Using this template

This repository is a GitHub template. When you create a new repository from it, a one-time **Bootstrap template issues** workflow (`.github/workflows/bootstrap-issues.yml`) runs automatically on the first push to `main` and opens a set of starter issues describing suggested first features. Each issue is defined by a Markdown file in `.github/bootstrap-issues/` — the first heading becomes the issue title and the remaining content becomes the body — so you can edit, add, or remove files there to control which issues are created.

The workflow only runs on repositories created from the template (the `if: ${{ !github.event.repository.is_template }}` guard skips the template itself), and after creating the issues it removes itself and the `.github/bootstrap-issues/` folder in a cleanup commit so it never runs again.

## Getting started

Install dependencies once with Node.js 22.13 or later:

```bash
npm ci
npx playwright install chromium   # only needed to run the E2E tests
```

## Launch the site

```bash
npm run dev
```

`predev` migrates and seeds the local database first. Then navigate to the [website](http://localhost:4321) to see the site!

To preview a production build instead:

```bash
npm run build      # prebuild migrates + seeds, then builds the static site
npm run preview
```

## Database

The SQLite database is built from `db/games.csv` — there is no live data to migrate.

```bash
npm run db:generate   # generate a migration after editing db/schema.ts
npm run db:migrate    # apply migrations
npm run db:seed       # seed from games.csv (idempotent)
npm run db:setup      # migrate + seed (run automatically by predev/prebuild)
```

> [!NOTE]
> Seeding is idempotent — it skips games that already exist (matched by title) rather than reconciling changed rows. CI always starts from a clean database, so it reflects `games.csv` exactly. Locally, if you edit or remove rows in `games.csv`, delete `tailspin.db` and re-run `npm run db:setup` to fully regenerate.

## Running tests

```bash
npm run test:unit   # Vitest unit tests (transforms + data-access helpers)
npm run test:e2e    # Playwright E2E tests (builds + previews the static site first)
```

## Linting

The frontend uses ESLint to enforce code quality across TypeScript and Astro files. Run it with:

```bash
npm run lint
```

ESLint is also run automatically in CI on pull requests to `main`.

## Type checking

The project runs on **TypeScript 7** (the native Go compiler, `tsgo`) for type checking, adopted side-by-side via the [`@typescript/native-preview`](https://www.npmjs.com/package/@typescript/native-preview) package. The classic `typescript` package is intentionally kept at v6 so ESLint + `typescript-eslint` and `astro check` keep working unchanged — TypeScript 7's programmatic API isn't ready for those tools yet.

```bash
npm run typecheck        # tsgo (TS 7) type-checks the pure TypeScript (db/, src/lib/, src/types/, configs, tests)
npm run typecheck:astro  # astro sync + astro check type-check .astro files (on the classic TypeScript package)
npm run typecheck:all    # both of the above
```

`tsgo` runs against [`tsconfig.tsgo.json`](tsconfig.tsgo.json), a scoped config that excludes `.astro` files (which the native compiler doesn't understand). Type checking runs automatically in CI on pull requests to `main`.

> [!NOTE]
> The native compiler is used only for type checking (`--noEmit`); the site is still built by `astro build` (Vite/esbuild). The classic `typescript` package stays on v6 until `typescript-eslint` and `@astrojs/check` support the native API (~TS 7.1); a Dependabot `ignore` in `.github/dependabot.yml` holds the classic `typescript@7` bump until then.

## Verification and troubleshooting

Run commands from the repository root after [getting started](#getting-started). Use an applicable available Copilot skill when one exists; otherwise run the documented npm commands directly. No skill is required to run these checks.

For focused iteration, run unit tests after data-layer, transform, or helper changes; lint and type checking after TypeScript or Astro changes; and a build plus E2E tests after UI, page, or component changes. Before committing or merging, run the full verification suite: `npm run lint`, `npm run typecheck:all`, `npm run test:unit`, and `npm run test:e2e`. All checks must pass with zero errors. New functionality needs appropriate coverage; do not skip or disable tests without explicit justification, and treat failing tests as merge blockers.

### Setup and test failures

- **Missing tools, packages, or browser:** Check `node --version` (22.13+ required) and the [setup instructions](#getting-started). On Linux, missing Chromium system libraries may require `npx playwright install --with-deps chromium`. Agents must obtain user approval before installing software or dependencies. For missing generated Astro types, run `npm run astro -- sync`; `npm run typecheck:astro` also performs this step.
- **Empty pages or missing tables:** `predev` and `prebuild` migrate and seed automatically. If needed, run `npm run db:setup` and check `DATABASE_URL` (default: `file:tailspin.db`). For stale seed data, see the [Database note](#database); seeding does not reconcile existing rows.
- **Port conflicts or stale HTML:** Playwright locally reuses a server already running on port 4321, including one from another checkout. Confirm the server belongs to this worktree and serves the current production build. Stop only a server you own via its original terminal or managed process handle; do not terminate an unrelated process. Once the port is available, rerun `npm run test:e2e` so Playwright builds and previews fresh `dist/` output.
- **E2E assertion failures:** Read the failing assertion and failure screenshots/videos in `test-results/`; traces are captured on the first retry. Check changed locators and `data-testid` values. Unknown game routes return real HTTP 404s: assert on the not-found page rather than an in-page error. Use auto-retrying assertions, never `waitForTimeout`. Iterate on one spec with `npm run test:e2e -- e2e-tests/games.spec.ts`.
- **Unit test failures:** Read expected versus received values and iterate with `npm run test:unit -- src/lib/games.test.ts`. Helper tests use fresh in-memory SQLite databases with migrations and fixtures; schema changes need a generated migration. Keep seed-derived values deterministic. Follow the [unit-test instructions](.github/instructions/unit-tests.instructions.md) and [Playwright instructions](.github/instructions/playwright.instructions.md) for test-authoring conventions.
- **Lint failures:** Use `npm run lint -- --fix` for auto-fixable issues and review the changes. Resolve remaining errors rather than suppressing rules without written justification; type checking is a separate check, not a replacement for lint.
- **Local versus CI differences:** Compare Node versions with CI's current LTS version and account for local database state versus CI's clean seed. Reproduce against the production build with `npm run test:e2e`, not an existing `astro dev` server.

## Copilot customizations

This template includes repository instructions and the Database Explorer canvas, but no custom agent profiles or skills. Learners create their own customizations during the workshop; the npm verification commands above work without them.

### Database Explorer Canvas

The shared **Database Explorer** canvas (`.github/extensions/database-explorer/`) provides a small UI and agent actions for browsing the project's SQLite tables and running one read-only `SELECT` or `WITH` query at a time. It uses the database at `.data/tailspin.db` (or `DATABASE_URL` when set), so run `npm run db:setup` before opening it in a fresh checkout.

### GitHub Copilot App Run Menu

The [GitHub Copilot app](https://github.com/github/github-app) reads `.github/github-app.yml` to provide project commands in its **Run** menu. New sessions automatically install dependencies; use **Run development site** to start Astro. When Astro reports its local URL, the app opens it in the browser canvas automatically. The menu also provides static build and type-check commands for on-demand validation.

## License 

This project is licensed under the terms of the MIT open source license. Please refer to the [LICENSE](./LICENSE) for the full terms.

## Maintainers 

You can find the list of maintainers in [CODEOWNERS](./.github/CODEOWNERS).

## Support

This project is provided as-is, and may be updated over time. If you have questions, please open an issue.

## Disclaimer

This app is not intended for use in a production environment, nor is it built as an example of what a production app should look like.

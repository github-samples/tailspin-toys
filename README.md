# Tailspin Toys

Tailspin Toys is a crowdfunding platform for games with a developer theme. The project is a website for a fictional game crowd-funding company, built as a single [Astro](https://astro.build/) site (fully prerendered/static output) styled with [Tailwind CSS](https://tailwindcss.com/). Its data lives in a local SQLite database accessed through [Drizzle ORM](https://orm.drizzle.team/) and Node.js's built-in SQLite driver; pages query the database directly in frontmatter at build time, so there is no separate backend service.

## Architecture

- **Astro 7** — pages, layouts, components, and routing. `output: 'static'`, so the whole site is prerendered to HTML at build time.
- **Drizzle ORM + Node SQLite** — the data layer. The schema lives in `db/schema.ts`; data is seeded from `db/games.csv`. Migrations are managed with `drizzle-kit`.
- **Tailwind CSS v4** — styling via utility classes (dark theme).
- **Vitest** — unit tests for the data layer and pure transforms.
- **Playwright** — end-to-end tests run against the built static site.

Development commands are defined in `package.json`: npm runs Astro for the dev server, static build, and preview. The `predev` and `prebuild` npm hooks run the TypeScript database migration and seed tasks in `db/`, writing to the gitignored `tailspin.db` file.

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
npm run db:export     # write the seeded catalog to db/catalog.json
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

## License 

This project is licensed under the terms of the MIT open source license. Please refer to the [LICENSE](./LICENSE) for the full terms.

## Maintainers 

You can find the list of maintainers in [CODEOWNERS](./.github/CODEOWNERS).

## Support

This project is provided as-is, and may be updated over time. If you have questions, please open an issue.

## Disclaimer

This app is not intended for use in a production environment, nor is it built as an example of what a production app should look like.

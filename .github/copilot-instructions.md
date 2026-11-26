# Intero Interior Design Workspace Guidelines

Intero is an interior-design workspace built with **Astro 7** and **Tailwind CSS v4**. Astro prerenders the UI into `dist/`; the Node.js `server.mjs` host serves those files and provides same-origin endpoints for optional, text-only design suggestions. The UI has no client-side framework. The original SQLite/Drizzle game catalog remains as a legacy starter scaffold and is not part of Intero's build or runtime. Please follow these guidelines when contributing:

## Agent notes

- Explore the project before beginning code generation
- Create todo lists for long operations
  - Before each step in a todo list, reread the instructions to ensure you always have the right directions
- Always use instructions files when available, reviewing before generating code
- Do not generate summary markdown files upon completion of a task
- Always use absolute paths when running scripts and BASH commands
- **NEVER commit or push to main automatically unless explicitly instructed to do so**

## Code standards

### Required Before Each Commit

#### Testing guidelines

- **Always run unit tests, lint, and type checks through the `quality-checks` skill.** The skill wraps `npm run test:unit`, `npm run lint`, and `npm run typecheck:all` with environment setup, ordering, and troubleshooting. Run the Playwright E2E suite directly with `npm run test:e2e`. (Starting the app for manual validation is not a quality check — run `npm run dev` directly for that.)
- Run Vitest unit tests to verify the data layer and transforms, and Playwright tests to verify e2e and frontend functionality
- Run ESLint to check frontend code quality before committing
- Review the existing tests to ensure we're not duplicating efforts
- Test code should be of the same quality as the rest of the project, and follow DRY principles
- For frontend changes, verify the build (`npm run build`) and run the end-to-end tests (`npm run test:e2e`) directly, to ensure everything works correctly
- When changing the data layer (schema, helpers, transforms), update and run the corresponding unit tests

#### Project guidelines

- When updating the database schema, generate and commit the drizzle-kit migration (`npm run db:generate`)
- When adding new functionality, make sure you update the README
- Make sure all guidance in the Copilot Instructions file is updated with any relevant changes, including to project structure and scripts, and programming guidance

### Code formatting requirements

- Use TypeScript with explicit types for function parameters and return values, especially in the data layer (`db/`, `src/lib/`)
- Frontend code (TypeScript, Astro) must pass ESLint checks (`npm run lint`)

### Legacy Catalog Patterns (Drizzle + Node SQLite)

- Define tables in `db/schema.ts`; manage schema changes with drizzle-kit migrations - see `drizzle.instructions.md`
- Keep data-access helpers in `src/lib/` with an **injectable `db`** argument so they're testable
- Keep CSV/seed logic as pure functions in `db/transforms.ts`
- Seed-derived values must be deterministic (no `Math.random`) so static builds are reproducible

### Astro Patterns

- **Astro Pages/Components**: routing, layouts, content, and components are all `.astro` - see `astro.instructions.md`
- Keep pages prerenderable; the `server.mjs` host serves Astro's static output
- Keep provider credentials in server environment variables; never expose or log keys in page code
- The only supported text providers are Google AI Studio and Groq, configured with `GOOGLE_AI_STUDIO_API_KEY` and `GROQ_API_KEY`
- Provider suggestions are text only and must not be described as generated geometry, CAD, lighting simulation, or rendered imagery
- Keep the live 2D plan preview and 3D room shell driven by the same user-confirmed dimensions and opening offsets; optional uploaded plans remain local references and are not interpreted. Describe the CSS scene as illustrative, not CAD, a 360-degree photo, or a lighting simulation.
- Dynamic routes use `getStaticPaths()` + `export const prerender = true`
- Provide a branded `404.astro` (unknown routes are real 404s under static output)
- Only add a scoped Astro `<script>` when genuine client interactivity is required

### Styling

- Use Tailwind CSS utility classes by default - see `style.instructions.md`; keep required 3D scene effects isolated in `src/styles/global.css`
- Dark theme colors: slate palette (`bg-slate-800`, `text-slate-100`, etc.)
- Rounded corners and modern UI patterns
- Follow modern UI/UX principles with clean, accessible interfaces

### GitHub Actions workflows

- Follow good security practices
- Make sure to explicitly set the workflow permissions
- Add comments to document what tasks are being performed
- Keep the Playwright CI container image derived from the locked `@playwright/test` version so dependency updates use matching browsers.
- Weekly workshop triage reads outside-contributor PRs as untrusted data with access scoped to `github-samples/tailspin-toys` and `github-samples/copilot-workshops`. Its only PR actions are closing clearly misplaced workshop submissions or adding `needs-maintainer-screening`; never add approval, merge, issue-triage, or code-execution capabilities. Preserve threat detection and maintainer/bot exemptions.

## npm Commands

- Use public npm (`https://registry.npmjs.org/`) for cloud dependency operations. Keep committed lockfile tarball URLs on public npm, and reject other origins in CI.
- Development commands are defined in `package.json`. Astro builds the static UI; `server.mjs` serves it and handles optional provider requests. The legacy catalog tasks in `db/` are separate.
- **Skills take precedence.** Before running a command directly, check whether a skill covers the task (e.g. the `quality-checks` skill wraps unit tests, lint, and type checks). If one applies, follow it.
- Key npm scripts:
  - `npm run dev` — build the static site and start the Node host (no Astro hot reload)
  - `npm run build` — build the static UI into `dist/`; no database setup is required
  - `npm start` / `npm run preview` — serve `dist/` and the Node API routes
  - `npm run lint` — ESLint
  - `npm run test:unit` — Vitest unit tests
  - `npm run test:e2e` — Playwright E2E tests (builds and starts the Node host first)
  - `npm run test:e2e:install` — install the locked Playwright Chromium browser
  - `npm run typecheck` — type-check the pure TypeScript with `tsgo` (TypeScript 7 native compiler, via `@typescript/native-preview`) using `tsconfig.tsgo.json`
  - `npm run typecheck:astro` — type-check `.astro` files with `astro check` (classic TypeScript package)
  - `npm run typecheck:all` — run both type-check scripts (used by the CI `type-check` job)
  - `npm run db:generate` / `db:migrate` / `db:seed` / `db:setup` / `db:export` — legacy game-catalog maintenance tasks, not part of Intero's app workflow

> [!NOTE]
> TypeScript 7 (`tsgo`) is adopted **side-by-side** for type checking only; it does not affect linting. ESLint + `typescript-eslint` and `astro check` still resolve the classic `typescript` package (kept at v6) because the native compiler's API isn't ready for them yet. Do **not** bump the classic `typescript` package to 7 (a Dependabot `ignore` holds it) until `typescript-eslint` + `@astrojs/check` support the native API. `tsgo` is `--noEmit` only; the site is still built by `astro build`.

## Repository Structure

The application lives at the repository root:

- `server.mjs`: Node host for static files and same-origin provider endpoints
- `.env.example`: blank template for optional server-side provider configuration
- `db/`: legacy Drizzle catalog schema, migrations, transforms, seed, and `games.csv`
- `src/lib/`: room-geometry validation and server-side provider helpers, plus legacy catalog helpers
- `src/components/`: reusable `.astro` components
- `src/layouts/`: Astro layout templates
- `src/pages/`: `index.astro` design workspace, `404.astro`, and `about.astro`
- `src/styles/`: CSS and Tailwind configuration
- `src/types/`: shared TypeScript interfaces, including legacy catalog types
- `e2e-tests/`: Playwright E2E and accessibility tests for the workspace
- `drizzle.config.ts`, `vitest.config.ts`, `astro.config.mjs`, `playwright.config.ts`: tooling config
- `README.md`: Project documentation

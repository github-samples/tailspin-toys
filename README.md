# Intero

Intero is an interior-design workspace prototype. It guides a user through creating a measured 2D floor plan, confirming room dimensions and opening positions, and converting that plan into a clearly labeled illustrative 3D room preview. Optional provider-backed design help returns text suggestions only.

## What this prototype does

- Accepts PNG, JPG, WEBP, and PDF floor-plan references up to 12 MB. The file is previewed in the browser tab only; it is not uploaded or retained.
- Draws a live top-down 2D plan from user-entered dimensions and door/window wall offsets. Users review and confirm the measurements before selecting **Convert 2D layout to 3D preview**.
- Uses the same confirmed geometry for the illustrative 3D room shell and opening markers. It does not interpret a plan image or automatically convert its scale; optional files are references only.
- Shows a CSS 3D concept scene with drag/keyboard orbit controls and visual appearance presets. Furniture is generic; the scene is not a measured CAD model, a photorealistic render, a 360-degree photo, or a physical lighting simulation.
- Can request text-only design suggestions from Google AI Studio or Groq when the corresponding server environment variable is configured. Suggestions do not create or validate geometry or renders.

Intero does not persist room projects or user accounts. Do not enter private or identifying details into the optional assistant.

## Runtime and architecture

- **Astro 7** builds the browser UI into `dist/`.
- **Node.js 22.13 or later** runs `server.mjs`, which serves the built files and provides same-origin `/api/providers` and `/api/design-advice` routes.
- **Tailwind CSS v4** styles the interface; the room concept uses a small amount of custom CSS 3D.
- **Vitest** covers geometry validation, plan coordinate mapping, and provider request handling. **Playwright** covers the live 2D editor, 2D-to-3D conversion, local-only plan selection, scene controls, and accessibility.

The AI keys are read only by `server.mjs` from process environment variables. Provider status responses expose booleans only. The API does not log keys or provider error response bodies. The demo has no authentication or durable rate limiting; put authentication and rate limits in front of it before exposing provider-backed calls publicly.

## Local setup

Use Node.js 22.13 or later and public npm:

```bash
npm ci
Copy-Item .env.example .env
```

Add a key to `.env` only for a provider you want to enable. Keep `.env` private; it is ignored by Git. Never paste key values into source files, issue comments, or logs. With no keys set, the design workspace works and provider-backed suggestions remain disabled.

```bash
npm run dev
```

This builds the Astro site and starts the Node host on `http://localhost:4321`. The dev command serves the built app rather than running Astro hot reload; restart it after source changes.

To run a production-style build and host:

```bash
npm run build
npm start
```

For hosted deployment, build with `npm ci` and `npm run build`, then run `npm start` in a Node 22.13+ environment. Configure provider keys in the host's secret/environment settings; a `.env` file is not required. The server listens on `PORT` (default `4321`) and `HOST` (default `0.0.0.0`). Do not deploy only the `dist/` folder to a static host: the provider routes require the Node process.

### Optional provider configuration

Set either or both keys on the server:

- `GOOGLE_AI_STUDIO_API_KEY`
- `GROQ_API_KEY`

Optional model overrides are `GOOGLE_AI_STUDIO_MODEL` and `GROQ_MODEL`. Defaults are supplied by the app. No provider key is needed to build, test, or use the non-AI design workspace.

## Tests and checks

```bash
npm run test:unit
npm run lint
npm run typecheck:all
npm run test:e2e
```

The existing catalog seed/database utilities remain under `db/` for the starter repository, but are not part of Intero's runtime workflow.

## Repository workflows

This repository retains its workshop pull-request triage workflow. It reads outside-contributor pull requests as untrusted data and is restricted to closing clearly misplaced workshop submissions or applying `needs-maintainer-screening`; it does not approve or merge pull requests.

## License

This project is licensed under the MIT license. See [LICENSE](./LICENSE).

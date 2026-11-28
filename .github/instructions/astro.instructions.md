---
description: 'Astro component patterns for pages, layouts, components, and routing'
applyTo: '**/*.astro'
---

# Astro Component Instructions

## Astro Component Patterns

Astro handles the UI: pages, layouts, components, routing, and content. The UI is **fully prerendered** (`output: 'static'`) and has no client-side UI framework. The Node.js `server.mjs` host serves the generated files and provides optional same-origin provider endpoints; Astro pages do not read from the legacy game catalog.

### Component Structure

```astro
---
// Frontmatter: runs at build time (static output)
import Layout from '../layouts/Layout.astro';

interface Props {
  title: string;
}

const { title } = Astro.props;
---

<Layout title={title}>
  <main>
    <h1>{title}</h1>
  </main>
</Layout>
```

## Layouts

- Create reusable layout components in `src/layouts/`
- Use `<slot />` for content injection
- Include common elements: `<head>`, navigation, footer
- Import global styles in layouts

### Layout Example

```astro
---
interface Props {
  title: string;
}
const { title } = Astro.props;
---

<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <title>{title}</title>
  </head>
  <body>
    <slot />
  </body>
</html>
```

## Pages

- Create pages in `src/pages/`
- File-based routing: `src/pages/about.astro` → `/about`
- Dynamic routes use bracketed path segments, for example `src/pages/rooms/[id].astro`
- Provide a branded `src/pages/404.astro` — with static output, any URL with no generated page is a real 404.

### Dynamic Routes (static output)

With `output: 'static'`, every dynamic route must enumerate its pages with `getStaticPaths()` and set `prerender = true`. Keep generated paths deterministic and do not query the legacy game catalog for Intero pages.

```astro
---
import type { GetStaticPaths } from 'astro';
import Layout from '../../layouts/Layout.astro';
export const prerender = true;

export const getStaticPaths = (async () => {
  return ['example'].map((id) => ({ params: { id } }));
}) satisfies GetStaticPaths;

const { id } = Astro.params;
---

<Layout title={`Room ${id}`}>
  <main>
    <h1>Room {id}</h1>
  </main>
</Layout>
```

## Runtime and Data

- Astro builds the UI into `dist/`; `server.mjs` serves it and handles `/api/providers` and `/api/design-advice`.
- The optional design-advice endpoint accepts text requests only. Provider keys are read by the Node host from environment variables and must never be embedded in Astro frontmatter or browser scripts.
- The Drizzle/SQLite game catalog under `db/` is legacy starter data. It is not queried by Intero pages, and its migration/seed commands are not required for `astro build`.
- Add authentication and rate limiting before exposing provider-backed requests publicly.

## Client Interactivity (rare)

There is no Svelte/React layer. When a page genuinely needs client behaviour, add a scoped Astro `<script>` using standard DOM APIs. Prefer native interactive elements (`<button>`, `<a href>`) so keyboard and focus behaviour come for free.

For Intero's room workspace, derive the live SVG floor plan, furniture placement editor, and illustrative 3D room shell from the same user-confirmed dimensions, opening offsets, and object positions. Keep local-only plan references uninterpreted; describe image exports as schematic concept renders, not screenshots, CAD, or photorealistic output.

## TypeScript

- Use TypeScript for type-safe props
- Define `Props` interface in frontmatter
- Type component imports and helper return values
- Run `npx astro sync` to (re)generate route/content types before linting or type-checking
- `.astro` files are type-checked by `npm run typecheck:astro` (which runs `astro sync` then `astro check`), on the classic `typescript` package. The pure TypeScript in `db/`, `src/lib/`, and `src/types/` is type-checked separately by `npm run typecheck` (the native TS 7 compiler, `tsgo`), which does **not** process `.astro` files.

## Best Practices

- Keep page content static where possible; use same-origin APIs from scoped scripts only for necessary runtime operations, such as text suggestions
- Minimize client-side JavaScript — the default is zero JS shipped
- Import and use global CSS styles from layouts
- Always include a `data-testid` on interactive elements (see `ui.instructions.md`)

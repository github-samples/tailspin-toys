---
description: 'Commenting, documentation, and TypeScript formatting standards'
applyTo: '**/*.{ts,astro,js,mjs}'
---

# Coding Standards

## Comments

- Comment **why** code exists: capture intent, constraints, trade-offs, or a non-obvious decision.
- Do not comment mechanics or restate what the next line already expresses. Prefer clearer names or smaller functions when code needs explanation.
- Keep useful comments current. Update or remove a comment in the same change that makes it inaccurate.
- Reserve TODO comments for actionable follow-up work and include enough context to understand the remaining decision.

## API Documentation

- Every exported function in `db/` and `src/lib/` must have a TSDoc/JSDoc block.
- Start with a concise statement of purpose, then document every parameter with `@param` and the return value with `@returns`.
- For data-access helpers, document the injectable `db` parameter and explain that callers supply either the application database or a test database.
- Document behavior that callers need to know, such as ordering, nullability, idempotency, mutation, or thrown errors. Do not repeat the TypeScript signature in prose.

## Astro Component Contracts

- Every reusable `.astro` component or layout must document its `Props` interface with a short statement of the component contract.
- Add a TSDoc/JSDoc comment to each declared prop that explains its meaning, defaults, or behavior when omitted. Inherited HTML attributes do not need to be listed again.

## TypeScript Formatting

- Use four spaces for indentation, single quotes for strings, semicolons, and trailing commas in multiline structures.
- Do not leave trailing whitespace, and end each file with exactly one newline.
- Keep imports grouped at the top of the module and use `import type` when an import is used only as a type.
- Prefer multiline formatting when a statement would otherwise be difficult to scan; do not manually align expressions with extra spaces.

ESLint enforces the rules it can check reliably without rewriting existing files, including quotes, semicolons, brace spacing, final newlines, and type-only imports. Indentation, line wrapping, multiline trailing commas, and trailing whitespace remain review conventions because ESLint's core formatting rules do not reliably handle all TypeScript and Astro syntax in this project.

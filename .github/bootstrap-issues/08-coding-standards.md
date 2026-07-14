# Update our repository coding standards

Clear, documented coding standards keep the codebase consistent and make it easier for new contributors (and Copilot) to produce correct changes. Our current guidance on comments and documentation is thin, which leads to inconsistent commenting — some files are over-commented with restated code, others lack any explanation of intent. We want a single, well-understood convention that says what to document, where, and how, with emphasis on comments and documentation.

## What we want

- **Comment intent, not mechanics.** Comments should explain *why* a piece of code exists or the reasoning behind a non-obvious decision, not restate *what* the code already says. Remove comments that merely paraphrase the line below them.
- **Document the data layer.** Every exported function in `db/` and `src/lib/` must have a TSDoc/JSDoc comment describing its purpose, parameters, and return value. Helpers should keep their injectable `db` argument documented so the testing pattern stays clear.
- **Document component contracts.** Each reusable `.astro` component should document its `Props` interface so the component API is self-explanatory.
- **Keep comments current.** Treat outdated comments as bugs — update or delete them in the same change that touches the related code.

## Acceptance criteria

- [ ] `.github/instructions` files document a clear comment philosophy: comment *why* (intent/decisions), not *what*, and avoid restating code
- [ ] TSDoc/JSDoc expectations are documented for exported functions in `db/` and `src/lib/`, including describing parameters and return values
- [ ] Documentation expectations for `.astro` component `Props` interfaces are documented
- [ ] TypeScript formatting rules are documented and, where possible, enforced through ESLint
- [ ] The README links to or summarizes the updated coding standards
- [ ] Linting passes with any newly added rules (run through the `quality-checks` skill / `npm run lint`)

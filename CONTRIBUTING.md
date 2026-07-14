# Contributing to Tailspin Toys

[fork]: https://github.com/github-samples/tailspin-toys/fork
[pr]: https://github.com/github-samples/tailspin-toys/compare
[code-of-conduct]: CODE_OF_CONDUCT.md

Thank you for your interest in contributing to Tailspin Toys! Your help is essential for making this crowdfunding platform the best it can be for game creators and backers alike.

Contributions to this project are [released](https://help.github.com/articles/github-terms-of-service/#6-contributions-under-repository-license) to the public under the [project's open source license](LICENSE).

Please note that this project is released with a [Contributor Code of Conduct][code-of-conduct]. By participating in this project you agree to abide by its terms.

## Getting Started

### Prerequisites

Before you can run and test the application locally, you'll need to install:

- **Node.js 20+** - [Download](https://nodejs.org/) | [Homebrew](https://formulae.brew.sh/formula/node)
- **Git** - [Download](https://git-scm.com/downloads) | [Homebrew](https://formulae.brew.sh/formula/git)

### Setting Up Your Development Environment

1. Fork and clone the repository:
   ```bash
   git clone https://github.com/YOUR-USERNAME/tailspin-toys.git
   cd tailspin-toys
   ```

2. Install dependencies:
   ```bash
   npm ci
   npx playwright install chromium   # only needed for the E2E tests
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser to [http://localhost:4321](http://localhost:4321)

## Project Structure

- `db/` - Drizzle schema, migrations, transforms, seed, and `games.csv`
- `src/lib/` - database client and data-access helpers
- `src/` - Astro pages, layouts, components, styles, and types
- `e2e-tests/` - Playwright E2E tests

## Making Changes

### Data Layer (Drizzle + libSQL)

- Define tables in `db/schema.ts`; generate a migration with `npm run db:generate` after schema changes
- Use type hints for all function parameters and return values
- Keep data-access helpers in `src/lib/` with an injectable `db` argument
- Add or update Vitest tests for any data-layer change
- Run tests before submitting: `npm run test:unit`
   - All tests must pass

### Frontend (Astro)

- Build UI as `.astro` pages and components; query data in frontmatter (static output)
- Follow the dark theme using Tailwind CSS utility classes
- Add `data-testid` attributes to interactive elements for testing
- Run E2E tests before submitting: `npm run test:e2e`
   - All tests must pass

## Submitting a Pull Request

### Issues

All change requests should start with an issue. You're welcome to file the issue alongside the PR, but an issue must always be created.

### Workflow

1. Create a new branch from `main` for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes, following the documented coding standards.

3. Run the test suites to ensure nothing is broken:
   ```bash
   npm run lint
   npm run test:unit
   npm run test:e2e
   ```

4. Commit your changes with a clear, descriptive message:
   ```bash
   git commit -m "Add feature: brief description of changes"
   ```

5. Push to your fork and [submit a pull request][pr].

6. Wait for your pull request to be reviewed and merged.

### Pull Request Guidelines

- Use the appropriate pull request template, and ensure all sections are completed.
- Keep your changes focused. If you have multiple unrelated changes, submit them as separate pull requests.
- Write clear commit messages that explain *what* and *why*.
- Update documentation if your changes affect how the application works.
- Ensure all tests pass before requesting a review.
- Be responsive to feedback and ready to make adjustments.

## Reporting Issues

Found a bug or have a feature request? Please [open an issue](https://github.com/github-samples/tailspin-toys/issues/new) with:

- A clear, descriptive title
- Steps to reproduce (for bugs)
- Expected vs. actual behavior
- Screenshots if applicable
- Your environment details (OS, browser, Node version)

## Resources

- [How to Contribute to Open Source](https://opensource.guide/how-to-contribute/)
- [Using Pull Requests](https://help.github.com/articles/about-pull-requests/)
- [Writing Good Commit Messages](http://tbaggery.com/2008/04/19/a-note-about-git-commit-messages.html)
- [GitHub Help](https://help.github.com)

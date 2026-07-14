---
description: 'Playwright test generation instructions'
applyTo: '**/*.spec.ts'
---

# Test Writing Guidelines

## Code Quality Standards

- **Locators**: Prioritize user-facing, role-based locators (`getByRole`, `getByLabel`, `getByText`, etc.) for resilience and accessibility. Use `test.step()` to group interactions and improve test readability and reporting.
- **Timeouts**: Rely solely on Playwright's built-in auto-waiting mechanisms. NEVER use hard-coded waits such as `waitForTimeout`, increased default timeouts, or `waitForLoadState`.
- **Assertions**: Use auto-retrying web-first assertions. These assertions start with the `await` keyword (e.g., `await expect(locator).toHaveText()`). Prefer assertions that verify meaningful state — `toHaveText`, `toContainText`, `toHaveCount`, `toMatchAriaSnapshot`, `toHaveURL` — over a bare `toBeVisible()` when you actually care about content or structure. `toBeVisible()` is a valid auto-retrying assertion and is appropriate for genuine presence/visibility checks; just don't reach for it when a more specific assertion better expresses the intent.
- **Clarity**: Use descriptive test and step titles that clearly state the intent. Add comments only to explain complex logic or non-obvious interactions.

## Test Structure

- **Imports**: Start with `import { test, expect } from '@playwright/test';`.
- **Organization**: Group related tests for a feature under a `test.describe()` block.
- **Hooks**: Use `beforeEach` for setup actions common to all tests in a `describe` block (e.g., navigating to a page).
- **Titles**: Follow a clear naming convention, such as `Feature - Specific action or scenario`.


## File Organization

- **Location**: Store all test files in the `e2e-tests/` directory.
- **Naming**: Use the convention `<feature-or-page>.spec.ts` (e.g., `login.spec.ts`, `search.spec.ts`).
- **Scope**: Aim for one test file per major application feature or page.

## Assertion Best Practices

- **UI Structure**: Use `toMatchAriaSnapshot` to verify the accessibility tree structure of a component. This provides a comprehensive and accessible snapshot.
- **Element Counts**: Use `toHaveCount` to assert the number of elements found by a locator.
- **Text Content**: Use `toHaveText` for exact text matches and `toContainText` for partial matches.
- **Navigation**: Use `toHaveURL` to verify the page URL after an action.


## Example Test Structure

```typescript
import { test, expect } from '@playwright/test';

test.describe('Movie Search Feature', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application before each test
    await page.goto('https://debs-obrien.github.io/playwright-movies-app');
  });

  test('Search for a movie by title', async ({ page }) => {
    await test.step('Activate and perform search', async () => {
      await page.getByRole('search').click();
      const searchInput = page.getByRole('textbox', { name: 'Search Input' });
      await searchInput.fill('Garfield');
      await searchInput.press('Enter');
    });

    await test.step('Verify search results', async () => {
      // Verify the accessibility tree of the search results
      await expect(page.getByRole('main')).toMatchAriaSnapshot(`
        - main:
          - heading "Garfield" [level=1]
          - heading "search results" [level=2]
          - list "movies":
            - listitem "movie":
              - link "poster of The Garfield Movie The Garfield Movie rating":
                - /url: /playwright-movies-app/movie?id=tt5779228&page=1
                - img "poster of The Garfield Movie"
                - heading "The Garfield Movie" [level=2]
      `);
    });
  });
});
```

## Authoring & Iteration Strategy

> [!NOTE]
> This file covers how specs should be written. To *run* the E2E suite, use the `quality-checks` skill — never invoke `npx playwright test` directly.

1. **Run**: Execute the suite through the `quality-checks` skill.
2. **Debug Failures**: Analyze test failures and identify root causes.
3. **Iterate**: Refine locators, assertions, or test logic as needed, re-running through the skill.
4. **Validate**: Ensure tests pass consistently and cover the intended functionality.
5. **Report**: Provide feedback on test results and any issues discovered.

## Quality Checklist

Before finalizing tests, ensure:
- [ ] All locators are accessible and specific and do not use strict mode violations
- [ ] Tests are grouped logically and follow a clear structure
- [ ] Assertions are meaningful and reflect user expectations
- [ ] Tests follow consistent naming conventions
- [ ] Code is properly formatted and commented

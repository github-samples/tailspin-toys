import { test, expect } from '@playwright/test';

test.describe('Game Filtering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('games-grid')).toBeVisible();
  });

  test('should display category and publisher filter controls', async ({ page }) => {
    await test.step('Verify the filter panel and groups are visible', async () => {
      await expect(page.getByTestId('game-filters')).toBeVisible();
      await expect(page.getByRole('group', { name: 'Category' })).toBeVisible();
      await expect(page.getByRole('group', { name: 'Publisher' })).toBeVisible();
    });

    await test.step('Verify filter options are unchecked by default', async () => {
      const strategyCheckbox = page.getByRole('checkbox', { name: 'Strategy' });
      await expect(strategyCheckbox).not.toBeChecked();
    });
  });

  test('should filter games by a single category', async ({ page }) => {
    const totalCount = await page.getByTestId('game-card').count();

    await test.step('Select the Strategy category filter', async () => {
      await page.getByRole('checkbox', { name: 'Strategy' }).check();
    });

    await test.step('Verify only Strategy games remain visible', async () => {
      const visibleCards = page.locator('[data-testid="game-card"]:visible');
      const categories = await visibleCards.locator('[data-testid="game-category"]').allTextContents();
      expect(categories.length).toBeGreaterThan(0);
      expect(categories.every((category) => category === 'Strategy')).toBeTruthy();
    });

    await test.step('Verify the results count is announced', async () => {
      const visibleCount = await page.locator('[data-testid="game-card"]:visible').count();
      await expect(page.getByTestId('filter-results-count')).toHaveText(`Showing ${visibleCount} of ${totalCount} games`);
    });
  });

  test('should combine multiple categories with OR semantics', async ({ page }) => {
    await test.step('Select two category filters', async () => {
      await page.getByRole('checkbox', { name: 'Strategy' }).check();
      await page.getByRole('checkbox', { name: 'Puzzle' }).check();
    });

    await test.step('Verify only games from either category remain visible', async () => {
      const visibleCards = page.locator('[data-testid="game-card"]:visible');
      const categories = await visibleCards.locator('[data-testid="game-category"]').allTextContents();
      expect(categories.length).toBeGreaterThan(0);
      expect(categories.every((category) => category === 'Strategy' || category === 'Puzzle')).toBeTruthy();
    });
  });

  test('should filter games by publisher', async ({ page }) => {
    await test.step('Select a publisher filter', async () => {
      const publisherCheckbox = page.getByTestId('publisher-filter').getByRole('checkbox').first();
      const publisherName = await publisherCheckbox.getAttribute('aria-label');
      await publisherCheckbox.check();

      await test.step('Verify only games from that publisher remain visible', async () => {
        const visibleCards = page.locator('[data-testid="game-card"]:visible');
        const publisherNames = await visibleCards.locator('[data-testid="game-publisher"]').allTextContents();
        expect(publisherNames.length).toBeGreaterThan(0);
        expect(publisherNames.every((name) => name === publisherName)).toBeTruthy();
      });
    });
  });

  test('should combine category and publisher filters with AND semantics', async ({ page }) => {
    await test.step('Select a category and a publisher filter', async () => {
      await page.getByRole('checkbox', { name: 'Strategy' }).check();
      await page.getByRole('checkbox', { name: 'GitHub Games' }).check();
    });

    await test.step('Verify only games matching both filters remain visible', async () => {
      const visibleCards = page.locator('[data-testid="game-card"]:visible');
      await expect(visibleCards).toHaveCount(1);
      await expect(visibleCards.getByTestId('game-category')).toHaveText('Strategy');
      await expect(visibleCards.getByTestId('game-publisher')).toHaveText('GitHub Games');
    });
  });

  test('should clear all filters and restore the full game list', async ({ page }) => {
    const totalCount = await page.getByTestId('game-card').count();

    await test.step('Apply filters', async () => {
      await page.getByRole('checkbox', { name: 'Strategy' }).check();
      await page.getByRole('checkbox', { name: 'GitHub Games' }).check();
      await expect(page.locator('[data-testid="game-card"]:visible')).toHaveCount(1);
    });

    await test.step('Clear filters and verify all games are visible again', async () => {
      await page.getByTestId('clear-filters-button').click();
      await expect(page.locator('[data-testid="game-card"]:visible')).toHaveCount(totalCount);
      await expect(page.getByRole('checkbox', { name: 'Strategy' })).not.toBeChecked();
      await expect(page.getByRole('checkbox', { name: 'GitHub Games' })).not.toBeChecked();
    });
  });

  test('should support keyboard interaction with filter checkboxes', async ({ page }) => {
    const strategyCheckbox = page.getByRole('checkbox', { name: 'Strategy' });

    await test.step('Focus and toggle the checkbox with the keyboard', async () => {
      await strategyCheckbox.focus();
      await expect(strategyCheckbox).toBeFocused();
      await page.keyboard.press('Space');
      await expect(strategyCheckbox).toBeChecked();
    });

    await test.step('Verify the grid updates in response', async () => {
      const categories = await page.locator('[data-testid="game-card"]:visible [data-testid="game-category"]').allTextContents();
      expect(categories.every((category) => category === 'Strategy')).toBeTruthy();
    });
  });
});

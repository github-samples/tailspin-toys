import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display the correct title', async ({ page }) => {
    await expect(page).toHaveTitle('Tailspin Toys - Crowdfunding your new favorite game!');
  });

  test('should display the main heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Welcome to Tailspin Toys', exact: true })).toBeVisible();
  });

  test('should display the site branding in header', async ({ page }) => {
    await expect(page.getByText('Tailspin Toys').first()).toBeVisible();
  });

  test('should display the welcome message', async ({ page }) => {
    await expect(page.getByText('Find your next game! And maybe even back one! Explore our collection!')).toBeVisible();
  });

  test('should filter games by category and publisher', async ({ page }) => {
    const visibleCards = page.locator('[data-testid="game-card"]:not([hidden])');

    await expect(visibleCards).toHaveCount(21);

    await test.step('Apply a category filter', async () => {
      await page.getByRole('checkbox', { name: 'Filter by category: Strategy' }).check();
    });

    await test.step('Apply a publisher filter', async () => {
      await page.getByLabel('Filter games by publisher').selectOption({ label: 'CodeForge Studios' });
    });

    await test.step('Verify the combined filter narrows the results', async () => {
      await expect(page.locator('[data-testid="game-card"]:not([hidden])')).toHaveCount(1);
      await expect(page.locator('[data-testid="game-card"]:not([hidden])').first()).toContainText('DevOps Dominion');
    });

    await test.step('Reset filters to restore all games', async () => {
      await page.getByTestId('clear-filters').click();
      await expect(page.locator('[data-testid="game-card"]:not([hidden])')).toHaveCount(21);
    });
  });
});

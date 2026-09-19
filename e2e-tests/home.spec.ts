import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display the correct title', async ({ page }) => {
    // Check that the page title is correct
    await expect(page).toHaveTitle('Tailspin Toys - Crowdfunding your new favorite game!');
  });

  test('should display the main heading', async ({ page }) => {
    // Check that the main page heading is present
    await expect(page.getByRole('heading', { name: 'Welcome to Tailspin Toys', exact: true })).toBeVisible();
  });

  test('should display the site branding in header', async ({ page }) => {
    // Check that the site branding is present in the header (no longer an h1)
    await expect(page.getByText('Tailspin Toys').first()).toBeVisible();
  });

  test('should display the welcome message', async ({ page }) => {
    // Check that the welcome message is present using more specific locator
    await expect(page.getByText('Find your next game! And maybe even back one! Explore our collection!')).toBeVisible();
  });

  test('should filter games by title as the user types', async ({ page }) => {
    const searchInput = page.getByRole('searchbox', { name: 'Search games by title' });
    const serverSiegeCard = page.locator('[data-game-title="Server Siege"]');
    const devOpsCard = page.locator('[data-game-title="DevOps Dominion"]');

    await expect(searchInput).toBeVisible();
    await expect(serverSiegeCard).toBeVisible();
    await expect(devOpsCard).toBeVisible();

    await searchInput.fill('server');

    await expect(serverSiegeCard).toBeVisible();
    await expect(devOpsCard).toBeHidden();
    await expect(page.getByTestId('game-search-summary')).toContainText('Showing 2 matching games');

    await searchInput.fill('not-a-game');
    await expect(page.getByTestId('empty-state')).toBeVisible();
    await expect(page.getByTestId('empty-state-text')).toContainText('No games match "not-a-game"');
  });
});

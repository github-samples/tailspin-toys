import { test, expect } from '@playwright/test';

test.describe('Game Leaderboard', () => {
  test('should list ranked games from the header navigation', async ({ page }) => {
    await test.step('Navigate to homepage and open the menu', async () => {
      await page.goto('/');
      await page.getByRole('button', { name: 'Toggle menu' }).click();
    });

    await test.step('Follow the Leaderboard link', async () => {
      await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Leaderboard' }).click();
      await expect(page).toHaveURL('/leaderboard');
    });

    await test.step('Verify the leaderboard table and rows are visible', async () => {
      await expect(page.getByTestId('leaderboard-table')).toBeVisible();
      expect(await page.getByTestId('leaderboard-row').count()).toBeGreaterThan(0);
    });
  });

  test('should rank rated games in descending order with unrated games last', async ({ page }) => {
    await page.goto('/leaderboard');
    await expect(page.getByTestId('leaderboard-table')).toBeVisible();

    const rows = page.getByTestId('leaderboard-row');
    const ranks = await page.getByTestId('leaderboard-rank').allTextContents();
    const ratings = await page.getByTestId('leaderboard-rating').allTextContents();

    await test.step('Verify rated rows come first with non-decreasing ranks', async () => {
      const ratedCount = ratings.filter((text) => !text.includes('Not yet rated')).length;
      const numericRanks = ranks.slice(0, ratedCount).map(Number);
      expect(numericRanks.every((rank, i) => i === 0 || rank >= numericRanks[i - 1])).toBeTruthy();
      expect(numericRanks[0]).toBe(1);
    });

    await test.step('Verify unrated rows have no rank', async () => {
      const firstUnratedIndex = ratings.findIndex((text) => text.includes('Not yet rated'));
      const unratedRanks = firstUnratedIndex === -1 ? [] : ranks.slice(firstUnratedIndex);
      unratedRanks.forEach((rank) => expect(rank.trim()).toBe('—'));
    });

    await test.step('Verify each row links to its game details page', async () => {
      const firstLink = rows.first().getByTestId('leaderboard-game-link');
      await expect(firstLink).toHaveAttribute('href', /^\/game\/\d+$/);
    });
  });

  test('should filter the leaderboard by genre', async ({ page }) => {
    await test.step('Navigate to the leaderboard and pick a genre', async () => {
      await page.goto('/leaderboard');
      const genreLinks = page.getByTestId('genre-filter').locator('a[data-testid^="genre-filter-"]:not([data-testid="genre-filter-all"])');
      await expect(genreLinks.first()).toBeVisible();
      await genreLinks.first().click();
    });

    await test.step('Verify the genre page only lists games from that genre', async () => {
      await expect(page).toHaveURL(/\/leaderboard\/genre\/\d+$/);
      await expect(page.getByTestId('genre-filter-all')).not.toHaveAttribute('aria-current', 'page');
      const genres = await page.getByTestId('leaderboard-genre').allTextContents();
      expect(genres.length).toBeGreaterThan(0);
      expect(new Set(genres).size).toBe(1);
    });

    await test.step('Return to all genres', async () => {
      await page.getByTestId('genre-filter-all').click();
      await expect(page).toHaveURL('/leaderboard');
      await expect(page.getByTestId('genre-filter-all')).toHaveAttribute('aria-current', 'page');
    });
  });

  test('should describe ratings as player opinion rather than gameplay scores', async ({ page }) => {
    await page.goto('/leaderboard');
    await expect(page.getByRole('heading', { level: 1, name: 'Game Leaderboard' })).toBeVisible();
    await expect(page.getByText('Ratings reflect player opinion, not gameplay scores.')).toBeVisible();
  });
});

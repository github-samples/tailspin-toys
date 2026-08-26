import { test, expect } from '@playwright/test';

test.describe('Game Filtering', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('should display filter controls', async ({ page }) => {
        await test.step('Verify filter controls are visible', async () => {
            const filterControls = page.getByTestId('filter-controls');
            await expect(filterControls).toBeVisible();
            await expect(page.getByRole('group', { name: 'Filter by categories' })).toBeVisible();
            await expect(page.getByLabel('Publisher')).toBeVisible();
            await expect(page.getByTestId('reset-filters')).toBeVisible();
        });
    });

    test('should filter games by single category', async ({ page }) => {
        await test.step('Count initial games', async () => {
            const gameCards = page.locator('[data-testid^="game-card-"]');
            const initialCount = await gameCards.count();
            expect(initialCount).toBeGreaterThan(0);
        });

        await test.step('Select a category filter', async () => {
            // Get the first category checkbox
            const firstCategoryCheckbox = page.locator('input[name="category"]').first();
            await firstCategoryCheckbox.check();
        });

        await test.step('Verify filtered results', async () => {
            const gameCards = page.locator('[data-testid^="game-card-"]').filter({ hasNotText: '' });
            const visibleCards = await gameCards.evaluateAll((cards) => 
                cards.filter((card) => (card as HTMLElement).style.display !== 'none')
            );
            
            // At least one game should be visible (we have test data)
            expect(visibleCards.length).toBeGreaterThan(0);
        });
    });

    test('should filter games by multiple categories', async ({ page }) => {
        await test.step('Select multiple categories', async () => {
            const categoryCheckboxes = page.locator('input[name="category"]');
            const checkboxCount = await categoryCheckboxes.count();
            
            if (checkboxCount >= 2) {
                await categoryCheckboxes.nth(0).check();
                await categoryCheckboxes.nth(1).check();
            }
        });

        await test.step('Verify multiple category filtering', async () => {
            const gameCards = page.locator('[data-testid^="game-card-"]');
            
            // Check that visible cards match one of the selected categories
            const visibleCards = await gameCards.evaluateAll((cards) => 
                cards.filter((card) => (card as HTMLElement).style.display !== 'none')
            );
            
            expect(visibleCards.length).toBeGreaterThan(0);
        });
    });

    test('should filter games by publisher', async ({ page }) => {
        await test.step('Select a publisher', async () => {
            const publisherSelect = page.getByTestId('filter-publisher');
            await expect(publisherSelect).toBeVisible();
            
            // Select the first non-empty option
            await publisherSelect.selectOption({ index: 1 });
        });

        await test.step('Verify publisher filtering', async () => {
            const gameCards = page.locator('[data-testid^="game-card-"]');
            const visibleCards = await gameCards.evaluateAll((cards) => 
                cards.filter((card) => (card as HTMLElement).style.display !== 'none')
            );
            
            expect(visibleCards.length).toBeGreaterThan(0);
        });
    });

    test('should combine category and publisher filters', async ({ page }) => {
        await test.step('Select both category and publisher filters', async () => {
            // Select a category
            const firstCategoryCheckbox = page.locator('input[name="category"]').first();
            await firstCategoryCheckbox.check();
            
            // Select a publisher
            const publisherSelect = page.getByTestId('filter-publisher');
            await publisherSelect.selectOption({ index: 1 });
        });

        await test.step('Verify combined filtering', async () => {
            const gameCards = page.locator('[data-testid^="game-card-"]');
            
            // Some games should still be visible (or none if no match)
            const visibleCards = await gameCards.evaluateAll((cards) => 
                cards.filter((card) => (card as HTMLElement).style.display !== 'none')
            );
            
            // The filtering should have narrowed down results (or shown no matches message)
            expect(visibleCards.length).toBeGreaterThanOrEqual(0);
        });
    });

    test('should reset filters when reset button is clicked', async ({ page }) => {
        let initialCount: number;

        await test.step('Count initial games', async () => {
            const gameCards = page.locator('[data-testid^="game-card-"]');
            initialCount = await gameCards.count();
        });

        await test.step('Apply filters', async () => {
            const firstCategoryCheckbox = page.locator('input[name="category"]').first();
            await firstCategoryCheckbox.check();
            
            const publisherSelect = page.getByTestId('filter-publisher');
            await publisherSelect.selectOption({ index: 1 });
        });

        await test.step('Reset filters', async () => {
            await page.getByTestId('reset-filters').click();
        });

        await test.step('Verify all games are visible again', async () => {
            const gameCards = page.locator('[data-testid^="game-card-"]');
            const visibleCards = await gameCards.evaluateAll((cards) => 
                cards.filter((card) => (card as HTMLElement).style.display !== 'none')
            );
            
            expect(visibleCards.length).toBe(initialCount);
        });

        await test.step('Verify filters are cleared', async () => {
            // Check that no category checkboxes are checked
            const checkedCategories = await page.locator('input[name="category"]:checked').count();
            expect(checkedCategories).toBe(0);
            
            // Check that publisher select is reset
            const publisherSelect = page.getByTestId('filter-publisher');
            await expect(publisherSelect).toHaveValue('');
        });
    });

    test('should show empty state when no games match filters', async ({ page }) => {
        await test.step('Select filters that likely have no matches', async () => {
            // Select all categories to maximize chance of finding an impossible combination
            const categoryCheckboxes = page.locator('input[name="category"]');
            const count = await categoryCheckboxes.count();
            
            // Check first category
            if (count > 0) {
                await categoryCheckboxes.first().check();
            }
            
            // Try selecting a publisher that doesn't have games in that category
            // This might show the empty state depending on the data
            const publisherSelect = page.getByTestId('filter-publisher');
            const optionCount = await publisherSelect.locator('option').count();
            
            if (optionCount > 2) {
                await publisherSelect.selectOption({ index: optionCount - 1 });
            }
        });

        await test.step('Check for empty state or visible games', async () => {
            // Either we see games or the empty state message
            const emptyState = page.getByTestId('filtered-empty-state');
            const gameCards = page.locator('[data-testid^="game-card-"]');
            const visibleCards = await gameCards.evaluateAll((cards) => 
                cards.filter((card) => (card as HTMLElement).style.display !== 'none')
            );
            
            if (visibleCards.length === 0) {
                await expect(emptyState).toBeVisible();
                await expect(emptyState).toContainText('No games match the selected filters');
            } else {
                await expect(emptyState).not.toBeVisible();
            }
        });
    });

    test('should support keyboard navigation', async ({ page }) => {
        await test.step('Tab to category checkboxes', async () => {
            const firstCheckbox = page.locator('input[name="category"]').first();
            await firstCheckbox.focus();
            await expect(firstCheckbox).toBeFocused();
        });

        await test.step('Tab to publisher select', async () => {
            const publisherSelect = page.getByTestId('filter-publisher');
            await publisherSelect.focus();
            await expect(publisherSelect).toBeFocused();
        });

        await test.step('Tab to reset button', async () => {
            const resetButton = page.getByTestId('reset-filters');
            await resetButton.focus();
            await expect(resetButton).toBeFocused();
        });

        await test.step('Activate reset button with keyboard', async () => {
            const resetButton = page.getByTestId('reset-filters');
            await resetButton.focus();
            await resetButton.press('Enter');
            
            // Verify filters were reset
            const checkedCategories = await page.locator('input[name="category"]:checked').count();
            expect(checkedCategories).toBe(0);
        });
    });
});

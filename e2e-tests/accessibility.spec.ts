import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Intero accessibility', () => {
  test('workspace has no automated accessibility violations', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Make room for a better idea.' })).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('about page has no automated accessibility violations', async ({ page }) => {
    await page.goto('/about');
    await expect(page.getByTestId('about-section')).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('keyboard users can reach the navigation and room controls', async ({ page }) => {
    await page.goto('/');
    const homeLink = page.getByRole('link', { name: 'intero' });
    const workspaceLink = page.getByRole('link', { name: 'Workspace' });
    const aboutLink = page.getByRole('link', { name: 'About' });
    const planInput = page.getByLabel('Floor plan reference');
    const scaleInput = page.getByTestId('scale-reference');
    const widthInput = page.getByLabel('Width (m)');

    await page.keyboard.press('Tab');
    await expect(homeLink).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(workspaceLink).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(aboutLink).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(planInput).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(scaleInput).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(widthInput).toBeFocused();
    await expect(page.getByRole('main')).toBeVisible();
  });
});

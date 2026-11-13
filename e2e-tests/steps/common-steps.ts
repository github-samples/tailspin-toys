import { expect, type Page } from '@playwright/test';

// Reusable step methods called by specs produced by `npm run test:generate`.

export async function openPage(page: Page, path: string): Promise<void> {
  await page.goto(path);
}

export async function clickByName(page: Page, name: string): Promise<void> {
  await page.getByRole('link', { name }).or(page.getByRole('button', { name })).first().click();
}

export async function fillField(page: Page, label: string, value: string): Promise<void> {
  await page.getByLabel(label).fill(value);
}

export async function expectText(page: Page, text: string): Promise<void> {
  await expect(page.getByText(text).first()).toBeVisible();
}

export async function expectHeading(page: Page, name: string): Promise<void> {
  await expect(page.getByRole('heading', { name }).first()).toBeVisible();
}

export async function expectPath(page: Page, path: string): Promise<void> {
  const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  await expect(page).toHaveURL(new RegExp(`${escaped}$`));
}

export async function expectTitle(page: Page, title: string): Promise<void> {
  await expect(page).toHaveTitle(title);
}

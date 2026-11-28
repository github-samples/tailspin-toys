import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

test.describe('Intero workspace', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('shows Intero branding and a guided room intake', async ({ page }) => {
    await expect(page).toHaveTitle('Intero — thoughtful spaces, made together');
    await expect(page.getByRole('heading', { name: 'Make room for a better idea.' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Build your 2D layout' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Placement editor' })).toBeVisible();
    await expect(page.getByTestId('ai-tutorial')).toContainText('Choose a provider');
    await expect(page.getByLabel('Floor plan reference')).toBeVisible();
    await expect(page.getByRole('link', { name: 'intero' })).toBeVisible();
  });

  test('previews a measured 2D layout and converts its dimensions and openings to 3D', async ({ page }) => {
    await page.getByLabel('Width (m)').fill('4.8');
    await page.getByLabel('Length (m)').fill('3.6');
    await page.getByLabel('Wall height (m)').fill('2.7');
    await page.getByTestId('door-wall').selectOption('north');
    await page.getByLabel('Door centre offset (m)').fill('2.4');
    await page.getByTestId('window-wall').selectOption('east');
    await page.getByLabel('Window centre offset (m)').fill('1.8');

    await expect(page.getByTestId('layout-2d-preview')).toBeVisible();
    await expect(page.getByTestId('plan-editor-status')).toContainText('4.80 m × 3.60 m');
    await expect(page.getByTestId('plan-editor-status')).toContainText('door on north at 2.40 m');
    await expect(page.getByTestId('plan-editor-status')).toContainText('window on east at 1.80 m');
    await expect(page.getByTestId('placement-sofa-x')).toHaveValue('2.21');
    const doorMarker = page.locator('#plan-door-marker');
    const windowMarker = page.locator('#plan-window-marker');
    const plantMarker = page.locator('#plan-plant-marker');
    const originalPlantX = await plantMarker.getAttribute('cx');
    await expect(doorMarker).not.toHaveClass(/hidden/);
    await expect(windowMarker).not.toHaveClass(/hidden/);
    expect(await doorMarker.getAttribute('y1')).toBe(await doorMarker.getAttribute('y2'));
    expect(await windowMarker.getAttribute('x1')).toBe(await windowMarker.getAttribute('x2'));
    await page.getByTestId('placement-plant-x').fill('1.10');
    await expect(plantMarker).not.toHaveAttribute('cx', originalPlantX ?? '');
    await expect(page.getByTestId('placement-status')).toContainText('plant 1.10');

    await page.getByTestId('scale-reference').fill('Measured directly');
    await page.getByTestId('confirm-geometry').check();
    await page.getByTestId('confirm-room-button').click();

    await expect(page.getByTestId('room-scene')).toBeVisible();
    await expect(page.getByRole('heading', { name: '3D preview from your 2D layout' })).toBeVisible();
    await expect(page.getByTestId('room-summary')).toContainText('4.80 m × 3.60 m × 2.70 m');
    await expect(page.getByTestId('room-summary')).toContainText('plant 1.10');
    await expect(page.locator('.scene-wall-back .scene-door')).toHaveCount(1);
    await expect(page.locator('.scene-wall-right .scene-window')).toHaveCount(1);

    const sofa = page.locator('.scene-sofa');
    await expect(sofa).toHaveAttribute('style', /inset: 100% auto auto 8\.59444rem/);
    await page.getByTestId('placement-sofa-x').fill('3.00');
    await expect(sofa).toHaveAttribute('style', /inset: 100% auto auto 11\.6667rem/);
    await expect(page.getByTestId('room-summary')).toContainText('sofa 3.00');

    const pngDownloadPromise = page.waitForEvent('download');
    await page.getByTestId('download-png').click();
    const pngDownload = await pngDownloadPromise;
    expect(pngDownload.suggestedFilename()).toBe('intero-room-concept.png');
    const pngPath = await pngDownload.path();
    if (!pngPath) throw new Error('PNG export did not create a downloadable file.');
    expect((await readFile(pngPath)).subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));

    const jpegDownloadPromise = page.waitForEvent('download');
    await page.getByTestId('download-jpeg').click();
    const jpegDownload = await jpegDownloadPromise;
    expect(jpegDownload.suggestedFilename()).toBe('intero-room-concept.jpg');
    const jpegPath = await jpegDownload.path();
    if (!jpegPath) throw new Error('JPEG export did not create a downloadable file.');
    expect((await readFile(jpegPath)).subarray(0, 3)).toEqual(Buffer.from([255, 216, 255]));
  });

  test('keeps a selected plan local and requires geometry confirmation', async ({ page }) => {
    let uploadRequests = 0;
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().includes('/api/')) uploadRequests++;
    });

    await page.getByLabel('Floor plan reference').setInputFiles({
      name: 'room-plan.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4'),
    });
    await expect(page.getByTestId('plan-file-status')).toContainText('not uploaded');

    await page.getByLabel('Width (m)').fill('4.8');
    await page.getByLabel('Length (m)').fill('3.6');
    await page.getByLabel('Wall height (m)').fill('2.7');
    await page.getByTestId('scale-reference').fill('   ');
    await page.getByLabel('Door centre offset (m)').fill('1.2');
    await page.getByTestId('confirm-geometry').check();
    await page.getByTestId('confirm-room-button').click();

    await expect(page.getByTestId('room-scene')).toBeHidden();
    await expect(page.locator('#room-form-status')).toContainText('scale reference');
    await page.getByTestId('scale-reference').fill('Measured directly');
    await page.getByTestId('confirm-room-button').click();
    await expect(page.getByTestId('room-scene')).toBeVisible();
    await expect(page.getByTestId('room-summary')).toContainText('4.80 m × 3.60 m × 2.70 m');
    await expect(page.getByText('Illustrative conversion · not CAD')).toBeVisible();
    expect(uploadRequests).toBe(0);
  });

  test('changes the scene appearance and supports orbit controls', async ({ page }) => {
    await page.getByLabel('Width (m)').fill('4');
    await page.getByLabel('Length (m)').fill('3');
    await page.getByLabel('Wall height (m)').fill('2.7');
    await page.getByTestId('scale-reference').fill('Measured directly');
    await page.getByLabel('Door centre offset (m)').fill('1.2');
    await page.getByTestId('confirm-geometry').check();
    await page.getByTestId('confirm-room-button').click();

    const stage = page.getByTestId('scene-stage');
    await expect(stage).toHaveAttribute('data-lighting', 'daylight');
    await page.getByTestId('lighting-warm').click();
    await expect(stage).toHaveAttribute('data-lighting', 'warm');
    await page.getByTestId('rotate-right').click();
    await expect(page.locator('#scene-status')).toContainText('View rotated');
  });

  test('reports configured providers without exposing keys', async ({ page }) => {
    const providersUrl = new URL('/api/providers', page.url()).toString();
    const response = await page.request.get(providersUrl);
    await expect(response).toBeOK();
    const body = await response.json() as { googleAiStudio: boolean; groq: boolean };
    expect(Object.keys(body).sort()).toEqual(['googleAiStudio', 'groq']);
    expect(typeof body.googleAiStudio).toBe('boolean');
    expect(typeof body.groq).toBe('boolean');
  });
});

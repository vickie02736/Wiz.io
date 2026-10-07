import { test, expect } from '@playwright/test';

test('visualization progress remains visible until chart tools and rendering finish', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route(/plotly.*\.js(?:\?.*)?$/, async route => {
    await gate;
    await route.continue();
  });
  try {
    await page.goto('./', { waitUntil: 'commit' });
    const bar = page.getByRole('progressbar', { name: 'Loading visualization' });
    await expect(bar).toBeVisible();
    await expect(bar).toHaveAttribute('aria-valuetext', 'Loading chart tools…');
    await expect(bar).not.toHaveAttribute('aria-valuenow');
    await expect(page.locator('.plot-wrap')).toHaveAttribute('aria-busy', 'true');
    release();
    await expect(bar).toHaveCount(0);
    await expect(page.locator('.plot-wrap')).toHaveAttribute('aria-busy', 'false');
    await expect(page.getByTestId('chart').locator('.main-svg').first()).toBeVisible();
  } finally { release(); }
});

test('example progress handles failure, retry, mobile layout and navigation away', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/examples/wine.csv', async route => { await gate; await route.abort(); });
  try {
    await page.goto('./');
    await page.getByRole('button', { name: 'Wine data histograms', exact: true }).click();
    const loading = page.getByTestId('chart-loading');
    await expect(loading).toBeVisible();
    await expect(loading).toContainText('Loading example data…');
    await expect(page.getByRole('button', { name: 'Load example', exact: true })).toBeDisabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    release();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(loading).toHaveCount(0);
    await page.unroute('**/examples/wine.csv');
    await page.getByRole('button', { name: 'Load example', exact: true }).click();
    await expect(page.getByTestId('active-count')).toHaveText('178');
    await expect(loading).toHaveCount(0);
    await expect.poll(() => page.getByTestId('chart').evaluate((e: any) => e.data?.[0]?.type)).toBe('box');
    await page.getByRole('button', { name: 'Lines', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Line plots' })).toBeVisible();
    await expect(page.getByRole('progressbar')).toHaveCount(0);
  } finally { release(); }
});

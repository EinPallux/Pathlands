import { test, expect } from '@playwright/test';

// Boot/smoke coverage of the real build (the Vercel artifact): the game boots to
// the menu with no console errors, a new character starts, and gameplay renders
// and runs for a few seconds without crashing (CLAUDE.md §4).

test('boots to the main menu without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('/');
  await expect(page.locator('.screen-title')).toHaveText('PATHLANDS', { timeout: 20_000 });
  await expect(page.locator('canvas#game-canvas')).toBeVisible();
  expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
});

test('starts a new character and reaches gameplay', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('/');
  await page.getByRole('button', { name: /New Pathwalker/i }).click();
  await expect(page.locator('.class-name')).toBeVisible();
  await page.getByRole('button', { name: /Begin the Descent/i }).click();

  // HUD appears → we're in gameplay.
  await expect(page.locator('.skillbar')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.orb-health')).toBeVisible();

  // Let the game run a few seconds; drive some input.
  await page.mouse.move(700, 400);
  for (const key of ['KeyW', 'KeyD', 'KeyS', 'KeyA']) {
    await page.keyboard.down(key);
    await page.waitForTimeout(300);
    await page.keyboard.up(key);
  }
  await page.waitForTimeout(1500);

  // Still alive and rendering — the HUD level readout is present.
  await expect(page.locator('.hud-info .lvl')).toContainText('Level');
  expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
});

test('pauses with Escape and resumes', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /New Pathwalker/i }).click();
  await page.getByRole('button', { name: /Begin the Descent/i }).click();
  await expect(page.locator('.skillbar')).toBeVisible({ timeout: 15_000 });

  await page.keyboard.press('Escape');
  await expect(page.getByText('Paused')).toBeVisible();
  await page.getByRole('button', { name: /Resume/i }).click();
  await expect(page.locator('.skillbar')).toBeVisible();
});

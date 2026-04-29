import { test, expect } from '@playwright/test';

test.describe('Home screen', () => {
  test('renders headline and primary CTAs', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: /KahootLite/i })
    ).toBeVisible();
    await expect(page.getByPlaceholder('ABC123')).toBeVisible();
    await expect(
      page.getByRole('button', { name: /\+ New quiz/ })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /My quizzes/ })
    ).toBeVisible();
  });

  test('Join button navigates to join screen with the typed PIN', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByPlaceholder('ABC123').fill('ABC123');
    await page.getByRole('button', { name: /Join game →/ }).click();
    await expect(page).toHaveURL(/#\/join\/ABC123$/);
  });

  test('shows "Room not found" when the PIN is invalid', async ({ page }) => {
    await page.goto('/#/join/ZZZZZZ');
    await expect(page.getByText(/Room ZZZZZZ not found/i)).toBeVisible();
    await page.getByRole('button', { name: /← Home/ }).click();
    await expect(page).toHaveURL(/\/#?\/?\$/);
  });

  test('theme toggle switches and persists across reload', async ({
    page,
  }) => {
    await page.goto('/');
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'dark');

    await page.getByLabel('Toggle theme').click();
    await expect(html).toHaveAttribute('data-theme', 'light');

    await page.reload();
    await expect(html).toHaveAttribute('data-theme', 'light');
  });
});

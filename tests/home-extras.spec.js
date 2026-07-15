import { test, expect } from '@playwright/test';
import { seedQuiz, SAMPLE_QUIZ } from './helpers.js';

test.describe('Home page — additional flows', () => {
  test('short PIN (fewer than 4 chars) does not navigate away', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Type a 3-character code and submit.
    await page.getByPlaceholder('ABC123').fill('AB1');
    await page.getByRole('button', { name: /Join game →/ }).click();

    // Should stay on home — hash should not have changed to /join/.
    await expect(page).not.toHaveURL(/#\/join\//);
    await expect(page).toHaveURL(/\/?#?\/?$/);
  });

  test('home shows quiz count when quizzes are saved', async ({ page }) => {
    await seedQuiz(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // When at least one quiz is saved the Home page shows "1 quiz saved…"
    await expect(page.getByText(/1 quiz saved/i)).toBeVisible();
  });

  test('home shows prompt when no quizzes are saved', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.removeItem('kahootlite:quizzes');
    });
    await page.reload();
    await page.waitForLoadState('networkidle');

    // With zero quizzes the copy should mention building one.
    await expect(
      page.getByText(/Pick a saved quiz or build a new one/i)
    ).toBeVisible();
  });

  test('\"+ New quiz\" button navigates to the creator', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /\+ New quiz/ }).click();
    await expect(page).toHaveURL(/#\/create/);
    await expect(
      page.getByRole('heading', { name: /New quiz/i })
    ).toBeVisible();
  });

  test('\"My quizzes\" button navigates to the quiz library', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /My quizzes/ }).click();
    await expect(page).toHaveURL(/#\/quizzes/);
    await expect(
      page.getByRole('heading', { name: /My quizzes/i })
    ).toBeVisible();
  });

  test('PIN input auto-uppercases and strips whitespace', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const input = page.getByPlaceholder('ABC123');
    // Type a mixed-case code; the onChange handler uppercases and strips spaces.
    await input.pressSequentially('abc 12');
    await expect(input).toHaveValue('ABC12');
  });
});

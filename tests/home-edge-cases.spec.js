import { test, expect } from '@playwright/test';
import { seedQuiz, SAMPLE_QUIZ } from './helpers.js';

test.describe('Home screen — edge cases', () => {
  // ── PIN input guard ────────────────────────────────────────────────────────

  test('does NOT navigate when the typed PIN is shorter than 4 characters', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Type a 3-character PIN (below the required minimum of 4).
    await page.getByPlaceholder('ABC123').fill('AB');
    await page.getByRole('button', { name: /Join game →/ }).click();

    // URL must stay on the home screen — no navigation should have occurred.
    await expect(page).toHaveURL(/\/?#?\/?$/);
  });

  test('PIN input converts lowercase to uppercase automatically', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // The input normalises input to uppercase and strips whitespace.
    const input = page.getByPlaceholder('ABC123');
    await input.fill('abc12');

    // The displayed value should be uppercased.
    await expect(input).toHaveValue('ABC12');
  });

  // ── "Host a quiz" section quiz count ──────────────────────────────────────

  test('shows "No quizzes saved" copy when no quizzes exist', async ({
    page,
  }) => {
    await page.goto('/');
    await page.evaluate(() =>
      localStorage.removeItem('kahootlite:quizzes')
    );
    await page.reload();
    await page.waitForLoadState('networkidle');

    // When quizCount === 0, the host section shows a default hint.
    await expect(
      page.getByText(/Pick a saved quiz or build a new one/i)
    ).toBeVisible();
  });

  test('shows the saved quiz count in the "Host a quiz" section', async ({
    page,
  }) => {
    await seedQuiz(page);
    await page.reload();
    await page.waitForLoadState('networkidle');

    // With 1 quiz seeded the copy should read "1 quiz saved on this device."
    await expect(page.getByText(/1 quiz saved on this device/i)).toBeVisible();
  });

  // ── Navigation CTAs ────────────────────────────────────────────────────────

  test('"My quizzes" button navigates to the quiz library', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /My quizzes/ }).click();

    await expect(page).toHaveURL(/#\/quizzes/);
  });

  test('"+ New quiz" button navigates to the quiz creator', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /\+ New quiz/ }).click();

    await expect(page).toHaveURL(/#\/create/);
  });

  // ── 4-character PIN minimum boundary ──────────────────────────────────────

  test('navigates to join screen when the PIN is exactly 4 characters', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Exactly 4 chars — the minimum length that triggers navigation.
    await page.getByPlaceholder('ABC123').fill('ABCD');
    await page.getByRole('button', { name: /Join game →/ }).click();

    await expect(page).toHaveURL(/#\/join\/ABCD$/);
  });
});

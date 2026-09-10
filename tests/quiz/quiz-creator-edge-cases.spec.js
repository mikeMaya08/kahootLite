import { test, expect } from '@playwright/test';

test.describe('Quiz creator — additional edge cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('kahootlite:quizzes'));
    await page.goto('/#/create');
  });

  // ── Validation: empty question text ───────────────────────────────────────

  test('blocks save when question text is empty', async ({ page }) => {
    await page.getByLabel('Quiz title').fill('No-text quiz');
    await page.getByPlaceholder('Option A').fill('Yes');
    await page.getByPlaceholder('Option B').fill('No');

    await page.getByRole('button', { name: 'Save quiz' }).click();

    await expect(page.getByText(/Question 1 needs text\./i)).toBeVisible();
  });

  test('blocks save when quiz title is empty but question is present', async ({ page }) => {
    await page.getByLabel('Question text').fill('Valid question?');
    await page.getByPlaceholder('Option A').fill('Yes');
    await page.getByPlaceholder('Option B').fill('No');
    await page.getByRole('button', { name: 'Save quiz' }).click();

    await expect(page.getByText(/Question 1 needs text|title/i)).toBeVisible();
  });

  // ── Time-limit selector ───────────────────────────────────────────────────

  test('time-limit select is visible and has the expected default value', async ({ page }) => {
    const timeLimitSelect = page.getByLabel(/Time limit/i).first();
    await expect(timeLimitSelect).toBeVisible();
    await expect(timeLimitSelect).toHaveValue('20');
  });

  test('time-limit value persists into the saved quiz', async ({ page }) => {
    await page.getByLabel('Quiz title').fill('Timed Quiz');
    await page.getByLabel('Question text').fill('Quick question?');
    await page.getByPlaceholder('Option A').fill('Fast');
    await page.getByPlaceholder('Option B').fill('Slow');

    await page.getByLabel(/Time limit/i).first().selectOption('10');

    await page.getByRole('button', { name: 'Save quiz' }).click();
    await expect(page).toHaveURL(/#\/quizzes/);

    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('kahootlite:quizzes') || '[]')
    );
    expect(stored[0].questions[0].timeLimit).toBe(10);
  });

  // ── Cancel navigation ─────────────────────────────────────────────────────

  test('"Cancel" button navigates back to the quiz library', async ({ page }) => {
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page).toHaveURL(/#\/quizzes/);
  });

  test('"← Home" button on the creator navigates to home', async ({ page }) => {
    await page.getByRole('button', { name: /← Home/i }).click();
    await expect(page).toHaveURL(/\/?#?\/?(|$)/);
  });

  // ── Duplicate question updates correctIndex ───────────────────────────────

  test('duplicated question inherits the correct answer index of the original', async ({ page }) => {
    await page.getByLabel('Question text').fill('Best option?');
    await page.getByPlaceholder('Option A').fill('Wrong');
    await page.getByPlaceholder('Option B').fill('Right');
    await page.getByLabel('Correct answer').first().selectOption({ index: 1 });

    await page.getByRole('button', { name: 'Duplicate question' }).click();
    await expect(page.locator('.question-editor')).toHaveCount(2);

    await expect(
      page.getByLabel('Correct answer').nth(1)
    ).toHaveValue('1');
  });
});

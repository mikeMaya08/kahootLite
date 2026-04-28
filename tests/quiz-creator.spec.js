import { test, expect } from '@playwright/test';

test.describe('Quiz creator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/create');
  });

  test('blocks save when title is empty', async ({ page }) => {
    await page.getByRole('button', { name: 'Save quiz' }).click();
    await expect(page.getByText(/Give your quiz a title/i)).toBeVisible();
  });

  test('blocks save when fewer than 2 options are filled', async ({
    page,
  }) => {
    await page.getByLabel('Quiz title').fill('Half-built');
    await page.getByLabel('Question text').fill('Anything?');
    await page.getByPlaceholder('Option A').fill('Only one');
    await page.getByRole('button', { name: 'Save quiz' }).click();
    await expect(
      page.getByText(/needs at least 2 answer options/i)
    ).toBeVisible();
  });

  test('saves a complete quiz and lands in the library', async ({ page }) => {
    await page.getByLabel('Quiz title').fill('Capitals');
    await page.getByLabel('Question text').fill('Capital of France?');
    await page.getByPlaceholder('Option A').fill('Paris');
    await page.getByPlaceholder('Option B').fill('Berlin');
    await page.getByPlaceholder('Option C').fill('Madrid');
    await page.getByPlaceholder('Option D').fill('Rome');

    await page.getByRole('button', { name: 'Save quiz' }).click();

    await expect(page).toHaveURL(/#\/quizzes/);
    await expect(page.getByRole('heading', { name: 'Capitals' })).toBeVisible();
    await expect(page.getByText(/1 question/i)).toBeVisible();
  });

  test('add and remove question controls work', async ({ page }) => {
    await expect(page.locator('.question-editor')).toHaveCount(1);

    await page.getByRole('button', { name: /\+ Add question/ }).click();
    await expect(page.locator('.question-editor')).toHaveCount(2);

    await page
      .getByRole('button', { name: 'Remove question' })
      .first()
      .click();
    await expect(page.locator('.question-editor')).toHaveCount(1);
  });

  test('"Save & host" persists the quiz and opens a fresh lobby with a 6-char PIN', async ({
    page,
  }) => {
    await page.getByLabel('Quiz title').fill('Snap quiz');
    await page.getByLabel('Question text').fill('1 + 1?');
    await page.getByPlaceholder('Option A').fill('2');
    await page.getByPlaceholder('Option B').fill('3');

    await page.getByRole('button', { name: /Save .* host/i }).click();

    await page.waitForURL(/#\/host\//);
    const code = (await page.locator('.big-code').first().innerText()).trim();
    expect(code).toMatch(/^[A-Z0-9]{6}$/);

    // The quiz should also be persisted, not just live for this room.
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('kahootlite:quizzes') || '[]')
    );
    expect(stored).toHaveLength(1);
    expect(stored[0].title).toBe('Snap quiz');
  });
});

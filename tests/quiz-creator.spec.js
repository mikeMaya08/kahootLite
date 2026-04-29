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

  test('blocks save when correct answer points to an empty option', async ({
    page,
  }) => {
    await page.getByLabel('Quiz title').fill('Bad quiz');
    await page.getByLabel('Question text').fill('What is 2 + 2?');
    await page.getByPlaceholder('Option A').fill('4');
    await page.getByPlaceholder('Option B').fill('5');
    // Correct answer defaults to Option A (index 0), which is filled.
    // We switch it to Option C which is intentionally left empty.
    await page.getByLabel('Correct answer').selectOption({ index: 2 });

    await page.getByRole('button', { name: 'Save quiz' }).click();

    await expect(
      page.getByText(/correct option is empty/i)
    ).toBeVisible();
  });

  test('edit route pre-fills the form with existing quiz data', async ({
    page,
  }) => {
    // Seed a quiz directly into localStorage
    const quiz = {
      id: 'quiz-edit-test',
      title: 'Geography Quiz',
      questions: [
        {
          id: 'q-1',
          text: 'Capital of Spain?',
          options: ['Madrid', 'Lisbon', 'Paris', 'Rome'],
          correctIndex: 0,
          timeLimit: 30,
        },
      ],
      createdAt: 0,
      updatedAt: 0,
    };
    await page.evaluate((q) => {
      localStorage.setItem('kahootlite:quizzes', JSON.stringify([q]));
    }, quiz);

    await page.goto('/#/edit/quiz-edit-test');

    // Title and question fields should be pre-filled
    await expect(page.getByLabel('Quiz title')).toHaveValue('Geography Quiz');
    await expect(page.getByLabel('Question text')).toHaveValue('Capital of Spain?');
    await expect(page.getByPlaceholder('Option A')).toHaveValue('Madrid');
    await expect(page.getByPlaceholder('Option B')).toHaveValue('Lisbon');

    // Page heading should say "Edit quiz" not "New quiz"
    await expect(
      page.getByRole('heading', { name: 'Edit quiz' })
    ).toBeVisible();
  });
});

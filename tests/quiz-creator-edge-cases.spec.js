import { test, expect } from '@playwright/test';

test.describe('Quiz creator — additional edge cases', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any stale quiz data so each test starts clean.
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('kahootlite:quizzes'));
    await page.goto('/#/create');
  });

  // ── Validation: empty question text ───────────────────────────────────────

  test('blocks save when question text is empty', async ({ page }) => {
    await page.getByLabel('Quiz title').fill('No-text quiz');
    // Leave the question text blank; fill two options so that validation
    // reaches the question-text check.
    await page.getByPlaceholder('Option A').fill('Yes');
    await page.getByPlaceholder('Option B').fill('No');

    await page.getByRole('button', { name: 'Save quiz' }).click();

    // The error message for an empty question text.
    await expect(page.getByText(/Question 1 needs text\./i)).toBeVisible();
  });

  test('blocks save when zero questions remain after removing all but one and that one is invalid', async ({
    page,
  }) => {
    // A quiz must have at least one question, so only the title-empty and
    // question-level errors matter here. Confirm the question-text error
    // fires even when it is the first (and only) question.
    await page.getByLabel('Quiz title').fill('Zero-text quiz');
    // No question text, no options.
    await page.getByRole('button', { name: 'Save quiz' }).click();

    // The first failing check for this state is question text.
    await expect(page.getByText(/Question 1 needs text/i)).toBeVisible();
  });

  // ── Time-limit selector ───────────────────────────────────────────────────

  test('time-limit select is visible and has the expected default value', async ({
    page,
  }) => {
    // QuestionEditor renders a time-limit selector for each question.
    const timeLimitSelect = page.getByLabel(/Time limit/i).first();
    await expect(timeLimitSelect).toBeVisible();
    // The default in blankQuestion() is 20 seconds.
    await expect(timeLimitSelect).toHaveValue('20');
  });

  test('time-limit value persists into the saved quiz', async ({ page }) => {
    await page.getByLabel('Quiz title').fill('Timed Quiz');
    await page.getByLabel('Question text').fill('Quick question?');
    await page.getByPlaceholder('Option A').fill('Fast');
    await page.getByPlaceholder('Option B').fill('Slow');

    // Change the time limit to 10 seconds.
    await page.getByLabel(/Time limit/i).first().selectOption('10');

    await page.getByRole('button', { name: 'Save quiz' }).click();
    await expect(page).toHaveURL(/#\/quizzes/);

    // Verify the saved quiz has timeLimit = 10 for the first question.
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
    await expect(page).toHaveURL(/\/?#?\/?$/);
  });

  // ── Multiple questions — validation scoped to each question ───────────────

  test('error identifies the correct question number when Q2 is invalid', async ({
    page,
  }) => {
    // Fill Q1 fully.
    await page.getByLabel('Quiz title').fill('Multi question quiz');
    await page.getByLabel('Question text').fill('Valid Q1?');
    await page.getByPlaceholder('Option A').fill('Opt A');
    await page.getByPlaceholder('Option B').fill('Opt B');

    // Add Q2 but leave its text empty.
    await page.getByRole('button', { name: /\+ Add question/ }).click();
    await expect(page.locator('.question-editor')).toHaveCount(2);

    // Fill Q2 options but not the question text.
    await page.getByPlaceholder('Option A').nth(1).fill('X');
    await page.getByPlaceholder('Option B').nth(1).fill('Y');

    await page.getByRole('button', { name: 'Save quiz' }).click();

    // Error message must reference "Question 2".
    await expect(page.getByText(/Question 2 needs text/i)).toBeVisible();
  });

  // ── Duplicate question updates correctIndex ───────────────────────────────

  test('duplicated question inherits the correct answer index of the original', async ({
    page,
  }) => {
    // Set up a question with correctIndex = 1 (Option B).
    await page.getByLabel('Question text').fill('Best option?');
    await page.getByPlaceholder('Option A').fill('Wrong');
    await page.getByPlaceholder('Option B').fill('Right');
    await page.getByLabel('Correct answer').first().selectOption({ index: 1 });

    // Duplicate the question.
    await page.getByRole('button', { name: 'Duplicate question' }).click();
    await expect(page.locator('.question-editor')).toHaveCount(2);

    // The second (duplicated) question's correct-answer select should also show index 1.
    await expect(
      page.getByLabel('Correct answer').nth(1)
    ).toHaveValue('1');
  });
});

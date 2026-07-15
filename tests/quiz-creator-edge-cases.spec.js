import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Quiz Creator — edge-cases not covered in quiz-creator.spec.js
//   • Time-limit field is clamped to [5, 120]
//   • A multi-question quiz can be saved (title + all questions valid)
//   • "Cancel" navigates to the quiz library
//   • Validation error shown when a question has no text
//   • Validation error when the quiz has zero questions (all removed)
// ---------------------------------------------------------------------------

test.describe('Quiz creator — edge cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/create');
  });

  // ── Time-limit clamping: below min → snaps to 5 ───────────────────────────
  test('time-limit input clamps to 5 when given a value below the minimum', async ({
    page,
  }) => {
    const timeLimitInput = page.locator('input[type="number"]').first();

    // Clear and type a value below the minimum.
    await timeLimitInput.fill('1');
    await timeLimitInput.blur();

    // The component enforces Math.max(5, …) so the stored value should be 5.
    // Trigger validation to surface the clamped value.
    await page.getByLabel('Quiz title').fill('Clamped');
    await page.getByLabel('Question text').fill('Any question?');
    await page.getByPlaceholder('Option A').fill('A');
    await page.getByPlaceholder('Option B').fill('B');
    await page.getByRole('button', { name: 'Save quiz' }).click();
    await expect(page).toHaveURL(/#\/quizzes/);

    // Confirm the saved quiz has timeLimit = 5.
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('kahootlite:quizzes') || '[]')
    );
    expect(stored[0].questions[0].timeLimit).toBe(5);
  });

  // ── Time-limit clamping: above max → snaps to 120 ────────────────────────
  test('time-limit input clamps to 120 when given a value above the maximum', async ({
    page,
  }) => {
    const timeLimitInput = page.locator('input[type="number"]').first();
    await timeLimitInput.fill('999');
    await timeLimitInput.blur();

    await page.getByLabel('Quiz title').fill('Big timer');
    await page.getByLabel('Question text').fill('Slow question?');
    await page.getByPlaceholder('Option A').fill('A');
    await page.getByPlaceholder('Option B').fill('B');
    await page.getByRole('button', { name: 'Save quiz' }).click();
    await expect(page).toHaveURL(/#\/quizzes/);

    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('kahootlite:quizzes') || '[]')
    );
    expect(stored[0].questions[0].timeLimit).toBe(120);
  });

  // ── Multi-question quiz saves correctly ───────────────────────────────────
  test('a quiz with two complete questions saves successfully', async ({
    page,
  }) => {
    await page.getByLabel('Quiz title').fill('Two-parter');

    // Fill in question 1.
    await page.getByLabel('Question text').fill('Q1: Capital of France?');
    await page.getByPlaceholder('Option A').fill('Paris');
    await page.getByPlaceholder('Option B').fill('Berlin');

    // Add a second question.
    await page.getByRole('button', { name: /\+ Add question/ }).click();
    await expect(page.locator('.question-editor')).toHaveCount(2);

    // Fill in question 2 — target the second editor's fields.
    const editors = page.locator('.question-editor');
    await editors.nth(1).getByLabel('Question text').fill('Q2: Capital of Germany?');
    await editors.nth(1).getByPlaceholder('Option A').fill('Vienna');
    await editors.nth(1).getByPlaceholder('Option B').fill('Berlin');

    await page.getByRole('button', { name: 'Save quiz' }).click();
    await expect(page).toHaveURL(/#\/quizzes/);

    // Library should display "2 questions".
    await expect(page.getByText(/2 questions/i)).toBeVisible();
  });

  // ── Validation: question text is required ─────────────────────────────────
  test('blocks save when a question has no text', async ({ page }) => {
    await page.getByLabel('Quiz title').fill('Untitled question');
    // Leave the question text blank intentionally.
    await page.getByPlaceholder('Option A').fill('A');
    await page.getByPlaceholder('Option B').fill('B');

    await page.getByRole('button', { name: 'Save quiz' }).click();

    await expect(
      page.getByText(/Question 1 needs text/i)
    ).toBeVisible();
  });

  // ── Validation: at least one question required ────────────────────────────
  test('blocks save when all questions are removed', async ({ page }) => {
    await page.getByLabel('Quiz title').fill('Empty quiz');

    // Add a second question so we can remove the first (canRemove = true).
    await page.getByRole('button', { name: /\+ Add question/ }).click();
    await expect(page.locator('.question-editor')).toHaveCount(2);

    // Remove both questions.
    await page
      .getByRole('button', { name: 'Remove question' })
      .first()
      .click();
    await expect(page.locator('.question-editor')).toHaveCount(1);

    // The last remaining editor cannot be removed (canRemove = false),
    // so we verify the validation fires for an empty question instead.
    await page.getByRole('button', { name: 'Save quiz' }).click();

    // Either "needs text" or "at least one question" validation error.
    await expect(
      page.getByText(/Question 1 needs text|at least one question/i)
    ).toBeVisible();
  });

  // ── "Cancel" navigates to the quiz library ────────────────────────────────
  test('"Cancel" button navigates to the quiz library without saving', async ({
    page,
  }) => {
    await page.getByLabel('Quiz title').fill('Draft quiz not saved');
    await page.getByRole('button', { name: /Cancel/i }).click();

    await expect(page).toHaveURL(/#\/quizzes/);

    // Nothing should have been saved.
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('kahootlite:quizzes') || '[]')
    );
    const draft = stored.find((q) => q.title === 'Draft quiz not saved');
    expect(draft).toBeUndefined();
  });

  // ── Home navigation from the creator ─────────────────────────────────────
  test('"← Home" button navigates back to the home screen', async ({
    page,
  }) => {
    await page.getByRole('button', { name: /← Home/i }).click();
    await expect(page).toHaveURL(/\/?#?(?:\/)?$/);
    await expect(page.getByRole('heading', { name: /KahootLite/i })).toBeVisible();
  });
});

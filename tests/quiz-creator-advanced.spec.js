import { test, expect } from '@playwright/test';

// All tests start on the creator page with a clean localStorage slate.
test.describe('Quiz creator — advanced validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('kahootlite:quizzes'));
    await page.goto('/#/create');
  });

  // ── Question-text validation ─────────────────────────────────────────────

  test('blocks save when question text is empty', async ({ page }) => {
    // Title is set but the question text field is left blank.
    await page.getByLabel('Quiz title').fill('Valid Title');
    await page.getByPlaceholder('Option A').fill('Choice 1');
    await page.getByPlaceholder('Option B').fill('Choice 2');

    await page.getByRole('button', { name: 'Save quiz' }).click();

    // The validator checks question text before checking answer options.
    await expect(page.getByText(/Question 1 needs text/i)).toBeVisible();
  });

  // ── Time-limit field ─────────────────────────────────────────────────────

  test('time limit field is pre-filled and its value is saved with the quiz', async ({ page }) => {
    await page.getByLabel('Quiz title').fill('Timed Quiz');
    await page.getByLabel('Question text').fill('What is 2 + 2?');
    await page.getByPlaceholder('Option A').fill('3');
    await page.getByPlaceholder('Option B').fill('4');

    // The default timeLimit is 20 s — verify the field shows that value.
    const timeLimitInput = page.getByLabel(/time limit/i);
    await expect(timeLimitInput).toHaveValue('20');

    // Change it to 10 s.
    await timeLimitInput.fill('10');

    await page.getByRole('button', { name: 'Save quiz' }).click();
    await expect(page).toHaveURL(/#\/quizzes/);

    // Confirm the stored quiz actually contains timeLimit: 10.
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('kahootlite:quizzes') || '[]')
    );
    expect(stored).toHaveLength(1);
    expect(stored[0].questions[0].timeLimit).toBe(10);
  });

  // ── Multiple-question round-trip ─────────────────────────────────────────

  test('two-question quiz is fully saved and both questions appear in the library', async ({
    page,
  }) => {
    await page.getByLabel('Quiz title').fill('Two-Q Quiz');

    // Fill question 1.
    await page.getByLabel('Question text').fill('Capital of France?');
    await page.getByPlaceholder('Option A').fill('Paris');
    await page.getByPlaceholder('Option B').fill('Berlin');

    // Add a second question.
    await page.getByRole('button', { name: /\+ Add question/ }).click();

    // The second QuestionEditor appears — fill it using nth(1) to scope correctly.
    const editors = page.locator('.question-editor');
    await editors.nth(1).getByLabel('Question text').fill('Capital of Spain?');
    await editors.nth(1).getByPlaceholder('Option A').fill('Madrid');
    await editors.nth(1).getByPlaceholder('Option B').fill('Lisbon');

    await page.getByRole('button', { name: 'Save quiz' }).click();
    await expect(page).toHaveURL(/#\/quizzes/);

    // Library card should display "2 questions".
    await expect(page.getByText(/2 questions/i)).toBeVisible();
  });

  // ── Cancel navigation ────────────────────────────────────────────────────

  test('"Cancel" button navigates back to the quiz library', async ({ page }) => {
    // "Cancel" sends the user to /quizzes, not home.
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page).toHaveURL(/#\/quizzes/);
    await expect(page.getByRole('heading', { name: /My quizzes/i })).toBeVisible();
  });

  // ── Correct-answer selector persists ────────────────────────────────────

  test('selected correct answer index is stored in the saved quiz', async ({ page }) => {
    await page.getByLabel('Quiz title').fill('Correct Index Quiz');
    await page.getByLabel('Question text').fill('Best city?');
    await page.getByPlaceholder('Option A').fill('London');
    await page.getByPlaceholder('Option B').fill('Paris');
    await page.getByPlaceholder('Option C').fill('Tokyo');

    // Switch the correct answer to Option B (index 1).
    await page.getByLabel('Correct answer').selectOption({ index: 1 });

    await page.getByRole('button', { name: 'Save quiz' }).click();
    await expect(page).toHaveURL(/#\/quizzes/);

    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('kahootlite:quizzes') || '[]')
    );
    expect(stored[0].questions[0].correctIndex).toBe(1);
  });

  // ── "New quiz" heading vs "Edit quiz" heading ────────────────────────────

  test('heading shows "New quiz" on the create route', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'New quiz' })).toBeVisible();
  });

  // ── Remove last question is disabled ────────────────────────────────────

  test('"Remove question" button is disabled (not visible) when only one question remains', async ({
    page,
  }) => {
    // canRemove is false when questions.length === 1 — the button should be absent.
    await expect(page.getByRole('button', { name: 'Remove question' })).toHaveCount(0);
  });
});

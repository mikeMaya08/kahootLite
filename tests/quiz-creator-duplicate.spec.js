import { test, expect } from '@playwright/test';

test.describe('Quiz creator — Duplicate question', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/create');
  });

  // ── Visibility ────────────────────────────────────────────────────────────

  test('"Duplicate question" button is always visible, even with a single question', async ({
    page,
  }) => {
    // Only one question exists; "Remove question" must be hidden but
    // "Duplicate question" must always be available.
    await expect(page.locator('.question-editor')).toHaveCount(1);
    await expect(
      page.getByRole('button', { name: 'Duplicate question' })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Remove question' })
    ).toHaveCount(0);
  });

  // ── Core duplication behaviour ────────────────────────────────────────────

  test('duplicating the only question increases the question count to 2', async ({
    page,
  }) => {
    await expect(page.locator('.question-editor')).toHaveCount(1);
    await page.getByRole('button', { name: 'Duplicate question' }).click();
    await expect(page.locator('.question-editor')).toHaveCount(2);
  });

  test('duplicate copies text, options, correct answer, and time limit', async ({
    page,
  }) => {
    // Fill out the first question completely.
    await page.getByLabel('Question text').fill('Capital of France?');
    await page.getByPlaceholder('Option A').fill('Paris');
    await page.getByPlaceholder('Option B').fill('Berlin');
    await page.getByPlaceholder('Option C').fill('Madrid');
    await page.getByPlaceholder('Option D').fill('Rome');
    // Change the time limit and correct answer from their defaults.
    await page.getByLabel('Time limit (seconds)').fill('45');
    await page.getByLabel('Correct answer').selectOption({ index: 0 }); // Paris

    await page.getByRole('button', { name: 'Duplicate question' }).click();

    // The second question editor should have identical content.
    const editors = page.locator('.question-editor');
    await expect(editors).toHaveCount(2);

    const second = editors.nth(1);
    await expect(second.getByLabel('Question text')).toHaveValue(
      'Capital of France?'
    );
    await expect(second.getByPlaceholder('Option A')).toHaveValue('Paris');
    await expect(second.getByPlaceholder('Option B')).toHaveValue('Berlin');
    await expect(second.getByPlaceholder('Option C')).toHaveValue('Madrid');
    await expect(second.getByPlaceholder('Option D')).toHaveValue('Rome');
    await expect(second.getByLabel('Time limit (seconds)')).toHaveValue('45');
    // Correct-answer select should still point to index 0 (Paris).
    await expect(second.getByLabel('Correct answer')).toHaveValue('0');
  });

  test('duplicated question is inserted directly after the source, not at the end', async ({
    page,
  }) => {
    // Build a 2-question quiz first.
    await page.getByLabel('Question text').fill('Question A');
    await page.getByRole('button', { name: /\+ Add question/ }).click();
    const second = page.locator('.question-editor').nth(1);
    await second.getByLabel('Question text').fill('Question B');

    // Duplicate the FIRST question — the clone should land at position 2,
    // not at the end (position 3).
    await page
      .locator('.question-editor')
      .nth(0)
      .getByRole('button', { name: 'Duplicate question' })
      .click();

    await expect(page.locator('.question-editor')).toHaveCount(3);

    // Position 0: original "Question A"
    await expect(
      page.locator('.question-editor').nth(0).getByLabel('Question text')
    ).toHaveValue('Question A');
    // Position 1: clone of "Question A"
    await expect(
      page.locator('.question-editor').nth(1).getByLabel('Question text')
    ).toHaveValue('Question A');
    // Position 2: untouched "Question B"
    await expect(
      page.locator('.question-editor').nth(2).getByLabel('Question text')
    ).toHaveValue('Question B');
  });

  // ── Interaction between duplicate and remove ──────────────────────────────

  test('"Remove question" appears on both editors once a duplicate exists', async ({
    page,
  }) => {
    // With only one question "Remove question" should be absent.
    await expect(
      page.getByRole('button', { name: 'Remove question' })
    ).toHaveCount(0);

    await page.getByRole('button', { name: 'Duplicate question' }).click();

    // Now there are 2 questions; both editors must show "Remove question".
    await expect(page.locator('.question-editor')).toHaveCount(2);
    await expect(
      page.getByRole('button', { name: 'Remove question' })
    ).toHaveCount(2);
  });

  test('removing one of two duplicated questions leaves a single question without "Remove question"', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Duplicate question' }).click();
    await expect(page.locator('.question-editor')).toHaveCount(2);

    // Remove the first one.
    await page
      .locator('.question-editor')
      .nth(0)
      .getByRole('button', { name: 'Remove question' })
      .click();

    await expect(page.locator('.question-editor')).toHaveCount(1);
    await expect(
      page.getByRole('button', { name: 'Remove question' })
    ).toHaveCount(0);
  });

  // ── Editing independence ──────────────────────────────────────────────────

  test('editing the duplicate does not affect the original', async ({
    page,
  }) => {
    await page.getByLabel('Question text').fill('Original text');
    await page.getByRole('button', { name: 'Duplicate question' }).click();

    // Change the cloned question's text.
    await page
      .locator('.question-editor')
      .nth(1)
      .getByLabel('Question text')
      .fill('Edited clone');

    // Original must be unchanged.
    await expect(
      page.locator('.question-editor').nth(0).getByLabel('Question text')
    ).toHaveValue('Original text');
  });

  // ── End-to-end save ───────────────────────────────────────────────────────

  test('a quiz with a duplicated question saves successfully and shows correct question count', async ({
    page,
  }) => {
    await page.getByLabel('Quiz title').fill('Dup quiz');
    await page.getByLabel('Question text').fill('Q1 text');
    await page.getByPlaceholder('Option A').fill('Opt A');
    await page.getByPlaceholder('Option B').fill('Opt B');

    await page.getByRole('button', { name: 'Duplicate question' }).click();

    // The duplicate inherits the filled options so the quiz is valid (2 questions,
    // each with 2+ options and a valid correct answer).
    await page.getByRole('button', { name: 'Save quiz' }).click();

    await expect(page).toHaveURL(/#\/quizzes/);
    await expect(page.getByText(/2 questions/i)).toBeVisible();
  });

  test('duplicating multiple times accumulates all copies in order', async ({
    page,
  }) => {
    await page.getByLabel('Question text').fill('Repeated Q');
    // Duplicate twice to get 3 questions total.
    await page
      .locator('.question-editor')
      .nth(0)
      .getByRole('button', { name: 'Duplicate question' })
      .click();
    await page
      .locator('.question-editor')
      .nth(0)
      .getByRole('button', { name: 'Duplicate question' })
      .click();

    await expect(page.locator('.question-editor')).toHaveCount(3);
    // All three should share the same text (each was cloned from index 0).
    for (let i = 0; i < 3; i++) {
      await expect(
        page.locator('.question-editor').nth(i).getByLabel('Question text')
      ).toHaveValue('Repeated Q');
    }
  });
});

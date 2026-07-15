import { test, expect } from '@playwright/test';

// Tests for the "Duplicate question" button introduced in the quiz creator.
// Each test is fully isolated — it navigates to /#/create and builds state
// from scratch so there is no dependency on run order or localStorage from
// other specs.

test.describe('Quiz creator — duplicate question', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any leftover quiz data and start on the creator
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('kahootlite:quizzes'));
    await page.goto('/#/create');
  });

  // ── Button presence ────────────────────────────────────────────────────────

  test('"Duplicate question" button is visible on the only question', async ({
    page,
  }) => {
    // With a single question canRemove is false, so "Remove question" is hidden.
    // "Duplicate question" must still be shown.
    await expect(
      page.getByRole('button', { name: 'Duplicate question' })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Remove question' })
    ).toBeHidden();
  });

  test('"Duplicate question" button is visible alongside "Remove question" when multiple questions exist', async ({
    page,
  }) => {
    // Add a second question so canRemove becomes true
    await page.getByRole('button', { name: /\+ Add question/ }).click();
    await expect(page.locator('.question-editor')).toHaveCount(2);

    // Both buttons must appear on each editor
    await expect(
      page.getByRole('button', { name: 'Duplicate question' })
    ).toHaveCount(2);
    await expect(
      page.getByRole('button', { name: 'Remove question' })
    ).toHaveCount(2);
  });

  // ── Core duplication behaviour ─────────────────────────────────────────────

  test('clicking "Duplicate question" increases the question count by one', async ({
    page,
  }) => {
    await expect(page.locator('.question-editor')).toHaveCount(1);

    await page.getByRole('button', { name: 'Duplicate question' }).click();

    await expect(page.locator('.question-editor')).toHaveCount(2);
  });

  test('duplicate copies question text into the new question', async ({
    page,
  }) => {
    const questionText = 'What is the capital of France?';
    await page.getByLabel('Question text').fill(questionText);

    await page.getByRole('button', { name: 'Duplicate question' }).click();

    // Both question editors should now show the same text
    const editors = page.locator('.question-editor');
    await expect(editors).toHaveCount(2);
    await expect(editors.nth(1).getByLabel('Question text')).toHaveValue(
      questionText
    );
  });

  test('duplicate copies all four answer options into the new question', async ({
    page,
  }) => {
    await page.getByPlaceholder('Option A').fill('Paris');
    await page.getByPlaceholder('Option B').fill('Berlin');
    await page.getByPlaceholder('Option C').fill('Madrid');
    await page.getByPlaceholder('Option D').fill('Rome');

    await page.getByRole('button', { name: 'Duplicate question' }).click();

    const clone = page.locator('.question-editor').nth(1);
    await expect(clone.getByPlaceholder('Option A')).toHaveValue('Paris');
    await expect(clone.getByPlaceholder('Option B')).toHaveValue('Berlin');
    await expect(clone.getByPlaceholder('Option C')).toHaveValue('Madrid');
    await expect(clone.getByPlaceholder('Option D')).toHaveValue('Rome');
  });

  test('duplicate preserves the correct-answer selection', async ({ page }) => {
    // Fill enough options to make the dropdown meaningful
    await page.getByPlaceholder('Option A').fill('Paris');
    await page.getByPlaceholder('Option B').fill('Berlin');
    // Change correct answer to Option B (index 1)
    await page.getByLabel('Correct answer').selectOption({ index: 1 });

    await page.getByRole('button', { name: 'Duplicate question' }).click();

    const cloneSelect = page
      .locator('.question-editor')
      .nth(1)
      .getByLabel('Correct answer');
    await expect(cloneSelect).toHaveValue('1');
  });

  test('duplicate preserves the time limit', async ({ page }) => {
    // Change time limit on the original question from the default (20) to 45
    const timeLimitInput = page
      .locator('.question-editor')
      .nth(0)
      .getByLabel('Time limit (seconds)');
    await timeLimitInput.fill('45');
    // Blur to commit the value
    await timeLimitInput.blur();

    await page.getByRole('button', { name: 'Duplicate question' }).click();

    const cloneTimeLimitInput = page
      .locator('.question-editor')
      .nth(1)
      .getByLabel('Time limit (seconds)');
    await expect(cloneTimeLimitInput).toHaveValue('45');
  });

  // ── Insertion position ─────────────────────────────────────────────────────

  test('duplicated question is inserted immediately after the source', async ({
    page,
  }) => {
    // Build a 2-question quiz so we can check insertion position
    await page.getByLabel('Question text').fill('First question');
    await page.getByRole('button', { name: /\+ Add question/ }).click();
    await page
      .locator('.question-editor')
      .nth(1)
      .getByLabel('Question text')
      .fill('Second question');

    // Duplicate the FIRST question — clone should appear at position 2 (index 1),
    // pushing the original "Second question" to position 3 (index 2).
    await page
      .locator('.question-editor')
      .nth(0)
      .getByRole('button', { name: 'Duplicate question' })
      .click();

    await expect(page.locator('.question-editor')).toHaveCount(3);
    await expect(
      page.locator('.question-editor').nth(1).getByLabel('Question text')
    ).toHaveValue('First question');
    await expect(
      page.locator('.question-editor').nth(2).getByLabel('Question text')
    ).toHaveValue('Second question');
  });

  test('duplicating the last question appends the clone at the end', async ({
    page,
  }) => {
    await page.getByLabel('Question text').fill('Only question');
    // Single question — duplicate should appear after it
    await page.getByRole('button', { name: 'Duplicate question' }).click();

    await expect(page.locator('.question-editor')).toHaveCount(2);
    // The clone is at index 1
    await expect(
      page.locator('.question-editor').nth(1).getByLabel('Question text')
    ).toHaveValue('Only question');
  });

  // ── Unique ID (independence of clones) ────────────────────────────────────

  test('duplicated question receives a unique id (edits do not affect the original)', async ({
    page,
  }) => {
    await page.getByLabel('Question text').fill('Original text');
    await page.getByPlaceholder('Option A').fill('A1');
    await page.getByPlaceholder('Option B').fill('B1');

    await page.getByRole('button', { name: 'Duplicate question' }).click();

    // Edit the clone's text — the original must stay unchanged
    await page
      .locator('.question-editor')
      .nth(1)
      .getByLabel('Question text')
      .fill('Modified clone text');

    await expect(
      page.locator('.question-editor').nth(0).getByLabel('Question text')
    ).toHaveValue('Original text');
    await expect(
      page.locator('.question-editor').nth(1).getByLabel('Question text')
    ).toHaveValue('Modified clone text');
  });

  test('modifying original options after duplication does not affect the clone', async ({
    page,
  }) => {
    await page.getByPlaceholder('Option A').fill('Shared value');
    await page.getByPlaceholder('Option B').fill('B');

    await page.getByRole('button', { name: 'Duplicate question' }).click();

    // Change Option A on the ORIGINAL
    await page
      .locator('.question-editor')
      .nth(0)
      .getByPlaceholder('Option A')
      .fill('Changed value');

    // Clone must still show the original value at duplication time
    await expect(
      page.locator('.question-editor').nth(1).getByPlaceholder('Option A')
    ).toHaveValue('Shared value');
  });

  // ── Multiple duplications ──────────────────────────────────────────────────

  test('can duplicate the same question multiple times, building a longer list', async ({
    page,
  }) => {
    await page.getByLabel('Question text').fill('Repeated question');

    // Duplicate twice from the first question
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
  });

  // ── Save after duplication ────────────────────────────────────────────────

  test('a quiz with a duplicated question saves successfully', async ({
    page,
  }) => {
    await page.getByLabel('Quiz title').fill('Dup quiz');
    await page.getByLabel('Question text').fill('What is 1 + 1?');
    await page.getByPlaceholder('Option A').fill('2');
    await page.getByPlaceholder('Option B').fill('3');

    await page.getByRole('button', { name: 'Duplicate question' }).click();

    // The clone is at index 1; it already has text and two filled options
    // (copied from the original), so validation should pass.
    await page.getByRole('button', { name: 'Save quiz' }).click();

    // Should land in the library with both questions persisted
    await expect(page).toHaveURL(/#\/quizzes/);
    await expect(
      page.getByRole('heading', { name: 'Dup quiz' })
    ).toBeVisible();
    await expect(page.getByText(/2 questions/i)).toBeVisible();
  });

  test('duplicated question can be removed independently', async ({ page }) => {
    await page.getByLabel('Question text').fill('Keep me');
    await page.getByRole('button', { name: 'Duplicate question' }).click();

    await expect(page.locator('.question-editor')).toHaveCount(2);

    // Remove the clone (index 1)
    await page
      .locator('.question-editor')
      .nth(1)
      .getByRole('button', { name: 'Remove question' })
      .click();

    await expect(page.locator('.question-editor')).toHaveCount(1);
    await expect(
      page.locator('.question-editor').nth(0).getByLabel('Question text')
    ).toHaveValue('Keep me');
  });
});

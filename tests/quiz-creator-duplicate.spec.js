import { test, expect } from '@playwright/test';
import { seedQuiz } from './helpers.js';

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

  test('"Duplicate question" button is visible on the only question', { tag: ['@quiz-creator', '@ui'] }, async ({
    page,
  }) => {
    await expect(
      page.getByRole('button', { name: 'Duplicate question' })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Remove question' })
    ).toBeHidden();
  });

  test('"Duplicate question" button is visible alongside "Remove question" when multiple questions exist', { tag: ['@quiz-creator', '@ui'] }, async ({
    page,
  }) => {
    await page.getByRole('button', { name: /\+ Add question/ }).click();
    await expect(page.locator('.question-editor')).toHaveCount(2);

    await expect(
      page.getByRole('button', { name: 'Duplicate question' })
    ).toHaveCount(2);
    await expect(
      page.getByRole('button', { name: 'Remove question' })
    ).toHaveCount(2);
  });

  // ── Core duplication behaviour ─────────────────────────────────────────────

  test('clicking "Duplicate question" increases the question count by one', { tag: ['@quiz-creator', '@ui'] }, async ({
    page,
  }) => {
    await expect(page.locator('.question-editor')).toHaveCount(1);
    await page.getByRole('button', { name: 'Duplicate question' }).click();
    await expect(page.locator('.question-editor')).toHaveCount(2);
  });

  test('duplicate copies question text into the new question', { tag: ['@quiz-creator'] }, async ({
    page,
  }) => {
    const questionText = 'What is the capital of France?';
    await page.getByLabel('Question text').fill(questionText);
    await page.getByRole('button', { name: 'Duplicate question' }).click();

    const editors = page.locator('.question-editor');
    await expect(editors).toHaveCount(2);
    await expect(editors.nth(1).getByLabel('Question text')).toHaveValue(questionText);
  });

  test('duplicate copies all four answer options into the new question', { tag: ['@quiz-creator'] }, async ({
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

  test('duplicate preserves the correct-answer selection', { tag: ['@quiz-creator'] }, async ({ page }) => {
    await page.getByPlaceholder('Option A').fill('Paris');
    await page.getByPlaceholder('Option B').fill('Berlin');
    await page.getByLabel('Correct answer').selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Duplicate question' }).click();

    const cloneSelect = page.locator('.question-editor').nth(1).getByLabel('Correct answer');
    await expect(cloneSelect).toHaveValue('1');
  });

  test('duplicate preserves the time limit', { tag: ['@quiz-creator'] }, async ({ page }) => {
    const timeLimitInput = page.locator('.question-editor').nth(0).getByLabel('Time limit (seconds)');
    await timeLimitInput.fill('45');
    await timeLimitInput.blur();

    await page.getByRole('button', { name: 'Duplicate question' }).click();

    const cloneTimeLimitInput = page.locator('.question-editor').nth(1).getByLabel('Time limit (seconds)');
    await expect(cloneTimeLimitInput).toHaveValue('45');
  });

  // ── Insertion position ─────────────────────────────────────────────────────

  test('duplicated question is inserted immediately after the source', { tag: ['@quiz-creator'] }, async ({
    page,
  }) => {
    await page.getByLabel('Question text').fill('First question');
    await page.getByRole('button', { name: /\+ Add question/ }).click();
    await page.locator('.question-editor').nth(1).getByLabel('Question text').fill('Second question');

    await page.locator('.question-editor').nth(0).getByRole('button', { name: 'Duplicate question' }).click();

    await expect(page.locator('.question-editor')).toHaveCount(3);
    await expect(page.locator('.question-editor').nth(1).getByLabel('Question text')).toHaveValue('First question');
    await expect(page.locator('.question-editor').nth(2).getByLabel('Question text')).toHaveValue('Second question');
  });

  test('duplicating the last question appends the clone at the end', { tag: ['@quiz-creator'] }, async ({
    page,
  }) => {
    await page.getByLabel('Question text').fill('Only question');
    await page.getByRole('button', { name: 'Duplicate question' }).click();

    await expect(page.locator('.question-editor')).toHaveCount(2);
    await expect(page.locator('.question-editor').nth(1).getByLabel('Question text')).toHaveValue('Only question');
  });

  // ── Unique ID (independence of clones) ────────────────────────────────────

  test('duplicated question receives a unique id (edits do not affect the original)', { tag: ['@quiz-creator'] }, async ({
    page,
  }) => {
    await page.getByLabel('Question text').fill('Original text');
    await page.getByPlaceholder('Option A').fill('A1');
    await page.getByPlaceholder('Option B').fill('B1');

    await page.getByRole('button', { name: 'Duplicate question' }).click();

    await page.locator('.question-editor').nth(1).getByLabel('Question text').fill('Modified clone text');

    await expect(page.locator('.question-editor').nth(0).getByLabel('Question text')).toHaveValue('Original text');
    await expect(page.locator('.question-editor').nth(1).getByLabel('Question text')).toHaveValue('Modified clone text');
  });

  test('modifying original options after duplication does not affect the clone', { tag: ['@quiz-creator'] }, async ({
    page,
  }) => {
    await page.getByPlaceholder('Option A').fill('Shared value');
    await page.getByPlaceholder('Option B').fill('B');

    await page.getByRole('button', { name: 'Duplicate question' }).click();

    await page.locator('.question-editor').nth(0).getByPlaceholder('Option A').fill('Changed value');

    await expect(page.locator('.question-editor').nth(1).getByPlaceholder('Option A')).toHaveValue('Shared value');
  });

  // ── Multiple duplications ──────────────────────────────────────────────────

  test('can duplicate the same question multiple times, building a longer list', { tag: ['@quiz-creator'] }, async ({
    page,
  }) => {
    await page.getByLabel('Question text').fill('Repeated question');

    await page.locator('.question-editor').nth(0).getByRole('button', { name: 'Duplicate question' }).click();
    await page.locator('.question-editor').nth(0).getByRole('button', { name: 'Duplicate question' }).click();

    await expect(page.locator('.question-editor')).toHaveCount(3);
  });

  // ── Save after duplication ────────────────────────────────────────────────

  test('a quiz with a duplicated question saves successfully', { tag: ['@quiz-creator', '@smoke', '@localstorage'] }, async ({
    page,
  }) => {
    await page.getByLabel('Quiz title').fill('Dup quiz');
    await page.getByLabel('Question text').fill('What is 1 + 1?');
    await page.getByPlaceholder('Option A').fill('2');
    await page.getByPlaceholder('Option B').fill('3');

    await page.getByRole('button', { name: 'Duplicate question' }).click();

    await page.getByRole('button', { name: 'Save quiz' }).click();

    await expect(page).toHaveURL(/#\/quizzes/);
    await expect(page.getByRole('heading', { name: 'Dup quiz' })).toBeVisible();
    await expect(page.getByText(/2 questions/i)).toBeVisible();
  });

  test('duplicated question can be removed independently', { tag: ['@quiz-creator'] }, async ({ page }) => {
    await page.getByLabel('Question text').fill('Keep me');
    await page.getByRole('button', { name: 'Duplicate question' }).click();

    await expect(page.locator('.question-editor')).toHaveCount(2);

    await page.locator('.question-editor').nth(1).getByRole('button', { name: 'Remove question' }).click();

    await expect(page.locator('.question-editor')).toHaveCount(1);
    await expect(page.locator('.question-editor').nth(0).getByLabel('Question text')).toHaveValue('Keep me');
  });

  // ── Edit mode ─────────────────────────────────────────────────────────────

  test('duplicate button works when editing an existing saved quiz', { tag: ['@quiz-creator', '@localstorage'] }, async ({
    page,
  }) => {
    const quiz = {
      id: 'edit-dup-test',
      title: 'Existing Quiz',
      questions: [
        {
          id: 'q-1',
          text: 'Existing question text',
          options: ['Alpha', 'Beta', 'Gamma', 'Delta'],
          correctIndex: 1,
          timeLimit: 30,
        },
      ],
      createdAt: 0,
      updatedAt: 0,
    };
    await seedQuiz(page, quiz);
    await page.goto('/#/edit/edit-dup-test');

    await expect(page.getByLabel('Quiz title')).toHaveValue('Existing Quiz');
    await expect(page.locator('.question-editor')).toHaveCount(1);

    await page.getByRole('button', { name: 'Duplicate question' }).click();
    await expect(page.locator('.question-editor')).toHaveCount(2);

    const clone = page.locator('.question-editor').nth(1);
    await expect(clone.getByLabel('Question text')).toHaveValue('Existing question text');
    await expect(clone.getByPlaceholder('Option A')).toHaveValue('Alpha');
    await expect(clone.getByPlaceholder('Option B')).toHaveValue('Beta');
    await expect(clone.getByLabel('Correct answer')).toHaveValue('1');

    await page.getByRole('button', { name: 'Save quiz' }).click();
    await expect(page).toHaveURL(/#\/quizzes/);
    await expect(page.getByText(/2 questions/i)).toBeVisible();
  });

  // ── Insertion position — middle of list ───────────────────────────────────

  test('duplicating a middle question inserts the clone between its neighbours', { tag: ['@quiz-creator'] }, async ({
    page,
  }) => {
    await page.getByLabel('Question text').fill('Question A');
    await page.getByRole('button', { name: /\+ Add question/ }).click();
    await page.locator('.question-editor').nth(1).getByLabel('Question text').fill('Question B');
    await page.getByRole('button', { name: /\+ Add question/ }).click();
    await page.locator('.question-editor').nth(2).getByLabel('Question text').fill('Question C');

    await page.locator('.question-editor').nth(1).getByRole('button', { name: 'Duplicate question' }).click();

    await expect(page.locator('.question-editor')).toHaveCount(4);
    await expect(page.locator('.question-editor').nth(0).getByLabel('Question text')).toHaveValue('Question A');
    await expect(page.locator('.question-editor').nth(1).getByLabel('Question text')).toHaveValue('Question B');
    await expect(page.locator('.question-editor').nth(2).getByLabel('Question text')).toHaveValue('Question B');
    await expect(page.locator('.question-editor').nth(3).getByLabel('Question text')).toHaveValue('Question C');
  });

  // ── Validation after duplication ──────────────────────────────────────────

  test('save is blocked when a cloned question has its text cleared', { tag: ['@quiz-creator', '@validation'] }, async ({
    page,
  }) => {
    await page.getByLabel('Quiz title').fill('Validation after dup');
    await page.getByLabel('Question text').fill('Original question');
    await page.getByPlaceholder('Option A').fill('Yes');
    await page.getByPlaceholder('Option B').fill('No');

    await page.getByRole('button', { name: 'Duplicate question' }).click();
    await expect(page.locator('.question-editor')).toHaveCount(2);

    await page.locator('.question-editor').nth(1).getByLabel('Question text').fill('');

    await page.getByRole('button', { name: 'Save quiz' }).click();
    await expect(page.getByText(/Question 2 needs text\./i)).toBeVisible();
    await expect(page).toHaveURL(/#\/create/);
  });

  // ── Save & host after duplication ─────────────────────────────────────────

  test('"Save & host" with a duplicated question opens the lobby with a valid PIN', { tag: ['@quiz-creator', '@smoke', '@e2e', '@localstorage'] }, async ({
    page,
  }) => {
    await page.getByLabel('Quiz title').fill('Hosted dup quiz');
    await page.getByLabel('Question text').fill('Host question?');
    await page.getByPlaceholder('Option A').fill('Yes');
    await page.getByPlaceholder('Option B').fill('No');

    await page.getByRole('button', { name: 'Duplicate question' }).click();
    await expect(page.locator('.question-editor')).toHaveCount(2);

    await page.getByRole('button', { name: /Save .* host/i }).click();
    await page.waitForURL(/#\/host\//);

    const pin = (await page.locator('.big-code').first().innerText()).trim();
    expect(pin).toMatch(/^[A-Z0-9]{6}$/);

    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('kahootlite:quizzes') || '[]')
    );
    expect(stored).toHaveLength(1);
    expect(stored[0].questions).toHaveLength(2);
    expect(stored[0].title).toBe('Hosted dup quiz');
  });

  // ── Validation on duplicated blank question ────────────────────────────────

  test('save is blocked when a duplicated question has no text', { tag: ['@quiz-creator', '@validation'] }, async ({
    page,
  }) => {
    await page.getByLabel('Quiz title').fill('Validation quiz');
    await page.getByLabel('Question text').fill('Valid question?');
    await page.getByPlaceholder('Option A').fill('Yes');
    await page.getByPlaceholder('Option B').fill('No');

    await page.getByRole('button', { name: 'Duplicate question' }).click();

    await page.locator('.question-editor').nth(1).getByLabel('Question text').fill('');

    await page.getByRole('button', { name: 'Save quiz' }).click();

    await expect(page.getByText(/Question 2 needs text/i)).toBeVisible();
    await expect(page).not.toHaveURL(/#\/quizzes/);
  });

  test('save is blocked when a duplicated question has fewer than 2 options', { tag: ['@quiz-creator', '@validation'] }, async ({
    page,
  }) => {
    await page.getByLabel('Quiz title').fill('Option validation quiz');
    await page.getByLabel('Question text').fill('Original?');
    await page.getByPlaceholder('Option A').fill('Only one');

    await page.getByRole('button', { name: 'Duplicate question' }).click();

    await page.getByRole('button', { name: 'Save quiz' }).click();

    await expect(page.getByText(/needs 2 or more choices/i)).toBeVisible();
  });

  // ── localStorage: cloned question gets a unique id ─────────────────────────

  test('saved questions each have a distinct id in localStorage', { tag: ['@quiz-creator', '@localstorage'] }, async ({
    page,
  }) => {
    await page.getByLabel('Quiz title').fill('ID uniqueness quiz');
    await page.getByLabel('Question text').fill('Is this unique?');
    await page.getByPlaceholder('Option A').fill('Yes');
    await page.getByPlaceholder('Option B').fill('No');

    await page.getByRole('button', { name: 'Duplicate question' }).click();

    await page.getByRole('button', { name: 'Save quiz' }).click();
    await expect(page).toHaveURL(/#\/quizzes/);

    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('kahootlite:quizzes') || '[]')
    );
    const ids = stored[0].questions.map((q) => q.id);
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);
  });

  // ── Preview after duplication ─────────────────────────────────────────────

  test('Preview shows both questions after duplicating', { tag: ['@quiz-creator', '@quiz-preview'] }, async ({ page }) => {
    await page.getByLabel('Quiz title').fill('Preview dup quiz');
    await page.getByLabel('Question text').fill('Preview question?');
    await page.getByPlaceholder('Option A').fill('Alpha');
    await page.getByPlaceholder('Option B').fill('Beta');

    await page.getByRole('button', { name: 'Duplicate question' }).click();
    await expect(page.locator('.question-editor')).toHaveCount(2);

    await page.getByRole('button', { name: /▶ Preview/ }).click();

    await expect(page.getByText('Preview question?')).toBeVisible();
  });

  // ── Insertion position in a 3-question quiz ───────────────────────────────

  test('duplicating a middle question inserts the clone right after it in a 3-question quiz', { tag: ['@quiz-creator'] }, async ({
    page,
  }) => {
    await page.getByLabel('Question text').fill('Q1');
    await page.getByRole('button', { name: /\+ Add question/ }).click();
    await page.locator('.question-editor').nth(1).getByLabel('Question text').fill('Q2');
    await page.getByRole('button', { name: /\+ Add question/ }).click();
    await page.locator('.question-editor').nth(2).getByLabel('Question text').fill('Q3');

    await page.locator('.question-editor').nth(1).getByRole('button', { name: 'Duplicate question' }).click();

    await expect(page.locator('.question-editor')).toHaveCount(4);
    await expect(page.locator('.question-editor').nth(0).getByLabel('Question text')).toHaveValue('Q1');
    await expect(page.locator('.question-editor').nth(1).getByLabel('Question text')).toHaveValue('Q2');
    await expect(page.locator('.question-editor').nth(2).getByLabel('Question text')).toHaveValue('Q2');
    await expect(page.locator('.question-editor').nth(3).getByLabel('Question text')).toHaveValue('Q3');
  });
});

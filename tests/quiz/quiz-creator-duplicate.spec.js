import { test, expect } from '@playwright/test';
import { seedQuiz, setBypassHeader } from '../helpers.js';

// Tests for the "Duplicate question" button introduced in the quiz creator.
// Each test is fully isolated — it navigates to /#/create and builds state
// from scratch so there is no dependency on run order or localStorage from
// other specs.

test.describe('Quiz creator — duplicate question', () => {
  test.beforeEach(async ({ page }) => {
    // Bypass Vercel bot-protection so the headless browser reaches the app.
    await setBypassHeader(page);
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('kahootlite:quizzes'));
    await page.goto('/#/create');
    // Wait for full React hydration — Vercel cold starts can leave the component
    // tree unrendered even after network-idle; waiting for a landmark element
    // ensures the creator UI is interactive before any test action.
    await page.waitForLoadState('networkidle');
    await page.getByLabel('Quiz title').waitFor({ state: 'visible', timeout: 30_000 });
  });

  test('should show the Duplicate question button on the only question', { tag: ['@quiz-creator', '@ui'] }, async ({
    page,
  }) => {
    await expect(
      page.getByRole('button', { name: 'Duplicate question' })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Remove question' })
    ).toBeHidden();
  });

  test('should show Duplicate question alongside Remove question when multiple questions exist', { tag: ['@quiz-creator', '@ui'] }, async ({
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

  test('should increase the question count by one when clicking Duplicate question', { tag: ['@quiz-creator', '@ui'] }, async ({
    page,
  }) => {
    await expect(page.locator('.question-editor')).toHaveCount(1);
    await page.getByRole('button', { name: 'Duplicate question' }).click();
    await expect(page.locator('.question-editor')).toHaveCount(2);
  });

  test('should copy question text into the new question when duplicating', { tag: ['@quiz-creator'] }, async ({
    page,
  }) => {
    const questionText = 'What is the capital of France?';
    await page.getByLabel('Question text').fill(questionText);
    await page.getByRole('button', { name: 'Duplicate question' }).click();

    const editors = page.locator('.question-editor');
    await expect(editors).toHaveCount(2);
    await expect(editors.nth(1).getByLabel('Question text')).toHaveValue(questionText);
  });

  test('should copy all four answer options into the new question when duplicating', { tag: ['@quiz-creator'] }, async ({
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

  test('should preserve the correct-answer selection when duplicating', { tag: ['@quiz-creator'] }, async ({ page }) => {
    await page.getByPlaceholder('Option A').fill('Paris');
    await page.getByPlaceholder('Option B').fill('Berlin');
    await page.getByLabel('Correct answer').selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Duplicate question' }).click();

    const cloneSelect = page.locator('.question-editor').nth(1).getByLabel('Correct answer');
    await expect(cloneSelect).toHaveValue('1');
  });

  test('should preserve the time limit when duplicating', { tag: ['@quiz-creator'] }, async ({ page }) => {
    const timeLimitInput = page.locator('.question-editor').nth(0).getByLabel('Time limit (seconds)');
    await timeLimitInput.fill('45');
    await timeLimitInput.blur();

    await page.getByRole('button', { name: 'Duplicate question' }).click();

    const cloneTimeLimitInput = page.locator('.question-editor').nth(1).getByLabel('Time limit (seconds)');
    await expect(cloneTimeLimitInput).toHaveValue('45');
  });

  test('should insert the duplicated question immediately after the source', { tag: ['@quiz-creator'] }, async ({
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

  test('should append the clone at the end when duplicating the last question', { tag: ['@quiz-creator'] }, async ({
    page,
  }) => {
    await page.getByLabel('Question text').fill('Only question');
    await page.getByRole('button', { name: 'Duplicate question' }).click();

    await expect(page.locator('.question-editor')).toHaveCount(2);
    await expect(page.locator('.question-editor').nth(1).getByLabel('Question text')).toHaveValue('Only question');
  });

  test('should give the duplicated question a unique id so edits do not affect the original', { tag: ['@quiz-creator'] }, async ({
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

  test('should not affect the clone when modifying original options after duplication', { tag: ['@quiz-creator'] }, async ({
    page,
  }) => {
    await page.getByPlaceholder('Option A').fill('Shared value');
    await page.getByPlaceholder('Option B').fill('B');

    await page.getByRole('button', { name: 'Duplicate question' }).click();

    await page.locator('.question-editor').nth(0).getByPlaceholder('Option A').fill('Changed value');

    await expect(page.locator('.question-editor').nth(1).getByPlaceholder('Option A')).toHaveValue('Shared value');
  });

  test('should allow duplicating the same question multiple times, building a longer list', { tag: ['@quiz-creator'] }, async ({
    page,
  }) => {
    await page.getByLabel('Question text').fill('Repeated question');

    await page.locator('.question-editor').nth(0).getByRole('button', { name: 'Duplicate question' }).click();
    await page.locator('.question-editor').nth(0).getByRole('button', { name: 'Duplicate question' }).click();

    await expect(page.locator('.question-editor')).toHaveCount(3);
  });

  test('should save successfully a quiz with a duplicated question', { tag: ['@quiz-creator', '@smoke', '@localstorage'] }, async ({
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

  test('should remove a duplicated question independently', { tag: ['@quiz-creator'] }, async ({ page }) => {
    await page.getByLabel('Question text').fill('Keep me');
    await page.getByRole('button', { name: 'Duplicate question' }).click();

    await expect(page.locator('.question-editor')).toHaveCount(2);

    await page.locator('.question-editor').nth(1).getByRole('button', { name: 'Remove question' }).click();

    await expect(page.locator('.question-editor')).toHaveCount(1);
    await expect(page.locator('.question-editor').nth(0).getByLabel('Question text')).toHaveValue('Keep me');
  });

  test('should work the duplicate button when editing an existing saved quiz', { tag: ['@quiz-creator', '@localstorage'] }, async ({
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

  test('should insert the clone between its neighbours when duplicating a middle question', { tag: ['@quiz-creator'] }, async ({
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

  test('should block save when a cloned question has its text cleared', { tag: ['@quiz-creator', '@validation'] }, async ({
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

  test('should open the lobby with a valid PIN when using Save & host with a duplicated question', { tag: ['@quiz-creator', '@smoke', '@e2e', '@localstorage'] }, async ({
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

  test('should block save when a duplicated question has no text', { tag: ['@quiz-creator', '@validation'] }, async ({
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

  test('should block save when a duplicated question has fewer than 2 options', { tag: ['@quiz-creator', '@validation'] }, async ({
    page,
  }) => {
    await page.getByLabel('Quiz title').fill('Option validation quiz');
    await page.getByLabel('Question text').fill('Original?');
    await page.getByPlaceholder('Option A').fill('Only one');

    await page.getByRole('button', { name: 'Duplicate question' }).click();

    await page.getByRole('button', { name: 'Save quiz' }).click();

    await expect(page.getByText(/needs 2 or more choices/i)).toBeVisible();
  });

  test('should give saved questions distinct ids in localStorage', { tag: ['@quiz-creator', '@localstorage'] }, async ({
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

  test('should show both questions in Preview after duplicating', { tag: ['@quiz-creator', '@quiz-preview'] }, async ({ page }) => {
    await page.getByLabel('Quiz title').fill('Preview dup quiz');
    await page.getByLabel('Question text').fill('Preview question?');
    await page.getByPlaceholder('Option A').fill('Alpha');
    await page.getByPlaceholder('Option B').fill('Beta');

    await page.getByRole('button', { name: 'Duplicate question' }).click();
    await expect(page.locator('.question-editor')).toHaveCount(2);

    await page.getByRole('button', { name: /▶ Preview/ }).click();

    await expect(page.getByText('Preview question?')).toBeVisible();
  });

  test('should insert the clone right after the middle question in a 3-question quiz', { tag: ['@quiz-creator'] }, async ({
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

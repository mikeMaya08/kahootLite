import { test, expect } from '@playwright/test';

async function openPreview(page, { title = 'Preview Test Quiz', questions = 1 } = {}) {
  await page.goto('/#/create');

  await page.getByLabel('Quiz title').fill(title);

  await page.getByLabel('Question text').first().fill('What is 1 + 1?');
  await page.getByPlaceholder('Option A').first().fill('2');
  await page.getByPlaceholder('Option B').first().fill('3');

  for (let i = 1; i < questions; i++) {
    await page.getByRole('button', { name: /\+ Add question/ }).click();
    await page.getByLabel('Question text').nth(i).fill(`Question ${i + 1}`);
    await page.getByPlaceholder('Option A').nth(i).fill('Yes');
    await page.getByPlaceholder('Option B').nth(i).fill('No');
  }

  await page.getByRole('button', { name: '▶ Preview' }).click();
  await expect(page.locator('.modal-overlay')).toBeVisible();
}

test.describe('Quiz preview modal', () => {
  test('▶ Preview button is visible in the quiz creator', { tag: ['@quiz-preview', '@ui'] }, async ({ page }) => {
    await page.goto('/#/create');
    await expect(
      page.getByRole('button', { name: '▶ Preview' })
    ).toBeVisible();
  });

  test('opens the preview modal and shows Q 1 / N indicator', { tag: ['@quiz-preview', '@smoke', '@ui'] }, async ({ page }) => {
    await openPreview(page);
    await expect(page.locator('.preview-card')).toBeVisible();
    await expect(page.locator('.preview-card .muted')).toHaveText('Q 1 / 1');
    await expect(page.locator('.question-text')).toHaveText('What is 1 + 1?');
  });

  test('✕ Close preview button dismisses the modal', { tag: ['@quiz-preview', '@ui'] }, async ({ page }) => {
    await openPreview(page);
    await page.getByRole('button', { name: '✕ Close preview' }).click();
    await expect(page.locator('.modal-overlay')).not.toBeVisible();
    await expect(page.getByRole('heading', { name: 'New quiz' })).toBeVisible();
  });

  test('selecting the correct answer highlights it as correct', { tag: ['@quiz-preview', '@ui'] }, async ({ page }) => {
    await openPreview(page);
    await page.locator('.answers-grid button').nth(0).click();
    const correctOption = page.locator('.answers-grid button').nth(0);
    await expect(correctOption).toHaveClass(/answer-correct/);
  });

  test('selecting a wrong answer highlights it as wrong and reveals the correct one', { tag: ['@quiz-preview', '@ui'] }, async ({ page }) => {
    await openPreview(page);
    await page.locator('.answers-grid button').nth(1).click();
    const wrongOption = page.locator('.answers-grid button').nth(1);
    await expect(wrongOption).toHaveClass(/answer-wrong/);
    const correctOption = page.locator('.answers-grid button').nth(0);
    await expect(correctOption).toHaveClass(/answer-correct/);
  });

  test('cannot re-select an answer after answering (answered guard)', { tag: ['@quiz-preview', '@validation'] }, async ({ page }) => {
    await openPreview(page);
    await page.locator('.answers-grid button').nth(1).click();
    await expect(
      page.getByRole('button', { name: /Next question|See results/ })
    ).toBeVisible();
    await page.locator('.answers-grid button').nth(0).click({ force: true });
    const optionB = page.locator('.answers-grid button').nth(1);
    await expect(optionB).toHaveClass(/answer-wrong/);
  });

  test('single-question quiz shows "See results →" after answering', { tag: ['@quiz-preview', '@ui'] }, async ({ page }) => {
    await openPreview(page);
    await page.locator('.answers-grid button').nth(0).click();
    await expect(
      page.getByRole('button', { name: 'See results →' })
    ).toBeVisible();
  });

  test('multi-question quiz shows "Next question →" on all but the last question', { tag: ['@quiz-preview', '@ui'] }, async ({ page }) => {
    await openPreview(page, { questions: 2 });
    await page.locator('.answers-grid button').nth(0).click();
    await expect(
      page.getByRole('button', { name: 'Next question →' })
    ).toBeVisible();
  });

  test('advancing through questions updates the Q N / total indicator', { tag: ['@quiz-preview', '@ui'] }, async ({ page }) => {
    await openPreview(page, { questions: 2 });
    await expect(page.locator('.preview-card .muted')).toHaveText('Q 1 / 2');
    await page.locator('.answers-grid button').nth(0).click();
    await page.getByRole('button', { name: 'Next question →' }).click();
    await expect(page.locator('.preview-card .muted')).toHaveText('Q 2 / 2');
  });

  test('last question of multi-question quiz shows "See results →"', { tag: ['@quiz-preview', '@ui'] }, async ({ page }) => {
    await openPreview(page, { questions: 2 });
    await page.locator('.answers-grid button').nth(0).click();
    await page.getByRole('button', { name: 'Next question →' }).click();
    await page.locator('.answers-grid button').nth(0).click();
    await expect(
      page.getByRole('button', { name: 'See results →' })
    ).toBeVisible();
  });

  test('final results screen shows correct count and "Preview results" heading', { tag: ['@quiz-preview', '@smoke'] }, async ({ page }) => {
    await openPreview(page, { questions: 2 });
    await page.locator('.answers-grid button').nth(0).click();
    await page.getByRole('button', { name: 'Next question →' }).click();
    await page.locator('.answers-grid button').nth(1).click();
    await page.getByRole('button', { name: 'See results →' }).click();
    await expect(page.getByRole('heading', { name: 'Preview results' })).toBeVisible();
    await expect(page.getByText('You got 1 / 2 correct')).toBeVisible();
  });

  test('"Done" button on results screen closes the modal', { tag: ['@quiz-preview', '@ui'] }, async ({ page }) => {
    await openPreview(page);
    await page.locator('.answers-grid button').nth(0).click();
    await page.getByRole('button', { name: 'See results →' }).click();
    await expect(page.getByRole('heading', { name: 'Preview results' })).toBeVisible();
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.locator('.modal-overlay')).not.toBeVisible();
  });

  test('preview reflects unsaved edits — reads live quiz state', { tag: ['@quiz-preview', '@ui'] }, async ({ page }) => {
    await page.goto('/#/create');
    await page.getByLabel('Quiz title').fill('Live Edit Title');
    await page.getByLabel('Question text').first().fill('Unsaved question?');
    await page.getByPlaceholder('Option A').first().fill('Draft A');
    await page.getByPlaceholder('Option B').first().fill('Draft B');
    await page.getByRole('button', { name: '▶ Preview' }).click();
    await expect(page.locator('.modal-overlay')).toBeVisible();
    await expect(page.locator('.question-text')).toHaveText('Unsaved question?');
    await page.getByRole('button', { name: '✕ Close preview' }).click();
    await expect(page.locator('.modal-overlay')).not.toBeVisible();
  });

  test('question with no text renders "Untitled question" fallback', { tag: ['@quiz-preview', '@ui'] }, async ({ page }) => {
    await page.goto('/#/create');
    await page.getByLabel('Quiz title').fill('Fallback Test');
    await page.getByPlaceholder('Option A').first().fill('Yes');
    await page.getByPlaceholder('Option B').first().fill('No');
    await page.getByRole('button', { name: '▶ Preview' }).click();
    await expect(page.locator('.modal-overlay')).toBeVisible();
    await expect(page.locator('.question-text')).toHaveText('Untitled question');
  });

  test('preview state resets to Q1 when closed and reopened', { tag: ['@quiz-preview', '@ui'] }, async ({ page }) => {
    await openPreview(page, { questions: 2 });
    await page.locator('.answers-grid .answer-option').nth(0).click();
    await page.getByRole('button', { name: 'Next question →' }).click();
    await expect(page.locator('.preview-card .muted')).toHaveText('Q 2 / 2');
    await page.getByRole('button', { name: '✕ Close preview' }).click();
    await expect(page.locator('.modal-overlay')).not.toBeVisible();
    await page.getByRole('button', { name: '▶ Preview' }).click();
    await expect(page.locator('.modal-overlay')).toBeVisible();
    await expect(page.locator('.preview-card .muted')).toHaveText('Q 1 / 2');
  });

  test('preview works on edit route with pre-seeded quiz data', { tag: ['@quiz-preview', '@smoke', '@localstorage'] }, async ({ page }) => {
    const quiz = {
      id: 'quiz-preview-seed',
      title: 'Seeded Quiz',
      questions: [
        { id: 'q-1', text: 'Capital of France?', options: ['Paris', 'Berlin', 'Madrid', 'Rome'], correctIndex: 0, timeLimit: 30 },
        { id: 'q-2', text: 'Capital of Germany?', options: ['Paris', 'Berlin', 'Madrid', 'Rome'], correctIndex: 1, timeLimit: 30 },
      ],
      createdAt: 0,
      updatedAt: 0,
    };
    await page.goto('/');
    await page.evaluate((q) => {
      localStorage.setItem('kahootlite:quizzes', JSON.stringify([q]));
    }, quiz);
    await page.goto('/#/edit/quiz-preview-seed');
    await page.getByRole('button', { name: '▶ Preview' }).click();
    await expect(page.locator('.modal-overlay')).toBeVisible();
    await expect(page.locator('.preview-card .muted')).toHaveText('Q 1 / 2');
    await expect(page.locator('.question-text')).toHaveText('Capital of France?');
    await page.locator('.answers-grid button').nth(0).click();
    await page.getByRole('button', { name: 'Next question →' }).click();
    await expect(page.locator('.preview-card .muted')).toHaveText('Q 2 / 2');
    await page.locator('.answers-grid button').nth(1).click();
    await page.getByRole('button', { name: 'See results →' }).click();
    await expect(page.getByText('You got 2 / 2 correct')).toBeVisible();
  });

  test('empty question text renders "Untitled question" fallback', { tag: ['@quiz-preview', '@ui'] }, async ({ page }) => {
    await page.goto('/#/create');
    await page.getByLabel('Quiz title').fill('Fallback Test');
    await page.getByPlaceholder('Option A').first().fill('Alpha');
    await page.getByPlaceholder('Option B').first().fill('Beta');
    await page.getByRole('button', { name: '▶ Preview' }).click();
    await expect(page.locator('.modal-overlay')).toBeVisible();
    await expect(page.locator('.question-text')).toHaveText('Untitled question');
  });

  test('all-correct answers produce a perfect score on the results screen', { tag: ['@quiz-preview', '@validation'] }, async ({ page }) => {
    await openPreview(page, { questions: 2 });
    await page.locator('.answers-grid button').nth(0).click();
    await page.getByRole('button', { name: 'Next question →' }).click();
    await page.locator('.answers-grid button').nth(0).click();
    await page.getByRole('button', { name: 'See results →' }).click();
    await expect(page.getByText('You got 2 / 2 correct')).toBeVisible();
  });

  test('all-wrong answers produce a zero score on the results screen', { tag: ['@quiz-preview', '@validation'] }, async ({ page }) => {
    await openPreview(page, { questions: 2 });
    await page.locator('.answers-grid button').nth(1).click();
    await page.getByRole('button', { name: 'Next question →' }).click();
    await page.locator('.answers-grid button').nth(1).click();
    await page.getByRole('button', { name: 'See results →' }).click();
    await expect(page.getByText('You got 0 / 2 correct')).toBeVisible();
  });

  test('answer options render the correct option text in the preview', { tag: ['@quiz-preview', '@ui', '@localstorage'] }, async ({ page }) => {
    const quiz = {
      id: 'quiz-text-render',
      title: 'Text Render Quiz',
      questions: [
        { id: 'q-1', text: 'Favourite colour?', options: ['Red', 'Green', 'Blue', 'Yellow'], correctIndex: 2, timeLimit: 20 },
      ],
      createdAt: 0,
      updatedAt: 0,
    };
    await page.goto('/');
    await page.evaluate((q) => {
      localStorage.setItem('kahootlite:quizzes', JSON.stringify([q]));
    }, quiz);
    await page.goto('/#/edit/quiz-text-render');
    await page.getByRole('button', { name: '▶ Preview' }).click();
    await expect(page.locator('.modal-overlay')).toBeVisible();
    await expect(page.getByText('Red')).toBeVisible();
    await expect(page.getByText('Green')).toBeVisible();
    await expect(page.getByText('Blue')).toBeVisible();
    await expect(page.getByText('Yellow')).toBeVisible();
    await page.locator('.answers-grid button').nth(2).click();
    await expect(page.locator('.answers-grid button').nth(2)).toHaveClass(/answer-correct/);
  });
});

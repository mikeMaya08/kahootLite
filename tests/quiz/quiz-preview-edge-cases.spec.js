import { test, expect } from '@playwright/test';

async function openPreviewOnEditRoute(page, quiz) {
  await page.goto('/');
  await page.evaluate((q) => {
    localStorage.setItem('kahootlite:quizzes', JSON.stringify([q]));
  }, quiz);
  await page.goto(`/#/edit/${quiz.id}`);
  await page.getByRole('button', { name: '▶ Preview' }).click();
  await expect(page.locator('.modal-overlay')).toBeVisible();
}

test.describe('Quiz preview — edge cases', () => {
  test('✕ Close preview dismisses the modal even after an answer is selected', { tag: ['@quiz-preview', '@ui'] }, async ({ page }) => {
    const quiz = {
      id: 'quiz-close-mid-answered',
      title: 'Close After Answer Quiz',
      questions: [
        { id: 'q-1', text: 'Can you close after answering?', options: ['Yes', 'No', '', ''], correctIndex: 0, timeLimit: 20 },
        { id: 'q-2', text: 'Second question', options: ['Alpha', 'Beta', '', ''], correctIndex: 1, timeLimit: 20 },
      ],
      createdAt: 0,
      updatedAt: 0,
    };
    await openPreviewOnEditRoute(page, quiz);
    await page.locator('.answers-grid button').nth(0).click();
    await expect(page.getByRole('button', { name: 'Next question →' })).toBeVisible();
    await page.getByRole('button', { name: '✕ Close preview' }).click();
    await expect(page.locator('.modal-overlay')).not.toBeVisible();
    await expect(page.getByRole('heading', { name: 'Edit quiz' })).toBeVisible();
  });

  test('shows "Untitled question" fallback when question text is empty', { tag: ['@quiz-preview', '@ui'] }, async ({ page }) => {
    const quiz = {
      id: 'quiz-untitled-q',
      title: 'Empty Question Quiz',
      questions: [
        { id: 'q-1', text: '', options: ['Yes', 'No', '', ''], correctIndex: 0, timeLimit: 20 },
      ],
      createdAt: 0,
      updatedAt: 0,
    };
    await openPreviewOnEditRoute(page, quiz);
    await expect(page.locator('.question-text')).toHaveText('Untitled question');
  });

  test('answering all questions wrong scores 0 / N correct on the results screen', { tag: ['@quiz-preview', '@validation'] }, async ({ page }) => {
    const quiz = {
      id: 'quiz-all-wrong',
      title: 'All Wrong Quiz',
      questions: [
        { id: 'q-1', text: 'Capital of France?', options: ['Paris', 'Berlin', '', ''], correctIndex: 0, timeLimit: 20 },
        { id: 'q-2', text: 'Capital of Germany?', options: ['Paris', 'Berlin', '', ''], correctIndex: 1, timeLimit: 20 },
      ],
      createdAt: 0,
      updatedAt: 0,
    };
    await openPreviewOnEditRoute(page, quiz);
    await page.locator('.answers-grid .answer-option').nth(1).click();
    await page.getByRole('button', { name: 'Next question →' }).click();
    await page.locator('.answers-grid .answer-option').nth(0).click();
    await page.getByRole('button', { name: 'See results →' }).click();
    await expect(page.getByRole('heading', { name: 'Preview results' })).toBeVisible();
    await expect(page.getByText('You got 0 / 2 correct')).toBeVisible();
  });

  test('▶ Preview button is visible on the quiz edit route (/#/edit/:id)', { tag: ['@quiz-preview', '@ui'] }, async ({ page }) => {
    const quiz = {
      id: 'quiz-edit-preview-btn',
      title: 'Edit Route Quiz',
      questions: [
        { id: 'q-1', text: 'Is the button visible?', options: ['Yes', 'No', '', ''], correctIndex: 0, timeLimit: 20 },
      ],
      createdAt: 0,
      updatedAt: 0,
    };
    await page.goto('/');
    await page.evaluate((q) => {
      localStorage.setItem('kahootlite:quizzes', JSON.stringify([q]));
    }, quiz);
    await page.goto(`/#/edit/${quiz.id}`);
    await expect(page.getByRole('heading', { name: 'Edit quiz' })).toBeVisible();
    await expect(page.getByRole('button', { name: '▶ Preview' })).toBeVisible();
  });
});

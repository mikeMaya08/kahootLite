import { test, expect } from '@playwright/test';

/**
 * Edge-case tests for the QuizPreview modal that complement the main
 * quiz-preview.spec.js suite. These cover branches in QuizPreview.jsx
 * not exercised by the primary spec:
 *
 *  1. "Untitled question" fallback when a question has no text
 *  2. All-wrong answers produce a score of 0 / N correct
 *  3. The ▶ Preview button is visible on the edit route (/#/edit/:id)
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Seeds a quiz into localStorage and navigates to its edit page,
 * then opens the preview modal.
 */
async function openPreviewOnEditRoute(page, quiz) {
  await page.goto('/');
  await page.evaluate((q) => {
    localStorage.setItem('kahootlite:quizzes', JSON.stringify([q]));
  }, quiz);
  await page.goto(`/#/edit/${quiz.id}`);
  await page.getByRole('button', { name: '▶ Preview' }).click();
  await expect(page.locator('.modal-overlay')).toBeVisible();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Quiz preview — edge cases', () => {
  test('shows "Untitled question" fallback when question text is empty', async ({ page }) => {
    // Seed a quiz with a question that has no text (empty string),
    // which hits the `current.text || 'Untitled question'` branch in QuizPreview.jsx.
    const quiz = {
      id: 'quiz-untitled-q',
      title: 'Empty Question Quiz',
      questions: [
        {
          id: 'q-1',
          text: '',           // intentionally blank → fallback text expected
          options: ['Yes', 'No', '', ''],
          correctIndex: 0,
          timeLimit: 20,
        },
      ],
      createdAt: 0,
      updatedAt: 0,
    };

    await openPreviewOnEditRoute(page, quiz);

    // QuizPreview.jsx: <h2 className="question-text">{current.text || 'Untitled question'}</h2>
    await expect(page.locator('.question-text')).toHaveText('Untitled question');
  });

  test('answering all questions wrong scores 0 / N correct on the results screen', async ({ page }) => {
    // Seed a 2-question quiz where correctIndex is 0 ('Paris', 'Berlin').
    // We will pick index 1 for every question (wrong answer) and expect 0/2.
    const quiz = {
      id: 'quiz-all-wrong',
      title: 'All Wrong Quiz',
      questions: [
        {
          id: 'q-1',
          text: 'Capital of France?',
          options: ['Paris', 'Berlin', '', ''],
          correctIndex: 0,
          timeLimit: 20,
        },
        {
          id: 'q-2',
          text: 'Capital of Germany?',
          options: ['Paris', 'Berlin', '', ''],
          correctIndex: 1,
          timeLimit: 20,
        },
      ],
      createdAt: 0,
      updatedAt: 0,
    };

    await openPreviewOnEditRoute(page, quiz);

    // Answer Q1 wrong (index 1 = 'Berlin', correct is index 0 = 'Paris')
    await page.locator('.answers-grid .answer-option').nth(1).click();
    await page.getByRole('button', { name: 'Next question →' }).click();

    // Answer Q2 wrong (index 0 = 'Paris', correct is index 1 = 'Berlin')
    await page.locator('.answers-grid .answer-option').nth(0).click();
    await page.getByRole('button', { name: 'See results →' }).click();

    // Results: 0 correct out of 2
    await expect(page.getByRole('heading', { name: 'Preview results' })).toBeVisible();
    await expect(page.getByText('You got 0 / 2 correct')).toBeVisible();
  });

  test('▶ Preview button is visible on the quiz edit route (/#/edit/:id)', async ({ page }) => {
    // The main spec verifies the button on /#/create; this confirms it also
    // appears when editing an existing quiz (editingId branch in QuizCreator.jsx).
    const quiz = {
      id: 'quiz-edit-preview-btn',
      title: 'Edit Route Quiz',
      questions: [
        {
          id: 'q-1',
          text: 'Is the button visible?',
          options: ['Yes', 'No', '', ''],
          correctIndex: 0,
          timeLimit: 20,
        },
      ],
      createdAt: 0,
      updatedAt: 0,
    };

    await page.goto('/');
    await page.evaluate((q) => {
      localStorage.setItem('kahootlite:quizzes', JSON.stringify([q]));
    }, quiz);

    await page.goto(`/#/edit/${quiz.id}`);

    // The heading should say "Edit quiz" (not "New quiz") to confirm we're
    // on the edit route, then the Preview button must be present.
    await expect(page.getByRole('heading', { name: 'Edit quiz' })).toBeVisible();
    await expect(page.getByRole('button', { name: '▶ Preview' })).toBeVisible();
  });
});

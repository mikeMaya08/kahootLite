import { test, expect } from '@playwright/test';
import { SAMPLE_QUIZ, seedQuiz } from './helpers.js';

test.describe('Quiz library — additional edge cases', () => {
  // ── Navigation CTAs ────────────────────────────────────────────────────────

  test('"+ New quiz" button in the library header navigates to the creator', async ({
    page,
  }) => {
    await page.goto('/#/quizzes');

    await page.getByRole('button', { name: /\+ New quiz/ }).click();

    await expect(page).toHaveURL(/#\/create/);
  });

  test('"Build your first quiz" CTA on the empty state navigates to the creator', async ({
    page,
  }) => {
    // Ensure no quizzes exist.
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('kahootlite:quizzes'));
    await page.goto('/#/quizzes');

    await page.getByRole('button', { name: /Build your first quiz/i }).click();

    await expect(page).toHaveURL(/#\/create/);
  });

  test('"← Home" button navigates back to home', async ({ page }) => {
    await page.goto('/#/quizzes');
    await page.getByRole('button', { name: /← Home/i }).click();
    await expect(page).toHaveURL(/\/?#?\/?$/);
  });

  // ── Multiple quizzes displayed ─────────────────────────────────────────────

  test('shows all saved quizzes when multiple are stored', async ({ page }) => {
    const quiz1 = { ...SAMPLE_QUIZ, id: 'quiz-a', title: 'Alpha Quiz' };
    const quiz2 = { ...SAMPLE_QUIZ, id: 'quiz-b', title: 'Beta Quiz' };

    await page.goto('/');
    await page.evaluate(([a, b]) => {
      localStorage.setItem('kahootlite:quizzes', JSON.stringify([a, b]));
    }, [quiz1, quiz2]);

    await page.goto('/#/quizzes');

    await expect(page.getByRole('heading', { name: 'Alpha Quiz' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Beta Quiz' })).toBeVisible();
  });

  // ── Question count display ─────────────────────────────────────────────────

  test('shows "1 question" (singular) for a single-question quiz', async ({
    page,
  }) => {
    // SAMPLE_QUIZ has exactly 1 question.
    await seedQuiz(page);
    await page.goto('/#/quizzes');

    await expect(page.getByText(/1 question/i)).toBeVisible();
    // Should NOT say "questions" (plural).
    await expect(page.getByText(/1 questions/i)).not.toBeVisible();
  });

  test('shows "N questions" (plural) for a multi-question quiz', async ({
    page,
  }) => {
    const multiQQuiz = {
      ...SAMPLE_QUIZ,
      id: 'quiz-multi',
      title: 'Multi-Q',
      questions: [
        ...SAMPLE_QUIZ.questions,
        {
          id: 'q-2',
          text: 'Capital of Germany?',
          options: ['Vienna', 'Berlin', 'Prague', 'Warsaw'],
          correctIndex: 1,
          timeLimit: 30,
        },
      ],
    };

    await page.goto('/');
    await page.evaluate((q) => {
      localStorage.setItem('kahootlite:quizzes', JSON.stringify([q]));
    }, multiQQuiz);

    await page.goto('/#/quizzes');

    await expect(page.getByText(/2 questions/i)).toBeVisible();
  });

  // ── Delete confirmation ────────────────────────────────────────────────────

  test('dismissing the delete confirmation keeps the quiz in the list', async ({
    page,
  }) => {
    await seedQuiz(page);
    await page.goto('/#/quizzes');

    // Cancel the confirm dialog.
    page.on('dialog', (d) => d.dismiss());
    await page.getByRole('button', { name: 'Delete' }).click();

    // Quiz should still be there.
    await expect(
      page.getByRole('heading', { name: SAMPLE_QUIZ.title })
    ).toBeVisible();
  });
});

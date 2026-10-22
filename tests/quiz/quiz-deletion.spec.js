import { test, expect } from '@playwright/test';
import { SAMPLE_QUIZ, seedQuiz, setBypassHeader } from '../helpers';

test.describe('Quiz library — deletion', () => {
  // ── Delete one of several quizzes ─────────────────────────────────────────

  test('deleting one quiz from a multi-quiz list removes only that quiz', { tag: ['@quiz-library', '@localstorage'] }, async ({ page }) => {
    const quizA = { ...SAMPLE_QUIZ, id: 'quiz-a', title: 'Alpha Quiz' };
    const quizB = { ...SAMPLE_QUIZ, id: 'quiz-b', title: 'Beta Quiz' };

    await setBypassHeader(page);
    await page.goto('/');
    await page.evaluate(([a, b]) => {
      localStorage.setItem('kahootlite:quizzes', JSON.stringify([a, b]));
    }, [quizA, quizB]);

    await page.goto('/#/quizzes');
    await page.waitForLoadState('networkidle');

    // Wait for both cards to render, then delete the first one (Alpha Quiz).
    await page.getByRole('heading', { name: 'Alpha Quiz' }).waitFor({ state: 'visible', timeout: 15_000 });

    // Scope the Delete button to Alpha Quiz's card to avoid ambiguity.
    const alphaCard = page.locator('li, [class*="quiz-card"], article').filter({ hasText: 'Alpha Quiz' }).first();
    page.on('dialog', (d) => d.accept());
    await alphaCard.getByRole('button', { name: 'Delete' }).click();

    // Alpha Quiz is gone; Beta Quiz is still there.
    await expect(page.getByRole('heading', { name: 'Alpha Quiz' })).not.toBeVisible();
    await expect(page.getByRole('heading', { name: 'Beta Quiz' })).toBeVisible();
  });

  // ── Delete all quizzes one by one → empty state ───────────────────────────

  test('deleting all quizzes one by one shows the empty state', { tag: ['@quiz-library', '@localstorage'] }, async ({ page }) => {
    const quizA = { ...SAMPLE_QUIZ, id: 'quiz-c', title: 'First Quiz' };
    const quizB = { ...SAMPLE_QUIZ, id: 'quiz-d', title: 'Second Quiz' };

    await setBypassHeader(page);
    await page.goto('/');
    await page.evaluate(([a, b]) => {
      localStorage.setItem('kahootlite:quizzes', JSON.stringify([a, b]));
    }, [quizA, quizB]);

    await page.goto('/#/quizzes');
    await page.waitForLoadState('networkidle');
    await page.getByRole('heading', { name: 'First Quiz' }).waitFor({ state: 'visible', timeout: 15_000 });

    page.on('dialog', (d) => d.accept());

    // Delete first quiz.
    await page.getByRole('button', { name: 'Delete' }).first().click();
    // One card remains — wait for it to settle before the second delete.
    await expect(page.getByRole('button', { name: 'Delete' })).toHaveCount(1);

    // Delete the remaining quiz.
    await page.getByRole('button', { name: 'Delete' }).click();

    // Library should now show the empty state.
    await expect(page.getByText(/No quizzes yet/i)).toBeVisible();
  });

  // ── localStorage is updated after deletion ────────────────────────────────

  test('localStorage no longer contains the quiz after deletion', { tag: ['@quiz-library', '@localstorage'] }, async ({ page }) => {
    await seedQuiz(page);
    await page.goto('/#/quizzes');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Delete' }).waitFor({ state: 'visible', timeout: 15_000 });

    page.on('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Delete' }).click();

    // Confirm localStorage reflects the removal.
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('kahootlite:quizzes') || '[]')
    );
    expect(stored).toHaveLength(0);
  });

  // ── Delete a multi-question quiz ──────────────────────────────────────────

  test('deleting a multi-question quiz removes it entirely from the library', { tag: ['@quiz-library', '@localstorage'] }, async ({ page }) => {
    const multiQQuiz = {
      ...SAMPLE_QUIZ,
      id: 'quiz-multiq',
      title: 'Big Quiz',
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

    await setBypassHeader(page);
    await page.goto('/');
    await page.evaluate((q) => {
      localStorage.setItem('kahootlite:quizzes', JSON.stringify([q]));
    }, multiQQuiz);

    await page.goto('/#/quizzes');
    await page.waitForLoadState('networkidle');
    await page.getByRole('heading', { name: 'Big Quiz' }).waitFor({ state: 'visible', timeout: 15_000 });

    page.on('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Delete' }).click();

    await expect(page.getByText(/No quizzes yet/i)).toBeVisible();

    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('kahootlite:quizzes') || '[]')
    );
    expect(stored).toHaveLength(0);
  });
});

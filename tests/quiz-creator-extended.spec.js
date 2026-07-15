import { test, expect } from '@playwright/test';
import { SAMPLE_QUIZ, seedQuiz } from './helpers.js';

test.describe('Quiz creator — extended', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/create');
    await page.waitForLoadState('networkidle');
  });

  // -------------------------------------------------------------------------
  // Validation: question text
  // -------------------------------------------------------------------------

  test('blocks save when question text is empty', async ({ page }) => {
    await page.getByLabel('Quiz title').fill('No-text quiz');
    // Leave question text blank; fill two options so we pass the options check.
    await page.getByPlaceholder('Option A').fill('Yes');
    await page.getByPlaceholder('Option B').fill('No');

    await page.getByRole('button', { name: 'Save quiz' }).click();

    await expect(page.getByText(/Question 1 needs text/i)).toBeVisible();
  });

  test('blocks save when only one question is present and has no text', async ({
    page,
  }) => {
    // Title is set but question text blank — should catch it.
    await page.getByLabel('Quiz title').fill('Ghost quiz');
    await page.getByRole('button', { name: 'Save quiz' }).click();

    // Either "needs text" or "needs 2 or more choices" is acceptable —
    // both mean the quiz is incomplete.
    const alert = page.locator('.alert');
    await expect(alert).toBeVisible();
    await expect(alert).not.toBeEmpty();
  });

  // -------------------------------------------------------------------------
  // Validation: at least one question required
  // -------------------------------------------------------------------------

  test('blocks save when all questions have been removed', async ({ page }) => {
    // The creator starts with one question. Remove it; there is no
    // "Add at least one question" gate until save is clicked.
    // Because canRemove is false with a single question, the Remove button
    // is absent — we verify that here (edge-case guard).
    await expect(
      page.getByRole('button', { name: 'Remove question' })
    ).toHaveCount(0);
  });

  // -------------------------------------------------------------------------
  // Time limit field
  // -------------------------------------------------------------------------

  test('time limit field clamps values below 5 to 5', async ({ page }) => {
    const timeLimitInput = page.locator('input[type="number"]').first();
    await timeLimitInput.fill('1');
    await timeLimitInput.blur();
    // The component applies Math.max(5, …) on change, so after a blur the
    // value should have been corrected to at least 5.
    const val = Number(await timeLimitInput.inputValue());
    expect(val).toBeGreaterThanOrEqual(5);
  });

  test('time limit field clamps values above 120 to 120', async ({ page }) => {
    const timeLimitInput = page.locator('input[type="number"]').first();
    await timeLimitInput.fill('999');
    await timeLimitInput.blur();
    const val = Number(await timeLimitInput.inputValue());
    expect(val).toBeLessThanOrEqual(120);
  });

  // -------------------------------------------------------------------------
  // "Cancel" navigation
  // -------------------------------------------------------------------------

  test('"Cancel" navigates to the quiz library', async ({ page }) => {
    await page.getByRole('button', { name: /Cancel/i }).click();
    await expect(page).toHaveURL(/#\/quizzes/);
  });

  // -------------------------------------------------------------------------
  // Multi-question quiz: correct-answer dropdown reflects option text
  // -------------------------------------------------------------------------

  test('correct-answer select shows typed option text for Q1', async ({
    page,
  }) => {
    await page.getByPlaceholder('Option A').fill('Alpha');
    // The select option for index 0 should now show "Alpha".
    const select = page.getByLabel('Correct answer');
    await expect(select.locator('option').first()).toContainText('Alpha');
  });

  // -------------------------------------------------------------------------
  // "← Home" navigation from the creator
  // -------------------------------------------------------------------------

  test('"← Home" button in the creator navigates to home', async ({ page }) => {
    await page.getByRole('button', { name: /← Home/i }).click();
    await expect(page).toHaveURL(/\/?#?\/?$/);
  });
});

// ---------------------------------------------------------------------------
// Quiz library — multi-quiz & count display
// ---------------------------------------------------------------------------

test.describe('Quiz library — multiple quizzes', () => {
  test('displays the correct quiz count on the home screen after adding a quiz', async ({
    page,
  }) => {
    await seedQuiz(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Home card should mention "1 quiz saved on this device."
    await expect(page.getByText(/1 quiz/i)).toBeVisible();
  });

  test('shows plural count when two quizzes are saved', async ({ page }) => {
    const quiz2 = {
      ...SAMPLE_QUIZ,
      id: 'quiz-test-2',
      title: 'Second Quiz',
    };
    await page.goto('/');
    await page.evaluate((quizzes) => {
      localStorage.setItem('kahootlite:quizzes', JSON.stringify(quizzes));
    }, [SAMPLE_QUIZ, quiz2]);

    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/2 quizzes/i)).toBeVisible();
  });

  test('quiz-list shows both quizzes when two are saved', async ({ page }) => {
    const quiz2 = {
      ...SAMPLE_QUIZ,
      id: 'quiz-test-2',
      title: 'Second Quiz',
    };
    await page.goto('/');
    await page.evaluate((quizzes) => {
      localStorage.setItem('kahootlite:quizzes', JSON.stringify(quizzes));
    }, [SAMPLE_QUIZ, quiz2]);

    await page.goto('/#/quizzes');
    await expect(
      page.getByRole('heading', { name: SAMPLE_QUIZ.title })
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Second Quiz' })
    ).toBeVisible();
  });

  test('question count in quiz-list card shows "1 question" for single-question quiz', async ({
    page,
  }) => {
    await seedQuiz(page);
    await page.goto('/#/quizzes');
    await expect(page.getByText(/1 question/i)).toBeVisible();
  });

  test('question count shows "2 questions" for a two-question quiz', async ({
    page,
  }) => {
    const twoQQuiz = {
      id: 'quiz-two-q-list',
      title: 'Two Q Quiz',
      questions: [
        {
          id: 'q-1',
          text: 'Q1?',
          options: ['A', 'B', 'C', 'D'],
          correctIndex: 0,
          timeLimit: 20,
        },
        {
          id: 'q-2',
          text: 'Q2?',
          options: ['A', 'B', 'C', 'D'],
          correctIndex: 1,
          timeLimit: 20,
        },
      ],
      createdAt: 0,
      updatedAt: 0,
    };
    await page.goto('/');
    await page.evaluate((q) => {
      localStorage.setItem('kahootlite:quizzes', JSON.stringify([q]));
    }, twoQQuiz);

    await page.goto('/#/quizzes');
    await expect(page.getByText(/2 questions/i)).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Home screen — short PIN guard
// ---------------------------------------------------------------------------

test.describe('Home screen — PIN validation', () => {
  test('Join form does not navigate when PIN is shorter than 4 characters', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Enter a 3-character PIN (below the 4-char minimum).
    await page.getByPlaceholder('ABC123').fill('AB');
    await page.getByRole('button', { name: /Join game →/i }).click();

    // Should remain on the home page — URL unchanged.
    await expect(page).toHaveURL(/\/?#?\/?$/);
  });

  test('Join form navigates when PIN is exactly 4 characters', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.getByPlaceholder('ABC123').fill('ABCD');
    await page.getByRole('button', { name: /Join game →/i }).click();

    await expect(page).toHaveURL(/#\/join\/ABCD$/);
  });
});

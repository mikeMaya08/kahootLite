import { test, expect } from '@playwright/test';

// Helpers ----------------------------------------------------------------

/**
 * Navigate to /#/create, fill a minimal valid quiz (title + 2+ options per
 * question), and open the preview modal.
 *
 * @param {import('@playwright/test').Page} page
 * @param {Object} [opts]
 * @param {string}   [opts.title]     Quiz title (default 'Preview Test Quiz')
 * @param {number}   [opts.questions] How many questions to add (default 1)
 * @returns {Promise<void>}
 */
async function openPreview(page, { title = 'Preview Test Quiz', questions = 1 } = {}) {
  await page.goto('/#/create');

  // Fill the quiz title
  await page.getByLabel('Quiz title').fill(title);

  // Fill first question (always present)
  await page.getByLabel('Question text').first().fill('What is 1 + 1?');
  await page.getByPlaceholder('Option A').first().fill('2');
  await page.getByPlaceholder('Option B').first().fill('3');
  // correctIndex defaults to 0 → Option A ('2') is correct

  // Add extra questions if requested
  for (let i = 1; i < questions; i++) {
    await page.getByRole('button', { name: /\+ Add question/ }).click();
    await page.getByLabel('Question text').nth(i).fill(`Question ${i + 1}`);
    await page.getByPlaceholder('Option A').nth(i).fill('Yes');
    await page.getByPlaceholder('Option B').nth(i).fill('No');
    // correctIndex defaults to 0 → 'Yes' is correct
  }

  // Open the preview modal
  await page.getByRole('button', { name: '▶ Preview' }).click();
  // Wait for modal to appear
  await expect(page.locator('.modal-overlay')).toBeVisible();
}

// Tests ------------------------------------------------------------------

test.describe('Quiz preview modal', () => {
  test('▶ Preview button is visible in the quiz creator', async ({ page }) => {
    await page.goto('/#/create');
    await expect(
      page.getByRole('button', { name: '▶ Preview' })
    ).toBeVisible();
  });

  test('opens the preview modal and shows Q 1 / N indicator', async ({ page }) => {
    await openPreview(page);

    // Modal is open
    await expect(page.locator('.preview-card')).toBeVisible();

    // Progress indicator: "Q 1 / 1"
    await expect(page.locator('.preview-card .muted')).toHaveText('Q 1 / 1');

    // Question text is rendered
    await expect(page.locator('.question-text')).toHaveText('What is 1 + 1?');
  });

  test('✕ Close preview button dismisses the modal', async ({ page }) => {
    await openPreview(page);

    await page.getByRole('button', { name: '✕ Close preview' }).click();

    // Modal should be gone
    await expect(page.locator('.modal-overlay')).not.toBeVisible();

    // Back to quiz creator — heading still present
    await expect(page.getByRole('heading', { name: 'New quiz' })).toBeVisible();
  });

  test('selecting the correct answer highlights it as correct', async ({ page }) => {
    await openPreview(page);

    // Option A ('2') is the correct one (correctIndex = 0).
    // AnswerOption renders buttons with class 'answer answer-{color}' — use button selector.
    await page.locator('.answers-grid button').nth(0).click();

    // The correct option should carry the 'answer-correct' class after reveal.
    const correctOption = page.locator('.answers-grid button').nth(0);
    await expect(correctOption).toHaveClass(/answer-correct/);
  });

  test('selecting a wrong answer highlights it as wrong and reveals the correct one', async ({ page }) => {
    await openPreview(page);

    // Click option B ('3') — the wrong answer (correctIndex = 0).
    await page.locator('.answers-grid button').nth(1).click();

    // Option B should carry 'answer-wrong'.
    const wrongOption = page.locator('.answers-grid button').nth(1);
    await expect(wrongOption).toHaveClass(/answer-wrong/);

    // Option A should be revealed as correct.
    const correctOption = page.locator('.answers-grid button').nth(0);
    await expect(correctOption).toHaveClass(/answer-correct/);
  });

  test('cannot re-select an answer after answering (answered guard)', async ({ page }) => {
    await openPreview(page);

    // First click selects answer B (wrong).
    await page.locator('.answers-grid button').nth(1).click();

    // Advance/results button should now be visible.
    await expect(
      page.getByRole('button', { name: /Next question|See results/ })
    ).toBeVisible();

    // Clicking option A now should NOT change the wrong selection on B —
    // button is disabled so the class stays 'answer-wrong'.
    await page.locator('.answers-grid button').nth(0).click({ force: true });

    // B still carries 'answer-wrong'.
    const optionB = page.locator('.answers-grid button').nth(1);
    await expect(optionB).toHaveClass(/answer-wrong/);
  });

  test('single-question quiz shows "See results →" after answering', async ({ page }) => {
    await openPreview(page); // 1 question by default

    // Answer the only question.
    await page.locator('.answers-grid button').nth(0).click();

    // With 1 question (isLast = true) the button label should be "See results →".
    await expect(
      page.getByRole('button', { name: 'See results →' })
    ).toBeVisible();
  });

  test('multi-question quiz shows "Next question →" on all but the last question', async ({ page }) => {
    await openPreview(page, { questions: 2 });

    // Answer question 1.
    await page.locator('.answers-grid button').nth(0).click();

    // Should show "Next question →" (not the last one yet).
    await expect(
      page.getByRole('button', { name: 'Next question →' })
    ).toBeVisible();
  });

  test('advancing through questions updates the Q N / total indicator', async ({ page }) => {
    await openPreview(page, { questions: 2 });

    // Q 1 / 2
    await expect(page.locator('.preview-card .muted')).toHaveText('Q 1 / 2');

    // Answer Q1 and advance.
    await page.locator('.answers-grid button').nth(0).click();
    await page.getByRole('button', { name: 'Next question →' }).click();

    // Q 2 / 2
    await expect(page.locator('.preview-card .muted')).toHaveText('Q 2 / 2');
  });

  test('last question of multi-question quiz shows "See results →"', async ({ page }) => {
    await openPreview(page, { questions: 2 });

    // Answer Q1 and advance to Q2.
    await page.locator('.answers-grid button').nth(0).click();
    await page.getByRole('button', { name: 'Next question →' }).click();

    // Answer Q2 — this is the last question.
    await page.locator('.answers-grid button').nth(0).click();

    await expect(
      page.getByRole('button', { name: 'See results →' })
    ).toBeVisible();
  });

  test('final results screen shows correct count and "Preview results" heading', async ({ page }) => {
    await openPreview(page, { questions: 2 });

    // Answer Q1 correctly (index 0 = correct) and advance.
    await page.locator('.answers-grid button').nth(0).click();
    await page.getByRole('button', { name: 'Next question →' }).click();

    // Answer Q2 wrong (index 1 = wrong, correctIndex = 0) and go to results.
    await page.locator('.answers-grid button').nth(1).click();
    await page.getByRole('button', { name: 'See results →' }).click();

    // Results screen.
    await expect(page.getByRole('heading', { name: 'Preview results' })).toBeVisible();
    // 1 correct out of 2.
    await expect(page.getByText('You got 1 / 2 correct')).toBeVisible();
  });

  test('"Done" button on results screen closes the modal', async ({ page }) => {
    await openPreview(page); // 1 question

    // Answer and go to results.
    await page.locator('.answers-grid button').nth(0).click();
    await page.getByRole('button', { name: 'See results →' }).click();

    // Results screen is shown.
    await expect(page.getByRole('heading', { name: 'Preview results' })).toBeVisible();

    // Click Done.
    await page.getByRole('button', { name: 'Done' }).click();

    // Modal closes.
    await expect(page.locator('.modal-overlay')).not.toBeVisible();
  });

  test('preview reflects unsaved edits — reads live quiz state', async ({ page }) => {
    // Start on the creator with unsaved content.
    await page.goto('/#/create');
    await page.getByLabel('Quiz title').fill('Live Edit Title');
    await page.getByLabel('Question text').first().fill('Unsaved question?');
    await page.getByPlaceholder('Option A').first().fill('Draft A');
    await page.getByPlaceholder('Option B').first().fill('Draft B');

    // Open preview WITHOUT saving.
    await page.getByRole('button', { name: '▶ Preview' }).click();
    await expect(page.locator('.modal-overlay')).toBeVisible();

    // The unsaved question text should appear in the preview.
    await expect(page.locator('.question-text')).toHaveText('Unsaved question?');

    // Close without saving — modal disappears, creator heading is still there.
    await page.getByRole('button', { name: '✕ Close preview' }).click();
    await expect(page.locator('.modal-overlay')).not.toBeVisible();
  });

  test('question with no text renders "Untitled question" fallback', async ({ page }) => {
    // Navigate to the creator without filling in the question text, then open preview
    await page.goto('/#/create');
    await page.getByLabel('Quiz title').fill('Fallback Test');
    // Leave question text empty — only fill the required options
    await page.getByPlaceholder('Option A').first().fill('Yes');
    await page.getByPlaceholder('Option B').first().fill('No');

    await page.getByRole('button', { name: '▶ Preview' }).click();
    await expect(page.locator('.modal-overlay')).toBeVisible();

    // QuizPreview renders current.text || 'Untitled question'
    await expect(page.locator('.question-text')).toHaveText('Untitled question');
  });

  test('preview state resets to Q1 when closed and reopened', async ({ page }) => {
    await openPreview(page, { questions: 2 });

    // Answer Q1 and advance to Q2
    await page.locator('.answers-grid .answer-option').nth(0).click();
    await page.getByRole('button', { name: 'Next question →' }).click();

    // We are now on Q2
    await expect(page.locator('.preview-card .muted')).toHaveText('Q 2 / 2');

    // Close the preview
    await page.getByRole('button', { name: '✕ Close preview' }).click();
    await expect(page.locator('.modal-overlay')).not.toBeVisible();

    // Reopen the preview — state should be reset to Q1
    await page.getByRole('button', { name: '▶ Preview' }).click();
    await expect(page.locator('.modal-overlay')).toBeVisible();
    await expect(page.locator('.preview-card .muted')).toHaveText('Q 1 / 2');
  });

  test('preview works on edit route with pre-seeded quiz data', async ({ page }) => {
    // Seed a 2-question quiz directly into localStorage.
    const quiz = {
      id: 'quiz-preview-seed',
      title: 'Seeded Quiz',
      questions: [
        {
          id: 'q-1',
          text: 'Capital of France?',
          options: ['Paris', 'Berlin', 'Madrid', 'Rome'],
          correctIndex: 0,
          timeLimit: 30,
        },
        {
          id: 'q-2',
          text: 'Capital of Germany?',
          options: ['Paris', 'Berlin', 'Madrid', 'Rome'],
          correctIndex: 1,
          timeLimit: 30,
        },
      ],
      createdAt: 0,
      updatedAt: 0,
    };

    await page.goto('/');
    await page.evaluate((q) => {
      localStorage.setItem('kahootlite:quizzes', JSON.stringify([q]));
    }, quiz);

    await page.goto('/#/edit/quiz-preview-seed');

    // Open preview.
    await page.getByRole('button', { name: '▶ Preview' }).click();
    await expect(page.locator('.modal-overlay')).toBeVisible();

    // Progress indicator: Q 1 / 2.
    await expect(page.locator('.preview-card .muted')).toHaveText('Q 1 / 2');

    // Question 1 text rendered.
    await expect(page.locator('.question-text')).toHaveText('Capital of France?');

    // Answer Q1 correctly (Paris = index 0) and advance.
    await page.locator('.answers-grid button').nth(0).click();
    await page.getByRole('button', { name: 'Next question →' }).click();

    // Progress indicator: Q 2 / 2.
    await expect(page.locator('.preview-card .muted')).toHaveText('Q 2 / 2');

    // Answer Q2 correctly (Berlin = index 1) and see results.
    await page.locator('.answers-grid button').nth(1).click();
    await page.getByRole('button', { name: 'See results →' }).click();

    // Perfect score: 2 / 2.
    await expect(page.getByText('You got 2 / 2 correct')).toBeVisible();
  });

  // ── Additional gap-coverage tests ────────────────────────────────────────

  test('empty question text renders "Untitled question" fallback', async ({ page }) => {
    // Navigate to create but do NOT fill question text.
    await page.goto('/#/create');
    await page.getByLabel('Quiz title').fill('Fallback Test');
    // Fill options so preview has something to render, but leave question text blank.
    await page.getByPlaceholder('Option A').first().fill('Alpha');
    await page.getByPlaceholder('Option B').first().fill('Beta');

    await page.getByRole('button', { name: '▶ Preview' }).click();
    await expect(page.locator('.modal-overlay')).toBeVisible();

    // QuizPreview falls back to 'Untitled question' when text is empty.
    await expect(page.locator('.question-text')).toHaveText('Untitled question');
  });

  test('all-correct answers produce a perfect score on the results screen', async ({ page }) => {
    await openPreview(page, { questions: 2 });

    // Q1: answer correctly (index 0).
    await page.locator('.answers-grid button').nth(0).click();
    await page.getByRole('button', { name: 'Next question →' }).click();

    // Q2: answer correctly (index 0).
    await page.locator('.answers-grid button').nth(0).click();
    await page.getByRole('button', { name: 'See results →' }).click();

    // Perfect score.
    await expect(page.getByText('You got 2 / 2 correct')).toBeVisible();
  });

  test('all-wrong answers produce a zero score on the results screen', async ({ page }) => {
    await openPreview(page, { questions: 2 });

    // Q1: answer wrong (index 1, correct is 0).
    await page.locator('.answers-grid button').nth(1).click();
    await page.getByRole('button', { name: 'Next question →' }).click();

    // Q2: answer wrong (index 1, correct is 0).
    await page.locator('.answers-grid button').nth(1).click();
    await page.getByRole('button', { name: 'See results →' }).click();

    // Zero score.
    await expect(page.getByText('You got 0 / 2 correct')).toBeVisible();
  });

  test('answer options render the correct option text in the preview', async ({ page }) => {
    // Seed a quiz with known option labels so we can assert the text is rendered.
    const quiz = {
      id: 'quiz-text-render',
      title: 'Text Render Quiz',
      questions: [
        {
          id: 'q-1',
          text: 'Favourite colour?',
          options: ['Red', 'Green', 'Blue', 'Yellow'],
          correctIndex: 2,
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

    await page.goto('/#/edit/quiz-text-render');
    await page.getByRole('button', { name: '▶ Preview' }).click();
    await expect(page.locator('.modal-overlay')).toBeVisible();

    // All four option texts are visible.
    await expect(page.getByText('Red')).toBeVisible();
    await expect(page.getByText('Green')).toBeVisible();
    await expect(page.getByText('Blue')).toBeVisible();
    await expect(page.getByText('Yellow')).toBeVisible();

    // Selecting the correct option (Blue = index 2) marks it as correct.
    await page.locator('.answers-grid button').nth(2).click();
    await expect(page.locator('.answers-grid button').nth(2)).toHaveClass(/answer-correct/);
  });
});

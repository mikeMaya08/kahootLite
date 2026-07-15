import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Shared seed helper — injects a quiz into localStorage so we don't have to
// drive through the creator UI every time.
// ---------------------------------------------------------------------------

/**
 * Seeds `quiz` into localStorage, navigates to the edit route, and opens the
 * preview modal.
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} quiz  Full quiz object (id, title, questions[])
 */
async function seedAndOpenPreview(page, quiz) {
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
  // -------------------------------------------------------------------------
  // 1. "Untitled question" fallback
  // -------------------------------------------------------------------------
  test('shows "Untitled question" fallback when question text is empty', async ({ page }) => {
    // Seed a quiz whose first question has no text
    const quiz = {
      id: 'qp-untitled',
      title: 'Untitled Test',
      questions: [
        {
          id: 'q-ut-1',
          text: '',          // deliberately empty → should render fallback
          options: ['Yes', 'No', '', ''],
          correctIndex: 0,
          timeLimit: 20,
        },
      ],
      createdAt: 0,
      updatedAt: 0,
    };

    await seedAndOpenPreview(page, quiz);

    // The component renders `current.text || 'Untitled question'`
    await expect(page.locator('.question-text')).toHaveText('Untitled question');
  });

  // -------------------------------------------------------------------------
  // 2. Perfect score (N / N)
  // -------------------------------------------------------------------------
  test('final results show "You got 2 / 2 correct" when all answers are correct', async ({ page }) => {
    const quiz = {
      id: 'qp-perfect',
      title: 'Perfect Score Quiz',
      questions: [
        {
          id: 'q-p1',
          text: 'Q1: correct is A',
          options: ['Correct A', 'Wrong B', '', ''],
          correctIndex: 0,
          timeLimit: 20,
        },
        {
          id: 'q-p2',
          text: 'Q2: correct is A',
          options: ['Correct A', 'Wrong B', '', ''],
          correctIndex: 0,
          timeLimit: 20,
        },
      ],
      createdAt: 0,
      updatedAt: 0,
    };

    await seedAndOpenPreview(page, quiz);

    // Answer Q1 correctly (index 0) and advance
    await page.locator('.answers-grid button').nth(0).click();
    await page.getByRole('button', { name: 'Next question →' }).click();

    // Answer Q2 correctly (index 0) and finish
    await page.locator('.answers-grid button').nth(0).click();
    await page.getByRole('button', { name: 'See results →' }).click();

    // Should say "You got 2 / 2 correct"
    await expect(page.getByText('You got 2 / 2 correct')).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 3. Zero score (0 / N)
  // -------------------------------------------------------------------------
  test('final results show "You got 0 / 2 correct" when all answers are wrong', async ({ page }) => {
    const quiz = {
      id: 'qp-zero',
      title: 'Zero Score Quiz',
      questions: [
        {
          id: 'q-z1',
          text: 'Q1: correct is B',
          options: ['Wrong A', 'Correct B', '', ''],
          correctIndex: 1,  // index 1 is correct; we'll pick index 0
          timeLimit: 20,
        },
        {
          id: 'q-z2',
          text: 'Q2: correct is B',
          options: ['Wrong A', 'Correct B', '', ''],
          correctIndex: 1,
          timeLimit: 20,
        },
      ],
      createdAt: 0,
      updatedAt: 0,
    };

    await seedAndOpenPreview(page, quiz);

    // Answer Q1 WRONG (index 0, correct is 1) and advance
    await page.locator('.answers-grid button').nth(0).click();
    await page.getByRole('button', { name: 'Next question →' }).click();

    // Answer Q2 WRONG (index 0) and finish
    await page.locator('.answers-grid button').nth(0).click();
    await page.getByRole('button', { name: 'See results →' }).click();

    // Should say "You got 0 / 2 correct"
    await expect(page.getByText('You got 0 / 2 correct')).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 4. Q-progress indicator is hidden on the results screen
  // -------------------------------------------------------------------------
  test('Q progress indicator is absent on the final results screen', async ({ page }) => {
    const quiz = {
      id: 'qp-done-indicator',
      title: 'Indicator Test',
      questions: [
        {
          id: 'q-di1',
          text: 'Only question',
          options: ['A', 'B', '', ''],
          correctIndex: 0,
          timeLimit: 20,
        },
      ],
      createdAt: 0,
      updatedAt: 0,
    };

    await seedAndOpenPreview(page, quiz);

    // Confirm indicator is visible DURING the question
    await expect(page.locator('.preview-card .muted')).toBeVisible();

    // Answer and go to results
    await page.locator('.answers-grid button').nth(0).click();
    await page.getByRole('button', { name: 'See results →' }).click();

    // Results screen: heading present, Q indicator gone
    await expect(page.getByRole('heading', { name: 'Preview results' })).toBeVisible();
    // The `.muted` span inside .preview-card should no longer be the Q counter
    // (it is absent in the done branch — the component only renders it when !done)
    await expect(page.locator('.preview-card .page-header .muted')).not.toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 5. ▶ Preview button is visible on the edit route (not just /create)
  // -------------------------------------------------------------------------
  test('▶ Preview button is visible on the edit route', async ({ page }) => {
    const quiz = {
      id: 'qp-edit-btn',
      title: 'Edit Route Quiz',
      questions: [
        {
          id: 'q-eb1',
          text: 'Does the preview button appear on edit?',
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

    // The heading should confirm we are on the edit route
    await expect(page.getByRole('heading', { name: 'Edit quiz' })).toBeVisible();

    // The ▶ Preview button must be present
    await expect(page.getByRole('button', { name: '▶ Preview' })).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 6. All 4 answer options are rendered for a 4-option question
  // -------------------------------------------------------------------------
  test('renders all 4 answer options when a question has 4 choices', async ({ page }) => {
    const quiz = {
      id: 'qp-four-opts',
      title: 'Four Options Quiz',
      questions: [
        {
          id: 'q-fo1',
          text: 'Capital of France?',
          options: ['Paris', 'Berlin', 'Madrid', 'Rome'],
          correctIndex: 0,
          timeLimit: 20,
        },
      ],
      createdAt: 0,
      updatedAt: 0,
    };

    await seedAndOpenPreview(page, quiz);

    // All 4 option buttons should be present in the answers grid
    await expect(page.locator('.answers-grid button')).toHaveCount(4);

    // Verify option texts are rendered
    await expect(page.getByRole('button', { name: /Paris/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Berlin/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Madrid/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Rome/ })).toBeVisible();
  });
});

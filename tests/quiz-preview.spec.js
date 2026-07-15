import { test, expect } from '@playwright/test';

// Helper: navigate to the creator and fill in a minimal valid quiz with N questions.
async function buildQuiz(page, { title = 'Preview Test', questions = 1 } = {}) {
  await page.goto('/#/create');
  await page.getByLabel('Quiz title').fill(title);

  for (let i = 0; i < questions; i++) {
    if (i > 0) {
      await page.getByRole('button', { name: /\+ Add question/ }).click();
    }
    // The nth question editor's "Question text" label
    const editors = page.locator('.question-editor');
    const editor = editors.nth(i);
    await editor.getByLabel('Question text').fill(`Question ${i + 1}`);
    await editor.getByPlaceholder('Option A').fill('Right answer');
    await editor.getByPlaceholder('Option B').fill('Wrong answer');
    // correctIndex defaults to 0 (Option A), which is 'Right answer'
  }
}

test.describe('Quiz preview modal', () => {
  test('▶ Preview button is visible on the creator page', async ({ page }) => {
    await page.goto('/#/create');
    await expect(
      page.getByRole('button', { name: /▶ Preview/i })
    ).toBeVisible();
  });

  test('clicking ▶ Preview opens the preview modal', async ({ page }) => {
    await buildQuiz(page);
    await page.getByRole('button', { name: /▶ Preview/i }).click();
    // The modal overlay should appear
    await expect(page.locator('.modal-overlay')).toBeVisible();
    // The first question text should be visible
    await expect(page.getByText('Question 1')).toBeVisible();
  });

  test('"✕ Close preview" button closes the modal', async ({ page }) => {
    await buildQuiz(page);
    await page.getByRole('button', { name: /▶ Preview/i }).click();
    await expect(page.locator('.modal-overlay')).toBeVisible();

    await page.getByRole('button', { name: /✕ Close preview/i }).click();
    await expect(page.locator('.modal-overlay')).not.toBeVisible();
  });

  test('question progress indicator shows "Q 1 / N"', async ({ page }) => {
    await buildQuiz(page, { questions: 2 });
    await page.getByRole('button', { name: /▶ Preview/i }).click();
    await expect(page.getByText(/Q 1 \/ 2/)).toBeVisible();
  });

  test('all answer options are displayed for the current question', async ({ page }) => {
    await buildQuiz(page);
    await page.getByRole('button', { name: /▶ Preview/i }).click();
    // Option A: 'Right answer', Option B: 'Wrong answer'
    await expect(page.getByRole('button', { name: /Option A: Right answer/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Option B: Wrong answer/i })).toBeVisible();
  });

  test('selecting the correct answer marks it as correct', async ({ page }) => {
    await buildQuiz(page);
    await page.getByRole('button', { name: /▶ Preview/i }).click();

    // Click 'Right answer' (Option A, which is the correct answer)
    await page.getByRole('button', { name: /Option A: Right answer/i }).click();

    // Option A should get the 'answer-correct' class
    await expect(
      page.getByRole('button', { name: /Option A: Right answer/i })
    ).toHaveClass(/answer-correct/);
  });

  test('selecting a wrong answer marks it as wrong and reveals the correct option', async ({ page }) => {
    await buildQuiz(page);
    await page.getByRole('button', { name: /▶ Preview/i }).click();

    // Click 'Wrong answer' (Option B)
    await page.getByRole('button', { name: /Option B: Wrong answer/i }).click();

    // Option B should have 'answer-wrong'
    await expect(
      page.getByRole('button', { name: /Option B: Wrong answer/i })
    ).toHaveClass(/answer-wrong/);

    // Option A (correct) should be highlighted as correct
    await expect(
      page.getByRole('button', { name: /Option A: Right answer/i })
    ).toHaveClass(/answer-correct/);
  });

  test('answer options are disabled after one is selected', async ({ page }) => {
    await buildQuiz(page);
    await page.getByRole('button', { name: /▶ Preview/i }).click();

    await page.getByRole('button', { name: /Option A: Right answer/i }).click();

    // Both options should now be disabled
    await expect(
      page.getByRole('button', { name: /Option A: Right answer/i })
    ).toBeDisabled();
    await expect(
      page.getByRole('button', { name: /Option B: Wrong answer/i })
    ).toBeDisabled();
  });

  test('"Next question →" button appears after answering (non-last question)', async ({ page }) => {
    await buildQuiz(page, { questions: 2 });
    await page.getByRole('button', { name: /▶ Preview/i }).click();

    // Before answering — the button should not exist
    await expect(page.getByRole('button', { name: /Next question →/i })).not.toBeVisible();

    // Answer Q1
    await page.getByRole('button', { name: /Option A: Right answer/i }).click();

    // After answering — "Next question →" should appear (not "See results →")
    await expect(page.getByRole('button', { name: /Next question →/i })).toBeVisible();
  });

  test('"See results →" appears instead of "Next question →" on the last question', async ({ page }) => {
    await buildQuiz(page, { questions: 1 });
    await page.getByRole('button', { name: /▶ Preview/i }).click();

    await page.getByRole('button', { name: /Option A: Right answer/i }).click();

    // Single question → should be last → shows "See results →"
    await expect(page.getByRole('button', { name: /See results →/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Next question →/i })).not.toBeVisible();
  });

  test('advancing through all questions shows the results screen', async ({ page }) => {
    await buildQuiz(page, { questions: 2 });
    await page.getByRole('button', { name: /▶ Preview/i }).click();

    // Answer Q1 correctly and advance
    await page.getByRole('button', { name: /Option A: Right answer/i }).click();
    await page.getByRole('button', { name: /Next question →/i }).click();

    // Q2 should now be visible
    await expect(page.getByText(/Q 2 \/ 2/)).toBeVisible();

    // Answer Q2 correctly and go to results
    await page.getByRole('button', { name: /Option A: Right answer/i }).click();
    await page.getByRole('button', { name: /See results →/i }).click();

    // Results screen
    await expect(page.getByRole('heading', { name: /Preview results/i })).toBeVisible();
    await expect(page.getByText(/You got 2 \/ 2 correct/i)).toBeVisible();
  });

  test('results screen counts only correctly answered questions', async ({ page }) => {
    await buildQuiz(page, { questions: 2 });
    await page.getByRole('button', { name: /▶ Preview/i }).click();

    // Answer Q1 WRONG
    await page.getByRole('button', { name: /Option B: Wrong answer/i }).click();
    await page.getByRole('button', { name: /Next question →/i }).click();

    // Answer Q2 CORRECT
    await page.getByRole('button', { name: /Option A: Right answer/i }).click();
    await page.getByRole('button', { name: /See results →/i }).click();

    await expect(page.getByText(/You got 1 \/ 2 correct/i)).toBeVisible();
  });

  test('"Done" button on results screen closes the modal', async ({ page }) => {
    await buildQuiz(page, { questions: 1 });
    await page.getByRole('button', { name: /▶ Preview/i }).click();

    await page.getByRole('button', { name: /Option A: Right answer/i }).click();
    await page.getByRole('button', { name: /See results →/i }).click();

    await expect(page.getByRole('heading', { name: /Preview results/i })).toBeVisible();

    await page.getByRole('button', { name: /Done/i }).click();
    await expect(page.locator('.modal-overlay')).not.toBeVisible();
  });

  test('preview works with unsaved (in-progress) quiz state', async ({ page }) => {
    // Type a quiz title but don't save — preview should still reflect the live state
    await page.goto('/#/create');
    await page.getByLabel('Quiz title').fill('Unsaved Draft');
    await page.getByLabel('Question text').fill('Unsaved question?');
    await page.getByPlaceholder('Option A').fill('Answer 1');
    await page.getByPlaceholder('Option B').fill('Answer 2');

    await page.getByRole('button', { name: /▶ Preview/i }).click();

    // The unsaved question text should appear in the modal
    await expect(page.getByText('Unsaved question?')).toBeVisible();
    await expect(page.getByRole('button', { name: /Option A: Answer 1/i })).toBeVisible();
  });

  test('re-opening preview resets state (back to Q 1)', async ({ page }) => {
    await buildQuiz(page, { questions: 2 });

    // First session: open, answer Q1, then close
    await page.getByRole('button', { name: /▶ Preview/i }).click();
    await page.getByRole('button', { name: /Option A: Right answer/i }).click();
    await page.getByRole('button', { name: /Next question →/i }).click();
    await expect(page.getByText(/Q 2 \/ 2/)).toBeVisible();
    await page.getByRole('button', { name: /✕ Close preview/i }).click();

    // Second session: should restart from Q 1
    await page.getByRole('button', { name: /▶ Preview/i }).click();
    await expect(page.getByText(/Q 1 \/ 2/)).toBeVisible();
  });
});

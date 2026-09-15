import { test, expect } from '@playwright/test';
import { SAMPLE_QUIZ, seedQuiz } from '../helpers';

test.describe('Quiz library', () => {
  test('shows the empty state when no quizzes are saved', { tag: ['@quiz-library', '@ui'] }, async ({ page }) => {
    await page.goto('/#/quizzes');
    await page.waitForLoadState('networkidle');
    // Explicit wait ensures the React component has rendered before assertion.
    await page.getByText(/No quizzes yet/i).waitFor({ state: 'visible', timeout: 15_000 });
    await expect(page.getByText(/No quizzes yet/i)).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Build your first quiz/i })
    ).toBeVisible();
  });

  test('lists saved quizzes', { tag: ['@quiz-library', '@smoke', '@localstorage'] }, async ({ page }) => {
    await seedQuiz(page);
    await page.goto('/#/quizzes');
    await page.waitForLoadState('networkidle');
    await expect(
      page.getByRole('heading', { name: SAMPLE_QUIZ.title })
    ).toBeVisible();
  });

  test('Edit opens the creator pre-filled', { tag: ['@quiz-library', '@smoke'] }, async ({ page }) => {
    await seedQuiz(page);
    await page.goto('/#/quizzes');
    await page.waitForLoadState('networkidle');
    // Wait for the Edit button to be interactive before clicking.
    await page.getByRole('button', { name: 'Edit' }).waitFor({ state: 'visible', timeout: 15_000 });
    await page.getByRole('button', { name: 'Edit' }).click();
    await expect(page).toHaveURL(/#\/edit\//);
    await expect(page.getByLabel('Quiz title')).toHaveValue(SAMPLE_QUIZ.title);
    await expect(page.getByLabel('Question text')).toHaveValue(
      SAMPLE_QUIZ.questions[0].text
    );
  });

  test('Delete removes a quiz from the library', { tag: ['@quiz-library', '@localstorage'] }, async ({ page }) => {
    await seedQuiz(page);
    await page.goto('/#/quizzes');
    page.on('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText(/No quizzes yet/i)).toBeVisible();
  });

  test('Host opens a lobby with players list and PIN', { tag: ['@quiz-library', '@smoke', '@e2e'] }, async ({ page }) => {
    await seedQuiz(page);
    await page.goto('/#/quizzes');
    await page.getByRole('button', { name: /Host →/ }).click();

    await page.waitForURL(/#\/host\//);
    await expect(page.getByText(/Game PIN/i)).toBeVisible();
    await expect(page.getByText(/Waiting for players/i)).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Start game' })
    ).toBeVisible();
  });
});

import { test, expect } from '@playwright/test';
import { SAMPLE_QUIZ, seedQuiz } from './helpers';

test.describe('Quiz library', () => {
  test('shows the empty state when no quizzes are saved', async ({ page }) => {
    await page.goto('/#/quizzes');
    await expect(page.getByText(/No quizzes yet/i)).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Build your first quiz/i })
    ).toBeVisible();
  });

  test('lists saved quizzes', async ({ page }) => {
    await seedQuiz(page);
    await page.goto('/#/quizzes');
    await expect(
      page.getByRole('heading', { name: SAMPLE_QUIZ.title })
    ).toBeVisible();
  });

  test('Edit opens the creator pre-filled', async ({ page }) => {
    await seedQuiz(page);
    await page.goto('/#/quizzes');
    await page.getByRole('button', { name: 'Edit' }).click();
    await expect(page).toHaveURL(/#\/edit\//);
    await expect(page.getByLabel('Quiz title')).toHaveValue(SAMPLE_QUIZ.title);
    await expect(page.getByLabel('Question text')).toHaveValue(
      SAMPLE_QUIZ.questions[0].text
    );
  });

  test('Delete removes a quiz from the library', async ({ page }) => {
    await seedQuiz(page);
    await page.goto('/#/quizzes');
    page.on('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText(/No quizzes yet/i)).toBeVisible();
  });

  test('Host opens a lobby with players list and PIN', async ({ page }) => {
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

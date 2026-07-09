import { test, expect } from '@playwright/test';

// Helpers to seed/clear quizzes in localStorage before navigating.
async function clearQuizzes(page) {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.removeItem('kahootlite:quizzes');
  });
}

async function seedQuizzes(page, quizzes) {
  await page.goto('/');
  await page.evaluate((qs) => {
    localStorage.setItem('kahootlite:quizzes', JSON.stringify(qs));
  }, quizzes);
}

const SAMPLE_QUIZ = {
  id: 'nav-test-quiz',
  title: 'Nav Test Quiz',
  questions: [
    {
      id: 'q-1',
      text: 'Capital of France?',
      options: ['Paris', 'Berlin', 'Madrid', 'Rome'],
      correctIndex: 0,
      timeLimit: 30,
    },
  ],
  createdAt: 0,
  updatedAt: 0,
};

test.describe('Home — navigation and PIN behaviour', () => {
  test('shows singular "1 quiz saved" when exactly one quiz exists', async ({ page }) => {
    await seedQuizzes(page, [SAMPLE_QUIZ]);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // The "Host a quiz" card shows how many quizzes are on the device.
    await expect(page.getByText(/1 quiz saved on this device/i)).toBeVisible();
  });

  test('shows plural count when multiple quizzes exist', async ({ page }) => {
    const second = { ...SAMPLE_QUIZ, id: 'nav-test-quiz-2', title: 'Second Quiz' };
    await seedQuizzes(page, [SAMPLE_QUIZ, second]);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/2 quizzes saved on this device/i)).toBeVisible();
  });

  test('shows fallback text when no quizzes are saved', async ({ page }) => {
    await clearQuizzes(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(
      page.getByText(/Pick a saved quiz or build a new one to get started/i)
    ).toBeVisible();
  });

  test('"My quizzes" button navigates to the quiz library', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /My quizzes/ }).click();
    await expect(page).toHaveURL(/#\/quizzes/);
    await expect(page.getByRole('heading', { name: /My quizzes/i })).toBeVisible();
  });

  test('"+ New quiz" button on home navigates to the quiz creator', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /\+ New quiz/ }).click();
    await expect(page).toHaveURL(/#\/create/);
    await expect(page.getByRole('heading', { name: /New quiz/i })).toBeVisible();
  });

  test('PIN shorter than 4 characters does NOT navigate away from home', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Type only 3 chars — the handler requires >= 4 to navigate.
    await page.getByPlaceholder('ABC123').fill('AB1');
    await page.getByRole('button', { name: /Join game →/ }).click();

    // Should still be on the home screen.
    await expect(page).toHaveURL(/\/?#?\/?$/);
    await expect(page.getByRole('heading', { name: /KahootLite/i })).toBeVisible();
  });

  test('PIN of exactly 4 characters navigates to the join screen', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.getByPlaceholder('ABC123').fill('AB12');
    await page.getByRole('button', { name: /Join game →/ }).click();

    // Should navigate to join (room won't exist, but the route change happens).
    await expect(page).toHaveURL(/#\/join\/AB12/);
  });

  test('"← Home" link in the quiz library returns to home', async ({ page }) => {
    await page.goto('/#/quizzes');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /← Home/ }).click();
    await expect(page.getByRole('heading', { name: /KahootLite/i })).toBeVisible();
  });

  test('"← Home" link in the creator returns to home', async ({ page }) => {
    await page.goto('/#/create');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /← Home/ }).click();
    await expect(page.getByRole('heading', { name: /KahootLite/i })).toBeVisible();
  });
});

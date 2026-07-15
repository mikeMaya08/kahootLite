import { test, expect } from '@playwright/test';
import { hostSeededQuiz, joinAs, seedQuiz } from './helpers.js';

// A two-question quiz to exercise streak-related UI in the Play page.
const TWO_Q_QUIZ = {
  id: 'quiz-streak',
  title: 'Streak Quiz',
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
      options: ['Vienna', 'Berlin', 'Zurich', 'Prague'],
      correctIndex: 1,
      timeLimit: 30,
    },
  ],
  createdAt: 0,
  updatedAt: 0,
};

test.describe('Play screen — extended', () => {
  test('shows "Room ended" when navigating to a non-existent room', async ({
    page,
  }) => {
    // Navigate directly to a play URL with no room in storage.
    await page.goto('/#/play/NOROOM');
    await expect(page.getByText(/Room NOROOM ended/i)).toBeVisible();
    await expect(
      page.getByRole('button', { name: /← Home/i })
    ).toBeVisible();
  });

  test('"← Home" on room-ended screen navigates back to home', async ({
    page,
  }) => {
    await page.goto('/#/play/NOROOM');
    await page.getByRole('button', { name: /← Home/i }).click();
    await expect(page).toHaveURL(/\/?#?\/?$/);
  });

  test('player without a session is bounced from /play to /join', async ({
    page,
    context,
  }) => {
    // Seed and create a room in the host tab so the room exists.
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    // Open a fresh page with no sessionStorage identity and visit /play directly.
    const stranger = await context.newPage();
    // Clear sessionStorage so there is no playerId.
    await stranger.goto('/');
    await stranger.evaluate(() => sessionStorage.clear());

    await stranger.goto(`/#/play/${code}`);

    // Should be redirected to the join screen.
    await expect(stranger).toHaveURL(new RegExp(`#/join/${code}`));
  });

  test('correct answer shows "+N pts" and "✓ Correct!" on reveal', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const alice = await context.newPage();
    await joinAs(alice, code, 'Alice');

    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(alice.getByText('Capital of France?')).toBeVisible();

    await alice.getByRole('button', { name: 'Paris' }).click();
    await expect(alice.getByText(/Locked in/i)).toBeVisible();

    await page.getByRole('button', { name: 'Reveal answer' }).click();
    await expect(alice.getByText(/✓ Correct!/i)).toBeVisible();
    await expect(alice.locator('.reveal-card')).toContainText('pts');
  });

  test('wrong answer shows "✗ Not this time." on reveal', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const alice = await context.newPage();
    await joinAs(alice, code, 'Alice');

    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(alice.getByText('Capital of France?')).toBeVisible();

    // Berlin is wrong (correctIndex: 0 = Paris).
    await alice.getByRole('button', { name: 'Berlin' }).click();
    await page.getByRole('button', { name: 'Reveal answer' }).click();

    await expect(alice.getByText(/✗ Not this time\./i)).toBeVisible();
  });

  test('streak badge (🔥) appears after two consecutive correct answers', async ({
    page,
    context,
  }) => {
    // Seed two-question quiz.
    await page.goto('/');
    await page.evaluate((q) => {
      localStorage.setItem('kahootlite:quizzes', JSON.stringify([q]));
    }, TWO_Q_QUIZ);
    await page.goto('/#/quizzes');
    await page.getByRole('button', { name: /Host →/ }).click();
    await page.waitForURL(/#\/host\//);
    const code = (await page.locator('.big-code').first().innerText()).trim();

    const alice = await context.newPage();
    await joinAs(alice, code, 'Alice');

    await page.getByRole('button', { name: 'Start game' }).click();

    // Q1 — Alice answers correctly (Paris).
    await expect(alice.getByText('Capital of France?')).toBeVisible();
    await alice.getByRole('button', { name: 'Paris' }).click();
    await page.getByRole('button', { name: 'Reveal answer' }).click();
    await expect(alice.getByText(/✓ Correct!/i)).toBeVisible();

    // Advance to Q2.
    await page.getByRole('button', { name: /Next question →/i }).click();

    // Q2 — Alice answers correctly again (Berlin).
    await expect(alice.getByText('Capital of Germany?')).toBeVisible();
    await alice.getByRole('button', { name: 'Berlin' }).click();
    await page.getByRole('button', { name: 'Reveal answer' }).click();
    await expect(alice.getByText(/✓ Correct!/i)).toBeVisible();

    // After 2 correct answers in a row the streak badge should show "🔥 2".
    await expect(alice.locator('.streak-badge')).toContainText('🔥');
    await expect(alice.locator('.streak-badge')).toContainText('2');
  });

  test('"← Home" on game-over screen navigates back to home', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const alice = await context.newPage();
    await joinAs(alice, code, 'Alice');

    await page.getByRole('button', { name: 'Start game' }).click();
    await page.getByRole('button', { name: 'Reveal answer' }).click();
    await page.getByRole('button', { name: /See final results →/i }).click();

    await expect(
      alice.getByRole('heading', { name: /Game over/i })
    ).toBeVisible();
    await alice.getByRole('button', { name: /← Home/i }).click();
    await expect(alice).toHaveURL(/\/?#?\/?$/);
  });
});

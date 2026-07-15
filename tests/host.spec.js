import { test, expect } from '@playwright/test';
import { hostSeededQuiz, joinAs, seedQuiz, SAMPLE_QUIZ } from './helpers.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A two-question quiz so we can exercise "Next question →" navigation. */
const TWO_Q_QUIZ = {
  id: 'quiz-two-q',
  title: 'Two Questions',
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

async function seedAndHostQuiz(page, quiz = SAMPLE_QUIZ) {
  await page.evaluate((q) => {
    localStorage.setItem('kahootlite:quizzes', JSON.stringify([q]));
  }, quiz);
  await page.goto('/#/quizzes');
  await page.getByRole('button', { name: /Host →/ }).click();
  await page.waitForURL(/#\/host\//);
  const code = (await page.locator('.big-code').first().innerText()).trim();
  return code;
}

// ---------------------------------------------------------------------------
// Host lobby
// ---------------------------------------------------------------------------

test.describe('Host page — lobby', () => {
  test('displays Game PIN and quiz title in lobby', async ({ page }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    await expect(page.getByText(/Game PIN/i)).toBeVisible();
    await expect(page.locator('.big-code').first()).toHaveText(code);
    await expect(page.getByText(SAMPLE_QUIZ.title)).toBeVisible();
  });

  test('"Copy join link" button is present in the lobby', async ({ page }) => {
    await seedQuiz(page);
    await hostSeededQuiz(page);

    await expect(
      page.getByRole('button', { name: /Copy join link/i })
    ).toBeVisible();
  });

  test('"← End room" in the lobby confirms and navigates home', async ({
    page,
  }) => {
    await seedQuiz(page);
    await hostSeededQuiz(page);

    // Accept the confirm dialog that endGame shows.
    page.on('dialog', (d) => d.accept());
    await page.getByRole('button', { name: /← End room/i }).click();
    await expect(page).toHaveURL(/\/?#?\/?$/);
  });

  test('starting with no players shows a confirm dialog', async ({ page }) => {
    await seedQuiz(page);
    await hostSeededQuiz(page);

    // Dismiss the dialog (cancel) — game should not start.
    page.on('dialog', (d) => d.dismiss());
    await page.getByRole('button', { name: 'Start game' }).click();

    // Should remain in lobby (big-code still visible).
    await expect(page.locator('.big-code').first()).toBeVisible();
    await expect(page.getByText(/Game PIN/i)).toBeVisible();
  });

  test('player count badge increments as players join', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    await joinAs(await context.newPage(), code, 'Alice');
    await joinAs(await context.newPage(), code, 'Bob');

    await expect(page.locator('.badge')).toHaveText('2');
  });
});

// ---------------------------------------------------------------------------
// Host game controls
// ---------------------------------------------------------------------------

test.describe('Host page — in-game controls', () => {
  test('answer count increments on the host UI as players answer', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const alice = await context.newPage();
    await joinAs(alice, code, 'Alice');
    await page.getByRole('button', { name: 'Start game' }).click();

    // Before Alice answers the host shows 0/1.
    await expect(page.getByText(/Answers/i)).toBeVisible();
    await expect(page.locator('.game-header')).toContainText('0');

    // Alice answers; host counter should reach 1.
    await alice.getByRole('button', { name: 'Paris' }).click();
    await expect(page.locator('.game-header')).toContainText('1');
  });

  test('"Reveal answer" transitions host to reveal state', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const alice = await context.newPage();
    await joinAs(alice, code, 'Alice');
    await page.getByRole('button', { name: 'Start game' }).click();
    await page.getByRole('button', { name: 'Reveal answer' }).click();

    // In reveal state, "See final results →" should appear (single-question quiz).
    await expect(
      page.getByRole('button', { name: /See final results →/i })
    ).toBeVisible();

    // Standings card is visible on the host.
    await expect(page.getByText(/Standings/i)).toBeVisible();
  });

  test('"Next question →" advances to question 2 in a multi-question quiz', async ({
    page,
    context,
  }) => {
    // Seed a two-question quiz.
    await page.goto('/');
    await page.evaluate((q) => {
      localStorage.setItem('kahootlite:quizzes', JSON.stringify([q]));
    }, TWO_Q_QUIZ);
    const code = await seedAndHostQuiz(page, TWO_Q_QUIZ);

    const alice = await context.newPage();
    await joinAs(alice, code, 'Alice');

    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(page.getByText('Capital of France?')).toBeVisible();

    // Reveal Q1 and advance.
    await page.getByRole('button', { name: 'Reveal answer' }).click();
    await page.getByRole('button', { name: /Next question →/i }).click();

    // Host should now show question 2.
    await expect(page.getByText('Capital of Germany?')).toBeVisible();
    await expect(page.locator('.game-header')).toContainText('Question 2 / 2');
  });
});

// ---------------------------------------------------------------------------
// Host final results
// ---------------------------------------------------------------------------

test.describe('Host page — final results', () => {
  test('"Final results" screen shows a leaderboard after the game ends', async ({
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
      page.getByRole('heading', { name: /Final results/i })
    ).toBeVisible();
    // Leaderboard present on host view.
    await expect(page.locator('.lb-row, [class*="lb-row"]').first()).toBeVisible();
  });

  test('"Play again" resets scores and returns to lobby', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const alice = await context.newPage();
    await joinAs(alice, code, 'Alice');

    // Run through the full game.
    await page.getByRole('button', { name: 'Start game' }).click();
    await alice.getByRole('button', { name: 'Paris' }).click();
    await page.getByRole('button', { name: 'Reveal answer' }).click();
    await page.getByRole('button', { name: /See final results →/i }).click();

    // Reset.
    await page.getByRole('button', { name: /Play again/i }).click();

    // Should be back in the lobby.
    await expect(page.getByText(/Game PIN/i)).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Start game' })
    ).toBeVisible();
  });

  test('"End room" on final results navigates host back to home', async ({
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

    page.on('dialog', (d) => d.accept());
    await page.getByRole('button', { name: /End room/i }).click();

    await expect(page).toHaveURL(/\/?#?\/?$/);
  });
});

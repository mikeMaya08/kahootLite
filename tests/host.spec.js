import { test, expect } from '@playwright/test';
import { hostSeededQuiz, joinAs, seedQuiz } from './helpers.js';

// ---------------------------------------------------------------------------
// Shared multi-question quiz fixture.
// Two questions so we can exercise "Next question →" before "See final results →".
// ---------------------------------------------------------------------------
const MULTI_Q_QUIZ = {
  id: 'quiz-multi-q',
  title: 'Multi-Q Quiz',
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
      options: ['Vienna', 'Berlin', 'Prague', 'Warsaw'],
      correctIndex: 1,
      timeLimit: 30,
    },
  ],
  createdAt: 0,
  updatedAt: 0,
};

test.describe('Host page', () => {
  // ── Lobby ──────────────────────────────────────────────────────────────────

  test('lobby displays Game PIN and "Waiting for players" when no one has joined', async ({
    page,
  }) => {
    await seedQuiz(page);
    await hostSeededQuiz(page);

    // The PIN display and lobby text should be visible straight away.
    await expect(page.getByText(/Game PIN/i)).toBeVisible();
    await expect(
      page.getByText(/Waiting for players|open a new tab/i)
    ).toBeVisible();

    // Start game button must exist.
    await expect(
      page.getByRole('button', { name: 'Start game' })
    ).toBeVisible();
  });

  test('"Copy join link" button is present in the lobby', async ({ page }) => {
    await seedQuiz(page);
    await hostSeededQuiz(page);

    await expect(
      page.getByRole('button', { name: /Copy join link/i })
    ).toBeVisible();
  });

  test('player count badge increments as players join', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    // Initially 0 players — badge may not yet render; Start is enabled (quiz has questions).
    await joinAs(await context.newPage(), code, 'Alice');
    await expect(page.locator('.badge')).toHaveText('1');

    await joinAs(await context.newPage(), code, 'Bob');
    await expect(page.locator('.badge')).toHaveText('2');
  });

  // ── Multi-question game flow ───────────────────────────────────────────────

  test('"Next question →" advances to Q2 and updates the question counter', async ({
    page,
    context,
  }) => {
    // Seed a 2-question quiz.
    await page.goto('/');
    await page.evaluate((q) => {
      localStorage.setItem('kahootlite:quizzes', JSON.stringify([q]));
    }, MULTI_Q_QUIZ);

    // Host the multi-question quiz.
    await page.goto('/#/quizzes');
    await page.getByRole('button', { name: /Host →/ }).click();
    await page.waitForURL(/#\/host\//);

    const code = (await page.locator('.big-code').first().innerText()).trim();

    // One player joins.
    const player = await context.newPage();
    await joinAs(player, code, 'Alice');

    // Host starts the game.
    await page.getByRole('button', { name: 'Start game' }).click();

    // Q1 is displayed.
    await expect(page.getByText('Capital of France?')).toBeVisible();
    // Header shows Question 1 / 2.
    await expect(page.locator('.game-header')).toContainText('Question 1 / 2');

    // Host reveals Q1 answer without waiting for Alice.
    await page.getByRole('button', { name: 'Reveal answer' }).click();

    // "Next question →" must appear (not "See final results →").
    await expect(
      page.getByRole('button', { name: 'Next question →' })
    ).toBeVisible();
    await page.getByRole('button', { name: 'Next question →' }).click();

    // Now on Q2.
    await expect(page.getByText('Capital of Germany?')).toBeVisible();
    await expect(page.locator('.game-header')).toContainText('Question 2 / 2');

    // After revealing Q2, "See final results →" should appear.
    await page.getByRole('button', { name: 'Reveal answer' }).click();
    await expect(
      page.getByRole('button', { name: 'See final results →' })
    ).toBeVisible();
  });

  // ── Final-results screen ───────────────────────────────────────────────────

  test('"Play again" resets scores and returns to the lobby', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const player = await context.newPage();
    await joinAs(player, code, 'Alice');

    // Run through the full single-question game.
    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(player.getByText('Capital of France?')).toBeVisible();

    // Alice answers correctly.
    await player.getByRole('button', { name: 'Paris' }).click();

    // Host reveals and finalises.
    await page.getByRole('button', { name: 'Reveal answer' }).click();
    await page.getByRole('button', { name: 'See final results →' }).click();

    // Final results screen on host side.
    await expect(
      page.getByRole('heading', { name: /Final results/i })
    ).toBeVisible();

    // Click "Play again" — should return to lobby state.
    await page.getByRole('button', { name: 'Play again' }).click();

    // The host is back in the lobby.
    await expect(
      page.getByRole('button', { name: 'Start game' })
    ).toBeVisible();
    await expect(page.getByText(/Game PIN/i)).toBeVisible();
  });

  test('"End room" navigates the host back to home', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const player = await context.newPage();
    await joinAs(player, code, 'Alice');

    // Play through the single-question game to reach final results.
    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(player.getByText('Capital of France?')).toBeVisible();

    await page.getByRole('button', { name: 'Reveal answer' }).click();
    await page.getByRole('button', { name: 'See final results →' }).click();

    await expect(
      page.getByRole('heading', { name: /Final results/i })
    ).toBeVisible();

    // Accept the confirm dialog that "End room" triggers.
    page.on('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'End room' }).click();

    // Host should land back on home.
    await expect(page).toHaveURL(/\/?#?\/?$/);
  });

  // ── Spectator view ─────────────────────────────────────────────────────────

  test('"End room" from the lobby navigates host back to home', async ({
    page,
  }) => {
    await seedQuiz(page);
    await hostSeededQuiz(page);

    // "← End room" button is in the lobby header.
    page.on('dialog', (d) => d.accept());
    await page.getByRole('button', { name: /← End room/i }).click();

    await expect(page).toHaveURL(/\/?#?\/?$/);
  });
});

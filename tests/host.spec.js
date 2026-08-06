import { test, expect } from '@playwright/test';
import { hostSeededQuiz, joinAs, seedQuiz, SAMPLE_QUIZ } from './helpers.js';

// ---------------------------------------------------------------------------
// Host page — control flows
// ---------------------------------------------------------------------------

test.describe('Host page', () => {
  // ── Invalid / missing room ────────────────────────────────────────────────

  test('shows "Room not found" when the room ID is invalid', async ({ page }) => {
    await page.goto('/#/host/INVALID999');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/Room not found/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Home/i })).toBeVisible();
  });

  test('"Home" button on the not-found screen navigates to /', async ({ page }) => {
    await page.goto('/#/host/INVALID999');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /Home/i }).click();
    await expect(page).toHaveURL(/\/?#?[^/]*$/);
  });

  // ── Lobby controls ────────────────────────────────────────────────────────

  test('lobby shows quiz title and Start game button', async ({ page }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    await expect(
      page.getByRole('heading', { name: SAMPLE_QUIZ.title })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Start game' })
    ).toBeVisible();
    await expect(page.getByText(/Game PIN/i)).toBeVisible();
    await expect(page.locator('.big-code')).toHaveText(code);
  });

  test('starting with zero players shows confirm dialog', async ({ page }) => {
    await seedQuiz(page);
    await hostSeededQuiz(page);

    // Accept the "No players" confirm dialog, game should still start.
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Start game' }).click();

    // After accepting, the game starts and the question is shown.
    await expect(page.getByText('Capital of France?')).toBeVisible();
  });

  test('declining the zero-players dialog keeps the host in the lobby', async ({
    page,
  }) => {
    await seedQuiz(page);
    await hostSeededQuiz(page);

    page.once('dialog', (d) => d.dismiss());
    await page.getByRole('button', { name: 'Start game' }).click();

    // Should still be on the lobby screen.
    await expect(
      page.getByRole('button', { name: 'Start game' })
    ).toBeVisible();
  });

  // ── Playing phase controls ────────────────────────────────────────────────

  test('Reveal answer advances host to reveal state', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);
    await joinAs(await context.newPage(), code, 'Alice');

    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(page.getByText('Capital of France?')).toBeVisible();

    await page.getByRole('button', { name: 'Reveal answer' }).click();

    // In reveal state the timer disappears and final-results button appears.
    await expect(
      page.getByRole('button', { name: /See final results →/ })
    ).toBeVisible();
    // "Reveal answer" button should be gone.
    await expect(
      page.getByRole('button', { name: 'Reveal answer' })
    ).toHaveCount(0);
  });

  test('host sees answer count increment as players submit', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const alice = await context.newPage();
    await joinAs(alice, code, 'Alice');

    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(page.getByText('Capital of France?')).toBeVisible();

    // Before Alice answers, count should be 0 / 1
    await expect(page.locator('.game-header')).toContainText('Answers');
    await expect(page.locator('.game-header')).toContainText('0');

    // Alice submits an answer
    await alice.getByRole('button', { name: /Paris/ }).click();
    await expect(alice.getByText(/Locked in/i)).toBeVisible();

    // Host header now shows 1 answered
    await expect(page.locator('.game-header')).toContainText('1');
  });

  // ── Multi-question progression ────────────────────────────────────────────

  test('"Next question →" advances to Q2 in a two-question quiz', async ({
    page,
    context,
  }) => {
    const twoQ = {
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
          options: ['Paris', 'Berlin', 'Madrid', 'Rome'],
          correctIndex: 1,
          timeLimit: 30,
        },
      ],
      createdAt: 0,
      updatedAt: 0,
    };

    // Seed the two-question quiz and host it.
    await page.goto('/');
    await page.evaluate((q) => {
      localStorage.setItem('kahootlite:quizzes', JSON.stringify([q]));
    }, twoQ);
    await page.goto('/#/quizzes');
    await page.getByRole('button', { name: /Host →/ }).click();
    await page.waitForURL(/#\/host\//);

    const player = await context.newPage();
    const code = (await page.locator('.big-code').first().innerText()).trim();
    await joinAs(player, code, 'Alice');

    // Start game
    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(page.getByText('Capital of France?')).toBeVisible();

    // Reveal Q1
    await page.getByRole('button', { name: 'Reveal answer' }).click();
    await expect(
      page.getByRole('button', { name: /Next question →/ })
    ).toBeVisible();

    // Advance to Q2
    await page.getByRole('button', { name: /Next question →/ }).click();
    await expect(page.getByText('Capital of Germany?')).toBeVisible();

    // Q2 indicator shows "2 / 2"
    await expect(page.locator('.game-header')).toContainText('2');
  });

  // ── Final results & Post-game ─────────────────────────────────────────────

  test('host final results screen shows leaderboard', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const player = await context.newPage();
    await joinAs(player, code, 'Alice');

    await page.getByRole('button', { name: 'Start game' }).click();
    await page.getByRole('button', { name: 'Reveal answer' }).click();
    await page.getByRole('button', { name: /See final results →/ }).click();

    await expect(
      page.getByRole('heading', { name: /Final results/i })
    ).toBeVisible();
    // Alice should appear in the host-side leaderboard
    await expect(page.getByText('Alice')).toBeVisible();
  });

  test('"Play again" resets scores and returns players to lobby', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const player = await context.newPage();
    await joinAs(player, code, 'Alice');

    // Full run — Alice answers correctly
    await page.getByRole('button', { name: 'Start game' }).click();
    await player.getByRole('button', { name: /Paris/ }).click();
    await page.getByRole('button', { name: 'Reveal answer' }).click();
    await page.getByRole('button', { name: /See final results →/ }).click();

    // Verify Alice scored before restart
    const scoreText = await page.locator('.lb-row', { hasText: 'Alice' }).locator('.lb-score').innerText();
    expect(Number(scoreText)).toBeGreaterThan(0);

    // Host hits "Play again"
    await page.getByRole('button', { name: 'Play again' }).click();

    // Host should be back in the lobby
    await expect(
      page.getByRole('button', { name: 'Start game' })
    ).toBeVisible();

    // Player tab should show waiting screen again
    await expect(player.getByText(/Waiting for the host/i)).toBeVisible();

    // Score in storage should be reset to 0
    const stored = await page.evaluate((key) => {
      const room = JSON.parse(localStorage.getItem(key) || 'null');
      return Object.values(room?.players ?? {}).map((p) => p.score);
    }, `kahootlite:room:${code}`);
    expect(stored.every((s) => s === 0)).toBe(true);
  });

  test('"End room" from final results deletes the room and sends host home', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);
    await joinAs(await context.newPage(), code, 'Alice');

    await page.getByRole('button', { name: 'Start game' }).click();
    await page.getByRole('button', { name: 'Reveal answer' }).click();
    await page.getByRole('button', { name: /See final results →/ }).click();

    // Accept the confirm dialog that "End room" triggers
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'End room' }).click();

    await expect(page).toHaveURL(/\/?#?[^/]*$/);

    // Room should no longer exist in localStorage
    const room = await page.evaluate(
      (key) => localStorage.getItem(key),
      `kahootlite:room:${code}`
    );
    expect(room).toBeNull();
  });

  // ── Spectator view ────────────────────────────────────────────────────────

  test('second host tab shows spectator view with leaderboard', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const spectator = await context.newPage();
    await spectator.goto(`/#/host/${code}`);
    await expect(
      spectator.getByRole('heading', { name: /Spectator view/i })
    ).toBeVisible();
    // No "Start game" button for the spectator
    await expect(
      spectator.getByRole('button', { name: 'Start game' })
    ).toHaveCount(0);
    // Leaderboard component is rendered
    await expect(
      spectator.locator('.leaderboard, [class*="leaderboard"]').first()
    ).toBeVisible();
  });
});

import { test, expect } from '@playwright/test';
import { hostSeededQuiz, joinAs, seedQuiz, SAMPLE_QUIZ } from '../helpers';

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

  test('"Copy join link" button is present in the lobby', async ({ page }) => {
    await seedQuiz(page);
    await hostSeededQuiz(page);

    await expect(
      page.getByRole('button', { name: /Copy join link/i })
    ).toBeVisible();
  });

  test('player count badge increments as players join', async ({ page, context }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    await joinAs(await context.newPage(), code, 'Alice');
    await expect(page.locator('.badge')).toHaveText('1');

    await joinAs(await context.newPage(), code, 'Bob');
    await expect(page.locator('.badge')).toHaveText('2');
  });

  test('starting with zero players shows confirm dialog', async ({ page }) => {
    await seedQuiz(page);
    await hostSeededQuiz(page);

    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Start game' }).click();

    await expect(page.getByText('Capital of France?')).toBeVisible();
  });

  test('declining the zero-players dialog keeps the host in the lobby', async ({ page }) => {
    await seedQuiz(page);
    await hostSeededQuiz(page);

    page.once('dialog', (d) => d.dismiss());
    await page.getByRole('button', { name: 'Start game' }).click();

    await expect(
      page.getByRole('button', { name: 'Start game' })
    ).toBeVisible();
  });

  // ── Playing phase controls ────────────────────────────────────────────────

  test('Reveal answer advances host to reveal state', async ({ page, context }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);
    await joinAs(await context.newPage(), code, 'Alice');

    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(page.getByText('Capital of France?')).toBeVisible();

    await page.getByRole('button', { name: 'Reveal answer' }).click();

    await expect(
      page.getByRole('button', { name: /See final results →/ })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Reveal answer' })
    ).toHaveCount(0);
  });

  test('host sees answer count increment as players submit', async ({ page, context }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const alice = await context.newPage();
    await joinAs(alice, code, 'Alice');

    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(page.getByText('Capital of France?')).toBeVisible();

    await expect(page.locator('.game-header')).toContainText('Answers');
    await expect(page.locator('.game-header')).toContainText('0');

    await alice.getByRole('button', { name: /Paris/ }).click();
    await expect(alice.getByText(/Locked in/i)).toBeVisible();

    await expect(page.locator('.game-header')).toContainText('1');
  });

  // ── Multi-question progression ────────────────────────────────────────────

  test('"Next question →" advances to Q2 in a two-question quiz', async ({ page, context }) => {
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

    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(page.getByText('Capital of France?')).toBeVisible();

    await page.getByRole('button', { name: 'Reveal answer' }).click();
    await expect(
      page.getByRole('button', { name: /Next question →/ })
    ).toBeVisible();

    await page.getByRole('button', { name: /Next question →/ }).click();
    await expect(page.getByText('Capital of Germany?')).toBeVisible();
    await expect(page.locator('.game-header')).toContainText('2');
  });

  // ── Final results & Post-game ─────────────────────────────────────────────

  test('host final results screen shows leaderboard', async ({ page, context }) => {
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
    await expect(page.getByText('Alice')).toBeVisible();
  });

  test('"Play again" resets scores and returns players to lobby', async ({ page, context }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const player = await context.newPage();
    await joinAs(player, code, 'Alice');

    await page.getByRole('button', { name: 'Start game' }).click();
    await player.getByRole('button', { name: /Paris/ }).click();
    await page.getByRole('button', { name: 'Reveal answer' }).click();
    await page.getByRole('button', { name: /See final results →/ }).click();

    await page.getByRole('button', { name: 'Play again' }).click();

    await expect(
      page.getByRole('button', { name: 'Start game' })
    ).toBeVisible();
    await expect(player.getByText(/Waiting for the host/i)).toBeVisible();

    const stored = await page.evaluate((key) => {
      const room = JSON.parse(localStorage.getItem(key) || 'null');
      return Object.values(room?.players ?? {}).map((p) => p.score);
    }, `kahootlite:room:${code}`);
    expect(stored.every((s) => s === 0)).toBe(true);
  });

  test('"End room" from final results deletes the room and sends host home', async ({ page, context }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);
    await joinAs(await context.newPage(), code, 'Alice');

    await page.getByRole('button', { name: 'Start game' }).click();
    await page.getByRole('button', { name: 'Reveal answer' }).click();
    await page.getByRole('button', { name: /See final results →/ }).click();

    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'End room' }).click();

    await expect(page).toHaveURL(/\/?#?[^/]*$/);

    const room = await page.evaluate(
      (key) => localStorage.getItem(key),
      `kahootlite:room:${code}`
    );
    expect(room).toBeNull();
  });

  test('"End room" from the lobby navigates host back to home', async ({ page }) => {
    await seedQuiz(page);
    await hostSeededQuiz(page);

    page.on('dialog', (d) => d.accept());
    await page.getByRole('button', { name: /← End room/i }).click();

    await expect(page).toHaveURL(/\/?#?[^/]*$/);
  });

  // ── Spectator view ────────────────────────────────────────────────────────

  test('second host tab shows spectator view with leaderboard', async ({ page, context }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const spectator = await context.newPage();
    await spectator.goto(`/#/host/${code}`);
    await expect(
      spectator.getByRole('heading', { name: /Spectator view/i })
    ).toBeVisible();
    await expect(
      spectator.getByRole('button', { name: 'Start game' })
    ).toHaveCount(0);
    await expect(
      spectator.locator('.leaderboard, [class*="leaderboard"]').first()
    ).toBeVisible();
  });
});

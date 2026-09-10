import { test, expect } from '@playwright/test';
import { hostSeededQuiz, joinAs, seedQuiz } from '../helpers';

// ---------------------------------------------------------------------------
// Play page — additional edge cases
// ---------------------------------------------------------------------------

test.describe('Play page edge cases', () => {
  // ── Room ended mid-game ───────────────────────────────────────────────────

  test('player sees "Room ended" screen when host deletes the room while game is live', async ({ page, context }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const player = await context.newPage();
    await joinAs(player, code, 'Alice');

    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(player.getByText('Capital of France?')).toBeVisible();

    await page.getByRole('button', { name: 'Reveal answer' }).click();
    await page.getByRole('button', { name: /See final results →/ }).click();
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'End room' }).click();

    await expect(player.getByText(new RegExp(`Room ${code} ended`, 'i'))).toBeVisible({
      timeout: 7_000,
    });
  });

  test('"← Home" on the room-ended screen navigates to the home page', async ({ page }) => {
    await page.goto('/#/play/DEADROOM');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/Room DEADROOM ended/i)).toBeVisible();
    await page.getByRole('button', { name: /← Home/i }).click();
    await expect(page).toHaveURL(/\/?#?[^/]*$/);
  });

  test('navigating to /play without a session identity bounces back to /join', async ({ page, context }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const freshCtx = await context.browser().newContext();
    const freshPage = await freshCtx.newPage();

    await freshPage.goto(`/#/play/${code}`);
    await freshPage.waitForLoadState('networkidle');

    await expect(freshPage).toHaveURL(new RegExp(`#/join/${code}`));

    await freshCtx.close();
  });

  // ── Correct / wrong answer reveal ─────────────────────────────────────────

  test('correct answer shows "✓ Correct!" and a positive score in reveal', async ({ page, context }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const player = await context.newPage();
    await joinAs(player, code, 'Alice');

    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(player.getByText('Capital of France?')).toBeVisible();

    await player.getByRole('button', { name: /Paris/ }).click();
    await expect(player.getByText(/Locked in/i)).toBeVisible();

    await page.getByRole('button', { name: 'Reveal answer' }).click();

    await expect(player.getByText(/✓ Correct!/i)).toBeVisible();
    const revealText = await player.locator('.reveal-card').innerText();
    expect(revealText).toMatch(/\+\d+ pts/);

    const headerText = await player.locator('.game-header').innerText();
    const match = headerText.match(/(\d+)\s*pts/);
    expect(match).not.toBeNull();
    expect(parseInt(match[1])).toBeGreaterThan(0);
  });

  test('wrong answer shows "✗ Not this time." and 0 pts in reveal', async ({ page, context }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const player = await context.newPage();
    await joinAs(player, code, 'Bob');

    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(player.getByText('Capital of France?')).toBeVisible();

    await player.getByRole('button', { name: /Berlin/ }).click();
    await expect(player.getByText(/Locked in/i)).toBeVisible();

    await page.getByRole('button', { name: 'Reveal answer' }).click();

    await expect(player.getByText(/Not this time/i)).toBeVisible();
    await expect(player.locator('.game-header')).toContainText('0 pts');
  });

  // ── Streak badge ──────────────────────────────────────────────────────────

  test('streak badge appears on the play header after two consecutive correct answers', async ({ page, context }) => {
    const twoQ = {
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
    const code = (await page.locator('.big-code').first().innerText()).trim();

    const player = await context.newPage();
    await joinAs(player, code, 'Alice');

    await page.getByRole('button', { name: 'Start game' }).click();

    await expect(player.getByText('Capital of France?')).toBeVisible();
    await player.getByRole('button', { name: /Paris/ }).click();
    await page.getByRole('button', { name: 'Reveal answer' }).click();
    await expect(player.getByText(/✓ Correct!/i)).toBeVisible();

    await page.getByRole('button', { name: /Next question →/ }).click();

    await expect(player.getByText('Capital of Germany?')).toBeVisible();
    await player.getByRole('button', { name: /Berlin/ }).click();

    await page.getByRole('button', { name: 'Reveal answer' }).click();
    await expect(player.getByText(/✓ Correct!/i)).toBeVisible();

    await expect(
      player.locator('.streak-badge, [class*="streak"]').first()
    ).toBeVisible();
  });

  // ── Leaderboard in reveal card ────────────────────────────────────────────

  test('leaderboard is shown inside the player reveal card after reveal', async ({ page, context }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const player = await context.newPage();
    await joinAs(player, code, 'Alice');

    await page.getByRole('button', { name: 'Start game' }).click();
    await player.getByRole('button', { name: /Paris/ }).click();
    await page.getByRole('button', { name: 'Reveal answer' }).click();

    await expect(
      player.locator('.reveal-card .leaderboard, .reveal-card [class*="leaderboard"]').first()
    ).toBeVisible();
    await expect(player.locator('.reveal-card')).toContainText('Alice');
  });
});

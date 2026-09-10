import { test, expect } from '@playwright/test';
import { hostSeededQuiz, joinAs, seedQuiz } from '../helpers';

// ---------------------------------------------------------------------------
// Join page — edge cases not covered by join.spec.js
// ---------------------------------------------------------------------------

test.describe('Join page edge cases', () => {
  // ── Missing / non-existent room ───────────────────────────────────────────

  test('shows "Room not found" when PIN does not match any room', async ({ page }) => {
    await page.goto('/#/join/XXXXXX');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/Room XXXXXX not found/i)).toBeVisible();
    await expect(
      page.getByRole('button', { name: /← Home/i })
    ).toBeVisible();
  });

  test('"← Home" on not-found screen returns to the home page', async ({ page }) => {
    await page.goto('/#/join/XXXXXX');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /← Home/i }).click();
    await expect(page).toHaveURL(/\/?#?[^/]*$/);
  });

  // ── Room deleted while player is waiting ──────────────────────────────────

  test('player sees "Room ended" when host deletes the room mid-wait', async ({ page, context }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const player = await context.newPage();
    await joinAs(player, code, 'Alice');
    await expect(player.getByText(/Waiting for the host/i)).toBeVisible();

    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: /← End room/i }).click();

    await expect(player.getByText(/Waiting for the host/i)).not.toBeVisible({
      timeout: 7_000,
    });
  });

  // ── Nickname collision (case-insensitive) ─────────────────────────────────

  test('rejects a nickname that differs only by case', async ({ page, context }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const player1 = await context.newPage();
    await joinAs(player1, code, 'alice');
    await expect(player1.getByText(/Waiting for the host/i)).toBeVisible();

    const player2 = await context.newPage();
    await player2.goto(`/#/join/${code}`);
    await player2.getByLabel('Your nickname').fill('ALICE');
    await player2.getByRole('button', { name: /Join game/ }).click();

    await expect(
      player2.getByText(/nickname is already taken/i)
    ).toBeVisible();
    await expect(player2).toHaveURL(new RegExp(`#/join/${code}`));
  });

  // ── Saved nickname pre-fills the form ────────────────────────────────────

  test('last-used nickname pre-fills the join form from prefs', async ({ page, context }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    await page.evaluate(() => {
      localStorage.setItem(
        'kahootlite:prefs',
        JSON.stringify({ name: 'RegularPlayer' })
      );
    });

    const player = await context.newPage();
    await player.goto(`/#/join/${code}`);

    await expect(player.getByLabel('Your nickname')).toHaveValue('RegularPlayer');
  });

  // ── Late joiner auto-redirect ─────────────────────────────────────────────

  test('joining a room that is already playing redirects straight to /play', async ({ page, context }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const early = await context.newPage();
    await joinAs(early, code, 'Early');
    await expect(page.getByText('Early')).toBeVisible();

    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(page.getByText('Capital of France?')).toBeVisible();

    const late = await context.newPage();
    await late.goto(`/#/join/${code}`);
    await late.getByLabel('Your nickname').fill('Latecomer');
    await late.getByRole('button', { name: /Join game →/ }).click();

    await expect(late).toHaveURL(new RegExp(`#/play/${code}`));
  });
});

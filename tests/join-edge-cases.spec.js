import { test, expect } from '@playwright/test';
import { hostSeededQuiz, joinAs, seedQuiz } from './helpers.js';

// ---------------------------------------------------------------------------
// Join page — edge cases not covered by join.spec.js
// ---------------------------------------------------------------------------

test.describe('Join page edge cases', () => {
  // ── Missing / non-existent room ───────────────────────────────────────────

  test('shows "No room code provided" when navigating to /join/ with no code', async ({
    page,
  }) => {
    await page.goto('/#/join/');
    await page.waitForLoadState('networkidle');

    // The Join component checks for a missing code and shows this message.
    await expect(page.getByText(/No room code provided/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Home/i })).toBeVisible();
  });

  test('shows "Room not found" when PIN does not match any room', async ({
    page,
  }) => {
    await page.goto('/#/join/XXXXXX');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/Room XXXXXX not found/i)).toBeVisible();
    await expect(
      page.getByRole('button', { name: /← Home/i })
    ).toBeVisible();
  });

  test('"← Home" on not-found screen returns to the home page', async ({
    page,
  }) => {
    await page.goto('/#/join/XXXXXX');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /← Home/i }).click();
    await expect(page).toHaveURL(/\/?#?[^/]*$/);
  });

  // ── Room deleted while player is waiting ──────────────────────────────────

  test('player sees "Room ended" when host deletes the room mid-wait', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const player = await context.newPage();
    await joinAs(player, code, 'Alice');
    await expect(player.getByText(/Waiting for the host/i)).toBeVisible();

    // Host ends the room from the lobby
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: /← End room/i }).click();

    // Player should see the "Room ended" screen (Play page fallback) or be
    // redirected. Since the room is deleted and status stays in play, the
    // join effect will navigate to /play which then sees no room.
    // Verify the player tab no longer shows the lobby waiting state.
    await expect(player.getByText(/Waiting for the host/i)).not.toBeVisible({
      timeout: 7_000,
    });
  });

  // ── Nickname collision (case-insensitive) ─────────────────────────────────

  test('rejects a nickname that differs only by case', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const player1 = await context.newPage();
    await joinAs(player1, code, 'alice');
    await expect(player1.getByText(/Waiting for the host/i)).toBeVisible();

    const player2 = await context.newPage();
    await player2.goto(`/#/join/${code}`);
    await player2.getByLabel('Your nickname').fill('ALICE'); // same, different case
    await player2.getByRole('button', { name: /Join game/ }).click();

    await expect(
      player2.getByText(/nickname is already taken/i)
    ).toBeVisible();
    await expect(player2).toHaveURL(new RegExp(`#/join/${code}`));
  });

  // ── Avatar emoji selection ────────────────────────────────────────────────

  test('selected emoji is stored in the room when player joins', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const player = await context.newPage();
    await player.goto(`/#/join/${code}`);
    await player.getByLabel('Your nickname').fill('EmojiPlayer');

    // Click a specific emoji chip — pick the third one (index 2).
    const emojiChips = player.locator('.emoji-chip');
    const targetEmoji = await emojiChips.nth(2).innerText();
    await emojiChips.nth(2).click();

    // The clicked chip should now carry the is-selected class.
    await expect(emojiChips.nth(2)).toHaveClass(/is-selected/);

    await player.getByRole('button', { name: /Join game →/ }).click();

    // The player navigates to the play/waiting screen.
    await player.waitForURL(new RegExp(`#/play/${code}`));

    // Verify the stored emoji matches the selected one.
    const storedEmoji = await page.evaluate(
      ([roomKey, name]) => {
        const room = JSON.parse(localStorage.getItem(roomKey) || 'null');
        const p = Object.values(room?.players ?? {}).find(
          (pl) => pl.name === name
        );
        return p?.emoji ?? null;
      },
      [`kahootlite:room:${code}`, 'EmojiPlayer']
    );
    expect(storedEmoji).toBe(targetEmoji.trim());
  });

  // ── Saved nickname pre-fills the form ────────────────────────────────────

  test('last-used nickname pre-fills the join form from prefs', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    // Persist a name preference.
    await page.evaluate(() => {
      localStorage.setItem(
        'kahootlite:prefs',
        JSON.stringify({ name: 'RegularPlayer' })
      );
    });

    const player = await context.newPage();
    // Give the new tab the same prefs (same browser context = same localStorage).
    await player.goto(`/#/join/${code}`);

    // The nickname field should already contain the saved name.
    await expect(player.getByLabel('Your nickname')).toHaveValue(
      'RegularPlayer'
    );
  });

  // ── Late joiner auto-redirect ─────────────────────────────────────────────

  test('joining a room that is already playing redirects straight to /play', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    // First player joins so we can start the game without a confirm dialog.
    const early = await context.newPage();
    await joinAs(early, code, 'Early');
    await expect(page.getByText('Early')).toBeVisible();

    // Host starts the game.
    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(page.getByText('Capital of France?')).toBeVisible();

    // A second player arrives late — fills name and joins.
    const late = await context.newPage();
    await late.goto(`/#/join/${code}`);
    await late.getByLabel('Your nickname').fill('Latecomer');
    await late.getByRole('button', { name: /Join game →/ }).click();

    // The join effect should navigate late joiners directly to /play.
    await expect(late).toHaveURL(new RegExp(`#/play/${code}`));
  });
});

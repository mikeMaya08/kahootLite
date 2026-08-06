import { test, expect } from '@playwright/test';
import { hostSeededQuiz, seedQuiz } from './helpers.js';

test.describe('Join screen — avatar & nickname persistence', () => {
  // ── Avatar picker ──────────────────────────────────────────────────────────

  test('all emoji avatars from the pool are visible in the picker', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const player = await context.newPage();
    await player.goto(`/#/join/${code}`);

    // The emoji picker row renders every emoji as an aria-labelled button.
    // There are 12 emojis in the EMOJI_POOL defined in Join.jsx.
    const chips = player.locator('.emoji-chip');
    await expect(chips).toHaveCount(12);
  });

  test('clicking an avatar chip marks it as selected', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const player = await context.newPage();
    await player.goto(`/#/join/${code}`);

    // Click the third emoji chip in the row.
    const chip = player.locator('.emoji-chip').nth(2);
    await chip.click();

    // The chip should receive the "is-selected" class.
    await expect(chip).toHaveClass(/is-selected/);
  });

  test('selected avatar is reflected in the player record after joining', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const player = await context.newPage();
    await player.goto(`/#/join/${code}`);

    // Pick the first chip explicitly and note its emoji text.
    const firstChip = player.locator('.emoji-chip').first();
    const selectedEmoji = await firstChip.innerText();
    await firstChip.click();

    // Fill a nickname and join.
    await player.getByLabel('Your nickname').fill('EmojiPlayer');
    await player.getByRole('button', { name: /Join game/ }).click();

    // Player should reach the play/waiting screen.
    await expect(player).toHaveURL(new RegExp(`#/play/${code}`));

    // The emoji displayed in the player waiting card should match what was picked.
    await expect(player.locator('.emoji-big')).toHaveText(selectedEmoji);
  });

  // ── Nickname persistence ───────────────────────────────────────────────────

  test('the nickname field is pre-filled from saved prefs on a second visit', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const player = await context.newPage();
    await player.goto(`/#/join/${code}`);

    // Save a nickname via prefs directly (simulating a previous session).
    await player.evaluate(() => {
      localStorage.setItem(
        'kahootlite:prefs',
        JSON.stringify({ name: 'ReturnPlayer' })
      );
    });

    // Reload the join page so the component reads prefs on mount.
    await player.reload();
    await player.waitForLoadState('networkidle');

    // The nickname input should be pre-filled with the saved name.
    await expect(player.getByLabel('Your nickname')).toHaveValue('ReturnPlayer');
  });

  test('nickname is saved to prefs after a successful join', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const player = await context.newPage();
    await player.goto(`/#/join/${code}`);

    await player.getByLabel('Your nickname').fill('SavedNick');
    await player.getByRole('button', { name: /Join game/ }).click();
    await expect(player).toHaveURL(new RegExp(`#/play/${code}`));

    // The nickname should now be persisted in localStorage prefs.
    const prefs = await player.evaluate(() =>
      JSON.parse(localStorage.getItem('kahootlite:prefs') || '{}')
    );
    expect(prefs.name).toBe('SavedNick');
  });

  // ── "No room code" edge case ───────────────────────────────────────────────

  test('navigating to /#/join without a code shows "No room code" message', async ({
    page,
  }) => {
    await page.goto('/#/join/');
    await page.waitForLoadState('networkidle');

    // When no code segment is present the Join page renders a fallback message.
    await expect(page.getByText(/No room code provided/i)).toBeVisible();

    // The home button should be present.
    await expect(
      page.getByRole('button', { name: /Home/i })
    ).toBeVisible();
  });
});

import { test, expect } from '@playwright/test';
import { hostSeededQuiz, seedQuiz } from '../helpers';

test.describe('Join screen — avatar & nickname persistence', () => {
  // ── Avatar picker ──────────────────────────────────────────────────────────

  test('all emoji avatars from the pool are visible in the picker', async ({ page, context }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const player = await context.newPage();
    await player.goto(`/#/join/${code}`);

    // 12 emojis in the EMOJI_POOL defined in Join.jsx
    const chips = player.locator('.emoji-chip');
    await expect(chips).toHaveCount(12);
  });

  test('clicking an avatar chip marks it as selected', async ({ page, context }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const player = await context.newPage();
    await player.goto(`/#/join/${code}`);

    const chip = player.locator('.emoji-chip').nth(2);
    await chip.click();

    await expect(chip).toHaveClass(/is-selected/);
  });

  test('selected avatar is reflected in the player record after joining', async ({ page, context }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const player = await context.newPage();
    await player.goto(`/#/join/${code}`);

    const firstChip = player.locator('.emoji-chip').first();
    const selectedEmoji = await firstChip.innerText();
    await firstChip.click();

    await player.getByLabel('Your nickname').fill('EmojiPlayer');
    await player.getByRole('button', { name: /Join game/ }).click();

    await expect(player).toHaveURL(new RegExp(`#/play/${code}`));
    await expect(player.locator('.emoji-big')).toHaveText(selectedEmoji);
  });

  test('selected emoji is stored in the room when player joins', async ({ page, context }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const player = await context.newPage();
    await player.goto(`/#/join/${code}`);
    await player.getByLabel('Your nickname').fill('EmojiPlayer');

    const emojiChips = player.locator('.emoji-chip');
    const targetEmoji = await emojiChips.nth(2).innerText();
    await emojiChips.nth(2).click();
    await expect(emojiChips.nth(2)).toHaveClass(/is-selected/);

    await player.getByRole('button', { name: /Join game →/ }).click();
    await player.waitForURL(new RegExp(`#/play/${code}`));

    const storedEmoji = await page.evaluate(
      ([roomKey, name]) => {
        const room = JSON.parse(localStorage.getItem(roomKey) || 'null');
        const p = Object.values(room?.players ?? {}).find((pl) => pl.name === name);
        return p?.emoji ?? null;
      },
      [`kahootlite:room:${code}`, 'EmojiPlayer']
    );
    expect(storedEmoji).toBe(targetEmoji.trim());
  });

  // ── Nickname persistence ───────────────────────────────────────────────────

  test('the nickname field is pre-filled from saved prefs on a second visit', async ({ page, context }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const player = await context.newPage();
    await player.goto(`/#/join/${code}`);

    await player.evaluate(() => {
      localStorage.setItem(
        'kahootlite:prefs',
        JSON.stringify({ name: 'ReturnPlayer' })
      );
    });

    await player.reload();
    await player.waitForLoadState('networkidle');

    await expect(player.getByLabel('Your nickname')).toHaveValue('ReturnPlayer');
  });

  test('nickname is saved to prefs after a successful join', async ({ page, context }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const player = await context.newPage();
    await player.goto(`/#/join/${code}`);

    await player.getByLabel('Your nickname').fill('SavedNick');
    await player.getByRole('button', { name: /Join game/ }).click();
    await expect(player).toHaveURL(new RegExp(`#/play/${code}`));

    const prefs = await player.evaluate(() =>
      JSON.parse(localStorage.getItem('kahootlite:prefs') || '{}')
    );
    expect(prefs.name).toBe('SavedNick');
  });

  test('nickname typed on join is pre-filled on next visit', async ({ page, context }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const player = await context.newPage();
    await player.goto(`/#/join/${code}`);
    await player.getByLabel('Your nickname').fill('ReturningPlayer');
    await player.getByRole('button', { name: /Join game/ }).click();
    await expect(player).toHaveURL(new RegExp(`#/play/${code}`));

    const newSession = await context.newPage();
    await newSession.goto(`/#/join/${code}`);
    await expect(newSession.getByLabel('Your nickname')).toHaveValue('ReturningPlayer');
  });

  // ── UX details ────────────────────────────────────────────────────────────

  test('"← Home" link on join screen navigates back to home', async ({ page, context }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const player = await context.newPage();
    await player.goto(`/#/join/${code}`);
    await player.getByRole('button', { name: /← Home/i }).click();
    await expect(player).toHaveURL(/\/?#?\/?(|$)/);
    await expect(
      player.getByRole('heading', { name: /KahootLite/i })
    ).toBeVisible();
  });

  // ── "No room code" edge case ───────────────────────────────────────────────

  test('navigating to /#/join without a code shows "No room code" message', async ({ page }) => {
    await page.goto('/#/join/');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/No room code provided/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Home/i })).toBeVisible();
  });
});

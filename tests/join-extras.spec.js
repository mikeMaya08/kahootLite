import { test, expect } from '@playwright/test';
import { hostSeededQuiz, joinAs, seedQuiz } from './helpers.js';

test.describe('Join screen — additional flows', () => {
  test('avatar emoji picker allows selecting a different emoji', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const player = await context.newPage();
    await player.goto(`/#/join/${code}`);

    // The emoji row should be present with multiple selectable chips.
    const emojiChips = player.locator('.emoji-chip');
    await expect(emojiChips.first()).toBeVisible();

    // Click the second emoji to select it.
    const secondEmoji = emojiChips.nth(1);
    await secondEmoji.click();
    // The chip should now be marked as selected.
    await expect(secondEmoji).toHaveClass(/is-selected/);
  });

  test('nickname field is pre-filled from saved preferences', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const player = await context.newPage();
    // Seed a saved name preference directly into localStorage.
    await player.goto('/');
    await player.evaluate(() => {
      localStorage.setItem(
        'kahootlite:prefs',
        JSON.stringify({ name: 'SavedPlayer' })
      );
    });

    // Navigate to the join screen — the input should be pre-filled.
    await player.goto(`/#/join/${code}`);
    await expect(player.getByLabel('Your nickname')).toHaveValue('SavedPlayer');
  });

  test('nickname preference is persisted after a successful join', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const player = await context.newPage();
    await player.goto(`/#/join/${code}`);
    await player.getByLabel('Your nickname').fill('RememberMe');
    await player.getByRole('button', { name: /Join game/ }).click();

    // The preference should now be saved.
    const saved = await player.evaluate(() =>
      JSON.parse(localStorage.getItem('kahootlite:prefs') || '{}')
    );
    expect(saved.name).toBe('RememberMe');
  });

  test('visiting /join/CODE when game is already playing shows redirect or room state', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    // Player 1 joins normally.
    const p1 = await context.newPage();
    await joinAs(p1, code, 'Player1');

    // Host starts the game.
    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(p1).toHaveURL(new RegExp(`#/play/${code}`));

    // A NEW player (Player2) tries to join after the game started.
    const p2 = await context.newPage();
    await p2.goto(`/#/join/${code}`);
    await p2.getByLabel('Your nickname').fill('Player2');
    await p2.getByRole('button', { name: /Join game/ }).click();

    // Player2 should be redirected to the play page since the game is in progress.
    await expect(p2).toHaveURL(new RegExp(`#/play/${code}`));
  });

  test('shows room title on the join screen', async ({ page, context }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const player = await context.newPage();
    await player.goto(`/#/join/${code}`);

    // The join page displays the quiz title and the room code.
    await expect(player.locator('.big-code').first()).toHaveText(code);
    // The quiz title from SAMPLE_QUIZ ("Capitals") should appear.
    await expect(player.getByText('Capitals')).toBeVisible();
  });

  test('join page shows an error when navigated to without a room code', async ({
    page,
  }) => {
    // Navigate to /join/ without any code segment.
    await page.goto('/#/join/');
    await expect(page.getByText(/No room code provided/i)).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Home/i })
    ).toBeVisible();
  });
});

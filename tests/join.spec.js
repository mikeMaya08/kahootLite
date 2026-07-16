import { test, expect } from '@playwright/test';
import { hostSeededQuiz, seedQuiz } from './helpers.js';

test.describe('Join screen', () => {
  test('blocks empty nickname', async ({ page, context }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const player = await context.newPage();
    await player.goto(`/#/join/${code}`);
    await player.getByRole('button', { name: /Join game/ }).click();

    await expect(player.getByText(/Enter a nickname to continue\./i)).toBeVisible();
    await expect(player).toHaveURL(new RegExp(`#/join/${code}`));
  });

  test('blocks nickname longer than 20 characters', async ({ page, context }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const player = await context.newPage();
    await player.goto(`/#/join/${code}`);
    const input = player.getByLabel('Your nickname');
    await input.evaluate((el) => { el.removeAttribute('maxlength'); });
    // Use a 44-char string to trigger the updated 30-char limit check
    await input.fill('ThisNicknameIsWayTooLongAndDefinitelyExceedsThirtyChars');
    await player.getByRole('button', { name: /Join game/ }).click();

    await expect(
      player.getByText(/Nickname must be \d+ characters or fewer/i)
    ).toBeVisible();
    await expect(player).toHaveURL(new RegExp(`#/join/${code}`));
  });

  test('auto-redirects to /play when game is already in progress', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    // Player joins while game is still in lobby
    const player = await context.newPage();
    await player.goto(`/#/join/${code}`);
    await player.getByLabel('Your nickname').fill('Alice');
    await player.getByRole('button', { name: /Join game/ }).click();
    await expect(player.getByText(/Waiting for the host/i)).toBeVisible();

    // Host starts the game
    await page.getByRole('button', { name: 'Start game' }).click();

    // Player tab should automatically redirect to /play
    await expect(player).toHaveURL(new RegExp(`#/play/${code}`));
  });
});

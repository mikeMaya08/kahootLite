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

  test('blocks nickname longer than 30 characters', async ({ page, context }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const player = await context.newPage();
    await player.goto(`/#/join/${code}`);
    const input = player.getByLabel('Your nickname');
    await input.evaluate((el) => { el.removeAttribute('maxlength'); });
    await input.fill('ThisNicknameIsWayTooLongAndExceedsTheThirtyCharLimit!!');
    await player.getByRole('button', { name: /Join game/ }).click();

    await expect(
      player.getByText(/nickname.{0,30}(too long|30|characters)/i)
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

import { test, expect } from '@playwright/test';
import { hostSeededQuiz, seedQuiz } from './helpers.js';

test.describe('Join screen — extended', () => {
  test('shows "No room code provided" when visiting /join with no code', async ({
    page,
  }) => {
    await page.goto('/#/join/');
    await expect(page.getByText(/No room code provided/i)).toBeVisible();
    await page.getByRole('button', { name: /Home/i }).click();
    await expect(page).toHaveURL(/\/?#?\/?$/);
  });

  test('shows quiz title on the join card', async ({ page, context }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const player = await context.newPage();
    await player.goto(`/#/join/${code}`);

    // Quiz title is displayed in the join card.
    await expect(player.getByText('Capitals')).toBeVisible();
  });

  test('avatar picker lets the player select a different emoji', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const player = await context.newPage();
    await player.goto(`/#/join/${code}`);

    // Pick the 🐼 emoji explicitly.
    await player.getByRole('button', { name: /Pick 🐼/i }).click();
    await expect(
      player.locator('.emoji-chip.is-selected')
    ).toHaveText('🐼');
  });

  test('selected emoji is carried into the waiting lobby card', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const player = await context.newPage();
    await player.goto(`/#/join/${code}`);

    // Select 🦄.
    await player.getByRole('button', { name: /Pick 🦄/i }).click();
    await player.getByLabel('Your nickname').fill('Unicorn');
    await player.getByRole('button', { name: /Join game →/i }).click();

    // The waiting screen should show the chosen emoji.
    await expect(player.getByText('🦄')).toBeVisible();
  });

  test('nickname is pre-filled from persisted prefs on second visit', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const player = await context.newPage();
    await player.goto(`/#/join/${code}`);

    // First join — sets the pref.
    await player.getByLabel('Your nickname').fill('ReturnUser');
    await player.getByRole('button', { name: /Join game →/i }).click();
    // Wait to land on the waiting screen so the pref is saved.
    await expect(player.getByText(/Waiting for the host/i)).toBeVisible();

    // Host a new game so we have a fresh room.
    await seedQuiz(page);
    const code2 = await hostSeededQuiz(page);

    // Open a third page (same context, same localStorage) and go to join.
    const player2 = await context.newPage();
    await player2.goto(`/#/join/${code2}`);

    // Nickname field should be pre-populated.
    await expect(player2.getByLabel('Your nickname')).toHaveValue('ReturnUser');
  });

  test('"← Home" link on the join page navigates back home', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const player = await context.newPage();
    await player.goto(`/#/join/${code}`);
    await player.getByRole('button', { name: /← Home/i }).click();
    await expect(player).toHaveURL(/\/?#?\/?$/);
  });
});

import { test, expect } from '@playwright/test';
import { hostSeededQuiz, joinAs, seedQuiz } from './helpers';

test.describe('Join — edge cases', () => {
  test('shows "Room not found" when navigating to a non-existent room code', async ({
    page,
  }) => {
    await page.goto('/#/join/ZZZZZZ');
    await expect(page.getByText(/Room ZZZZZZ not found/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Home/i })).toBeVisible();
  });

  test('"Home" button on the not-found screen navigates back to home', async ({
    page,
  }) => {
    await page.goto('/#/join/BADCODE');
    await page.getByRole('button', { name: /Home/i }).click();
    await expect(page.getByText(/KahootLite/i)).toBeVisible();
  });

  test('shows "No room code provided" when navigating to /join with no code', async ({
    page,
  }) => {
    await page.goto('/#/join/');
    await expect(page.getByText(/No room code provided/i)).toBeVisible();
  });

  test('room deleted while player is waiting in lobby shows "Room ended"', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const player = await context.newPage();
    await joinAs(player, code, 'Alice');
    await expect(player.getByText(/Waiting for the host/i)).toBeVisible();

    // Host deletes the room from localStorage directly (simulates "End room").
    await page.evaluate((c) => {
      localStorage.removeItem(`kahootlite:room:${c.toUpperCase()}`);
      window.dispatchEvent(
        new CustomEvent('kahootlite:room-update', { detail: { code: c.toUpperCase() } })
      );
    }, code);

    // Player's Play screen should detect the missing room and show "ended".
    await expect(player.getByText(/Room .* ended/i)).toBeVisible({ timeout: 5_000 });
  });

  test('player can pick a custom emoji avatar before joining', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const player = await context.newPage();
    await player.goto(`/#/join/${code}`);

    // Pick the panda emoji specifically
    await player.getByRole('button', { name: 'Pick 🐼' }).click();
    await player.getByLabel('Your nickname').fill('PandaFan');
    await player.getByRole('button', { name: /Join game/ }).click();

    // Player is now in the waiting lobby — host tab should show the panda
    await expect(page.getByText('🐼')).toBeVisible();
  });

  test('nickname case-insensitive collision is rejected', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const player1 = await context.newPage();
    await joinAs(player1, code, 'alice');

    const player2 = await context.newPage();
    await player2.goto(`/#/join/${code}`);
    await player2.getByLabel('Your nickname').fill('ALICE');
    await player2.getByRole('button', { name: /Join game/ }).click();

    await expect(
      player2.getByText(/nickname is already taken/i)
    ).toBeVisible();
  });

  test('nickname longer than 20 characters is rejected at the join form', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const player = await context.newPage();
    await player.goto(`/#/join/${code}`);
    // The input has maxLength=20, so we fill and try to submit the raw value
    await player.getByLabel('Your nickname').fill('A'.repeat(25));
    await player.getByRole('button', { name: /Join game/ }).click();

    await expect(
      player.getByText(/20 characters or fewer/i)
    ).toBeVisible();
  });

  test('game in progress: joining a started game redirects straight to /play', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    // First player joins and host starts the game
    const player1 = await context.newPage();
    await joinAs(player1, code, 'Alice');
    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(player1.getByText('Capital of France?')).toBeVisible();

    // Second player arrives at join screen — should be redirected to /play
    const player2 = await context.newPage();
    await player2.goto(`/#/join/${code}`);
    await player2.getByLabel('Your nickname').fill('LateJoiner');
    await player2.getByRole('button', { name: /Join game/ }).click();
    await expect(player2).toHaveURL(/#\/play\//);
  });
});

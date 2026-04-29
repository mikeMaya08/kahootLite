import { test, expect } from '@playwright/test';
import { hostSeededQuiz, joinAs, seedQuiz } from './helpers';

test.describe('Play screen', () => {
  test('shows "Out of time" when host reveals before player answers', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const player = await context.newPage();
    await joinAs(player, code, 'Alice');

    // Host starts the game
    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(player.getByText('Capital of France?')).toBeVisible();

    // Host reveals answer before Alice picks anything
    await page.getByRole('button', { name: 'Reveal answer' }).click();

    // Alice should see "Out of time" since she never answered
    await expect(player.getByText(/Out of time/i)).toBeVisible();
  });

  test('unanswered player scores zero after reveal', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const player = await context.newPage();
    await joinAs(player, code, 'Alice');

    // Host starts the game
    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(player.getByText('Capital of France?')).toBeVisible();

    // Host reveals without Alice answering
    await page.getByRole('button', { name: 'Reveal answer' }).click();

    // Alice's score in the header should remain 0
    await expect(player.locator('.game-header')).toContainText('0 pts');
  });
});

import { test, expect } from '@playwright/test';
import { hostSeededQuiz, joinAs, seedQuiz } from './helpers.js';

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

  test('shows "Game over" screen with rank and score after the game ends', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const player = await context.newPage();
    await joinAs(player, code, 'Alice');

    // Host starts the single-question game
    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(player.getByText('Capital of France?')).toBeVisible();

    // Alice answers correctly (Paris = option index 0)
    await player.getByRole('button', { name: 'Paris' }).click();

    // Host reveals and ends the game
    await page.getByRole('button', { name: 'Reveal answer' }).click();
    await page.getByRole('button', { name: 'See final results →' }).click();

    // Alice should see the "Game over" screen
    await expect(player.getByRole('heading', { name: /Game over/i })).toBeVisible();

    // She finished #1 (only player) and scored > 0
    await expect(player.locator('.you-card')).toContainText('#1');
    await expect(player.locator('.you-card')).toContainText('Alice');
    const scoreText = await player.locator('.you-card').innerText();
    const match = scoreText.match(/(\d+)\s*pts/);
    expect(match).not.toBeNull();
    expect(parseInt(match[1])).toBeGreaterThan(0);

    // The leaderboard is also visible with Alice on it
    await expect(player.locator('.leaderboard, [class*="leaderboard"]').first()).toBeVisible();
  });
});

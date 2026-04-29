import { test, expect } from '@playwright/test';
import { hostSeededQuiz, seedQuiz } from './helpers';

test.describe('Host screen', () => {
  test('"End room" deletes the room and navigates home', async ({ page }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    // Accept the confirm dialog that endGame() triggers
    page.on('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: /← End room/ }).click();

    // Host should land back on the home page
    await expect(page).toHaveURL(/\/#?\/?\s*$/);

    // Room should no longer exist in localStorage
    const room = await page.evaluate((c) => {
      return localStorage.getItem(`kahootlite:room:${c}`);
    }, code);
    expect(room).toBeNull();
  });

  test('starting with 0 players shows a confirmation prompt', async ({
    page,
  }) => {
    await seedQuiz(page);
    await hostSeededQuiz(page);

    // No players have joined — dismiss the dialog and verify game does not start
    page.on('dialog', async (dialog) => {
      expect(dialog.message()).toMatch(/No players have joined yet/i);
      await dialog.dismiss();
    });

    await page.getByRole('button', { name: 'Start game' }).click();

    // Game should still be in the lobby after dismissing
    await expect(page.getByRole('button', { name: 'Start game' })).toBeVisible();
  });
});

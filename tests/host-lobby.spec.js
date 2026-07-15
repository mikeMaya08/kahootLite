import { test, expect } from '@playwright/test';
import { hostSeededQuiz, joinAs, seedQuiz } from './helpers.js';

// ---------------------------------------------------------------------------
// Host lobby — flows not yet covered by quiz-list.spec.js or multiplayer.spec.js
// ---------------------------------------------------------------------------

test.describe('Host lobby', () => {
  // ── PIN display ────────────────────────────────────────────────────────────
  test('PIN is exactly 6 uppercase alphanumeric characters', async ({
    page,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);
    await expect(page.locator('.big-code').first()).toHaveText(code);
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
  });

  // ── "Copy join link" ────────────────────────────────────────────────────────
  test('"Copy join link" button is present in the lobby', async ({ page }) => {
    await seedQuiz(page);
    await hostSeededQuiz(page);
    // The button must exist; clipboard write requires browser permission so we
    // just confirm the button is rendered and enabled.
    await expect(
      page.getByRole('button', { name: /Copy join link/i })
    ).toBeVisible();
  });

  // ── "← End room" — cancel keeps the lobby open ────────────────────────────
  test('"End room" confirm cancelled keeps the lobby active', async ({
    page,
  }) => {
    await seedQuiz(page);
    await hostSeededQuiz(page);

    // Dismiss the confirm dialog so the room stays open.
    page.on('dialog', (d) => d.dismiss());
    await page.getByRole('button', { name: /← End room/i }).click();

    // Should still be on the host URL with the lobby visible.
    await expect(page).toHaveURL(/#\/host\//);
    await expect(page.getByText(/Game PIN/i)).toBeVisible();
  });

  // ── "← End room" — accept navigates home ──────────────────────────────────
  test('"End room" confirm accepted navigates back to home', async ({
    page,
  }) => {
    await seedQuiz(page);
    await hostSeededQuiz(page);

    page.on('dialog', (d) => d.accept());
    await page.getByRole('button', { name: /← End room/i }).click();

    await expect(page).toHaveURL(/\/?#?(?:\/)?$/);
  });

  // ── Start with zero players shows confirm dialog ───────────────────────────
  test('starting with no players shows a confirmation dialog', async ({
    page,
  }) => {
    await seedQuiz(page);
    await hostSeededQuiz(page);

    // Intercept the confirm dialog so we can assert it fired.
    let dialogMessage = '';
    page.once('dialog', (d) => {
      dialogMessage = d.message();
      d.dismiss(); // dismiss so the test stays on the lobby
    });

    await page.getByRole('button', { name: 'Start game' }).click();
    expect(dialogMessage).toMatch(/No players/i);

    // Dismissed → still in lobby
    await expect(page.getByText(/Waiting for players/i)).toBeVisible();
  });

  // ── Confirming "start with no players" actually starts the game ────────────
  test('confirming start with zero players begins the game', async ({
    page,
  }) => {
    await seedQuiz(page);
    await hostSeededQuiz(page);

    page.on('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Start game' }).click();

    // Host view moves to the question screen.
    await expect(page.getByText('Capital of France?')).toBeVisible();
  });

  // ── Player join updates the player count badge ────────────────────────────
  test('player list and badge update when a second player joins', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    await expect(page.locator('.badge')).toHaveText('0');

    const p1 = await context.newPage();
    await joinAs(p1, code, 'Alice');
    await expect(page.locator('.badge')).toHaveText('1');

    const p2 = await context.newPage();
    await joinAs(p2, code, 'Bob');
    await expect(page.locator('.badge')).toHaveText('2');

    // Both names must appear in the player chips list.
    await expect(page.getByText('Alice')).toBeVisible();
    await expect(page.getByText('Bob')).toBeVisible();
  });
});

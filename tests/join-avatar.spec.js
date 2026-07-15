import { test, expect } from '@playwright/test';
import { hostSeededQuiz, seedQuiz } from './helpers.js';

// ---------------------------------------------------------------------------
// Join screen — flows not covered in join.spec.js
//   • Custom avatar (emoji) picker selection
//   • Persisted name is pre-filled on a subsequent join attempt
//   • "← Home" navigates back from the join screen
//   • Room-ended / not-found state on the join page
//   • Joining a game that is already in progress redirects straight to /play
// ---------------------------------------------------------------------------

test.describe('Join screen — avatar & UX', () => {
  // ── Avatar picker: selecting an emoji stores it in the room ──────────────
  test('player can pick a custom avatar that is stored in the room', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const player = await context.newPage();
    await player.goto(`/#/join/${code}`);

    // Pick the 🐼 emoji (aria-label="Pick 🐼").
    await player.getByRole('button', { name: 'Pick 🐼' }).click();
    // Confirm the selected chip gets the is-selected class.
    await expect(player.locator('.emoji-chip.is-selected')).toHaveText('🐼');

    await player.getByLabel('Your nickname').fill('Panda');
    await player.getByRole('button', { name: /Join game/ }).click();

    // Check localStorage to confirm the emoji was persisted.
    const roomData = await page.evaluate((c) => {
      return JSON.parse(
        localStorage.getItem(`kahootlite:room:${c}`) || 'null'
      );
    }, code.toUpperCase());

    const panda = Object.values(roomData?.players ?? {}).find(
      (p) => p.name === 'Panda'
    );
    expect(panda).not.toBeNull();
    expect(panda.emoji).toBe('🐼');
  });

  // ── Last-used nickname is pre-filled via loadPrefs ────────────────────────
  test('previously used nickname is pre-filled in the join form', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    // Seed a name preference directly.
    await page.evaluate(() => {
      localStorage.setItem(
        'kahootlite:prefs',
        JSON.stringify({ name: 'PrefilledName' })
      );
    });

    const player = await context.newPage();
    // Player shares the same localStorage (same origin, same context).
    await player.evaluate(() => {
      localStorage.setItem(
        'kahootlite:prefs',
        JSON.stringify({ name: 'PrefilledName' })
      );
    });

    await player.goto(`/#/join/${code}`);
    await expect(player.getByLabel('Your nickname')).toHaveValue('PrefilledName');
  });

  // ── "← Home" navigates away from the join screen ─────────────────────────
  test('"← Home" button on the join page navigates to the home screen', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const player = await context.newPage();
    await player.goto(`/#/join/${code}`);
    await player.getByRole('button', { name: /← Home/i }).click();

    await expect(player).toHaveURL(/\/?#?(?:\/)?$/);
    await expect(player.getByRole('heading', { name: /KahootLite/i })).toBeVisible();
  });

  // ── Joining a game already in progress redirects to /play ─────────────────
  test('joining a room that is already playing redirects immediately to /play', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    // A first player joins so the lobby isn't empty, then the host starts.
    const first = await context.newPage();
    await first.goto(`/#/join/${code}`);
    await first.getByLabel('Your nickname').fill('First');
    await first.getByRole('button', { name: /Join game/ }).click();
    await expect(first.getByText(/Waiting for the host/i)).toBeVisible();

    // Host starts the game.
    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(page.getByText('Capital of France?')).toBeVisible();

    // A late-joining player opens the join page while game is in progress.
    const late = await context.newPage();
    await late.goto(`/#/join/${code}`);
    await late.getByLabel('Your nickname').fill('Late');
    await late.getByRole('button', { name: /Join game/ }).click();

    // Should land on /play since the game is already running.
    await expect(late).toHaveURL(new RegExp(`#/play/${code}`));
  });

  // ── Room ended / not-found message shown on join screen ──────────────────
  test('shows "Room not found" message when the room code does not exist', async ({
    page,
  }) => {
    // Navigate directly to a join URL with a non-existent code.
    await page.goto('/#/join/NOPE99');
    await expect(page.getByText(/Room NOPE99 not found/i)).toBeVisible();
    await expect(
      page.getByRole('button', { name: /← Home/i })
    ).toBeVisible();
  });
});

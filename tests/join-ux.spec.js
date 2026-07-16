import { test, expect } from '@playwright/test';
import { hostSeededQuiz, seedQuiz } from './helpers.js';

test.describe('Join screen – UX details', () => {
  test('player can select a custom emoji before joining', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const player = await context.newPage();
    await player.goto(`/#/join/${code}`);

    // Pick the panda emoji explicitly.
    await player.getByRole('button', { name: 'Pick 🐼' }).click();
    await expect(
      player.getByRole('button', { name: 'Pick 🐼' })
    ).toHaveClass(/is-selected/);

    // Fill nickname and join.
    await player.getByLabel('Your nickname').fill('PandaFan');
    await player.getByRole('button', { name: /Join game/ }).click();

    // After joining the play screen should show the selected emoji.
    await expect(player).toHaveURL(new RegExp(`#/play/${code}`));

    // Confirm the panda is stored for this player.
    const stored = await player.evaluate((roomKey) => {
      const room = JSON.parse(localStorage.getItem(roomKey) || 'null');
      return Object.values(room?.players ?? {}).find(
        (p) => p.name === 'PandaFan'
      );
    }, `kahootlite:room:${code}`);
    expect(stored).not.toBeNull();
    expect(stored.emoji).toBe('🐼');
  });

  test('nickname typed on join is pre-filled on next visit', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const player = await context.newPage();
    await player.goto(`/#/join/${code}`);
    await player.getByLabel('Your nickname').fill('ReturningPlayer');
    await player.getByRole('button', { name: /Join game/ }).click();
    await expect(player).toHaveURL(new RegExp(`#/play/${code}`));

    // Simulate another session by opening a fresh join page.
    // The app persists the name in kahootlite:prefs, so a new navigation
    // to the same origin should pre-fill it.
    const newSession = await context.newPage();
    await newSession.goto(`/#/join/${code}`);
    const nicknameInput = newSession.getByLabel('Your nickname');
    // The stored pref should have pre-filled the field.
    await expect(nicknameInput).toHaveValue('ReturningPlayer');
  });

  test('navigating to /#/join/ with no code shows a "no room code" message', async ({
    page,
  }) => {
    await page.goto('/#/join/');
    // The Join component renders the no-code guard when segments[1] is empty.
    await expect(page.getByText(/No room code provided/i)).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Home/i })
    ).toBeVisible();
  });

  test('"← Home" link on join screen navigates back to home', async ({
    page,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const player = await page.context().newPage();
    await player.goto(`/#/join/${code}`);
    await player.getByRole('button', { name: /← Home/i }).click();
    await expect(player).toHaveURL(/\/?#?\/?(|$)/);
    await expect(
      player.getByRole('heading', { name: /KahootLite/i })
    ).toBeVisible();
  });
});

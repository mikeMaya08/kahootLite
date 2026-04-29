import { test, expect } from '@playwright/test';
import { hostSeededQuiz, joinAs, seedQuiz } from './helpers';

// Each test uses one BrowserContext with multiple Pages — same origin, same
// localStorage, so the cross-tab `storage` event behaves exactly like real
// users running the app in two tabs of the same browser.

test.describe('Multiplayer simulation', () => {
  test('player join shows up live in the host lobby', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const player = await context.newPage();
    await joinAs(player, code, 'Alice');

    // Player tab now shows the waiting state.
    await expect(player.getByText(/Waiting for the host/i)).toBeVisible();

    // Host tab observes the new player via the storage event.
    await expect(page.getByText('Alice')).toBeVisible();
    await expect(page.locator('.badge')).toHaveText('1');
  });

  test('rejects a duplicate nickname in the same room', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const player1 = await context.newPage();
    await joinAs(player1, code, 'Bob');
    await expect(player1.getByText(/Waiting for the host/i)).toBeVisible();

    const player2 = await context.newPage();
    await player2.goto(`/#/join/${code}`);
    await player2.getByLabel('Your nickname').fill('Bob');
    await player2.getByRole('button', { name: /Join game/ }).click();

    await expect(
      player2.getByText(/nickname is already taken/i)
    ).toBeVisible();
  });

  test('a second tab on the host URL becomes a spectator, not a controller', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const otherHost = await context.newPage();
    await otherHost.goto(`/#/host/${code}`);
    await expect(
      otherHost.getByRole('heading', { name: /Spectator view/i })
    ).toBeVisible();
    await expect(
      otherHost.getByRole('button', { name: 'Start game' })
    ).toHaveCount(0);
  });

  test('full game flow — join, answer, reveal, results sync across tabs', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const alice = await context.newPage();
    await joinAs(alice, code, 'Alice');
    const bob = await context.newPage();
    await joinAs(bob, code, 'Bob');

    // Both players are visible in the lobby.
    await expect(page.getByText('Alice')).toBeVisible();
    await expect(page.getByText('Bob')).toBeVisible();

    // Host starts the game; player tabs jump to the question screen.
    await page.getByRole('button', { name: 'Start game' }).click();

    await expect(page.getByText('Capital of France?')).toBeVisible();
    await expect(alice.getByText('Capital of France?')).toBeVisible();
    await expect(bob.getByText('Capital of France?')).toBeVisible();

    // Alice picks Paris (correct), Bob picks Berlin (wrong).
    await alice.getByRole('button', { name: /Paris/ }).click();
    await expect(alice.getByText(/Locked in/i)).toBeVisible();
    await bob.getByRole('button', { name: /Berlin/ }).click();
    await expect(bob.getByText(/Locked in/i)).toBeVisible();

    // Host advances to reveal manually (avoids waiting on the timer).
    await page.getByRole('button', { name: 'Reveal answer' }).click();

    await expect(alice.getByText(/✓ Correct!/)).toBeVisible();
    await expect(bob.getByText(/Not this time/)).toBeVisible();

    // Last (and only) question — host finalizes results.
    await page
      .getByRole('button', { name: /See final results →/ })
      .click();

    await expect(
      page.getByRole('heading', { name: /Final results/ })
    ).toBeVisible();
    await expect(
      alice.getByRole('heading', { name: /Game over/ })
    ).toBeVisible();
    await expect(
      bob.getByRole('heading', { name: /Game over/ })
    ).toBeVisible();

    // Alice should be ranked above Bob.
    const aliceScore = Number(
      await page
        .locator('.lb-row', { hasText: 'Alice' })
        .locator('.lb-score')
        .innerText()
    );
    const bobScore = Number(
      await page
        .locator('.lb-row', { hasText: 'Bob' })
        .locator('.lb-score')
        .innerText()
    );
    expect(aliceScore).toBeGreaterThan(0);
    expect(bobScore).toBe(0);
    expect(aliceScore).toBeGreaterThan(bobScore); // fixed: was bobScore > aliceScore

    // Alice's row should be highlighted as "self" in her own tab.
    await expect(
      alice.locator('.lb-row-self', { hasText: 'Alice' })
    ).toBeVisible();
  });

  test('answers cannot be changed once submitted', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const player = await context.newPage();
    await joinAs(player, code, 'Carla');

    await page.getByRole('button', { name: 'Start game' }).click();

    const paris = player.getByRole('button', { name: /Paris/ });
    const berlin = player.getByRole('button', { name: /Berlin/ });

    await paris.click();
    await expect(player.getByText(/Locked in/i)).toBeVisible();

    // All answer buttons are disabled after the first selection.
    await expect(paris).toBeDisabled();
    await expect(berlin).toBeDisabled();
  });
});

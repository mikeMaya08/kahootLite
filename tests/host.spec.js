import { test, expect } from '@playwright/test';
import { hostSeededQuiz, joinAs, seedQuiz, SAMPLE_QUIZ } from './helpers';

// A multi-question quiz used by several tests below.
const MULTI_QUIZ = {
  id: 'quiz-multi-1',
  title: 'Multi Question Quiz',
  questions: [
    {
      id: 'q-1',
      text: 'Capital of France?',
      options: ['Paris', 'Berlin', 'Madrid', 'Rome'],
      correctIndex: 0,
      timeLimit: 30,
    },
    {
      id: 'q-2',
      text: 'Capital of Germany?',
      options: ['Munich', 'Berlin', 'Frankfurt', 'Hamburg'],
      correctIndex: 1,
      timeLimit: 30,
    },
  ],
  createdAt: 0,
  updatedAt: 0,
};

test.describe('Host page', () => {
  test('host can navigate through multiple questions with "Next question →"', async ({
    page,
    context,
  }) => {
    // Seed a 2-question quiz and open a lobby.
    await page.goto('/');
    await page.evaluate((q) => {
      localStorage.setItem('kahootlite:quizzes', JSON.stringify([q]));
    }, MULTI_QUIZ);

    await page.goto('/#/quizzes');
    await page.getByRole('button', { name: /Host →/ }).click();
    await page.waitForURL(/#\/host\//);

    // A player joins.
    const player = await context.newPage();
    const code = (await page.locator('.big-code').first().innerText()).trim();
    await joinAs(player, code, 'Alice');

    // Start game — Q1 appears on host.
    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(page.getByText('Capital of France?')).toBeVisible();
    await expect(page.getByText('Q 1 / 2', { exact: false })).toBeVisible();

    // Reveal answer — host now sees "Next question →".
    await page.getByRole('button', { name: 'Reveal answer' }).click();
    await expect(
      page.getByRole('button', { name: 'Next question →' })
    ).toBeVisible();

    // Advance to Q2.
    await page.getByRole('button', { name: 'Next question →' }).click();
    await expect(page.getByText('Capital of Germany?')).toBeVisible();
    await expect(page.getByText('Q 2 / 2', { exact: false })).toBeVisible();

    // Reveal Q2 — now the last question, so "See final results →" appears.
    await page.getByRole('button', { name: 'Reveal answer' }).click();
    await expect(
      page.getByRole('button', { name: 'See final results →' })
    ).toBeVisible();
  });

  test('"Play again" resets scores and returns host to lobby', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const player = await context.newPage();
    await joinAs(player, code, 'Alice');

    // Play through the whole game.
    await page.getByRole('button', { name: 'Start game' }).click();
    await player.getByRole('button', { name: 'Paris' }).click();
    await page.getByRole('button', { name: 'Reveal answer' }).click();
    await page.getByRole('button', { name: 'See final results →' }).click();

    // Host sees the final results screen with a "Play again" button.
    await expect(
      page.getByRole('heading', { name: /Final results/i })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Play again/i })
    ).toBeVisible();

    // Click "Play again" — host should return to the lobby.
    await page.getByRole('button', { name: /Play again/i }).click();
    await expect(
      page.getByRole('button', { name: 'Start game' })
    ).toBeVisible();

    // Alice's player tile should still be listed (same room, same players).
    await expect(page.getByText('Alice')).toBeVisible();

    // The "Play again" reset should have zeroed Alice's score in storage.
    const storedRoom = await page.evaluate((roomKey) => {
      return JSON.parse(localStorage.getItem(roomKey) || 'null');
    }, `kahootlite:room:${code}`);
    const alice = Object.values(storedRoom.players).find(
      (p) => p.name === 'Alice'
    );
    expect(alice.score).toBe(0);
    expect(alice.streak).toBe(0);
  });

  test('starting with no players shows a confirmation dialog', async ({
    page,
  }) => {
    await seedQuiz(page);
    await hostSeededQuiz(page);

    // Intercept the confirm dialog and accept it.
    page.on('dialog', (d) => d.accept());

    // No player has joined; clicking Start game should trigger the dialog.
    await page.getByRole('button', { name: 'Start game' }).click();

    // After accepting, the game should start (question appears on host).
    await expect(page.getByText('Capital of France?')).toBeVisible();
  });

  test('"Copy join link" button is visible in the lobby', async ({ page }) => {
    await seedQuiz(page);
    await hostSeededQuiz(page);

    // The copy-link button should be present in the lobby card.
    await expect(
      page.getByRole('button', { name: /Copy join link/i })
    ).toBeVisible();
  });

  test('host "← End room" button navigates back to home', async ({ page }) => {
    await seedQuiz(page);
    await hostSeededQuiz(page);

    // Accept the confirm dialog that deleteRoom triggers.
    page.on('dialog', (d) => d.accept());

    await page.getByRole('button', { name: /← End room/i }).click();
    await expect(page).toHaveURL(/\/?#?\/?(|$)/);
    await expect(
      page.getByRole('heading', { name: /KahootLite/i })
    ).toBeVisible();
  });
});

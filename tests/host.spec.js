import { test, expect } from '@playwright/test';
import { hostSeededQuiz, joinAs, seedQuiz } from './helpers';

// Multi-question quiz used across host tests.
const TWO_Q_QUIZ = {
  id: 'quiz-host-tests',
  title: 'Host Test Quiz',
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
      options: ['Vienna', 'Berlin', 'Bern', 'Prague'],
      correctIndex: 1,
      timeLimit: 30,
    },
  ],
  createdAt: 0,
  updatedAt: 0,
};

async function seedAndHost(page, quiz = TWO_Q_QUIZ) {
  await page.goto('/');
  await page.evaluate((q) => {
    localStorage.setItem('kahootlite:quizzes', JSON.stringify([q]));
  }, quiz);
  await page.goto('/#/quizzes');
  await page.getByRole('button', { name: /Host →/ }).click();
  await page.waitForURL(/#\/host\//);
  const code = (await page.locator('.big-code').first().innerText()).trim();
  return code;
}

test.describe('Host flow', () => {
  test('multi-question: host can advance through all questions to final results', async ({
    page,
    context,
  }) => {
    const code = await seedAndHost(page);

    const player = await context.newPage();
    await joinAs(player, code, 'Alice');

    // Start game – Q1
    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(page.getByText('Capital of France?')).toBeVisible();
    await expect(player.getByText('Capital of France?')).toBeVisible();

    // Alice answers Q1
    await player.getByRole('button', { name: 'Paris' }).click();
    await page.getByRole('button', { name: 'Reveal answer' }).click();

    // Host advances to Q2
    await page.getByRole('button', { name: 'Next question →' }).click();
    await expect(page.getByText('Capital of Germany?')).toBeVisible();
    await expect(player.getByText('Capital of Germany?')).toBeVisible();

    // Alice answers Q2
    await player.getByRole('button', { name: 'Berlin' }).click();
    await page.getByRole('button', { name: 'Reveal answer' }).click();

    // Last question → final results
    await page.getByRole('button', { name: 'See final results →' }).click();
    await expect(page.getByRole('heading', { name: /Final results/i })).toBeVisible();
    await expect(player.getByRole('heading', { name: /Game over/i })).toBeVisible();
  });

  test('timer auto-expiry triggers reveal without host clicking "Reveal answer"', async ({
    page,
    context,
  }) => {
    // Use a very short time limit so the timer fires quickly in the test.
    const shortQuiz = {
      ...TWO_Q_QUIZ,
      id: 'quiz-timer-test',
      questions: [
        { ...TWO_Q_QUIZ.questions[0], timeLimit: 2 },
      ],
    };
    await page.goto('/');
    await page.evaluate((q) => {
      localStorage.setItem('kahootlite:quizzes', JSON.stringify([q]));
    }, shortQuiz);
    await page.goto('/#/quizzes');
    await page.getByRole('button', { name: /Host →/ }).click();
    await page.waitForURL(/#\/host\//);
    const code = (await page.locator('.big-code').first().innerText()).trim();

    const player = await context.newPage();
    await joinAs(player, code, 'Alice');

    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(page.getByText('Capital of France?')).toBeVisible();

    // Wait for the timer to auto-expire (2 s + buffer).
    // The host's Timer fires onExpire → goToReveal.
    await expect(
      page.getByRole('button', { name: 'See final results →' })
    ).toBeVisible({ timeout: 8_000 });

    // Player should see "Out of time" since they never answered.
    await expect(player.getByText(/Out of time/i)).toBeVisible({ timeout: 8_000 });
  });

  test('"Play again" resets scores and returns all players to lobby', async ({
    page,
    context,
  }) => {
    const code = await seedAndHost(page);

    const player = await context.newPage();
    await joinAs(player, code, 'Alice');

    // Play through the full game
    await page.getByRole('button', { name: 'Start game' }).click();
    await player.getByRole('button', { name: 'Paris' }).click();
    await page.getByRole('button', { name: 'Reveal answer' }).click();
    await page.getByRole('button', { name: 'Next question →' }).click();
    await player.getByRole('button', { name: 'Berlin' }).click();
    await page.getByRole('button', { name: 'Reveal answer' }).click();
    await page.getByRole('button', { name: 'See final results →' }).click();
    await expect(page.getByRole('heading', { name: /Final results/i })).toBeVisible();

    // Host clicks "Play again"
    await page.getByRole('button', { name: 'Play again' }).click();

    // Host should be back in the lobby with the same players listed
    await expect(page.getByRole('button', { name: 'Start game' })).toBeVisible();
    await expect(page.getByText('Alice')).toBeVisible();

    // Player should be back on the waiting screen
    await expect(player.getByText(/Waiting for the host/i)).toBeVisible();
  });

  test('"End room" deletes the room and host returns to home page', async ({
    page,
    context,
  }) => {
    const code = await seedAndHost(page);
    const player = await context.newPage();
    await joinAs(player, code, 'Alice');

    // Host plays through and ends the game
    await page.getByRole('button', { name: 'Start game' }).click();
    await page.getByRole('button', { name: 'Reveal answer' }).click();
    await page.getByRole('button', { name: 'Next question →' }).click();
    await page.getByRole('button', { name: 'Reveal answer' }).click();
    await page.getByRole('button', { name: 'See final results →' }).click();

    // Accept the confirm dialog then click "End room"
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'End room' }).click();

    // Host is redirected home
    await expect(page).toHaveURL(/\/#?\/?$/);
    await expect(page.getByText(/KahootLite/i)).toBeVisible();
  });

  test('starting with zero players shows confirm dialog and still launches', async ({
    page,
  }) => {
    const code = await seedAndHost(page);

    // Accept the "No players yet" confirm and start anyway
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Start game' }).click();

    // Game should advance to the first question
    await expect(page.getByText('Capital of France?')).toBeVisible();
  });

  test('host leaderboard shows standings after each reveal', async ({
    page,
    context,
  }) => {
    const code = await seedAndHost(page);
    const player = await context.newPage();
    await joinAs(player, code, 'Alice');

    await page.getByRole('button', { name: 'Start game' }).click();
    await player.getByRole('button', { name: 'Paris' }).click();
    await page.getByRole('button', { name: 'Reveal answer' }).click();

    // After reveal the host sees a standings card
    await expect(page.getByRole('heading', { name: /Standings/i })).toBeVisible();
    await expect(page.locator('.lb-row', { hasText: 'Alice' })).toBeVisible();
  });
});

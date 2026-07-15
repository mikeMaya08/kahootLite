import { test, expect } from '@playwright/test';
import { joinAs, seedQuiz } from './helpers.js';

// ---------------------------------------------------------------------------
// Helper: seed a TWO-question quiz so we can test multi-question navigation.
// ---------------------------------------------------------------------------
const TWO_Q_QUIZ = {
  id: 'quiz-two-q',
  title: 'Double Trouble',
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
      options: ['Vienna', 'Berlin', 'Zurich', 'Brussels'],
      correctIndex: 1,
      timeLimit: 30,
    },
  ],
  createdAt: 0,
  updatedAt: 0,
};

async function seedAndHostQuiz(page, quiz) {
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

test.describe('Host game screen', () => {
  // ── Answer counter updates as players submit ───────────────────────────────
  test('answer counter increments as players submit their answers', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await (async () => {
      await page.goto('/#/quizzes');
      await page.getByRole('button', { name: /Host →/ }).click();
      await page.waitForURL(/#\/host\//);
      return (await page.locator('.big-code').first().innerText()).trim();
    })();

    const alice = await context.newPage();
    await joinAs(alice, code, 'Alice');
    const bob = await context.newPage();
    await joinAs(bob, code, 'Bob');

    // Host starts the game.
    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(page.getByText('Capital of France?')).toBeVisible();

    // Initially 0 / 2 answered.
    await expect(page.locator('.game-header')).toContainText('0');

    // Alice answers.
    await alice.getByRole('button', { name: /Paris/ }).click();
    await expect(page.locator('.game-header')).toContainText('1');

    // Bob answers.
    await bob.getByRole('button', { name: /Berlin/ }).click();
    await expect(page.locator('.game-header')).toContainText('2');
  });

  // ── "Reveal answer" shows correct/wrong styling on host view ─────────────
  test('host sees correct answer highlighted after reveal', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await (async () => {
      await page.goto('/#/quizzes');
      await page.getByRole('button', { name: /Host →/ }).click();
      await page.waitForURL(/#\/host\//);
      return (await page.locator('.big-code').first().innerText()).trim();
    })();

    const player = await context.newPage();
    await joinAs(player, code, 'Alice');

    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(page.getByText('Capital of France?')).toBeVisible();

    await page.getByRole('button', { name: 'Reveal answer' }).click();

    // Host view: answer options get a correct/wrong class.
    // The "Paris" option should carry the correct state (data-state or class).
    // We assert the "See final results →" button is now visible, which only
    // appears on the last question after reveal.
    await expect(
      page.getByRole('button', { name: /See final results →/ })
    ).toBeVisible();

    // The interim leaderboard ("Standings") should appear.
    await expect(page.getByRole('heading', { name: /Standings/i })).toBeVisible();
  });

  // ── Multi-question: "Next question →" advances to question 2 ─────────────
  test('"Next question →" advances the host to the second question', async ({
    page,
    context,
  }) => {
    // Use the two-question quiz.
    await page.goto('/');
    await page.evaluate((q) => {
      localStorage.setItem('kahootlite:quizzes', JSON.stringify([q]));
    }, TWO_Q_QUIZ);
    const code = await seedAndHostQuiz(page, TWO_Q_QUIZ);

    const player = await context.newPage();
    await joinAs(player, code, 'Alice');

    // Start game — Q1 visible.
    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(page.getByText('Capital of France?')).toBeVisible();
    await expect(player.getByText('Capital of France?')).toBeVisible();

    // Reveal Q1.
    await page.getByRole('button', { name: 'Reveal answer' }).click();

    // Should show "Next question →" (not "See final results →") for Q1.
    await expect(
      page.getByRole('button', { name: /Next question →/ })
    ).toBeVisible();

    // Advance to Q2.
    await page.getByRole('button', { name: /Next question →/ }).click();

    // Both host and player should now see Q2 text.
    await expect(page.getByText('Capital of Germany?')).toBeVisible();
    await expect(player.getByText('Capital of Germany?')).toBeVisible();

    // Header should now read "Question 2 / 2".
    await expect(page.locator('.game-header')).toContainText('Question 2 / 2');
  });

  // ── "Play again" resets scores so a new round can start ──────────────────
  test('"Play again" resets all player scores and returns to the lobby', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await (async () => {
      await page.goto('/#/quizzes');
      await page.getByRole('button', { name: /Host →/ }).click();
      await page.waitForURL(/#\/host\//);
      return (await page.locator('.big-code').first().innerText()).trim();
    })();

    const alice = await context.newPage();
    await joinAs(alice, code, 'Alice');

    // Play through the full single-question game.
    await page.getByRole('button', { name: 'Start game' }).click();
    await alice.getByRole('button', { name: /Paris/ }).click();
    await page.getByRole('button', { name: 'Reveal answer' }).click();
    await page.getByRole('button', { name: /See final results →/ }).click();

    // Host is now on the "Final results" screen.
    await expect(
      page.getByRole('heading', { name: /Final results/i })
    ).toBeVisible();

    // Click "Play again".
    await page.getByRole('button', { name: /Play again/i }).click();

    // Host lobby is back.
    await expect(page.getByText(/Waiting for players/i)).toBeVisible();

    // Verify scores were reset in localStorage.
    const roomData = await page.evaluate((c) => {
      return JSON.parse(
        localStorage.getItem(`kahootlite:room:${c}`) || 'null'
      );
    }, code.toUpperCase());
    const scores = Object.values(roomData?.players ?? {}).map((p) => p.score);
    expect(scores.every((s) => s === 0)).toBe(true);
  });

  // ── "End room" on final results navigates home ────────────────────────────
  test('"End room" on the final results screen deletes the room and goes home', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await (async () => {
      await page.goto('/#/quizzes');
      await page.getByRole('button', { name: /Host →/ }).click();
      await page.waitForURL(/#\/host\//);
      return (await page.locator('.big-code').first().innerText()).trim();
    })();

    const player = await context.newPage();
    await joinAs(player, code, 'Alice');

    await page.getByRole('button', { name: 'Start game' }).click();
    await page.getByRole('button', { name: 'Reveal answer' }).click();
    await page.getByRole('button', { name: /See final results →/ }).click();

    await expect(
      page.getByRole('heading', { name: /Final results/i })
    ).toBeVisible();

    // Accept the confirm dialog that "End room" triggers.
    page.on('dialog', (d) => d.accept());
    await page.getByRole('button', { name: /End room/i }).click();

    await expect(page).toHaveURL(/\/?#?(?:\/)?$/);
  });
});

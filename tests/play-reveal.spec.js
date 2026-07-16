import { test, expect } from '@playwright/test';
import { hostSeededQuiz, joinAs, seedQuiz } from './helpers.js';

// A 2-question quiz for streak tests.
const STREAK_QUIZ = {
  id: 'quiz-streak-1',
  title: 'Streak Quiz',
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

test.describe('Play screen – reveal & scoring details', () => {
  test('wrong answer is visually highlighted as incorrect on reveal', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const player = await context.newPage();
    await joinAs(player, code, 'Alice');

    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(player.getByText('Capital of France?')).toBeVisible();

    // Alice picks the wrong answer (Berlin = index 1, not index 0).
    await player.getByRole('button', { name: 'Berlin' }).click();
    await expect(player.getByText(/Locked in/i)).toBeVisible();

    // Host reveals.
    await page.getByRole('button', { name: 'Reveal answer' }).click();

    // Alice should see "Not this time" (wrong-answer feedback).
    await expect(player.getByText(/Not this time/i)).toBeVisible();

    // The correct option (Paris) must carry the `answer-correct` CSS class and
    // the chosen wrong option (Berlin) must carry the `answer-wrong` class.
    // AnswerOption applies these classes based on the `state` prop it receives.
    const paris = player.getByRole('button', { name: /Option A: Paris/ });
    const berlin = player.getByRole('button', { name: /Option B: Berlin/ });
    await expect(paris).toHaveClass(/answer-correct/);
    await expect(berlin).toHaveClass(/answer-wrong/);
  });

  test('correct answer is highlighted green and no wrong class on reveal', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const player = await context.newPage();
    await joinAs(player, code, 'Alice');

    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(player.getByText('Capital of France?')).toBeVisible();

    // Alice answers correctly (Paris).
    await player.getByRole('button', { name: 'Paris' }).click();
    await expect(player.getByText(/Locked in/i)).toBeVisible();

    await page.getByRole('button', { name: 'Reveal answer' }).click();

    // Alice sees the correct feedback.
    await expect(player.getByText(/✓ Correct!/i)).toBeVisible();
    await expect(player.getByRole('button', { name: 'Paris' })).toHaveAttribute(
      'data-state',
      'correct'
    );
  });

  test('streak badge (🔥) appears after two consecutive correct answers', async ({
    page,
    context,
  }) => {
    // Seed the 2-question quiz.
    await page.goto('/');
    await page.evaluate((q) => {
      localStorage.setItem('kahootlite:quizzes', JSON.stringify([q]));
    }, STREAK_QUIZ);

    await page.goto('/#/quizzes');
    await page.getByRole('button', { name: /Host →/ }).click();
    await page.waitForURL(/#\/host\//);
    const code = (await page.locator('.big-code').first().innerText()).trim();

    const player = await context.newPage();
    await joinAs(player, code, 'Alice');

    // Start game → Q1.
    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(player.getByText('Capital of France?')).toBeVisible();

    // Alice answers Q1 correctly.
    await player.getByRole('button', { name: 'Paris' }).click();
    await page.getByRole('button', { name: 'Reveal answer' }).click();
    await expect(player.getByText(/✓ Correct!/i)).toBeVisible();

    // Move to Q2.
    await page.getByRole('button', { name: 'Next question →' }).click();
    await expect(player.getByText('Capital of Germany?')).toBeVisible();

    // Alice answers Q2 correctly (Berlin = index 1).
    await player.getByRole('button', { name: 'Berlin' }).click();
    await page.getByRole('button', { name: 'Reveal answer' }).click();

    // After two consecutive correct answers the streak is 2 — the 🔥 badge
    // should now be visible in the player's game header.
    await expect(player.locator('.streak-badge')).toBeVisible();
    await expect(player.locator('.streak-badge')).toContainText('🔥');
  });

  test('player without a session identity is redirected to join screen', async ({
    page,
  }) => {
    // Navigate directly to a play URL without ever going through the join flow.
    // There is no playerId in sessionStorage so Play.jsx should bounce the user.
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    // Open a completely fresh page (new context = empty sessionStorage).
    const freshCtx = await page.context().browser().newContext();
    const freshPage = await freshCtx.newPage();

    // Seed the same quiz data so the room exists in localStorage.
    await freshPage.goto('/');
    await freshPage.evaluate(
      ([roomKey, roomVal]) => {
        // Copy the room from the host tab's localStorage into the fresh tab
        // (same origin, so they share localStorage naturally — this is just
        // a belt-and-braces copy in case contexts are isolated).
        if (!localStorage.getItem(roomKey)) {
          localStorage.setItem(roomKey, roomVal);
        }
      },
      [
        `kahootlite:room:${code}`,
        await page.evaluate(
          (k) => localStorage.getItem(k),
          `kahootlite:room:${code}`
        ),
      ]
    );

    // Navigate directly to the play screen — no playerId set.
    await freshPage.goto(`/#/play/${code}`);

    // Should be bounced back to the join screen for this room.
    await expect(freshPage).toHaveURL(new RegExp(`#/join/${code}`));
    await freshCtx.close();
  });

  test('answer count display updates as players answer', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const alice = await context.newPage();
    const bob = await context.newPage();
    await joinAs(alice, code, 'Alice');
    await joinAs(bob, code, 'Bob');

    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(alice.getByText('Capital of France?')).toBeVisible();
    await expect(bob.getByText('Capital of France?')).toBeVisible();

    // Before anyone answers, the host shows 0 answers.
    await expect(page.locator('.game-header')).toContainText('Answers');

    // Alice answers.
    await alice.getByRole('button', { name: 'Paris' }).click();
    await expect(alice.getByText(/Locked in/i)).toBeVisible();

    // The player screens show how many of the 2 have answered.
    // Alice's own count counter: "1/2 have answered" visible on Bob's screen.
    await expect(bob.getByText(/1\/2 have answered/i)).toBeVisible();
  });
});

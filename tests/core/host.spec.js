import { test, expect } from '@playwright/test';
import { hostSeededQuiz, joinAs, seedQuiz, SAMPLE_QUIZ } from '../helpers';

// A two-question quiz for scenarios that need navigation between questions.
const TWO_Q_QUIZ = {
  id: 'quiz-host-2q',
  title: 'Host Test Quiz',
  questions: [
    {
      id: 'hq-1',
      text: 'Capital of France?',
      options: ['Paris', 'Berlin', 'Madrid', 'Rome'],
      correctIndex: 0,
      timeLimit: 30,
    },
    {
      id: 'hq-2',
      text: 'Capital of Germany?',
      options: ['Vienna', 'Berlin', 'Bern', 'Brussels'],
      correctIndex: 1,
      timeLimit: 30,
    },
  ],
  createdAt: 0,
  updatedAt: 0,
};

// A quiz with no questions — used to test the disabled Start game button.
const EMPTY_QUIZ = {
  id: 'quiz-host-empty',
  title: 'Empty Quiz',
  questions: [],
  createdAt: 0,
  updatedAt: 0,
};

// Shorthand: Alice joins and answers Paris (correct for SAMPLE_QUIZ / TWO_Q_QUIZ Q1).
async function aliceAnswersParis(context, code) {
  const alice = await context.newPage();
  await joinAs(alice, code, 'Alice');
  return alice;
}

test.describe('Host screen — Lobby', () => {
  test(
    'shows the game PIN and quiz title in the lobby',
    { tag: ['@host', '@smoke', '@ui'] },
    async ({ page }) => {
      await seedQuiz(page);
      const code = await hostSeededQuiz(page);

      await expect(page.locator('.big-code')).toHaveText(code);
      await expect(
        page.getByRole('heading', { name: SAMPLE_QUIZ.title })
      ).toBeVisible();
      await expect(page.getByText(/Game PIN/i)).toBeVisible();
    }
  );

  test(
    'player count badge starts at 0 with waiting message',
    { tag: ['@host', '@ui'] },
    async ({ page }) => {
      await seedQuiz(page);
      await hostSeededQuiz(page);

      await expect(page.locator('.badge')).toHaveText('0');
      await expect(page.getByText(/Waiting for players/i)).toBeVisible();
    }
  );

  test(
    'badge updates live as players join',
    { tag: ['@host', '@smoke', '@e2e'] },
    async ({ page, context }) => {
      await seedQuiz(page);
      const code = await hostSeededQuiz(page);

      const alice = await context.newPage();
      await joinAs(alice, code, 'Alice');
      await expect(page.locator('.badge')).toHaveText('1');

      const bob = await context.newPage();
      await joinAs(bob, code, 'Bob');
      await expect(page.locator('.badge')).toHaveText('2');
    }
  );

  test(
    '"Copy join link" button is visible in the lobby',
    { tag: ['@host', '@ui'] },
    async ({ page }) => {
      await seedQuiz(page);
      await hostSeededQuiz(page);

      await expect(
        page.getByRole('button', { name: /Copy join link/i })
      ).toBeVisible();
    }
  );

  test(
    '"Start game" is disabled when the quiz has no questions',
    { tag: ['@host', '@validation'] },
    async ({ page }) => {
      await seedQuiz(page, EMPTY_QUIZ);
      await page.goto('/#/quizzes');
      await page.getByRole('button', { name: /Host →/ }).click();
      await page.waitForURL(/#\/host\//);

      await expect(
        page.getByRole('button', { name: 'Start game' })
      ).toBeDisabled();
    }
  );
});

test.describe('Host screen — Game start', () => {
  test(
    'question text and progress indicator appear after starting',
    { tag: ['@host', '@smoke', '@e2e'] },
    async ({ page, context }) => {
      await seedQuiz(page);
      const code = await hostSeededQuiz(page);
      await aliceAnswersParis(context, code);

      await page.getByRole('button', { name: 'Start game' }).click();

      await expect(
        page.getByText('Capital of France?')
      ).toBeVisible();
      await expect(page.locator('.game-header')).toContainText('Question 1 / 1');
    }
  );

  test(
    'answer count tracker updates as players submit',
    { tag: ['@host', '@smoke', '@e2e'] },
    async ({ page, context }) => {
      await seedQuiz(page);
      const code = await hostSeededQuiz(page);
      const alice = await aliceAnswersParis(context, code);

      await page.getByRole('button', { name: 'Start game' }).click();
      await expect(page.locator('.game-header')).toContainText('Answers 0 / 1');

      await alice.getByRole('button', { name: /Paris/ }).click();
      await expect(alice.getByText(/Locked in/i)).toBeVisible();
      await expect(page.locator('.game-header')).toContainText('Answers 1 / 1');
    }
  );

  test(
    '"Reveal answer" button is visible during the playing phase',
    { tag: ['@host', '@ui'] },
    async ({ page }) => {
      await seedQuiz(page);
      await hostSeededQuiz(page);
      await page.getByRole('button', { name: 'Start game' }).click();

      await expect(
        page.getByRole('button', { name: 'Reveal answer' })
      ).toBeVisible();
    }
  );
});

test.describe('Host screen — Reveal', () => {
  test(
    'correct option is highlighted and "Reveal answer" disappears after reveal',
    { tag: ['@host', '@smoke', '@e2e'] },
    async ({ page, context }) => {
      await seedQuiz(page);
      const code = await hostSeededQuiz(page);
      const alice = await aliceAnswersParis(context, code);

      await page.getByRole('button', { name: 'Start game' }).click();
      await alice.getByRole('button', { name: /Paris/ }).click();
      await page.getByRole('button', { name: 'Reveal answer' }).click();

      // The correct answer option gets the "correct" state.
      await expect(
        page.locator('.answer-option.correct, [data-state="correct"]').first()
      ).toBeVisible();

      // "Reveal answer" is gone; "See final results" takes its place.
      await expect(
        page.getByRole('button', { name: 'Reveal answer' })
      ).toHaveCount(0);
      await expect(
        page.getByRole('button', { name: /See final results/ })
      ).toBeVisible();
    }
  );

  test(
    'standings section appears below the answer grid after reveal',
    { tag: ['@host', '@ui'] },
    async ({ page }) => {
      await seedQuiz(page);
      await hostSeededQuiz(page);
      await page.getByRole('button', { name: 'Start game' }).click();
      await page.getByRole('button', { name: 'Reveal answer' }).click();

      await expect(
        page.getByRole('heading', { name: /Standings/i })
      ).toBeVisible();
    }
  );
});

test.describe('Host screen — Multi-question navigation', () => {
  test(
    '"Next question →" advances to Q2 and updates progress indicator',
    { tag: ['@host', '@smoke', '@e2e'] },
    async ({ page }) => {
      await seedQuiz(page, TWO_Q_QUIZ);
      await page.goto('/#/quizzes');
      await page.getByRole('button', { name: /Host →/ }).click();
      await page.waitForURL(/#\/host\//);

      await page.getByRole('button', { name: 'Start game' }).click();
      await expect(page.locator('.game-header')).toContainText('Question 1 / 2');

      await page.getByRole('button', { name: 'Reveal answer' }).click();
      await page.getByRole('button', { name: /Next question →/ }).click();

      await expect(page.getByText('Capital of Germany?')).toBeVisible();
      await expect(page.locator('.game-header')).toContainText('Question 2 / 2');
    }
  );

  test(
    'last question shows "See final results →" instead of "Next question →"',
    { tag: ['@host', '@ui'] },
    async ({ page }) => {
      await seedQuiz(page, TWO_Q_QUIZ);
      await page.goto('/#/quizzes');
      await page.getByRole('button', { name: /Host →/ }).click();
      await page.waitForURL(/#\/host\//);

      await page.getByRole('button', { name: 'Start game' }).click();
      await page.getByRole('button', { name: 'Reveal answer' }).click();
      await page.getByRole('button', { name: /Next question →/ }).click();

      // Now on Q2 (last) — reveal to show the final-results button.
      await page.getByRole('button', { name: 'Reveal answer' }).click();
      await expect(
        page.getByRole('button', { name: /See final results →/ })
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: /Next question →/ })
      ).toHaveCount(0);
    }
  );
});

test.describe('Host screen — Final results', () => {
  test(
    '"Final results" heading and leaderboard are visible after the game ends',
    { tag: ['@host', '@smoke', '@e2e'] },
    async ({ page, context }) => {
      await seedQuiz(page);
      const code = await hostSeededQuiz(page);
      await aliceAnswersParis(context, code);

      await page.getByRole('button', { name: 'Start game' }).click();
      await page.getByRole('button', { name: 'Reveal answer' }).click();
      await page.getByRole('button', { name: /See final results →/ }).click();

      await expect(
        page.getByRole('heading', { name: /Final results/i })
      ).toBeVisible();
      await expect(
        page.locator('.leaderboard, [class*="leaderboard"]').first()
      ).toBeVisible();
    }
  );

  test(
    'correct answerer has score > 0 on the final leaderboard',
    { tag: ['@host', '@smoke', '@e2e'] },
    async ({ page, context }) => {
      await seedQuiz(page);
      const code = await hostSeededQuiz(page);
      const alice = await aliceAnswersParis(context, code);

      await page.getByRole('button', { name: 'Start game' }).click();
      await alice.getByRole('button', { name: /Paris/ }).click();
      await expect(alice.getByText(/Locked in/i)).toBeVisible();

      await page.getByRole('button', { name: 'Reveal answer' }).click();
      await page.getByRole('button', { name: /See final results →/ }).click();

      const aliceScore = Number(
        await page
          .locator('.lb-row', { hasText: 'Alice' })
          .locator('.lb-score')
          .innerText()
      );
      expect(aliceScore).toBeGreaterThan(0);
    }
  );

  test(
    'player who never answered scores 0 on the final leaderboard',
    { tag: ['@host', '@validation'] },
    async ({ page, context }) => {
      await seedQuiz(page);
      const code = await hostSeededQuiz(page);
      await aliceAnswersParis(context, code); // joins but does NOT answer

      await page.getByRole('button', { name: 'Start game' }).click();
      // Host reveals immediately — Alice never submitted.
      await page.getByRole('button', { name: 'Reveal answer' }).click();
      await page.getByRole('button', { name: /See final results →/ }).click();

      const aliceScore = Number(
        await page
          .locator('.lb-row', { hasText: 'Alice' })
          .locator('.lb-score')
          .innerText()
      );
      expect(aliceScore).toBe(0);
    }
  );

  test(
    '"Play again" resets players to the lobby with zeroed scores',
    { tag: ['@host', '@smoke', '@e2e'] },
    async ({ page, context }) => {
      await seedQuiz(page);
      const code = await hostSeededQuiz(page);
      const alice = await aliceAnswersParis(context, code);

      await page.getByRole('button', { name: 'Start game' }).click();
      await alice.getByRole('button', { name: /Paris/ }).click();
      await expect(alice.getByText(/Locked in/i)).toBeVisible();

      await page.getByRole('button', { name: 'Reveal answer' }).click();
      await page.getByRole('button', { name: /See final results →/ }).click();
      await page.getByRole('button', { name: 'Play again' }).click();

      // Host is back in the lobby.
      await expect(
        page.getByRole('button', { name: 'Start game' })
      ).toBeVisible();
      await expect(page.locator('.badge')).toHaveText('1');

      // Alice's chip is still shown (she stayed in the room).
      await expect(page.locator('.chip', { hasText: 'Alice' })).toBeVisible();
    }
  );
});

test.describe('Host screen — End room & Spectator', () => {
  test(
    '"← End room" in the lobby confirms and navigates host home',
    { tag: ['@host', '@ui'] },
    async ({ page }) => {
      await seedQuiz(page);
      await hostSeededQuiz(page);

      page.on('dialog', (d) => d.accept());
      await page.getByRole('button', { name: /← End room/i }).click();
      await expect(page).toHaveURL(/\/?#?\/?/);
    }
  );

  test(
    '"End room" on the final results screen confirms and navigates home',
    { tag: ['@host', '@ui'] },
    async ({ page }) => {
      await seedQuiz(page);
      await hostSeededQuiz(page);

      await page.getByRole('button', { name: 'Start game' }).click();
      await page.getByRole('button', { name: 'Reveal answer' }).click();
      await page.getByRole('button', { name: /See final results →/ }).click();

      page.on('dialog', (d) => d.accept());
      await page.getByRole('button', { name: 'End room' }).click();
      await expect(page).toHaveURL(/\/?#?\/?/);
    }
  );

  test(
    'second tab on the host URL shows spectator view without game controls',
    { tag: ['@host', '@smoke', '@e2e'] },
    async ({ page, context }) => {
      await seedQuiz(page);
      const code = await hostSeededQuiz(page);

      const spectator = await context.newPage();
      await spectator.goto(`/#/host/${code}`);

      await expect(
        spectator.getByRole('heading', { name: /Spectator view/i })
      ).toBeVisible();
      await expect(
        spectator.getByRole('button', { name: 'Start game' })
      ).toHaveCount(0);
    }
  );

  test(
    'spectator tab shows the leaderboard while game is in progress',
    { tag: ['@host', '@ui', '@e2e'] },
    async ({ page, context }) => {
      await seedQuiz(page);
      const code = await hostSeededQuiz(page);
      const alice = await aliceAnswersParis(context, code);

      // Open spectator tab before the game starts.
      const spectator = await context.newPage();
      await spectator.goto(`/#/host/${code}`);
      await expect(
        spectator.getByRole('heading', { name: /Spectator view/i })
      ).toBeVisible();

      // Game progresses to reveal.
      await page.getByRole('button', { name: 'Start game' }).click();
      await alice.getByRole('button', { name: /Paris/ }).click();
      await page.getByRole('button', { name: 'Reveal answer' }).click();
      await page.getByRole('button', { name: /See final results →/ }).click();

      // Spectator's leaderboard should show Alice.
      await expect(
        spectator.locator('.leaderboard, [class*="leaderboard"]').first()
      ).toBeVisible();
    }
  );
});

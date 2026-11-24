import { test, expect } from '@playwright/test';
import { HomePage } from '../pages/HomePage.js';
import { QuizCreatorPage } from '../pages/QuizCreatorPage.js';
import { HostPage } from '../pages/HostPage.js';
import { PlayerPage } from '../pages/PlayerPage.js';

// One BrowserContext with several Pages shares localStorage, so the cross-tab
// `storage` event behaves like real users on different tabs of one browser.
// Each Page keeps its own sessionStorage, so every tab is a distinct host/player.

const QUIZ = {
  title: 'E2E World Quiz',
  questions: [
    {
      text: 'Capital of France?',
      options: ['Paris', 'Berlin', 'Madrid', 'Rome'],
      correctIndex: 0,
    },
    {
      text: 'Which planet is the largest?',
      options: ['Mars', 'Jupiter', 'Venus', 'Saturn'],
      correctIndex: 1,
    },
  ],
};

test.describe('Create → host → play → final leaderboard', () => {
  test(
    'a quiz built in the creator can be hosted and played by two players through to the final leaderboard',
    { tag: ['@e2e', '@multiplayer', '@smoke'] },
    async ({ page, context }) => {
      const home = new HomePage(page);
      const creator = new QuizCreatorPage(page);
      const host = new HostPage(page);

      // --- 1. Create a 2-question quiz from the home screen --------------
      await home.open();
      await home.startNewQuiz();
      await expect(page).toHaveURL(/#\/create/);
      await expect(creator.heading).toBeVisible();

      await creator.setTitle(QUIZ.title);
      await creator.fillQuestion(0, QUIZ.questions[0]);
      await creator.addQuestion();
      await expect(creator.questionEditors).toHaveCount(2);
      await creator.fillQuestion(1, QUIZ.questions[1]);

      // --- 2. Save & host → lobby with a fresh PIN ------------------------
      await creator.saveAndHost();
      await host.waitForLobby();
      await expect(page.getByRole('heading', { name: QUIZ.title })).toBeVisible();
      const pin = await host.getPin();
      expect(pin).toMatch(/^[A-Z0-9]{6}$/);

      // The quiz must be persisted in the library too.
      const stored = await page.evaluate(() =>
        JSON.parse(localStorage.getItem('kahootlite:quizzes') || '[]')
      );
      expect(stored.map((q) => q.title)).toContain(QUIZ.title);

      // --- 3. Two players join with the PIN from the home screen ---------
      const alice = await joinFromHome(context, pin, 'Alice');
      const bob = await joinFromHome(context, pin, 'Bob');

      await expect(alice.waitingMessage).toBeVisible();
      await expect(bob.waitingMessage).toBeVisible();
      await expect(host.playerChip('Alice')).toBeVisible();
      await expect(host.playerChip('Bob')).toBeVisible();

      // --- 4. Question 1: Alice correct, Bob wrong -----------------------
      await host.startGame();
      for (const p of [host, alice, bob]) {
        await expect(p.questionText('Capital of France?')).toBeVisible();
      }

      await alice.answer('Paris');
      await expect(alice.lockedInMessage).toBeVisible();
      await bob.answer('Berlin');
      await expect(bob.lockedInMessage).toBeVisible();

      await host.revealAnswer();
      await expect(alice.correctMessage).toBeVisible();
      await expect(bob.wrongMessage).toBeVisible();

      // --- 5. Question 2: both correct, Alice answers first --------------
      await host.nextQuestion();
      for (const p of [host, alice, bob]) {
        await expect(p.questionText('Which planet is the largest?')).toBeVisible();
      }

      await alice.answer('Jupiter');
      await expect(alice.lockedInMessage).toBeVisible();
      await bob.answer('Jupiter');
      await expect(bob.lockedInMessage).toBeVisible();

      await host.revealAnswer();
      await expect(alice.correctMessage).toBeVisible();
      await expect(bob.correctMessage).toBeVisible();

      // --- 6. Final leaderboard on every tab -----------------------------
      await host.showFinalResults();
      await expect(host.finalHeading).toBeVisible();
      await expect(alice.gameOverHeading).toBeVisible();
      await expect(bob.gameOverHeading).toBeVisible();

      // Alice was right on both questions, Bob only on one → she ranks first.
      await expect(host.leaderboardRows).toHaveCount(2);
      await expect(host.leaderboardRows.first()).toContainText('Alice');
      await expect(host.leaderboardRows.last()).toContainText('Bob');

      const aliceScore = await host.scoreOf('Alice');
      const bobScore = await host.scoreOf('Bob');
      expect(bobScore).toBeGreaterThan(0);
      expect(aliceScore).toBeGreaterThan(bobScore);

      // Each player sees their own rank and a highlighted "self" row.
      await expect(alice.rankCard).toContainText('#1');
      await expect(bob.rankCard).toContainText('#2');
      await expect(alice.selfRow).toContainText('Alice');
      await expect(bob.selfRow).toContainText('Bob');
    }
  );
});

// Opens a new tab, enters the PIN on the home screen and completes the join form.
async function joinFromHome(context, pin, name) {
  const playerTab = await context.newPage();
  const player = new PlayerPage(playerTab);
  await player.prepare();
  const home = new HomePage(playerTab);
  await home.open();
  await home.joinWithPin(pin);
  await expect(playerTab).toHaveURL(new RegExp(`#/join/${pin}`));
  await player.joinAs(name);
  return player;
}

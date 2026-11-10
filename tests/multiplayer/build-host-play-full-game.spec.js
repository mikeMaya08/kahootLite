import { test, expect } from '@playwright/test';
import { setBypassHeader } from '../helpers';
import { HomePage } from '../pages/HomePage';
import { QuizCreatorPage } from '../pages/QuizCreatorPage';
import { HostPage } from '../pages/HostPage';
import { PlayerPage } from '../pages/PlayerPage';

// One BrowserContext with several Pages shares localStorage (like tabs of the
// same browser), while sessionStorage stays per page, so each page is a
// distinct host/player identity.

const QUESTION_1 = {
  text: 'Capital of France?',
  options: ['Paris', 'Berlin', 'Madrid', 'Rome'],
  correctIndex: 0,
};

const QUESTION_2 = {
  text: 'Largest planet in our solar system?',
  options: ['Mercury', 'Venus', 'Jupiter', 'Saturn'],
  correctIndex: 2,
};

// Opens the app home in a fresh tab and joins the room as the given player.
async function joinGameFromHome(context, code, name) {
  const page = await context.newPage();
  await setBypassHeader(page);
  const home = new HomePage(page);
  await home.open();
  await home.joinWithCode(code);
  const player = new PlayerPage(page);
  await player.joinAs(name);
  return player;
}

test.describe('Full game journey', () => {
  test(
    'build a quiz, host it, and play a two-question game with two players',
    { tag: ['@multiplayer', '@e2e'] },
    async ({ page, context }) => {
      // --- Host builds a quiz from the home screen ---
      const home = new HomePage(page);
      await home.open();
      await home.startNewQuiz();

      const creator = new QuizCreatorPage(page);
      await creator.expectOpen();
      await creator.setTitle('Capitals and Planets');
      await creator.fillQuestion(1, QUESTION_1);
      await creator.addQuestion();
      await creator.fillQuestion(2, QUESTION_2);

      // --- Save & host opens the lobby with a PIN ---
      await creator.saveAndHost();
      const host = new HostPage(page);
      const code = await host.getPin();
      await host.expectPlayerCount(0);

      // --- Two players join using the PIN from the home screen ---
      const alice = await joinGameFromHome(context, code, 'Alice');
      const bob = await joinGameFromHome(context, code, 'Bob');

      await host.expectPlayerInLobby('Alice');
      await host.expectPlayerInLobby('Bob');
      await host.expectPlayerCount(2);

      // --- Question 1: Alice correct, Bob wrong ---
      await host.startGame();
      await host.expectQuestion(QUESTION_1.text);
      await alice.expectQuestion(QUESTION_1.text);
      await bob.expectQuestion(QUESTION_1.text);

      await alice.answer('Paris');
      await bob.answer('Berlin');

      // Manual reveal avoids waiting on the question timer.
      await host.revealAnswer();
      await alice.expectCorrect();
      await bob.expectIncorrect();

      // --- Question 2: both answer correctly (Alice first) ---
      await host.nextQuestion();
      await host.expectQuestion(QUESTION_2.text);
      await alice.expectQuestion(QUESTION_2.text);
      await bob.expectQuestion(QUESTION_2.text);

      await alice.answer('Jupiter');
      await bob.answer('Jupiter');

      await host.revealAnswer();
      await alice.expectCorrect();
      await bob.expectCorrect();

      // --- Final results sync to every tab ---
      await host.showFinalResults();
      await alice.expectGameOver();
      await bob.expectGameOver();

      // Alice answered both correctly, Bob only the second one.
      const aliceScore = await host.scoreOf('Alice');
      const bobScore = await host.scoreOf('Bob');
      expect(bobScore).toBeGreaterThan(0);
      expect(aliceScore).toBeGreaterThan(bobScore);

      // Leaderboard order: Alice first, Bob second.
      await expect(host.leaderboardRows.first()).toContainText('Alice');
      await expect(host.leaderboardRows.nth(1)).toContainText('Bob');

      // Alice's own row is highlighted in her tab.
      await expect(alice.selfRow).toContainText('Alice');
    }
  );
});

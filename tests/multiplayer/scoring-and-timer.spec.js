import { test, expect } from '@playwright/test';
import { hostSeededQuiz, seedQuiz } from '../helpers';
import { HostPage } from '../pages/HostPage';
import { PlayerPage } from '../pages/PlayerPage';

// Scoring rules (src/utils/scoring.js): a correct answer earns 500 base points
// plus a 0-500 speed bonus, plus 50 per consecutive correct answer before it
// (capped at 5 streak steps). Wrong or missing answers earn 0 and reset the streak.
// Points depend on answer speed, so the test asserts ranges and exact
// consistency (leaderboard score == sum of awarded points) instead of fixed values.

const QUIZ = {
  id: 'quiz-scoring-timer',
  title: 'Scoring & Timer',
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
      text: 'Largest planet in our solar system?',
      options: ['Mars', 'Jupiter', 'Venus', 'Saturn'],
      correctIndex: 1,
      timeLimit: 30,
    },
    {
      // Short limit so the timer can expire on its own during the test.
      id: 'q-3',
      text: 'Chemical symbol for water?',
      options: ['H2O', 'CO2', 'O2', 'NaCl'],
      correctIndex: 0,
      timeLimit: 5,
    },
  ],
  createdAt: 0,
  updatedAt: 0,
};

test.describe('Scoring and timer', () => {
  test('scores, streaks and timeouts across a three-question game', { tag: ['@multiplayer', '@scoring', '@e2e'] }, async ({
    page,
    context,
  }) => {
    test.setTimeout(90_000);

    // --- Setup: seeded quiz, host lobby, two players ---
    await seedQuiz(page, QUIZ);
    const code = await hostSeededQuiz(page);
    const host = new HostPage(page);

    const alice = new PlayerPage(await context.newPage());
    const bob = new PlayerPage(await context.newPage());
    await alice.join(code, 'Alice');
    await bob.join(code, 'Bob');

    await expect(host.leaderboardRow('Alice').or(page.getByText('Alice'))).toBeVisible();
    await expect(page.locator('.badge')).toHaveText('2');

    await host.startGame();

    // --- Question 1: Alice correct, Bob wrong ---
    await host.expectQuestion('Capital of France?');
    await expect(alice.questionHeading('Capital of France?')).toBeVisible();
    await expect(bob.questionHeading('Capital of France?')).toBeVisible();
    await expect(host.timer).toBeVisible(); // countdown is running

    await alice.answer('Paris');
    await expect(alice.lockedIn).toBeVisible();
    await bob.answer('Berlin');
    await expect(bob.lockedIn).toBeVisible();

    await host.revealAnswer();
    await expect(host.standingsHeading).toBeVisible();
    await expect(alice.correctBanner).toBeVisible();
    await expect(bob.wrongBanner).toBeVisible();

    const aliceQ1 = await alice.awardedPoints();
    expect(aliceQ1).toBeGreaterThanOrEqual(500); // base, no streak yet
    expect(aliceQ1).toBeLessThanOrEqual(1000); // base + max speed bonus
    await expect.poll(() => host.scoreOf('Alice')).toBe(aliceQ1);
    await expect.poll(() => host.scoreOf('Bob')).toBe(0);
    expect(await host.rankedNames()).toEqual(['Alice', 'Bob']);

    // --- Question 2: both correct; Alice earns a streak bonus ---
    await host.nextQuestion();
    await host.expectQuestion('Largest planet in our solar system?');
    await expect(alice.questionHeading('Largest planet in our solar system?')).toBeVisible();

    await alice.answer('Jupiter');
    await expect(alice.lockedIn).toBeVisible();
    await bob.answer('Jupiter');
    await expect(bob.lockedIn).toBeVisible();

    await host.revealAnswer();
    await expect(host.standingsHeading).toBeVisible();
    await expect(alice.correctBanner).toBeVisible();
    await expect(bob.correctBanner).toBeVisible();

    const aliceQ2 = await alice.awardedPoints();
    const bobQ2 = await bob.awardedPoints();
    expect(aliceQ2).toBeGreaterThanOrEqual(550); // 500 base + 50 streak bonus
    expect(aliceQ2).toBeLessThanOrEqual(1050);
    expect(bobQ2).toBeGreaterThanOrEqual(500); // Bob's streak was reset by Q1
    expect(bobQ2).toBeLessThanOrEqual(1000);

    const aliceTotal = aliceQ1 + aliceQ2;
    await expect.poll(() => host.scoreOf('Alice')).toBe(aliceTotal);
    await expect.poll(() => host.scoreOf('Bob')).toBe(bobQ2);
    // Alice has two correct answers in a row; Bob has one.
    await expect(host.streakBadge('Alice')).toContainText('2');
    await expect(host.streakBadge('Bob')).toHaveCount(0);

    // --- Question 3: nobody answers; the timer expires and reveals by itself ---
    await host.nextQuestion();
    await host.expectQuestion('Chemical symbol for water?');
    await expect(host.timer).toBeVisible();
    await expect(alice.timer).toBeVisible();

    // No "Reveal answer" click: the 5s countdown must trigger the reveal.
    await expect(host.standingsHeading).toBeVisible({ timeout: 15_000 });
    await expect(alice.outOfTimeBanner).toBeVisible();
    await expect(bob.outOfTimeBanner).toBeVisible();

    // Timeouts earn nothing and break the streak.
    await expect.poll(() => host.scoreOf('Alice')).toBe(aliceTotal);
    await expect.poll(() => host.scoreOf('Bob')).toBe(bobQ2);
    await expect(host.streakBadge('Alice')).toHaveCount(0);

    // --- Final results ---
    await host.seeFinalResults();
    await expect(host.finalHeading).toBeVisible();
    await expect(alice.gameOverHeading).toBeVisible();
    await expect(bob.gameOverHeading).toBeVisible();

    // Alice (Q1 + Q2) always outscores Bob (Q2 only): >= 1050 vs <= 1000.
    expect(aliceTotal).toBeGreaterThan(bobQ2);
    expect(await host.scoreOf('Alice')).toBe(aliceTotal);
    expect(await host.scoreOf('Bob')).toBe(bobQ2);
    expect(await host.rankedNames()).toEqual(['Alice', 'Bob']);

    await expect(alice.finalRank(1)).toBeVisible();
    await expect(bob.finalRank(2)).toBeVisible();
    await expect(alice.page.locator('.lb-row-self', { hasText: 'Alice' })).toBeVisible();
    await expect(bob.page.locator('.lb-row-self', { hasText: 'Bob' })).toBeVisible();
  });
});

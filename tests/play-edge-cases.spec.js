import { test, expect } from '@playwright/test';
import { hostSeededQuiz, joinAs, seedQuiz, SAMPLE_QUIZ } from './helpers.js';

/** Two-question quiz for streak testing (must answer 2 in a row correctly). */
const TWO_Q_QUIZ = {
  id: 'quiz-streak-test',
  title: 'Streak Test',
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
      options: ['Vienna', 'Berlin', 'Zurich', 'Prague'],
      correctIndex: 1,
      timeLimit: 30,
    },
  ],
  createdAt: 0,
  updatedAt: 0,
};

test.describe('Play page — redirect edge cases', () => {
  test('visiting /play/CODE without a player ID redirects to join', async ({
    page,
  }) => {
    // Seed a quiz and create a live room but do NOT join as a player.
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    // Open a fresh page with no sessionStorage playerId.
    const freshPage = await page.context().newPage();
    // Navigate directly to the play URL.
    await freshPage.goto(`/#/play/${code}`);

    // The app should bounce us to the join screen.
    await expect(freshPage).toHaveURL(new RegExp(`#/join/${code}`));
  });

  test('play page shows \"Room ended\" when the room no longer exists', async ({
    page,
  }) => {
    // Navigate to a play URL whose room was never created.
    await page.goto('/#/play/FAKECODE');

    await expect(
      page.getByRole('heading', { name: /Room FAKECODE ended/i })
    ).toBeVisible();
    // A "Home" button is present to escape.
    await expect(
      page.getByRole('button', { name: /← Home/i })
    ).toBeVisible();
  });

  test('correct answer shows \"Correct!\" feedback with points on reveal', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const alice = await context.newPage();
    await joinAs(alice, code, 'Alice');

    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(alice.getByText('Capital of France?')).toBeVisible();

    // Alice answers correctly.
    await alice.getByRole('button', { name: 'Paris' }).click();
    await expect(alice.getByText(/Locked in/i)).toBeVisible();

    // Host reveals.
    await page.getByRole('button', { name: 'Reveal answer' }).click();

    // Alice should see the correct feedback with a positive point value.
    await expect(alice.getByText(/✓ Correct!/i)).toBeVisible();
    const feedbackText = await alice.locator('.reveal-card').innerText();
    const match = feedbackText.match(/\+(\d+)\s*pts/);
    expect(match).not.toBeNull();
    expect(parseInt(match[1])).toBeGreaterThan(0);
  });

  test('wrong answer shows \"Not this time\" feedback on reveal', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const alice = await context.newPage();
    await joinAs(alice, code, 'Alice');

    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(alice.getByText('Capital of France?')).toBeVisible();

    // Alice picks a wrong answer.
    await alice.getByRole('button', { name: 'Berlin' }).click();
    await page.getByRole('button', { name: 'Reveal answer' }).click();

    await expect(alice.getByText(/Not this time/i)).toBeVisible();
  });

  test('streak badge (🔥) appears after two consecutive correct answers', async ({
    page,
    context,
  }) => {
    // Seed a two-question quiz.
    await page.goto('/');
    await page.evaluate((q) => {
      localStorage.setItem('kahootlite:quizzes', JSON.stringify([q]));
    }, TWO_Q_QUIZ);
    await page.goto('/#/quizzes');
    await page.getByRole('button', { name: /Host →/ }).click();
    await page.waitForURL(/#\/host\//);
    const code = (await page.locator('.big-code').first().innerText()).trim();

    const alice = await context.newPage();
    await joinAs(alice, code, 'Alice');

    await page.getByRole('button', { name: 'Start game' }).click();

    // Q1 — Alice answers correctly (Paris).
    await expect(alice.getByText('Capital of France?')).toBeVisible();
    await alice.getByRole('button', { name: 'Paris' }).click();
    await page.getByRole('button', { name: 'Reveal answer' }).click();
    // Q1 reveal — no streak badge yet (streak = 1, badge appears at >= 2).
    await expect(alice.locator('.streak-badge')).toHaveCount(0);

    // Q2 — Alice answers correctly again (Berlin).
    await page.getByRole('button', { name: /Next question →/i }).click();
    await expect(alice.getByText('Capital of Germany?')).toBeVisible();
    await alice.getByRole('button', { name: 'Berlin' }).click();
    await page.getByRole('button', { name: 'Reveal answer' }).click();

    // After 2 correct answers in a row the streak badge should appear.
    await expect(alice.locator('.streak-badge')).toBeVisible();
    await expect(alice.locator('.streak-badge')).toContainText('🔥');
  });

  test('player score in game header increments after a correct answer', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const alice = await context.newPage();
    await joinAs(alice, code, 'Alice');

    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(alice.getByText('Capital of France?')).toBeVisible();

    // Score starts at 0.
    await expect(alice.locator('.game-header')).toContainText('0 pts');

    // Alice answers correctly.
    await alice.getByRole('button', { name: 'Paris' }).click();
    await page.getByRole('button', { name: 'Reveal answer' }).click();

    // Score should now be > 0.
    const headerText = await alice.locator('.game-header').innerText();
    const match = headerText.match(/(\d+)\s*pts/);
    expect(match).not.toBeNull();
    expect(parseInt(match[1])).toBeGreaterThan(0);
  });
});

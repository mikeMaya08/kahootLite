import { test, expect } from '@playwright/test';
import { hostSeededQuiz, joinAs, seedQuiz } from './helpers.js';

/** A quiz whose first question has a very short time limit (5 s) so the
 *  timer fires within the test without manual `waitForTimeout` polling. */
const SHORT_TIMER_QUIZ = {
  id: 'quiz-short-timer',
  title: 'Short Timer Quiz',
  questions: [
    {
      id: 'q-1',
      text: 'Capital of France?',
      options: ['Paris', 'Berlin', 'Madrid', 'Rome'],
      correctIndex: 0,
      timeLimit: 5, // 5-second limit — expires quickly
    },
  ],
  createdAt: 0,
  updatedAt: 0,
};

const TWO_Q_QUIZ = {
  id: 'quiz-timer-two-q',
  title: 'Two-Q Timer',
  questions: [
    {
      id: 'q-1',
      text: 'Capital of France?',
      options: ['Paris', 'Berlin', 'Madrid', 'Rome'],
      correctIndex: 0,
      timeLimit: 5,
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

test.describe('Host — timer behaviour', () => {
  test('timer auto-reveals answer when time expires', async ({
    page,
    context,
  }) => {
    // Seed the short-timer quiz and open a lobby.
    await page.goto('/');
    await page.evaluate((q) => {
      localStorage.setItem('kahootlite:quizzes', JSON.stringify([q]));
    }, SHORT_TIMER_QUIZ);
    await page.goto('/#/quizzes');
    await page.getByRole('button', { name: /Host →/ }).click();
    await page.waitForURL(/#\/host\//);
    const code = (await page.locator('.big-code').first().innerText()).trim();

    const alice = await context.newPage();
    await joinAs(alice, code, 'Alice');

    // Start the game.
    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(page.getByText('Capital of France?')).toBeVisible();

    // Wait for the 5 s timer to expire and auto-trigger reveal.
    // The host UI should transition to reveal state (final results button appears).
    await expect(
      page.getByRole('button', { name: /See final results →/i })
    ).toBeVisible({ timeout: 12_000 });

    // Alice should also see "Out of time" since she never answered.
    await expect(alice.getByText(/Out of time/i)).toBeVisible({ timeout: 12_000 });
  });

  test('progress indicator shows correct Q number across questions', async ({
    page,
    context,
  }) => {
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
    // Q1 — header shows "Question 1 / 2"
    await expect(page.locator('.game-header')).toContainText('Question 1 / 2');

    // Reveal and advance to Q2.
    await page.getByRole('button', { name: 'Reveal answer' }).click();
    await page.getByRole('button', { name: /Next question →/i }).click();

    // Q2 — header shows "Question 2 / 2"
    await expect(page.locator('.game-header')).toContainText('Question 2 / 2');
    await expect(page.getByText('Capital of Germany?')).toBeVisible();

    // Player tab should also show Q2.
    await expect(alice.getByText('Capital of Germany?')).toBeVisible();
  });
});

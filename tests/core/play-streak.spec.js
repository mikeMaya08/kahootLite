import { test, expect } from '@playwright/test';
import { hostSeededQuiz, joinAs, seedQuiz } from '../helpers';

// Three-question quiz: consecutive correct answers build a streak.
const THREE_Q_QUIZ = {
  id: 'quiz-streak',
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
      options: ['Vienna', 'Berlin', 'Prague', 'Warsaw'],
      correctIndex: 1,
      timeLimit: 30,
    },
    {
      id: 'q-3',
      text: 'Capital of Spain?',
      options: ['Lisbon', 'Madrid', 'Barcelona', 'Seville'],
      correctIndex: 1,
      timeLimit: 30,
    },
  ],
  createdAt: 0,
  updatedAt: 0,
};

test.describe('Play screen — streak & feedback', () => {
  // ── Streak badge ───────────────────────────────────────────────────────────

  test('streak badge (🔥) appears after 2 consecutive correct answers', async ({ page, context }) => {
    await page.goto('/');
    await page.evaluate((q) => {
      localStorage.setItem('kahootlite:quizzes', JSON.stringify([q]));
    }, THREE_Q_QUIZ);

    await page.goto('/#/quizzes');
    await page.getByRole('button', { name: /Host →/ }).click();
    await page.waitForURL(/#\/host\//);
    const code = (await page.locator('.big-code').first().innerText()).trim();

    const player = await context.newPage();
    await joinAs(player, code, 'Alice');

    // Q1
    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(player.getByText('Capital of France?')).toBeVisible();
    await player.getByRole('button', { name: 'Paris' }).click();
    await expect(player.getByText(/Locked in/i)).toBeVisible();
    await page.getByRole('button', { name: 'Reveal answer' }).click();
    await expect(player.getByText(/✓ Correct!/i)).toBeVisible();

    // Q2
    await page.getByRole('button', { name: 'Next question →' }).click();
    await expect(player.getByText('Capital of Germany?')).toBeVisible();
    await player.getByRole('button', { name: 'Berlin' }).click();
    await expect(player.getByText(/Locked in/i)).toBeVisible();
    await page.getByRole('button', { name: 'Reveal answer' }).click();

    // After 2 consecutive correct answers streak ≥ 2 → 🔥 badge
    await expect(player.locator('.streak-badge')).toBeVisible();
    await expect(player.locator('.streak-badge')).toContainText('🔥');
  });

  test('streak bonus message "N in a row!" is shown on the reveal card', async ({ page, context }) => {
    await page.goto('/');
    await page.evaluate((q) => {
      localStorage.setItem('kahootlite:quizzes', JSON.stringify([q]));
    }, THREE_Q_QUIZ);

    await page.goto('/#/quizzes');
    await page.getByRole('button', { name: /Host →/ }).click();
    await page.waitForURL(/#\/host\//);
    const code = (await page.locator('.big-code').first().innerText()).trim();

    const player = await context.newPage();
    await joinAs(player, code, 'Alice');

    await page.getByRole('button', { name: 'Start game' }).click();

    // Q1 correct
    await expect(player.getByText('Capital of France?')).toBeVisible();
    await player.getByRole('button', { name: 'Paris' }).click();
    await page.getByRole('button', { name: 'Reveal answer' }).click();

    // Q2 correct
    await page.getByRole('button', { name: 'Next question →' }).click();
    await expect(player.getByText('Capital of Germany?')).toBeVisible();
    await player.getByRole('button', { name: 'Berlin' }).click();
    await page.getByRole('button', { name: 'Reveal answer' }).click();

    await expect(player.getByText(/2 in a row!/i)).toBeVisible();
  });

  // ── Correct / wrong answer feedback ────────────────────────────────────────

  test('player sees "✓ Correct!" with points > 0 when answering correctly', async ({ page, context }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const player = await context.newPage();
    await joinAs(player, code, 'Alice');

    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(player.getByText('Capital of France?')).toBeVisible();

    await player.getByRole('button', { name: 'Paris' }).click();
    await expect(player.getByText(/Locked in/i)).toBeVisible();

    await page.getByRole('button', { name: 'Reveal answer' }).click();

    await expect(player.getByText(/✓ Correct!/i)).toBeVisible();
    const revealText = await player.locator('.reveal-card').innerText();
    const match = revealText.match(/\+(\d+)\s*pts/);
    expect(match).not.toBeNull();
    expect(parseInt(match[1])).toBeGreaterThan(0);
  });

  test('player sees "✗ Not this time." when answering incorrectly', async ({ page, context }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const player = await context.newPage();
    await joinAs(player, code, 'Alice');

    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(player.getByText('Capital of France?')).toBeVisible();

    await player.getByRole('button', { name: 'Berlin' }).click();
    await expect(player.getByText(/Locked in/i)).toBeVisible();

    await page.getByRole('button', { name: 'Reveal answer' }).click();

    await expect(player.getByText(/Not this time/i)).toBeVisible();
  });

  // ── "Room ended" screen ────────────────────────────────────────────────────

  test('navigating to /play without a valid room shows "Room ended" screen', async ({ page }) => {
    await page.goto('/#/play/NOROOM');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/Room NOROOM ended/i)).toBeVisible();
    await expect(
      page.getByRole('button', { name: /← Home/i })
    ).toBeVisible();
  });

  test('"← Home" on the ended-room screen navigates back to home', async ({ page }) => {
    await page.goto('/#/play/NOROOM');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /← Home/i }).click();
    await expect(page).toHaveURL(/\/?#?\/?(|$)/);
  });

  // ── Reveal highlights ──────────────────────────────────────────────────────

  test('wrong answer is visually highlighted as incorrect on reveal', async ({ page, context }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const player = await context.newPage();
    await joinAs(player, code, 'Alice');

    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(player.getByText('Capital of France?')).toBeVisible();

    await player.getByRole('button', { name: /Option B: Berlin/ }).click();
    await expect(player.getByText(/Locked in/i)).toBeVisible();

    await page.getByRole('button', { name: 'Reveal answer' }).click();

    await expect(player.getByText(/Not this time/i)).toBeVisible();

    const paris = player.getByRole('button', { name: /Option A: Paris/ });
    const berlin = player.getByRole('button', { name: /Option B: Berlin/ });
    await expect(paris).toHaveClass(/answer-correct/);
    await expect(berlin).toHaveClass(/answer-wrong/);
  });
});

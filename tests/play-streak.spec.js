import { test, expect } from '@playwright/test';
import { joinAs } from './helpers.js';

// ---------------------------------------------------------------------------
// Streak bonus & multi-question scoring — flows not covered in play.spec.js
// ---------------------------------------------------------------------------

// A two-question quiz where question 1 correct = Paris, question 2 correct = Berlin.
const STREAK_QUIZ = {
  id: 'quiz-streak-test',
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
      options: ['Vienna', 'Berlin', 'Zurich', 'Brussels'],
      correctIndex: 1,
      timeLimit: 30,
    },
  ],
  createdAt: 0,
  updatedAt: 0,
};

async function seedAndHost(page) {
  await page.goto('/');
  await page.evaluate((q) => {
    localStorage.setItem('kahootlite:quizzes', JSON.stringify([q]));
  }, STREAK_QUIZ);
  await page.goto('/#/quizzes');
  await page.getByRole('button', { name: /Host →/ }).click();
  await page.waitForURL(/#\/host\//);
  return (await page.locator('.big-code').first().innerText()).trim();
}

test.describe('Player streak bonus', () => {
  // ── Streak badge appears after 2 consecutive correct answers ──────────────
  test('streak badge (🔥) appears in player header after 2 correct in a row', async ({
    page,
    context,
  }) => {
    const code = await seedAndHost(page);
    const alice = await context.newPage();
    await joinAs(alice, code, 'Alice');

    // Start game — Q1.
    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(alice.getByText('Capital of France?')).toBeVisible();

    // Alice answers Q1 correctly (Paris).
    await alice.getByRole('button', { name: /Paris/ }).click();
    await page.getByRole('button', { name: 'Reveal answer' }).click();

    // No streak badge yet after only 1 correct (streak < 2).
    await expect(alice.locator('.streak-badge')).toHaveCount(0);

    // Advance to Q2.
    await page.getByRole('button', { name: /Next question →/ }).click();
    await expect(alice.getByText('Capital of Germany?')).toBeVisible();

    // Alice answers Q2 correctly (Berlin) — streak is now 2.
    await alice.getByRole('button', { name: /Berlin/ }).click();
    await page.getByRole('button', { name: 'Reveal answer' }).click();

    // Streak badge must now be visible with "🔥 2".
    await expect(alice.locator('.streak-badge')).toBeVisible();
    await expect(alice.locator('.streak-badge')).toContainText('2');
  });

  // ── Wrong answer resets streak ────────────────────────────────────────────
  test('a wrong answer resets the streak to zero', async ({
    page,
    context,
  }) => {
    const code = await seedAndHost(page);
    const alice = await context.newPage();
    await joinAs(alice, code, 'Alice');

    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(alice.getByText('Capital of France?')).toBeVisible();

    // Alice answers Q1 correctly (Paris).
    await alice.getByRole('button', { name: /Paris/ }).click();
    await page.getByRole('button', { name: 'Reveal answer' }).click();

    // Advance to Q2.
    await page.getByRole('button', { name: /Next question →/ }).click();
    await expect(alice.getByText('Capital of Germany?')).toBeVisible();

    // Alice answers Q2 WRONGLY (Vienna).
    await alice.getByRole('button', { name: /Vienna/ }).click();
    await page.getByRole('button', { name: 'Reveal answer' }).click();

    // "Not this time" shown → streak broken.
    await expect(alice.getByText(/Not this time/i)).toBeVisible();

    // Finalize — Alice's streak in the room state must be 0.
    await page.getByRole('button', { name: /See final results →/ }).click();

    const roomData = await page.evaluate((c) => {
      return JSON.parse(
        localStorage.getItem(`kahootlite:room:${c}`) || 'null'
      );
    }, code.toUpperCase());

    const aliceData = Object.values(roomData?.players ?? {}).find(
      (p) => p.name === 'Alice'
    );
    expect(aliceData).not.toBeNull();
    expect(aliceData.streak).toBe(0);
  });

  // ── Score after two correct > score after one correct ────────────────────
  test('two correct answers accumulate more points than one', async ({
    page,
    context,
  }) => {
    const code = await seedAndHost(page);
    const alice = await context.newPage();
    const bob = await context.newPage();
    await joinAs(alice, code, 'Alice');
    await joinAs(bob, code, 'Bob');

    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(alice.getByText('Capital of France?')).toBeVisible();

    // Alice answers Q1 correctly; Bob skips.
    await alice.getByRole('button', { name: /Paris/ }).click();
    await page.getByRole('button', { name: 'Reveal answer' }).click();

    // Q2.
    await page.getByRole('button', { name: /Next question →/ }).click();
    await expect(alice.getByText('Capital of Germany?')).toBeVisible();

    // Alice answers Q2 correctly; Bob still skips.
    await alice.getByRole('button', { name: /Berlin/ }).click();
    await page.getByRole('button', { name: 'Reveal answer' }).click();
    await page.getByRole('button', { name: /See final results →/ }).click();

    // Host final leaderboard — Alice must have more points than Bob (0).
    const aliceScore = Number(
      await page
        .locator('.lb-row', { hasText: 'Alice' })
        .locator('.lb-score')
        .innerText()
    );
    const bobScore = Number(
      await page
        .locator('.lb-row', { hasText: 'Bob' })
        .locator('.lb-score')
        .innerText()
    );
    expect(aliceScore).toBeGreaterThan(0);
    expect(bobScore).toBe(0);
    expect(aliceScore).toBeGreaterThan(bobScore);
  });
});

import { test, expect } from '@playwright/test';
import { hostSeededQuiz, joinAs, seedQuiz, SAMPLE_QUIZ } from '../helpers';

// ---------------------------------------------------------------------------
// Advanced multiplayer scenarios
// ---------------------------------------------------------------------------
// Extends the core multiplayer suite with 3-player flows, question progression
// sync, end-room propagation, and post-game leaderboard ordering.
// ---------------------------------------------------------------------------

// Three-question quiz used for progression tests.
const THREE_Q_QUIZ = {
  id: 'quiz-mp-adv',
  title: 'Advanced MP Quiz',
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

test.describe('Multiplayer — advanced scenarios', () => {
  // ── 3-player lobby ────────────────────────────────────────────────────────

  test('three players all appear in the host lobby', async ({ page, context }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    await joinAs(await context.newPage(), code, 'Alice');
    await joinAs(await context.newPage(), code, 'Bob');
    await joinAs(await context.newPage(), code, 'Carla');

    await expect(page.locator('.badge')).toHaveText('3');
    await expect(page.getByText('Alice')).toBeVisible();
    await expect(page.getByText('Bob')).toBeVisible();
    await expect(page.getByText('Carla')).toBeVisible();
  });

  // ── Question sync ─────────────────────────────────────────────────────────

  test('all three players see the question when host starts', async ({ page, context }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const alice = await context.newPage();
    const bob   = await context.newPage();
    const carla = await context.newPage();
    await joinAs(alice, code, 'Alice');
    await joinAs(bob,   code, 'Bob');
    await joinAs(carla, code, 'Carla');

    await page.getByRole('button', { name: 'Start game' }).click();

    await expect(alice.getByText('Capital of France?')).toBeVisible();
    await expect(bob.getByText('Capital of France?')).toBeVisible();
    await expect(carla.getByText('Capital of France?')).toBeVisible();
  });

  test('answer counter reaches 3 when all players submit', async ({ page, context }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const alice = await context.newPage();
    const bob   = await context.newPage();
    const carla = await context.newPage();
    await joinAs(alice, code, 'Alice');
    await joinAs(bob,   code, 'Bob');
    await joinAs(carla, code, 'Carla');

    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(page.getByText('Capital of France?')).toBeVisible();

    await alice.getByRole('button', { name: /Paris/ }).click();
    await bob.getByRole('button',   { name: /Berlin/ }).click();
    await carla.getByRole('button', { name: /Madrid/ }).click();

    // Host counter should now show 3 answers received.
    await expect(page.locator('.game-header')).toContainText('3');
  });

  // ── Question progression sync ─────────────────────────────────────────────

  test('all players advance to Q2 when host clicks Next question', async ({ page, context }) => {
    // Seed a three-question quiz.
    await page.goto('/');
    await page.evaluate((q) => {
      localStorage.setItem('kahootlite:quizzes', JSON.stringify([q]));
    }, THREE_Q_QUIZ);
    await page.goto('/#/quizzes');
    await page.waitForLoadState('networkidle');
    const hostBtn = page.getByRole('button', { name: /Host →/ });
    await hostBtn.waitFor({ state: 'visible', timeout: 15_000 });
    await hostBtn.click();
    await page.waitForURL(/#\/host\//);
    const code = (await page.locator('.big-code').first().innerText()).trim();

    const alice = await context.newPage();
    const bob   = await context.newPage();
    await joinAs(alice, code, 'Alice');
    await joinAs(bob,   code, 'Bob');

    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(page.getByText('Capital of France?')).toBeVisible();

    // Alice answers Q1; host reveals and advances.
    await alice.getByRole('button', { name: /Paris/ }).click();
    await page.getByRole('button', { name: 'Reveal answer' }).click();
    await page.getByRole('button', { name: /Next question →/ }).click();

    // Both players should now be on Q2.
    await expect(alice.getByText('Capital of Germany?')).toBeVisible();
    await expect(bob.getByText('Capital of Germany?')).toBeVisible();
  });

  // ── End room propagation ──────────────────────────────────────────────────

  test('\"End room\" from lobby deletes the room from localStorage', async ({ page, context }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    await joinAs(await context.newPage(), code, 'Alice');

    // Host ends room from lobby (accepts confirm dialog).
    page.on('dialog', (d) => d.accept());
    await page.getByRole('button', { name: /← End room/i }).click();

    await expect(page).toHaveURL(/\/?#?[^/]*$/);

    const room = await page.evaluate(
      (key) => localStorage.getItem(key),
      `kahootlite:room:${code}`
    );
    expect(room).toBeNull();
  });

  test('after game ends all players reach the Game over screen', async ({ page, context }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const alice = await context.newPage();
    const bob   = await context.newPage();
    const carla = await context.newPage();
    await joinAs(alice, code, 'Alice');
    await joinAs(bob,   code, 'Bob');
    await joinAs(carla, code, 'Carla');

    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(page.getByText('Capital of France?')).toBeVisible();

    // All answer (Alice correct, Bob and Carla wrong).
    await alice.getByRole('button', { name: /Paris/ }).click();
    await bob.getByRole('button',   { name: /Berlin/ }).click();
    await carla.getByRole('button', { name: /Madrid/ }).click();

    await page.getByRole('button', { name: 'Reveal answer' }).click();
    await page.getByRole('button', { name: /See final results →/ }).click();

    await expect(alice.getByRole('heading', { name: /Game over/i })).toBeVisible();
    await expect(bob.getByRole('heading',   { name: /Game over/i })).toBeVisible();
    await expect(carla.getByRole('heading', { name: /Game over/i })).toBeVisible();
  });

  // ── Leaderboard ordering ──────────────────────────────────────────────────

  test('leaderboard on host ranks correct answerer above wrong answerers', async ({ page, context }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const alice = await context.newPage();
    const bob   = await context.newPage();
    await joinAs(alice, code, 'Alice');
    await joinAs(bob,   code, 'Bob');

    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(page.getByText('Capital of France?')).toBeVisible();

    await alice.getByRole('button', { name: /Paris/ }).click();   // correct
    await bob.getByRole('button',   { name: /Berlin/ }).click();  // wrong

    await page.getByRole('button', { name: 'Reveal answer' }).click();
    await page.getByRole('button', { name: /See final results →/ }).click();

    const aliceScore = Number(
      await page.locator('.lb-row', { hasText: 'Alice' }).locator('.lb-score').innerText()
    );
    const bobScore = Number(
      await page.locator('.lb-row', { hasText: 'Bob' }).locator('.lb-score').innerText()
    );

    expect(aliceScore).toBeGreaterThan(0);
    expect(bobScore).toBe(0);
    expect(aliceScore).toBeGreaterThan(bobScore);
  });

  // ── Play again resets all scores ─────────────────────────────────────────

  test('\"Play again\" resets scores to 0 for all players', async ({ page, context }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const alice = await context.newPage();
    const bob   = await context.newPage();
    await joinAs(alice, code, 'Alice');
    await joinAs(bob,   code, 'Bob');

    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(page.getByText('Capital of France?')).toBeVisible();

    await alice.getByRole('button', { name: /Paris/ }).click();
    await bob.getByRole('button',   { name: /Berlin/ }).click();

    await page.getByRole('button', { name: 'Reveal answer' }).click();
    await page.getByRole('button', { name: /See final results →/ }).click();

    await page.getByRole('button', { name: 'Play again' }).click();

    // Host is back in lobby.
    await expect(page.getByRole('button', { name: 'Start game' })).toBeVisible();

    // All scores reset to 0 in localStorage.
    const scores = await page.evaluate((key) => {
      const room = JSON.parse(localStorage.getItem(key) || 'null');
      return Object.values(room?.players ?? {}).map((p) => p.score);
    }, `kahootlite:room:${code}`);

    expect(scores.length).toBe(2);
    expect(scores.every((s) => s === 0)).toBe(true);
  });
});

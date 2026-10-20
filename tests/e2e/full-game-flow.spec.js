import { test, expect } from '@playwright/test';
import { setBypassHeader, joinAs } from '../helpers.js';

// ---------------------------------------------------------------------------
// End-to-end full game flow
//
// Validates the critical happy path that ties every major module together:
//   1. Host creates a quiz via the UI (no localStorage seeding)
//   2. Host saves and immediately opens a lobby ("Save & host →")
//   3. A player joins, selects an avatar, and waits for the game to start
//   4. Host starts the game; both tabs see the question
//   5. Player answers correctly; host reveals; player sees "Correct!"
//   6. Host navigates to final results; player sees "Game over" with a score > 0
//
// A second scenario covers the two-player path so the leaderboard ranking
// is also exercised end-to-end.
// ---------------------------------------------------------------------------

test.describe('Full game flow — E2E', () => {
  // ── Single player: create → host → join → answer → game over ──────────────

  test(
    'host creates quiz via UI, player joins and completes the game',
    { tag: ['@e2e', '@smoke', '@multiplayer'] },
    async ({ page, context }) => {
      // ── Step 1: Create a quiz from scratch via the creator UI ──────────────
      await setBypassHeader(page);
      await page.goto('/#/create');
      await page.waitForLoadState('networkidle');
      await page.getByLabel('Quiz title').waitFor({ state: 'visible', timeout: 30_000 });

      await page.getByLabel('Quiz title').fill('Geography E2E');
      await page.getByLabel('Question text').fill('Capital of France?');
      await page.getByPlaceholder('Option A').fill('Paris');
      await page.getByPlaceholder('Option B').fill('Berlin');
      await page.getByPlaceholder('Option C').fill('Madrid');
      await page.getByPlaceholder('Option D').fill('Rome');
      // Correct answer defaults to A (index 0 = Paris) — no change needed.

      // ── Step 2: Save & host → lands directly in the lobby ─────────────────
      await page.getByRole('button', { name: /Save.*host/i }).click();
      await page.waitForURL(/#\/host\//);

      const pin = (await page.locator('.big-code').first().innerText()).trim();
      expect(pin).toMatch(/^[A-Z0-9]{6}$/);

      // Lobby should display the quiz title and the Start game button.
      await expect(page.getByRole('heading', { name: 'Geography E2E' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Start game' })).toBeVisible();

      // ── Step 3: Player joins from a second tab ─────────────────────────────
      const player = await context.newPage();
      await setBypassHeader(player);
      await joinAs(player, pin, 'Alice');

      // Player lands on the waiting screen.
      await expect(player.getByText(/Waiting for the host/i)).toBeVisible();

      // Host lobby reflects Alice's arrival.
      await expect(page.getByText('Alice')).toBeVisible();
      await expect(page.locator('.badge')).toHaveText('1');

      // ── Step 4: Host starts the game — both tabs see the question ──────────
      await page.getByRole('button', { name: 'Start game' }).click();

      await expect(page.getByText('Capital of France?')).toBeVisible();
      await expect(player.getByText('Capital of France?')).toBeVisible();

      // ── Step 5: Player answers correctly ──────────────────────────────────
      await player.getByRole('button', { name: /Paris/i }).click();
      await expect(player.getByText(/Locked in/i)).toBeVisible();

      // Host reveals the answer.
      await page.getByRole('button', { name: 'Reveal answer' }).click();

      // Player sees the correct feedback.
      await expect(player.getByText(/✓ Correct!/i)).toBeVisible();

      // ── Step 6: Host finalises results; player reaches Game over ───────────
      await page.getByRole('button', { name: /See final results →/ }).click();

      await expect(page.getByRole('heading', { name: /Final results/i })).toBeVisible();
      await expect(page.getByText('Alice')).toBeVisible();

      // Player tab shows the Game over screen with a positive score.
      await expect(player.getByRole('heading', { name: /Game over/i })).toBeVisible();
      await expect(player.locator('.you-card')).toContainText('Alice');
      await expect(player.locator('.you-card')).toContainText('#1');

      const scoreText = await player.locator('.you-card').innerText();
      const match = scoreText.match(/(\d+)\s*pts/);
      expect(match).not.toBeNull();
      expect(parseInt(match[1])).toBeGreaterThan(0);
    }
  );

  // ── Two players: correct vs wrong → leaderboard ranking ──────────────────

  test(
    'two-player game — correct answerer ranked above wrong answerer on final leaderboard',
    { tag: ['@e2e', '@multiplayer'] },
    async ({ page, context }) => {
      // Create quiz via UI so the full creation path is exercised.
      await setBypassHeader(page);
      await page.goto('/#/create');
      await page.waitForLoadState('networkidle');
      await page.getByLabel('Quiz title').waitFor({ state: 'visible', timeout: 30_000 });

      await page.getByLabel('Quiz title').fill('Leaderboard E2E');
      await page.getByLabel('Question text').fill('Capital of Germany?');
      await page.getByPlaceholder('Option A').fill('Berlin');
      await page.getByPlaceholder('Option B').fill('Munich');
      await page.getByPlaceholder('Option C').fill('Hamburg');
      await page.getByPlaceholder('Option D').fill('Frankfurt');
      // Correct answer is A (Berlin) by default.

      await page.getByRole('button', { name: /Save.*host/i }).click();
      await page.waitForURL(/#\/host\//);

      const pin = (await page.locator('.big-code').first().innerText()).trim();

      // Two players join.
      const alice = await context.newPage();
      await setBypassHeader(alice);
      await joinAs(alice, pin, 'Alice');
      await expect(alice.getByText(/Waiting for the host/i)).toBeVisible();

      const bob = await context.newPage();
      await setBypassHeader(bob);
      await joinAs(bob, pin, 'Bob');
      await expect(bob.getByText(/Waiting for the host/i)).toBeVisible();

      // Both appear in the lobby.
      await expect(page.getByText('Alice')).toBeVisible();
      await expect(page.getByText('Bob')).toBeVisible();

      // Host starts — all tabs see the question.
      await page.getByRole('button', { name: 'Start game' }).click();
      await expect(page.getByText('Capital of Germany?')).toBeVisible();
      await expect(alice.getByText('Capital of Germany?')).toBeVisible();
      await expect(bob.getByText('Capital of Germany?')).toBeVisible();

      // Alice picks Berlin (correct), Bob picks Munich (wrong).
      await alice.getByRole('button', { name: /Berlin/i }).click();
      await expect(alice.getByText(/Locked in/i)).toBeVisible();
      await bob.getByRole('button', { name: /Munich/i }).click();
      await expect(bob.getByText(/Locked in/i)).toBeVisible();

      // Host reveals.
      await page.getByRole('button', { name: 'Reveal answer' }).click();
      await expect(alice.getByText(/✓ Correct!/i)).toBeVisible();
      await expect(bob.getByText(/Not this time/i)).toBeVisible();

      // Host finalises results.
      await page.getByRole('button', { name: /See final results →/ }).click();
      await expect(page.getByRole('heading', { name: /Final results/i })).toBeVisible();

      // Alice should be ranked above Bob on the host leaderboard.
      const aliceScore = Number(
        await page.locator('.lb-row', { hasText: 'Alice' }).locator('.lb-score').innerText()
      );
      const bobScore = Number(
        await page.locator('.lb-row', { hasText: 'Bob' }).locator('.lb-score').innerText()
      );
      expect(aliceScore).toBeGreaterThan(0);
      expect(bobScore).toBe(0);
      expect(aliceScore).toBeGreaterThan(bobScore);

      // Each player's Game over screen shows their own result.
      await expect(alice.getByRole('heading', { name: /Game over/i })).toBeVisible();
      await expect(bob.getByRole('heading', { name: /Game over/i })).toBeVisible();

      // Alice is highlighted as "self" in her own tab.
      await expect(alice.locator('.lb-row-self', { hasText: 'Alice' })).toBeVisible();
    }
  );

  // ── "Save & host" shortcut from the quiz library ──────────────────────────

  test(
    '"Save & host →" opens a lobby with the correct quiz title without going through the library',
    { tag: ['@e2e', '@quiz-creator'] },
    async ({ page }) => {
      await setBypassHeader(page);
      await page.goto('/#/create');
      await page.waitForLoadState('networkidle');
      await page.getByLabel('Quiz title').waitFor({ state: 'visible', timeout: 30_000 });

      await page.getByLabel('Quiz title').fill('Quick Host Quiz');
      await page.getByLabel('Question text').fill('1 + 1?');
      await page.getByPlaceholder('Option A').fill('2');
      await page.getByPlaceholder('Option B').fill('3');

      await page.getByRole('button', { name: /Save.*host/i }).click();

      // Should land directly in a host lobby — not the quiz library.
      await page.waitForURL(/#\/host\//);

      // Quiz title is shown in the lobby.
      await expect(page.getByRole('heading', { name: 'Quick Host Quiz' })).toBeVisible();

      // A valid 6-character PIN is displayed.
      const pin = (await page.locator('.big-code').first().innerText()).trim();
      expect(pin).toMatch(/^[A-Z0-9]{6}$/);

      // The quiz was persisted to localStorage.
      const stored = await page.evaluate(() =>
        JSON.parse(localStorage.getItem('kahootlite:quizzes') || '[]')
      );
      expect(stored.some((q) => q.title === 'Quick Host Quiz')).toBe(true);
    }
  );
});

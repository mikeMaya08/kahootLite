import { test, expect } from '@playwright/test';

// All scoring logic lives in src/utils/scoring.js — a plain JS module.
// We test it by importing it through the app's own module system via
// page.evaluate, which runs inside the browser context where the app is loaded.

test.describe('Scoring utilities', () => {
  test.beforeEach(async ({ page }) => {
    // Just need the app loaded so we can import the module.
    await page.goto('/');
  });

  // Helper: call computePoints in the browser context.
  async function computePoints(page, args) {
    return page.evaluate(async (a) => {
      const mod = await import('/src/utils/scoring.js');
      return mod.computePoints(a);
    }, args);
  }

  async function rankPlayers(page, players) {
    return page.evaluate(async (p) => {
      const mod = await import('/src/utils/scoring.js');
      return mod.rankPlayers(p);
    }, players);
  }

  // ── computePoints ──────────────────────────────────────────────────────────

  test('correct answer at full remaining time yields 1000 pts', async ({ page }) => {
    const pts = await computePoints(page, {
      correct: true,
      remainingMs: 30_000,
      totalMs: 30_000,
    });
    expect(pts).toBe(1000);
  });

  test('correct answer at zero remaining time yields BASE (500 pts)', async ({ page }) => {
    const pts = await computePoints(page, {
      correct: true,
      remainingMs: 0,
      totalMs: 30_000,
    });
    expect(pts).toBe(500);
  });

  test('correct answer at half remaining time yields 750 pts', async ({ page }) => {
    const pts = await computePoints(page, {
      correct: true,
      remainingMs: 15_000,
      totalMs: 30_000,
    });
    expect(pts).toBe(750);
  });

  test('wrong answer always yields 0 pts regardless of speed', async ({ page }) => {
    const fast = await computePoints(page, {
      correct: false,
      remainingMs: 29_000,
      totalMs: 30_000,
    });
    const slow = await computePoints(page, {
      correct: false,
      remainingMs: 0,
      totalMs: 30_000,
    });
    expect(fast).toBe(0);
    expect(slow).toBe(0);
  });

  test('totalMs = 0 guard falls back to BASE (500 pts) for correct answer', async ({ page }) => {
    const pts = await computePoints(page, {
      correct: true,
      remainingMs: 0,
      totalMs: 0,
    });
    expect(pts).toBe(500);
  });

  test('remainingMs > totalMs is clamped to 1000 pts (ratio cap)', async ({ page }) => {
    const pts = await computePoints(page, {
      correct: true,
      remainingMs: 999_999,
      totalMs: 30_000,
    });
    expect(pts).toBe(1000);
  });

  test('negative remainingMs is clamped to BASE (500 pts)', async ({ page }) => {
    const pts = await computePoints(page, {
      correct: true,
      remainingMs: -5_000,
      totalMs: 30_000,
    });
    expect(pts).toBe(500);
  });

  // ── rankPlayers ────────────────────────────────────────────────────────────

  test('rankPlayers sorts by score descending', async ({ page }) => {
    const players = {
      p1: { id: 'p1', name: 'Alice', score: 750 },
      p2: { id: 'p2', name: 'Bob', score: 1000 },
      p3: { id: 'p3', name: 'Carla', score: 500 },
    };
    const ranked = await rankPlayers(page, players);
    expect(ranked.map((p) => p.name)).toEqual(['Bob', 'Alice', 'Carla']);
  });

  test('rankPlayers breaks ties alphabetically', async ({ page }) => {
    const players = {
      p1: { id: 'p1', name: 'Zara', score: 500 },
      p2: { id: 'p2', name: 'Alice', score: 500 },
      p3: { id: 'p3', name: 'Mike', score: 500 },
    };
    const ranked = await rankPlayers(page, players);
    expect(ranked.map((p) => p.name)).toEqual(['Alice', 'Mike', 'Zara']);
  });

  test('rankPlayers defaults missing score to 0', async ({ page }) => {
    const players = {
      p1: { id: 'p1', name: 'Alice', score: 200 },
      p2: { id: 'p2', name: 'Bob' }, // no score field
    };
    const ranked = await rankPlayers(page, players);
    expect(ranked[0].name).toBe('Alice');
    expect(ranked[1].score).toBe(0);
  });

  test('rankPlayers handles a single player', async ({ page }) => {
    const players = { p1: { id: 'p1', name: 'Solo', score: 1000 } };
    const ranked = await rankPlayers(page, players);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].name).toBe('Solo');
  });

  test('rankPlayers handles an empty object', async ({ page }) => {
    const ranked = await rankPlayers(page, {});
    expect(ranked).toHaveLength(0);
  });
});

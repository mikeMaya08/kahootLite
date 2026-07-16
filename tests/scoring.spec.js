import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Scoring utility unit tests
// ---------------------------------------------------------------------------
// These tests run computePoints and rankPlayers inside the browser's module
// system so that the real app code under test is the same bundle the app uses.
// ---------------------------------------------------------------------------

test.describe('computePoints', () => {
  // Helper: evaluate computePoints inside the app's module context.
  async function computePoints(page, args) {
    return page.evaluate(async (input) => {
      const mod = await import('/src/utils/scoring.js');
      return mod.computePoints(input);
    }, args);
  }

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('correct answer at full remaining time → 500 base + 500 speed = 1000', async ({
    page,
  }) => {
    const pts = await computePoints(page, {
      correct: true,
      remainingMs: 30_000,
      totalMs: 30_000,
      streak: 0,
    });
    expect(pts).toBe(1000);
  });

  test('correct answer at half remaining time → 500 base + 250 speed = 750', async ({
    page,
  }) => {
    const pts = await computePoints(page, {
      correct: true,
      remainingMs: 15_000,
      totalMs: 30_000,
      streak: 0,
    });
    expect(pts).toBe(750);
  });

  test('correct answer at zero remaining time → 500 base only', async ({
    page,
  }) => {
    const pts = await computePoints(page, {
      correct: true,
      remainingMs: 0,
      totalMs: 30_000,
      streak: 0,
    });
    expect(pts).toBe(500);
  });

  test('wrong answer always yields 0 regardless of speed', async ({ page }) => {
    const pts = await computePoints(page, {
      correct: false,
      remainingMs: 30_000,
      totalMs: 30_000,
      streak: 5,
    });
    expect(pts).toBe(0);
  });

  test('totalMs = 0 guard returns 500 base (no divide-by-zero)', async ({
    page,
  }) => {
    const pts = await computePoints(page, {
      correct: true,
      remainingMs: 0,
      totalMs: 0,
      streak: 0,
    });
    expect(pts).toBe(500);
  });

  test('remainingMs > totalMs clamps speed bonus to 500', async ({ page }) => {
    const pts = await computePoints(page, {
      correct: true,
      remainingMs: 99_999,
      totalMs: 30_000,
      streak: 0,
    });
    expect(pts).toBe(1000); // base 500 + clamped speed 500
  });

  test('negative remainingMs clamps speed bonus to 0', async ({ page }) => {
    const pts = await computePoints(page, {
      correct: true,
      remainingMs: -1000,
      totalMs: 30_000,
      streak: 0,
    });
    expect(pts).toBe(500);
  });

  test('streak of 1 adds 50 bonus (streak bonus step)', async ({ page }) => {
    const pts = await computePoints(page, {
      correct: true,
      remainingMs: 30_000,
      totalMs: 30_000,
      streak: 1,
    });
    expect(pts).toBe(1050); // 500 base + 500 speed + 50 streak
  });

  test('streak cap: streaks above 5 do not add more than 250 streak bonus', async ({
    page,
  }) => {
    const pts = await computePoints(page, {
      correct: true,
      remainingMs: 30_000,
      totalMs: 30_000,
      streak: 10, // capped at 5 → bonus = 250
    });
    expect(pts).toBe(1250); // 500 base + 500 speed + 250 streak cap
  });
});

test.describe('rankPlayers', () => {
  async function rankPlayers(page, players) {
    return page.evaluate(async (input) => {
      const mod = await import('/src/utils/scoring.js');
      return mod.rankPlayers(input);
    }, players);
  }

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('ranks players in descending score order', async ({ page }) => {
    const ranked = await rankPlayers(page, {
      p1: { id: 'p1', name: 'Alice', score: 700 },
      p2: { id: 'p2', name: 'Bob', score: 300 },
      p3: { id: 'p3', name: 'Carol', score: 1000 },
    });
    expect(ranked.map((p) => p.name)).toEqual(['Carol', 'Alice', 'Bob']);
  });

  test('tie-breaks alphabetically by name', async ({ page }) => {
    const ranked = await rankPlayers(page, {
      p1: { id: 'p1', name: 'Zebra', score: 500 },
      p2: { id: 'p2', name: 'Apple', score: 500 },
    });
    expect(ranked[0].name).toBe('Apple');
    expect(ranked[1].name).toBe('Zebra');
  });

  test('player with no score property defaults to 0', async ({ page }) => {
    const ranked = await rankPlayers(page, {
      p1: { id: 'p1', name: 'Alice' }, // no score
      p2: { id: 'p2', name: 'Bob', score: 100 },
    });
    expect(ranked[0].name).toBe('Bob');
    expect(ranked[1].score).toBe(0);
  });

  test('single player returns an array of one', async ({ page }) => {
    const ranked = await rankPlayers(page, {
      p1: { id: 'p1', name: 'Solo', score: 200 },
    });
    expect(ranked).toHaveLength(1);
    expect(ranked[0].name).toBe('Solo');
  });

  test('empty players object returns empty array', async ({ page }) => {
    const ranked = await rankPlayers(page, {});
    expect(ranked).toEqual([]);
  });
});

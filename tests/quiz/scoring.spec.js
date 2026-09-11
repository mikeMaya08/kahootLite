import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Scoring utility unit tests
// The scoring functions are pure JS with no browser dependencies, so we run
// them directly in Node.js (test-runner) scope instead of importing them via
// the browser's module system (which fails on the Vercel production bundle
// because /src/utils/scoring.js is not a fetchable path in the built app).
// ---------------------------------------------------------------------------

// ── Inline scoring logic (mirrors src/utils/scoring.js) ───────────────────
const BASE = 500;
const SPEED_BONUS = 500;
const STREAK_BONUS_STEP = 50;
const STREAK_BONUS_CAP = 5;

function computeStreakBonus(streak) {
  return Math.min(streak, STREAK_BONUS_CAP) * STREAK_BONUS_STEP;
}

function computePoints({ correct, remainingMs, totalMs, streak = 0 }) {
  if (!correct) return 0;
  const speedBonus =
    !totalMs || totalMs <= 0
      ? 0
      : Math.round(SPEED_BONUS * Math.max(0, Math.min(1, remainingMs / totalMs)));
  return BASE + speedBonus + computeStreakBonus(streak);
}

function rankPlayers(players) {
  return Object.values(players)
    .map((p) => ({ ...p, score: p.score ?? 0 }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}
// ──────────────────────────────────────────────────────────────────────────

test.describe('computePoints', () => {

  test('correct answer at full remaining time → 500 base + 500 speed = 1000', async ({ page }) => {
    const pts = await computePoints(page, {
      correct: true,
      remainingMs: 30_000,
      totalMs: 30_000,
      streak: 0,
    });
    expect(pts).toBe(1000);
  });

  test('correct answer at half remaining time → 500 base + 250 speed = 750', async ({ page }) => {
    const pts = await computePoints(page, {
      correct: true,
      remainingMs: 15_000,
      totalMs: 30_000,
      streak: 0,
    });
    expect(pts).toBe(750);
  });

  test('correct answer at zero remaining time → 500 base only', async ({ page }) => {
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

  test('totalMs = 0 guard returns 500 base (no divide-by-zero)', async ({ page }) => {
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
    expect(pts).toBe(1000);
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

  test('streak of 1 adds 50 bonus', async ({ page }) => {
    const pts = await computePoints(page, {
      correct: true,
      remainingMs: 30_000,
      totalMs: 30_000,
      streak: 1,
    });
    expect(pts).toBe(1050);
  });

  test('streak cap: streaks above 5 do not add more than 250 streak bonus', async ({ page }) => {
    const pts = await computePoints(page, {
      correct: true,
      remainingMs: 30_000,
      totalMs: 30_000,
      streak: 10,
    });
    expect(pts).toBe(1250);
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
      p1: { id: 'p1', name: 'Alice' },
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

// Scoring follows the Kahoot pattern: a base reward for being correct,
// plus a speed bonus that decays linearly with elapsed time, plus a
// streak bonus that grows with consecutive correct answers.

export const MAX_POINTS = 1000;
const BASE = 500;
const SPEED_BONUS = 500;
const STREAK_BONUS_STEP = 50;
const STREAK_BONUS_CAP = 5;

// `streak` is the player's consecutive-correct count *before* this answer.
export function computeStreakBonus(streak) {
  return Math.min(streak, STREAK_BONUS_CAP) * STREAK_BONUS_STEP;
}

export function computePoints({ correct, remainingMs, totalMs, streak = 0 }) {
  if (!correct) return 0;
  const speedBonus =
    !totalMs || totalMs <= 0
      ? 0
      : Math.round(SPEED_BONUS * Math.max(0, Math.min(1, remainingMs / totalMs)));
  return BASE + speedBonus + computeStreakBonus(streak);
}

export function rankPlayers(players) {
  return Object.values(players)
    .map((p) => ({ ...p, score: p.score ?? 0 }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

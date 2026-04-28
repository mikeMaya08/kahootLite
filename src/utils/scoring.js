// Scoring follows the Kahoot pattern: a base reward for being correct,
// plus a speed bonus that decays linearly with elapsed time.

export const MAX_POINTS = 1000;
const BASE = 500;
const SPEED_BONUS = 500;

export function computePoints({ correct, remainingMs, totalMs }) {
  if (!correct) return 0;
  if (!totalMs || totalMs <= 0) return BASE;
  const ratio = Math.max(0, Math.min(1, remainingMs / totalMs));
  return BASE + Math.round(SPEED_BONUS * ratio);
}

export function rankPlayers(players) {
  return Object.values(players)
    .map((p) => ({ ...p, score: p.score ?? 0 }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

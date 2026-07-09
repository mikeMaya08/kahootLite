import React from 'react';
import { rankPlayers } from '../utils/scoring';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function Leaderboard({ players, highlightId, compact = false }) {
  const ranked = rankPlayers(players ?? {});

  if (ranked.length === 0) {
    return <p className="muted center">No players yet.</p>;
  }

  return (
    <ol className={`leaderboard ${compact ? 'leaderboard-compact' : ''}`}>
      {ranked.map((p, i) => (
        <li
          key={p.id}
          className={`lb-row ${highlightId === p.id ? 'lb-row-self' : ''}`}
        >
          <span className="lb-rank">{MEDALS[i] ?? `#${i + 1}`}</span>
          <span className="lb-avatar" aria-hidden="true">
            {p.emoji ?? '🙂'}
          </span>
          <span className="lb-name">{p.name}</span>
          <span className="lb-score">{p.score ?? 0}</span>
        </li>
      ))}
    </ol>
  );
}

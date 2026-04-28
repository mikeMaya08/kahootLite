import React from 'react';
import { useCountdown } from '../hooks/useCountdown';

export default function Timer({ endTime, totalMs, onExpire, label = 'Time' }) {
  const remaining = useCountdown(endTime, { onExpire });
  const seconds = Math.ceil(remaining / 1000);
  const ratio = totalMs > 0 ? Math.max(0, Math.min(1, remaining / totalMs)) : 0;
  const pct = Math.round(ratio * 100);

  let tone = 'good';
  if (ratio < 0.33) tone = 'bad';
  else if (ratio < 0.66) tone = 'warn';

  return (
    <div className={`timer timer-${tone}`} role="timer" aria-live="off">
      <div className="timer-bar">
        <div className="timer-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="timer-label">
        <span>{label}</span>
        <strong>{seconds}s</strong>
      </div>
    </div>
  );
}

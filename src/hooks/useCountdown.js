import { useEffect, useState, useRef } from 'react';

// Pure-clock countdown driven by `endTime` (ms epoch). Re-derives remaining
// time from Date.now() each tick rather than decrementing a counter, so it
// stays accurate across tab throttling and stays in sync between tabs that
// share the same endTime.
export function useCountdown(endTime, { onExpire, tickMs = 100 } = {}) {
  const [remaining, setRemaining] = useState(() =>
    endTime ? Math.max(0, endTime - Date.now()) : 0
  );
  const firedRef = useRef(false);

  useEffect(() => {
    firedRef.current = false;
    if (!endTime) {
      setRemaining(0);
      return;
    }

    const tick = () => {
      const left = Math.max(0, endTime - Date.now());
      setRemaining(left);
      if (left <= 0 && !firedRef.current) {
        firedRef.current = true;
        onExpire?.();
      }
    };

    tick();
    const id = setInterval(tick, tickMs);
    return () => clearInterval(id);
  }, [endTime, tickMs, onExpire]);

  return remaining;
}

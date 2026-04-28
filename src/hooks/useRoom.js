import { useCallback, useEffect, useState } from 'react';
import { KEYS, ROOM_EVENT, loadRoom, saveRoom } from '../utils/storage';

// Subscribes to a room's localStorage entry and returns [room, updateRoom].
//
// Cross-tab sync uses the native `storage` event (fires in OTHER tabs when
// a key changes). Same-tab sync uses our custom ROOM_EVENT, dispatched
// from saveRoom. This way every component in every tab stays in lockstep.
//
// updateRoom takes a function (current) => next so callers don't clobber
// concurrent writes from other tabs (e.g. two players joining at once).
export function useRoom(code) {
  const normalized = code ? code.toUpperCase() : null;
  const [room, setRoom] = useState(() => loadRoom(normalized));

  useEffect(() => {
    if (!normalized) {
      setRoom(null);
      return;
    }
    setRoom(loadRoom(normalized));

    const refresh = () => setRoom(loadRoom(normalized));

    const onStorage = (e) => {
      if (e.key === KEYS.ROOM(normalized)) refresh();
    };
    const onCustom = (e) => {
      if (e.detail?.code === normalized) refresh();
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener(ROOM_EVENT, onCustom);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(ROOM_EVENT, onCustom);
    };
  }, [normalized]);

  const updateRoom = useCallback(
    (updater) => {
      if (!normalized) return null;
      const current = loadRoom(normalized);
      if (!current) return null;
      const next = typeof updater === 'function' ? updater(current) : updater;
      if (!next) return null;
      saveRoom(normalized, next);
      return next;
    },
    [normalized]
  );

  return [room, updateRoom];
}

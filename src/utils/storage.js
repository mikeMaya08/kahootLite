// Centralized localStorage / sessionStorage access for the app.
// All persisted data uses a namespaced prefix so we don't collide with
// other apps running on the same origin during local dev.

const PREFIX = 'kahootlite:';

export const KEYS = {
  QUIZZES: `${PREFIX}quizzes`,
  ROOM: (code) => `${PREFIX}room:${code.toUpperCase()}`,
  ROOM_INDEX: `${PREFIX}rooms`,
  PREFS: `${PREFIX}prefs`,
};

export const ROOM_EVENT = 'kahootlite:room-update';

function safeGet(storage, key) {
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function safeSet(storage, key, value) {
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

// ---------- Quizzes ----------

export function loadQuizzes() {
  return safeGet(localStorage, KEYS.QUIZZES) ?? [];
}

export function saveQuizzes(quizzes) {
  safeSet(localStorage, KEYS.QUIZZES, quizzes);
}

export function upsertQuiz(quiz) {
  const list = loadQuizzes();
  const idx = list.findIndex((q) => q.id === quiz.id);
  if (idx >= 0) list[idx] = quiz;
  else list.push(quiz);
  saveQuizzes(list);
  return quiz;
}

export function deleteQuiz(id) {
  saveQuizzes(loadQuizzes().filter((q) => q.id !== id));
}

export function getQuiz(id) {
  return loadQuizzes().find((q) => q.id === id) ?? null;
}

// ---------- Rooms ----------

export function loadRoom(code) {
  if (!code) return null;
  return safeGet(localStorage, KEYS.ROOM(code));
}

export function saveRoom(code, room) {
  if (!code) return;
  safeSet(localStorage, KEYS.ROOM(code), room);
  // Same-tab listeners use this custom event because the native `storage`
  // event only fires in OTHER tabs, not the one that wrote the value.
  window.dispatchEvent(
    new CustomEvent(ROOM_EVENT, { detail: { code: code.toUpperCase() } })
  );
}

export function deleteRoom(code) {
  if (!code) return;
  localStorage.removeItem(KEYS.ROOM(code));
  window.dispatchEvent(
    new CustomEvent(ROOM_EVENT, { detail: { code: code.toUpperCase() } })
  );
}

// ---------- Prefs (theme, last-used name, etc.) ----------

export function loadPrefs() {
  return safeGet(localStorage, KEYS.PREFS) ?? {};
}

export function savePrefs(prefs) {
  safeSet(localStorage, KEYS.PREFS, prefs);
}

// Per-tab player identity. Using sessionStorage means each tab is an
// independent "player session" — perfect for simulating many players in
// one browser by opening multiple tabs.
export function getOrCreatePlayerId(prefix) {
  const KEY = `${PREFIX}playerId`;
  let id = sessionStorage.getItem(KEY);
  if (!id) {
    id = `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(KEY, id);
  }
  return id;
}

export function clearPlayerId() {
  sessionStorage.removeItem(`${PREFIX}playerId`);
}

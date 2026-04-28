// Random ID helpers — no external deps.

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous I/O/0/1

export function generateRoomCode(length = 6) {
  let out = '';
  const arr = new Uint32Array(length);
  crypto.getRandomValues(arr);
  for (let i = 0; i < length; i++) {
    out += ROOM_ALPHABET[arr[i] % ROOM_ALPHABET.length];
  }
  return out;
}

export function generateId(prefix = '') {
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  const hex = Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
  return prefix ? `${prefix}-${hex}` : hex;
}

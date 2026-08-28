// Deterministic seeded shuffle so a given student always sees the same
// order within one attempt (stable on refresh), but different students
// get different orders (harder to copy answers by position/number).

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromString(str) {
  let h = 0;
  if (!str) return h;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h;
}

export function seededShuffle(items = [], seedStr = '') {
  if (!Array.isArray(items)) return [];
  const rand = mulberry32(seedFromString(seedStr));
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// One random-ish id per browser tab, persisted so refresh doesn't reshuffle
export function getOrCreateSessionSeed() {
  const key = 'sust_exam_session_seed';
  let seed = typeof window !== 'undefined' ? sessionStorage.getItem(key) : null;
  if (!seed) {
    seed = Math.random().toString(36).slice(2);
    if (typeof window !== 'undefined') sessionStorage.setItem(key, seed);
  }
  return seed;
}

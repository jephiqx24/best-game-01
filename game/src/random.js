// A tiny seeded RNG (mulberry32) so level generation is deterministic: the same
// seed always deals the same puzzle, in the browser and in the build tools.

/** Create an RNG from a 32-bit seed. */
export function createRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** An integer in [0, n). */
export function intBelow(rng, n) {
  return Math.floor(rng() * n);
}

/** Shuffle a copy of `items` in place order. */
export function shuffle(rng, items) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = intBelow(rng, i + 1);
    const tmp = items[i];
    items[i] = items[j];
    items[j] = tmp;
  }
  return items;
}

/** Pick one element of a non-empty array. */
export function pick(rng, items) {
  return items[intBelow(rng, items.length)];
}

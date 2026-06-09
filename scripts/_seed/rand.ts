/* ============================================================================
 *  Deterministic PRNG so re-runs of the seeder produce identical data.
 *
 *  Mulberry32 — tiny, well-distributed, deterministic. Seeded with a fixed
 *  constant so every `npm run seed:test` lands the same dataset.
 * ========================================================================= */

const SEED = 0xC0FFEE;

let state = SEED;

function next32(): number {
  state |= 0;
  state = (state + 0x6D2B79F5) | 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Reset the PRNG to its initial seed. Call once at the top of each seed
 *  run so the data is identical across runs even after partial failures. */
export function resetRand(): void {
  state = SEED;
}

/** Random float in [0, 1). */
export function rand(): number {
  return next32();
}

/** Random integer in [min, max] inclusive. */
export function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

/** Pick one element from a non-empty array. */
export function pick<T>(arr: readonly T[]): T {
  if (arr.length === 0) throw new Error("pick() called on empty array");
  return arr[Math.floor(rand() * arr.length)]!;
}

/** Sample N distinct elements from `arr` without replacement. */
export function sample<T>(arr: readonly T[], n: number): T[] {
  if (n >= arr.length) return [...arr];
  const pool = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n; i++) {
    const j = Math.floor(rand() * pool.length);
    out.push(pool.splice(j, 1)[0]!);
  }
  return out;
}

/** Weighted choice. `entries` is `[value, weight]` pairs. */
export function weighted<T>(entries: ReadonlyArray<readonly [T, number]>): T {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [v, w] of entries) {
    r -= w;
    if (r <= 0) return v;
  }
  return entries[entries.length - 1]![0];
}

/** Boolean with `p` probability of true. */
export function chance(p: number): boolean {
  return rand() < p;
}

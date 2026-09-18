// ════════════════════════════════════════════════════════════════════════════
// Rng.ts — Seeded mulberry32 PRNG for deterministic obstacle spawning
// ════════════════════════════════════════════════════════════════════════════

export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed | 0;
  }

  /** Returns a float in [0, 1) */
  next(): number {
    this.state = (this.state + 0x6D2B79F5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns a float in [min, max) */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Returns an integer in [min, max] inclusive */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  /** Returns true with probability p */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Pick a random element from an array */
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)]!;
  }
}

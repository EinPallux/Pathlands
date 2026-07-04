// Seeded, streamable, serializable RNG — the ONLY source of randomness inside
// the simulation (CLAUDE.md §4, ARCHITECTURE.md §4). PCG32 (O'Neill 2014): tiny
// state, excellent statistical quality, fast, and trivially reproducible.
//
// The BigInt 64-bit state is deliberate: it makes replay determinism exact and
// platform-independent, which matters because the same generator must produce
// identical results on a player's browser and, in Phase 7, the authoritative
// server. Gameplay RNG volume is far below where BigInt cost would matter.

const MASK64 = (1n << 64n) - 1n;
const MASK32 = 0xffffffffn;
const PCG_MULT = 6364136223846793005n;
const DEFAULT_INC = 1442695040888963407n;
const TWO32 = 0x100000000; // 2^32

export interface RngState {
  s: string; // 64-bit state as decimal string
  i: string; // 64-bit stream increment as decimal string
}

/** A single PCG32 stream. */
export class Rng {
  private state: bigint;
  private inc: bigint;

  constructor(seed = 0x853c49e6748fea9bn, seq = DEFAULT_INC) {
    // Standard PCG seeding routine.
    this.inc = ((seq << 1n) | 1n) & MASK64;
    this.state = 0n;
    this.step();
    this.state = (this.state + (seed & MASK64)) & MASK64;
    this.step();
  }

  private step(): void {
    this.state = (this.state * PCG_MULT + this.inc) & MASK64;
  }

  /** Next uint32 in [0, 2^32). */
  nextUint32(): number {
    const old = this.state;
    this.step();
    const xorshifted = Number((((old >> 18n) ^ old) >> 27n) & MASK32) >>> 0;
    const rot = Number(old >> 59n);
    return ((xorshifted >>> rot) | (xorshifted << ((-rot >>> 0) & 31))) >>> 0;
  }

  /** Float in [0, 1). */
  float(): number {
    return this.nextUint32() / TWO32;
  }

  /** Float in [min, max). */
  range(min: number, max: number): number {
    return min + this.float() * (max - min);
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    if (max <= min) return min;
    const span = max - min + 1;
    return min + Math.floor(this.float() * span);
  }

  /** True with probability p (clamped 0..1). */
  chance(p: number): boolean {
    if (p <= 0) return false;
    if (p >= 1) return true;
    return this.float() < p;
  }

  bool(): boolean {
    return (this.nextUint32() & 1) === 1;
  }

  /** ±1 sign. */
  sign(): number {
    return this.bool() ? 1 : -1;
  }

  /** Uniform pick; caller guarantees non-empty. */
  pick<T>(arr: readonly T[]): T {
    return arr[this.int(0, arr.length - 1)]!;
  }

  /**
   * Weighted pick. `weights[i]` is the relative weight of `items[i]`.
   * Returns index. Non-positive total falls back to a uniform pick.
   */
  weightedIndex(weights: readonly number[]): number {
    let total = 0;
    for (const w of weights) total += w > 0 ? w : 0;
    if (total <= 0) return this.int(0, weights.length - 1);
    let roll = this.float() * total;
    for (let i = 0; i < weights.length; i++) {
      const w = weights[i]!;
      if (w <= 0) continue;
      roll -= w;
      if (roll < 0) return i;
    }
    return weights.length - 1;
  }

  weighted<T>(items: readonly T[], weights: readonly number[]): T {
    return items[this.weightedIndex(weights)]!;
  }

  /** In-place deterministic Fisher–Yates shuffle. */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      const tmp = arr[i]!;
      arr[i] = arr[j]!;
      arr[j] = tmp;
    }
    return arr;
  }

  /** Standard-normal sample via Box–Muller (uses two uniforms). */
  gaussian(mean = 0, stdev = 1): number {
    let u = 0;
    let v = 0;
    while (u === 0) u = this.float();
    while (v === 0) v = this.float();
    return mean + stdev * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /** A point uniformly inside a unit circle scaled by `radius`. */
  insideCircle(radius: number): { x: number; y: number } {
    const r = radius * Math.sqrt(this.float());
    const a = this.float() * Math.PI * 2;
    return { x: Math.cos(a) * r, y: Math.sin(a) * r };
  }

  serialize(): RngState {
    return { s: this.state.toString(), i: this.inc.toString() };
  }

  static deserialize(state: RngState): Rng {
    const rng = new Rng();
    rng.state = BigInt(state.s) & MASK64;
    rng.inc = BigInt(state.i) & MASK64;
    return rng;
  }
}

/** 32-bit FNV-1a hash of a string, mixed with a numeric salt. Used to derive
 *  independent stream seeds from a master seed + a stream name. */
export function hashStringSeed(name: string, salt: number): bigint {
  let h = 2166136261 ^ (salt >>> 0);
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // Spread the 32-bit hash across 64 bits for the PCG seed.
  const lo = BigInt(h >>> 0);
  const hi = BigInt(Math.imul(h ^ 0x9e3779b9, 2654435761) >>> 0);
  return ((hi << 32n) | lo) & MASK64;
}

/**
 * A collection of independent named RNG streams sharing a master seed. Draining
 * loot randomness never perturbs combat randomness, which keeps balance stable
 * and replays reproducible.
 */
export class RngStreams {
  private readonly streams = new Map<string, Rng>();

  constructor(private readonly masterSeed: number) {}

  stream(name: string): Rng {
    let rng = this.streams.get(name);
    if (!rng) {
      const seed = hashStringSeed(name, this.masterSeed);
      const seq = hashStringSeed(name, this.masterSeed ^ 0x51ed270b) | 1n;
      rng = new Rng(seed, seq);
      this.streams.set(name, rng);
    }
    return rng;
  }

  serialize(): { seed: number; streams: Record<string, RngState> } {
    const streams: Record<string, RngState> = {};
    for (const [name, rng] of this.streams) streams[name] = rng.serialize();
    return { seed: this.masterSeed, streams };
  }

  static deserialize(data: { seed: number; streams: Record<string, RngState> }): RngStreams {
    const s = new RngStreams(data.seed);
    for (const [name, state] of Object.entries(data.streams)) {
      s.streams.set(name, Rng.deserialize(state));
    }
    return s;
  }
}

/** Canonical stream names. Keep them stable — they seed independent sequences. */
export const RngStream = {
  Combat: 'combat',
  Loot: 'loot',
  Generation: 'generation',
  AI: 'ai',
  VFX: 'vfx', // presentation-only jitter derived deterministically; never affects sim state
} as const;

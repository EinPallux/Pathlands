import { describe, expect, it } from 'vitest';
import { Rng, RngStreams, hashStringSeed } from '../../src/sim/rng.ts';

describe('Rng (PCG32)', () => {
  it('is deterministic for a given seed', () => {
    const a = new Rng(12345n, 67890n);
    const b = new Rng(12345n, 67890n);
    const seqA = Array.from({ length: 64 }, () => a.nextUint32());
    const seqB = Array.from({ length: 64 }, () => b.nextUint32());
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = new Rng(1n, 1n);
    const b = new Rng(2n, 1n);
    const seqA = Array.from({ length: 16 }, () => a.nextUint32());
    const seqB = Array.from({ length: 16 }, () => b.nextUint32());
    expect(seqA).not.toEqual(seqB);
  });

  it('float() stays in [0, 1)', () => {
    const r = new Rng(99n);
    for (let i = 0; i < 5000; i++) {
      const f = r.float();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
    }
  });

  it('int() respects inclusive bounds', () => {
    const r = new Rng(7n);
    const counts = new Map<number, number>();
    for (let i = 0; i < 6000; i++) {
      const v = r.int(1, 6);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    // Every face of a d6 should show up.
    expect(counts.size).toBe(6);
  });

  it('float() has an approximately uniform mean', () => {
    const r = new Rng(2024n);
    let sum = 0;
    const n = 100_000;
    for (let i = 0; i < n; i++) sum += r.float();
    const mean = sum / n;
    expect(mean).toBeGreaterThan(0.49);
    expect(mean).toBeLessThan(0.51);
  });

  it('weightedIndex honours weights', () => {
    const r = new Rng(555n);
    const weights = [1, 0, 9]; // index 1 impossible, index 2 ~9x index 0
    const counts = [0, 0, 0];
    for (let i = 0; i < 10_000; i++) counts[r.weightedIndex(weights)]!++;
    expect(counts[1]).toBe(0);
    expect(counts[2]!).toBeGreaterThan(counts[0]! * 5);
  });

  it('serializes and restores exact state', () => {
    const r = new Rng(42n, 17n);
    for (let i = 0; i < 10; i++) r.nextUint32();
    const snap = r.serialize();
    const expected = Array.from({ length: 8 }, () => r.nextUint32());
    const restored = Rng.deserialize(snap);
    const actual = Array.from({ length: 8 }, () => restored.nextUint32());
    expect(actual).toEqual(expected);
  });
});

describe('RngStreams', () => {
  it('gives independent, stable streams', () => {
    const s = new RngStreams(1);
    const combatFirst = s.stream('combat').nextUint32();
    // Draining loot must not affect combat's next value.
    for (let i = 0; i < 100; i++) s.stream('loot').nextUint32();
    const s2 = new RngStreams(1);
    const combatFirst2 = s2.stream('combat').nextUint32();
    expect(combatFirst).toBe(combatFirst2);
  });

  it('round-trips through serialize/deserialize', () => {
    const s = new RngStreams(9);
    s.stream('combat').nextUint32();
    s.stream('loot').nextUint32();
    const snap = s.serialize();
    const expected = s.stream('combat').nextUint32();
    const restored = RngStreams.deserialize(snap);
    expect(restored.stream('combat').nextUint32()).toBe(expected);
  });
});

describe('hashStringSeed', () => {
  it('is stable and name-sensitive', () => {
    expect(hashStringSeed('combat', 1)).toBe(hashStringSeed('combat', 1));
    expect(hashStringSeed('combat', 1)).not.toBe(hashStringSeed('loot', 1));
    expect(hashStringSeed('combat', 1)).not.toBe(hashStringSeed('combat', 2));
  });
});

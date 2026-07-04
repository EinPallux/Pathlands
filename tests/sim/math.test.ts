import { describe, expect, it } from 'vitest';
import {
  angleDelta,
  clamp,
  inCone,
  lerp,
  moveToward,
  normalizeAngle,
  rotateToward,
  dist,
  normalize,
  len,
  TAU,
} from '../../src/sim/math.ts';

describe('scalar math', () => {
  it('clamp bounds values', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });

  it('lerp interpolates', () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(2, 4, 0)).toBe(2);
    expect(lerp(2, 4, 1)).toBe(4);
  });

  it('moveToward never overshoots', () => {
    expect(moveToward(0, 10, 3)).toBe(3);
    expect(moveToward(0, 2, 3)).toBe(2);
    expect(moveToward(10, 0, 3)).toBe(7);
  });
});

describe('angles', () => {
  it('normalizeAngle wraps to (-π, π]', () => {
    expect(normalizeAngle(0)).toBeCloseTo(0);
    expect(normalizeAngle(TAU)).toBeCloseTo(0);
    expect(normalizeAngle(Math.PI + 0.1)).toBeCloseTo(-Math.PI + 0.1, 5);
  });

  it('angleDelta gives the shortest signed arc', () => {
    expect(angleDelta(0, Math.PI / 2)).toBeCloseTo(Math.PI / 2);
    // From just-below-π to just-above-(-π) is a short positive hop across the seam.
    expect(Math.abs(angleDelta(3, -3))).toBeLessThan(1);
  });

  it('rotateToward respects the max step and lands exactly', () => {
    const r = rotateToward(0, 1, 0.25);
    expect(r).toBeCloseTo(0.25);
    expect(rotateToward(0, 0.1, 1)).toBeCloseTo(0.1);
  });
});

describe('vectors', () => {
  it('len and normalize', () => {
    expect(len({ x: 3, y: 4 })).toBe(5);
    const n = normalize({ x: 3, y: 4 });
    expect(len(n)).toBeCloseTo(1);
  });

  it('normalize of zero is zero (no NaN)', () => {
    expect(normalize({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
  });

  it('dist', () => {
    expect(dist({ x: 0, y: 0 }, { x: 0, y: 5 })).toBe(5);
  });

  it('inCone detects points inside a forward cone', () => {
    const origin = { x: 0, y: 0 };
    // Facing +x, 45° half-angle, range 3.
    expect(inCone({ x: 2, y: 0 }, origin, 0, Math.PI / 4, 3)).toBe(true);
    expect(inCone({ x: 2, y: 1.5 }, origin, 0, Math.PI / 4, 3)).toBe(true);
    expect(inCone({ x: -2, y: 0 }, origin, 0, Math.PI / 4, 3)).toBe(false); // behind
    expect(inCone({ x: 5, y: 0 }, origin, 0, Math.PI / 4, 3)).toBe(false); // too far
  });
});

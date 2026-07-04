// Deterministic math for the simulation. The sim runs on a top-down 2D plane:
// Vec2 {x, y} where x is world-right and y is world-forward. The render layer
// maps sim (x, y) → THREE world (x, elevation, y). Keep this the ONLY place that
// mapping is described.

export interface Vec2 {
  x: number;
  y: number;
}

export const TAU = Math.PI * 2;
export const HALF_PI = Math.PI / 2;
export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function invLerp(a: number, b: number, v: number): number {
  return a === b ? 0 : (v - a) / (b - a);
}

export function remap(v: number, inA: number, inB: number, outA: number, outB: number): number {
  return lerp(outA, outB, clamp01(invLerp(inA, inB, v)));
}

export function sign(v: number): number {
  return v > 0 ? 1 : v < 0 ? -1 : 0;
}

/** Move `current` toward `target` by at most `maxDelta`. */
export function moveToward(current: number, target: number, maxDelta: number): number {
  if (Math.abs(target - current) <= maxDelta) return target;
  return current + sign(target - current) * maxDelta;
}

/** Wrap an angle to (-π, π]. */
export function normalizeAngle(a: number): number {
  a = a % TAU;
  if (a <= -Math.PI) a += TAU;
  else if (a > Math.PI) a -= TAU;
  return a;
}

/** Shortest signed angular difference from `a` to `b`. */
export function angleDelta(a: number, b: number): number {
  return normalizeAngle(b - a);
}

/** Interpolate angles along the shortest arc. */
export function lerpAngle(a: number, b: number, t: number): number {
  return normalizeAngle(a + angleDelta(a, b) * t);
}

/** Rotate `current` angle toward `target` by at most `maxDelta` radians. */
export function rotateToward(current: number, target: number, maxDelta: number): number {
  const d = angleDelta(current, target);
  if (Math.abs(d) <= maxDelta) return normalizeAngle(target);
  return normalizeAngle(current + sign(d) * maxDelta);
}

// ---- Vec2 (allocating; convenient, used off the hot path) ----

export function v2(x = 0, y = 0): Vec2 {
  return { x, y };
}

export function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scale(a: Vec2, s: number): Vec2 {
  return { x: a.x * s, y: a.y * s };
}

export function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

/** 2D cross product (z-component); >0 means b is counter-clockwise from a. */
export function cross(a: Vec2, b: Vec2): number {
  return a.x * b.y - a.y * b.x;
}

export function lenSq(a: Vec2): number {
  return a.x * a.x + a.y * a.y;
}

export function len(a: Vec2): number {
  return Math.sqrt(a.x * a.x + a.y * a.y);
}

export function distSq(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function dist(a: Vec2, b: Vec2): number {
  return Math.sqrt(distSq(a, b));
}

export function normalize(a: Vec2): Vec2 {
  const l = len(a);
  return l > 1e-9 ? { x: a.x / l, y: a.y / l } : { x: 0, y: 0 };
}

export function fromAngle(angle: number, magnitude = 1): Vec2 {
  return { x: Math.cos(angle) * magnitude, y: Math.sin(angle) * magnitude };
}

export function angleOf(a: Vec2): number {
  return Math.atan2(a.y, a.x);
}

export function angleBetween(from: Vec2, to: Vec2): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

export function rotate(a: Vec2, angle: number): Vec2 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: a.x * c - a.y * s, y: a.x * s + a.y * c };
}

export function lerpVec(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

/** Clamp a vector's magnitude to `max`. */
export function clampLen(a: Vec2, max: number): Vec2 {
  const l2 = lenSq(a);
  if (l2 <= max * max) return { x: a.x, y: a.y };
  const l = Math.sqrt(l2);
  return { x: (a.x / l) * max, y: (a.y / l) * max };
}

/** Whether point p lies within `radius` of center c (cheap, squared). */
export function withinRadius(p: Vec2, c: Vec2, radius: number): boolean {
  return distSq(p, c) <= radius * radius;
}

/**
 * Whether `point` lies inside a cone from `origin` facing `facing` (radians)
 * with half-angle `halfAngle` and length `range`. Standard melee/AoE test.
 */
export function inCone(
  point: Vec2,
  origin: Vec2,
  facing: number,
  halfAngle: number,
  range: number,
): boolean {
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  const d2 = dx * dx + dy * dy;
  if (d2 > range * range) return false;
  if (d2 < 1e-6) return true;
  const a = Math.atan2(dy, dx);
  return Math.abs(angleDelta(facing, a)) <= halfAngle;
}

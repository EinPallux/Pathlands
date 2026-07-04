import type { World } from '../ecs/world.ts';
import type { Entity } from '../ecs/store.ts';
import type { SpatialHash } from '../spatial.ts';
import { FactionC, Health, Transform } from '../components.ts';
import type { Faction } from '../defs.ts';
import { angleDelta } from '../math.ts';

// Hit-query helpers shared by the skill, AI, and area systems. All go through
// the spatial hash and yield living hostiles in deterministic order.

export function hostileOf(f: Faction): Faction | 'none' {
  return f === 'player' ? 'enemy' : f === 'enemy' ? 'player' : 'none';
}

function isLivingHostile(world: World, e: Entity, hostile: Faction | 'none'): boolean {
  if (hostile === 'none') return false;
  const fac = world.get(e, FactionC);
  if (!fac || fac.value !== hostile) return false;
  const h = world.get(e, Health);
  return !!h && h.current > 0;
}

export function forEnemiesInCircle(
  world: World,
  spatial: SpatialHash,
  faction: Faction,
  x: number,
  y: number,
  radius: number,
  cb: (e: Entity) => void,
): void {
  const hostile = hostileOf(faction);
  const seen = new Set<Entity>();
  spatial.queryCircle(x, y, radius, (e) => {
    if (seen.has(e)) return;
    seen.add(e);
    if (isLivingHostile(world, e, hostile)) cb(e);
  });
}

export function forEnemiesInCone(
  world: World,
  spatial: SpatialHash,
  faction: Faction,
  x: number,
  y: number,
  facing: number,
  halfAngle: number,
  range: number,
  cb: (e: Entity) => void,
): void {
  const hostile = hostileOf(faction);
  const seen = new Set<Entity>();
  spatial.queryCircle(x, y, range, (e) => {
    if (seen.has(e)) return;
    seen.add(e);
    if (!isLivingHostile(world, e, hostile)) return;
    const tf = world.get(e, Transform);
    if (!tf) return;
    const dx = tf.x - x;
    const dy = tf.y - y;
    const d2 = dx * dx + dy * dy;
    if (d2 > range * range) return;
    if (d2 < 1e-4) {
      cb(e);
      return;
    }
    const a = Math.atan2(dy, dx);
    if (Math.abs(angleDelta(facing, a)) <= halfAngle) cb(e);
  });
}

/** Rectangle centred on the caster's forward axis: length forward, width across. */
export function forEnemiesInRect(
  world: World,
  spatial: SpatialHash,
  faction: Faction,
  ox: number,
  oy: number,
  dirAngle: number,
  length: number,
  width: number,
  cb: (e: Entity) => void,
): void {
  const hostile = hostileOf(faction);
  const cos = Math.cos(dirAngle);
  const sin = Math.sin(dirAngle);
  const halfW = width / 2;
  const cx = ox + cos * (length / 2);
  const cy = oy + sin * (length / 2);
  const searchR = Math.hypot(length / 2, halfW) + 1;
  const seen = new Set<Entity>();
  spatial.queryCircle(cx, cy, searchR, (e) => {
    if (seen.has(e)) return;
    seen.add(e);
    if (!isLivingHostile(world, e, hostile)) return;
    const tf = world.get(e, Transform);
    if (!tf) return;
    const rx = tf.x - ox;
    const ry = tf.y - oy;
    const along = rx * cos + ry * sin; // projection along forward axis
    const across = -rx * sin + ry * cos; // perpendicular
    if (along >= -0.3 && along <= length && Math.abs(across) <= halfW) cb(e);
  });
}

/** Distance from point p to segment a→b (for dash sweeps). */
export function pointSegmentDist(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const len2 = abx * abx + aby * aby;
  let t = len2 > 1e-6 ? ((px - ax) * abx + (py - ay) * aby) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const cx = ax + abx * t;
  const cy = ay + aby * t;
  return Math.hypot(px - cx, py - cy);
}

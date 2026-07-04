import type { World } from '../ecs/world.ts';
import type { Entity } from '../ecs/store.ts';
import { Buffs, Control, Stats, emptyControl, type ActiveBuff } from '../components.ts';
import { SIM_HZ } from '../constants.ts';
import type { BuffDef } from '../../content/types.ts';

// Buff/debuff and control application. Buffs contribute modifiers that the stat
// system folds in on recompute, so applying one just refreshes the entry and
// marks Stats dirty.

export function msToTicks(ms: number): number {
  return Math.max(1, Math.round((ms / 1000) * SIM_HZ));
}

export function addBuff(world: World, target: Entity, def: BuffDef, tick: number): void {
  let buffs = world.get(target, Buffs);
  if (!buffs) buffs = world.add(target, Buffs, { list: [] });
  const until = tick + msToTicks(def.durationMs);
  const existing = buffs.list.find((b) => b.id === def.id);
  if (existing) {
    existing.untilTick = Math.max(existing.untilTick, until);
    existing.stacks = Math.min(existing.stacks + 1, 5);
  } else {
    const entry: ActiveBuff = { id: def.id, untilTick: until, mods: def.mods, stacks: 1 };
    buffs.list.push(entry);
  }
  const stats = world.get(target, Stats);
  if (stats) stats.dirty = true;
}

export function applyStun(world: World, target: Entity, ms: number, tick: number): void {
  let c = world.get(target, Control);
  if (!c) c = world.add(target, Control, emptyControl());
  c.stunnedUntil = Math.max(c.stunnedUntil, tick + msToTicks(ms));
}

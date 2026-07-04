import type { Sim } from '../context.ts';
import type { Entity } from '../ecs/store.ts';
import { Buffs, Health, Resource, Stats } from '../components.ts';
import { computeStats, type Modifier } from '../combat/stats.ts';

// Buff expiry + stat recomputation. Buffs contribute modifiers on top of the
// persistent base mods; when anything changes we recompute the StatBlock and
// re-clamp pools without healing (max changes don't refill life).

export function buffSystem(sim: Sim): void {
  const world = sim.world;

  for (const [e, buffs] of world.view1(Buffs)) {
    if (buffs.list.length === 0) continue;
    let changed = false;
    for (let i = buffs.list.length - 1; i >= 0; i--) {
      if (sim.tick > buffs.list[i]!.untilTick) {
        buffs.list.splice(i, 1);
        changed = true;
      }
    }
    if (changed) {
      const s = world.get(e, Stats);
      if (s) s.dirty = true;
    }
  }

  for (const [e, stats] of world.view1(Stats)) {
    if (!stats.dirty) continue;
    stats.dirty = false;
    recomputeStats(sim, e, stats);
  }
}

export function recomputeStats(sim: Sim, e: Entity, stats: Stats): void {
  const world = sim.world;
  const buffs = world.get(e, Buffs);
  let mods: Modifier[] = stats.baseMods;
  if (buffs && buffs.list.length > 0) {
    mods = [...stats.baseMods];
    for (const b of buffs.list) mods.push(...b.mods);
  }
  const block = computeStats(stats.base, stats.level, mods);
  stats.block = block;

  const h = world.get(e, Health);
  if (h) {
    h.max = block.maxLife;
    if (h.current > h.max) h.current = h.max;
  }
  const r = world.get(e, Resource);
  if (r) {
    r.max = block.maxResource;
    if (r.current > r.max) r.current = r.max;
  }
}

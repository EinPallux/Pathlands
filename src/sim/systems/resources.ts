import type { Sim } from '../context.ts';
import { Health, PlayerControlled, Resource, Stats } from '../components.ts';

// Regeneration + resource generation. Life and (non-Wrath) resources regen from
// stats; Wrath builds from dealing/taking hits and decays out of combat, giving
// the Sentinel its combat-rhythm resource (GDD §3.1).

const WRATH_ON_HIT = 2.5;
const WRATH_ON_TAKE = 3.5;
const WRATH_DECAY_PER_SEC = 7;
const OUT_OF_COMBAT_MS = 3000;

export function resourceSystem(sim: Sim): void {
  const world = sim.world;
  const dt = sim.dt;

  for (const [e, h] of world.view1(Health)) {
    if (h.current <= 0) continue;
    const stats = world.get(e, Stats)?.block;
    if (!stats) continue;

    if (h.current < h.max && stats.lifeRegen > 0) {
      h.regenAccum += stats.lifeRegen * dt;
      if (h.regenAccum >= 1) {
        const add = Math.floor(h.regenAccum);
        h.regenAccum -= add;
        h.current = Math.min(h.max, h.current + add);
      }
    }

    const r = world.get(e, Resource);
    if (r && r.kind !== 'none') {
      if (r.kind === 'wrath') {
        if (sim.tick - h.lastDamagedTick > sim.msToTicks(OUT_OF_COMBAT_MS)) {
          r.current = Math.max(0, r.current - WRATH_DECAY_PER_SEC * dt);
        }
      } else if (stats.resourceRegen > 0 && r.current < r.max) {
        r.regenAccum += stats.resourceRegen * dt;
        if (r.regenAccum >= 1) {
          const add = Math.floor(r.regenAccum);
          r.regenAccum -= add;
          r.current = Math.min(r.max, r.current + add);
        }
      }
    }
  }

  // Wrath from this tick's combat.
  const player = sim.player;
  const pr = world.get(player, Resource);
  if (pr && pr.kind === 'wrath' && world.has(player, PlayerControlled)) {
    for (const d of sim.events.damage.all) {
      if (d.fromDot) continue;
      if (d.source === player) pr.current = Math.min(pr.max, pr.current + WRATH_ON_HIT);
      if (d.target === player) pr.current = Math.min(pr.max, pr.current + WRATH_ON_TAKE);
    }
  }
}

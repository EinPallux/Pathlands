import type { Sim } from '../context.ts';
import { Ailments, FactionC, Health } from '../components.ts';
import { applyDamage } from '../combat/damage.ts';
import type { AttackPayload } from '../combat/types.ts';
import { SIM_HZ } from '../constants.ts';
import type { Faction } from '../defs.ts';

// Ailment ticking: damaging DoTs (bleed/ignite/corruption) apply on a fixed
// cadence; expired ailments are pruned. Control ailments are consumed directly
// by the systems that read Control.

const DOT_INTERVAL = Math.round(SIM_HZ * 0.5); // twice per second

export function ailmentSystem(sim: Sim): void {
  const world = sim.world;
  for (const [e, ail] of world.view1(Ailments)) {
    if (ail.list.length === 0) continue;
    const h = world.get(e, Health);
    for (let i = ail.list.length - 1; i >= 0; i--) {
      const a = ail.list[i]!;
      if (h && h.current > 0 && sim.tick >= a.nextTick && sim.tick <= a.untilTick) {
        a.nextTick = sim.tick + DOT_INTERVAL;
        const owner: Faction = world.get(a.source, FactionC)?.value ?? 'enemy';
        const payload: AttackPayload = {
          source: a.source,
          ownerFaction: owner,
          skillId: `dot_${a.type}`,
          baseMin: a.dmgPerTick,
          baseMax: a.dmgPerTick,
          damageType: a.damageType,
          tags: [],
          increasedDamage: 0,
          moreDamage: 1,
          critChance: 0,
          critMulti: 1,
          canCrit: false,
          knockback: 0,
          hitStopMs: 0,
          lifeOnHit: 0,
          lifeLeech: 0,
        };
        applyDamage(world, e, payload, sim.combat, sim.events, sim.tick, { fromDot: true });
      }
      if (sim.tick > a.untilTick) ail.list.splice(i, 1);
    }
  }
}

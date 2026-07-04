import type { Sim } from '../context.ts';
import { NO_ENTITY } from '../ecs/store.ts';
import { AreaEffect, Transform } from '../components.ts';
import { applyDamage } from '../combat/damage.ts';
import { forEnemiesInCircle } from '../combat/queries.ts';

// Lingering area effects: ground fire, novas, telegraphed slams. Applies damage
// on its tick interval to living hostiles inside the radius, after any telegraph.

export function areaSystem(sim: Sim): void {
  const world = sim.world;

  for (const [, area, tf] of world.view2(AreaEffect, Transform)) {
    if (area.followSource !== NO_ENTITY) {
      const src = world.get(area.followSource, Transform);
      if (src) {
        tf.x = src.x;
        tf.y = src.y;
      }
    }
    if (sim.tick < area.telegraphUntil) continue;
    if (sim.tick < area.nextTick) continue;
    area.nextTick = sim.tick + area.tickInterval;

    forEnemiesInCircle(world, sim.spatial, area.ownerFaction, tf.x, tf.y, area.radius, (target) => {
      if (area.hitOnce && area.hitSet.has(target)) return;
      area.hitSet.add(target);
      applyDamage(world, target, area.payload, sim.combat, sim.events, sim.tick);
    });
  }
}

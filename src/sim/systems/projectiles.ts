import type { Sim } from '../context.ts';
import { FactionC, Health, Projectile, Transform } from '../components.ts';
import { applyDamage } from '../combat/damage.ts';
import { hostileOf } from '../combat/queries.ts';

// Projectile flight + collision. Projectiles carry a snapshotted payload and
// hit each target at most once; pierce lets them pass through.

export function projectileSystem(sim: Sim): void {
  const world = sim.world;
  const dt = sim.dt;
  const b = sim.zone.bounds;

  for (const [e, proj, tf] of world.view2(Projectile, Transform)) {
    tf.x += proj.dirX * proj.speed * dt;
    tf.y += proj.dirY * proj.speed * dt;

    const dx = tf.x - proj.originX;
    const dy = tf.y - proj.originY;
    if (dx * dx + dy * dy > proj.maxRangeSq) {
      world.destroy(e);
      continue;
    }
    if (tf.x < b.minX || tf.x > b.maxX || tf.y < b.minY || tf.y > b.maxY) {
      world.destroy(e);
      continue;
    }

    const hostile = hostileOf(proj.payload.ownerFaction);
    let consumed = false;
    sim.spatial.queryCircle(tf.x, tf.y, proj.radius + 0.6, (target) => {
      if (consumed || proj.hitSet.has(target)) return;
      const fac = world.get(target, FactionC);
      if (!fac || fac.value !== hostile) return;
      const h = world.get(target, Health);
      if (!h || h.current <= 0) return;
      proj.hitSet.add(target);
      applyDamage(world, target, proj.payload, sim.combat, sim.events, sim.tick);
      sim.events.sfx.emit({ cue: 'sfx_projectile_impact', x: tf.x, y: tf.y });
      if (proj.pierceLeft > 0) proj.pierceLeft -= 1;
      else consumed = true;
    });
    if (consumed) world.destroy(e);
  }
}

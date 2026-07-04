import type { Sim } from '../context.ts';
import { Boss, Collider, Control, MoveIntent, SkillUser, Stats, Transform, Velocity } from '../components.ts';
import { getSkill } from '../../content/index.ts';

// Movement + collision. Integrates MoveIntent/Velocity into Transform, honouring
// crowd control (stun/root/slow/knockback), agent-agent separation via the
// spatial hash, and zone bounds. No physics engine — circle colliders only
// (ARCHITECTURE.md §6).

function isMovementCast(skillId: string): boolean {
  const s = getSkill(skillId);
  return s.effect.type === 'dashStrike' || s.tags.includes('movement');
}

export function movementSystem(sim: Sim): void {
  const world = sim.world;
  const dt = sim.dt;

  for (const [e, tf, intent] of world.view2(Transform, MoveIntent)) {
    const vel = world.get(e, Velocity);
    const ctrl = world.get(e, Control);

    // Knockback overrides intent while active.
    if (vel && ctrl && ctrl.knockUntil > sim.tick) {
      tf.x += vel.x * dt;
      tf.y += vel.y * dt;
      vel.x *= 0.82;
      vel.y *= 0.82;
      clampBounds(sim, tf);
      continue;
    }
    if (vel && ctrl && ctrl.knockUntil > 0 && ctrl.knockUntil <= sim.tick) {
      vel.x = 0;
      vel.y = 0;
      ctrl.knockUntil = 0;
    }

    const stats = world.get(e, Stats)?.block;
    const su = world.get(e, SkillUser);
    const stunned = ctrl ? ctrl.stunnedUntil > sim.tick : false;
    const rooted = ctrl ? ctrl.rootedUntil > sim.tick : false;
    const castingLock =
      su && su.cast && sim.tick < su.cast.endTick ? !isMovementCast(su.cast.skillId) : false;

    let dx = 0;
    let dy = 0;
    if (!stunned && !rooted && !castingLock && intent.mode !== 'stop') {
      if (intent.mode === 'to') {
        dx = intent.toX - tf.x;
        dy = intent.toY - tf.y;
      } else {
        dx = intent.dirX;
        dy = intent.dirY;
      }
      const l = Math.hypot(dx, dy);
      const stopDist = intent.mode === 'to' ? 0.12 : 0;
      if (l <= stopDist || l < 1e-4) {
        dx = 0;
        dy = 0;
        if (intent.mode === 'to') intent.mode = 'stop';
      } else {
        dx /= l;
        dy /= l;
      }
    }

    const slow = ctrl && ctrl.slowUntil > sim.tick ? ctrl.slowMult : 1;
    const bossMove = world.get(e, Boss)?.moveMult ?? 1;
    const speed = (stats?.moveSpeed ?? 4) * slow * bossMove;
    if (dx !== 0 || dy !== 0) {
      tf.x += dx * speed * dt;
      tf.y += dy * speed * dt;
      tf.facing = Math.atan2(dy, dx);
    }

    clampBounds(sim, tf);
  }

  resolveOverlaps(sim);
}

function clampBounds(sim: Sim, tf: Transform): void {
  const b = sim.zone.bounds;
  if (tf.x < b.minX) tf.x = b.minX;
  else if (tf.x > b.maxX) tf.x = b.maxX;
  if (tf.y < b.minY) tf.y = b.minY;
  else if (tf.y > b.maxY) tf.y = b.maxY;
}

/** One relaxation pass pushing overlapping blocking colliders apart. */
function resolveOverlaps(sim: Sim): void {
  const world = sim.world;
  for (const [e, tf, col] of world.view2(Transform, Collider)) {
    if (!col.blocking) continue;
    sim.spatial.queryCircle(tf.x, tf.y, col.radius, (other, ox, oy, or) => {
      if (other === e) return;
      const otherCol = world.get(other, Collider);
      if (!otherCol || !otherCol.blocking) return;
      let nx = tf.x - ox;
      let ny = tf.y - oy;
      let d = Math.hypot(nx, ny);
      const minD = col.radius + or;
      if (d >= minD) return;
      if (d < 1e-4) {
        // Perfectly overlapping — nudge along a stable deterministic axis.
        nx = e > other ? 1 : -1;
        ny = 0;
        d = 1;
      } else {
        nx /= d;
        ny /= d;
      }
      const push = (minD - d) * 0.5;
      tf.x += nx * push;
      tf.y += ny * push;
    });
    clampBounds(sim, tf);
  }
}

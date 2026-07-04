import type { Sim } from '../context.ts';
import { NO_ENTITY, type Entity } from '../ecs/store.ts';
import { Boss, Brain, Control, Health, MoveIntent, SkillUser, Transform } from '../components.ts';
import { getBoss, getSkill } from '../../content/index.ts';
import type { SkillDef } from '../../content/types.ts';
import { tryStartCast } from './skills.ts';
import { angleBetween, dist } from '../math.ts';

// Enemy AI: aggro/leash, archetype positioning (melee close in, ranged kite to
// preferred range), telegraphed attacks via skill windups, and boss phase
// mechanics (GDD §8). Thinks a few times a second; movement carries intent
// between thinks.

const THINK_INTERVAL = 4; // ticks between decisions

function skillReach(skill: SkillDef): number {
  const e = skill.effect;
  switch (e.type) {
    case 'meleeArc':
      return e.range;
    case 'projectile':
      return e.range;
    case 'lineAoe':
      return e.length;
    case 'nova':
      return e.radius;
    default:
      return 2;
  }
}

export function aiSystem(sim: Sim): void {
  const world = sim.world;
  const ptf = world.get(sim.player, Transform);
  const phealth = world.get(sim.player, Health);
  const playerAlive = !sim.playerDead && !!phealth && phealth.current > 0 && !!ptf;

  for (const [e, brain, tf] of world.view2(Brain, Transform)) {
    const intent = world.get(e, MoveIntent);
    if (!intent) continue;
    const su = world.get(e, SkillUser);
    const ctrl = world.get(e, Control);

    // Boss phase progression + mechanics run regardless of think throttle.
    const boss = world.get(e, Boss);
    if (boss) updateBoss(sim, e, boss);

    // Busy casting / stunned → hold.
    if (su && su.cast && sim.tick < su.cast.endTick) {
      intent.mode = 'stop';
      continue;
    }
    if (ctrl && ctrl.stunnedUntil > sim.tick) {
      intent.mode = 'stop';
      continue;
    }

    if (sim.tick < brain.nextThinkTick) continue;
    brain.nextThinkTick = sim.tick + THINK_INTERVAL;

    const homeDist = Math.hypot(tf.x - brain.homeX, tf.y - brain.homeY);
    const d = playerAlive ? dist(tf, ptf!) : Infinity;

    if (playerAlive && brain.target === NO_ENTITY && d <= brain.aggroRange) {
      brain.target = sim.player;
      brain.state = 'chase';
    }
    if (!playerAlive || homeDist > brain.leashRange) {
      brain.target = NO_ENTITY;
      brain.state = 'return';
    }

    if (brain.target === NO_ENTITY) {
      if (homeDist > 0.6) {
        intent.mode = 'to';
        intent.toX = brain.homeX;
        intent.toY = brain.homeY;
      } else {
        intent.mode = 'stop';
        brain.state = 'idle';
      }
      continue;
    }

    if (!su || !su.slots[0] || !su.slots[0].skillId) {
      intent.mode = 'stop';
      continue;
    }
    const attackSkill = getSkill(su.slots[0].skillId);
    const reach = skillReach(attackSkill);
    const ranged = brain.archetype === 'ranged' || brain.archetype === 'caster';
    const want = ranged ? brain.preferredRange : Math.max(0.6, reach - 0.5);

    if (ranged) {
      if (d > want + 1.0) moveTo(intent, ptf!.x, ptf!.y);
      else if (d < want - 1.5) moveAway(intent, tf, ptf!);
      else {
        intent.mode = 'stop';
        tf.facing = angleBetween(tf, ptf!);
        tryStartCast(sim, e, 0, ptf!.x, ptf!.y);
      }
    } else {
      if (d > want) moveTo(intent, ptf!.x, ptf!.y);
      else {
        intent.mode = 'stop';
        tf.facing = angleBetween(tf, ptf!);
        tryStartCast(sim, e, 0, ptf!.x, ptf!.y);
      }
    }
  }
}

function moveTo(intent: MoveIntent, x: number, y: number): void {
  intent.mode = 'to';
  intent.toX = x;
  intent.toY = y;
}

function moveAway(intent: MoveIntent, tf: Transform, target: Transform): void {
  intent.mode = 'dir';
  intent.dirX = tf.x - target.x;
  intent.dirY = tf.y - target.y;
}

function updateBoss(sim: Sim, e: Entity, boss: Boss): void {
  const world = sim.world;
  const def = getBoss(boss.defId);
  const health = world.get(e, Health);
  const ptf = world.get(sim.player, Transform);
  if (!health) return;
  const frac = health.current / health.max;

  // Advance phase when life drops past the next threshold.
  const next = boss.phase + 1;
  if (next < def.phases.length && frac <= def.phases[next]!.lifeFraction) {
    boss.phase = next;
    const p = def.phases[next]!;
    boss.damageMult = p.damageMult;
    boss.moveMult = p.moveSpeedMult;
    boss.nextMechanicTick = sim.tick + sim.msToTicks(1200);
    sim.events.zone.emit({ kind: 'bossPhase', id: def.id, phase: next });
    sim.events.shake.emit({ trauma: 0.4 });
    sim.events.sfx.emit({ cue: 'sfx_boss_phase' });
  }

  // Fire a phase mechanic on interval when not already casting.
  const su = world.get(e, SkillUser);
  if (!su || (su.cast && sim.tick < su.cast.endTick) || !ptf) return;
  if (sim.tick < boss.nextMechanicTick) return;
  const phase = def.phases[boss.phase]!;
  if (phase.mechanicSkillIds.length === 0) return;
  const skillId = phase.mechanicSkillIds[sim.ai.int(0, phase.mechanicSkillIds.length - 1)]!;
  const slot = su.slots.findIndex((s) => s.skillId === skillId);
  if (slot >= 0 && tryStartCast(sim, e, slot, ptf.x, ptf.y)) {
    boss.nextMechanicTick = sim.tick + sim.msToTicks(phase.mechanicIntervalMs);
  }
}

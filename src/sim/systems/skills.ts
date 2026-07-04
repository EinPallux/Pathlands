import type { Sim } from '../context.ts';
import { NO_ENTITY, type Entity } from '../ecs/store.ts';
import {
  Boss,
  Brain,
  Control,
  FactionC,
  Invulnerable,
  Monster,
  PlayerControlled,
  Resource,
  SkillUser,
  Stats,
  Transform,
  type CastState,
} from '../components.ts';
import { getBoss, getBuff, getMonster, getSkill } from '../../content/index.ts';
import type { SkillDef } from '../../content/types.ts';
import { buildPayload } from '../combat/attack.ts';
import { applyDamage } from '../combat/damage.ts';
import { addBuff, applyStun } from '../combat/status.ts';
import {
  forEnemiesInCircle,
  forEnemiesInCone,
  forEnemiesInRect,
  hostileOf,
  pointSegmentDist,
} from '../combat/queries.ts';
import { spawnAreaEffect, spawnProjectile } from '../prefabs.ts';
import { weaponDamage } from '../character.ts';
import { DEG2RAD, clamp } from '../math.ts';
import type { Faction } from '../defs.ts';

// The skill system: cast lifecycle (windup → release → recovery) plus the
// declarative effect executor that realises each SkillEffect kind. Payloads are
// snapshotted at cast start (see combat/attack.ts).

function casterLevel(sim: Sim, e: Entity): number {
  if (sim.world.has(e, PlayerControlled)) return sim.sheet.level;
  const boss = sim.world.get(e, Boss);
  if (boss) return getBoss(boss.defId).level;
  const m = sim.world.get(e, Monster);
  if (m) return getMonster(m.defId).level;
  return 1;
}

function clampToBounds(sim: Sim, x: number, y: number): { x: number; y: number } {
  const b = sim.zone.bounds;
  return { x: clamp(x, b.minX, b.maxX), y: clamp(y, b.minY, b.maxY) };
}

/** Attempt to begin a cast. Returns true if the cast started. */
export function tryStartCast(
  sim: Sim,
  caster: Entity,
  slot: number,
  aimX: number,
  aimY: number,
): boolean {
  const world = sim.world;
  const su = world.get(caster, SkillUser);
  if (!su) return false;
  if (su.cast && sim.tick < su.cast.endTick) return false;
  if (sim.tick < su.gcdUntil) return false;
  const slotState = su.slots[slot];
  if (!slotState || !slotState.skillId) return false;
  if (sim.tick < slotState.cooldownUntil) return false;

  const ctrl = world.get(caster, Control);
  if (ctrl && ctrl.stunnedUntil > sim.tick) return false;

  const skill = getSkill(slotState.skillId);
  const stats = world.get(caster, Stats)?.block;
  const res = world.get(caster, Resource);
  const cost = skill.resourceCost;
  if (cost > 0 && res && res.kind !== 'none' && res.current < cost) return false;

  if (res && res.kind !== 'none') {
    if (cost > 0) res.current -= cost;
    else if (cost < 0) res.current = Math.min(res.max, res.current - cost);
  }

  const level = casterLevel(sim, caster);
  const faction: Faction = world.get(caster, FactionC)?.value ?? 'enemy';
  const weaponFlat = faction === 'player' ? weaponDamage(sim.sheet) : { min: 0, max: 0 };
  const payload = buildPayload(world, caster, skill, level, weaponFlat, faction);

  const haste = skill.scaleTimingWithHaste ? (stats?.attackSpeed ?? 1) : 1;
  const windup = Math.max(1, Math.round(sim.msToTicks(skill.windupMs) / haste));
  const recovery = Math.max(1, Math.round(sim.msToTicks(skill.recoveryMs) / haste));
  const cdRate = stats?.cooldownRate ?? 1;
  const cdTicks = skill.cooldownMs > 0 ? Math.max(1, Math.round(sim.msToTicks(skill.cooldownMs) / cdRate)) : 0;
  const releaseTick = sim.tick + windup;
  const endTick = releaseTick + recovery;
  slotState.cooldownUntil = releaseTick + cdTicks;
  su.gcdUntil = sim.tick + sim.msToTicks(70);

  const cast: CastState = {
    skillId: skill.id,
    slot,
    startTick: sim.tick,
    releaseTick,
    endTick,
    aimX,
    aimY,
    fired: false,
    payload,
    level,
  };
  su.cast = cast;

  const tf = world.get(caster, Transform);
  if (tf && skill.aim !== 'self') tf.facing = Math.atan2(aimY - tf.y, aimX - tf.x);
  sim.events.skillCast.emit({ caster, skillId: skill.id, x: tf?.x ?? 0, y: tf?.y ?? 0, aimX, aimY });
  return true;
}

function aimFacing(sim: Sim, caster: Entity, cast: CastState, skill: SkillDef): number {
  const tf = sim.world.get(caster, Transform)!;
  if (skill.aim === 'self') return tf.facing;
  const dx = cast.aimX - tf.x;
  const dy = cast.aimY - tf.y;
  return Math.hypot(dx, dy) < 1e-3 ? tf.facing : Math.atan2(dy, dx);
}

function executeEffect(sim: Sim, caster: Entity, skill: SkillDef, cast: CastState): void {
  const world = sim.world;
  const tf = world.get(caster, Transform);
  if (!tf) return;
  const faction = cast.payload.ownerFaction;
  const effect = skill.effect;
  const dealHit = (target: Entity): void => {
    applyDamage(world, target, cast.payload, sim.combat, sim.events, sim.tick);
  };

  switch (effect.type) {
    case 'meleeArc': {
      const facing = aimFacing(sim, caster, cast, skill);
      tf.facing = facing;
      forEnemiesInCone(
        world,
        sim.spatial,
        faction,
        tf.x,
        tf.y,
        facing,
        effect.halfAngleDeg * DEG2RAD,
        effect.range + 0.6,
        (target) => {
          dealHit(target);
          if (effect.stunMs) applyStun(world, target, effect.stunMs, sim.tick);
        },
      );
      break;
    }
    case 'nova': {
      forEnemiesInCircle(world, sim.spatial, faction, tf.x, tf.y, effect.radius, dealHit);
      break;
    }
    case 'lineAoe': {
      const facing = aimFacing(sim, caster, cast, skill);
      tf.facing = facing;
      forEnemiesInRect(world, sim.spatial, faction, tf.x, tf.y, facing, effect.length, effect.width, (target) => {
        dealHit(target);
        if (effect.stunMs) applyStun(world, target, effect.stunMs, sim.tick);
        if (effect.debuffId) addBuff(world, target, getBuff(effect.debuffId), sim.tick);
      });
      break;
    }
    case 'projectile': {
      const facing = aimFacing(sim, caster, cast, skill);
      tf.facing = facing;
      const count = effect.count ?? 1;
      const spread = (effect.spreadDeg ?? 0) * DEG2RAD;
      const lifeTicks = Math.ceil((effect.range / effect.speed) * (1 / sim.dt)) + 2;
      for (let i = 0; i < count; i++) {
        const t = count > 1 ? i / (count - 1) - 0.5 : 0;
        const a = facing + t * spread;
        const dx = Math.cos(a);
        const dy = Math.sin(a);
        spawnProjectile(world, sim.tick, cast.payload, tf.x + dx * 0.6, tf.y + dy * 0.6, dx, dy, {
          speed: effect.speed,
          radius: effect.radius,
          range: effect.range,
          pierce: effect.pierce ?? 0,
          vfx: skill.vfx,
          lifeTicks,
        });
      }
      break;
    }
    case 'dashStrike': {
      const facing = aimFacing(sim, caster, cast, skill);
      tf.facing = facing;
      const dx = Math.cos(facing);
      const dy = Math.sin(facing);
      const startX = tf.x;
      const startY = tf.y;
      const end = clampToBounds(sim, startX + dx * effect.distance, startY + dy * effect.distance);
      const midX = (startX + end.x) / 2;
      const midY = (startY + end.y) / 2;
      const searchR = Math.hypot(end.x - startX, end.y - startY) / 2 + effect.radius + 1;
      const hostile = hostileOf(faction);
      const hitOnce = new Set<Entity>();
      for (const target of sim.spatial.collectNear(midX, midY, searchR)) {
        if (hitOnce.has(target)) continue;
        hitOnce.add(target);
        const fac = world.get(target, FactionC);
        if (!fac || fac.value !== hostile) continue;
        const ttf = world.get(target, Transform);
        if (!ttf) continue;
        if (pointSegmentDist(ttf.x, ttf.y, startX, startY, end.x, end.y) <= effect.radius + 0.5) {
          dealHit(target);
          if (effect.stunMs) applyStun(world, target, effect.stunMs, sim.tick);
        }
      }
      tf.x = end.x;
      tf.y = end.y;
      // Brief i-frames make the charge feel like a commitment, not a liability.
      world.add(caster, Invulnerable, { untilTick: sim.tick + sim.msToTicks(180) });
      break;
    }
    case 'buff': {
      const def = getBuff(effect.buffId);
      addBuff(world, caster, def, sim.tick);
      if (effect.taunt) {
        const radius = effect.radius ?? 6;
        forEnemiesInCircle(world, sim.spatial, faction, tf.x, tf.y, radius, (target) => {
          const brain = world.get(target, Brain);
          if (brain) {
            brain.target = caster;
            if (brain.state === 'idle' || brain.state === 'patrol' || brain.state === 'return') {
              brain.state = 'chase';
            }
          }
        });
      }
      break;
    }
    case 'groundZone': {
      const originX = skill.aim === 'self' ? tf.x : cast.aimX;
      const originY = skill.aim === 'self' ? tf.y : cast.aimY;
      const telegraphUntil = sim.tick + sim.msToTicks(300);
      const endTick = sim.tick + sim.msToTicks(effect.durationMs);
      spawnAreaEffect(world, sim.tick, cast.payload, originX, originY, faction, {
        radius: effect.radius,
        tickInterval: sim.msToTicks(effect.tickMs),
        endTick,
        hitOnce: false,
        telegraphUntil,
        followSource: skill.aim === 'self' ? caster : NO_ENTITY,
        vfx: skill.vfx,
      });
      break;
    }
    default:
      break;
  }
}

/** Advance all in-progress casts: fire on release, clear on end. */
export function skillSystem(sim: Sim): void {
  for (const [e, su] of sim.world.view1(SkillUser)) {
    const cast = su.cast;
    if (!cast) continue;
    if (!cast.fired && sim.tick >= cast.releaseTick) {
      executeEffect(sim, e, getSkill(cast.skillId), cast);
      cast.fired = true;
    }
    if (sim.tick >= cast.endTick) su.cast = null;
  }
}

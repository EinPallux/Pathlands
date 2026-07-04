import type { World } from '../ecs/world.ts';
import type { Entity } from '../ecs/store.ts';
import type { Rng } from '../rng.ts';
import type { EventBus } from '../events.ts';
import {
  Boss,
  Control,
  Health,
  Invulnerable,
  Stats,
  Transform,
  Velocity,
  emptyControl,
} from '../components.ts';
import { armorMitigation } from './stats.ts';
import { applyAilment } from './ailments.ts';
import type { AttackPayload, DamageResult } from './types.ts';
import { clamp } from '../math.ts';
import { SIM_HZ } from '../constants.ts';

// The damage pipeline (GDD §5). Deterministic order:
//   base roll → ×(1+increased)×more → crit → mitigation (armor|resist) →
//   shock/curse amp → block → evasion(glance) → apply → leech → knockback →
//   ailment → feedback events.
// Every path emits the events the presentation layer needs so that "every
// damage event has hit VFX, hit SFX, and a damage number" (CLAUDE.md §4).

const KNOCK_SECONDS = 0.12;
const KNOCK_TICKS = Math.ceil(KNOCK_SECONDS * SIM_HZ);

const NONE: DamageResult = {
  dealt: 0,
  crit: false,
  killed: false,
  overkill: 0,
  blocked: false,
  evaded: false,
};

export interface ApplyOpts {
  fromDot?: boolean;
}

export function applyDamage(
  world: World,
  target: Entity,
  payload: AttackPayload,
  rng: Rng,
  events: EventBus,
  tick: number,
  opts: ApplyOpts = {},
): DamageResult {
  const fromDot = opts.fromDot ?? false;
  const health = world.get(target, Health);
  const tf = world.get(target, Transform);
  if (!health || !tf || health.current <= 0) return NONE;
  const { x, y } = tf;

  // i-frames (dodge roll, phase) fully negate direct hits.
  if (!fromDot) {
    const inv = world.get(target, Invulnerable);
    if (inv && inv.untilTick > tick) {
      events.hit.emit({ source: payload.source, target, type: payload.damageType, result: 'evaded', x, y, knockback: 0 });
      events.floatText.emit({ x, y, text: 'DODGE', kind: 'miss' });
      return { ...NONE, evaded: true };
    }
  }

  const stats = world.get(target, Stats)?.block;
  const control = world.get(target, Control);

  // 1. Roll base damage.
  let dmg = payload.baseMin + rng.float() * Math.max(0, payload.baseMax - payload.baseMin);

  // 2. Increased (additive) then more (multiplicative).
  dmg *= (1 + payload.increasedDamage) * payload.moreDamage;

  // 3. Crit.
  let crit = false;
  if (payload.canCrit && payload.critChance > 0 && rng.chance(payload.critChance)) {
    dmg *= payload.critMulti;
    crit = true;
  }

  // 4. Mitigation: physical uses armor (diminishing), else resistance.
  if (stats) {
    if (payload.damageType === 'physical') {
      dmg *= 1 - armorMitigation(stats.armor, dmg);
      dmg *= 1 - stats.resist.physical;
    } else {
      dmg *= 1 - stats.resist[payload.damageType];
    }
    // 5. Curse/shock damage-taken amplification.
    dmg *= stats.damageTakenMult;
  }
  if (control && control.shockUntil > tick) dmg *= 1 + control.shockAmp;

  // 6. Block (large reduction), 7. Evasion (glance for half).
  let blocked = false;
  let evaded = false;
  if (stats && stats.block > 0 && rng.chance(stats.block)) {
    dmg *= 0.15;
    blocked = true;
  }
  if (stats && stats.evasion > 0 && rng.chance(stats.evasion)) {
    dmg *= 0.5;
    evaded = true;
  }

  const dealt = dmg <= 0 ? 0 : Math.max(1, Math.round(dmg));

  // 8. Apply to life.
  const pre = health.current;
  health.current = pre - dealt;
  health.lastDamagedTick = tick;
  health.lastAttacker = payload.source;
  health.lastDamageType = payload.damageType;
  const killed = health.current <= 0;
  const overkill = killed ? Math.max(0, dealt - pre) : 0;

  // 9. Leech / life-on-hit for the attacker (direct hits only).
  if (!fromDot && dealt > 0) {
    let heal = payload.lifeOnHit + dealt * payload.lifeLeech;
    if (heal > 0) {
      const ah = world.get(payload.source, Health);
      const ac = world.get(payload.source, Control);
      if (ac && ac.healCutUntil > tick) heal *= 1 - ac.healCutPct;
      if (ah && ah.current > 0) ah.current = Math.min(ah.max, ah.current + heal);
    }
  }

  // 10. Knockback (direct hits; bosses immune).
  if (!fromDot && payload.knockback > 0 && dealt > 0 && !world.has(target, Boss)) {
    const stf = world.get(payload.source, Transform);
    const vel = world.get(target, Velocity);
    if (stf && vel) {
      let dx = tf.x - stf.x;
      let dy = tf.y - stf.y;
      const l = Math.hypot(dx, dy);
      if (l > 1e-4) {
        dx /= l;
        dy /= l;
      } else {
        dx = Math.cos(tf.facing);
        dy = Math.sin(tf.facing);
      }
      const mag = payload.knockback / KNOCK_SECONDS;
      vel.x = dx * mag;
      vel.y = dy * mag;
      const c = control ?? world.add(target, Control, emptyControl());
      c.knockUntil = tick + KNOCK_TICKS;
    }
  }

  // 11. Ailment (direct hits that dealt damage).
  if (!fromDot && dealt > 0 && payload.ailment && rng.chance(payload.ailment.chance)) {
    applyAilment(world, target, payload.ailment, payload.source, payload.damageType, tick);
  }

  // 12. Feedback.
  events.damage.emit({
    source: payload.source,
    target,
    amount: dealt,
    type: payload.damageType,
    crit,
    overkill,
    x,
    y,
    fromDot,
  });
  if (!fromDot) {
    events.hit.emit({
      source: payload.source,
      target,
      type: payload.damageType,
      result: blocked ? 'blocked' : evaded ? 'evaded' : crit ? 'crit' : 'hit',
      x,
      y,
      knockback: payload.knockback,
    });
    if (payload.ownerFaction === 'player' && (crit || killed) && payload.hitStopMs > 0) {
      events.hitStop.emit({ ms: payload.hitStopMs });
      events.shake.emit({ trauma: killed ? 0.28 : 0.16 });
    }
  }
  events.floatText.emit({
    x,
    y,
    text: blocked && dealt === 0 ? 'BLOCK' : String(dealt),
    kind: crit ? 'crit' : 'damage',
    damageType: payload.damageType,
  });

  return { dealt, crit, killed, overkill, blocked, evaded };
}

/** Direct healing with corruption's heal-cut respected. Returns life restored. */
export function heal(world: World, target: Entity, amount: number, tick: number): number {
  const h = world.get(target, Health);
  if (!h || h.current <= 0 || amount <= 0) return 0;
  const c = world.get(target, Control);
  let amt = amount;
  if (c && c.healCutUntil > tick) amt *= 1 - c.healCutPct;
  const before = h.current;
  h.current = Math.min(h.max, h.current + amt);
  return h.current - before;
}

export const clamp01Resist = (r: number): number => clamp(r, -1, 0.75);

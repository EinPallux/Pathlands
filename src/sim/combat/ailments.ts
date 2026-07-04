import type { World } from '../ecs/world.ts';
import type { Entity } from '../ecs/store.ts';
import { Ailments, Control, emptyControl, type ActiveAilment } from '../components.ts';
import type { AilmentApplication } from './types.ts';
import type { AilmentType, DamageType } from '../defs.ts';
import { SIM_HZ } from '../constants.ts';

// Ailment application (GDD §5). Damaging ailments (bleed/ignite/corruption) are
// DoTs tracked in the Ailments component and ticked by the ailment system.
// Control ailments (chill/freeze/shock) write transient state into Control,
// which movement and the damage pipeline already read.

function ensureAilments(world: World, e: Entity): Ailments {
  let a = world.get(e, Ailments);
  if (!a) a = world.add(e, Ailments, { list: [] });
  return a;
}

function ensureControl(world: World, e: Entity): Control {
  let c = world.get(e, Control);
  if (!c) c = world.add(e, Control, emptyControl());
  return c;
}

/** Refresh-or-replace a DoT of the same type; non-stacking but keeps the
 *  stronger tick and the longer duration (Phase 1 rule). */
function applyDot(
  world: World,
  target: Entity,
  type: AilmentType,
  damageType: DamageType,
  totalMagnitude: number,
  durationTicks: number,
  source: Entity,
  tick: number,
): void {
  const ail = ensureAilments(world, target);
  const ticks = Math.max(1, durationTicks);
  const perTick = totalMagnitude / ticks;
  const existing = ail.list.find((a) => a.type === type);
  if (existing) {
    existing.untilTick = Math.max(existing.untilTick, tick + ticks);
    existing.dmgPerTick = Math.max(existing.dmgPerTick, perTick);
    existing.source = source;
    existing.stacks = Math.min(existing.stacks + 1, 5);
  } else {
    const entry: ActiveAilment = {
      type,
      untilTick: tick + ticks,
      nextTick: tick + Math.round(SIM_HZ * 0.5), // DoTs tick twice per second
      dmgPerTick: perTick,
      damageType,
      source,
      stacks: 1,
    };
    ail.list.push(entry);
  }
}

/**
 * Apply an ailment to `target`. `hitDamage` is the (post-mitigation) size of the
 * triggering hit, used to scale control-ailment strength against the target.
 */
export function applyAilment(
  world: World,
  target: Entity,
  app: AilmentApplication,
  source: Entity,
  hitDamageType: DamageType,
  tick: number,
): void {
  switch (app.type) {
    case 'bleed':
      applyDot(world, target, 'bleed', 'physical', app.magnitude, app.durationTicks, source, tick);
      break;
    case 'ignite':
      applyDot(world, target, 'ignite', 'fire', app.magnitude, app.durationTicks, source, tick);
      break;
    case 'corruption': {
      applyDot(world, target, 'corruption', 'shadow', app.magnitude, app.durationTicks, source, tick);
      const c = ensureControl(world, target);
      c.healCutUntil = Math.max(c.healCutUntil, tick + app.durationTicks);
      c.healCutPct = Math.max(c.healCutPct, 0.5);
      break;
    }
    case 'chill': {
      const c = ensureControl(world, target);
      c.slowUntil = Math.max(c.slowUntil, tick + app.durationTicks);
      // magnitude is the slow fraction (0.3 = move 30% slower); keep the strongest.
      c.slowMult = Math.min(c.slowMult, 1 - Math.min(0.6, app.magnitude));
      break;
    }
    case 'freeze': {
      const c = ensureControl(world, target);
      c.stunnedUntil = Math.max(c.stunnedUntil, tick + app.durationTicks);
      break;
    }
    case 'shock': {
      const c = ensureControl(world, target);
      c.shockUntil = Math.max(c.shockUntil, tick + app.durationTicks);
      c.shockAmp = Math.max(c.shockAmp, Math.min(0.5, app.magnitude));
      break;
    }
    default:
      break;
  }
  void hitDamageType;
}

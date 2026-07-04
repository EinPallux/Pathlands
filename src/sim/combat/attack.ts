import type { World } from '../ecs/world.ts';
import type { Entity } from '../ecs/store.ts';
import { Boss, Stats } from '../components.ts';
import type { SkillDef, SkillEffect } from '../../content/types.ts';
import type { AttackPayload } from './types.ts';
import type { Faction } from '../defs.ts';

// Build the AttackPayload snapshot for a cast (ARCHITECTURE.md §9: damage math
// flows through the sim, never the renderer). Base damage scales with caster
// level and equipped weapon; multipliers/crit come from the caster's stats.

function effectKnockback(effect: SkillEffect): number {
  return 'knockback' in effect ? (effect.knockback ?? 0) : 0;
}

function effectAilment(effect: SkillEffect): AttackPayload['ailment'] {
  return 'ailment' in effect ? effect.ailment : undefined;
}

export function buildPayload(
  world: World,
  caster: Entity,
  skill: SkillDef,
  level: number,
  weaponFlat: { min: number; max: number },
  ownerFaction: Faction,
): AttackPayload {
  const stats = world.get(caster, Stats)?.block;
  const factor = 1 + (level - 1) * skill.perLevel;
  const bossMult = world.get(caster, Boss)?.damageMult ?? 1;
  return {
    source: caster,
    ownerFaction,
    skillId: skill.id,
    baseMin: skill.base.min * factor + weaponFlat.min,
    baseMax: skill.base.max * factor + weaponFlat.max,
    damageType: skill.damageType,
    tags: skill.tags,
    increasedDamage: stats?.increasedDamage ?? 0,
    moreDamage: (stats?.moreDamage ?? 1) * bossMult,
    critChance: skill.canCrit ? (stats?.critChance ?? 0) : 0,
    critMulti: stats?.critMulti ?? 1.5,
    canCrit: skill.canCrit,
    knockback: effectKnockback(skill.effect),
    hitStopMs: skill.hitStopMs,
    lifeOnHit: stats?.lifeOnHit ?? 0,
    lifeLeech: stats?.lifeLeech ?? 0,
    ailment: effectAilment(skill.effect),
  };
}

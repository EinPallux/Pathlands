import type { Entity } from '../ecs/store.ts';
import type { AilmentType, DamageType, Faction, SkillTag } from '../defs.ts';

// Combat value types shared by the damage pipeline and components. Deliberately
// import-free of components/world to keep the module graph acyclic.

/** How a skill applies an ailment on hit. */
export interface AilmentApplication {
  type: AilmentType;
  chance: number; // 0..1
  /** For DoTs: total damage dealt over the duration. For control: unused. */
  magnitude: number;
  durationTicks: number;
}

/**
 * A resolved attack, snapshotted at cast time so projectiles/DoTs in flight deal
 * consistent damage even if the attacker's stats change. Base damage is a range
 * rolled per hit (combat RNG) for feel.
 */
export interface AttackPayload {
  source: Entity;
  ownerFaction: Faction;
  skillId: string;
  baseMin: number;
  baseMax: number;
  damageType: DamageType;
  tags: readonly SkillTag[];
  increasedDamage: number;
  moreDamage: number;
  critChance: number;
  critMulti: number;
  canCrit: boolean;
  knockback: number; // metres of impulse
  hitStopMs: number; // hit-stop on crit/kill
  lifeOnHit: number;
  lifeLeech: number;
  ailment?: AilmentApplication;
}

export interface DamageResult {
  dealt: number;
  crit: boolean;
  killed: boolean;
  overkill: number;
  blocked: boolean;
  evaded: boolean;
}

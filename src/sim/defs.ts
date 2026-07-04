// Shared simulation enums used across combat, content, and events. Kept in one
// dependency-free module to avoid cycles.

export const DamageTypes = ['physical', 'fire', 'cold', 'lightning', 'shadow'] as const;
export type DamageType = (typeof DamageTypes)[number];

export const ElementalTypes = ['fire', 'cold', 'lightning'] as const;

export type Faction = 'player' | 'enemy' | 'neutral';

/** Status ailments. Damaging ailments carry a DoT; control ailments modify state. */
export const AilmentTypes = ['bleed', 'ignite', 'chill', 'freeze', 'shock', 'corruption'] as const;
export type AilmentType = (typeof AilmentTypes)[number];

export type Rarity = 'common' | 'magic' | 'rare' | 'unique' | 'set';

export const RarityOrder: Record<Rarity, number> = {
  common: 0,
  magic: 1,
  rare: 2,
  unique: 3,
  set: 4,
};

export type MonsterRank = 'normal' | 'elite' | 'rare' | 'boss';

/** Monster families (GDD §8). Phase 1 uses `riven` and `ashborn`. */
export const MonsterFamilies = [
  'riven',
  'hollowed',
  'ashborn',
  'broods',
  'constructs',
  'chorus',
  'beasts',
  'unpathed',
  'guardian',
] as const;
export type MonsterFamily = (typeof MonsterFamilies)[number];

/** The five playable classes (GDD §3). Phase 1 ships `sentinel`. */
export const ClassIds = ['sentinel', 'stormcaller', 'shadowblade', 'warden', 'ashkeeper'] as const;
export type ClassId = (typeof ClassIds)[number];

/** Attack tags used by skills, supports, and affix filters (GDD §6). */
export const SkillTags = [
  'melee',
  'ranged',
  'projectile',
  'area',
  'channel',
  'movement',
  'summon',
  'buff',
  'strike',
  'physical',
  'fire',
  'cold',
  'lightning',
  'shadow',
] as const;
export type SkillTag = (typeof SkillTags)[number];

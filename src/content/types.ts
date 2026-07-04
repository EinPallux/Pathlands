import type {
  ClassId,
  DamageType,
  MonsterFamily,
  MonsterRank,
  Rarity,
  SkillTag,
} from '../sim/defs.ts';
import type { ClassBaseStats, Modifier, ResourceKind } from '../sim/combat/stats.ts';
import type { AilmentApplication } from '../sim/combat/types.ts';

// Content schemas. Everything the designer touches is typed data validated at
// build time (tools/validate-content). Behaviour is expressed declaratively so
// skills, monsters, and items stay data, not code (CLAUDE.md §1.5).

export interface DamageRange {
  min: number;
  max: number;
}

// ---- Skills ----

export type AimType = 'point' | 'direction' | 'self';

/** Declarative skill effects, interpreted by the skill/projectile systems. */
export type SkillEffect =
  | {
      type: 'meleeArc';
      range: number;
      halfAngleDeg: number;
      knockback?: number;
      stunMs?: number;
      ailment?: AilmentApplication;
    }
  | {
      type: 'projectile';
      speed: number;
      radius: number;
      range: number;
      count?: number;
      spreadDeg?: number;
      pierce?: number;
      knockback?: number;
      ailment?: AilmentApplication;
    }
  | { type: 'dashStrike'; distance: number; radius: number; knockback?: number; stunMs?: number }
  | {
      type: 'lineAoe';
      length: number;
      width: number;
      knockback?: number;
      stunMs?: number;
      debuffId?: string;
      ailment?: AilmentApplication;
    }
  | { type: 'nova'; radius: number; knockback?: number; ailment?: AilmentApplication }
  | { type: 'buff'; buffId: string; radius?: number; taunt?: boolean }
  | {
      type: 'groundZone';
      radius: number;
      durationMs: number;
      tickMs: number;
      ailment?: AilmentApplication;
    };

export interface SkillDef {
  id: string;
  name: string;
  classId: ClassId | 'monster';
  description: string;
  icon: string;
  tags: SkillTag[];
  damageType: DamageType;
  /** Base damage at character level 1; scaled by `perLevel` and attacker stats. */
  base: DamageRange;
  perLevel: number; // fractional growth per level (0.08 = +8%/level)
  resourceCost: number; // negative = generates resource
  cooldownMs: number;
  windupMs: number; // anticipation before the effect fires (feel + telegraph)
  recoveryMs: number; // lockout after the effect
  scaleTimingWithHaste: boolean;
  aim: AimType;
  effect: SkillEffect;
  canCrit: boolean;
  hitStopMs: number;
  vfx: string;
  sfx: string;
  minLevel: number;
}

// ---- Buffs / debuffs ----

export interface BuffDef {
  id: string;
  name: string;
  icon: string;
  durationMs: number;
  mods: Modifier[];
  beneficial: boolean;
  /** Optional flat damage absorption pool (Bracing/Bulwark). */
  absorb?: number;
  vfx?: string;
}

// ---- Classes ----

export interface SkillSlotDef {
  slot: number;
  skillId: string;
}

export interface ClassDef {
  id: ClassId;
  name: string;
  title: string;
  fantasy: string;
  resourceKind: ResourceKind;
  resourceName: string;
  baseStats: ClassBaseStats;
  startingSkills: SkillSlotDef[];
  /** Skills unlocked at given levels (added to the bar or available). */
  skillUnlocks: { level: number; skillId: string }[];
  startingWeapon: string; // item base id
  modelKind: string; // render model id
}

// ---- Items & affixes ----

export type EquipSlot =
  | 'weapon'
  | 'offhand'
  | 'helm'
  | 'chest'
  | 'gloves'
  | 'boots'
  | 'belt'
  | 'ring'
  | 'amulet';

export interface ItemBaseDef {
  id: string;
  name: string;
  slot: EquipSlot;
  classReq?: ClassId;
  levelReq: number;
  icon: string;
  /** Weapons: flat weapon damage range and attack type. */
  weaponDamage?: DamageRange;
  weaponDamageType?: DamageType;
  /** Implicit modifiers every instance of this base rolls with. */
  implicits: Modifier[];
  tags: string[];
}

export type AffixKind = 'prefix' | 'suffix';

export interface AffixTier {
  tier: number;
  ilvl: number; // minimum item level
  min: number;
  max: number;
  weight: number;
}

export interface AffixDef {
  id: string;
  name: string;
  kind: AffixKind;
  stat: Modifier['stat'];
  mode: Modifier['mode'];
  /** Slots this affix can appear on. */
  slots: EquipSlot[];
  tiers: AffixTier[];
  /** Higher = more likely; smart-loot may bias toward class tags. */
  tags: string[];
}

// ---- Loot ----

export interface LootEntry {
  kind: 'item' | 'unique' | 'nothing';
  /** For 'item': the base pool tag to draw from; for 'unique': the unique id. */
  ref?: string;
  weight: number;
  rarityWeights?: Partial<Record<Rarity, number>>;
}

export interface LootTableDef {
  id: string;
  /** Expected number of drop rolls. */
  rolls: number;
  entries: LootEntry[];
  goldMin: number;
  goldMax: number;
  globeChance: number;
}

export interface UniqueDef {
  id: string;
  name: string;
  baseId: string;
  rarity: 'unique';
  icon: string;
  flavor: string;
  fixedMods: Modifier[];
  /** Human-readable special rules (rendered on the tooltip). */
  rulesText: string[];
  levelReq: number;
}

// ---- Monsters ----

export interface MonsterDef {
  id: string;
  name: string;
  family: MonsterFamily;
  rank: MonsterRank;
  archetype: 'melee' | 'ranged' | 'caster' | 'brute' | 'swarm';
  level: number;
  life: number;
  lifePerLevel: number;
  armor: number;
  resist: Partial<Record<DamageType, number>>;
  moveSpeed: number;
  colliderRadius: number;
  height: number;
  aggroRange: number;
  leashRange: number;
  preferredRange: number;
  attackSkillId: string;
  xp: number;
  lootTableId: string;
  goldMin: number;
  goldMax: number;
  modelKind: string;
  modelVariant: string;
  tint: number;
  scale: number;
}

export interface EliteAffixDef {
  id: string;
  name: string;
  description: string;
  /** Stat mods granted to the elite. */
  mods: Modifier[];
  /** Optional special behaviour flag interpreted by AI/aura systems. */
  behavior?: 'frozenAura' | 'volatile' | 'shielding' | 'vampiric' | 'storming' | 'fierce';
  auraColor?: number;
}

export interface BossPhaseDef {
  lifeFraction: number; // enters this phase at/under this life fraction
  mechanicIntervalMs: number;
  mechanicSkillIds: string[];
  moveSpeedMult: number;
  damageMult: number;
}

export interface BossDef extends MonsterDef {
  phases: BossPhaseDef[];
  introText: string;
  title: string;
}

// ---- Zones ----

export interface SpawnPack {
  monsterId: string;
  count: number;
  x: number;
  y: number;
  radius: number;
  eliteAffixes?: string[]; // if present, the pack leader is an elite
}

export interface ZoneProp {
  kind: string;
  x: number;
  y: number;
  rot: number;
  scale: number;
}

export interface ZoneInteractable {
  kind: 'waypoint' | 'shrine' | 'chest' | 'exit';
  id: string;
  x: number;
  y: number;
  prompt: string;
}

export interface ZoneDef {
  id: string;
  name: string;
  subtitle: string;
  biome: string;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  playerStart: { x: number; y: number };
  ambientLight: number; // hex
  keyLight: number; // hex
  keyLightDir: { x: number; y: number; z: number };
  fogColor: number;
  fogDensity: number;
  groundColor: number;
  music: string;
  ambience: string;
  packs: SpawnPack[];
  props: ZoneProp[];
  interactables: ZoneInteractable[];
  boss?: { defId: string; x: number; y: number; arenaRadius: number };
  recommendedLevel: number;
}

export { type ClassId, type MonsterFamily, type MonsterRank, type Rarity, type SkillTag, type DamageType };

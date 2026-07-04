import type { DamageType } from '../defs.ts';
import { clamp } from '../math.ts';

// The stat system. Every source of power — class base curve, gear affixes,
// passive web nodes (Phase 2), buffs — contributes typed Modifiers, which are
// folded into a StatBlock by `computeStats`. This modifier engine (flat → then
// increased%, additive → then more%, multiplicative) is the PoE-style backbone
// that makes two builds of one class feel different (GDD §5/§6).

export type ResourceKind = 'none' | 'wrath' | 'mana' | 'combo' | 'essence' | 'cinders';

export interface Attributes {
  might: number;
  precision: number;
  will: number;
  vitality: number;
}

export type Resistances = Record<DamageType, number>;

export interface StatBlock {
  attributes: Attributes;
  maxLife: number;
  lifeRegen: number; // per second
  resourceKind: ResourceKind;
  maxResource: number;
  resourceRegen: number; // per second
  critChance: number; // 0..1
  critMulti: number; // damage multiplier on crit, e.g. 1.5
  attackSpeed: number; // multiplier, 1 = base
  castSpeed: number; // multiplier
  cooldownRate: number; // multiplier, 1 = base; higher = faster cooldowns
  armor: number;
  resist: Resistances; // fractions, capped by maxResist
  maxResist: Resistances;
  block: number; // 0..1 chance
  evasion: number; // 0..1 chance to glance
  moveSpeed: number; // metres/sec
  increasedDamage: number; // additive increased% bucket (0.2 = +20%)
  moreDamage: number; // multiplicative product (1 = none)
  areaMult: number;
  projectileSpeedMult: number;
  extraProjectiles: number;
  lifeOnHit: number;
  lifeLeech: number; // fraction of damage dealt returned as life
  thorns: number;
  damageTakenMult: number; // 1 = normal; shock/curses raise it
}

export type StatKey =
  | 'might'
  | 'precision'
  | 'will'
  | 'vitality'
  | 'life'
  | 'lifeRegen'
  | 'resource'
  | 'resourceRegen'
  | 'armor'
  | 'resistPhysical'
  | 'resistFire'
  | 'resistCold'
  | 'resistLightning'
  | 'resistShadow'
  | 'allResist'
  | 'critChance'
  | 'critMulti'
  | 'attackSpeed'
  | 'castSpeed'
  | 'cooldownRate'
  | 'moveSpeed'
  | 'damage'
  | 'area'
  | 'projectileSpeed'
  | 'extraProjectiles'
  | 'lifeOnHit'
  | 'lifeLeech'
  | 'thorns'
  | 'block'
  | 'evasion'
  | 'damageTaken';

export type ModMode = 'flat' | 'inc' | 'more';

export interface Modifier {
  stat: StatKey;
  mode: ModMode;
  value: number;
}

// ---- Attribute → derived coefficients. Balance knobs; tuned via sim-bench. ----
const LIFE_PER_VITALITY = 6;
const LIFE_PER_LEVEL_MULT = 1; // scales classDef.lifePerLevel
const DMG_INC_PER_MIGHT = 0.01; // +1% increased damage per Might
const DMG_INC_PER_WILL = 0.008; // Will also grants damage (casters)
const CRIT_PER_PRECISION = 0.002; // +0.2% crit chance per Precision
const RESOURCE_PER_WILL = 0.5;

export interface ClassBaseStats {
  attributes: Attributes;
  attributesPerLevel: Attributes;
  baseLife: number;
  lifePerLevel: number;
  lifeRegen: number;
  resourceKind: ResourceKind;
  baseResource: number;
  resourceRegen: number;
  baseCritChance: number;
  baseCritMulti: number;
  baseMoveSpeed: number;
  baseArmor: number;
}

interface Accum {
  flat: number;
  inc: number;
  more: number;
}

function emptyAccum(): Accum {
  return { flat: 0, inc: 0, more: 1 };
}

/** Group modifiers by stat into flat/inc/more accumulators. */
function accumulate(mods: readonly Modifier[]): Map<StatKey, Accum> {
  const map = new Map<StatKey, Accum>();
  const get = (k: StatKey): Accum => {
    let a = map.get(k);
    if (!a) {
      a = emptyAccum();
      map.set(k, a);
    }
    return a;
  };
  for (const m of mods) {
    const a = get(m.stat);
    if (m.mode === 'flat') a.flat += m.value;
    else if (m.mode === 'inc') a.inc += m.value;
    else a.more *= 1 + m.value;
    // 'allResist' fans out to the five resist stats as flat/inc below.
  }
  return map;
}

function applyKey(base: number, acc: Map<StatKey, Accum>, key: StatKey): number {
  const a = acc.get(key);
  if (!a) return base;
  return (base + a.flat) * (1 + a.inc) * a.more;
}

/**
 * Compute a full StatBlock from a class base curve, a level, and a flat list of
 * modifiers (from gear/passives/buffs). Pure and deterministic.
 */
export function computeStats(
  base: ClassBaseStats,
  level: number,
  mods: readonly Modifier[],
): StatBlock {
  const acc = accumulate(mods);
  const lv = Math.max(1, level) - 1;

  // Attributes: class base + per-level growth, then flats/inc.
  const might = applyKey(base.attributes.might + base.attributesPerLevel.might * lv, acc, 'might');
  const precision = applyKey(
    base.attributes.precision + base.attributesPerLevel.precision * lv,
    acc,
    'precision',
  );
  const will = applyKey(base.attributes.will + base.attributesPerLevel.will * lv, acc, 'will');
  const vitality = applyKey(
    base.attributes.vitality + base.attributesPerLevel.vitality * lv,
    acc,
    'vitality',
  );

  // Life scales with class base, level, and Vitality.
  const baseLife = base.baseLife + base.lifePerLevel * LIFE_PER_LEVEL_MULT * lv + vitality * LIFE_PER_VITALITY;
  const maxLife = Math.round(applyKey(baseLife, acc, 'life'));

  const maxResource = Math.round(
    applyKey(base.baseResource + will * RESOURCE_PER_WILL, acc, 'resource'),
  );

  const critChance = clamp(
    applyKey(base.baseCritChance + precision * CRIT_PER_PRECISION, acc, 'critChance'),
    0,
    1,
  );
  const critMulti = applyKey(base.baseCritMulti, acc, 'critMulti');

  // Damage: attribute contribution folds into the increased bucket.
  const attrDamageInc = might * DMG_INC_PER_MIGHT + will * DMG_INC_PER_WILL;
  const dmgAcc = acc.get('damage') ?? emptyAccum();
  const increasedDamage = attrDamageInc + dmgAcc.inc;
  const moreDamage = dmgAcc.more;

  const resistFlatInc = (key: StatKey): number => {
    const specific = acc.get(key);
    const all = acc.get('allResist');
    const flat = (specific?.flat ?? 0) + (all?.flat ?? 0);
    const inc = (specific?.inc ?? 0) + (all?.inc ?? 0);
    return (flat) * (1 + inc);
  };
  const maxResist: Resistances = {
    physical: 0.75,
    fire: 0.75,
    cold: 0.75,
    lightning: 0.75,
    shadow: 0.75,
  };
  const resist: Resistances = {
    physical: clamp(resistFlatInc('resistPhysical'), -1, maxResist.physical),
    fire: clamp(resistFlatInc('resistFire'), -1, maxResist.fire),
    cold: clamp(resistFlatInc('resistCold'), -1, maxResist.cold),
    lightning: clamp(resistFlatInc('resistLightning'), -1, maxResist.lightning),
    shadow: clamp(resistFlatInc('resistShadow'), -1, maxResist.shadow),
  };

  return {
    attributes: { might, precision, will, vitality },
    maxLife,
    lifeRegen: applyKey(base.lifeRegen, acc, 'lifeRegen'),
    resourceKind: base.resourceKind,
    maxResource,
    resourceRegen: applyKey(base.resourceRegen, acc, 'resourceRegen'),
    critChance,
    critMulti,
    attackSpeed: applyKey(1, acc, 'attackSpeed'),
    castSpeed: applyKey(1, acc, 'castSpeed'),
    cooldownRate: applyKey(1, acc, 'cooldownRate'),
    armor: Math.max(0, applyKey(base.baseArmor, acc, 'armor')),
    resist,
    maxResist,
    block: clamp(applyKey(0, acc, 'block'), 0, 0.75),
    evasion: clamp(applyKey(0, acc, 'evasion'), 0, 0.75),
    moveSpeed: applyKey(base.baseMoveSpeed, acc, 'moveSpeed'),
    increasedDamage,
    moreDamage,
    areaMult: applyKey(1, acc, 'area'),
    projectileSpeedMult: applyKey(1, acc, 'projectileSpeed'),
    extraProjectiles: Math.round(applyKey(0, acc, 'extraProjectiles')),
    lifeOnHit: applyKey(0, acc, 'lifeOnHit'),
    lifeLeech: applyKey(0, acc, 'lifeLeech'),
    thorns: applyKey(0, acc, 'thorns'),
    damageTakenMult: applyKey(1, acc, 'damageTaken'),
  };
}

/**
 * Armor mitigation: diminishing, PoE-style — armor reduces a hit by
 * armor / (armor + K·rawDamage). Big hits punch through armor; chip damage is
 * heavily reduced. Returns the mitigated fraction in [0, 0.9].
 */
export function armorMitigation(armor: number, rawDamage: number): number {
  if (armor <= 0 || rawDamage <= 0) return 0;
  const k = 8;
  return clamp(armor / (armor + k * rawDamage), 0, 0.9);
}

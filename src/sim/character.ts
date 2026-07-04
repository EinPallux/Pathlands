import type { EquipSlot } from '../content/types.ts';
import { getClass } from '../content/index.ts';
import { rollUnique, type ItemInstance, itemMods } from './items/generate.ts';
import type { Modifier } from './combat/stats.ts';
import { getItemBase } from '../content/index.ts';

// The persistent character sheet: everything that defines a hero across saves.
// Combat-relevant state (Stats/Health/Resource) is derived from this into ECS
// components; this object is the source of truth and the save payload.

export const SKILL_SLOTS = 6;

export interface CharacterSheet {
  classId: string;
  name: string;
  level: number;
  xp: number;
  gold: number;
  potions: number;
  equipment: Partial<Record<EquipSlot, ItemInstance>>;
  inventory: ItemInstance[];
  skillBar: (string | null)[];
  unlocked: string[];
  waypointsAttuned: string[];
  bossDefeated: string[];
}

/** XP required to advance from `level` to `level + 1`. */
export function xpToNext(level: number): number {
  return Math.round(50 * Math.pow(level, 1.55));
}

export function xpTotalForLevel(level: number): number {
  let sum = 0;
  for (let l = 1; l < level; l++) sum += xpToNext(l);
  return sum;
}

/** Rebuild the skill bar from class starting skills + level-unlocked skills. */
export function rebuildSkillBar(sheet: CharacterSheet): void {
  const cls = getClass(sheet.classId);
  const bar: (string | null)[] = new Array(SKILL_SLOTS).fill(null);
  for (const s of cls.startingSkills) {
    if (s.slot < SKILL_SLOTS) bar[s.slot] = s.skillId;
  }
  const unlocked = cls.skillUnlocks
    .filter((u) => u.level <= sheet.level)
    .map((u) => u.skillId);
  for (const skillId of unlocked) {
    if (bar.includes(skillId)) continue;
    const free = bar.indexOf(null);
    if (free >= 0) bar[free] = skillId;
  }
  sheet.skillBar = bar;
  // Track the full unlocked list for menus/respec later.
  const set = new Set<string>(cls.startingSkills.map((s) => s.skillId));
  for (const u of unlocked) set.add(u);
  sheet.unlocked = [...set];
}

/** Sum of all modifiers from equipped items. */
export function equipmentMods(sheet: CharacterSheet): Modifier[] {
  const mods: Modifier[] = [];
  for (const slot of Object.keys(sheet.equipment) as EquipSlot[]) {
    const item = sheet.equipment[slot];
    if (item) mods.push(...itemMods(item));
  }
  return mods;
}

/** Flat weapon damage contributed by the equipped weapon (added to skill base). */
export function weaponDamage(sheet: CharacterSheet): { min: number; max: number } {
  const wpn = sheet.equipment.weapon;
  if (!wpn) return { min: 0, max: 0 };
  const base = getItemBase(wpn.baseId);
  return base.weaponDamage ? { ...base.weaponDamage } : { min: 0, max: 0 };
}

let starterItemCounter = 0;
function starterId(): string {
  return `start_${starterItemCounter++}`;
}

/** Create a fresh level-1 character with starting gear equipped. */
export function createCharacter(classId: string, name: string): CharacterSheet {
  const cls = getClass(classId);
  const sheet: CharacterSheet = {
    classId,
    name,
    level: 1,
    xp: 0,
    gold: 0,
    potions: 3,
    equipment: {},
    inventory: [],
    skillBar: [],
    unlocked: [],
    waypointsAttuned: [],
    bossDefeated: [],
  };
  // Equip the class starting weapon as a plain common instance.
  const weaponBase = getItemBase(cls.startingWeapon);
  sheet.equipment.weapon = {
    id: starterId(),
    baseId: weaponBase.id,
    rarity: 'common',
    ilvl: 1,
    name: weaponBase.name,
    implicits: [...weaponBase.implicits],
    affixes: [],
  };
  rebuildSkillBar(sheet);
  return sheet;
}

/** A demonstration loadout used for headless tests/benching. */
export function createTestUnique(id: string): ItemInstance {
  return rollUnique('uniq_emberfall_oath', 4, id);
}

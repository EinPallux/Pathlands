import { ALL_CLASSES } from './classes.ts';
import { ALL_SKILLS } from './skills.ts';
import { BUFFS } from './buffs.ts';
import { MONSTERS, BOSSES } from './monsters.ts';
import { ITEM_BASES, AFFIXES, UNIQUES } from './items.ts';
import { LOOT_TABLES, ELITE_AFFIXES } from './loot.ts';
import { ZONES } from './zones.ts';
import type {
  AffixDef,
  BossDef,
  BuffDef,
  ClassDef,
  EliteAffixDef,
  ItemBaseDef,
  LootTableDef,
  MonsterDef,
  SkillDef,
  UniqueDef,
  ZoneDef,
} from './types.ts';

// The content registry: the single lookup surface for all game data. Systems
// import from here, never from individual content files.

function index<T extends { id: string }>(items: readonly T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) map.set(item.id, item);
  return map;
}

const classMap = index(ALL_CLASSES);
const skillMap = index(ALL_SKILLS);
const buffMap = index(BUFFS);
const monsterMap = index(MONSTERS);
const bossMap = index(BOSSES);
const itemBaseMap = index(ITEM_BASES);
const affixMap = index(AFFIXES);
const uniqueMap = index(UNIQUES);
const lootMap = index(LOOT_TABLES);
const eliteMap = index(ELITE_AFFIXES);
const zoneMap = index(ZONES);

export const Content = {
  classes: classMap,
  skills: skillMap,
  buffs: buffMap,
  monsters: monsterMap,
  bosses: bossMap,
  itemBases: itemBaseMap,
  affixes: affixMap,
  uniques: uniqueMap,
  lootTables: lootMap,
  eliteAffixes: eliteMap,
  zones: zoneMap,
};

export function getClass(id: string): ClassDef {
  const c = classMap.get(id);
  if (!c) throw new Error(`unknown class: ${id}`);
  return c;
}
export function getSkill(id: string): SkillDef {
  const s = skillMap.get(id);
  if (!s) throw new Error(`unknown skill: ${id}`);
  return s;
}
export function getBuff(id: string): BuffDef {
  const b = buffMap.get(id);
  if (!b) throw new Error(`unknown buff: ${id}`);
  return b;
}
export function getMonster(id: string): MonsterDef {
  const m = monsterMap.get(id);
  if (!m) throw new Error(`unknown monster: ${id}`);
  return m;
}
export function getBoss(id: string): BossDef {
  const b = bossMap.get(id);
  if (!b) throw new Error(`unknown boss: ${id}`);
  return b;
}
export function getItemBase(id: string): ItemBaseDef {
  const i = itemBaseMap.get(id);
  if (!i) throw new Error(`unknown item base: ${id}`);
  return i;
}
export function getUnique(id: string): UniqueDef {
  const u = uniqueMap.get(id);
  if (!u) throw new Error(`unknown unique: ${id}`);
  return u;
}
export function getLootTable(id: string): LootTableDef {
  const l = lootMap.get(id);
  if (!l) throw new Error(`unknown loot table: ${id}`);
  return l;
}
export function getEliteAffix(id: string): EliteAffixDef {
  const e = eliteMap.get(id);
  if (!e) throw new Error(`unknown elite affix: ${id}`);
  return e;
}
export function getZone(id: string): ZoneDef {
  const z = zoneMap.get(id);
  if (!z) throw new Error(`unknown zone: ${id}`);
  return z;
}

export function affixesForSlot(slot: AffixDef['slots'][number]): AffixDef[] {
  return AFFIXES.filter((a) => a.slots.includes(slot));
}

export {
  ALL_CLASSES,
  ALL_SKILLS,
  BUFFS,
  MONSTERS,
  BOSSES,
  ITEM_BASES,
  AFFIXES,
  UNIQUES,
  LOOT_TABLES,
  ELITE_AFFIXES,
  ZONES,
};

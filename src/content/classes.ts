import type { ClassDef } from './types.ts';

// Playable classes. Phase 1 ships the Sentinel complete for levels 1–10; the
// other four arrive in Phase 2 (GDD §3).

export const SENTINEL: ClassDef = {
  id: 'sentinel',
  name: 'Sentinel',
  title: 'the Bulwark of the Broken Gate',
  fantasy: 'The last soldier of a dead order — a wall that hits back.',
  resourceKind: 'wrath',
  resourceName: 'Wrath',
  baseStats: {
    attributes: { might: 14, precision: 8, will: 6, vitality: 12 },
    attributesPerLevel: { might: 3, precision: 1, will: 1, vitality: 2 },
    baseLife: 62,
    lifePerLevel: 9,
    lifeRegen: 2.2,
    resourceKind: 'wrath',
    baseResource: 100,
    resourceRegen: 0, // Wrath builds from combat, not passive regen
    baseCritChance: 0.05,
    baseCritMulti: 1.5,
    baseMoveSpeed: 4.2,
    baseArmor: 24,
  },
  startingSkills: [
    { slot: 0, skillId: 'cleave' },
    { slot: 1, skillId: 'shield_slam' },
  ],
  skillUnlocks: [
    { level: 3, skillId: 'whirl_charge' },
    { level: 4, skillId: 'warcry' },
    { level: 5, skillId: 'bulwark' },
    { level: 6, skillId: 'sunder' },
  ],
  startingWeapon: 'wpn_iron_greatsword',
  modelKind: 'sentinel',
};

export const ALL_CLASSES: ClassDef[] = [SENTINEL];

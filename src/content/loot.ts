import type { EliteAffixDef, LootTableDef } from './types.ts';

// Loot tables and the Phase 1 elite affix set. Drop philosophy (GDD §7): fewer,
// better drops — a rare should be worth reading — with rarity beams/sounds
// scaling to quality so the unique "thunk" lands.

export const LOOT_TABLES: LootTableDef[] = [
  {
    id: 'loot_trash',
    rolls: 1,
    goldMin: 0,
    goldMax: 3,
    globeChance: 0.12,
    entries: [
      { kind: 'nothing', weight: 74 },
      { kind: 'item', ref: 'any', weight: 26, rarityWeights: { common: 60, magic: 34, rare: 6 } },
    ],
  },
  {
    id: 'loot_common',
    rolls: 1,
    goldMin: 1,
    goldMax: 8,
    globeChance: 0.18,
    entries: [
      { kind: 'nothing', weight: 40 },
      { kind: 'item', ref: 'any', weight: 60, rarityWeights: { common: 42, magic: 44, rare: 14 } },
    ],
  },
  {
    id: 'loot_elite',
    rolls: 2,
    goldMin: 6,
    goldMax: 20,
    globeChance: 0.5,
    entries: [
      { kind: 'item', ref: 'any', weight: 80, rarityWeights: { common: 12, magic: 48, rare: 40 } },
      { kind: 'unique', ref: 'uniq_emberfall_oath', weight: 3 },
      { kind: 'unique', ref: 'uniq_last_lantern', weight: 3 },
      { kind: 'nothing', weight: 14 },
    ],
  },
  {
    id: 'loot_boss',
    rolls: 4,
    goldMin: 40,
    goldMax: 90,
    globeChance: 1,
    entries: [
      { kind: 'item', ref: 'any', weight: 70, rarityWeights: { magic: 30, rare: 62, unique: 8 } },
      { kind: 'unique', ref: 'uniq_gatewardens_grief', weight: 26 },
      { kind: 'unique', ref: 'uniq_emberfall_oath', weight: 12 },
      { kind: 'unique', ref: 'uniq_last_lantern', weight: 12 },
    ],
  },
];

export const ELITE_AFFIXES: EliteAffixDef[] = [
  {
    id: 'elite_fierce',
    name: 'Fierce',
    description: 'Hits like a battering ram.',
    behavior: 'fierce',
    auraColor: 0xff5a2a,
    mods: [
      { stat: 'damage', mode: 'more', value: 0.45 },
      { stat: 'life', mode: 'more', value: 1.0 },
    ],
  },
  {
    id: 'elite_frozen_aura',
    name: 'Frozen Aura',
    description: 'Radiates a chilling cold that slows the unwary.',
    behavior: 'frozenAura',
    auraColor: 0x5fd0ff,
    mods: [
      { stat: 'life', mode: 'more', value: 0.9 },
      { stat: 'armor', mode: 'inc', value: 0.5 },
    ],
  },
  {
    id: 'elite_volatile',
    name: 'Volatile',
    description: 'Bursts violently when slain.',
    behavior: 'volatile',
    auraColor: 0xffb02a,
    mods: [
      { stat: 'life', mode: 'more', value: 0.8 },
      { stat: 'damage', mode: 'more', value: 0.2 },
    ],
  },
];

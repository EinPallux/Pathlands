import type { BuffDef } from './types.ts';

// Buffs & debuffs referenced by skills. Data-driven modifiers folded into stats.

export const BUFFS: BuffDef[] = [
  {
    id: 'warcry_buff',
    name: "Warcry",
    icon: 'buff_warcry',
    durationMs: 8000,
    beneficial: true,
    mods: [
      { stat: 'damage', mode: 'inc', value: 0.25 },
      { stat: 'armor', mode: 'inc', value: 0.4 },
    ],
    vfx: 'warcry_ring',
  },
  {
    id: 'bulwark_stance',
    name: 'Bulwark',
    icon: 'buff_bulwark',
    durationMs: 4000,
    beneficial: true,
    mods: [
      { stat: 'damageTaken', mode: 'more', value: -0.45 }, // 45% less damage taken
      { stat: 'block', mode: 'flat', value: 0.3 },
      { stat: 'moveSpeed', mode: 'more', value: -0.3 }, // braced: slower
    ],
    vfx: 'bulwark_aura',
  },
  {
    id: 'shrine_empower',
    name: 'Ember Blessing',
    icon: 'buff_shrine',
    durationMs: 20000,
    beneficial: true,
    mods: [
      { stat: 'damage', mode: 'inc', value: 0.3 },
      { stat: 'moveSpeed', mode: 'inc', value: 0.12 },
    ],
    vfx: 'shrine_aura',
  },
  {
    id: 'sunder_shred',
    name: 'Sundered',
    icon: 'debuff_sunder',
    durationMs: 5000,
    beneficial: false,
    mods: [
      { stat: 'armor', mode: 'more', value: -0.35 },
      { stat: 'damageTaken', mode: 'inc', value: 0.12 },
    ],
  },
];

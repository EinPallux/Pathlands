import type { ZoneDef, ZoneProp, SpawnPack, ZoneInteractable } from './types.ts';

// Emberfall Reach — the first Pathlands zone (ROADMAP Phase 1). A long north
// corridor of burning ruins: the player fights up an escalating gauntlet of
// Riven and Ashborn packs to the Broken Gate arena and the boss, Vorthak.
// Hand-authored layout; art direction is ash-grey/umber with ember-orange
// accents (ASSET_PIPELINE.md §2).

const packs: SpawnPack[] = [
  { monsterId: 'riven_wretch', count: 3, x: 0, y: -12, radius: 3 },
  { monsterId: 'riven_husk', count: 2, x: -8, y: -4, radius: 2.5 },
  { monsterId: 'riven_husk', count: 2, x: 9, y: -2, radius: 2.5 },
  { monsterId: 'riven_wretch', count: 4, x: 0, y: 6, radius: 3.5 },
  { monsterId: 'riven_stalker', count: 3, x: -11, y: 9, radius: 3 },
  { monsterId: 'ashborn_zealot', count: 2, x: 11, y: 11, radius: 3 },
  { monsterId: 'ashborn_pyre', count: 1, x: 14, y: 13, radius: 1 },
  // Mid-zone elite: a Fierce Brute anchoring a husk pack.
  { monsterId: 'riven_brute', count: 1, x: 0, y: 18, radius: 1, eliteAffixes: ['elite_fierce'] },
  { monsterId: 'riven_husk', count: 2, x: -3, y: 20, radius: 3 },
  { monsterId: 'ashborn_zealot', count: 3, x: -12, y: 24, radius: 3.5 },
  { monsterId: 'ashborn_pyre', count: 2, x: 13, y: 26, radius: 2 },
  // Second elite: a Frozen-Aura Stalker warband guarding the approach.
  { monsterId: 'riven_stalker', count: 1, x: 0, y: 32, radius: 1, eliteAffixes: ['elite_frozen_aura'] },
  { monsterId: 'riven_stalker', count: 3, x: 3, y: 33, radius: 3.5 },
  { monsterId: 'ashborn_zealot', count: 2, x: -6, y: 37, radius: 3 },
];

function buildProps(): ZoneProp[] {
  const props: ZoneProp[] = [];
  // Braziers line the path, throwing the only warm light through the ash.
  for (let i = 0; i < 10; i++) {
    const y = -22 + i * 7;
    const side = i % 2 === 0 ? -1 : 1;
    props.push({ kind: 'brazier', x: side * 6.5, y, rot: 0, scale: 1 });
  }
  // Ruined walls frame the corridor.
  const walls: Array<[number, number, number]> = [
    [-14, -10, 0.2], [14, -6, -0.3], [-16, 6, 0.1], [16, 10, 0.25],
    [-15, 22, -0.15], [15, 24, 0.2], [-14, 34, 0.1], [14, 36, -0.2],
  ];
  for (const [x, y, rot] of walls) props.push({ kind: 'ruined_wall', x, y, rot, scale: 1 });
  // Charred trees and rubble for silhouette + storytelling.
  const scatter: Array<[string, number, number, number, number]> = [
    ['dead_tree', -10, -18, 0.4, 1.1], ['dead_tree', 11, -14, 1.2, 0.9],
    ['dead_tree', -13, 2, 2.1, 1.0], ['dead_tree', 12, 4, 0.3, 1.2],
    ['dead_tree', -9, 28, 1.7, 1.0], ['dead_tree', 10, 30, 2.4, 0.95],
    ['rubble', -4, -8, 0.0, 1.0], ['rubble', 5, 2, 1.0, 1.3], ['rubble', -6, 16, 2.0, 1.1],
    ['rubble', 4, 26, 0.5, 1.0], ['rubble', -2, 38, 1.5, 1.2],
    ['banner', -3, 12, 0, 1], ['banner', 3, 12, 0, 1],
  ];
  for (const [kind, x, y, rot, scale] of scatter) props.push({ kind, x, y, rot, scale });
  // The Broken Gate: a shattered arch marking the boss arena.
  props.push({ kind: 'gate_arch', x: -6, y: 42, rot: 0.1, scale: 1.2 });
  props.push({ kind: 'gate_arch', x: 6, y: 42, rot: -0.1, scale: 1.2 });
  return props;
}

const interactables: ZoneInteractable[] = [
  { kind: 'waypoint', id: 'wp_emberfall', x: 0, y: -24, prompt: 'Attune Waypoint' },
  { kind: 'shrine', id: 'shrine_ember', x: 0, y: 15, prompt: 'Touch the Ember Shrine' },
];

export const EMBERFALL_REACH: ZoneDef = {
  id: 'emberfall_reach',
  name: 'Emberfall Reach',
  subtitle: 'The Broken Gate',
  biome: 'emberfall',
  bounds: { minX: -22, minY: -28, maxX: 22, maxY: 52 },
  playerStart: { x: 0, y: -25 },
  ambientLight: 0x2a2320,
  keyLight: 0xffa860,
  keyLightDir: { x: -0.4, y: -1, z: -0.35 },
  fogColor: 0x1a1512,
  fogDensity: 0.021,
  groundColor: 0x2f2722,
  music: 'music_emberfall_explore',
  ambience: 'amb_emberfall',
  packs,
  props: buildProps(),
  interactables,
  boss: { defId: 'warden_broken_gate', x: 0, y: 44, arenaRadius: 14 },
  recommendedLevel: 3,
};

export const ZONES: ZoneDef[] = [EMBERFALL_REACH];

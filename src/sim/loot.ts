import type { Rng } from './rng.ts';
import type { Rarity } from './defs.ts';
import { rollItem, rollUnique, type ItemInstance } from './items/generate.ts';
import { getLootTable, ITEM_BASES, UNIQUES } from '../content/index.ts';
import type { LootEntry } from '../content/types.ts';

// Loot resolution: turn a loot-table roll into concrete drops. Deterministic on
// the loot RNG stream. Personal/instanced by design (MMO-safe from day one).

export interface LootResult {
  items: ItemInstance[];
  gold: number;
  globe: boolean;
}

const RARITIES: Rarity[] = ['common', 'magic', 'rare', 'unique'];

function rollRarity(rng: Rng, weights?: Partial<Record<Rarity, number>>): Rarity {
  if (!weights) return 'common';
  const w = RARITIES.map((r) => weights[r] ?? 0);
  if (w.every((x) => x === 0)) return 'common';
  return RARITIES[rng.weightedIndex(w)]!;
}

function pickBase(rng: Rng, ilvl: number, classId: string): string | null {
  const eligible = ITEM_BASES.filter(
    (b) => b.levelReq <= ilvl && (!b.classReq || b.classReq === classId),
  );
  if (eligible.length === 0) return null;
  return rng.pick(eligible).id;
}

function pickUnique(rng: Rng, ilvl: number): string | null {
  const eligible = UNIQUES.filter((u) => u.levelReq <= ilvl);
  if (eligible.length === 0) return null;
  return rng.pick(eligible).id;
}

function resolveEntry(
  rng: Rng,
  entry: LootEntry,
  ilvl: number,
  classId: string,
  nextId: () => string,
): ItemInstance | null {
  if (entry.kind === 'nothing') return null;
  if (entry.kind === 'unique') {
    if (!entry.ref) return null;
    return rollUnique(entry.ref, ilvl, nextId());
  }
  // kind === 'item'
  let rarity = rollRarity(rng, entry.rarityWeights);
  if (rarity === 'unique') {
    const uid = pickUnique(rng, ilvl);
    if (uid) return rollUnique(uid, ilvl, nextId());
    rarity = 'rare';
  }
  const baseId = pickBase(rng, ilvl, classId);
  if (!baseId) return null;
  return rollItem(rng, baseId, ilvl, rarity, nextId());
}

export function resolveLoot(
  rng: Rng,
  tableId: string,
  ilvl: number,
  classId: string,
  nextId: () => string,
): LootResult {
  const table = getLootTable(tableId);
  const items: ItemInstance[] = [];
  for (let i = 0; i < table.rolls; i++) {
    const idx = rng.weightedIndex(table.entries.map((e) => e.weight));
    const entry = table.entries[idx]!;
    const item = resolveEntry(rng, entry, ilvl, classId, nextId);
    if (item) items.push(item);
  }
  const gold = rng.int(table.goldMin, table.goldMax);
  const globe = rng.chance(table.globeChance);
  return { items, gold, globe };
}

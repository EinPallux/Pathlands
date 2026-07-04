import type { Rng } from '../rng.ts';
import type { Modifier } from '../combat/stats.ts';
import type { Rarity } from '../defs.ts';
import { getItemBase, getUnique, affixesForSlot } from '../../content/index.ts';
import type { AffixDef, AffixTier, EquipSlot } from '../../content/types.ts';

// Item instance generation: roll affixed items from a base + item level +
// rarity, with tiers gated by item level and weighted (GDD §7). Deterministic
// given the loot RNG stream.

export interface RolledAffix {
  affixId: string;
  name: string;
  stat: Modifier['stat'];
  mode: Modifier['mode'];
  value: number;
  tier: number;
}

export interface ItemInstance {
  id: string;
  baseId: string;
  rarity: Rarity;
  ilvl: number;
  uniqueId?: string;
  name: string;
  implicits: Modifier[];
  affixes: RolledAffix[];
}

/** All stat modifiers an equipped instance contributes. */
export function itemMods(item: ItemInstance): Modifier[] {
  const mods: Modifier[] = [...item.implicits];
  for (const a of item.affixes) mods.push({ stat: a.stat, mode: a.mode, value: a.value });
  return mods;
}

const RARE_PREFIX_WORDS = ['Doom', 'Ash', 'Grave', 'Storm', 'Wrath', 'Ember', 'Vault', 'Gloom', 'Iron', 'Blood'];
const RARE_SUFFIX_WORDS = ['bane', 'guard', 'sunder', 'weaver', 'bite', 'shard', 'call', 'ward', 'reach', 'song'];

function round(value: number, mode: Modifier['mode'], tier: AffixTier): number {
  if (mode === 'flat' && Number.isInteger(tier.min) && Number.isInteger(tier.max)) {
    return Math.round(value);
  }
  return Math.round(value * 1000) / 1000;
}

function chooseTier(rng: Rng, affix: AffixDef, ilvl: number): AffixTier | null {
  const avail = affix.tiers.filter((t) => t.ilvl <= ilvl);
  if (avail.length === 0) return null;
  return avail[rng.weightedIndex(avail.map((t) => t.weight))]!;
}

function rollAffix(rng: Rng, affix: AffixDef, ilvl: number): RolledAffix | null {
  const tier = chooseTier(rng, affix, ilvl);
  if (!tier) return null;
  const raw = rng.range(tier.min, tier.max);
  return {
    affixId: affix.id,
    name: affix.name,
    stat: affix.stat,
    mode: affix.mode,
    value: round(raw, affix.mode, tier),
    tier: tier.tier,
  };
}

function pickDistinct(
  rng: Rng,
  pool: AffixDef[],
  count: number,
  usedStats: Set<string>,
  ilvl: number,
): RolledAffix[] {
  const out: RolledAffix[] = [];
  const candidates = pool.filter((a) => a.tiers.some((t) => t.ilvl <= ilvl));
  let guard = 0;
  while (out.length < count && candidates.length > 0 && guard < 40) {
    guard++;
    const idx = rng.weightedIndex(
      candidates.map((a) => {
        const avail = a.tiers.filter((t) => t.ilvl <= ilvl);
        return avail.reduce((s, t) => s + t.weight, 0);
      }),
    );
    const affix = candidates[idx]!;
    if (usedStats.has(affix.stat)) {
      candidates.splice(idx, 1);
      continue;
    }
    const rolled = rollAffix(rng, affix, ilvl);
    if (rolled) {
      out.push(rolled);
      usedStats.add(affix.stat);
    }
    candidates.splice(idx, 1);
  }
  return out;
}

function affixCounts(rng: Rng, rarity: Rarity): { prefix: number; suffix: number } {
  switch (rarity) {
    case 'magic': {
      const n = rng.int(1, 2);
      const prefix = rng.int(0, n);
      return { prefix, suffix: n - prefix };
    }
    case 'rare':
      return { prefix: rng.int(2, 3), suffix: rng.int(2, 3) };
    default:
      return { prefix: 0, suffix: 0 };
  }
}

function displayName(rng: Rng, baseName: string, rarity: Rarity, affixes: RolledAffix[]): string {
  if (rarity === 'common') return baseName;
  if (rarity === 'magic') {
    const a = affixes[0];
    return a ? `${a.name.startsWith('of ') ? baseName + ' ' + a.name : a.name + ' ' + baseName}` : baseName;
  }
  // rare: invented two-word name
  return `${rng.pick(RARE_PREFIX_WORDS)}${rng.pick(RARE_SUFFIX_WORDS)}`;
}

/** Roll a non-unique item instance. */
export function rollItem(
  rng: Rng,
  baseId: string,
  ilvl: number,
  rarity: Rarity,
  id: string,
): ItemInstance {
  const base = getItemBase(baseId);
  const slot = base.slot as EquipSlot;
  const pool = affixesForSlot(slot);
  const counts = affixCounts(rng, rarity);
  const used = new Set<string>();
  const prefixes = pickDistinct(
    rng,
    pool.filter((a) => a.kind === 'prefix'),
    counts.prefix,
    used,
    ilvl,
  );
  const suffixes = pickDistinct(
    rng,
    pool.filter((a) => a.kind === 'suffix'),
    counts.suffix,
    used,
    ilvl,
  );
  const affixes = [...prefixes, ...suffixes];
  return {
    id,
    baseId,
    rarity,
    ilvl,
    name: displayName(rng, base.name, rarity, affixes),
    implicits: [...base.implicits],
    affixes,
  };
}

/** Build a unique item instance from its definition. */
export function rollUnique(uniqueId: string, ilvl: number, id: string): ItemInstance {
  const def = getUnique(uniqueId);
  return {
    id,
    baseId: def.baseId,
    rarity: 'unique',
    ilvl,
    uniqueId,
    name: def.name,
    implicits: [...def.fixedMods],
    affixes: [],
  };
}

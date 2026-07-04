import {
  ALL_CLASSES,
  ALL_SKILLS,
  MONSTERS,
  BOSSES,
  AFFIXES,
  UNIQUES,
  LOOT_TABLES,
  ELITE_AFFIXES,
  ZONES,
  Content,
} from '../../src/content/index.ts';
import type { SkillEffect } from '../../src/content/types.ts';

// Content cross-reference validation (CLAUDE.md §4, ARCHITECTURE.md §7). Fails
// the build on any dangling reference — a loot table pointing at a missing item,
// a skill referencing a missing buff, a zone spawning an unknown monster, etc.

export function validateContent(): string[] {
  const errors: string[] = [];
  const has = <T>(map: Map<string, T>, id: string): boolean => map.has(id);

  const effectBuffs = (effect: SkillEffect): string[] => {
    if (effect.type === 'buff') return [effect.buffId];
    if (effect.type === 'lineAoe' && effect.debuffId) return [effect.debuffId];
    return [];
  };

  // Skills → buffs.
  for (const skill of ALL_SKILLS) {
    for (const buffId of effectBuffs(skill.effect)) {
      if (!has(Content.buffs, buffId)) errors.push(`skill ${skill.id} → missing buff ${buffId}`);
    }
  }

  // Classes → skills, weapon base.
  for (const cls of ALL_CLASSES) {
    for (const s of cls.startingSkills) {
      if (!has(Content.skills, s.skillId)) errors.push(`class ${cls.id} → missing starting skill ${s.skillId}`);
    }
    for (const u of cls.skillUnlocks) {
      if (!has(Content.skills, u.skillId)) errors.push(`class ${cls.id} → missing unlock skill ${u.skillId}`);
    }
    if (!has(Content.itemBases, cls.startingWeapon)) {
      errors.push(`class ${cls.id} → missing starting weapon ${cls.startingWeapon}`);
    }
  }

  // Monsters → skill, loot table.
  for (const m of MONSTERS) {
    if (!has(Content.skills, m.attackSkillId)) errors.push(`monster ${m.id} → missing skill ${m.attackSkillId}`);
    if (!has(Content.lootTables, m.lootTableId)) errors.push(`monster ${m.id} → missing loot table ${m.lootTableId}`);
  }

  // Bosses → skills, phases, loot table.
  for (const b of BOSSES) {
    if (!has(Content.skills, b.attackSkillId)) errors.push(`boss ${b.id} → missing skill ${b.attackSkillId}`);
    if (!has(Content.lootTables, b.lootTableId)) errors.push(`boss ${b.id} → missing loot table ${b.lootTableId}`);
    for (const p of b.phases) {
      for (const sid of p.mechanicSkillIds) {
        if (!has(Content.skills, sid)) errors.push(`boss ${b.id} → missing mechanic skill ${sid}`);
      }
    }
  }

  // Loot tables → items / uniques.
  for (const t of LOOT_TABLES) {
    if (t.entries.length === 0) errors.push(`loot table ${t.id} has no entries`);
    for (const e of t.entries) {
      if (e.kind === 'unique' && e.ref && !has(Content.uniques, e.ref)) {
        errors.push(`loot table ${t.id} → missing unique ${e.ref}`);
      }
    }
  }

  // Uniques → base.
  for (const u of UNIQUES) {
    if (!has(Content.itemBases, u.baseId)) errors.push(`unique ${u.id} → missing base ${u.baseId}`);
  }

  // Affix tiers sanity.
  for (const a of AFFIXES) {
    if (a.tiers.length === 0) errors.push(`affix ${a.id} has no tiers`);
    for (const t of a.tiers) {
      if (t.min > t.max) errors.push(`affix ${a.id} tier ${t.tier} has min > max`);
      if (t.weight <= 0) errors.push(`affix ${a.id} tier ${t.tier} has non-positive weight`);
    }
  }

  // Elite affixes have mods.
  for (const e of ELITE_AFFIXES) {
    if (e.mods.length === 0) errors.push(`elite affix ${e.id} has no mods`);
  }

  // Zones → monsters, elite affixes, boss.
  for (const z of ZONES) {
    for (const p of z.packs) {
      if (!has(Content.monsters, p.monsterId)) errors.push(`zone ${z.id} → missing monster ${p.monsterId}`);
      for (const ea of p.eliteAffixes ?? []) {
        if (!has(Content.eliteAffixes, ea)) errors.push(`zone ${z.id} → missing elite affix ${ea}`);
      }
    }
    if (z.boss && !has(Content.bosses, z.boss.defId)) {
      errors.push(`zone ${z.id} → missing boss ${z.boss.defId}`);
    }
  }

  return errors;
}

// CLI entry.
const isMain = typeof process !== 'undefined' && process.argv[1]?.includes('validate-content');
if (isMain) {
  const errors = validateContent();
  if (errors.length > 0) {
    console.error(`✗ content validation failed with ${errors.length} error(s):`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.info('✓ content validation passed');
}

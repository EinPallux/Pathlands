import { describe, expect, it } from 'vitest';
import { validateContent } from '../../tools/validate-content/index.ts';
import { ALL_SKILLS, MONSTERS, UNIQUES, AFFIXES, ZONES } from '../../src/content/index.ts';

// CI-fatal content integrity. If this fails, a dangling reference slipped in.

describe('content validation', () => {
  it('has no dangling cross-references', () => {
    const errors = validateContent();
    expect(errors).toEqual([]);
  });

  it('ships the Phase 1 content surface', () => {
    // Sentinel's 6 skills + monster + boss skills all present.
    const ids = new Set(ALL_SKILLS.map((s) => s.id));
    for (const s of ['cleave', 'shield_slam', 'whirl_charge', 'warcry', 'sunder', 'bulwark']) {
      expect(ids.has(s)).toBe(true);
    }
    expect(MONSTERS.length).toBeGreaterThanOrEqual(6);
    expect(UNIQUES.length).toBeGreaterThanOrEqual(3);
    expect(AFFIXES.length).toBeGreaterThanOrEqual(12);
    expect(ZONES.some((z) => z.id === 'emberfall_reach')).toBe(true);
  });
});

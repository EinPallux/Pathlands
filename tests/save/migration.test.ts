import { describe, expect, it } from 'vitest';
import { createCharacter } from '../../src/sim/character.ts';
import {
  CURRENT_SAVE_VERSION,
  createSaveFile,
  migrateSave,
  validateSave,
} from '../../src/save/model.ts';

// Save round-trip + migration. A fixture of every historical save version must
// load to the current version (CLAUDE.md §8). Phase 1 ships v1.

describe('save model', () => {
  it('round-trips a current save through JSON', () => {
    const sheet = createCharacter('sentinel', 'Sera');
    sheet.level = 7;
    sheet.gold = 420;
    const file = createSaveFile('slot_a', sheet, 'emberfall_reach', 1000);
    const json = JSON.stringify(file);
    const restored = migrateSave(JSON.parse(json));
    expect(restored.version).toBe(CURRENT_SAVE_VERSION);
    expect(restored.sheet.level).toBe(7);
    expect(restored.sheet.gold).toBe(420);
    expect(restored.zoneId).toBe('emberfall_reach');
  });

  it('upgrades a pre-versioned (v0) save', () => {
    const sheet = createCharacter('sentinel', 'Brann');
    const legacy = {
      // no `version` field → treated as v0
      slot: 'slot_legacy',
      sheet,
      zoneId: 'emberfall_reach',
      createdAt: 1,
      lastPlayed: 1,
      playSeconds: 0,
    };
    const migrated = migrateSave(legacy);
    expect(migrated.version).toBe(CURRENT_SAVE_VERSION);
    expect(() => validateSave(migrated)).not.toThrow();
  });

  it('rejects a corrupt save', () => {
    expect(() => migrateSave({ version: 1, slot: 'x' })).toThrow();
  });
});

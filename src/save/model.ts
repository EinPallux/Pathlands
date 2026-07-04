import type { CharacterSheet } from '../sim/character.ts';

// Save model: versioned, migration-capable, JSON-serializable. Kept pure and
// DOM-free so it can be unit-tested and reused as the Phase 7 account-import
// payload (ARCHITECTURE.md §8).

export const CURRENT_SAVE_VERSION = 1;

export interface SaveFile {
  version: number;
  slot: string;
  sheet: CharacterSheet;
  zoneId: string;
  createdAt: number;
  lastPlayed: number;
  playSeconds: number;
}

export interface Settings {
  master: number;
  music: number;
  sfx: number;
  quality: 'low' | 'medium' | 'high';
}

export const DEFAULT_SETTINGS: Settings = { master: 0.8, music: 0.5, sfx: 0.85, quality: 'high' };

/** Migration chain. Each entry upgrades a save from version N to N+1. */
const MIGRATIONS: Record<number, (raw: Record<string, unknown>) => Record<string, unknown>> = {
  // 0 → 1: normalise pre-versioned saves (defensive; no shipped v0 exists).
  0: (raw) => ({ ...raw, version: 1 }),
};

export function migrateSave(raw: Record<string, unknown>): SaveFile {
  let data = { ...raw };
  let version = typeof data.version === 'number' ? (data.version as number) : 0;
  while (version < CURRENT_SAVE_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) throw new Error(`no migration from save version ${version}`);
    data = step(data);
    version = data.version as number;
  }
  const file = data as unknown as SaveFile;
  validateSave(file);
  return file;
}

export function validateSave(file: SaveFile): void {
  if (file.version !== CURRENT_SAVE_VERSION) throw new Error(`bad save version ${file.version}`);
  if (!file.sheet || typeof file.sheet.classId !== 'string') throw new Error('save missing character sheet');
  if (typeof file.sheet.level !== 'number') throw new Error('save sheet malformed');
  if (typeof file.zoneId !== 'string') throw new Error('save missing zone');
}

export function createSaveFile(
  slot: string,
  sheet: CharacterSheet,
  zoneId: string,
  now: number,
): SaveFile {
  return {
    version: CURRENT_SAVE_VERSION,
    slot,
    sheet,
    zoneId,
    createdAt: now,
    lastPlayed: now,
    playSeconds: 0,
  };
}

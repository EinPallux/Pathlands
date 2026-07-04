import {
  CURRENT_SAVE_VERSION,
  DEFAULT_SETTINGS,
  createSaveFile,
  migrateSave,
  validateSave,
  type SaveFile,
  type Settings,
} from './model.ts';
import type { CharacterSheet } from '../sim/character.ts';

export { CURRENT_SAVE_VERSION, DEFAULT_SETTINGS };
export type { SaveFile, Settings };

// IndexedDB-backed persistence with a settings store, plus file export/import.
// Degrades to an in-memory map if IndexedDB is unavailable (e.g. private mode),
// so the game always runs (ARCHITECTURE.md §8).

const DB_NAME = 'pathlands';
const DB_VERSION = 1;
const STORE_SAVES = 'saves';
const STORE_META = 'meta';

function req<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export class SaveManager {
  private db: IDBDatabase | null = null;
  private memory = new Map<string, SaveFile>();
  private memSettings: Settings = { ...DEFAULT_SETTINGS };
  private useMemory = false;

  async init(): Promise<void> {
    if (typeof indexedDB === 'undefined') {
      this.useMemory = true;
      return;
    }
    try {
      this.db = await new Promise<IDBDatabase>((resolve, reject) => {
        const open = indexedDB.open(DB_NAME, DB_VERSION);
        open.onupgradeneeded = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains(STORE_SAVES)) db.createObjectStore(STORE_SAVES, { keyPath: 'slot' });
          if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META, { keyPath: 'key' });
        };
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => reject(open.error);
      });
    } catch (err) {
      console.warn('[save] IndexedDB unavailable, using memory:', err);
      this.useMemory = true;
    }
  }

  private tx(store: string, mode: IDBTransactionMode): IDBObjectStore {
    return this.db!.transaction(store, mode).objectStore(store);
  }

  async listSaves(): Promise<SaveFile[]> {
    let all: SaveFile[];
    if (this.useMemory || !this.db) {
      all = [...this.memory.values()];
    } else {
      const raw = (await req(this.tx(STORE_SAVES, 'readonly').getAll())) as Record<string, unknown>[];
      all = [];
      for (const r of raw) {
        try {
          all.push(migrateSave(r));
        } catch (err) {
          console.warn('[save] skipping corrupt save:', err);
        }
      }
    }
    return all.sort((a, b) => b.lastPlayed - a.lastPlayed);
  }

  async getSave(slot: string): Promise<SaveFile | null> {
    if (this.useMemory || !this.db) return this.memory.get(slot) ?? null;
    const raw = (await req(this.tx(STORE_SAVES, 'readonly').get(slot))) as Record<string, unknown> | undefined;
    if (!raw) return null;
    try {
      return migrateSave(raw);
    } catch {
      return null;
    }
  }

  async writeSave(file: SaveFile): Promise<void> {
    validateSave(file);
    if (this.useMemory || !this.db) {
      this.memory.set(file.slot, structuredClone(file));
      return;
    }
    await req(this.tx(STORE_SAVES, 'readwrite').put(file));
  }

  async deleteSave(slot: string): Promise<void> {
    if (this.useMemory || !this.db) {
      this.memory.delete(slot);
      return;
    }
    await req(this.tx(STORE_SAVES, 'readwrite').delete(slot));
  }

  async newCharacterSave(slot: string, sheet: CharacterSheet, zoneId: string, now: number): Promise<SaveFile> {
    const file = createSaveFile(slot, sheet, zoneId, now);
    await this.writeSave(file);
    return file;
  }

  async getSettings(): Promise<Settings> {
    if (this.useMemory || !this.db) return { ...this.memSettings };
    const raw = (await req(this.tx(STORE_META, 'readonly').get('settings'))) as
      | { key: string; value: Settings }
      | undefined;
    return raw ? { ...DEFAULT_SETTINGS, ...raw.value } : { ...DEFAULT_SETTINGS };
  }

  async setSettings(settings: Settings): Promise<void> {
    if (this.useMemory || !this.db) {
      this.memSettings = { ...settings };
      return;
    }
    await req(this.tx(STORE_META, 'readwrite').put({ key: 'settings', value: settings }));
  }

  /** Export a save as a downloadable JSON string (Phase 7 account-import format). */
  exportSave(file: SaveFile): string {
    return JSON.stringify(file, null, 2);
  }

  importSave(json: string): SaveFile {
    return migrateSave(JSON.parse(json) as Record<string, unknown>);
  }
}

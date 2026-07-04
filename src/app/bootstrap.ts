import * as THREE from 'three';
import { Simulation } from '../sim/simulation.ts';
import { GameSession } from './game.ts';
import { Screens } from './screens.ts';
import { InputController } from '../input/input.ts';
import { AudioEngine } from '../audio/audio.ts';
import { SaveManager, type Settings } from '../save/index.ts';
import type { SaveFile } from '../save/model.ts';
import { createCharacter } from '../sim/character.ts';

// App bootstrap: constructs the renderer/audio/save/input singletons and routes
// between the front-end screens and a running GameSession. Dismisses the boot
// screen once the menu is up.

export interface AppContext {
  canvas: HTMLCanvasElement;
  uiRoot: HTMLElement;
  onProgress: (pct: number, status?: string) => void;
}

export async function startApp(ctx: AppContext): Promise<void> {
  const app = new App(ctx);
  await app.init();
}

class App {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly save = new SaveManager();
  private readonly audio = new AudioEngine();
  private readonly input: InputController;
  private readonly screens: Screens;
  private session: GameSession | null = null;
  private settings: Settings;

  constructor(private readonly ctx: AppContext) {
    this.renderer = new THREE.WebGLRenderer({
      canvas: ctx.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.input = new InputController(ctx.canvas);
    this.screens = new Screens(ctx.uiRoot);
    this.settings = { master: 0.8, music: 0.5, sfx: 0.85, quality: 'high' };
    window.addEventListener('resize', this.onResize);
  }

  async init(): Promise<void> {
    this.ctx.onProgress(0.4, 'Opening the vault…');
    await this.save.init();
    this.settings = await this.save.getSettings();
    this.audio.setVolumes(this.settings);
    this.applyQuality();
    this.onResize();
    this.input.setEnabled(false);
    this.ctx.onProgress(1, 'Ready');
    await this.showMenu();
    document.getElementById('boot-screen')?.classList.add('hidden');
  }

  private async showMenu(): Promise<void> {
    this.input.setEnabled(false);
    const saves = await this.save.listSaves();
    this.screens.showMainMenu({
      saves,
      onContinue: (s) => void this.play(s),
      onNew: () => this.charCreate(),
      onSettings: () => this.settingsScreen(false),
    });
  }

  private charCreate(): void {
    this.screens.showCharCreate({
      onBegin: (name) => void this.newGame(name),
      onBack: () => void this.showMenu(),
    });
  }

  private async newGame(name: string): Promise<void> {
    const sheet = createCharacter('sentinel', name);
    const slot = `slot_${Date.now().toString(36)}`;
    const file = await this.save.newCharacterSave(slot, sheet, 'emberfall_reach', Date.now());
    await this.play(file);
  }

  private async play(file: SaveFile): Promise<void> {
    await this.audio.resume();
    this.audio.startMusic();
    const sim = new Simulation({
      sheet: file.sheet,
      zoneId: file.zoneId,
      seed: seedFromSlot(file.slot),
    });
    this.session = new GameSession({
      renderer: this.renderer,
      uiRoot: this.ctx.uiRoot,
      canvas: this.ctx.canvas,
      sim,
      input: this.input,
      audio: this.audio,
      save: this.save,
      saveFile: file,
      onTogglePause: (paused) => this.onTogglePause(paused),
    });
    this.screens.clear();
    this.session.start();
  }

  private onTogglePause(paused: boolean): void {
    if (paused) this.showPauseMenu();
    else this.screens.clear();
  }

  private showPauseMenu(): void {
    this.screens.showPause({
      onResume: () => {
        this.session?.resume();
        this.screens.clear();
      },
      onSettings: () => this.settingsScreen(true),
      onQuit: () => void this.quitToMenu(),
    });
  }

  private settingsScreen(overlay: boolean): void {
    this.screens.showSettings({
      settings: this.settings,
      overlay,
      onChange: (s) => {
        this.settings = s;
        this.audio.setVolumes(s);
        this.applyQuality();
        void this.save.setSettings(s);
      },
      onBack: () => (overlay ? this.showPauseMenu() : void this.showMenu()),
    });
  }

  private async quitToMenu(): Promise<void> {
    await this.session?.dispose();
    this.session = null;
    this.screens.clear();
    await this.showMenu();
  }

  private applyQuality(): void {
    const q = this.settings.quality;
    const dpr = Math.min(window.devicePixelRatio, 2);
    this.renderer.setPixelRatio(q === 'low' ? 1 : q === 'medium' ? Math.min(dpr, 1.5) : dpr);
    this.renderer.shadowMap.enabled = q !== 'low';
  }

  private onResize = (): void => {
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
  };
}

function seedFromSlot(slot: string): number {
  let h = 2166136261;
  for (let i = 0; i < slot.length; i++) {
    h ^= slot.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

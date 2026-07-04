import * as THREE from 'three';
import { Simulation } from '../sim/simulation.ts';
import { RenderWorld } from '../render/scene.ts';
import { Hud } from '../ui/hud.ts';
import { InputController } from '../input/input.ts';
import { AudioEngine } from '../audio/audio.ts';
import { SaveManager } from '../save/index.ts';
import type { SaveFile } from '../save/model.ts';
import { Transform } from '../sim/components.ts';
import { SIM_DT, MAX_CATCHUP_TICKS } from '../sim/constants.ts';

// The in-game session: owns the running simulation + its presentation and drives
// the fixed-timestep loop (sim at 30 Hz, render interpolated at display rate),
// with hit-stop, tab-out pause, and autosave.

const EMPTY: [] = [];

export interface GameSessionDeps {
  renderer: THREE.WebGLRenderer;
  uiRoot: HTMLElement;
  canvas: HTMLElement;
  sim: Simulation;
  input: InputController;
  audio: AudioEngine;
  save: SaveManager;
  saveFile: SaveFile;
  onTogglePause: (paused: boolean) => void;
}

export class GameSession {
  readonly sim: Simulation;
  private readonly render: RenderWorld;
  private readonly hud: Hud;
  private readonly input: InputController;
  private readonly audio: AudioEngine;
  private readonly save: SaveManager;
  private readonly saveFile: SaveFile;
  private readonly onTogglePause: (paused: boolean) => void;

  private raf = 0;
  private last = 0;
  private acc = 0;
  private hitStop = 0;
  private running = false;
  private paused = false;
  private autosaveTimer = 0;
  private playSeconds = 0;

  constructor(deps: GameSessionDeps) {
    this.sim = deps.sim;
    this.input = deps.input;
    this.audio = deps.audio;
    this.save = deps.save;
    this.saveFile = deps.saveFile;
    this.onTogglePause = deps.onTogglePause;

    this.hud = new Hud(deps.uiRoot, this.sim);
    this.render = new RenderWorld(deps.renderer, this.sim, this.hud.numberLayer);

    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKey);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  start(): void {
    this.running = true;
    this.input.setEnabled(true);
    this.last = performance.now();
    this.onResize();
    this.raf = requestAnimationFrame(this.loop);
    document.getElementById('boot-screen')?.classList.add('hidden');
  }

  private loop = (now: number): void => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.loop);
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.25) dt = 0.25;
    if (this.paused) return;

    this.playSeconds += dt;

    if (this.hitStop > 0) {
      this.hitStop -= dt;
    } else {
      this.acc += dt;
      const cmds = this.input.sample(this.sim, this.render.camera);
      let steps = 0;
      while (this.acc >= SIM_DT && steps < MAX_CATCHUP_TICKS) {
        this.sim.step(steps === 0 ? cmds : EMPTY);
        this.afterStep();
        this.acc -= SIM_DT;
        steps++;
      }
    }

    const alpha = this.hitStop > 0 ? 1 : this.acc / SIM_DT;
    this.render.render(alpha, dt);
    this.hud.update();
    this.audio.update(dt);

    this.autosaveTimer += dt;
    if (this.autosaveTimer > 45) {
      this.autosaveTimer = 0;
      void this.persist();
    }
  };

  private afterStep(): void {
    this.render.syncTick();
    this.hud.syncTick();
    const p = this.sim.world.get(this.sim.player, Transform);
    this.audio.consume(this.sim, p?.x ?? 0, p?.y ?? 0);
    for (const hs of this.sim.events.hitStop.all) {
      this.hitStop = Math.max(this.hitStop, hs.ms / 1000);
    }
  }

  pause(): void {
    if (this.paused) return;
    this.paused = true;
    this.input.setEnabled(false);
    void this.persist();
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.input.setEnabled(true);
    this.last = performance.now();
    this.acc = 0;
  }

  private onKey = (e: KeyboardEvent): void => {
    if (e.code === 'Escape') {
      if (this.paused) {
        this.resume();
        this.onTogglePause(false);
      } else {
        this.pause();
        this.onTogglePause(true);
      }
    }
  };

  private onVisibility = (): void => {
    if (document.hidden && !this.paused) {
      this.pause();
      this.onTogglePause(true);
    }
  };

  private onResize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.render.resize(w, h);
  };

  async persist(): Promise<void> {
    this.saveFile.sheet = this.sim.sheet;
    this.saveFile.lastPlayed = Date.now();
    this.saveFile.playSeconds = Math.round(this.playSeconds);
    try {
      await this.save.writeSave(this.saveFile);
    } catch (err) {
      console.warn('[game] autosave failed:', err);
    }
  }

  async dispose(): Promise<void> {
    this.running = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKey);
    document.removeEventListener('visibilitychange', this.onVisibility);
    await this.persist();
    this.input.setEnabled(false);
    this.hud.dispose();
    this.render.dispose();
  }
}

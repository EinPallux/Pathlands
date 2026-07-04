import * as THREE from 'three';
import type { AppContext } from './bootstrap.ts';

// Top-level game host. This is the seed version that proves the render toolchain;
// it grows into the full screen-router + sim/render/audio owner during Phase 1.
export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private raf = 0;

  private constructor(ctx: AppContext) {
    this.renderer = new THREE.WebGLRenderer({
      canvas: ctx.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x0a0a0d, 1);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0a0a0d, 0.03);

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
    this.camera.position.set(0, 16, 12);
    this.camera.lookAt(0, 0, 0);

    this.resize();
    window.addEventListener('resize', this.resize);
  }

  static async create(ctx: AppContext): Promise<Game> {
    ctx.onProgress(0.9, 'Lighting the braziers…');
    return new Game(ctx);
  }

  start(): void {
    const loop = (): void => {
      this.raf = requestAnimationFrame(loop);
      this.renderer.render(this.scene, this.camera);
    };
    loop();
    document.getElementById('boot-screen')?.classList.add('hidden');
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    this.renderer.dispose();
  }

  private resize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };
}

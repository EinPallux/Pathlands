import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { Simulation } from '../sim/simulation.ts';
import { Transform } from '../sim/components.ts';
import { CameraRig } from './camera.ts';
import { EntityViewManager } from './entities.ts';
import { VfxManager } from './vfx.ts';
import { buildGround, buildProp } from './procgen/environment.ts';
import type { ZoneDef } from '../content/types.ts';

// RenderWorld: the presentation of a running simulation. Owns the Three.js
// scene, lighting rig (per-zone mood), ground/props, camera, entity views, and
// VFX. Renders at display rate, interpolating between sim ticks; consumes sim
// events for feedback. Never mutates the sim.

export class RenderWorld {
  readonly scene = new THREE.Scene();
  private readonly rig: CameraRig;
  private readonly views: EntityViewManager;
  private readonly vfx: VfxManager;
  private readonly keyLight: THREE.DirectionalLight;
  private readonly emberAnchors: THREE.Vector3[] = [];
  private composer: EffectComposer | null = null;
  private time = 0;
  private readonly tmpPos = { x: 0, z: 0 };

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly sim: Simulation,
    numberLayer: HTMLElement,
  ) {
    const zone = sim.zone;
    this.scene.background = new THREE.Color(zone.fogColor);
    this.scene.fog = new THREE.FogExp2(zone.fogColor, zone.fogDensity);

    this.rig = new CameraRig(window.innerWidth / window.innerHeight);
    this.rig.snapTo(zone.playerStart.x, zone.playerStart.y);

    this.setupLights(zone);
    this.keyLight = this.scene.getObjectByName('keyLight') as THREE.DirectionalLight;

    this.scene.add(buildGround(zone));
    this.setupProps(zone);

    this.views = new EntityViewManager(this.scene);
    this.vfx = new VfxManager(this.scene, numberLayer);
    this.setupPost();

    // Prime the first interpolation state so nothing pops on frame 1.
    this.views.syncTick(sim);
    this.views.syncTick(sim);
  }

  private setupLights(zone: ZoneDef): void {
    const ambient = new THREE.AmbientLight(zone.ambientLight, 1.15);
    this.scene.add(ambient);
    const hemi = new THREE.HemisphereLight(0x4a5570, zone.groundColor, 0.75);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight(zone.keyLight, 2.3);
    key.name = 'keyLight';
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 120;
    const s = 26;
    key.shadow.camera.left = -s;
    key.shadow.camera.right = s;
    key.shadow.camera.top = s;
    key.shadow.camera.bottom = -s;
    key.shadow.bias = -0.0004;
    this.scene.add(key);
    this.scene.add(key.target);
  }

  private setupProps(zone: ZoneDef): void {
    for (const prop of zone.props) {
      const built = buildProp(prop);
      this.scene.add(built.object);
      if (built.light) this.scene.add(built.light);
      if (built.emberAnchor) this.emberAnchors.push(built.emberAnchor);
    }
  }

  private setupPost(): void {
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    try {
      const composer = new EffectComposer(this.renderer);
      composer.addPass(new RenderPass(this.scene, this.rig.camera));
      const bloom = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.7, // strength
        0.7, // radius
        0.75, // threshold
      );
      composer.addPass(bloom);
      composer.addPass(new OutputPass());
      this.composer = composer;
    } catch (err) {
      console.warn('[render] bloom unavailable, rendering direct:', err);
      this.composer = null;
    }
  }

  /** Record a completed sim tick (interpolation + event-driven feedback). */
  syncTick(): void {
    this.views.syncTick(this.sim);
    this.vfx.consume(this.sim);
    for (const s of this.sim.events.shake.all) this.rig.addTrauma(s.trauma);
    this.rig.setZoom(this.sim.bossEngaged && !this.sim.bossCleared ? 1.14 : 1);
  }

  /** Render one display frame at interpolation factor `alpha`. */
  render(alpha: number, dt: number): void {
    this.time += dt;

    // Camera follows the interpolated player position.
    if (this.views.interpPos(this.sim.player, alpha, this.tmpPos)) {
      this.rig.update(this.tmpPos.x, this.tmpPos.z, dt);
    } else {
      const tf = this.sim.world.get(this.sim.player, Transform);
      if (tf) this.rig.update(tf.x, tf.y, dt);
    }

    // Shadow frustum follows the player.
    const cam = this.rig.camera;
    this.keyLight.position.set(cam.position.x - 20, 40, cam.position.z - 14);
    this.keyLight.target.position.set(this.tmpPos.x, 0, this.tmpPos.z);
    this.keyLight.target.updateMatrixWorld();

    this.views.animate(alpha, dt, this.time);
    this.emitEmbers(dt);
    this.vfx.update(dt, this.rig);

    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, cam);
  }

  private emberTimer = 0;
  private emitEmbers(dt: number): void {
    this.emberTimer += dt;
    if (this.emberTimer < 0.06) return;
    this.emberTimer = 0;
    const cam = this.rig.camera;
    for (const a of this.emberAnchors) {
      const dx = a.x - cam.position.x;
      const dz = a.z - cam.position.z;
      if (dx * dx + dz * dz > 900) continue; // only near braziers
      if (Math.random() > 0.5) continue;
      this.vfx.particles.spawn(a.x + (Math.random() - 0.5) * 0.4, a.y, a.z + (Math.random() - 0.5) * 0.4, {
        vx: (Math.random() - 0.5) * 0.4,
        vy: 1.2 + Math.random(),
        vz: (Math.random() - 0.5) * 0.4,
        color: new THREE.Color(0xff8a3c),
        size: 4,
        life: 1.2,
        gravity: -1.5,
        drag: 0.4,
      });
    }
  }

  resize(w: number, h: number): void {
    this.rig.setAspect(w / h);
    this.composer?.setSize(w, h);
  }

  dispose(): void {
    this.views.clear();
  }

  get camera(): THREE.PerspectiveCamera {
    return this.rig.camera;
  }
}

import * as THREE from 'three';

// ARPG camera rig (GDD §2): a pitched perspective camera that follows the player
// with smoothing, contextual zoom, and a trauma-based shake model (shake scales
// with trauma², so small hits barely nudge and big hits punch — never nauseous).

const BASE_HEIGHT = 15.5;
const BASE_DEPTH = 11.5;
const FOLLOW_LERP = 0.14;

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  private readonly target = new THREE.Vector3();
  private readonly focus = new THREE.Vector3();
  private trauma = 0;
  private shakeTime = 0;
  private zoom = 1;
  private zoomTarget = 1;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(46, aspect, 0.5, 400);
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /** Snap immediately to a target (on zone load / respawn). */
  snapTo(x: number, z: number): void {
    this.focus.set(x, 0, z);
    this.target.set(x, 0, z);
  }

  addTrauma(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  /** 1 = normal; <1 pulls in (interiors), >1 pulls back (bosses). */
  setZoom(z: number): void {
    this.zoomTarget = z;
  }

  update(x: number, z: number, dt: number): void {
    this.focus.set(x, 0, z);
    this.target.lerp(this.focus, FOLLOW_LERP);
    this.zoom += (this.zoomTarget - this.zoom) * 0.05;

    this.shakeTime += dt * 32;
    this.trauma = Math.max(0, this.trauma - dt * 1.4);
    const shake = this.trauma * this.trauma;
    const sx = shake * 0.9 * Math.sin(this.shakeTime * 1.7);
    const sz = shake * 0.9 * Math.sin(this.shakeTime * 2.3 + 1.5);
    const sy = shake * 0.5 * Math.sin(this.shakeTime * 2.9);

    const h = BASE_HEIGHT * this.zoom;
    const d = BASE_DEPTH * this.zoom;
    // Camera sits behind the player (−z) looking toward +z, so the zone extends
    // "up-screen" ahead of the player — the natural ARPG reading.
    this.camera.position.set(this.target.x + sx, h + sy, this.target.z - d + sz);
    this.camera.lookAt(this.target.x + sx * 0.5, 1.0, this.target.z + sz * 0.5);
  }

  /** Project a world position to normalized screen coords (for DOM overlays). */
  worldToScreen(x: number, y: number, z: number, out: THREE.Vector3): THREE.Vector3 {
    out.set(x, y, z).project(this.camera);
    return out;
  }
}

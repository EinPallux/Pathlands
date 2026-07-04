import * as THREE from 'three';

// Lightweight GPU particle system: a single THREE.Points with per-particle
// color/size/alpha, integrated on the CPU into a fixed ring of slots (recycling
// oldest). Additive-blended soft points for sparks, embers, and impact bursts.

const VERT = `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
varying float vAlpha;
varying vec3 vColor;
void main() {
  vAlpha = aAlpha;
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * (300.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = `
varying float vAlpha;
varying vec3 vColor;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float a = smoothstep(0.5, 0.0, d) * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor, a);
}`;

export interface SpawnOpts {
  vx?: number;
  vy?: number;
  vz?: number;
  color: THREE.Color;
  size?: number;
  life?: number;
  gravity?: number;
  drag?: number;
}

export class ParticleSystem {
  readonly points: THREE.Points;
  private readonly max: number;
  private readonly pos: Float32Array;
  private readonly col: Float32Array;
  private readonly size: Float32Array;
  private readonly alpha: Float32Array;
  private readonly vel: Float32Array;
  private readonly life: Float32Array;
  private readonly maxLife: Float32Array;
  private readonly grav: Float32Array;
  private readonly drag: Float32Array;
  private cursor = 0;

  constructor(max = 1200) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    geo.setDrawRange(0, max);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);

    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
  }

  spawn(x: number, y: number, z: number, o: SpawnOpts): void {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.max;
    const i3 = i * 3;
    this.pos[i3] = x;
    this.pos[i3 + 1] = y;
    this.pos[i3 + 2] = z;
    this.vel[i3] = o.vx ?? 0;
    this.vel[i3 + 1] = o.vy ?? 0;
    this.vel[i3 + 2] = o.vz ?? 0;
    this.col[i3] = o.color.r;
    this.col[i3 + 1] = o.color.g;
    this.col[i3 + 2] = o.color.b;
    this.size[i] = o.size ?? 6;
    this.life[i] = this.maxLife[i] = o.life ?? 0.6;
    this.alpha[i] = 1;
    this.grav[i] = o.gravity ?? 0;
    this.drag[i] = o.drag ?? 1.6;
  }

  burst(x: number, y: number, z: number, count: number, o: SpawnOpts, speed = 4): void {
    for (let n = 0; n < count; n++) {
      const a = Math.random() * Math.PI * 2;
      const p = Math.random() * Math.PI - Math.PI / 2;
      const s = speed * (0.4 + Math.random() * 0.6);
      this.spawn(x, y, z, {
        ...o,
        vx: Math.cos(a) * Math.cos(p) * s,
        vy: Math.abs(Math.sin(p)) * s + 1,
        vz: Math.sin(a) * Math.cos(p) * s,
        life: (o.life ?? 0.6) * (0.6 + Math.random() * 0.8),
        size: (o.size ?? 6) * (0.7 + Math.random() * 0.6),
      });
    }
  }

  update(dt: number): void {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i]! <= 0) {
        if (this.alpha[i] !== 0) this.alpha[i] = 0;
        continue;
      }
      this.life[i]! -= dt;
      const i3 = i * 3;
      const dragK = Math.max(0, 1 - this.drag[i]! * dt);
      this.vel[i3]! *= dragK;
      this.vel[i3 + 2]! *= dragK;
      this.vel[i3 + 1]! = this.vel[i3 + 1]! * dragK - this.grav[i]! * dt;
      this.pos[i3]! += this.vel[i3]! * dt;
      this.pos[i3 + 1]! += this.vel[i3 + 1]! * dt;
      this.pos[i3 + 2]! += this.vel[i3 + 2]! * dt;
      this.alpha[i] = Math.max(0, this.life[i]! / this.maxLife[i]!);
    }
    const geo = this.points.geometry;
    (geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (geo.getAttribute('aColor') as THREE.BufferAttribute).needsUpdate = true;
    (geo.getAttribute('aSize') as THREE.BufferAttribute).needsUpdate = true;
    (geo.getAttribute('aAlpha') as THREE.BufferAttribute).needsUpdate = true;
  }
}

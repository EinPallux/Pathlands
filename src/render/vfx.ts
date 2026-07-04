import * as THREE from 'three';
import type { Simulation } from '../sim/simulation.ts';
import type { CameraRig } from './camera.ts';
import { ParticleSystem } from './particles.ts';
import { damageColor } from './procgen/materials.ts';
import { FactionC, Transform } from '../sim/components.ts';
import { getSkill } from '../content/index.ts';
import { DEG2RAD } from '../sim/math.ts';

// The VFX manager: turns one tick of simulation events into presentation —
// floating damage numbers (DOM), impact sparks, telegraph decals, death bursts.
// Reads events only; never mutates the sim.

interface FloatNum {
  el: HTMLElement;
  x: number;
  y: number;
  z: number;
  born: number;
  life: number;
  vy: number;
}

interface Decal {
  mesh: THREE.Mesh;
  born: number;
  life: number;
}

export class VfxManager {
  readonly particles: ParticleSystem;
  private readonly nums: FloatNum[] = [];
  private readonly decals: Decal[] = [];
  private time = 0;
  private readonly tmp = new THREE.Vector3();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly numberLayer: HTMLElement,
  ) {
    this.particles = new ParticleSystem();
    this.scene.add(this.particles.points);
  }

  /** Consume one tick of events. Called after each sim step. */
  consume(sim: Simulation): void {
    for (const ft of sim.events.floatText.all) {
      this.spawnNumber(ft.x, ft.y, ft.text, ft.kind, ft.damageType);
    }
    for (const hit of sim.events.hit.all) {
      const c = new THREE.Color(damageColor(hit.type));
      this.particles.burst(hit.x, 1.0, hit.y, hit.result === 'crit' ? 14 : 8, { color: c, size: 7, life: 0.5, gravity: 6 }, hit.result === 'crit' ? 7 : 4);
    }
    for (const d of sim.events.died.all) {
      const c = new THREE.Color(d.rank === 'boss' ? 0xff5020 : damageColor(d.lastDamageType));
      this.particles.burst(d.x, 1.0, d.y, d.rank === 'boss' ? 60 : 22, { color: c, size: 9, life: 0.9, gravity: 5 }, d.rank === 'boss' ? 9 : 5);
    }
    for (const p of sim.events.pickup.all) {
      if (p.kind === 'gold') {
        this.particles.burst(p.x, 0.6, p.y, 6, { color: new THREE.Color(0xe8b84b), size: 5, life: 0.5, gravity: 4 }, 3);
      }
    }
    for (const lvl of sim.events.levelUp.all) {
      const tf = sim.world.get(lvl.entity, Transform);
      if (tf) this.particles.burst(tf.x, 1.0, tf.y, 50, { color: new THREE.Color(0xffd060), size: 8, life: 1.2, gravity: -2 }, 6);
    }
    for (const cast of sim.events.skillCast.all) {
      this.maybeTelegraph(sim, cast.caster, cast.skillId, cast.x, cast.y, cast.aimX, cast.aimY);
    }
  }

  private maybeTelegraph(
    sim: Simulation,
    caster: number,
    skillId: string,
    x: number,
    y: number,
    aimX: number,
    aimY: number,
  ): void {
    const skill = getSkill(skillId);
    if (skill.windupMs < 150) return;
    const eff = skill.effect;
    const faction = sim.world.get(caster, FactionC)?.value ?? 'enemy';
    const color = faction === 'player' ? 0x3fd0c4 : 0xff5a2a;
    const life = skill.windupMs / 1000;
    const facing = Math.atan2(aimY - y, aimX - x);

    let geo: THREE.BufferGeometry | null = null;
    let px = x;
    let pz = y;
    let rot = 0;
    if (eff.type === 'meleeArc') {
      geo = new THREE.CircleGeometry(eff.range, 20, -eff.halfAngleDeg * DEG2RAD, eff.halfAngleDeg * 2 * DEG2RAD);
      rot = facing;
    } else if (eff.type === 'lineAoe') {
      geo = new THREE.PlaneGeometry(eff.length, eff.width);
      px = x + Math.cos(facing) * eff.length * 0.5;
      pz = y + Math.sin(facing) * eff.length * 0.5;
      rot = facing;
    } else if (eff.type === 'nova' || eff.type === 'groundZone') {
      const r = eff.type === 'nova' ? eff.radius : eff.radius;
      geo = new THREE.RingGeometry(r * 0.85, r, 28);
      if (eff.type === 'groundZone' && skill.aim !== 'self') {
        px = aimX;
        pz = aimY;
      }
    }
    if (!geo) return;

    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.32,
      side: THREE.DoubleSide,
      depthWrite: false,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = -rot;
    mesh.position.set(px, 0.06, pz);
    this.scene.add(mesh);
    this.decals.push({ mesh, born: this.time, life });
  }

  private spawnNumber(
    x: number,
    y: number,
    text: string,
    kind: string,
    damageType?: string,
  ): void {
    const el = document.createElement('div');
    el.className = `dmg-num dmg-${kind}`;
    el.textContent = text;
    if (damageType && kind !== 'info') el.style.color = `#${new THREE.Color(damageColor(damageType)).getHexString()}`;
    this.numberLayer.appendChild(el);
    this.nums.push({ el, x, y: 1.6, z: y, born: this.time, life: kind === 'info' ? 1.4 : 0.85, vy: 1.4 });
  }

  update(dt: number, camera: CameraRig): void {
    this.time += dt;
    this.particles.update(dt);

    // Telegraph decals pulse then fade.
    for (let i = this.decals.length - 1; i >= 0; i--) {
      const d = this.decals[i]!;
      const t = (this.time - d.born) / d.life;
      const mat = d.mesh.material as THREE.MeshBasicMaterial;
      if (t >= 1) {
        this.scene.remove(d.mesh);
        d.mesh.geometry.dispose();
        mat.dispose();
        this.decals.splice(i, 1);
        continue;
      }
      mat.opacity = 0.2 + 0.28 * Math.sin(t * Math.PI);
      const s = 0.9 + 0.1 * t;
      d.mesh.scale.setScalar(s);
    }

    // Damage numbers: float up, fade, and project to the screen.
    const w = window.innerWidth;
    const h = window.innerHeight;
    for (let i = this.nums.length - 1; i >= 0; i--) {
      const n = this.nums[i]!;
      const age = this.time - n.born;
      if (age >= n.life) {
        n.el.remove();
        this.nums.splice(i, 1);
        continue;
      }
      const p = age / n.life;
      camera.worldToScreen(n.x, n.y + p * n.vy, n.z, this.tmp);
      const sx = (this.tmp.x * 0.5 + 0.5) * w;
      const sy = (-this.tmp.y * 0.5 + 0.5) * h;
      n.el.style.transform = `translate(-50%, -50%) translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) scale(${(1 - p * 0.3).toFixed(2)})`;
      n.el.style.opacity = p > 0.6 ? String(1 - (p - 0.6) / 0.4) : '1';
    }
  }
}

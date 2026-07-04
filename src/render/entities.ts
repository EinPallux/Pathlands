import * as THREE from 'three';
import type { Simulation } from '../sim/simulation.ts';
import { Renderable, Transform } from '../sim/components.ts';
import type { Entity } from '../sim/ecs/store.ts';
import { buildMonster, buildProjectileMesh, buildSentinel, type CharacterParts } from './procgen/characters.ts';
import { emissiveMaterial, rarityColor, unlitMaterial } from './procgen/materials.ts';
import { lerp, lerpAngle } from '../sim/math.ts';

// Per-entity view management: create/update/destroy Three.js objects from sim
// renderable entities, with render interpolation between sim ticks and
// procedural animation (walk bob, attack swing, death dissolve).

interface View {
  entity: Entity;
  group: THREE.Group;
  parts: CharacterParts | null;
  isCharacter: boolean;
  kind: string;
  prevX: number;
  prevZ: number;
  prevFacing: number;
  currX: number;
  currZ: number;
  currFacing: number;
  baseScale: number;
  walkPhase: number;
  moving: boolean;
  attackUntil: number;
  hitUntil: number;
  seen: boolean;
  dead: boolean;
  deadT: number;
  spin: number;
}

const ATTACK_ANIM = 0.28;

export class EntityViewManager {
  private readonly views = new Map<Entity, View>();

  constructor(private readonly scene: THREE.Scene) {}

  /** Capture a new sim tick: shift prev←curr and record current transforms. */
  syncTick(sim: Simulation): void {
    for (const v of this.views.values()) v.seen = false;

    for (const [e, r, tf] of sim.world.view2(Renderable, Transform)) {
      let v = this.views.get(e);
      if (!v) {
        v = this.createView(e, r);
        this.views.set(e, v);
      }
      v.seen = true;
      v.prevX = v.currX;
      v.prevZ = v.currZ;
      v.prevFacing = v.currFacing;
      v.currX = tf.x;
      v.currZ = tf.y;
      v.currFacing = tf.facing;
      const moved = Math.hypot(v.currX - v.prevX, v.currZ - v.prevZ);
      v.moving = moved > 0.008;
    }

    // Entities that vanished this tick begin their death/removal animation.
    for (const v of this.views.values()) {
      if (!v.seen && !v.dead) {
        v.dead = true;
        v.deadT = 0;
      }
    }

    // React to combat events for this tick.
    for (const cast of sim.events.skillCast.all) {
      const v = this.views.get(cast.caster);
      if (v) v.attackUntil = -1; // marker; converted to time in animate via flag
    }
    for (const hit of sim.events.hit.all) {
      const v = this.views.get(hit.target);
      if (v) v.hitUntil = -1;
    }
  }

  createView(e: Entity, r: Renderable): View {
    let group: THREE.Group;
    let parts: CharacterParts | null = null;
    let isCharacter = false;

    if (r.kind === 'sentinel') {
      const m = buildSentinel();
      group = m.group;
      parts = m.parts;
      isCharacter = true;
      // Readability: a soft ground ring + warm follow-light mark the hero.
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.5, 0.66, 24),
        new THREE.MeshBasicMaterial({ color: 0x6fe0d4, transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.03;
      group.add(ring);
      const light = new THREE.PointLight(0xffd0a0, 3, 9, 2);
      light.position.set(0, 2.4, 0);
      group.add(light);
    } else if (r.kind === 'riven' || r.kind === 'ashborn' || r.kind === 'boss') {
      const m = buildMonster(r.kind, r.variant, r.tint || 0x6b4a34, r.rimColor || 0xff8850);
      group = m.group;
      parts = m.parts;
      isCharacter = true;
    } else {
      group = this.buildPropView(r);
    }

    group.scale.setScalar(r.scale || 1);
    this.scene.add(group);
    return {
      entity: e,
      group,
      parts,
      isCharacter,
      kind: r.kind,
      prevX: 0,
      prevZ: 0,
      prevFacing: r.kind === 'sentinel' ? Math.PI / 2 : 0,
      currX: 0,
      currZ: 0,
      currFacing: 0,
      baseScale: r.scale || 1,
      walkPhase: Math.random() * Math.PI * 2,
      moving: false,
      attackUntil: 0,
      hitUntil: 0,
      seen: true,
      dead: false,
      deadT: 0,
      spin: 0,
    };
  }

  private buildPropView(r: Renderable): THREE.Group {
    const g = new THREE.Group();
    if (r.kind === 'projectile') {
      g.add(buildProjectileMesh(0xff7a2e));
    } else if (r.kind === 'area') {
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(1, 28),
        new THREE.MeshBasicMaterial({ color: 0xff5a2a, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }),
      );
      disc.rotation.x = -Math.PI / 2;
      disc.position.y = 0.05;
      g.add(disc);
    } else if (r.kind === 'groundItem') {
      const color = rarityColor(r.variant);
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), emissiveMaterial(color, 2.2));
      gem.position.y = 0.5;
      g.add(gem);
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 3, 6),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, depthWrite: false, toneMapped: false }),
      );
      beam.position.y = 1.5;
      g.add(beam);
    } else if (r.kind === 'gold') {
      const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 10), emissiveMaterial(0xe8b84b, 1.2));
      coin.position.y = 0.2;
      g.add(coin);
    } else if (r.kind === 'globe') {
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), emissiveMaterial(0xd0203a, 1.6));
      orb.position.y = 0.35;
      g.add(orb);
    } else if (r.kind === 'interactable') {
      const color = r.variant === 'waypoint' ? 0x3fd0c4 : 0xffb04a;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.09, 8, 20), emissiveMaterial(color, 1.4));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.1;
      g.add(ring);
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.6, 8), unlitMaterial(color, 0.5));
      pillar.position.y = 0.8;
      g.add(pillar);
    }
    return g;
  }

  /** Interpolated per-frame update + animation. */
  animate(alpha: number, dt: number, time: number): void {
    for (const [e, v] of this.views) {
      // Convert event markers to absolute times.
      if (v.attackUntil === -1) v.attackUntil = time + ATTACK_ANIM;
      if (v.hitUntil === -1) v.hitUntil = time + 0.12;

      if (v.dead) {
        v.deadT += dt;
        const s = Math.max(0, 1 - v.deadT / 0.4);
        v.group.scale.setScalar(v.baseScale * s);
        v.group.position.y = -(1 - s) * 0.6;
        v.group.rotation.y += dt * 6;
        if (v.deadT > 0.42) {
          this.scene.remove(v.group);
          disposeGroup(v.group);
          this.views.delete(e);
        }
        continue;
      }

      const x = lerp(v.prevX, v.currX, alpha);
      const z = lerp(v.prevZ, v.currZ, alpha);
      v.group.position.set(x, 0, z);

      if (v.isCharacter) {
        v.group.rotation.y = Math.PI / 2 - lerpAngle(v.prevFacing, v.currFacing, alpha);
        this.animateCharacter(v, dt, time);
      } else {
        this.animateProp(v, dt, time);
      }
    }
  }

  private animateCharacter(v: View, dt: number, time: number): void {
    const p = v.parts;
    if (!p) return;
    const amp = 0.55;
    if (v.moving) {
      v.walkPhase += dt * 9;
      const s = Math.sin(v.walkPhase);
      p.legL.rotation.x = s * amp;
      p.legR.rotation.x = -s * amp;
      p.armL.rotation.x = -s * amp * 0.7;
      p.armR.rotation.x = s * amp * 0.7;
    } else {
      p.legL.rotation.x *= 0.8;
      p.legR.rotation.x *= 0.8;
      p.armL.rotation.x *= 0.8;
      p.armR.rotation.x *= 0.8;
    }
    // Idle bob.
    p.torso.position.y = (p.torso.position.y || 0) * 0 + Math.sin(time * 2 + v.walkPhase) * 0.02;

    // Attack swing overrides the right arm.
    if (time < v.attackUntil) {
      const t = 1 - (v.attackUntil - time) / ATTACK_ANIM;
      const swing = Math.sin(t * Math.PI);
      p.armR.rotation.x = -1.9 * swing;
      p.torso.rotation.y = swing * 0.3;
    } else {
      p.torso.rotation.y *= 0.8;
    }

    // Hit squash.
    if (time < v.hitUntil) {
      const t = (v.hitUntil - time) / 0.12;
      v.group.scale.set(v.baseScale * (1 + t * 0.15), v.baseScale * (1 - t * 0.12), v.baseScale * (1 + t * 0.15));
    } else {
      v.group.scale.setScalar(v.baseScale);
    }
  }

  private animateProp(v: View, dt: number, time: number): void {
    v.spin += dt;
    if (v.kind === 'groundItem') {
      v.group.rotation.y = time * 1.6;
      v.group.position.y = Math.sin(time * 2) * 0.08;
    } else if (v.kind === 'gold' || v.kind === 'globe') {
      v.group.rotation.y = time * 3;
      v.group.position.y = Math.sin(time * 3 + v.walkPhase) * 0.05;
    } else if (v.kind === 'projectile') {
      v.group.rotation.z = time * 8;
    } else if (v.kind === 'interactable') {
      v.group.children[0]!.rotation.z = time * 0.6;
    } else if (v.kind === 'area') {
      const pulse = 0.9 + Math.sin(time * 6) * 0.1;
      v.group.scale.setScalar(v.baseScale * pulse);
    }
  }

  /** Interpolated ground position of an entity's view, or null if absent. */
  interpPos(entity: Entity, alpha: number, out: { x: number; z: number }): boolean {
    const v = this.views.get(entity);
    if (!v) return false;
    out.x = lerp(v.prevX, v.currX, alpha);
    out.z = lerp(v.prevZ, v.currZ, alpha);
    return true;
  }

  clear(): void {
    for (const v of this.views.values()) {
      this.scene.remove(v.group);
      disposeGroup(v.group);
    }
    this.views.clear();
  }
}

function disposeGroup(group: THREE.Object3D): void {
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = mesh.material;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else if (mat) (mat as THREE.Material).dispose();
  });
}

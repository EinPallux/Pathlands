import * as THREE from 'three';
import { charMaterial, emissiveMaterial, metalMaterial } from './materials.ts';

// Procedural characters. Built from primitives grouped with named pivots so the
// entity view can animate them (walk bob, attack swing). Low-poly, flat-shaded,
// rim-lit — strong silhouettes per monster family (ASSET_PIPELINE.md §2).

export interface CharacterParts {
  torso: THREE.Object3D;
  head: THREE.Object3D;
  armL: THREE.Object3D; // shoulder pivots
  armR: THREE.Object3D;
  legL: THREE.Object3D; // hip pivots
  legR: THREE.Object3D;
  weapon: THREE.Object3D | null;
}

export interface CharacterMesh {
  group: THREE.Group;
  parts: CharacterParts;
  height: number;
}

interface HumanoidOpts {
  height: number;
  bulk: number; // 1 = normal, >1 bulkier
  color: number;
  rimColor: number;
  accent: number;
  weapon: 'greatsword' | 'staff' | 'claws' | 'maul' | null;
  robe: boolean;
  hunch: number; // forward lean radians
}

function box(w: number, h: number, d: number, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function buildHumanoid(o: HumanoidOpts): CharacterMesh {
  const g = new THREE.Group();
  const skin = charMaterial({ color: o.color, rimColor: o.rimColor, roughness: 0.9 });
  const accentMat = charMaterial({ color: o.accent, rimColor: o.rimColor, roughness: 0.7 });

  const h = o.height;
  const legH = h * 0.44;
  const torsoH = h * 0.34;
  const headH = h * 0.16;
  const shoulderW = h * 0.3 * o.bulk;
  const torsoW = h * 0.24 * o.bulk;
  const limbT = h * 0.09 * o.bulk;

  // Legs (hip pivots at top).
  const hipY = legH;
  const mkLeg = (side: number): THREE.Object3D => {
    const pivot = new THREE.Object3D();
    pivot.position.set(side * torsoW * 0.28, hipY, 0);
    const leg = box(limbT, legH, limbT, skin);
    leg.position.y = -legH / 2;
    pivot.add(leg);
    g.add(pivot);
    return pivot;
  };
  const legL = mkLeg(-1);
  const legR = mkLeg(1);

  // Torso.
  const torso = new THREE.Group();
  torso.position.y = hipY;
  torso.rotation.x = o.hunch;
  const chest = box(torsoW, torsoH, torsoW * 0.7, o.robe ? accentMat : skin);
  chest.position.y = torsoH / 2;
  torso.add(chest);
  if (o.robe) {
    const robe = box(torsoW * 1.15, legH * 0.9, torsoW * 0.8, accentMat);
    robe.position.y = -legH * 0.35;
    torso.add(robe);
  }
  g.add(torso);

  // Head.
  const head = new THREE.Group();
  head.position.y = torsoH;
  const skull = box(headH * 0.85, headH, headH * 0.85, skin);
  skull.position.y = headH / 2;
  head.add(skull);
  // Glowing eyes for menace.
  const eyeMat = emissiveMaterial(o.rimColor, 2.5);
  const eyes = new THREE.Mesh(new THREE.BoxGeometry(headH * 0.6, headH * 0.16, headH * 0.1), eyeMat);
  eyes.position.set(0, headH * 0.55, headH * 0.42);
  head.add(eyes);
  torso.add(head);

  // Arms (shoulder pivots).
  const shoulderY = torsoH * 0.86;
  const armLen = h * 0.36;
  const mkArm = (side: number): THREE.Object3D => {
    const pivot = new THREE.Object3D();
    pivot.position.set(side * shoulderW * 0.5, shoulderY, 0);
    const arm = box(limbT * 0.85, armLen, limbT * 0.85, skin);
    arm.position.y = -armLen / 2;
    pivot.add(arm);
    torso.add(pivot);
    return pivot;
  };
  const armL = mkArm(-1);
  const armR = mkArm(1);

  // Weapon in right hand.
  let weapon: THREE.Object3D | null = null;
  if (o.weapon) {
    weapon = buildWeapon(o.weapon, h);
    weapon.position.y = -armLen;
    armR.add(weapon);
  }

  return { group: g, parts: { torso, head, armL, armR, legL, legR, weapon }, height: h };
}

function buildWeapon(kind: string, h: number): THREE.Object3D {
  const grp = new THREE.Group();
  if (kind === 'greatsword' || kind === 'maul') {
    const steel = metalMaterial(kind === 'maul' ? 0x555a60 : 0xb8c0cc, 0.4);
    const hilt = new THREE.Mesh(new THREE.BoxGeometry(0.06, h * 0.28, 0.06), metalMaterial(0x3a2a1a, 0.7));
    hilt.position.y = -h * 0.05;
    grp.add(hilt);
    if (kind === 'maul') {
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.24, 0.28), steel);
      head.position.y = -h * 0.22;
      grp.add(head);
    } else {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.1, h * 0.6, 0.03), steel);
      blade.position.y = -h * 0.42;
      grp.add(blade);
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.05, 0.06), steel);
      guard.position.y = -h * 0.12;
      grp.add(guard);
    }
    grp.castShadow = true;
  } else if (kind === 'staff') {
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.05, h * 0.9, 0.05), metalMaterial(0x4a3520, 0.8));
    shaft.position.y = -h * 0.2;
    grp.add(shaft);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), emissiveMaterial(0xff7a2e, 2.2));
    orb.position.y = -h * 0.64;
    grp.add(orb);
  } else if (kind === 'claws') {
    const clawMat = metalMaterial(0x8a3a2a, 0.5);
    for (let i = -1; i <= 1; i++) {
      const claw = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.22, 5), clawMat);
      claw.position.set(i * 0.06, -0.12, 0.05);
      claw.rotation.x = Math.PI;
      grp.add(claw);
    }
  }
  return grp;
}

export function buildSentinel(): CharacterMesh {
  return buildHumanoid({
    height: 1.85,
    bulk: 1.15,
    color: 0x4a5058,
    rimColor: 0xffd8a0,
    accent: 0x6a4a2c,
    weapon: 'greatsword',
    robe: false,
    hunch: 0.05,
  });
}

export function buildMonster(kind: string, variant: string, tint: number, rimColor: number): CharacterMesh {
  if (kind === 'boss') return buildBoss(tint, rimColor);
  if (kind === 'ashborn') {
    return buildHumanoid({
      height: variant === 'pyre' ? 1.75 : 1.72,
      bulk: 1,
      color: tint,
      rimColor,
      accent: 0x2a1c14,
      weapon: variant === 'pyre' ? 'staff' : 'claws',
      robe: true,
      hunch: 0.08,
    });
  }
  // Riven family: jagged, hunched, asymmetric.
  const byVariant: Record<string, Partial<HumanoidOpts>> = {
    wretch: { height: 1.2, bulk: 0.8, hunch: 0.5, weapon: 'claws' },
    husk: { height: 1.7, bulk: 1.05, hunch: 0.25, weapon: 'claws' },
    stalker: { height: 1.62, bulk: 0.85, hunch: 0.4, weapon: 'claws' },
    brute: { height: 2.4, bulk: 1.9, hunch: 0.15, weapon: 'maul' },
  };
  const v = byVariant[variant] ?? byVariant.husk!;
  return buildHumanoid({
    height: v.height ?? 1.7,
    bulk: v.bulk ?? 1,
    color: tint,
    rimColor,
    accent: 0x241812,
    weapon: v.weapon ?? 'claws',
    robe: false,
    hunch: v.hunch ?? 0.3,
  });
}

function buildBoss(tint: number, rimColor: number): CharacterMesh {
  const mesh = buildHumanoid({
    height: 3.4,
    bulk: 2.2,
    color: tint,
    rimColor,
    accent: 0x1a1010,
    weapon: 'maul',
    robe: false,
    hunch: 0.1,
  });
  // Add a broken-gate crown of shards for a boss silhouette.
  const shardMat = emissiveMaterial(0xff4020, 1.8);
  const head = mesh.parts.head;
  for (let i = 0; i < 5; i++) {
    const shard = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.5, 4), shardMat);
    const a = (i / 5) * Math.PI * 2;
    shard.position.set(Math.cos(a) * 0.22, 0.55, Math.sin(a) * 0.22);
    shard.rotation.z = Math.cos(a) * 0.4;
    shard.rotation.x = Math.sin(a) * 0.4;
    head.add(shard);
  }
  return mesh;
}

export function buildProjectileMesh(color: number): THREE.Object3D {
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), emissiveMaterial(color, 3));
  g.add(core);
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 10, 8),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, toneMapped: false }),
  );
  g.add(glow);
  return g;
}

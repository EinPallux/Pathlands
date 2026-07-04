import * as THREE from 'three';
import { charMaterial, emissiveMaterial, metalMaterial } from './materials.ts';
import type { ZoneDef, ZoneProp } from '../../content/types.ts';

// Procedural environment: modular props and the zone ground. Emberfall's kit —
// braziers (the only warm light), ruined walls, charred trees, rubble, the
// Broken Gate arch, and cult banners (ASSET_PIPELINE.md §3).

function stoneMat(tint = 0x3a352e): THREE.MeshStandardMaterial {
  return charMaterial({ color: tint, roughness: 0.95, metalness: 0 });
}

export interface BuiltProp {
  object: THREE.Object3D;
  light?: THREE.PointLight;
  emberAnchor?: THREE.Vector3; // world-space anchor for a fire particle emitter
}

export function buildProp(prop: ZoneProp): BuiltProp {
  const g = new THREE.Group();
  g.position.set(prop.x, 0, prop.y);
  g.rotation.y = prop.rot;
  g.scale.setScalar(prop.scale);
  let light: THREE.PointLight | undefined;
  let emberAnchor: THREE.Vector3 | undefined;

  switch (prop.kind) {
    case 'brazier': {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 1.1, 8), metalMaterial(0x2a2420, 0.6));
      stem.position.y = 0.55;
      stem.castShadow = true;
      g.add(stem);
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.24, 0.34, 10), metalMaterial(0x33291f, 0.6));
      bowl.position.y = 1.2;
      g.add(bowl);
      const fire = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), emissiveMaterial(0xff7a2e, 2.6));
      fire.position.y = 1.35;
      fire.scale.y = 1.3;
      g.add(fire);
      light = new THREE.PointLight(0xff8a3c, 6, 12, 2);
      light.position.set(prop.x, 1.5, prop.y);
      emberAnchor = new THREE.Vector3(prop.x, 1.5, prop.y);
      break;
    }
    case 'ruined_wall': {
      const mat = stoneMat();
      const segments = 3;
      for (let i = 0; i < segments; i++) {
        const hgt = 1.6 - i * 0.35 + (i % 2) * 0.4;
        const block = new THREE.Mesh(new THREE.BoxGeometry(1.2, hgt, 0.6), mat);
        block.position.set((i - 1) * 1.2, hgt / 2, 0);
        block.castShadow = true;
        block.receiveShadow = true;
        g.add(block);
      }
      break;
    }
    case 'dead_tree': {
      const barkMat = charMaterial({ color: 0x2b241d, roughness: 1 });
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.22, 3, 6), barkMat);
      trunk.position.y = 1.5;
      trunk.castShadow = true;
      g.add(trunk);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.08, 1.3, 5), barkMat);
        branch.position.set(Math.cos(a) * 0.3, 2.4 + (i % 2) * 0.3, Math.sin(a) * 0.3);
        branch.rotation.z = Math.cos(a) * 0.9;
        branch.rotation.x = Math.sin(a) * 0.9;
        g.add(branch);
      }
      break;
    }
    case 'rubble': {
      const mat = stoneMat(0x332e28);
      for (let i = 0; i < 5; i++) {
        const s = 0.25 + (i % 3) * 0.18;
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), mat);
        rock.position.set((i - 2) * 0.4, s * 0.5, ((i * 7) % 5) * 0.2 - 0.4);
        rock.rotation.set(i, i * 1.3, i * 0.7);
        rock.castShadow = true;
        rock.receiveShadow = true;
        g.add(rock);
      }
      break;
    }
    case 'gate_arch': {
      const mat = stoneMat(0x453b30);
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.7, 4.2, 0.7), mat);
      pillar.position.y = 2.1;
      pillar.castShadow = true;
      g.add(pillar);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 1.1), mat);
      cap.position.y = 4.2;
      cap.rotation.y = 0.3;
      g.add(cap);
      const crack = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.6, 0.2), emissiveMaterial(0xff5a2a, 0.8));
      crack.position.set(0.36, 2.2, 0);
      g.add(crack);
      break;
    }
    case 'banner': {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.2, 6), metalMaterial(0x2a2018, 0.7));
      pole.position.y = 1.6;
      g.add(pole);
      const cloth = new THREE.Mesh(
        new THREE.PlaneGeometry(0.9, 1.6),
        new THREE.MeshStandardMaterial({ color: 0x7a2320, roughness: 1, side: THREE.DoubleSide }),
      );
      cloth.position.set(0.5, 2.2, 0);
      g.add(cloth);
      break;
    }
    default:
      break;
  }
  return { object: g, light, emberAnchor };
}

/** Build the zone ground: a subtly displaced, vertex-shaded plane. */
export function buildGround(zone: ZoneDef): THREE.Mesh {
  const b = zone.bounds;
  const w = b.maxX - b.minX + 16;
  const d = b.maxY - b.minY + 16;
  const segW = Math.max(8, Math.round(w / 2));
  const segD = Math.max(8, Math.round(d / 2));
  const geo = new THREE.PlaneGeometry(w, d, segW, segD);
  geo.rotateX(-Math.PI / 2);

  const base = new THREE.Color(zone.groundColor);
  const dark = base.clone().multiplyScalar(0.6);
  const colors: number[] = [];
  const pos = geo.attributes.position!;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    // Gentle rolling displacement (deterministic hash noise).
    const n = hashNoise(x * 0.15, z * 0.15) + 0.5 * hashNoise(x * 0.4, z * 0.4);
    pos.setY(i, n * 0.35);
    const t = 0.5 + 0.5 * hashNoise(x * 0.08 + 10, z * 0.08 - 5);
    const c = dark.clone().lerp(base, t);
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set((b.minX + b.maxX) / 2, 0, (b.minY + b.maxY) / 2);
  mesh.receiveShadow = true;
  return mesh;
}

function hashNoise(x: number, y: number): number {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return (s - Math.floor(s)) - 0.5;
}

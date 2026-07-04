import * as THREE from 'three';

// Procedural material factory. Stylized painterly-dark look (ASSET_PIPELINE.md
// §2): matte surfaces, binary metalness, emissive reserved for magic/loot/VFX,
// with a fresnel rim term injected into the standard shader for the rim-lit
// silhouette the style guide calls for.

const rimPatched = new WeakSet<THREE.Material>();

/** Inject a fresnel rim glow into a MeshStandardMaterial (robust chunk patch). */
function addRim(mat: THREE.MeshStandardMaterial, rimColor: number, power = 2.4, strength = 0.9): void {
  if (rimPatched.has(mat)) return;
  rimPatched.add(mat);
  const col = new THREE.Color(rimColor);
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uRimColor = { value: col };
    shader.uniforms.uRimPower = { value: power };
    shader.uniforms.uRimStrength = { value: strength };
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform vec3 uRimColor;
         uniform float uRimPower;
         uniform float uRimStrength;`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
         float rim = 1.0 - max(dot(normalize(vViewPosition), normal), 0.0);
         rim = pow(clamp(rim, 0.0, 1.0), uRimPower) * uRimStrength;
         totalEmissiveRadiance += uRimColor * rim;`,
      );
  };
}

export interface CharMatOpts {
  color: number;
  rimColor?: number;
  roughness?: number;
  metalness?: number;
  emissive?: number;
  emissiveIntensity?: number;
}

export function charMaterial(opts: CharMatOpts): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: opts.color,
    roughness: opts.roughness ?? 0.85,
    metalness: opts.metalness ?? 0,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    flatShading: true,
  });
  if (opts.rimColor) addRim(mat, opts.rimColor);
  return mat;
}

export function metalMaterial(color: number, rough = 0.45): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.9, flatShading: true });
}

export function emissiveMaterial(color: number, intensity = 2): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0x000000,
    emissive: color,
    emissiveIntensity: intensity,
    roughness: 1,
    metalness: 0,
    toneMapped: false,
  });
}

export function unlitMaterial(color: number, opacity = 1): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    toneMapped: false,
  });
}

/** Rarity → colour used for loot beams, item gems, and labels. */
export function rarityColor(rarity: string): number {
  switch (rarity) {
    case 'magic':
      return 0x6f9bff;
    case 'rare':
      return 0xe8d24b;
    case 'unique':
      return 0xff8a3c;
    case 'set':
      return 0x37c837;
    default:
      return 0xcfcfcf;
  }
}

/** Damage-type → VFX colour grammar (ASSET_PIPELINE.md §2). */
export function damageColor(type: string): number {
  switch (type) {
    case 'fire':
      return 0xff7a2e;
    case 'cold':
      return 0x7fdfff;
    case 'lightning':
      return 0xc9a0ff;
    case 'shadow':
      return 0xb060ff;
    default:
      return 0xffd8a0;
  }
}

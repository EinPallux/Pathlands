# Pathlands — Asset Pipeline

How **every** asset in Pathlands is made. The developer (Opus) authors assets autonomously — procedurally, programmatically, and at high quality — and may additionally source strictly-CC0 assets. This document is the law for both routes.

---

## 1. Principles

1. **Authored-first.** The default is to *generate* assets with committed, re-runnable generators (`tools/asset-gen/*`). Generators + outputs are both committed; an asset without its generator (or manifest entry) is a bug.
2. **CC0-only sourcing.** External assets must be CC0/public-domain. If the license is CC-BY, ambiguous, unverifiable, or the download fails — author it instead. No exceptions, no "attribution later."
3. **One visual language.** Every asset — generated or sourced — must pass the style guide (§2). Sourced assets get retooled (re-textured, re-paletted, decimated) to fit before use.
4. **Manifest or it doesn't exist.** Every file under `assets/` has an entry in `assets/MANIFEST.json` (§7).
5. **Budget-clean.** Every asset meets the budgets in §6 at creation time — not "optimize later."

## 2. Style Guide — "Broken-Beautiful"

- **Look:** stylized painterly-dark fantasy. Not photoreal, not cartoon: chunky readable forms, hand-painted-style texture detail, strong value structure. Reference feel: Diablo IV's material gravity × Lost Ark's VFX spectacle, simplified for stylization.
- **Silhouette first:** every character/monster/prop must read as a black shape at gameplay camera distance. Monster families share silhouette DNA (Riven = torn/asymmetric, Hollowed = rigid/vertical, Broods = low/clustered…).
- **Value & color:** environments desaturated (max ~40% saturation) and mid-dark; gameplay elements pop — player rim-light always on, enemies warm-tinted vs. cool grounds, VFX and loot beams allowed full saturation. Per-zone palette: 2 dominant hues + 1 accent (Emberfall: ash-grey/umber + ember-orange accent).
- **PBR discipline:** albedo carries painted detail + baked AO hints; roughness broad-strokes (cloth 0.8–0.95, worn metal 0.35–0.55); metalness binary; emissive reserved for magic/tech/loot.
- **VFX language:** damage types own their palette & shape grammar — Fire: orange-white embers/licks · Cold: cyan crystalline shards/mist · Lightning: white-violet branches · Shadow: purple-black smoke/tendrils · Physical: dust/sparks. Telegraphs are always red-orange rimmed shapes on the ground; friendly zones teal.

## 3. Authored Assets — Generators (`tools/asset-gen/`)

Node/TS scripts that output final runtime formats. Each generator: seeded, parameterized, documented at top of file, `pnpm gen <name>` runnable.

- **Characters & monsters:** parametric mesh construction (skeleton-driven primitives → sculpt-like noise displacement → decimate), auto-skinned to authored skeletons; family generators produce variants (scale/proportion/attachment permutations). Output: GLB (meshopt), plus **VAT bakes** (vertex-animation textures) for crowd rendering.
- **Animation:** programmatic keyframe authoring library (pose DSL: `pose(t).spine(bend).armR(swing)…`) with easing curves + procedural layers (IK foot-planting, look-at, secondary bone jiggle). Locomotion sets, attack sets (anticipation/contact/follow-through timings from the feel spec), hit reactions, deaths.
- **Environment kits:** modular piece generators (walls/floors/arches/rocks/trees) with per-biome parameter packs; trees/vegetation via L-system-lite; terrain heightfields from layered noise with painted-mask blending.
- **Textures:** procedural texture compositor (noise stacks, gradients, edge-wear, AO bake from geometry, painterly brush-stamp passes) → WebP/KTX2. Trim-sheets + atlases per biome kit.
- **Icons (items/skills/buffs):** generated via the same compositor + 3D-render-to-sprite rig (orthographic beauty shots of item meshes with rim key), post-processed to painted style; consistent framing/border per rarity.
- **VFX textures/meshes:** flipbooks (noise-advected sims baked offline in the generator), gradient LUTs, distortion normals, trail ribbons.
- **UI:** SVG-first (crisp at any scale) → sprite atlas; nine-slice panels, ornamental frames per the UI style (dark stone + ember filigree).

## 4. Sourced Assets — CC0 Catalog

Approved sources (verify license *per file* at download time):

| Source | Type | Notes |
|---|---|---|
| Kenney.nl | models, UI, audio | all CC0 |
| Quaternius.com | animated characters/monsters, kits | CC0 |
| Poly Haven | HDRIs, textures, some models | CC0 |
| ambientCG | PBR textures | CC0 |
| OpenGameArt | mixed | **filter CC0 only** |
| Freesound | SFX | **filter CC0 only** |
| Pixabay audio | music/SFX | Pixabay license (permissive; record it) |

Workflow: download → license check → retool to style guide (repalette/decimate/re-rig as needed via a `tools/asset-gen/retool-*` script so the transformation is reproducible) → budget check → manifest entry → commit.

If network access is unavailable or a source 404s: **author it**. Never substitute a differently-licensed file.

## 5. Audio

- **SFX:** layered synthesis (`tools/asset-gen/sfx/` — noise/FM/granular primitives + envelopes → OGG) for impacts, whooshes, UI, magic; CC0 recordings for organic material (foley, ambience beds). Impact SFX are 2–3 layer composites (transient + body + tail) with 3+ round-robin variants each.
- **Music:** composed programmatically as MIDI-like note data + synth/sample rendering in the generator (dark-orchestral palette: low strings, taiko-ish drums, choir pads, solo cello/duduk leads), arranged in **vertical layers** (explore base / combat layers / boss stingers) exported as aligned OGG stems. CC0 orchestral samples allowed as instrument sources.
- Loudness: music −16 LUFS integrated, SFX peaks ≤ −3 dBFS, normalized in the pipeline.

## 6. Budgets & Formats

| Asset | Budget | Format |
|---|---|---|
| Player/hero models | ≤ 15k tris, 2048² texture set | GLB (meshopt) + skeleton |
| Monsters | ≤ 8k tris, 1024², VAT for crowds | GLB + VAT KTX2 |
| Bosses | ≤ 25k tris, 2048² | GLB + skeleton |
| Props/kit pieces | ≤ 2k tris, trim-sheet/atlas share | GLB instanced |
| Textures | KTX2 (BasisU UASTC for normals, ETC1S else) | + WebP for UI |
| Icons | 128² in atlas | WebP atlas |
| SFX | ≤ 100 KB each | OGG 44.1k |
| Music | streamed stems | OGG 96–128 kbps |

Naming: `assets/<domain>/<family>/<name>_<variant>.<ext>` — e.g. `assets/monsters/riven/husk_a.glb`, `assets/env/emberfall/wall_arch_02.glb`.

## 7. MANIFEST.json

Every asset file gets an entry:

```json
{
  "path": "assets/monsters/riven/husk_a.glb",
  "kind": "model",
  "origin": "generated",            // or "sourced" | "sourced-retooled"
  "generator": "tools/asset-gen/monsters/riven.ts#husk",
  "seed": 1042,
  "source": null,                    // sourced: { "url": "...", "license": "CC0-1.0", "retrieved": "2026-07-04", "author": "..." }
  "budget": { "tris": 6410, "textureMax": 1024 },
  "usedBy": ["content/monsters/riven_husk.ts"]
}
```

`tools/validate-content` fails the build on: unmanifested files, manifested-but-missing files, non-CC0 licenses, budget violations, and unused assets (warning).

## 8. Quality Gate (per asset, before commit)

1. Reads correctly at gameplay camera distance (silhouette + value check).
2. Passes style palette rules for its zone/family.
3. Within budget (§6); LODs present where required.
4. Animations hit the feel-spec timings (contact frames land on hit events).
5. Manifest entry complete; generator re-runs reproducibly.

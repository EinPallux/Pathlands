# Changelog — Pathlands

All notable changes to Pathlands are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · Versioning: completing roadmap Phase N releases `0.N.0`; project completion is `1.0.0` (see `ROADMAP.md`).

Every development session records its work under **[Unreleased]** in the appropriate category. When a phase completes, [Unreleased] is cut into a dated version heading.

---

## [Unreleased]

### Planned (next)
- Phase 2 — *Loot, Builds & All Five Classes*: itemization depth, inventory/stash/crafting UI, skill web + support runes, four new classes. See `ROADMAP.md`.

---

## [0.1.0] — 2026-07-04 — Phase 1: The Heart — SHIPPED

The first large, complete, browser-playable slice: a stranger opens the URL and,
within a minute, is carving through a finished zone with AAA-ARPG combat feel.
Boots to gameplay with zero console errors; 44 unit/integration tests + 3
Playwright smoke tests green; deterministic simulation proven by replay hash.

### Added — Foundation
- Vite + TypeScript (strict) + pnpm toolchain; split browser/node tsconfigs;
  ESLint (flat) with sim-determinism guards; Prettier; Vitest; Playwright;
  `vercel.json`; `pnpm verify` gate; boot harness with WebGL2 check + error boundary.

### Added — Deterministic runtime
- PCG32 seeded RNG with named, serializable streams; 2D ground-plane math;
  sparse-set ECS (O(1) structural ops, deferred destroy, typed views);
  double-buffered event bus; command-driven simulation (the future net protocol);
  fixed 30 Hz sim / interpolated render loop.

### Added — Combat & stats
- Modifier engine (flat/increased/more per stat key) + stat computation from
  class curve + gear/buffs; full deterministic damage pipeline (roll → inc/more
  → crit → armor/resist → shock → block → evasion → apply → leech → knockback →
  ailment → feedback); ailments (bleed/ignite/corruption DoTs, chill/freeze/shock).

### Added — Content (data-driven, validated)
- **Sentinel** class complete for levels 1–10 with the **Wrath** resource and 6
  skills: Cleave, Shield Slam, Whirl Charge, Warcry, Sunder, Bulwark.
- **6 monsters** across the Riven & Ashborn families + telegraphed brute, plus
  the multi-phase act boss **Vorthak, Warden of the Broken Gate**.
- Itemization v1: bases, tiered affixes, sockets-ready, **3 uniques**, loot
  tables, smart drops; **3 elite affixes** (Fierce/Frozen Aura/Volatile).
- **Emberfall Reach** — a finished zone: escalating pack gauntlet, environmental
  props & storytelling, waypoint + shrine, and the Broken Gate boss arena.
- Content registry + CI-fatal cross-reference validator.

### Added — Simulation systems
- Player controller (click-to-move + WASD, mouse aim, dodge roll with i-frames,
  potion), enemy AI (aggro/leash, melee/ranged/brute/swarm archetypes,
  telegraphs, boss phase mechanics), pathing-lite + circle collision via spatial
  hash, projectiles, area effects, XP/level-up with skill unlocks, loot drops,
  pickups, death/respawn.

### Added — Presentation
- Three.js render pipeline: pitched ARPG camera with trauma shake, rim-lit
  procedural characters/monsters/boss, procedural environment kit + ground,
  per-zone lighting, GPU particle system, telegraph decals, floating damage
  numbers, bloom post (with safe fallback), hero highlight ring + follow-light.
- Procedural assets authored entirely in code (24 assets across 5 generators);
  no binary payload — initial JS is ~161 KB gzipped, far under budget.
- WebAudio mixer with synthesized combat/UI SFX and an ambient music bed that
  brightens with combat intensity.
- HUD: health/Wrath orbs, skill bar with cooldowns + keybinds, XP bar, boss bar
  with phase pips, low-health vignette, toasts, death overlay.

### Added — Persistence & flow
- Main menu, character creation, settings (volumes/quality), pause (tab-out
  pauses); IndexedDB save v1 with versioned migrations + export/import;
  autosave; continue from menu.

### Added — Tooling
- `pnpm bench` headless balance harness; `pnpm gen` asset manifest validator;
  `assets/MANIFEST.json`.

### Balanced
- XP curve softened (`40·level^1.42`) and monster XP raised so a full Emberfall
  clear lands the player around level 5–6 by the boss; boss life 900 → 820.
  Bench (naive Sentinel bot, 5 seeds): boss down 5/5, ~74 s, ~1.4 deaths, level 5.

---

<!--
Template for phase releases:

## [0.N.0] — YYYY-MM-DD — Phase N: <Name> SHIPPED
### Added
### Changed
### Balanced
### Fixed
### Assets
### Performance
-->

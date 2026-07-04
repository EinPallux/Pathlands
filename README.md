# Pathlands

**A fully realized, browser-playable 3D Action RPG** — inspired by Diablo IV, Lost Ark, and Path of Exile 2 — built with TypeScript, Three.js, and a custom high-performance game runtime. No installs, no launchers: open a URL and play.

> Pathlands is **not** an MVP, prototype, or tech demo. The end state of this project is a complete, polished, deeply systemic ARPG with a full campaign, five classes, rich itemization, endgame content, and meta progression — and, in its final phase, shared-world MMO features.

---

## The Pitch

The world of **Vhal** was shattered by the collapse of the **Ley Paths** — rivers of raw creation that once bound the continents together. Where the Paths broke, reality bled. Now the **Pathlands** — scarred borderlands between the living world and the raw chaos beyond — crawl with the Riven: creatures born from broken reality. You are a **Pathwalker**, one of the few who can tread the broken Paths and survive. Carve through the Riven, reclaim the shattered Waypoints, and follow the dying light of the Paths to the source of the Sundering itself.

## Pillars

1. **Combat feel above everything.** Every hit has weight. Cancel-windows, hit-stop, screen response, corpse physics, damage numbers that *feel* earned. If combat isn't fun with zero items and one skill, nothing else matters.
2. **Loot is the heartbeat.** Deep, legible itemization — affixes, uniques, crafting — with constant meaningful drops and long-term chase items.
3. **Builds, not classes.** Five classes, each with a skill web and support system that produces genuinely different playstyles within a class.
4. **The world is the endgame.** Campaign flows into an infinitely replayable endgame (Pathstones, Rift Hunts, endgame bosses, Ascension meta progression) without a hard break in the experience.
5. **Browser-native, zero excuses.** 60 FPS on mid-range hardware, < 5s to gameplay from a cold load, instant session resume. Being in a browser is a feature, never an excuse.

## Tech at a Glance

| Layer | Choice |
|---|---|
| Language | TypeScript (strict) |
| Rendering | Three.js (WebGL2), custom render pipeline, instancing-first |
| Runtime | Custom ECS (archetype-based), fixed-timestep simulation |
| Build / Dev | Vite, pnpm |
| Client Hosting | Vercel (every phase is deployed and playable) |
| Persistence (pre-MMO) | IndexedDB (local save slots, export/import) |
| MMO backend (final phases) | Node + uWebSockets.js authoritative server, Postgres + Redis (hosted off-Vercel) |
| Testing | Vitest (simulation/unit), Playwright (smoke/e2e) |

Full rationale in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Repository Map

```
/                     — you are here
CLAUDE.md             — instructions for the AI developer (Opus): standards, workflow, quality bar
AGENTS.md             — agent roles, responsibilities, and delegation patterns
ROADMAP.md            — the development plan: 8 large phases, each shipping a big playable slice
CHANGELOG.md          — running log of everything shipped, per phase
docs/
  GDD.md              — the complete Game Design Document (classes, combat, items, world, endgame)
  ARCHITECTURE.md     — technical architecture: engine, ECS, rendering, data, save system
  ASSET_PIPELINE.md   — how ALL assets are created (procedurally authored) or sourced (CC0)
  NETWORKING.md       — the MMO architecture for the final phases
src/                  — game source (created in Phase 1)
assets/               — generated + sourced assets with manifest and license records
tools/                — asset generators, data validators, build scripts
```

## Development Model

This game is developed **fully autonomously by Claude (Opus)**, phase by phase, following [`ROADMAP.md`](ROADMAP.md). Each phase:

- ships a **large, complete, polished slice** of the game (no skeleton milestones),
- ends **deployed to Vercel and playable in a browser**,
- includes its own assets, audio, UI, balancing, and tests,
- is recorded in [`CHANGELOG.md`](CHANGELOG.md).

The **MMO layer comes last** (Phases 7–8) by design: everything before it is a complete single-player-plus-local-persistence ARPG that can be tested end-to-end on Vercel alone.

## Playing / Testing

Once Phase 1 lands:

```bash
pnpm install
pnpm dev          # local dev server
pnpm build        # production build
pnpm preview      # serve the production build locally
pnpm test         # simulation + unit tests
pnpm test:e2e     # Playwright smoke tests
```

Deployment target: **Vercel** (static output from `pnpm build`; SPA rewrites). Every phase merge redeploys the playable game.

## License

Game code: MIT. Sourced assets retain their original licenses (CC0 only), tracked per-file in `assets/MANIFEST.json`. See [`docs/ASSET_PIPELINE.md`](docs/ASSET_PIPELINE.md).

# CLAUDE.md — Developer Instructions for Pathlands

You (Claude / Opus) are the **sole developer** of Pathlands: a complete, polished, browser-playable 3D ARPG. This file is your standing contract. Read it at the start of every session, together with `ROADMAP.md` (what to build next) and the relevant `docs/` specs (how it must behave).

---

## 1. Prime Directives

1. **Ship complete slices, never skeletons.** Every roadmap phase ends with a large, finished, *polished* part of the game — art-passed, sounded, balanced, tested, deployed. "It technically works" is not done. "It feels like Diablo IV / Lost Ark / PoE2" is done.
2. **The game must always be playable.** `main` must always build, deploy to Vercel, and be fun to play at its current scope. Never leave `main` in a broken or half-migrated state.
3. **Combat feel is the top priority.** When trading off anywhere, protect: input latency, animation responsiveness, hit feedback, frame rate. See `docs/GDD.md §4`.
4. **You create the assets.** Every model, texture, VFX, UI element, and sound is either authored by you (procedurally / programmatically, at high quality) or sourced from strictly CC0 libraries. Follow `docs/ASSET_PIPELINE.md` exactly — including the license manifest. Never use an asset with an unclear license.
5. **Data-driven everything.** Skills, items, affixes, monsters, zones, quests, loot tables are **data** (typed JSON/TS definition files), validated at build time. Hardcoded game content is a bug.
6. **The MMO comes last.** Do not add server dependencies, accounts, or network code before Phase 7. Everything pre-MMO runs fully client-side with IndexedDB saves and deploys as a static Vercel site. *Do* respect the determinism and authority-boundary rules in `docs/ARCHITECTURE.md §9` so the MMO retrofit is a port, not a rewrite.

## 2. Tech Stack (fixed — do not re-litigate)

- **TypeScript strict**, ESM, `pnpm`, **Vite**.
- **Three.js** (WebGL2) with a custom render layer: instancing-first, draw-call budgets, custom shaders where needed. No heavyweight engine (no Unity/Godot exports, no Babylon migration).
- **Custom archetype ECS** for simulation (see `docs/ARCHITECTURE.md §3`). Fixed timestep 30 Hz simulation, interpolated 60+ FPS rendering.
- **No physics engine.** ARPG collision = circle/capsule colliders + spatial hash + navgrid/flow-field pathing. Custom and deterministic.
- **UI:** HTML/CSS overlay (game UI) rendered via a thin reactive layer — **no React** for in-game HUD hot paths; the HUD updates from the simulation directly. Menus/inventory may use lightweight components. All UI must be gamepad-navigable by Phase 6.
- **Audio:** WebAudio directly (custom mixer buses: master/music/sfx/ui/ambience).
- **State/saves (pre-MMO):** IndexedDB via a versioned, migration-capable save module. Export/import as file.
- **Tests:** Vitest for simulation and data validation; Playwright for boot/smoke/e2e.
- **Deploy:** Vercel static output. Keep `vercel.json` with SPA rewrites in repo.

## 3. Working Method (every session)

1. **Orient.** Read `ROADMAP.md` — find the current phase and its checklist. Read `CHANGELOG.md` [Unreleased] to see in-flight work. Skim relevant `docs/` sections.
2. **Plan the slice.** Pick the largest coherent unit of the phase you can complete to *finished* quality this session. Whole systems, not stubs.
3. **Build data → simulation → presentation → feel → sound → test**, in that order. A feature isn't started at the renderer; it's started at its data definition.
4. **Polish in the same session.** VFX, SFX, animation timing, UI states (empty/loading/error), and balance numbers are part of the feature, not a later phase.
5. **Verify.** `pnpm lint && pnpm typecheck && pnpm test && pnpm build`, plus Playwright smoke. Then actually play-test the loop you built (drive the game headless/e2e where possible and describe manual-test steps in the commit).
6. **Record.** Update `CHANGELOG.md` ([Unreleased] → concrete entries), tick `ROADMAP.md` checkboxes, update `assets/MANIFEST.json` for any new/sourced assets.
7. **Commit and push** with clear messages (see §7).

## 4. Quality Bars (hard requirements)

### Performance budgets (mid-range laptop, integrated GPU, 1080p)
- 60 FPS in normal combat; ≥ 45 FPS with 60+ active enemies and heavy VFX.
- Simulation tick ≤ 4 ms; render ≤ 10 ms; draw calls ≤ 300 in combat scenes.
- Cold load → main menu < 5 s on fast 3G-class throttling; menu → gameplay < 3 s. Zone streaming without hitches > 50 ms.
- Total initial payload ≤ 25 MB compressed; assets stream progressively after.

### Feel budgets
- Input → visible action start ≤ 50 ms (animation may anticipate, but the character must respond).
- Every damage event has: hit VFX, hit SFX, damage number, and (for melee) 30–60 ms hit-stop on kills/crits.
- No default browser artifacts: no text selection in-game, no context menu, correct cursor, canvas resizes cleanly, tab-out pauses (pre-MMO).

### Code standards
- `tsconfig` strict; ESLint + Prettier enforced; no `any` outside typed-boundary shims.
- Simulation code is **deterministic**: seeded RNG only (`sim/rng.ts`), no `Math.random`, no `Date.now`, no wall-clock or render-state reads inside simulation.
- Content definitions live in `src/content/**` and are validated by schema tests — CI fails on dangling references (e.g., a loot table referencing a missing item).
- Every system gets unit tests for its math/rules (damage pipeline, affix rolls, pathing, save migration). Playwright covers: boot, new character, kill a monster, loot an item, level up, save/reload.

## 5. Asset Rules (summary — full spec in `docs/ASSET_PIPELINE.md`)

- **Authored assets:** procedural generation is the default — geometry built in code or via `tools/asset-gen` scripts that output GLTF/GLB, textures generated (noise, gradients, bakes) into KTX2/WebP, animations authored programmatically (keyframe builders, procedural locomotion/IK). Commit both the generator and the output.
- **Sourced assets:** CC0 **only** (Kenney, Quaternius, Poly Haven, ambientCG, OpenGameArt CC0, Freesound CC0, Sonniss GDC where license allows). Record every file in `assets/MANIFEST.json` (source URL, license, retrieval date). If a download fails or a license is ambiguous → author it procedurally instead.
- **One visual language:** stylized painterly-dark fantasy, strong silhouettes, rim-lit characters, desaturated environments with saturated VFX (see style guide in `docs/ASSET_PIPELINE.md §2`). Reject/retool any sourced asset that breaks the style.
- Budgets: hero characters ≤ 15k tris, monsters ≤ 8k, props ≤ 2k; textures ≤ 1024² (2048² only for hero/boss); everything instancing-friendly.

## 6. Balancing & Content Discipline

- All tunable numbers live in content/data files with comments explaining intent. Balance passes are explicit commits ("balance: reduce Act I elite HP by 12%") with reasoning.
- Use the simulation headlessly for balance: `tools/sim-bench` runs scripted fights (build vs. monster pack) and reports TTK/DPS/death-rate. Add scenarios as content grows.
- Difficulty target: campaign is beatable by a casual player picking obvious skills; endgame tiers scale to punish/reward optimization (see `docs/GDD.md §9`).

## 7. Git & Process

- Work on the designated feature branch; push with `git push -u origin <branch>`; retry on network errors (2s/4s/8s/16s backoff).
- Commits: imperative, scoped, and self-explanatory (`combat: add dodge-roll i-frames + stamina cost`, `assets: generate riven-husk monster set (5 variants)`).
- `CHANGELOG.md` follows Keep-a-Changelog; every session's work lands under `[Unreleased]`, moved to a version heading when a phase completes (phase completion = minor version bump: Phase 1 → 0.1.0, Phase 2 → 0.2.0 …).
- Never create a PR unless explicitly asked.
- When a phase completes: tick everything in `ROADMAP.md`, cut the changelog version, verify the Vercel build (`pnpm build && pnpm preview` + Playwright against preview), then note the phase as **SHIPPED** in the roadmap.

## 8. What NOT to do

- Don't build placeholder/"programmer-art-for-now" content and move on — the phase isn't done until its content looks and sounds finished.
- Don't add dependencies casually. Every new package needs a one-line justification in the commit. Forbidden: physics engines, React-in-HUD, CSS frameworks, state libraries for simulation state.
- Don't introduce network/server code before Phase 7. Don't put secrets in the repo, ever.
- Don't break saves. Save format changes require a migration in `src/save/migrations/` + a test loading a fixture of every prior version.
- Don't rewrite working systems for elegance during content phases. Refactors need a gameplay-visible payoff or a measured perf win.

## 9. Definition of "100% Ready to Play" (project end state)

Five classes with full skill webs; 3-act campaign (~12–15 h); complete itemization with crafting; endgame (Pathstones, Rift Hunts, pinnacle bosses); Ascension meta progression; difficulty tiers; full audio/music; onboarding; settings (graphics/audio/keybinds/accessibility); gamepad support; stable 60 FPS; robust saves — **then** the MMO layer: accounts, authoritative server, shared towns, parties, trade, world bosses, leaderboards. See `ROADMAP.md` for the phase-by-phase path there.

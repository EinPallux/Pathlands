# ROADMAP — Pathlands

Eight phases. Each phase is a **large, self-contained slab of the game**, shipped finished: art-passed, sounded, balanced, tested, and **deployed to Vercel as a playable build**. There are no "setup-only" or skeleton milestones — Phase 1 already ends with real, satisfying combat in a finished zone.

Phases 1–6 build the **complete offline game** (client-only, IndexedDB saves, static Vercel deploy). Phases 7–8 add the **MMO layer** last, once every core system is proven fun.

**Versioning:** completing Phase N releases `0.N.0`. Project completion is `1.0.0`.

Status legend: `[ ]` todo · `[~]` in progress · `[x]` done · **SHIPPED** = phase complete & deployed.

---

## Phase 1 — The Heart: Engine, Combat & the First Zone  `0.1.0`

**Goal:** A stranger opens the URL and, within 60 seconds, is carving through packs of monsters in a fully art-passed zone with combat that already feels like a AAA ARPG. This phase builds the engine *and* proves the game.

**Playable result:** Main menu → character (Sentinel class) → **Emberfall Reach** (first Pathlands zone, fully finished) → fight 6 monster types incl. elites and a zone boss → level to ~10 with 6 working skills → die/respawn → local save/continue.

### Deliverables
- [ ] Project foundation: Vite + TS strict + pnpm, ESLint/Prettier, Vitest, Playwright, `vercel.json`, CI-grade `pnpm verify` script (lint+typecheck+test+build).
- [ ] Core runtime: archetype ECS, fixed 30 Hz simulation / interpolated render, seeded deterministic RNG, event bus, entity prefab system.
- [ ] Render pipeline: Three.js WebGL2 scene management, ARPG camera (pitched perspective, subtle zoom/shake), instanced static/skinned rendering, cascaded shadow (single cascade acceptable), post stack (bloom, vignette, color grade), GPU particle system, decals (blood/scorch), day-mood lighting rig per zone.
- [ ] Character controller: click-to-move **and** WASD, mouse-aim skills, pathing (navgrid + flow fields for hordes), collision (circle colliders + spatial hash), dodge roll with i-frames.
- [ ] Combat core: full damage pipeline (hit → mitigation → crit → resist → number), HP/resource, hit reactions, knockback, hit-stop, death (ragdoll-lite or dissolve), damage numbers, health globes drop.
- [ ] Stats system v1: core attributes, life/resource, armor/resists, crit, attack/cast speed, movement speed — data-driven and test-covered.
- [ ] **Sentinel class complete for levels 1–10:** 6 skills (e.g. Cleave, Shield Slam, Whirl Charge, Warcry, Sunder, Bulwark) with full VFX/SFX/animation, resource (Wrath), basic passive choices on level-up.
- [ ] Enemy AI: aggro/leash, melee/ranged/caster archetypes, pack behavior, telegraphs for heavy attacks, elite modifiers v1 (Fierce, Frozen Aura, Volatile), one **zone boss** (multi-phase, arena, telegraphed mechanics).
- [ ] **Emberfall Reach zone, finished:** ~10 min traversal, hand-designed layout from modular kit, environmental storytelling, ambient VFX (embers, fog), breakables, a waypoint, and the boss arena. Full art pass per the style guide.
- [ ] Asset foundation: `tools/asset-gen` pipeline live; character/monster models (rigged + animated), environment kit (~30 modular pieces), props, VFX textures — authored or CC0-sourced, all in `assets/MANIFEST.json`.
- [ ] Audio v1: WebAudio mixer, combat SFX (hits, skills, deaths, UI), ambient zone bed, one combat + one explore music track, positional audio.
- [ ] HUD v1: health/resource orbs, skill bar with cooldowns, XP bar, boss bar, damage numbers, minimal pause/settings (volume, quality preset).
- [ ] Save v1: IndexedDB slot save (character, progress, position), continue from menu, save versioning scaffold.
- [ ] Tests: damage pipeline, RNG determinism, pathing, save round-trip; Playwright: boot → kill → level → save → reload.
- [ ] **Deployed to Vercel, playable end-to-end.**

**Phase exit bar:** a 15-minute session is *fun* and runs at 60 FPS; combat feel checklist in `docs/GDD.md §4` fully passes.

---

## Phase 2 — Loot, Builds & All Five Classes  `0.2.0`

**Goal:** The ARPG heartbeat. Itemization, inventory, crafting foundations, full skill/passive systems — and all five classes playable with complete kits for the leveling game.

**Playable result:** Pick any of 5 classes, level through the (still single-zone-chain) content to ~25, fill out a build via skill web + supports, manage a full inventory of affix-rolled gear, gamble/craft at a vendor, and feel measurably, visibly more powerful.

### Deliverables
- [ ] Item system: bases, implicits, rarities (Common/Magic/Rare/Unique), full affix pool (~120 affixes v1) with tiers and weighting, item level & drop-smartness, sockets + gems v1.
- [ ] ~25 hand-designed **Uniques** with build-warping effects (not just stat sticks), each with distinct model/icon.
- [ ] Loot: weighted loot tables per monster family/elite/boss, drop VFX + rarity beams, loot filter v1 (rarity toggles), ground-item labels, pickup radius for gold/globes.
- [ ] Inventory & equipment UI: grid inventory, paper-doll, compare tooltips (full DPS/EHP deltas), stash tab v1 in town hub, item lock/salvage.
- [ ] Crafting v1: salvage → materials, vendor gamble, affix reroll, upgrade item rarity; crafting bench UI.
- [ ] Character systems: **skill web** per class (~60 nodes: minor stats, notable passives, keystones), **support-rune system** (each active skill takes up to 3 supports that mutate behavior — chain, multistrike, echo, elemental conversion…), free respec with gold cost.
- [ ] **Four new classes, complete kits (8+ skills each, full VFX/SFX/anim):**
  - [ ] **Stormcaller** — elemental caster (lightning/frost), casts and channels, mana.
  - [ ] **Shadowblade** — melee assassin, combo points, mobility, poison/bleed.
  - [ ] **Warden** — ranger/summoner hybrid, bow skills + 3 summon types, essence.
  - [ ] **Ashkeeper** — fire priest / dark support, DoTs, auras, sacrifices.
- [ ] Class select screen with 3D character preview and starting-gear looks.
- [ ] Shared damage-over-time, buff/debuff, aura, and summon frameworks (data-driven, reused by monsters too).
- [ ] Town hub v1 (**Last Lantern**): vendor, blacksmith (craft), stash, waypoint — with NPC idle life and ambience.
- [ ] Monster roster expansion to ~15 types + 2 more elite affixes to stress-test builds.
- [ ] `tools/sim-bench`: headless build-vs-pack scenarios for TTK/DPS balance; initial balance pass across all 5 classes.
- [ ] Tests: affix roll distribution, loot table integrity (no dangling refs), support-rune interaction matrix, DPS regression harness.
- [ ] **Deployed to Vercel.**

**Phase exit bar:** two different builds of the same class play *differently*; an hour of loot grinding is compelling on its own.

---

## Phase 3 — The World: Act I Campaign  `0.3.0`

**Goal:** Pathlands becomes a *world*. Act I complete: overworld zones, dungeons, quests, NPCs, story, cinematics-lite, and the first act boss — a 4–5 hour polished campaign chunk.

**Playable result:** New character → Act I from the burning of Emberfall through the Sunken Marches to the **Warden of the Broken Gate** act boss. Main quest (9 quests), 8 side quests, 3 dungeons, 2 towns, world map travel, and a story worth following.

### Deliverables
- [ ] World structure: zone graph, waypoint network, world map UI, zone streaming (seamless within act, loading between), area-level scaling rules.
- [ ] **6 overworld zones + 3 dungeons + 2 towns**, each fully art-passed with distinct biome kits (Emberfall ruins, ash forests, drowned marshes, cliff roads, the Broken Gate), ambient life, secrets, shrines, events (small dynamic encounters), and lore objects.
- [ ] Quest system: data-driven quest graph (objectives, triggers, states), journal UI, map markers, rewards; **main quest line (9)** + **8 side quests** with real scripting variety (escort-free! — defense, puzzle-lite, boss-hunt, collection-with-twist).
- [ ] Dialogue system: NPC dialogue UI with choices, barks, quest text; ~20 named NPCs with personality; lore books/echo-stones (audio-lite lore).
- [ ] Cinematic-lite system: in-engine camera sequences with letterboxing for act beats (opening, midpoint, act boss intro/outro).
- [ ] Story implementation per `docs/GDD.md §10` — Act I: *The Broken Gate*.
- [ ] Monster roster to ~30 types across 5 families with per-family behaviors; 3 dungeon end-bosses + **Act I boss** (full multi-phase spectacle fight).
- [ ] Checkpointing, death penalties (durability), town portal skill, waypoint fast travel.
- [ ] Difficulty foundation: Normal + Veteran selectable at character creation.
- [ ] Music expansion: per-biome explore tracks, combat layers (vertical mixing), boss themes, town theme.
- [ ] Performance: zone streaming under budget, instancing audit, texture memory audit.
- [ ] Tests: quest state machine, save/load mid-quest fixtures, zone-transition e2e.
- [ ] **Deployed to Vercel.**

**Phase exit bar:** a new player plays Act I start-to-finish (~4–5 h) without hitting a rough edge, and wants Act II.

---

## Phase 4 — Acts II & III: The Full Campaign  `0.4.0`

**Goal:** The complete campaign. Two more acts (bigger, stranger, harder), the full monster bestiary, the endgame-ready level curve to 60, and the story's conclusion at the Source of the Sundering.

**Playable result:** ~12–15 hour campaign across 3 acts, 60+ monster types, 3 act bosses + the final boss, all classes balanced to 60.

### Deliverables
- [ ] **Act II — *The Hollow Crown*** (5–6 h): 7 zones + 4 dungeons + 1 town across the Vhelmark highlands & the Undervault (dwarven ruin biome); political-corruption arc; **Act II boss: the Hollow King**.
- [ ] **Act III — *The Source*** (4–5 h): 6 zones + 3 dungeons + 1 refuge across the Rivenwaste (reality-torn biome — floating terrain, chaos storms, path-fragments as bridges); **Act III boss + final boss: Nhyx, the Unpathed**, a proper multi-arena finale.
- [ ] Full bestiary: 60+ monster types / 9 families, family-specific mechanics (Riven warp-dodge, Hollowed shield-walls, Cult ritual-casters that buff packs…), 12+ elite affixes, rare monsters with modifier combos + names.
- [ ] Campaign-long systems: level curve to 60, gear progression tiers (item levels through endgame bases), skill web expansion (~100 nodes/class), second support-rune tier, attribute respec.
- [ ] 20 more Uniques (45 total) incl. act-boss-specific drops; first **set items** (3 sets).
- [ ] Side content: 14 more side quests, zone events v2, superbosses ×2 hidden in the world, collectible lore arcs.
- [ ] Cinematic beats for both acts; full story per `docs/GDD.md §10`.
- [ ] Balance: full-campaign sim-bench sweeps per class per act; boss tuning (Normal/Veteran).
- [ ] Audio completion for campaign: per-biome soundscapes, act boss themes, final-boss multi-phase score.
- [ ] Tests: full campaign progression e2e (scripted speedrun bot), bestiary data validation, level-curve regression.
- [ ] **Deployed to Vercel.**

**Phase exit bar:** the campaign is a complete, satisfying ARPG story arc with no filler zones and no difficulty cliffs.

---

## Phase 5 — Endgame & Meta Progression  `0.5.0`

**Goal:** The reason to keep playing. Campaign flows into a deep endgame: Pathstones (mapping), Rift Hunts, pinnacle bosses, Ascension (account meta progression), difficulty tiers, and target-farming economies.

**Playable result:** Finish the campaign → unlock the **Atlas of Broken Paths** → run modified endgame maps with escalating risk/reward → push Rift tiers → hunt 4 pinnacle bosses → grow account-wide Ascension power and unlock alt-character boosts. Hundreds of hours of structure.

### Deliverables
- [ ] **Pathstones (maps):** consumable keys that open remixed zone instances; ~40 base layouts drawing on all campaign biomes with endgame-only twists; Pathstone affixes (risk modifiers that boost quantity/rarity), tiers 1–16, sustain/upgrade crafting; the **Atlas** UI — a visual web of paths where completion unlocks passive Atlas bonuses and target-farm specialization.
- [ ] **Rift Hunts:** timed escalating rift runs (Greater-Rift-style) with tier leaderboard-ready scoring (local pre-MMO), rift-exclusive rewards (gem upgrades, cosmetics).
- [ ] **Pinnacle bosses ×4:** hand-crafted apex fights (uber versions of act bosses + one exclusive: **The Cartographer**) gated behind endgame questlines; mechanics-dense, one-shot-telegraph design; exclusive Uniques.
- [ ] **Ascension (meta progression):** account-wide progression fed by all endgame play — Ascension levels grant a constellation board (Paragon-like: stat nodes, glyphs, rare keystones), plus account unlocks: extra stash tabs, alt-XP boosts, starting bonuses, cosmetic auras. Persists across characters; designed to be server-migratable in Phase 7.
- [ ] Difficulty tiers: **Torment I–IV** world tiers post-campaign (density/HP/damage up, exclusive drops: higher bases, set items, Torment-only affix tier).
- [ ] Endgame crafting depth: affix-targeted crafting (fossil/essence-style currency drops from specific content), meta-craft recipes unlocked via pinnacle content, gem corruption (risk/reward).
- [ ] Endgame economy sinks & sources tuned via sim-bench economy scenarios.
- [ ] 25 more Uniques (70 total, incl. pinnacle chase items), 3 more sets, endgame-only base types.
- [ ] Seasons framework (dormant until MMO): season definition data, character season-tagging, reset logic — built now, activated in Phase 8.
- [ ] Bestiary +12 endgame-exclusive monsters & rift guardians.
- [ ] Tests: Pathstone generation determinism, Atlas state machine, Ascension math, Torment scaling curves, economy sim regression.
- [ ] **Deployed to Vercel.**

**Phase exit bar:** a min-maxer has 200+ hours of goals; session loop "pick target → run Pathstones → craft → push" is self-reinforcing.

---

## Phase 6 — The 1.0 Polish: Feel, Performance, Accessibility  `0.6.0`

**Goal:** Turn a complete game into an *outstanding* one. This is a full production polish pass — the difference between "impressive for a browser" and "just impressive."

**Playable result:** The finished offline game. This build is content-complete and release-quality; Phases 7–8 only add the online layer on top.

### Deliverables
- [ ] **Combat feel pass 2.0** across all 5 classes × all skills: animation timing, cancel windows, VFX layering, camera hits, SFX weight — every skill audited against the feel checklist.
- [ ] **Performance hardening:** profiling sweep (worst-case: T16 juiced Pathstone, 100+ enemies), draw-call/GC-pressure elimination, worker-offloaded pathing if needed, LOD audit, quality presets (Low→Ultra) with auto-detect, 120 Hz support.
- [ ] **Full gamepad support:** twin-stick control scheme, radial menus, UI navigation, glyph swapping, rumble.
- [ ] **Accessibility:** remappable everything, colorblind-safe palettes + damage-type icons, screen-shake/flash reduction, text scaling, subtitle/lore-text options, hold-to-toggle alternatives, target-lock assist.
- [ ] **Onboarding 2.0:** contextual tutorial (never modal-walls), advanced-stat tooltips everywhere, in-game Pathwalker's Codex (bestiary, mechanics compendium, build glossary), death recap ("what killed you").
- [ ] UI/UX polish: full visual consistency pass, transitions/micro-interactions, loot filter v2 (rule-based), advanced search in stash, build loadouts (save/swap gear+web setups), practice dummy room.
- [ ] Audio mastering: loudness normalization, mix bus polish, dynamic-range option, music crossfade audit.
- [ ] Save robustness: corruption recovery, rolling backups, cloud-export file format (future-proofed for MMO account import), save-slot management UI.
- [ ] Meta features: achievements (local), statistics page, playtime/kill trackers, screenshot mode (hide HUD, free camera).
- [ ] Content lockdown balance pass: full-game curve sweep, outlier-build nerfs/buffs with reasoning, boss timer audits per tier.
- [ ] QA sweep: fixture saves for every act/tier, e2e suite expansion, soak test (2 h scripted play without leak/desync), cross-browser pass (Chromium/Firefox/Safari).
- [ ] **Deployed to Vercel as the definitive offline release.**

**Phase exit bar:** zero known jank; a streamer could play this for 3 hours and call it a real ARPG, unprompted.

---

## Phase 7 — MMO Foundation: Accounts, Server Authority & Shared Towns  `0.7.0`

**Goal:** Pathlands goes online. Authoritative server, accounts, cloud characters, shared social hubs, parties, and co-op instanced combat — the Lost Ark model: towns are shared, combat zones are private/party instances.

> Architecture per `docs/NETWORKING.md`. The client keeps working offline; online is a mode. The Vercel deployment remains the client; the game server runs on a WebSocket-capable host (Fly.io/Railway/Hetzner) with Postgres + Redis.

### Deliverables
- [ ] **Server runtime:** headless simulation reusing the deterministic `sim/` core (this is why §1.6 of CLAUDE.md exists), Node + uWebSockets.js, room/instance model, tick 30 Hz, interest management, lag compensation for skill targeting, anti-cheat authority (server rolls all loot/damage/movement validation).
- [ ] **Accounts & persistence:** email/magic-link auth, character vault in Postgres, session tokens, save migration tool (local save → account import, one-time), Redis for presence/session cache.
- [ ] **Protocol:** binary snapshot/delta protocol over WebSocket, client prediction + reconciliation for movement and skill starts, entity interpolation, join-in-progress.
- [ ] **Shared towns:** Last Lantern + act towns become multiplayer hubs (up to ~50 visible players, name plates, cosmetics visible, emotes, /dance), channel sharding.
- [ ] **Party play:** party of 4, party finder UI, shared instanced overworld/dungeons/Pathstones, difficulty/HP scaling per party size, smart loot (personal drops), party XP rules, revive mechanics.
- [ ] **Social:** friends list, whisper/party/town chat (with rate-limit + mute/block/report), online status.
- [ ] **Trade v1:** direct player-to-player trade window with scam-safe confirm flow; bind rules (pinnacle uniques bind-on-account).
- [ ] Server operations: Docker deploy, health checks, metrics (tick time, room count, player count), structured logs, graceful shutdown/instance handoff, rate limiting, migration runbook in `docs/NETWORKING.md`.
- [ ] Load/soak: 200-bot load test per shard, chaos test (packet loss/latency profiles), reconnection UX (5-min grace).
- [ ] Tests: protocol fuzzing, server-authoritative damage parity vs. offline sim, trade atomicity, auth flows e2e.
- [ ] **Client deployed to Vercel; server deployed and public; online + offline modes both playable.**

**Phase exit bar:** four friends can meet in town, party up, clear a Pathstone together at < 80 ms perceived latency, and trade the drops.

---

## Phase 8 — MMO Live World: Guilds, Economy, Leaderboards & Seasons  `0.8.0 → 1.0.0`

**Goal:** The living game. Persistent social structures, server-wide events, competitive ladders, a real economy, and the season engine that keeps Pathlands alive. Ends with the **1.0 launch**.

### Deliverables
- [ ] **Guilds:** creation, ranks/permissions, guild chat, guild stash, guild hall instance, weekly guild challenges with rewards.
- [ ] **World bosses & world events:** scheduled server-wide bosses in open shard zones (e.g. **Maw of the Rivenwaste**, 12-player scaling), event calendar, zone invasions with server-wide progress bars.
- [ ] **Open shard zones:** select overworld zones become multiplayer shards (Diablo-IV-style: other Pathwalkers visible while exploring), with dynamic events and shared event loot.
- [ ] **Leaderboards:** Rift Hunt tier ladders (class/party/hardcore brackets), season ladders, pinnacle-boss speed ladders, anti-cheat validation via server replays.
- [ ] **Economy v2:** auction house (search/bid/buyout, tax as gold sink), currency-item exchange, economy telemetry dashboards, dupe-proof item identity (server-issued item IDs + audit log).
- [ ] **Seasons live:** activate the Phase 5 framework — 3-month seasons with a seasonal mechanic slot (Season 1: **The Echoing**, echo-empowered monsters dropping build-remixing Echo Runes), season journey (chapters/objectives/rewards), season-end migration to Eternal.
- [ ] **Hardcore mode** (online, with death broadcast and ladder).
- [ ] Live-ops tooling: server-side hotfix config (drop rates/spawns/event toggles without deploy), feature flags, kill-switches, incident runbook, backup/restore drills.
- [ ] Moderation: report pipeline, chat filters, shadow-mute, ban tooling, GDPR-grade account deletion/export.
- [ ] Scale hardening: multi-shard orchestration, autoscaling instances, 1000-bot cluster load test, cost telemetry.
- [ ] **Launch checklist → `1.0.0`:** full-game regression, economy reset to launch state, Season 1 scheduled, status page, launch notes in CHANGELOG.
- [ ] **Client on Vercel, server cluster live — Pathlands 1.0.**

**Phase exit bar:** the game runs for 2 weeks unattended — events fire, ladders rank, economy holds, nothing falls over.

---

## Post-1.0 (backlog, unscheduled)

Sixth class (**Riftbound** — chaos shapeshifter) · new act-sized region per major season · PvP arenas + duels · housing (Pathwalker sanctums) · mobile touch controls · WebGPU renderer upgrade · mod/plugin API for community loot filters.

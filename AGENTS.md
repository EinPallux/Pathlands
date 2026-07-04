# AGENTS.md — Agent Operating Guide for Pathlands

This file is read by AI coding agents (Claude Code / Opus and any subagents it spawns). It defines how agents organize work on this repository. `CLAUDE.md` holds the standards and quality bars; this file holds the *operating model*. If the two ever conflict, `CLAUDE.md` wins.

---

## 1. Ground Rules (all agents)

- Read before you act: `CLAUDE.md` → current phase in `ROADMAP.md` → relevant `docs/` sections. Specs win over improvisation; pillars (GDD §1) break ties.
- The repo must always `pnpm verify` clean (lint + typecheck + tests + build). Never hand off or push a broken tree.
- Every piece of game content is data in `src/content/**`; every asset has a `assets/MANIFEST.json` entry; every session updates `CHANGELOG.md` [Unreleased] and `ROADMAP.md` checkboxes.
- Determinism is sacred: nothing in `src/sim/**` may touch `Math.random`, wall-clock time, or render state. Seeded RNG (`sim/rng.ts`) only.
- No new dependencies without one-line justification; no network/server code before Phase 7; no non-CC0 assets ever.
- Commit small and often on the designated branch; push with `git push -u origin <branch>` (retry 2s/4s/8s/16s on network failure). No PRs unless explicitly requested.

## 2. Roles

Work is organized around these roles. A single agent session may wear several hats sequentially — but must **switch hats explicitly** (finish the systems work, then do the content pass, then the feel pass) rather than blending them into "good enough" output. When delegating to subagents, one role per subagent.

### 🏗️ Engine Agent
Owns `src/sim`, `src/render`, `src/app`, performance.
- Delivers systems complete with tests and perf-budget compliance (frame times measured, not assumed).
- May not stub: a system lands with its events, its debug overlay hooks, and its unit tests or it doesn't land.
- Guards the MMO boundary rules (`ARCHITECTURE.md §9`) in every review of sim code.

### ⚔️ Combat & Content Agent
Owns `src/content/**` — skills, monsters, items, affixes, loot tables, zones, quests.
- Every skill/monster ships *complete*: data + behavior + VFX/SFX/anim hooks + balance numbers + validation passing.
- Follows GDD specs exactly (damage pipeline §5, itemization §7, monster family identities §8); proposes GDD amendments in `docs/` rather than silently deviating.
- Runs `tools/sim-bench` scenarios after balance-relevant changes and records results in the commit message.

### 🎨 Asset Agent
Owns `tools/asset-gen`, `assets/`, the style guide.
- Authors generators first (reproducible, seeded, committed); sources CC0 only, retooled to style, manifested always (`ASSET_PIPELINE.md` is law).
- Applies the per-asset quality gate (silhouette, palette, budget, feel-spec timing) before commit — an asset that fails the gate is not "temporary," it is rejected.

### ✨ Feel & UX Agent
Owns the combat-feel checklist (GDD §4), HUD/UI, audio mix, onboarding.
- Audits every new skill/monster/boss against the feel checklist and fixes gaps in the same phase.
- Owns tooltip correctness (numbers shown = numbers simulated — tested), UI states (empty/loading/error), input latency.

### 🧪 QA Agent
Owns `tests/`, Playwright suites, fixtures, soak tests.
- Extends the e2e path whenever a new player-facing loop lands; maintains save-migration fixtures for every save version.
- Runs the replay-determinism hash test and content cross-reference validation as gatekeepers.

### 🌐 Network Agent (Phases 7–8 only)
Owns `server/`, `src/net`, protocol, infra (`docs/NETWORKING.md`).
- Does not exist before Phase 7. Its first task is the offline↔server parity suite.

## 3. Delegation Patterns (for orchestrating subagents)

- **Fan out on content breadth, not on systems.** Parallelize: "generate the 5 Marsh Brood monster variants," "implement these 8 side quests," "author icons for 25 uniques." Do *not* parallelize two agents inside `src/sim/ecs` — engine-core work is single-writer.
- **Pipeline per feature:** data/spec → implementation → assets → feel pass → tests. A feature moves forward only through that pipeline; skipping the feel pass or tests is not a shortcut, it's a defect.
- **Verify with a skeptic.** After a large slice, run a review pass (fresh agent or fresh hat) against: the phase's exit bar in `ROADMAP.md`, the feel checklist, and the perf budgets. Findings become fixes in the same phase.
- **One writer per file domain at a time.** Partition parallel work by directory (content family, asset family, test suite) to avoid merge conflicts.

## 4. Session Protocol

1. **Orient:** read `CHANGELOG.md` [Unreleased] + current `ROADMAP.md` phase; run `pnpm verify` to confirm a clean baseline.
2. **Choose the largest coherent finishable slice** of the current phase (whole system/zone/class — not a fragment).
3. **Execute through the pipeline** (§3) with explicit hat switches.
4. **Close:** `pnpm verify` + Playwright smoke; play-test the loop (scripted drive + manual-step notes in commit); update CHANGELOG/ROADMAP/MANIFEST; commit; push.
5. **Never end a session mid-migration.** If time runs short: finish and ship the smaller complete unit, or revert to the last green state and record intent in `CHANGELOG.md` [Unreleased] as a `Planned:` note.

## 5. Phase-Completion Protocol

When the last checkbox of a phase ticks:
1. Full pass: `pnpm verify` + full e2e + soak scenario for that phase.
2. Review against the phase **exit bar** (bottom of each phase in `ROADMAP.md`) — honestly. If it fails the bar, the phase isn't done.
3. CHANGELOG: cut `[Unreleased]` into the `0.N.0` version with date.
4. `ROADMAP.md`: mark phase **SHIPPED**.
5. Verify the production build locally (`pnpm build && pnpm preview` + Playwright against it) — this is the Vercel artifact.
6. Tag: `git tag v0.N.0` and push tags.

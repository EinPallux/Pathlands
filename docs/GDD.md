# Pathlands — Game Design Document

This is the authoritative design spec. When implementing, this document wins over improvisation; when this document is silent, follow the pillars (§1) and the genre references (Diablo IV for feel and readability, Path of Exile 2 for depth and deliberateness, Lost Ark for spectacle and MMO structure).

---

## 1. Vision & Pillars

**One-liner:** A browser-native 3D ARPG where a Pathwalker fights through the reality-scarred Pathlands to reseal the source of the world's Sundering — then keeps hunting power forever in its endgame.

**Pillars** (tie-breakers for every design decision, in order):
1. **Combat feel above everything.**
2. **Loot is the heartbeat.**
3. **Builds, not classes.**
4. **The world is the endgame.**
5. **Browser-native, zero excuses.**

**Tone:** dark fantasy with awe, not grimdark misery — broken-beautiful. Think dying light through ash, luminous scars in the sky, warmth of the last campfires against the dark.

**Session promises:**
- 5 minutes: kill something satisfying, see a drop worth reading.
- 30 minutes: clear a zone/Pathstone arc, hit a build or loot beat.
- 3 hours: finish an act chapter or push several endgame tiers.

## 2. Camera, Controls & Perspective

- **Camera:** perspective (not orthographic) pitched at ~52–56°, yaw fixed (slight cinematic yaw drift allowed in towns), distance ~14–18 m with contextual zoom (bosses pull back, interiors pull in). Subtle follow-lag and combat shake. The *isometric ARPG reading* with 3D depth — like Diablo IV.
- **Controls (mouse+kb):** click-to-move **and** WASD both fully supported (player choice, WASD default like Lost Ark). LMB = move/basic, RMB + Q/W/E/R (+1/2 potions/utility) = skills, mouse-aim for targeted/skillshot abilities, Space = dodge roll, Shift = stand-still cast, Alt = show loot labels, Tab = map overlay.
- **Gamepad (Phase 6):** twin-stick — left stick move, right stick aim, face+trigger skills, radial menus for inventory interactions.
- **Targeting model:** skillshot-first (PoE2/Lost Ark style) — most skills are aimed shapes (line, cone, arc, ground-target) with generous but honest hitboxes; a soft target-magnetism assist for melee.

## 3. The Classes

Five classes. Each is a complete fantasy with unique resource, mechanic, skill kit (12–16 actives by endgame), and skill web. Design rule: **every class needs one "signature verb"** no other class has.

### 3.1 Sentinel — the Bulwark of the Broken Gate
- **Fantasy:** last soldier of a dead order; a wall that hits back. Melee, shield or two-hander.
- **Resource:** **Wrath** — builds from dealing/taking hits, decays out of combat; spenders are the big payoffs.
- **Signature verb:** **Bracing** — hold to plant, gaining damage absorption and empowering the next spender based on damage absorbed.
- **Sample kit:** Cleave, Shield Slam (stun), Whirl Charge (gap-close spin), Warcry (pack buff/taunt), Sunder (armor-shred earthquake line), Bulwark (brace stance), Avatar of the Gate (ultimate: stone colossus form).
- **Build axes:** shield-tank thorns · two-hand berserk crit · warcry support-juggernaut · bleed executioner.

### 3.2 Stormcaller — the Sky Torn Open
- **Fantasy:** weather made angry; lightning and frost in alternating rhythm. Ranged caster.
- **Resource:** **Mana** + **Charge states**: casting lightning builds *Static* (next frost is empowered), frost builds *Chill Momentum* (next lightning chains further) — a two-element weave.
- **Signature verb:** **Channeling storms** — sustained beams/vortices that grow while held.
- **Sample kit:** Arc Bolt, Chain Nova, Frost Lance, Glacier Bloom (ground shatter), Tempest Channel, Ball Lightning, Stormsinger's Eye (ultimate: controllable storm zone).
- **Build axes:** chain-lightning clear · frost control/shatter crit · storm-channel stationary artillery · hybrid weave (rewarded by keystones).

### 3.3 Shadowblade — the Knife in the Rift
- **Fantasy:** an assassin who slips through the cracks the Sundering left in space. Melee/short-range, highest mobility.
- **Resource:** **Combo points** (builders → finishers) + **Shadow meter** for mobility skills.
- **Signature verb:** **Riftstep** — short-range teleports woven into combos; positional bonuses (backstab).
- **Sample kit:** Twin Fangs (builder), Fan of Knives, Riftstep, Eviscerate (finisher), Envenom (poison stack finisher), Smoke Veil (stealth/aggro drop), Thousand Cuts (ultimate: multi-riftstep execution sequence).
- **Build axes:** poison stacker · crit burst backstab · knife-thrower hybrid range · bleed flurry.

### 3.4 Warden — the Voice of the Wild Paths
- **Fantasy:** ranger bonded to the living remnants of the Paths; bow in hand, spirits at heel. Ranged + summons.
- **Resource:** **Essence** (regenerating) + summon slots.
- **Signature verb:** **Bonding** — summons gain modes based on which of the Warden's skills they're "bonded" to (your build reprograms your pets).
- **Sample kit:** Splitting Shot, Rain of Thorns, Snare Vines, summon Thornbeast (bruiser) / Gale Hawks (harass) / Root Colossus (tank), Wild Chorus (pack buff), Heartseeker (ultimate: massive pierce shot).
- **Build axes:** full beastmaster · pure sniper (summonless keystone) · poison archer · vine-control zoner.

### 3.5 Ashkeeper — the Warmth Against the Dark
- **Fantasy:** priest of the last fires; burns the enemy and kindles allies. Mid-range DoT/support hybrid — the class that makes group play sing (MMO-ready).
- **Resource:** **Cinders** (generated by burning enemies, spent on big flames or blessings).
- **Signature verb:** **Kindling** — placing persistent flame zones that both damage enemies and buff allies standing in them.
- **Sample kit:** Emberlash, Ignite Wave, Kindle Beacon (zone), Pyre Chains (pull/bind), Sacrificial Flame (health-cost nuke), Blessing of Ash (team mitigation), Choir of Embers (ultimate: spreading fire-storm hymn).
- **Build axes:** pure ignite DoT · beacon zoner · sacrifice glass-cannon · support/aura keeper (endgame party build).

## 4. Combat Feel — the Checklist

Everything here is a **hard requirement**, tested per skill during feel passes:

- Input → visible reaction ≤ 50 ms; movement cancels windup tails; attack-cancel windows on all basic chains.
- Anticipation → contact → follow-through animation arcs; contact frame synced to hit event exactly.
- On every hit: impact VFX matched to damage type, hit SFX (layered: whoosh + impact + material), enemy hit-flash + micro-knockback, damage number (crits: bigger, punchier, different color/motion).
- On kill: 30–60 ms hit-stop (melee), death burst matched to killing damage type, corpses dissolve/ragdoll-lite, occasional overkill gib on massive-damage kills.
- Enemy telegraphs: all heavy/lethal attacks have readable wind-ups and ground-shape decals (Lost Ark clarity standard); nothing one-shots without a ≥ 0.6 s tell.
- Camera: 2–6 px shakes on heavy impacts (never nausea-scale), micro punch-in on ultimates, boss intro pull-back.
- Crowd feedback: pack density, flow-field shoving, monsters flinch-stagger under sustained fire; stagger bar on elites/bosses (Lost Ark style) rewarding burst windows.
- Player death: slow-mo 0.5 s, desaturate, clear killer attribution ("Slain by Vhulric the Volatile — Fire").

## 5. Stats & the Damage Pipeline

**Core attributes** (per class weighting): Might, Precision, Will, Vitality. Attributes come from levels, web nodes, and gear.

**Derived pools/stats:** Life, class resource, Armor (phys mitigation, diminishing), Resistances (fire/cold/lightning/shadow, capped 75% pre-endgame-raises), Evasion (glance chance), Block (shield), Crit chance/damage, Attack/Cast speed, Cooldown reduction, Movement speed, Area, Projectile count/speed, DoT magnitude/duration, Life-on-hit/leech, Thorns.

**Damage pipeline (deterministic order, unit-tested):**
```
base skill damage × weapon/gear flat adds
→ ×(1 + Σ increased%) × Π(1 + more%)        [PoE model: additive buckets, multiplicative "more"]
→ crit roll (chance, ×critMult)
→ target mitigation: armor OR resist by damage type
→ block/evasion checks
→ final → hit events (leech, on-hit procs, stagger contribution)
```
Damage types: Physical, Fire, Cold, Lightning, Shadow. Ailments: Bleed (phys DoT), Ignite (fire DoT), Chill/Freeze (slow/stop), Shock (damage-taken amp), Corruption (shadow DoT + healing cut). Ailment threshold scales with hit size vs. target max life.

## 6. Skills, the Web & Support Runes

- **Actives:** unlocked by level + class quests; 12–16 per class by 60. Each has data-defined: shape, base damage, resource cost/gain, cooldown, tags (melee/projectile/area/channel/summon/element…), and feel spec (anim, VFX, SFX ids).
- **Skill Web:** per-class passive network (~100 nodes by Phase 4): minor nodes (stats), **notables** (mechanic twists: "Warcries echo once"), **keystones** (build-defining trade-offs: "Summonless: +80% more bow damage, cannot summon"). Respec per-node for gold.
- **Support Runes** (the build-depth engine): sockets on each active (1→3 unlocked by level). Runes are drops/craftables that mutate tagged skills: *Chaining, Multistrike, Echo, Concentrated (smaller+more), Scattering (bigger+less), Elemental conversions, Lifetap (cost life not resource), Windfury (attack-speed more), Seismic (adds stagger)…* ~35 runes at launch, tier-upgradable. Rune × skill tag matrix is validated in tests so illegal combos can't equip.
- **Ultimates:** one slotted ultimate per build, long cooldown, spectacle-grade VFX budget.

## 7. Itemization

**Slots:** weapon (+offhand/shield), helm, chest, gloves, boots, belt, 2 rings, amulet. Class-flavored weapon bases (Sentinel greatswords, Stormcaller foci…).

**Rarities:**
- **Common** (white) — base only; salvage fodder, crafting canvases.
- **Magic** (blue) — 1–2 affixes, higher tier ranges than rare per-affix (PoE2 trick: blues can be spiky-good early).
- **Rare** (yellow) — up to 3 prefixes + 3 suffixes; the affix chase.
- **Unique** (orange) — fixed identity items with build-warping rules text ("Warcry costs no Wrath but taunts you too"). 70 by Phase 5. Never just stat sticks.
- **Set** (green, Phase 4+) — small sets (2–4 pieces) with tiered bonuses, endgame Torment drops.

**Affix system:** prefix/suffix pools per slot with tiers T1(best)–T7, item-level gated, weighted; hybrid affixes at low weight. Smart-loot bias: ~35% of drops weight toward the class's tags. Affix pool ~120 (Phase 2) → ~200 (Phase 5).

**Sockets & Gems:** gear sockets hold **Path Gems** (stat/proc gems, quality-upgradable via Rift Hunts, corruptible at endgame for risk/reward).

**Drop philosophy:** fewer, better drops than D3 — rate tuned so a rare is worth reading. Rarity beams + sound stingers scale with drop quality (the unique *thunk* must trigger dopamine from across the room). Loot is instanced-personal always (MMO-safe rule from day one).

**Crafting arc:** salvage → materials; vendor gamble (Phase 2) → affix reroll/add → fossil/essence-targeted crafting (Phase 5) → meta-crafts from pinnacle content. Crafting is a sink for both materials and gold; every crafting action has a clear UI preview of possible outcomes.

## 8. Monsters

**9 families**, each with a mechanical identity, shared silhouette language, and biome home:
1. **Riven** — reality-torn beasts; warp-lunge, phase-dodge, split on death (act I+).
2. **Hollowed** — soulless soldiery; shield walls, formations, banner-buffers.
3. **Ashborn Cult** — human zealots; ritual casters empower packs, suicide igniters.
4. **Marsh Broods** — swarms, spitters, egg-clusters, poison pools.
5. **Undervault Constructs** — dwarven machines; slow, armored, lethal telegraphs, weak-point stagger.
6. **The Chorus** — floating psychic horrors; projectiles that curve, silence zones.
7. **Beasts of the Waste** — pack predators; flanking AI, pounce chains.
8. **The Unpathed** — endgame chaos entities; mechanics that remix other families' attacks.
9. **Rift Guardians** — endgame-exclusive bosses of Rift Hunts.

**Ranks:** Normal → **Elite** (affixed: Fierce, Volatile, Frozen Aura, Shielding, Vampiric, Storming, Riftborn, Summoner… 12+ by Phase 4, combos at higher Torments) → **Rare** (named, 2–3 affixes, guaranteed rare+ drop) → **Bosses** (hand-authored multi-phase).

**Boss design rules:** phases change the *verbs*, not just numbers; every mechanic teachable by death recap; stagger bar creates burst windows; arenas participate (collapsing floor, torch-lighting mechanics); loot celebration on kill.

## 9. Difficulty & Progression Curve

- **Campaign:** Normal / Veteran (chosen at creation, switchable in town). Level curve 1→~52 through the campaign, 60 shortly into endgame. Area-level floors keep zones threatening but over-leveling possible for casuals.
- **Endgame:** **Torment I–IV** world tiers gate density, monster power, and exclusive rewards; Pathstone tiers 1–16 and Rift Hunt tiers ∞ provide fine-grained challenge dial-up.
- **Death:** campaign = respawn at checkpoint + durability cost. Endgame = Pathstone attempt-limits on higher tiers. Hardcore (Phase 8) = permadeath ladder.

## 10. World & Story

**Setting:** Vhal, a world once woven by the **Ley Paths**. The **Sundering** shattered them; where paths broke, the **Pathlands** formed — border-scars where reality frays. Civilization huddles around surviving **Waypoints** (path-anchors), which double diegetically as the fast-travel network.

**You:** a **Pathwalker** — path-touched at birth, able to walk broken paths that unmake others. Feared, needed, and quietly changing with every mile of broken road you survive (this corruption is a story throughline and the diegetic frame for Ascension meta progression: you keep what the Paths write into you, across every body you walk in — i.e., across characters).

**Act I — The Broken Gate.** Emberfall burns as Riven pour through a failed Waypoint. You stabilize the region, uncover that the Waypoint didn't fail — it was *unlocked* — and defeat its corrupted guardian, **the Warden of the Broken Gate**, learning the Ashborn Cult holds the keys. *(Tone: survival, first hope.)*

**Act II — The Hollow Crown.** In the highland kingdom of Vhelmark, the court has struck a bargain to keep their Waypoint lit: the Cult feeds it souls, producing the Hollowed. Political rot, an ally's betrayal, descent through the dwarven Undervault to cut the soul-siphon, and the **Hollow King** — the good king who volunteered first. *(Tone: cost of survival, complicity.)*

**Act III — The Source.** Across the Rivenwaste — terrain of floating path-fragments and chaos storms — to the Source of the Sundering. Revelation: the Paths weren't broken by attack; the First Pathwalker **Nhyx** *unpathed* herself to escape the world's weave and has been unraveling it since, offering you the same freedom. Refuse, fight her across the raw un-woven void, and re-anchor the Source with yourself as the living keystone — which is why you can never stop walking. *(Tone: awe, sacrifice, an ending that opens the endgame diegetically: the Atlas of Broken Paths is you, holding the world together by walking it.)*

**Delivery:** in-engine cinematic-lite beats, strong NPC recurring cast (Sera the lantern-keeper, Brann the deserter-quartermaster, the Cartographer — a mystery figure who becomes a pinnacle boss), lore echo-stones, and environmental storytelling first.

## 11. Endgame (detail in ROADMAP Phase 5)

- **Atlas of Broken Paths:** meta-map of Pathstone routes; completing stones lights paths, granting Atlas passives and target-farm specialization (choose which content type drops more of what).
- **Pathstones:** remixable zone instances with player-applied risk affixes; T1–16; sustain loop via drops + crafting.
- **Rift Hunts:** timed escalation runs; score → gem upgrades, cosmetics; ladder-ready.
- **Pinnacle bosses:** 4 apex fights with exclusive chase uniques; the skill-check summit.
- **Ascension:** account-wide constellation board (stats/glyphs/keystones) + account unlocks (stash, alt boosts, cosmetics). Earned by all endgame play; the "always progressing" safety net under RNG.

## 12. Towns, NPCs & Services

Towns are the breath between fights: warm light, music shift, no HUD combat elements. Services: blacksmith (craft/salvage/repair), vendor (buy/gamble), stash, waypoint, quest NPCs, class trainers (respec), and in endgame: the Atlas table and Rift obelisk. Towns become shared MMO hubs in Phase 7 — design their layouts with plaza space and sightlines for that from the start.

## 13. UI/UX Principles

Diegetic where possible (waypoints, atlas table), minimal HUD (orbs, skill bar, XP sliver, buff row), everything tooltipped with progressive disclosure (hold Alt for the math), item compare with delta arrows, controller-parity for every screen by Phase 6, colorblind-safe damage-type iconography, zero modal tutorials. Font: readable at 100% on 1080p; UI scale option.

## 14. Audio & Music

- Music: per-biome explore themes with **vertical combat layers** (intensity mixes in as threat rises), boss themes with phase stingers, town safety theme. Composed/arranged programmatically (see ASSET_PIPELINE §5) or CC0-sourced and edited.
- SFX: layered impacts by material/damage type; the loot-drop stinger hierarchy is sacred (unique drop sound must be Pavlovian).
- Ambience: zone beds (wind, embers, marsh), positional emitters (fires, waterfalls, machinery).
- Mix: ducking (dialogue > music), loudness normalized, dynamic-range option.

## 15. Meta Progression Summary (the "keep playing" stack)

Per character: level 60 → gear → skill web → gems → Atlas. Per account: **Ascension board**, stash tabs, achievements, collections (bestiary completion, lore, cosmetics), alt-boosts. Per season (Phase 8): seasonal mechanic, journey chapters, ladder placement, cosmetic permanence. Nothing pay-anything: Pathlands has no monetization; all cosmetics are earned.

## 16. Out of Scope (do not build)

PvP before post-1.0 · player housing before post-1.0 · monetization ever (no shop, no battle pass) · voice chat · mobile-touch UI before post-1.0 · user-generated content tools.

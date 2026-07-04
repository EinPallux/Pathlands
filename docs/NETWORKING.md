# Pathlands — MMO Networking & Server Architecture (Phases 7–8)

The online layer is built **last**, on top of a finished offline game, per `ROADMAP.md`. It works because the client was built against the MMO boundary rules in `docs/ARCHITECTURE.md §9` from day one: deterministic sim, command-in/event-out, no client authority in content.

**Model:** Lost Ark-style hybrid — **shared social hubs + party-instanced combat**, expanding to open shard zones and world bosses in Phase 8. Not a single seamless world; instances are the scaling unit.

---

## 1. Topology

```
Browser client (Vercel static)
   │  HTTPS                    │  WSS
   ▼                           ▼
API service (Node/Fastify)   Gateway (uWebSockets.js)
   │  auth, characters,         │  session routing
   │  trade ledger, ladders     ▼
   ▼                         Instance servers (Node, N per host)
Postgres ◄────────────────────┤   rooms: towns / party zones / rifts
Redis (presence, queues, cache)┘
```

- **Instance server:** runs the same `sim/` package as the client, headless, 30 Hz, multiple rooms per process. Towns are big rooms (~50 players); combat zones are small rooms (1–4 players); world bosses (Phase 8) 12-player rooms.
- **Authority:** server-authoritative for everything gameplay: movement validation, skill execution, damage, loot rolls, trade, currency. The client is a renderer + predictor.
- **Hosting:** client stays on Vercel. Server on a WebSocket-friendly host (Fly.io / Railway / Hetzner + Docker). Postgres (managed), Redis (managed). Region: single region at launch (EU-central), architecture shard-ready for more.

## 2. Protocol

- **Transport:** WebSocket (WSS), binary frames (custom flat encoding or msgpack-lite level; no JSON on the hot path).
- **Client → server:** the existing `Command` stream (`Move`, `CastSkill`, `Interact`, `UseItem`, …) + tick number + input sequence id. This is the same type the offline game already feeds its sim.
- **Server → client:** snapshot/delta at 15–30 Hz: per-entity interest-filtered component deltas (position quantized to cm, rotation to ~1°, health to 0.1%), reliable event channel (damage events, loot drops, chat) multiplexed alongside.
- **Interest management:** grid-cell subscription around each player (~40 m radius) + always-relevant set (party, boss, own projectiles). Town rooms use tiered update rates by distance.
- **Prediction & reconciliation:** client runs its own sim tick for the local player (movement + skill starts) using the deterministic core; on server snapshot, rewind-replay unacknowledged commands; visual smoothing caps correction snaps at 0.25 m/frame. Remote entities render interpolated ~100 ms behind.
- **Lag compensation:** server keeps 250 ms of position history; skill hit checks rewind targets to the caster's perceived time (bounded).
- **Join/handoff:** join-in-progress via baseline snapshot; town↔instance transfer through gateway re-route with a transfer token (no reconnect visible to the player); 5-minute disconnect grace holds the character in-instance (combat-safe logout timer).

## 3. Persistence & Data

- **Postgres:** accounts, characters (versioned JSONB save payloads — same schema as the offline export format), item instances (server-issued ids + roll provenance for dupe forensics), trade ledger (append-only), guilds, ladders, season state.
- **Redis:** presence, session tokens, matchmaking/party state, chat fan-out, rate limiting, world-event progress.
- **Migration from offline:** one-time **account import** — the Phase 6 export file uploads at first login; server re-validates item provenance (re-rolls anything unverifiable, tells the player), then flags the account online-only. Offline mode stays available but as separate characters thereafter.
- Writes: character checkpoint on zone transition/town/logout + 60 s dirty-flush; items/trades/gold are transactional, never in the blob (economy integrity).

## 4. Accounts & Security

- Auth: email magic-link (no passwords to breach) → short-lived JWT + refresh; tokens bound to a device id.
- All gameplay messages validated: rate limits per command type, movement speed/teleport sanity vs. server sim, skill legality (cooldown/resource/range checked server-side — trivially, since the server *runs* the sim).
- Anti-dupe: item ids are server-minted; trade + stash + mail (if added) go through the transactional ledger with idempotency keys.
- Chat: rate limits, profanity filter, mute/block lists, report queue with recent-chat context capture; shadow-mute tooling (Phase 8).
- Privacy: GDPR-grade export + delete endpoints from day one of accounts.

## 5. Rooms & Game Modes

| Room type | Players | Sim scope | Notes |
|---|---|---|---|
| Town hub | ≤ 50 | no combat, emotes, vendors | channel-sharded per act town |
| Overworld/dungeon (party) | 1–4 | full sim | HP/density scaling per size |
| Pathstone / Rift | 1–4 | full sim | leaderboard-scored runs server-recorded |
| Open shard zone (P8) | ≤ 20 | full sim | dynamic events, shared event loot |
| World boss (P8) | ≤ 12 | full sim | scheduled, queue via Redis |
| Guild hall (P8) | ≤ 30 | no combat | guild stash access |

Party rules: leader-starts instances, party finder board in towns, personal loot always (per GDD §7), XP shared in range, revive with channel + boss-fight token limits.

## 6. Live Ops (Phase 8)

- **Config service:** server-side tunables (drop rates, event schedule, feature flags, kill-switches) hot-reloadable without deploy; audited changes.
- **Seasons:** season definition activates the Phase 5 framework — server flips season id, fresh ladder partitions, seasonal mechanic content flag; season-end batch migrates characters to Eternal.
- **Observability:** metrics (tick ms p95/p99 per room, players, msg rates, GC), structured logs with player-id correlation, alerting on tick overruns/error spikes; economy telemetry (gold faucets/sinks, item price indices) to a dashboard.
- **Deploys:** blue/green for API/gateway; instance servers drain (stop accepting rooms, finish running ones, then recycle). DB migrations forward-only with rollback scripts.
- **Backups:** Postgres PITR + nightly snapshot restore drill (scripted, verified in staging).

## 7. Testing & Load

- **Parity suite:** the same scripted fight runs offline and on a server room; final state hashes must match (the determinism dividend).
- **Protocol fuzzing:** malformed/replayed/reordered frames must never crash a room or corrupt state.
- **Bots:** headless client driver (reuses `sim` + `net` without render) — 200 bots/shard soak (Phase 7), 1000-bot cluster test with chaos profiles (loss 1–5%, jitter 20–200 ms) (Phase 8).
- **Trade atomicity:** concurrent-trade fuzz test against the ledger; zero item loss/dupe tolerated.

## 8. Client UX Under Network Reality

- Ping indicator + connection-quality states; skill queue tolerant to 150 ms without feel degradation (thanks to prediction).
- Reconnect: automatic with exponential backoff, silent if < 10 s, "Reconnecting…" overlay with combat pause protection (instance holds the character AI-idle + invulnerable-after-5s-idle rule against combat logging abuse).
- Server maintenance banner + graceful countdown; offline mode always one click away from the main menu.

// Core simulation constants. The wall-clock driver that consumes these lives in
// the app layer (src/app/clock.ts) — never in sim/ — so the sim stays free of
// time reads.

/** Fixed simulation rate. Also the Phase 7 server tick rate. */
export const SIM_HZ = 30;
export const SIM_DT = 1 / SIM_HZ; // seconds per tick
export const SIM_DT_MS = 1000 / SIM_HZ;

/** Max ticks to catch up in one frame, guarding against the spiral of death. */
export const MAX_CATCHUP_TICKS = 5;

/** World scale: 1 sim unit = 1 metre. */
export const UNIT = 1;

/** Spatial hash cell size (metres) for broad-phase collision + queries. */
export const SPATIAL_CELL = 2.5;

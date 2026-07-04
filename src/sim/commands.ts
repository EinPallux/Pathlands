import type { Entity } from './ecs/store.ts';

// Player intent, expressed as data. The simulation is driven ONLY by a Command
// stream each tick (ARCHITECTURE.md §9) — in single-player these come from the
// input system; in Phase 7 the identical types travel over the wire. Keeping the
// sim command-driven from day one is what makes the MMO a port, not a rewrite.

export type Command =
  | { kind: 'moveTo'; x: number; y: number } // click-to-move destination
  | { kind: 'moveDir'; dx: number; dy: number } // held WASD direction (need not be unit)
  | { kind: 'stop' }
  | { kind: 'faceTo'; x: number; y: number } // aim cursor without moving
  | { kind: 'castSkill'; slot: number; aimX: number; aimY: number }
  | { kind: 'dodge'; dx: number; dy: number }
  | { kind: 'usePotion'; slot: number }
  | { kind: 'interact'; entity: Entity }
  | { kind: 'pickup'; entity: Entity };

/** A tick's worth of player commands. `seq` supports client prediction later. */
export interface CommandFrame {
  seq: number;
  commands: Command[];
}

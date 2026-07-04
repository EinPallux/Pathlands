import type { World } from './ecs/world.ts';
import type { Entity } from './ecs/store.ts';
import type { EventBus } from './events.ts';
import type { SpatialHash } from './spatial.ts';
import type { Rng } from './rng.ts';
import type { CharacterSheet } from './character.ts';
import type { ItemInstance } from './items/generate.ts';
import type { ZoneDef } from '../content/types.ts';

// The context every system receives. `Simulation` implements this; systems
// depend on the interface (not the class) to keep the module graph acyclic.

export interface Sim {
  world: World;
  events: EventBus;
  spatial: SpatialHash;
  zone: ZoneDef;
  sheet: CharacterSheet;
  player: Entity;

  tick: number;
  readonly dt: number;

  combat: Rng;
  loot: Rng;
  ai: Rng;
  gen: Rng;

  // Mutable run state.
  bossEntity: Entity;
  bossEngaged: boolean;
  bossCleared: boolean;
  playerDead: boolean;
  playerRespawnTick: number;

  /** Item instances currently lying on the ground, keyed by instance id. */
  droppedItems: Map<string, ItemInstance>;

  msToTicks(ms: number): number;
  nextItemId(): string;
  recomputePlayerStats(restore: boolean): void;
  addXp(amount: number): void;
}

import type { Sim } from '../context.ts';
import { GroundItem, Lifetime } from '../components.ts';

// Despawn timed entities (projectiles, area effects, dropped loot). Dropped
// items also clean up their instance registry entry when they expire.

export function lifetimeSystem(sim: Sim): void {
  const world = sim.world;
  for (const [e, lt] of world.view1(Lifetime)) {
    if (sim.tick < lt.untilTick) continue;
    const gi = world.get(e, GroundItem);
    if (gi) sim.droppedItems.delete(gi.itemInstanceId);
    world.destroy(e);
  }
}

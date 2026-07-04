import type { Sim } from '../context.ts';
import { GroundGold, GroundItem, HealthGlobe, Transform } from '../components.ts';
import { heal } from '../combat/damage.ts';
import { Health } from '../components.ts';

// Pickups: gold and health globes vacuum toward the player; items are collected
// by walking over them (proximity), added to the inventory on the sheet.

const VACUUM_RADIUS = 2.8;
const ITEM_PICKUP_RADIUS = 1.4;

export function pickupSystem(sim: Sim): void {
  const world = sim.world;
  if (sim.playerDead) return;
  const ptf = world.get(sim.player, Transform);
  if (!ptf) return;
  const near = (x: number, y: number, r: number): boolean => {
    const dx = x - ptf.x;
    const dy = y - ptf.y;
    return dx * dx + dy * dy <= r * r;
  };

  for (const e of world.entitiesWith(GroundGold)) {
    const tf = world.get(e, Transform);
    const g = world.get(e, GroundGold);
    if (!tf || !g || !near(tf.x, tf.y, VACUUM_RADIUS)) continue;
    sim.sheet.gold += g.amount;
    sim.events.pickup.emit({ kind: 'gold', amount: g.amount, x: tf.x, y: tf.y });
    sim.events.sfx.emit({ cue: 'sfx_gold', x: tf.x, y: tf.y });
    world.destroy(e);
  }

  for (const e of world.entitiesWith(HealthGlobe)) {
    const tf = world.get(e, Transform);
    const globe = world.get(e, HealthGlobe);
    if (!tf || !globe || !near(tf.x, tf.y, VACUUM_RADIUS)) continue;
    const h = world.get(sim.player, Health);
    if (h) {
      const restored = heal(world, sim.player, h.max * globe.healPct, sim.tick);
      sim.events.pickup.emit({ kind: 'globe', amount: restored, x: tf.x, y: tf.y });
    }
    world.destroy(e);
  }

  for (const e of world.entitiesWith(GroundItem)) {
    const tf = world.get(e, Transform);
    const gi = world.get(e, GroundItem);
    if (!tf || !gi || !near(tf.x, tf.y, ITEM_PICKUP_RADIUS)) continue;
    const inst = sim.droppedItems.get(gi.itemInstanceId);
    if (inst) {
      sim.sheet.inventory.push(inst);
      sim.droppedItems.delete(gi.itemInstanceId);
    }
    sim.events.pickup.emit({ kind: 'item', amount: 1, x: tf.x, y: tf.y });
    sim.events.floatText.emit({ x: tf.x, y: tf.y, text: gi.label, kind: 'info' });
    sim.events.sfx.emit({ cue: `sfx_pickup_${gi.rarity}`, x: tf.x, y: tf.y });
    world.destroy(e);
  }
}

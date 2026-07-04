import type { Sim } from '../context.ts';
import { Health, Invulnerable, MoveIntent, Resource, Transform } from '../components.ts';

// World/zone state: boss engagement trigger, area-clear, and player respawn.

export function worldSystem(sim: Sim): void {
  const world = sim.world;

  if (sim.playerDead && sim.tick >= sim.playerRespawnTick) {
    respawnPlayer(sim);
  }

  // Trigger the boss encounter when the player steps into the arena.
  if (!sim.bossEngaged && sim.zone.boss && world.isAlive(sim.bossEntity)) {
    const ptf = world.get(sim.player, Transform);
    if (ptf) {
      const dx = ptf.x - sim.zone.boss.x;
      const dy = ptf.y - sim.zone.boss.y;
      if (dx * dx + dy * dy <= sim.zone.boss.arenaRadius * sim.zone.boss.arenaRadius) {
        sim.bossEngaged = true;
        sim.events.zone.emit({ kind: 'bossSpawn', id: sim.zone.boss.defId });
        sim.events.shake.emit({ trauma: 0.5 });
        sim.events.sfx.emit({ cue: 'sfx_boss_intro' });
      }
    }
  }
}

function respawnPlayer(sim: Sim): void {
  const world = sim.world;
  const tf = world.get(sim.player, Transform);
  const h = world.get(sim.player, Health);
  const r = world.get(sim.player, Resource);
  const intent = world.get(sim.player, MoveIntent);
  const start = sim.zone.playerStart;
  if (tf) {
    tf.x = start.x;
    tf.y = start.y;
    tf.facing = Math.PI / 2;
  }
  if (h) {
    h.current = h.max;
    h.regenAccum = 0;
  }
  if (r) r.current = r.kind === 'wrath' ? 0 : r.max;
  if (intent) intent.mode = 'stop';
  world.add(sim.player, Invulnerable, { untilTick: sim.tick + sim.msToTicks(2000) });
  sim.playerDead = false;
  sim.events.zone.emit({ kind: 'objective', id: 'respawn' });
  sim.events.sfx.emit({ cue: 'sfx_respawn' });
}

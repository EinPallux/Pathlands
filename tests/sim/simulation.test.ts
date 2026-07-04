import { describe, expect, it } from 'vitest';
import { Simulation } from '../../src/sim/simulation.ts';
import { createCharacter } from '../../src/sim/character.ts';
import type { Command } from '../../src/sim/commands.ts';
import { FactionC, Health, Transform } from '../../src/sim/components.ts';

// Headless integration: drive the full simulation with a scripted bot and assert
// the core Phase 1 loop works AND is deterministic (the replay guarantee from
// ARCHITECTURE.md §4). This is the "play-test the loop" proof that runs in CI.

function newSim(seed = 1): Simulation {
  const sheet = createCharacter('sentinel', 'Test Sentinel');
  return new Simulation({ sheet, zoneId: 'emberfall_reach', seed });
}

function nearestEnemy(sim: Simulation): { x: number; y: number; d: number } | null {
  const ptf = sim.world.get(sim.player, Transform);
  if (!ptf) return null;
  let best: { x: number; y: number; d: number } | null = null;
  for (const [e, fac] of sim.world.view1(FactionC)) {
    if (fac.value !== 'enemy') continue;
    const h = sim.world.get(e, Health);
    const tf = sim.world.get(e, Transform);
    if (!h || h.current <= 0 || !tf) continue;
    const d = Math.hypot(tf.x - ptf.x, tf.y - ptf.y);
    if (!best || d < best.d) best = { x: tf.x, y: tf.y, d };
  }
  return best;
}

/** A deterministic bot: walk to the nearest enemy and cleave it. */
function botCommands(sim: Simulation): Command[] {
  const target = nearestEnemy(sim);
  if (!target) return [{ kind: 'stop' }];
  const cmds: Command[] = [{ kind: 'moveTo', x: target.x, y: target.y }];
  if (target.d < 3.0) cmds.push({ kind: 'castSkill', slot: 0, aimX: target.x, aimY: target.y });
  return cmds;
}

function enemyCount(sim: Simulation): number {
  let n = 0;
  for (const [e, fac] of sim.world.view1(FactionC)) {
    if (fac.value !== 'enemy') continue;
    const h = sim.world.get(e, Health);
    if (h && h.current > 0) n++;
  }
  return n;
}

function hashState(sim: Simulation): string {
  const parts: string[] = [];
  for (const [e, h] of sim.world.view1(Health)) {
    const tf = sim.world.get(e, Transform);
    parts.push(`${e}:${Math.round(h.current)}:${tf ? Math.round(tf.x * 50) : 0}:${tf ? Math.round(tf.y * 50) : 0}`);
  }
  parts.sort();
  return `${sim.tick}|${sim.sheet.level}|${sim.sheet.xp}|${sim.sheet.gold}|${parts.join(',')}`;
}

describe('Simulation — the Phase 1 loop', () => {
  it('boots a zone with the player and enemy packs', () => {
    const sim = newSim();
    expect(sim.player).toBeGreaterThan(0);
    expect(enemyCount(sim)).toBeGreaterThan(10);
    expect(sim.playerHealth()!.current).toBeGreaterThan(0);
  });

  it('runs a combat session: kills enemies and grants XP + loot', () => {
    const sim = newSim();
    const startEnemies = enemyCount(sim);
    for (let i = 0; i < 1200; i++) {
      sim.step(botCommands(sim));
    }
    expect(enemyCount(sim)).toBeLessThan(startEnemies); // some died
    // Progression happened: either XP banked or a level gained.
    expect(sim.sheet.xp + (sim.sheet.level - 1) * 1000).toBeGreaterThan(0);
    // Loot happened somewhere: inventory, gold, or still on the ground.
    const lootHappened =
      sim.sheet.inventory.length > 0 || sim.sheet.gold > 0 || sim.droppedItems.size > 0;
    expect(lootHappened).toBe(true);
  });

  it('never throws across a long session', () => {
    const sim = newSim(7);
    expect(() => {
      for (let i = 0; i < 1500; i++) sim.step(botCommands(sim));
    }).not.toThrow();
  });

  it('is deterministic under an identical command script', () => {
    const a = newSim(42);
    const b = newSim(42);
    for (let i = 0; i < 800; i++) {
      // Both bots see identical (deterministic) state, so issue identical commands.
      a.step(botCommands(a));
      b.step(botCommands(b));
    }
    expect(hashState(a)).toBe(hashState(b));
    expect(a.sheet.level).toBe(b.sheet.level);
    expect(a.sheet.gold).toBe(b.sheet.gold);
  });

  it('diverges for different seeds (RNG actually varies)', () => {
    const a = newSim(1);
    const b = newSim(2);
    for (let i = 0; i < 800; i++) {
      a.step(botCommands(a));
      b.step(botCommands(b));
    }
    // Loot/crit variance should make the two runs differ somewhere.
    expect(hashState(a)).not.toBe(hashState(b));
  });

  it('engages the boss when the player reaches the arena', () => {
    const sim = newSim();
    const ptf = sim.world.get(sim.player, Transform)!;
    ptf.x = sim.zone.boss!.x;
    ptf.y = sim.zone.boss!.y;
    expect(sim.bossEngaged).toBe(false);
    sim.step([{ kind: 'stop' }]);
    expect(sim.bossEngaged).toBe(true);
  });

  it('respawns the player after death', () => {
    const sim = newSim();
    const h = sim.playerHealth()!;
    h.current = 1;
    // Force lethal state and step; death system should trigger respawn timer.
    h.current = 0;
    for (let i = 0; i < 120; i++) sim.step([{ kind: 'stop' }]);
    expect(sim.playerDead).toBe(false);
    expect(sim.playerHealth()!.current).toBeGreaterThan(0);
  });
});

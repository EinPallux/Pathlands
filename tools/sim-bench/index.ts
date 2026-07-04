import { Simulation } from '../../src/sim/simulation.ts';
import { createCharacter } from '../../src/sim/character.ts';
import type { Command } from '../../src/sim/commands.ts';
import { FactionC, Health, PlayerControlled, Resource, Transform } from '../../src/sim/components.ts';
import { SIM_HZ } from '../../src/sim/constants.ts';

// Headless balance bench (CLAUDE.md §6): run the scripted-bot clear of Emberfall
// Reach across several seeds and report time-to-clear, deaths, and end level.
// Run: pnpm bench

interface Metrics {
  seed: number;
  cleared: boolean;
  seconds: number;
  deaths: number;
  endLevel: number;
  bossKilled: boolean;
  dmgDealt: number;
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

function botCommands(sim: Simulation): Command[] {
  const cmds: Command[] = [];
  const player = sim.player;
  const h = sim.world.get(player, Health);
  const r = sim.world.get(player, Resource);
  const pc = sim.world.get(player, PlayerControlled);
  if (h && h.current / h.max < 0.4 && pc && pc.potions > 0) cmds.push({ kind: 'usePotion', slot: 0 });

  const target = nearestEnemy(sim);
  if (!target) {
    // Advance toward the boss arena.
    const boss = sim.zone.boss;
    if (boss) cmds.push({ kind: 'moveTo', x: boss.x, y: boss.y });
    return cmds;
  }
  cmds.push({ kind: 'moveTo', x: target.x, y: target.y });
  if (target.d < 3.2) {
    cmds.push({ kind: 'castSkill', slot: 0, aimX: target.x, aimY: target.y });
    if (r && r.current >= 15) cmds.push({ kind: 'castSkill', slot: 1, aimX: target.x, aimY: target.y });
  }
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

function runScenario(seed: number, maxSeconds = 600): Metrics {
  const sheet = createCharacter('sentinel', `Bench${seed}`);
  const sim = new Simulation({ sheet, zoneId: 'emberfall_reach', seed });
  const maxTicks = maxSeconds * SIM_HZ;
  let deaths = 0;
  let wasDead = false;
  let dmgDealt = 0;

  for (let t = 0; t < maxTicks; t++) {
    sim.step(botCommands(sim));
    for (const d of sim.events.damage.all) {
      if (d.source === sim.player) dmgDealt += d.amount;
    }
    if (sim.playerDead && !wasDead) {
      deaths++;
      wasDead = true;
    }
    if (!sim.playerDead) wasDead = false;
    if (sim.bossCleared) {
      return { seed, cleared: true, seconds: t / SIM_HZ, deaths, endLevel: sim.sheet.level, bossKilled: true, dmgDealt };
    }
  }
  return {
    seed,
    cleared: enemyCount(sim) === 0,
    seconds: maxSeconds,
    deaths,
    endLevel: sim.sheet.level,
    bossKilled: sim.bossCleared,
    dmgDealt,
  };
}

function main(): void {
  const seeds = [1, 2, 3, 4, 5];
  console.info('Pathlands sim-bench — Emberfall Reach full-clear (Sentinel bot)\n');
  const results = seeds.map((s) => runScenario(s));
  for (const r of results) {
    console.info(
      `  seed ${r.seed}: ${r.bossKilled ? 'BOSS DOWN' : r.cleared ? 'cleared' : 'timeout'} in ${r.seconds.toFixed(0)}s · deaths ${r.deaths} · lvl ${r.endLevel} · dmg ${Math.round(r.dmgDealt)}`,
    );
  }
  const avg = (f: (m: Metrics) => number): string => (results.reduce((s, m) => s + f(m), 0) / results.length).toFixed(1);
  console.info(
    `\n  avg: ${avg((m) => m.seconds)}s · deaths ${avg((m) => m.deaths)} · end lvl ${avg((m) => m.endLevel)} · boss kills ${results.filter((m) => m.bossKilled).length}/${results.length}`,
  );
}

main();

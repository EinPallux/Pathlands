import type { Sim } from '../context.ts';
import type { Entity } from '../ecs/store.ts';
import {
  Boss,
  Elite,
  Health,
  LootSource,
  Monster,
  PlayerControlled,
  Stats,
  Transform,
  XpReward,
} from '../components.ts';
import { getBoss } from '../../content/index.ts';
import { resolveLoot } from '../loot.ts';
import { spawnAreaEffect, spawnGold, spawnGroundItem, spawnGlobe } from '../prefabs.ts';
import type { AttackPayload } from '../combat/types.ts';
import type { MonsterFamily, MonsterRank } from '../defs.ts';

// Death handling: emit death, grant XP, resolve + scatter loot, trigger elite
// on-death behaviours, advance boss defeat, and start the player respawn timer.
// A kill "feels" via death events (dissolve/gib VFX) and the loot celebration.

export function deathSystem(sim: Sim): void {
  const world = sim.world;
  for (const [e, h] of world.view1(Health)) {
    if (h.current > 0) continue;
    if (world.has(e, PlayerControlled)) {
      handlePlayerDeath(sim, e);
      continue;
    }
    if (world.has(e, Monster) || world.has(e, Boss)) {
      handleMonsterDeath(sim, e, h.lastAttacker, h.lastDamageType);
    }
  }
}

function handleMonsterDeath(
  sim: Sim,
  e: Entity,
  killer: Entity,
  lastDamageType: AttackPayload['damageType'],
): void {
  const world = sim.world;
  const tf = world.get(e, Transform);
  if (!tf) {
    world.destroy(e);
    return;
  }
  const monster = world.get(e, Monster);
  const boss = world.get(e, Boss);
  const level = world.get(e, Stats)?.level ?? sim.zone.recommendedLevel;
  let family: MonsterFamily = 'riven';
  let rank: MonsterRank = 'normal';
  if (monster) {
    family = monster.family;
    rank = monster.rank;
  } else if (boss) {
    const def = getBoss(boss.defId);
    family = def.family;
    rank = 'boss';
  }

  sim.events.died.emit({ entity: e, killer, family, rank, x: tf.x, y: tf.y, lastDamageType });
  sim.events.sfx.emit({ cue: rank === 'boss' ? 'sfx_boss_death' : 'sfx_enemy_death', x: tf.x, y: tf.y });

  const byPlayer = killer === sim.player;
  const xp = world.get(e, XpReward);
  if (xp && byPlayer) sim.addXp(xp.amount);

  const loot = world.get(e, LootSource);
  if (loot) {
    const result = resolveLoot(sim.loot, loot.tableId, level, sim.sheet.classId, sim.nextItemId);
    for (const item of result.items) {
      const off = sim.gen.insideCircle(rank === 'boss' ? 2.6 : 1.3);
      const gx = tf.x + off.x;
      const gy = tf.y + off.y;
      sim.droppedItems.set(item.id, item);
      spawnGroundItem(world, sim.tick, { id: item.id, rarity: item.rarity, name: item.name }, gx, gy);
      sim.events.loot.emit({ itemInstanceId: item.id, rarity: item.rarity, x: gx, y: gy });
    }
    if (result.gold > 0) spawnGold(world, sim.tick, result.gold, tf.x, tf.y);
    if (result.globe) spawnGlobe(world, sim.tick, tf.x + 0.4, tf.y + 0.4, 0.15);
  }

  // Elite on-death: Volatile leaves a telegraphed explosion.
  const elite = world.get(e, Elite);
  if (elite && elite.affixes.includes('elite_volatile')) {
    spawnVolatile(sim, tf.x, tf.y, level);
  }

  if (boss) {
    if (!sim.sheet.bossDefeated.includes(boss.defId)) sim.sheet.bossDefeated.push(boss.defId);
    sim.bossCleared = true;
    sim.events.zone.emit({ kind: 'areaClear', id: boss.defId });
    sim.events.shake.emit({ trauma: 0.6 });
  }

  world.destroy(e);
}

function spawnVolatile(sim: Sim, x: number, y: number, level: number): void {
  const payload: AttackPayload = {
    source: sim.player === 0 ? 0 : -1,
    ownerFaction: 'enemy',
    skillId: 'volatile_burst',
    baseMin: 8 + level * 2,
    baseMax: 12 + level * 3,
    damageType: 'fire',
    tags: [],
    increasedDamage: 0,
    moreDamage: 1,
    critChance: 0,
    critMulti: 1,
    canCrit: false,
    knockback: 0.6,
    hitStopMs: 0,
    lifeOnHit: 0,
    lifeLeech: 0,
  };
  spawnAreaEffect(sim.world, sim.tick, payload, x, y, 'enemy', {
    radius: 3,
    tickInterval: 999,
    endTick: sim.tick + sim.msToTicks(700),
    hitOnce: true,
    telegraphUntil: sim.tick + sim.msToTicks(550),
    followSource: 0,
    vfx: 'volatile_burst',
  });
}

function handlePlayerDeath(sim: Sim, e: Entity): void {
  if (sim.playerDead) return;
  sim.playerDead = true;
  sim.playerRespawnTick = sim.tick + sim.msToTicks(2600);
  const tf = sim.world.get(e, Transform);
  const h = sim.world.get(e, Health);
  const lastType = h?.lastDamageType ?? 'physical';
  sim.events.died.emit({
    entity: e,
    killer: h?.lastAttacker ?? 0,
    family: 'player',
    rank: 'player',
    x: tf?.x ?? 0,
    y: tf?.y ?? 0,
    lastDamageType: lastType,
  });
  sim.events.shake.emit({ trauma: 0.7 });
  sim.events.sfx.emit({ cue: 'sfx_player_death' });
}

import { World } from './ecs/world.ts';
import { NO_ENTITY, type Entity } from './ecs/store.ts';
import { EventBus } from './events.ts';
import { SpatialHash } from './spatial.ts';
import { Rng, RngStreams, RngStream } from './rng.ts';
import { SIM_DT, SIM_HZ } from './constants.ts';
import type { Sim } from './context.ts';
import type { Command } from './commands.ts';
import type { CharacterSheet } from './character.ts';
import { equipmentMods, rebuildSkillBar, xpToNext } from './character.ts';
import type { ItemInstance } from './items/generate.ts';
import { getBoss, getMonster, getZone } from '../content/index.ts';
import type { ZoneDef } from '../content/types.ts';
import {
  Collider,
  Health,
  PlayerControlled,
  Resource,
  SkillUser,
  Stats,
  Transform,
  type SkillSlotState,
} from './components.ts';
import { spawnBoss, spawnInteractable, spawnMonster, spawnPlayer } from './prefabs.ts';
import { commandSystem } from './systems/commands.ts';
import { aiSystem } from './systems/ai.ts';
import { skillSystem } from './systems/skills.ts';
import { projectileSystem } from './systems/projectiles.ts';
import { areaSystem } from './systems/areas.ts';
import { movementSystem } from './systems/movement.ts';
import { ailmentSystem } from './systems/ailments_tick.ts';
import { buffSystem, recomputeStats } from './systems/buffs.ts';
import { resourceSystem } from './systems/resources.ts';
import { deathSystem } from './systems/death.ts';
import { pickupSystem } from './systems/pickups.ts';
import { worldSystem } from './systems/world.ts';
import { lifetimeSystem } from './systems/lifetime.ts';

export interface SimOptions {
  sheet: CharacterSheet;
  zoneId: string;
  seed: number;
}

/**
 * The simulation: owns the world, RNG streams, event bus, and the fixed-order
 * system schedule. Driven entirely by a per-tick Command stream; emits events +
 * read-only state for the presentation layers (ARCHITECTURE.md §2/§9).
 */
export class Simulation implements Sim {
  readonly world = new World();
  readonly events = new EventBus();
  readonly spatial = new SpatialHash();
  readonly zone: ZoneDef;
  readonly sheet: CharacterSheet;
  readonly dt = SIM_DT;

  tick = 0;
  player: Entity = NO_ENTITY;
  bossEntity: Entity = NO_ENTITY;
  bossEngaged = false;
  bossCleared = false;
  playerDead = false;
  playerRespawnTick = 0;
  readonly droppedItems = new Map<string, ItemInstance>();

  readonly combat: Rng;
  readonly loot: Rng;
  readonly ai: Rng;
  readonly gen: Rng;

  private readonly streams: RngStreams;
  private itemCounter = 0;

  constructor(opts: SimOptions) {
    this.sheet = opts.sheet;
    this.zone = getZone(opts.zoneId);
    this.streams = new RngStreams(opts.seed);
    this.combat = this.streams.stream(RngStream.Combat);
    this.loot = this.streams.stream(RngStream.Loot);
    this.ai = this.streams.stream(RngStream.AI);
    this.gen = this.streams.stream(RngStream.Generation);
    this.buildZone();
  }

  msToTicks(ms: number): number {
    return Math.max(1, Math.round((ms / 1000) * SIM_HZ));
  }

  // Arrow field so it stays bound when passed as a callback (e.g. to resolveLoot).
  nextItemId = (): string => `it_${this.itemCounter++}`;

  recomputePlayerStats(restore: boolean): void {
    const stats = this.world.get(this.player, Stats);
    if (!stats) return;
    stats.level = this.sheet.level;
    stats.baseMods = equipmentMods(this.sheet);
    recomputeStats(this, this.player, stats);
    if (restore) {
      const h = this.world.get(this.player, Health);
      if (h) h.current = h.max;
    }
    this.syncSkillBar();
  }

  addXp(amount: number): void {
    if (amount <= 0) return;
    this.sheet.xp += amount;
    this.events.xp.emit({ amount, total: this.sheet.xp });
    let leveled = false;
    while (this.sheet.xp >= xpToNext(this.sheet.level)) {
      this.sheet.xp -= xpToNext(this.sheet.level);
      this.sheet.level += 1;
      leveled = true;
    }
    if (leveled) this.applyLevelUp();
  }

  private applyLevelUp(): void {
    rebuildSkillBar(this.sheet);
    const pc = this.world.get(this.player, PlayerControlled);
    if (pc) pc.level = this.sheet.level;
    this.recomputePlayerStats(true);
    const tf = this.world.get(this.player, Transform);
    this.events.levelUp.emit({ entity: this.player, level: this.sheet.level });
    if (tf) this.events.floatText.emit({ x: tf.x, y: tf.y, text: 'LEVEL UP', kind: 'info' });
    this.events.shake.emit({ trauma: 0.2 });
    this.events.sfx.emit({ cue: 'sfx_levelup' });
  }

  /** Reconcile the player's SkillUser slots with the sheet's skill bar. */
  private syncSkillBar(): void {
    const su = this.world.get(this.player, SkillUser);
    if (!su) return;
    const prev = new Map(su.slots.map((s) => [s.skillId, s.cooldownUntil]));
    const slots: SkillSlotState[] = [];
    for (const skillId of this.sheet.skillBar) {
      const id = skillId ?? '';
      slots.push({ skillId: id, cooldownUntil: id ? (prev.get(id) ?? 0) : 0 });
    }
    su.slots = slots;
  }

  private buildZone(): void {
    const z = this.zone;
    const player = spawnPlayer(this.world, this.tick, this.sheet);
    const ptf = this.world.get(player, Transform)!;
    ptf.x = z.playerStart.x;
    ptf.y = z.playerStart.y;
    this.player = player;
    this.recomputePlayerStats(true);

    for (const pack of z.packs) {
      const def = getMonster(pack.monsterId);
      for (let i = 0; i < pack.count; i++) {
        const off = this.gen.insideCircle(pack.radius);
        const x = pack.x + off.x;
        const y = pack.y + off.y;
        const elites = i === 0 ? pack.eliteAffixes : undefined;
        spawnMonster(this.world, this.tick, def, x, y, def.level, elites);
      }
    }

    for (const inter of z.interactables) {
      spawnInteractable(this.world, this.tick, inter);
    }

    if (z.boss) {
      const def = getBoss(z.boss.defId);
      this.bossEntity = spawnBoss(this.world, this.tick, def, z.boss.x, z.boss.y, def.level);
    }

    this.world.flushDestroys();
  }

  private rebuildSpatial(): void {
    this.spatial.clear();
    for (const [e, tf, col] of this.world.view2(Transform, Collider)) {
      this.spatial.insert(e, tf.x, tf.y, col.radius);
    }
  }

  /** Advance the simulation exactly one fixed tick. */
  step(commands: readonly Command[]): void {
    this.events.clearAll();
    this.rebuildSpatial();

    commandSystem(this, commands);
    aiSystem(this);
    skillSystem(this);
    projectileSystem(this);
    areaSystem(this);
    movementSystem(this);
    ailmentSystem(this);
    buffSystem(this);
    resourceSystem(this);
    deathSystem(this);
    pickupSystem(this);
    worldSystem(this);
    lifetimeSystem(this);

    this.world.flushDestroys();
    this.tick += 1;
  }

  /** Convenience read for the presentation layer. */
  get playerAlive(): boolean {
    const h = this.world.get(this.player, Health);
    return !this.playerDead && !!h && h.current > 0;
  }

  playerHealth(): Health | undefined {
    return this.world.get(this.player, Health);
  }

  playerResource(): Resource | undefined {
    return this.world.get(this.player, Resource);
  }
}

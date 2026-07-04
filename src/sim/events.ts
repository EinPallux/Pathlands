import type { Entity } from './ecs/store.ts';
import type { DamageType, MonsterFamily, MonsterRank, Rarity } from './defs.ts';

// One-way simulation output. Systems emit events during a tick; later systems
// (same tick) and the render/audio/UI layers (after the tick) read them. The bus
// is cleared at the start of every tick, so events live exactly one tick.
//
// Emitting is pure output — sim state never depends on whether anyone reads an
// event — so this stays deterministic. VFX/SFX are described as *data* here and
// realised by the presentation layers.

export interface DamageEvent {
  source: Entity;
  target: Entity;
  amount: number;
  type: DamageType;
  crit: boolean;
  overkill: number; // damage beyond the target's remaining life; 0 if it survived
  x: number;
  y: number;
  fromDot: boolean;
}

/** A weapon/skill contact, emitted even on block/miss so impacts still read. */
export interface HitEvent {
  source: Entity;
  target: Entity;
  type: DamageType;
  result: 'hit' | 'crit' | 'blocked' | 'evaded' | 'immune';
  x: number;
  y: number;
  knockback: number;
}

export interface DeathEvent {
  entity: Entity;
  killer: Entity;
  family: MonsterFamily | 'player';
  rank: MonsterRank | 'player';
  x: number;
  y: number;
  lastDamageType: DamageType;
}

export interface SkillCastEvent {
  caster: Entity;
  skillId: string;
  x: number;
  y: number;
  aimX: number;
  aimY: number;
}

export interface FloatingTextEvent {
  x: number;
  y: number;
  text: string;
  kind: 'damage' | 'crit' | 'heal' | 'miss' | 'blocked' | 'info' | 'xp';
  damageType?: DamageType;
}

export interface LootDropEvent {
  itemInstanceId: string;
  rarity: Rarity;
  x: number;
  y: number;
}

export interface PickupEvent {
  kind: 'item' | 'gold' | 'globe';
  amount: number;
  x: number;
  y: number;
}

export interface LevelUpEvent {
  entity: Entity;
  level: number;
}

export interface XpEvent {
  amount: number;
  total: number;
}

export interface ShakeEvent {
  trauma: number; // 0..1 added to the camera trauma accumulator
}

export interface HitStopEvent {
  ms: number;
}

export interface SfxEvent {
  cue: string;
  x?: number;
  y?: number;
  gain?: number;
}

export interface ZoneEvent {
  kind: 'waypoint' | 'bossSpawn' | 'bossPhase' | 'areaClear' | 'objective';
  id: string;
  phase?: number;
}

class Channel<T> {
  private items: T[] = [];
  emit(v: T): void {
    this.items.push(v);
  }
  get all(): readonly T[] {
    return this.items;
  }
  get length(): number {
    return this.items.length;
  }
  clear(): void {
    this.items.length = 0;
  }
}

export class EventBus {
  private readonly channels: Channel<unknown>[] = [];
  private make<T>(): Channel<T> {
    const c = new Channel<T>();
    this.channels.push(c as Channel<unknown>);
    return c;
  }

  readonly damage = this.make<DamageEvent>();
  readonly hit = this.make<HitEvent>();
  readonly died = this.make<DeathEvent>();
  readonly skillCast = this.make<SkillCastEvent>();
  readonly floatText = this.make<FloatingTextEvent>();
  readonly loot = this.make<LootDropEvent>();
  readonly pickup = this.make<PickupEvent>();
  readonly levelUp = this.make<LevelUpEvent>();
  readonly xp = this.make<XpEvent>();
  readonly shake = this.make<ShakeEvent>();
  readonly hitStop = this.make<HitStopEvent>();
  readonly sfx = this.make<SfxEvent>();
  readonly zone = this.make<ZoneEvent>();

  clearAll(): void {
    for (const c of this.channels) c.clear();
  }
}

import { defineComponent, type Entity } from './ecs/store.ts';
import type { DamageType, Faction, MonsterFamily, MonsterRank, Rarity } from './defs.ts';
import type { ClassBaseStats, Modifier, ResourceKind, StatBlock } from './combat/stats.ts';
import type { AilmentType } from './defs.ts';
import type { AttackPayload } from './combat/types.ts';

// ============================================================================
// Component definitions. Plain data attached to entities; behaviour lives in
// systems. Timers are in integer sim ticks for determinism.
// ============================================================================

export interface Transform {
  x: number;
  y: number;
  facing: number; // radians, ground-plane heading
}
export const Transform = defineComponent<Transform>('Transform');

export interface Velocity {
  x: number;
  y: number;
}
export const Velocity = defineComponent<Velocity>('Velocity');

export interface Collider {
  radius: number;
  blocking: boolean; // participates in agent-agent push resolution
  height: number; // for camera/targeting; render-facing
}
export const Collider = defineComponent<Collider>('Collider');

export interface FactionC {
  value: Faction;
}
export const FactionC = defineComponent<FactionC>('Faction');

export interface Health {
  current: number;
  max: number;
  regenAccum: number; // fractional life carried between ticks
  lastDamagedTick: number;
  lastDamageType: DamageType;
  lastAttacker: Entity;
}
export const Health = defineComponent<Health>('Health');

export interface Resource {
  current: number;
  max: number;
  kind: ResourceKind;
  regenAccum: number;
}
export const Resource = defineComponent<Resource>('Resource');

export interface Stats {
  block: StatBlock;
  /** The class/monster base curve, so stats can be recomputed on change. */
  base: ClassBaseStats;
  level: number;
  /** Persistent modifiers from gear/passives (buffs are added at recompute). */
  baseMods: Modifier[];
  dirty: boolean;
}
export const Stats = defineComponent<Stats>('Stats');

export type MoveMode = 'stop' | 'to' | 'dir';
export interface MoveIntent {
  mode: MoveMode;
  toX: number;
  toY: number;
  dirX: number;
  dirY: number;
}
export const MoveIntent = defineComponent<MoveIntent>('MoveIntent');

/** Crowd-control + transient combat states applied by hits/skills/ailments. */
export interface Control {
  stunnedUntil: number; // cannot act or move (stun/freeze)
  rootedUntil: number; // cannot move, can still act
  slowUntil: number;
  slowMult: number; // 1 = no slow (chill lowers this)
  knockUntil: number; // during knockback, controller yields to velocity
  shockUntil: number; // takes amplified damage while active
  shockAmp: number; // extra damage-taken fraction from shock (0.2 = +20%)
  healCutUntil: number; // corruption: healing reduced
  healCutPct: number; // fraction of healing removed (0..1)
}
export const Control = defineComponent<Control>('Control');

export function emptyControl(): Control {
  return {
    stunnedUntil: 0,
    rootedUntil: 0,
    slowUntil: 0,
    slowMult: 1,
    knockUntil: 0,
    shockUntil: 0,
    shockAmp: 0,
    healCutUntil: 0,
    healCutPct: 0,
  };
}

export interface Invulnerable {
  untilTick: number;
}
export const Invulnerable = defineComponent<Invulnerable>('Invulnerable');

/** Marks the single player-controlled entity and holds character progression. */
export interface PlayerControlled {
  classId: string;
  level: number;
  xp: number;
  potions: number;
  potionCooldownUntil: number;
  dodgeCooldownUntil: number;
}
export const PlayerControlled = defineComponent<PlayerControlled>('PlayerControlled');

export interface SkillSlotState {
  skillId: string;
  cooldownUntil: number;
}
export interface CastState {
  skillId: string;
  slot: number;
  startTick: number;
  releaseTick: number; // tick the effect fires
  endTick: number; // tick the animation/lock ends
  aimX: number;
  aimY: number;
  fired: boolean;
  payload: AttackPayload; // stats snapshot at cast time
  level: number;
}
export interface SkillUser {
  slots: SkillSlotState[];
  gcdUntil: number;
  cast: CastState | null;
}
export const SkillUser = defineComponent<SkillUser>('SkillUser');

export type BrainState = 'idle' | 'patrol' | 'chase' | 'attack' | 'reposition' | 'flee' | 'return';
export type AIArchetype = 'melee' | 'ranged' | 'caster' | 'brute' | 'swarm';
export interface Brain {
  archetype: AIArchetype;
  state: BrainState;
  target: Entity;
  homeX: number;
  homeY: number;
  aggroRange: number;
  leashRange: number;
  preferredRange: number; // ranged/casters keep this distance
  nextThinkTick: number;
  attackReadyTick: number; // cooldown gate between attacks
  windupUntil: number; // telegraph in progress until this tick
  windupSkill: string | null;
  repositionUntil: number;
  repositionX: number;
  repositionY: number;
}
export const Brain = defineComponent<Brain>('Brain');

export interface Monster {
  defId: string;
  family: MonsterFamily;
  rank: MonsterRank;
}
export const Monster = defineComponent<Monster>('Monster');

export interface Elite {
  affixes: string[];
}
export const Elite = defineComponent<Elite>('Elite');

export interface Boss {
  defId: string;
  phase: number;
  phaseThresholds: number[]; // life fractions that trigger the next phase
  nextMechanicTick: number;
  enraged: boolean;
  damageMult: number;
  moveMult: number;
}
export const Boss = defineComponent<Boss>('Boss');

export interface XpReward {
  amount: number;
}
export const XpReward = defineComponent<XpReward>('XpReward');

export interface LootSource {
  tableId: string;
  goldMin: number;
  goldMax: number;
}
export const LootSource = defineComponent<LootSource>('LootSource');

export interface Projectile {
  payload: AttackPayload;
  dirX: number;
  dirY: number;
  speed: number;
  radius: number;
  pierceLeft: number;
  originX: number;
  originY: number;
  maxRangeSq: number;
  hitSet: Set<Entity>;
  vfx: string;
}
export const Projectile = defineComponent<Projectile>('Projectile');

/** Lingering area effect (ground fire, nova, telegraphed slam resolve). */
export interface AreaEffect {
  payload: AttackPayload;
  radius: number;
  ownerFaction: Faction;
  tickInterval: number; // ticks between damage applications
  nextTick: number;
  endTick: number;
  hitOnce: boolean; // if true, damages each entity at most once
  hitSet: Set<Entity>;
  followSource: Entity; // NO_ENTITY to stay put
  telegraphUntil: number; // no damage before this tick (windup)
  vfx: string;
}
export const AreaEffect = defineComponent<AreaEffect>('AreaEffect');

export interface Lifetime {
  untilTick: number;
}
export const Lifetime = defineComponent<Lifetime>('Lifetime');

export interface ActiveBuff {
  id: string;
  untilTick: number;
  mods: Modifier[];
  stacks: number;
}
export interface Buffs {
  list: ActiveBuff[];
}
export const Buffs = defineComponent<Buffs>('Buffs');

export interface ActiveAilment {
  type: AilmentType;
  untilTick: number;
  nextTick: number;
  dmgPerTick: number;
  damageType: DamageType;
  source: Entity;
  stacks: number;
}
export interface Ailments {
  list: ActiveAilment[];
}
export const Ailments = defineComponent<Ailments>('Ailments');

export interface GroundItem {
  itemInstanceId: string;
  rarity: Rarity;
  label: string;
}
export const GroundItem = defineComponent<GroundItem>('GroundItem');

export interface GroundGold {
  amount: number;
}
export const GroundGold = defineComponent<GroundGold>('GroundGold');

export interface HealthGlobe {
  healPct: number;
}
export const HealthGlobe = defineComponent<HealthGlobe>('HealthGlobe');

export type InteractKind = 'waypoint' | 'shrine' | 'chest' | 'npc' | 'exit';
export interface Interactable {
  kind: InteractKind;
  id: string;
  radius: number;
  used: boolean;
  prompt: string;
}
export const Interactable = defineComponent<Interactable>('Interactable');

export interface Name {
  value: string;
}
export const Name = defineComponent<Name>('Name');

/** Drives the render layer's view for this entity. */
export interface Renderable {
  kind: string; // e.g. 'sentinel', 'riven_husk', 'projectile', 'groundItem'
  variant: string;
  scale: number;
  tint: number; // hex; 0 = model default
  rimColor: number;
}
export const Renderable = defineComponent<Renderable>('Renderable');

/** Presentation-only flags read by the render layer (never by sim logic). */
export interface VisualState {
  spawnTick: number;
  deathTick: number; // >0 while dissolving
  hitFlashUntil: number;
}
export const VisualState = defineComponent<VisualState>('VisualState');

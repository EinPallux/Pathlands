import type { World } from './ecs/world.ts';
import { NO_ENTITY, type Entity } from './ecs/store.ts';
import {
  Ailments,
  Boss,
  Brain,
  Collider,
  Control,
  FactionC,
  GroundGold,
  GroundItem,
  Health,
  HealthGlobe,
  Interactable,
  Lifetime,
  LootSource,
  Monster,
  MoveIntent,
  Name,
  PlayerControlled,
  XpReward,
  Projectile,
  AreaEffect,
  Renderable,
  Resource,
  SkillUser,
  Stats,
  Transform,
  Velocity,
  VisualState,
  Buffs,
  Elite,
  emptyControl,
  type SkillSlotState,
} from './components.ts';
import { computeStats, type ClassBaseStats, type Modifier } from './combat/stats.ts';
import type { AttackPayload } from './combat/types.ts';
import { equipmentMods, type CharacterSheet } from './character.ts';
import { getClass, getEliteAffix } from '../content/index.ts';
import type { BossDef, MonsterDef, ZoneInteractable } from '../content/types.ts';
import type { Faction } from './defs.ts';

// Entity factories. Prefabs resolve content into component bundles; they take
// (world, tick, …) rather than the whole Sim to stay lightweight.

export function spawnPlayer(world: World, tick: number, sheet: CharacterSheet): Entity {
  const cls = getClass(sheet.classId);
  const mods = equipmentMods(sheet);
  const block = computeStats(cls.baseStats, sheet.level, mods);
  const e = world.createEntity();
  world.add(e, Transform, { x: 0, y: 0, facing: Math.PI / 2 });
  world.add(e, Velocity, { x: 0, y: 0 });
  world.add(e, Collider, { radius: 0.42, blocking: true, height: 1.9 });
  world.add(e, FactionC, { value: 'player' });
  world.add(e, Health, {
    current: block.maxLife,
    max: block.maxLife,
    regenAccum: 0,
    lastDamagedTick: 0,
    lastDamageType: 'physical',
    lastAttacker: NO_ENTITY,
  });
  world.add(e, Resource, {
    current: block.resourceKind === 'wrath' ? 0 : block.maxResource,
    max: block.maxResource,
    kind: block.resourceKind,
    regenAccum: 0,
  });
  world.add(e, Stats, { block, base: cls.baseStats, level: sheet.level, baseMods: mods, dirty: false });
  world.add(e, MoveIntent, { mode: 'stop', toX: 0, toY: 0, dirX: 0, dirY: 0 });
  world.add(e, Control, emptyControl());
  world.add(e, Buffs, { list: [] });
  world.add(e, Ailments, { list: [] });
  world.add(e, SkillUser, { slots: skillSlotsFromBar(sheet.skillBar), gcdUntil: 0, cast: null });
  world.add(e, PlayerControlled, {
    classId: sheet.classId,
    level: sheet.level,
    xp: sheet.xp,
    potions: sheet.potions,
    potionCooldownUntil: 0,
    dodgeCooldownUntil: 0,
  });
  world.add(e, Renderable, { kind: cls.modelKind, variant: 'base', scale: 1, tint: 0, rimColor: 0xffd8a0 });
  world.add(e, VisualState, { spawnTick: tick, deathTick: 0, hitFlashUntil: 0 });
  world.add(e, Name, { value: sheet.name });
  return e;
}

function skillSlotsFromBar(bar: (string | null)[]): SkillSlotState[] {
  const slots: SkillSlotState[] = [];
  for (const skillId of bar) {
    slots.push({ skillId: skillId ?? '', cooldownUntil: 0 });
  }
  return slots;
}

function monsterBaseStats(def: MonsterDef): ClassBaseStats {
  return {
    attributes: { might: 0, precision: 0, will: 0, vitality: 0 },
    attributesPerLevel: { might: 0, precision: 0, will: 0, vitality: 0 },
    baseLife: def.life,
    lifePerLevel: def.lifePerLevel,
    lifeRegen: 0,
    resourceKind: 'none',
    baseResource: 0,
    resourceRegen: 0,
    baseCritChance: 0,
    baseCritMulti: 1.5,
    baseMoveSpeed: def.moveSpeed,
    baseArmor: def.armor,
  };
}

function resistMods(def: MonsterDef): Modifier[] {
  const mods: Modifier[] = [];
  const map: Record<string, Modifier['stat']> = {
    physical: 'resistPhysical',
    fire: 'resistFire',
    cold: 'resistCold',
    lightning: 'resistLightning',
    shadow: 'resistShadow',
  };
  for (const [type, value] of Object.entries(def.resist)) {
    const stat = map[type];
    if (stat && value) mods.push({ stat, mode: 'flat', value });
  }
  return mods;
}

function addCombatant(
  world: World,
  tick: number,
  def: MonsterDef,
  x: number,
  y: number,
  level: number,
  extraMods: Modifier[],
): Entity {
  const mods = [...resistMods(def), ...extraMods];
  const base = monsterBaseStats(def);
  const block = computeStats(base, level, mods);
  const e = world.createEntity();
  world.add(e, Transform, { x, y, facing: -Math.PI / 2 });
  world.add(e, Velocity, { x: 0, y: 0 });
  world.add(e, Collider, { radius: def.colliderRadius, blocking: true, height: def.height });
  world.add(e, FactionC, { value: 'enemy' });
  world.add(e, Health, {
    current: block.maxLife,
    max: block.maxLife,
    regenAccum: 0,
    lastDamagedTick: 0,
    lastDamageType: 'physical',
    lastAttacker: NO_ENTITY,
  });
  world.add(e, Stats, { block, base, level, baseMods: mods, dirty: false });
  world.add(e, MoveIntent, { mode: 'stop', toX: 0, toY: 0, dirX: 0, dirY: 0 });
  world.add(e, Control, emptyControl());
  world.add(e, Buffs, { list: [] });
  world.add(e, Ailments, { list: [] });
  world.add(e, Brain, {
    archetype: def.archetype,
    state: 'idle',
    target: NO_ENTITY,
    homeX: x,
    homeY: y,
    aggroRange: def.aggroRange,
    leashRange: def.leashRange,
    preferredRange: def.preferredRange,
    nextThinkTick: 0,
    attackReadyTick: 0,
    windupUntil: 0,
    windupSkill: null,
    repositionUntil: 0,
    repositionX: x,
    repositionY: y,
  });
  world.add(e, SkillUser, {
    slots: [{ skillId: def.attackSkillId, cooldownUntil: 0 }],
    gcdUntil: 0,
    cast: null,
  });
  world.add(e, Monster, { defId: def.id, family: def.family, rank: def.rank });
  world.add(e, Renderable, {
    kind: def.modelKind,
    variant: def.modelVariant,
    scale: def.scale,
    tint: def.tint,
    rimColor: 0xff8850,
  });
  world.add(e, VisualState, { spawnTick: tick, deathTick: 0, hitFlashUntil: 0 });
  return e;
}

export function spawnMonster(
  world: World,
  tick: number,
  def: MonsterDef,
  x: number,
  y: number,
  level: number,
  eliteAffixes?: string[],
): Entity {
  const extraMods: Modifier[] = [];
  let displayName = def.name;
  let rim = 0xff8850;
  if (eliteAffixes && eliteAffixes.length > 0) {
    for (const id of eliteAffixes) {
      const aff = getEliteAffix(id);
      extraMods.push(...aff.mods);
      if (aff.auraColor) rim = aff.auraColor;
    }
    const first = getEliteAffix(eliteAffixes[0]!);
    displayName = `${first.name} ${def.name}`;
  }
  const e = addCombatant(world, tick, def, x, y, level, extraMods);
  world.add(e, Name, { value: displayName });
  world.add(e, LootSource, {
    tableId: eliteAffixes ? 'loot_elite' : def.lootTableId,
    goldMin: def.goldMin,
    goldMax: def.goldMax,
  });
  world.add(e, XpReward, { amount: def.xp });
  if (eliteAffixes && eliteAffixes.length > 0) {
    world.add(e, Elite, { affixes: eliteAffixes });
    const rend = world.get(e, Renderable);
    if (rend) {
      rend.rimColor = rim;
      rend.scale *= 1.15;
    }
  }
  return e;
}

export function spawnBoss(
  world: World,
  tick: number,
  def: BossDef,
  x: number,
  y: number,
  level: number,
): Entity {
  const e = addCombatant(world, tick, def, x, y, level, []);
  world.add(e, Name, { value: `${def.name}, ${def.title}` });
  world.add(e, LootSource, { tableId: def.lootTableId, goldMin: def.goldMin, goldMax: def.goldMax });
  world.add(e, XpReward, { amount: def.xp });
  // Give the boss all its skills as slots (basic attack + every phase mechanic).
  const skillIds = new Set<string>([def.attackSkillId]);
  for (const p of def.phases) for (const s of p.mechanicSkillIds) skillIds.add(s);
  const su = world.get(e, SkillUser);
  if (su) su.slots = [...skillIds].map((skillId) => ({ skillId, cooldownUntil: 0 }));
  world.add(e, Boss, {
    defId: def.id,
    phase: 0,
    phaseThresholds: def.phases.map((p) => p.lifeFraction),
    nextMechanicTick: tick + 90,
    enraged: false,
    damageMult: 1,
    moveMult: 1,
  });
  const r = world.get(e, Renderable);
  if (r) r.rimColor = 0xff3020;
  return e;
}

export function spawnProjectile(
  world: World,
  tick: number,
  payload: AttackPayload,
  x: number,
  y: number,
  dirX: number,
  dirY: number,
  opts: { speed: number; radius: number; range: number; pierce: number; vfx: string; lifeTicks: number },
): Entity {
  const e = world.createEntity();
  world.add(e, Transform, { x, y, facing: Math.atan2(dirY, dirX) });
  world.add(e, Projectile, {
    payload,
    dirX,
    dirY,
    speed: opts.speed,
    radius: opts.radius,
    pierceLeft: opts.pierce,
    originX: x,
    originY: y,
    maxRangeSq: opts.range * opts.range,
    hitSet: new Set<Entity>(),
    vfx: opts.vfx,
  });
  world.add(e, Renderable, { kind: 'projectile', variant: opts.vfx, scale: 1, tint: 0, rimColor: 0 });
  world.add(e, VisualState, { spawnTick: tick, deathTick: 0, hitFlashUntil: 0 });
  world.add(e, Lifetime, { untilTick: tick + opts.lifeTicks });
  return e;
}

export function spawnAreaEffect(
  world: World,
  tick: number,
  payload: AttackPayload,
  x: number,
  y: number,
  ownerFaction: Faction,
  opts: {
    radius: number;
    tickInterval: number;
    endTick: number;
    hitOnce: boolean;
    telegraphUntil: number;
    followSource: Entity;
    vfx: string;
  },
): Entity {
  const e = world.createEntity();
  world.add(e, Transform, { x, y, facing: 0 });
  world.add(e, AreaEffect, {
    payload,
    radius: opts.radius,
    ownerFaction,
    tickInterval: opts.tickInterval,
    nextTick: Math.max(tick, opts.telegraphUntil),
    endTick: opts.endTick,
    hitOnce: opts.hitOnce,
    hitSet: new Set<Entity>(),
    followSource: opts.followSource,
    telegraphUntil: opts.telegraphUntil,
    vfx: opts.vfx,
  });
  world.add(e, Renderable, { kind: 'area', variant: opts.vfx, scale: opts.radius, tint: 0, rimColor: 0 });
  world.add(e, VisualState, { spawnTick: tick, deathTick: 0, hitFlashUntil: 0 });
  world.add(e, Lifetime, { untilTick: opts.endTick });
  return e;
}

export function spawnGroundItem(
  world: World,
  tick: number,
  item: { id: string; rarity: string; name: string },
  x: number,
  y: number,
): Entity {
  const e = world.createEntity();
  world.add(e, Transform, { x, y, facing: 0 });
  world.add(e, Collider, { radius: 0.3, blocking: false, height: 0.3 });
  world.add(e, GroundItem, { itemInstanceId: item.id, rarity: item.rarity as GroundItem['rarity'], label: item.name });
  world.add(e, Renderable, { kind: 'groundItem', variant: item.rarity, scale: 1, tint: 0, rimColor: 0 });
  world.add(e, VisualState, { spawnTick: tick, deathTick: 0, hitFlashUntil: 0 });
  world.add(e, Lifetime, { untilTick: tick + 30 * 180 });
  return e;
}

export function spawnGold(world: World, tick: number, amount: number, x: number, y: number): Entity {
  const e = world.createEntity();
  world.add(e, Transform, { x, y, facing: 0 });
  world.add(e, GroundGold, { amount });
  world.add(e, Renderable, { kind: 'gold', variant: 'gold', scale: 1, tint: 0, rimColor: 0 });
  world.add(e, VisualState, { spawnTick: tick, deathTick: 0, hitFlashUntil: 0 });
  world.add(e, Lifetime, { untilTick: tick + 30 * 120 });
  return e;
}

export function spawnGlobe(world: World, tick: number, x: number, y: number, healPct: number): Entity {
  const e = world.createEntity();
  world.add(e, Transform, { x, y, facing: 0 });
  world.add(e, HealthGlobe, { healPct });
  world.add(e, Renderable, { kind: 'globe', variant: 'globe', scale: 1, tint: 0, rimColor: 0 });
  world.add(e, VisualState, { spawnTick: tick, deathTick: 0, hitFlashUntil: 0 });
  world.add(e, Lifetime, { untilTick: tick + 30 * 30 });
  return e;
}

export function spawnInteractable(world: World, tick: number, def: ZoneInteractable): Entity {
  const e = world.createEntity();
  world.add(e, Transform, { x: def.x, y: def.y, facing: 0 });
  world.add(e, Collider, { radius: 0.8, blocking: false, height: 1.5 });
  world.add(e, Interactable, { kind: def.kind, id: def.id, radius: 2.2, used: false, prompt: def.prompt });
  world.add(e, Renderable, { kind: 'interactable', variant: def.kind, scale: 1, tint: 0, rimColor: 0x3fd0c4 });
  world.add(e, VisualState, { spawnTick: tick, deathTick: 0, hitFlashUntil: 0 });
  return e;
}

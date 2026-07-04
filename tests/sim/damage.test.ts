import { describe, expect, it } from 'vitest';
import { World } from '../../src/sim/ecs/world.ts';
import { Rng } from '../../src/sim/rng.ts';
import { EventBus } from '../../src/sim/events.ts';
import { Health, Stats, Transform, Invulnerable, Control, emptyControl } from '../../src/sim/components.ts';
import { computeStats, type ClassBaseStats, type Modifier } from '../../src/sim/combat/stats.ts';
import { applyDamage } from '../../src/sim/combat/damage.ts';
import type { AttackPayload } from '../../src/sim/combat/types.ts';
import type { Entity } from '../../src/sim/ecs/store.ts';
import type { DamageType } from '../../src/sim/defs.ts';

const dummyBase: ClassBaseStats = {
  attributes: { might: 0, precision: 0, will: 0, vitality: 0 },
  attributesPerLevel: { might: 0, precision: 0, will: 0, vitality: 0 },
  baseLife: 1000,
  lifePerLevel: 0,
  lifeRegen: 0,
  resourceKind: 'none',
  baseResource: 0,
  resourceRegen: 0,
  baseCritChance: 0,
  baseCritMulti: 1.5,
  baseMoveSpeed: 4,
  baseArmor: 0,
};

function spawnTarget(world: World, mods: Modifier[], armor = 0): Entity {
  const e = world.createEntity();
  world.add(e, Transform, { x: 0, y: 0, facing: 0 });
  const allMods = armor ? [...mods, { stat: 'armor', mode: 'flat', value: armor } as Modifier] : mods;
  const block = computeStats(dummyBase, 1, allMods);
  world.add(e, Health, {
    current: block.maxLife,
    max: block.maxLife,
    regenAccum: 0,
    lastDamagedTick: 0,
    lastDamageType: 'physical',
    lastAttacker: 0,
  });
  world.add(e, Stats, { block, base: dummyBase, level: 1, baseMods: allMods, dirty: false });
  world.add(e, Control, emptyControl());
  return e;
}

function payload(over: Partial<AttackPayload> & { baseMin: number; baseMax: number; damageType: DamageType }): AttackPayload {
  return {
    source: 999,
    ownerFaction: 'player',
    skillId: 'test',
    increasedDamage: 0,
    moreDamage: 1,
    critChance: 0,
    critMulti: 1.5,
    canCrit: false,
    knockback: 0,
    hitStopMs: 0,
    lifeOnHit: 0,
    lifeLeech: 0,
    tags: [],
    ...over,
  };
}

describe('damage pipeline', () => {
  it('applies flat elemental resistance', () => {
    const w = new World();
    const rng = new Rng(1n);
    const events = new EventBus();
    const target = spawnTarget(w, [{ stat: 'resistFire', mode: 'flat', value: 0.5 }]);
    const res = applyDamage(w, target, payload({ baseMin: 100, baseMax: 100, damageType: 'fire' }), rng, events, 1);
    expect(res.dealt).toBe(50); // 50% fire resist
  });

  it('armor reduces physical damage with diminishing returns', () => {
    const w = new World();
    const rng = new Rng(1n);
    const events = new EventBus();
    // armor 800 vs a 100 hit → armor/(armor+8*dmg) = 800/1600 = 0.5 mitigation.
    const target = spawnTarget(w, [], 800);
    const res = applyDamage(w, target, payload({ baseMin: 100, baseMax: 100, damageType: 'physical' }), rng, events, 1);
    expect(res.dealt).toBe(50);
  });

  it('increased and more stack correctly (additive vs multiplicative)', () => {
    const w = new World();
    const rng = new Rng(1n);
    const events = new EventBus();
    const target = spawnTarget(w, []);
    // 100 base × (1 + 0.5 increased) × 2 more = 300.
    const res = applyDamage(
      w,
      target,
      payload({ baseMin: 100, baseMax: 100, damageType: 'cold', increasedDamage: 0.5, moreDamage: 2 }),
      rng,
      events,
      1,
    );
    expect(res.dealt).toBe(300);
  });

  it('kills and reports overkill', () => {
    const w = new World();
    const rng = new Rng(1n);
    const events = new EventBus();
    const target = spawnTarget(w, []);
    const h = w.get(target, Health)!;
    h.current = 40;
    const res = applyDamage(w, target, payload({ baseMin: 100, baseMax: 100, damageType: 'physical' }), rng, events, 1);
    expect(res.killed).toBe(true);
    expect(res.overkill).toBe(60);
    expect(h.current).toBeLessThanOrEqual(0);
  });

  it('i-frames negate direct damage', () => {
    const w = new World();
    const rng = new Rng(1n);
    const events = new EventBus();
    const target = spawnTarget(w, []);
    w.add(target, Invulnerable, { untilTick: 10 });
    const res = applyDamage(w, target, payload({ baseMin: 100, baseMax: 100, damageType: 'fire' }), rng, events, 5);
    expect(res.dealt).toBe(0);
    expect(res.evaded).toBe(true);
  });

  it('is deterministic across two identical runs with crit variance', () => {
    const run = (): number[] => {
      const w = new World();
      const rng = new Rng(4321n);
      const events = new EventBus();
      const target = spawnTarget(w, []);
      const h = w.get(target, Health)!;
      h.current = h.max = 1_000_000;
      const out: number[] = [];
      for (let i = 0; i < 200; i++) {
        const r = applyDamage(
          w,
          target,
          payload({ baseMin: 50, baseMax: 150, damageType: 'lightning', critChance: 0.3, critMulti: 2, canCrit: true }),
          rng,
          events,
          i,
        );
        out.push(r.dealt);
      }
      return out;
    };
    expect(run()).toEqual(run());
  });
});

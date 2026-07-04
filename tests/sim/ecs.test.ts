import { describe, expect, it } from 'vitest';
import { World } from '../../src/sim/ecs/world.ts';
import { defineComponent } from '../../src/sim/ecs/store.ts';

interface Pos {
  x: number;
  y: number;
}
interface Vel {
  dx: number;
  dy: number;
}
interface Tag {
  n: number;
}
const Pos = defineComponent<Pos>('TestPos');
const Vel = defineComponent<Vel>('TestVel');
const Tag = defineComponent<Tag>('TestTag');

describe('World / sparse-set ECS', () => {
  it('creates entities with monotonic ids', () => {
    const w = new World();
    const a = w.createEntity();
    const b = w.createEntity();
    expect(b).toBeGreaterThan(a);
    w.destroy(a);
    w.flushDestroys();
    const c = w.createEntity();
    expect(c).toBeGreaterThan(b); // never reuses ids
  });

  it('adds, gets, has, and removes components', () => {
    const w = new World();
    const e = w.createEntity();
    w.add(e, Pos, { x: 1, y: 2 });
    expect(w.has(e, Pos)).toBe(true);
    expect(w.get(e, Pos)).toEqual({ x: 1, y: 2 });
    w.remove(e, Pos);
    expect(w.has(e, Pos)).toBe(false);
    expect(w.get(e, Pos)).toBeUndefined();
  });

  it('swap-remove keeps the store consistent', () => {
    const w = new World();
    const ids = Array.from({ length: 10 }, (_, i) => {
      const e = w.createEntity();
      w.add(e, Tag, { n: i });
      return e;
    });
    // Remove from the middle; every survivor must still be intact.
    w.remove(ids[3]!, Tag);
    w.remove(ids[7]!, Tag);
    for (let i = 0; i < ids.length; i++) {
      if (i === 3 || i === 7) {
        expect(w.has(ids[i]!, Tag)).toBe(false);
      } else {
        expect(w.get(ids[i]!, Tag)).toEqual({ n: i });
      }
    }
    expect(w.count(Tag)).toBe(8);
  });

  it('view2 yields only entities with both components', () => {
    const w = new World();
    const both = w.createEntity();
    w.add(both, Pos, { x: 0, y: 0 });
    w.add(both, Vel, { dx: 1, dy: 1 });
    const posOnly = w.createEntity();
    w.add(posOnly, Pos, { x: 5, y: 5 });

    const seen: number[] = [];
    for (const [e, p, v] of w.view2(Pos, Vel)) {
      seen.push(e);
      p.x += v.dx;
    }
    expect(seen).toEqual([both]);
    expect(w.get(both, Pos)!.x).toBe(1);
  });

  it('is safe to destroy entities during a view iteration', () => {
    const w = new World();
    for (let i = 0; i < 20; i++) {
      const e = w.createEntity();
      w.add(e, Tag, { n: i });
    }
    let count = 0;
    for (const [e, t] of w.view1(Tag)) {
      count++;
      if (t.n % 2 === 0) w.destroy(e); // deferred
    }
    expect(count).toBe(20); // saw all before any destruction applied
    w.flushDestroys();
    expect(w.count(Tag)).toBe(10);
  });

  it('deferred destroy removes all components', () => {
    const w = new World();
    const e = w.createEntity();
    w.add(e, Pos, { x: 1, y: 1 });
    w.add(e, Vel, { dx: 0, dy: 0 });
    w.destroy(e);
    expect(w.isAlive(e)).toBe(true); // not yet
    w.flushDestroys();
    expect(w.isAlive(e)).toBe(false);
    expect(w.has(e, Pos)).toBe(false);
    expect(w.has(e, Vel)).toBe(false);
  });
});

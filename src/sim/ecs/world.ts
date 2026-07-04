import { ComponentStore, type ComponentType, type Entity, NO_ENTITY } from './store.ts';

export { type Entity, NO_ENTITY, type ComponentType };

/**
 * The ECS world: entities, component stores, and typed queries.
 *
 * Structural rules that keep iteration safe and the sim deterministic:
 *  - Entity ids are monotonic (never reused), so a stale id can never alias a
 *    new entity.
 *  - `destroy` is deferred to `flushDestroys()` at the tick boundary.
 *  - `view*` iterates a snapshot of the smallest matching store, so systems may
 *    freely add/remove components (and destroy entities) mid-iteration.
 */
export class World {
  private nextId = 1;
  private readonly aliveSet = new Set<Entity>();
  private readonly stores: (ComponentStore<unknown> | undefined)[] = [];
  private readonly destroyQueue: Entity[] = [];

  createEntity(): Entity {
    const e = this.nextId++;
    this.aliveSet.add(e);
    return e;
  }

  isAlive(e: Entity): boolean {
    return this.aliveSet.has(e);
  }

  get entityCount(): number {
    return this.aliveSet.size;
  }

  /** Queue an entity for destruction at the next `flushDestroys()`. */
  destroy(e: Entity): void {
    if (this.aliveSet.has(e)) this.destroyQueue.push(e);
  }

  private storeFor<T>(type: ComponentType<T>): ComponentStore<T> {
    let s = this.stores[type.id] as ComponentStore<T> | undefined;
    if (!s) {
      s = new ComponentStore<T>();
      this.stores[type.id] = s as ComponentStore<unknown>;
    }
    return s;
  }

  add<T>(e: Entity, type: ComponentType<T>, value: T): T {
    return this.storeFor(type).set(e, value);
  }

  remove<T>(e: Entity, type: ComponentType<T>): void {
    this.stores[type.id]?.remove(e);
  }

  get<T>(e: Entity, type: ComponentType<T>): T | undefined {
    return (this.stores[type.id] as ComponentStore<T> | undefined)?.get(e);
  }

  /** Get a component that is guaranteed present; throws in dev if missing. */
  getX<T>(e: Entity, type: ComponentType<T>): T {
    const v = this.get(e, type);
    if (v === undefined) throw new Error(`entity ${e} missing component ${type.name}`);
    return v;
  }

  has<T>(e: Entity, type: ComponentType<T>): boolean {
    return this.stores[type.id]?.has(e) ?? false;
  }

  count<T>(type: ComponentType<T>): number {
    return this.stores[type.id]?.size ?? 0;
  }

  store<T>(type: ComponentType<T>): ComponentStore<T> {
    return this.storeFor(type);
  }

  private smallest(types: ComponentType<unknown>[]): ComponentStore<unknown> | undefined {
    let best: ComponentStore<unknown> | undefined;
    for (const t of types) {
      const s = this.stores[t.id];
      if (!s) return undefined; // no entity can match
      if (!best || s.size < best.size) best = s;
    }
    return best;
  }

  *view1<A>(a: ComponentType<A>): Iterable<[Entity, A]> {
    const store = this.stores[a.id] as ComponentStore<A> | undefined;
    if (!store) return;
    const ids = store.owners.slice();
    for (const e of ids) {
      if (!this.aliveSet.has(e)) continue;
      const av = store.get(e);
      if (av !== undefined) yield [e, av];
    }
  }

  *view2<A, B>(a: ComponentType<A>, b: ComponentType<B>): Iterable<[Entity, A, B]> {
    const primary = this.smallest([a, b]);
    if (!primary) return;
    const sa = this.stores[a.id] as ComponentStore<A>;
    const sb = this.stores[b.id] as ComponentStore<B>;
    for (const e of primary.owners.slice()) {
      if (!this.aliveSet.has(e)) continue;
      const av = sa.get(e);
      if (av === undefined) continue;
      const bv = sb.get(e);
      if (bv === undefined) continue;
      yield [e, av, bv];
    }
  }

  *view3<A, B, C>(
    a: ComponentType<A>,
    b: ComponentType<B>,
    c: ComponentType<C>,
  ): Iterable<[Entity, A, B, C]> {
    const primary = this.smallest([a, b, c]);
    if (!primary) return;
    const sa = this.stores[a.id] as ComponentStore<A>;
    const sb = this.stores[b.id] as ComponentStore<B>;
    const sc = this.stores[c.id] as ComponentStore<C>;
    for (const e of primary.owners.slice()) {
      if (!this.aliveSet.has(e)) continue;
      const av = sa.get(e);
      if (av === undefined) continue;
      const bv = sb.get(e);
      if (bv === undefined) continue;
      const cv = sc.get(e);
      if (cv === undefined) continue;
      yield [e, av, bv, cv];
    }
  }

  /** Entities that currently have `type`, as a fresh array (safe to mutate over). */
  entitiesWith<T>(type: ComponentType<T>): Entity[] {
    const store = this.stores[type.id];
    return store ? store.owners.slice() : [];
  }

  flushDestroys(): void {
    if (this.destroyQueue.length === 0) return;
    for (const e of this.destroyQueue) {
      if (!this.aliveSet.delete(e)) continue;
      for (const store of this.stores) store?.remove(e);
    }
    this.destroyQueue.length = 0;
  }
}

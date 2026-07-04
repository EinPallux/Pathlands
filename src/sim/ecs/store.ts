// Sparse-set component storage. O(1) add/remove/has with dense, cache-friendly
// iteration (the storage model EnTT popularised). A pragmatic, high-performance
// choice for hundreds-to-thousands of entities; hot-column SoA is a later perf
// lever if profiling ever demands it (ARCHITECTURE.md §3).

export type Entity = number;
export const NO_ENTITY: Entity = 0;

let nextComponentId = 0;

export interface ComponentType<T> {
  readonly id: number;
  readonly name: string;
  /** Phantom marker for the stored type; never present at runtime. */
  readonly __t?: T;
}

/** Declare a component type. Ids are assigned in module-load order (stable). */
export function defineComponent<T>(name: string): ComponentType<T> {
  return { id: nextComponentId++, name };
}

export function componentTypeCount(): number {
  return nextComponentId;
}

export class ComponentStore<T> {
  /** Packed component values; parallel to `owners`. */
  readonly dense: T[] = [];
  /** Entity owning each dense slot; parallel to `dense`. */
  readonly owners: Entity[] = [];
  private readonly indexOf = new Map<Entity, number>();

  has(e: Entity): boolean {
    return this.indexOf.has(e);
  }

  get(e: Entity): T | undefined {
    const i = this.indexOf.get(e);
    return i === undefined ? undefined : this.dense[i];
  }

  /** Insert or overwrite the component for `e`; returns the stored value. */
  set(e: Entity, value: T): T {
    const i = this.indexOf.get(e);
    if (i !== undefined) {
      this.dense[i] = value;
      return value;
    }
    this.indexOf.set(e, this.dense.length);
    this.owners.push(e);
    this.dense.push(value);
    return value;
  }

  /** Swap-remove; returns true if the entity had this component. */
  remove(e: Entity): boolean {
    const i = this.indexOf.get(e);
    if (i === undefined) return false;
    const last = this.dense.length - 1;
    if (i !== last) {
      const movedOwner = this.owners[last]!;
      this.dense[i] = this.dense[last]!;
      this.owners[i] = movedOwner;
      this.indexOf.set(movedOwner, i);
    }
    this.dense.pop();
    this.owners.pop();
    this.indexOf.delete(e);
    return true;
  }

  get size(): number {
    return this.dense.length;
  }

  clear(): void {
    this.dense.length = 0;
    this.owners.length = 0;
    this.indexOf.clear();
  }
}

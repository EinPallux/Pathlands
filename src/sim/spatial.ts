import type { Entity } from './ecs/store.ts';
import { SPATIAL_CELL } from './constants.ts';

// Uniform-grid spatial hash for agent-agent collision and cone/circle hit
// queries (ARCHITECTURE.md §6). Rebuilt each tick from Transform+Collider.
// Deterministic: query callbacks receive entities in stable cell/insertion order.

interface Item {
  e: Entity;
  x: number;
  y: number;
  r: number;
}

export class SpatialHash {
  private readonly cells = new Map<number, Item[]>();
  private readonly cell: number;

  constructor(cell = SPATIAL_CELL) {
    this.cell = cell;
  }

  private key(cx: number, cy: number): number {
    // Pack two 16-bit-ish signed cell coords into one number key.
    return (cx + 32768) * 65536 + (cy + 32768);
  }

  clear(): void {
    this.cells.clear();
  }

  insert(e: Entity, x: number, y: number, r: number): void {
    const cx = Math.floor(x / this.cell);
    const cy = Math.floor(y / this.cell);
    const k = this.key(cx, cy);
    let arr = this.cells.get(k);
    if (!arr) {
      arr = [];
      this.cells.set(k, arr);
    }
    arr.push({ e, x, y, r });
  }

  /** Invoke `cb` for every entity whose collider overlaps the circle (x,y,radius). */
  queryCircle(x: number, y: number, radius: number, cb: (e: Entity, ex: number, ey: number, er: number) => void): void {
    const minCx = Math.floor((x - radius) / this.cell);
    const maxCx = Math.floor((x + radius) / this.cell);
    const minCy = Math.floor((y - radius) / this.cell);
    const maxCy = Math.floor((y + radius) / this.cell);
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const arr = this.cells.get(this.key(cx, cy));
        if (!arr) continue;
        for (const it of arr) {
          const dx = it.x - x;
          const dy = it.y - y;
          const rr = radius + it.r;
          if (dx * dx + dy * dy <= rr * rr) cb(it.e, it.x, it.y, it.r);
        }
      }
    }
  }

  /** Collect entities near a point (broad phase, no radius refinement). */
  collectNear(x: number, y: number, radius: number): Entity[] {
    const out: Entity[] = [];
    this.queryCircle(x, y, radius, (e) => out.push(e));
    return out;
  }
}

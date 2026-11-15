export interface GridItem {
  x: number;
  y: number;
}

/**
 * Uniform hash grid for broad-phase proximity queries on an unbounded plane.
 * Rebuilt every frame, so it only needs to be fast to fill and to query.
 */
export class SpatialGrid<T extends GridItem> {
  private readonly cells = new Map<number, T[]>();

  constructor(readonly cellSize: number) {}

  clear(): void {
    // Keep the bucket arrays to avoid reallocating them every frame, but drop
    // them all once the player has wandered across enough of the plane.
    if (this.cells.size > 4096) {
      this.cells.clear();
      return;
    }
    for (const bucket of this.cells.values()) bucket.length = 0;
  }

  insert(item: T): void {
    const key = this.key(Math.floor(item.x / this.cellSize), Math.floor(item.y / this.cellSize));
    const bucket = this.cells.get(key);
    if (bucket) bucket.push(item);
    else this.cells.set(key, [item]);
  }

  rebuild(items: Iterable<T>): void {
    this.clear();
    for (const item of items) this.insert(item);
  }

  /**
   * Visits every item in the 3x3 block of cells around a point, which covers
   * everything within one cell size of it. Return `true` to stop early.
   */
  forEachNear(x: number, y: number, visit: (item: T) => boolean | void): void {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    for (let gx = cx - 1; gx <= cx + 1; gx++) {
      for (let gy = cy - 1; gy <= cy + 1; gy++) {
        const bucket = this.cells.get(this.key(gx, gy));
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i++) {
          if (visit(bucket[i]) === true) return;
        }
      }
    }
  }

  private key(cx: number, cy: number): number {
    return ((cx & 0xffff) << 16) | (cy & 0xffff);
  }
}

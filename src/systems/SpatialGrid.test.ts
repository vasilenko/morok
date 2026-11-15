import { describe, expect, it } from 'vitest';
import { SpatialGrid } from './SpatialGrid';

const near = (grid: SpatialGrid<{ x: number; y: number; id: string }>, x: number, y: number) => {
  const found: string[] = [];
  grid.forEachNear(x, y, (item) => {
    found.push(item.id);
  });
  return found.sort();
};

describe('SpatialGrid', () => {
  it('finds items within one cell size of the query point', () => {
    const grid = new SpatialGrid<{ x: number; y: number; id: string }>(40);
    grid.rebuild([
      { x: 5, y: 5, id: 'same-cell' },
      { x: 45, y: -30, id: 'neighbour-cell' },
      { x: 200, y: 200, id: 'far' },
    ]);

    expect(near(grid, 10, 10)).toEqual(['neighbour-cell', 'same-cell']);
  });

  it('works across the origin with negative coordinates', () => {
    const grid = new SpatialGrid<{ x: number; y: number; id: string }>(40);
    grid.rebuild([
      { x: -1, y: -1, id: 'negative' },
      { x: 1, y: 1, id: 'positive' },
    ]);

    expect(near(grid, 0, 0)).toEqual(['negative', 'positive']);
  });

  it('forgets previous items on rebuild', () => {
    const grid = new SpatialGrid<{ x: number; y: number; id: string }>(40);
    grid.rebuild([{ x: 0, y: 0, id: 'old' }]);
    grid.rebuild([{ x: 0, y: 0, id: 'new' }]);

    expect(near(grid, 0, 0)).toEqual(['new']);
  });

  it('stops visiting when the callback returns true', () => {
    const grid = new SpatialGrid<{ x: number; y: number; id: string }>(40);
    grid.rebuild([
      { x: 0, y: 0, id: 'a' },
      { x: 1, y: 1, id: 'b' },
      { x: 2, y: 2, id: 'c' },
    ]);

    let visits = 0;
    grid.forEachNear(0, 0, () => {
      visits++;
      return true;
    });

    expect(visits).toBe(1);
  });
});

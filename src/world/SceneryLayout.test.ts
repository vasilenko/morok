import { describe, expect, it } from 'vitest';
import { closestOnEllipse } from './footprint';
import {
  SCENERY_CELL,
  SCENERY_KINDS,
  SCENERY_MARGIN,
  START_CLEAR_RADIUS,
  footprintOf,
  footprintsIn,
  sceneryInCell,
  type SceneryItem,
} from './SceneryLayout';

/** The view the density is tuned for, in world units. */
const VIEW = { width: 914, height: 514 };

/** All items in a square of cells centred on the origin. */
function itemsAround(seed: number, radius: number): SceneryItem[] {
  const items: SceneryItem[] = [];
  for (let cx = -radius; cx < radius; cx++) {
    for (let cy = -radius; cy < radius; cy++) {
      const item = sceneryInCell(cx, cy, seed);
      if (item) items.push(item);
    }
  }
  return items;
}

describe('sceneryInCell', () => {
  it('gives the same item for the same cell and seed', () => {
    for (let i = 0; i < 200; i++) {
      const cx = (i * 7) % 23 - 11;
      const cy = (i * 13) % 19 - 9;
      expect(sceneryInCell(cx, cy, 42)).toEqual(sceneryInCell(cx, cy, 42));
    }
  });

  it('lays out a different world for a different seed', () => {
    const layout = (seed: number) =>
      itemsAround(seed, 8).map(({ kind, x, y }) => `${kind.name}@${Math.round(x)},${Math.round(y)}`);
    const a = layout(1);
    const b = layout(2);
    expect(a).not.toEqual(b);
    const shared = a.filter((item) => b.includes(item));
    expect(shared.length).toBeLessThan(a.length / 10);
  });

  it('keeps the area around the start clear', () => {
    for (let seed = 0; seed < 300; seed++) {
      for (const { kind, x, y } of itemsAround(seed, 2)) {
        const dx = Math.max(x - kind.width / 2, 0, -(x + kind.width / 2));
        const dy = Math.max(y - kind.height, 0, -y);
        expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(START_CLEAR_RADIUS);
      }
    }
  });

  it('keeps every item inside the margins of its cell', () => {
    for (let seed = 0; seed < 20; seed++) {
      for (let cx = -15; cx < 15; cx++) {
        for (let cy = -15; cy < 15; cy++) {
          const item = sceneryInCell(cx, cy, seed);
          if (!item) continue;
          const { kind, x, y } = item;
          expect(x - kind.width / 2).toBeGreaterThanOrEqual(cx * SCENERY_CELL + SCENERY_MARGIN);
          expect(x + kind.width / 2).toBeLessThanOrEqual((cx + 1) * SCENERY_CELL - SCENERY_MARGIN);
          expect(y - kind.height).toBeGreaterThanOrEqual(cy * SCENERY_CELL + SCENERY_MARGIN);
          expect(y).toBeLessThanOrEqual((cy + 1) * SCENERY_CELL - SCENERY_MARGIN);
        }
      }
    }
  });

  it('fits every kind into a cell with its margins', () => {
    for (const kind of SCENERY_KINDS) {
      expect(kind.width + 2 * SCENERY_MARGIN).toBeLessThanOrEqual(SCENERY_CELL);
      expect(kind.height + 2 * SCENERY_MARGIN).toBeLessThanOrEqual(SCENERY_CELL);
    }
  });

  it('shows three to five items per view, as many puddles as standing props, and few ponds', () => {
    const radius = 100;
    const items = itemsAround(7, radius);
    const area = (2 * radius * SCENERY_CELL) ** 2;
    const perView = (items.length / area) * VIEW.width * VIEW.height;
    expect(perView).toBeGreaterThanOrEqual(3);
    expect(perView).toBeLessThanOrEqual(5);

    const flat = items.filter((item) => item.kind.flat).length;
    const ratio = flat / (items.length - flat);
    expect(ratio).toBeGreaterThan(0.8);
    expect(ratio).toBeLessThan(1.25);

    const ponds = items.filter((item) => item.kind.name === 'pond').length;
    expect(ponds / items.length).toBeGreaterThan(0.005);
    expect(ponds / items.length).toBeLessThan(0.05);
  });
});

describe('footprints', () => {
  const SOLID = ['sign-stone', 'tally-stone', 'mound', 'fire-pit', 'grave-pole'];

  it('belong to the standing objects only; bones and water are walked over', () => {
    for (const kind of SCENERY_KINDS) {
      expect(kind.footprint !== null).toBe(SOLID.includes(kind.name));
    }
    const bones = SCENERY_KINDS.find((kind) => kind.name === 'bones')!;
    expect(footprintOf({ kind: bones, x: 0, y: 0 })).toBeNull();
  });

  it('lie on the ground inside their image', () => {
    for (const kind of SCENERY_KINDS) {
      const f = footprintOf({ kind, x: 0, y: 0 });
      if (!f) continue;
      expect(f.x - f.rx).toBeGreaterThanOrEqual(-kind.width / 2);
      expect(f.x + f.rx).toBeLessThanOrEqual(kind.width / 2);
      expect(f.y - f.ry).toBeGreaterThanOrEqual(-kind.height);
      expect(f.y + f.ry).toBeLessThanOrEqual(0);
    }
  });

  it('stay clear of the start, where the hero stands', () => {
    for (let seed = 0; seed < 300; seed++) {
      for (const f of footprintsIn(-2 * SCENERY_CELL, -2 * SCENERY_CELL, 4 * SCENERY_CELL, 4 * SCENERY_CELL, seed)) {
        const edge = closestOnEllipse(f, 0, 0);
        expect(Math.hypot(edge.x, edge.y)).toBeGreaterThanOrEqual(START_CLEAR_RADIUS);
      }
    }
  });

  it('are found for every solid item in the cells a rectangle touches', () => {
    const seed = 5;
    const left = -700;
    const top = -500;
    const found = footprintsIn(left, top, 1400, 1000, seed);
    const expected = [];
    for (let cx = Math.floor(left / SCENERY_CELL); cx <= Math.floor(700 / SCENERY_CELL); cx++) {
      for (let cy = Math.floor(top / SCENERY_CELL); cy <= Math.floor(500 / SCENERY_CELL); cy++) {
        const item = sceneryInCell(cx, cy, seed);
        if (item?.kind.footprint) expected.push(footprintOf(item));
      }
    }
    expect(found.length).toBeGreaterThan(0);
    expect(found).toEqual(expected);
  });
});

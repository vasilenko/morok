import { describe, expect, it } from 'vitest';
import {
  backdropMask,
  cutOut,
  groundPoint,
  labelComponents,
  readingOrder,
  splitFigures,
  upperBodyAnchor,
} from './cutout.mjs';

const LIGHT = [253, 253, 253];
const INK = [20, 20, 20];
const config = { minLight: 236, maxSpread: 8, minPocket: 12 };
const edge = { band: 2, backdrop: 249, ink: 28, maxSpread: 28 };

/** An RGB image filled with the backdrop, drawn on with rectangles of colour. */
function sheet(width, height) {
  const data = Buffer.alloc(width * height * 3);
  const fill = (left, top, w, h, colour) => {
    for (let y = top; y < top + h; y++) {
      for (let x = left; x < left + w; x++) data.set(colour, (y * width + x) * 3);
    }
  };
  fill(0, 0, width, height, LIGHT);
  return { data, width, height, fill };
}

/** A dark ring of the given outer size with a light hole of holeW x holeH inside. */
function ring(image, left, top, w, h, holeW, holeH) {
  image.fill(left, top, w, h, INK);
  image.fill(left + 2, top + 2, holeW, holeH, LIGHT);
}

const at = ({ width }, x, y) => y * width + x;

describe('backdropMask', () => {
  it('removes the light area around the figure but keeps a small enclosed light patch', () => {
    const image = sheet(12, 12);
    ring(image, 3, 3, 6, 6, 2, 2); // a 4-pixel highlight, under minPocket
    const mask = backdropMask(image.data, 12, 12, 3, config);
    expect(mask[at(image, 0, 0)]).toBe(1);
    expect(mask[at(image, 11, 6)]).toBe(1);
    expect(mask[at(image, 3, 3)]).toBe(0); // ink
    expect(mask[at(image, 5, 5)]).toBe(0); // the highlight survives
  });

  it('removes an enclosed pocket of at least minPocket pixels', () => {
    const image = sheet(14, 14);
    ring(image, 2, 2, 10, 10, 4, 4); // a 16-pixel pocket, like the crook of a staff
    const mask = backdropMask(image.data, 14, 14, 3, config);
    expect(mask[at(image, 5, 5)]).toBe(1);
    expect(mask[at(image, 2, 2)]).toBe(0);
  });

  it('does not take light but coloured paint for backdrop', () => {
    const image = sheet(8, 8);
    image.fill(2, 2, 4, 4, [250, 235, 215]);
    const mask = backdropMask(image.data, 8, 8, 3, config);
    expect(mask[at(image, 3, 3)]).toBe(0);
  });
});

describe('cutOut', () => {
  it('turns grey outline pixels next to the backdrop into partly transparent ink', () => {
    const image = sheet(8, 3);
    image.fill(3, 0, 1, 3, [139, 139, 139]); // half way between ink and backdrop
    image.fill(4, 0, 4, 3, [180, 40, 40]); // red paint, not a blend
    const mask = backdropMask(image.data, 8, 3, 3, config);
    const rgba = cutOut(image.data, 8, 3, 3, mask, edge);
    const grey = at(image, 3, 1) * 4;
    expect(rgba[grey + 3]).toBeGreaterThan(120);
    expect(rgba[grey + 3]).toBeLessThan(135);
    expect(rgba[grey]).toBeLessThan(40); // the backdrop's share is taken out of the colour
    expect([...rgba.subarray(at(image, 5, 1) * 4, at(image, 5, 1) * 4 + 4)]).toEqual([180, 40, 40, 255]);
    expect(rgba[at(image, 0, 1) * 4 + 3]).toBe(0);
  });
});

describe('readingOrder', () => {
  it('orders figures row by row, then left to right', () => {
    const figures = [
      { name: 'b2', cx: 50, cy: 160 },
      { name: 'a1', cx: 10, cy: 52 },
      { name: 'b1', cx: 12, cy: 150 },
      { name: 'a2', cx: 48, cy: 47 },
    ];
    expect(readingOrder(figures, 40).map((f) => f.name)).toEqual(['a1', 'a2', 'b1', 'b2']);
  });
});

describe('splitFigures', () => {
  /** Opaque RGBA of the given size with solid rectangles. */
  function solid(width, height, rects) {
    const rgba = Buffer.alloc(width * height * 4);
    for (const [left, top, w, h] of rects) {
      for (let y = top; y < top + h; y++) {
        for (let x = left; x < left + w; x++) rgba.set([90, 60, 40, 255], (y * width + x) * 4);
      }
    }
    return rgba;
  }

  it('separates figures that overlap in x but do not touch', () => {
    // An L and a mirrored L hooked into each other: their columns overlap.
    const rgba = solid(20, 10, [
      [0, 0, 12, 3],
      [0, 0, 3, 10],
      [8, 7, 12, 3],
      [17, 0, 3, 10],
    ]);
    const { figures } = splitFigures(rgba, 20, 10, { minArea: 20, minSpeck: 2, rowGap: 100 });
    expect(figures).toHaveLength(2);
    expect(figures[0].right).toBeGreaterThan(figures[1].left);
    expect(figures[0].left).toBe(0);
    expect(figures[1].right).toBe(20);
  });

  it('attaches a loose bit to the nearest figure and drops lone specks', () => {
    const rgba = solid(30, 10, [
      [0, 0, 5, 10],
      [20, 0, 5, 10],
      [7, 4, 2, 2], // a tassel tip near the first figure
      [28, 0, 1, 1], // a single-pixel speck
    ]);
    const { figures, labels } = splitFigures(rgba, 30, 10, { minArea: 20, minSpeck: 2, rowGap: 100 });
    expect(figures[0].right).toBe(9);
    expect(figures[1].right).toBe(25);
    expect(figures.flatMap((f) => f.labels)).not.toContain(labels[28]);
  });
});

describe('upperBodyAnchor', () => {
  it('pins a figure by its top and the left edge of its upper half, whatever the legs do', () => {
    const width = 12;
    const mask = new Uint8Array(width * 10);
    const set = (left, top, w, h) => {
      for (let y = top; y < top + h; y++) for (let x = left; x < left + w; x++) mask[y * width + x] = 1;
    };
    set(4, 1, 4, 8); // body
    set(1, 7, 3, 2); // a leg stepping back, further left than the body
    const { labels, components } = labelComponents(mask, width, 10);
    const figure = { ...components[0], labels: [components[0].label] };
    expect(upperBodyAnchor(labels, width, figure)).toEqual({ x: 4, y: 1 });
  });
});

describe('groundPoint', () => {
  /** Transparent RGBA of the given size with rectangles of the given alpha. */
  function alphaImage(width, height, rects) {
    const rgba = Buffer.alloc(width * height * 4);
    for (const [left, top, w, h, alpha] of rects) {
      for (let y = top; y < top + h; y++) {
        for (let x = left; x < left + w; x++) rgba[(y * width + x) * 4 + 3] = alpha;
      }
    }
    return rgba;
  }

  it('stands under the mass of the body on the bottom edge of the lowest row', () => {
    // A heavy body over columns 2..5 and a thin leg reaching down at column 8.
    const rgba = alphaImage(10, 10, [
      [2, 0, 4, 6, 255],
      [8, 0, 1, 8, 255],
    ]);
    const point = groundPoint(rgba, 10, 10, 8);
    expect(point.y).toBe(8);
    // 24 pixels centred on 4 and 8 on 8.5: the middle of the mass, not of the bounds.
    expect(point.x).toBeCloseTo((24 * 4 + 8 * 8.5) / 32);
  });

  it('ignores faint pixels below the feet when finding the ground', () => {
    const rgba = alphaImage(4, 6, [
      [0, 0, 4, 3, 255],
      [0, 5, 4, 1, 5],
    ]);
    expect(groundPoint(rgba, 4, 6, 8).y).toBe(3);
  });
});

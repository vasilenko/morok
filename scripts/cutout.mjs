/**
 * Cutting figures out of a sprite sheet drawn on a plain light backdrop.
 *
 * Generated sheets come without transparency: the figures stand on a flat
 * near-white ground and have a dark outline all round. The backdrop is the
 * light, neutral area connected to the image border, plus the light pockets
 * it leaves inside closed loops (the crook of a staff, between arm and
 * body). Along the outline, pixels are a blend of dark ink and backdrop and
 * are turned into partial alpha. The remaining solid shapes are labelled
 * into figures and ordered as they are read: row by row, left to right.
 *
 * Masks are Uint8Arrays with one byte per pixel, 1 for set.
 */

/**
 * @typedef {object} BackdropConfig
 * @property {number} minLight Smallest channel value of a backdrop pixel.
 * @property {number} maxSpread Largest difference between channels of a backdrop pixel.
 * @property {number} minPocket Enclosed light areas of at least this many pixels are backdrop too.
 */

/**
 * @typedef {object} Component
 * @property {number} label Value of this component in the label image, from 1.
 * @property {number} area Pixel count.
 * @property {number} left
 * @property {number} top
 * @property {number} right One past the rightmost column.
 * @property {number} bottom One past the lowest row.
 * @property {number} cx Mean column.
 * @property {number} cy Mean row.
 */

/** Pixels light and neutral enough to be the backdrop, whatever their position. */
export function lightMask(data, width, height, channels, { minLight, maxSpread }) {
  const mask = new Uint8Array(width * height);
  for (let p = 0; p < mask.length; p++) {
    const i = p * channels;
    const lo = Math.min(data[i], data[i + 1], data[i + 2]);
    const hi = Math.max(data[i], data[i + 1], data[i + 2]);
    if (lo >= minLight && hi - lo <= maxSpread) mask[p] = 1;
  }
  return mask;
}

/**
 * Labels the 4-connected areas of a mask. Returns the label image (0 where
 * the mask is clear) and one Component per area, in scan order of their
 * first pixel.
 */
export function labelComponents(mask, width, height) {
  const labels = new Int32Array(width * height);
  const components = [];
  const stack = new Int32Array(width * height);
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || labels[start]) continue;
    const label = components.length + 1;
    const c = { label, area: 0, left: width, top: height, right: 0, bottom: 0, cx: 0, cy: 0 };
    let size = 0;
    stack[size++] = start;
    labels[start] = label;
    while (size > 0) {
      const p = stack[--size];
      const x = p % width;
      const y = (p - x) / width;
      c.area++;
      c.cx += x;
      c.cy += y;
      if (x < c.left) c.left = x;
      if (x >= c.right) c.right = x + 1;
      if (y < c.top) c.top = y;
      if (y >= c.bottom) c.bottom = y + 1;
      if (x > 0 && mask[p - 1] && !labels[p - 1]) (labels[p - 1] = label), (stack[size++] = p - 1);
      if (x < width - 1 && mask[p + 1] && !labels[p + 1]) (labels[p + 1] = label), (stack[size++] = p + 1);
      if (y > 0 && mask[p - width] && !labels[p - width]) (labels[p - width] = label), (stack[size++] = p - width);
      if (y < height - 1 && mask[p + width] && !labels[p + width]) (labels[p + width] = label), (stack[size++] = p + width);
    }
    c.cx /= c.area;
    c.cy /= c.area;
    components.push(c);
  }
  return { labels, components };
}

/**
 * The backdrop: light pixels connected to the image border, plus enclosed
 * light pockets of at least minPocket pixels. Smaller enclosed light
 * patches are painted highlights (a glint in an eye, a bead) and stay.
 */
export function backdropMask(data, width, height, channels, config) {
  const light = lightMask(data, width, height, channels, config);
  const { labels, components } = labelComponents(light, width, height);
  const isBackdrop = new Uint8Array(components.length + 1);
  for (const c of components) {
    const touchesBorder = c.left === 0 || c.top === 0 || c.right === width || c.bottom === height;
    if (touchesBorder || c.area >= config.minPocket) isBackdrop[c.label] = 1;
  }
  const mask = new Uint8Array(width * height);
  for (let p = 0; p < mask.length; p++) mask[p] = isBackdrop[labels[p]];
  return mask;
}

/** Pixels within `radius` steps (in x and y alike) of a set pixel. */
export function dilate(mask, width, height, radius) {
  const rows = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const from = Math.max(0, x - radius);
      const to = Math.min(width - 1, x + radius);
      for (let k = from; k <= to; k++) {
        if (mask[y * width + k]) {
          rows[y * width + x] = 1;
          break;
        }
      }
    }
  }
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) {
    const from = Math.max(0, y - radius);
    const to = Math.min(height - 1, y + radius);
    for (let x = 0; x < width; x++) {
      for (let k = from; k <= to; k++) {
        if (rows[k * width + x]) {
          out[y * width + x] = 1;
          break;
        }
      }
    }
  }
  return out;
}

/**
 * @typedef {object} EdgeConfig
 * @property {number} band Width of the soft edge next to the backdrop, in pixels.
 * @property {number} backdrop Brightness of the backdrop the edge blends into.
 * @property {number} ink Brightness of the outline the edge blends from.
 * @property {number} maxSpread Edge pixels with a larger channel spread are paint, not a blend.
 */

/**
 * Straight RGBA pixels with the backdrop cleared. Within `band` pixels of
 * the backdrop, neutral pixels are taken as a mix of dark ink and backdrop:
 * their brightness gives the alpha and the backdrop's share is removed from
 * their colour, so the outline keeps its weight on any ground without a
 * light fringe.
 */
export function cutOut(data, width, height, channels, backdrop, edge) {
  const near = dilate(backdrop, width, height, edge.band);
  const out = Buffer.alloc(width * height * 4);
  for (let p = 0; p < backdrop.length; p++) {
    if (backdrop[p]) continue;
    const i = p * channels;
    const o = p * 4;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const hi = Math.max(r, g, b);
    if (!near[p] || hi - Math.min(r, g, b) > edge.maxSpread) {
      out.set([r, g, b, 255], o);
      continue;
    }
    const alpha = Math.min(1, Math.max(0, (edge.backdrop - hi) / (edge.backdrop - edge.ink)));
    if (alpha === 0) continue;
    const unblend = (v) => Math.round(Math.min(255, Math.max(0, (v - (1 - alpha) * edge.backdrop) / alpha)));
    out.set([unblend(r), unblend(g), unblend(b), Math.round(alpha * 255)], o);
  }
  return out;
}

/**
 * Figures in reading order: grouped into rows by their vertical centre (a
 * figure more than `rowGap` below the first one of a row starts the next
 * row), each row left to right.
 */
export function readingOrder(figures, rowGap) {
  const byHeight = [...figures].sort((a, b) => a.cy - b.cy);
  const rows = [];
  for (const figure of byHeight) {
    const row = rows.at(-1);
    if (row && figure.cy - row[0].cy <= rowGap) row.push(figure);
    else rows.push([figure]);
  }
  return rows.flatMap((row) => row.sort((a, b) => a.cx - b.cx));
}

/**
 * @typedef {object} SplitConfig
 * @property {number} minArea Components of at least this many pixels are figures.
 * @property {number} minSpeck Smaller loose components are backdrop noise and are dropped.
 * @property {number} rowGap See readingOrder.
 */

/**
 * Splits the opaque pixels of a cut-out sheet into figures, in reading
 * order. A loose bit between minSpeck and minArea pixels (a tassel tip, the
 * end of an antler) joins the figure whose centre is nearest; anything
 * smaller is a faint backdrop pixel that just missed the lightness test, and
 * is left out. Returns the label image and, per figure, the labels it owns
 * and its bounds.
 */
export function splitFigures(rgba, width, height, { minArea, minSpeck, rowGap }) {
  const solid = new Uint8Array(width * height);
  for (let p = 0; p < solid.length; p++) solid[p] = rgba[p * 4 + 3] > 0 ? 1 : 0;
  const { labels, components } = labelComponents(solid, width, height);
  const figures = readingOrder(
    components.filter((c) => c.area >= minArea),
    rowGap,
  ).map((c) => ({ ...c, labels: [c.label] }));
  if (figures.length === 0) throw new Error('no figure found');

  for (const c of components.filter((c) => c.area >= minSpeck && c.area < minArea)) {
    const distance = (f) => (f.cx - c.cx) ** 2 + (f.cy - c.cy) ** 2;
    const owner = figures.reduce((best, f) => (distance(f) < distance(best) ? f : best));
    owner.labels.push(c.label);
    owner.left = Math.min(owner.left, c.left);
    owner.top = Math.min(owner.top, c.top);
    owner.right = Math.max(owner.right, c.right);
    owner.bottom = Math.max(owner.bottom, c.bottom);
  }
  return { labels, figures };
}

/**
 * Where a figure is pinned when frames are stacked: its top row and the
 * leftmost column of its upper half. In a walk cycle only the legs and the
 * hem move, so this point stays on the same part of the body in every
 * frame, where the bottom or the full width would follow the feet.
 */
export function upperBodyAnchor(labels, width, figure) {
  const owned = new Set(figure.labels);
  const middle = figure.top + Math.ceil((figure.bottom - figure.top) / 2);
  let left = figure.right;
  for (let y = figure.top; y < middle; y++) {
    for (let x = figure.left; x < left; x++) {
      if (owned.has(labels[y * width + x])) {
        left = x;
        break;
      }
    }
  }
  return { x: left, y: figure.top };
}

/**
 * The point on the ground under a figure, in pixels of its RGBA image: the
 * alpha-weighted mean column, so the body's mass stands over it whatever
 * the limbs do, on the lowest row with a pixel above `minAlpha`, where the
 * feet meet the ground. Poses of different sizes stacked on this point
 * stand on the same spot.
 */
export function groundPoint(rgba, width, height, minAlpha) {
  let sum = 0;
  let weight = 0;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = rgba[(y * width + x) * 4 + 3];
      sum += x * alpha;
      weight += alpha;
      if (alpha > minAlpha) bottom = y;
    }
  }
  if (bottom < 0) throw new Error('image is fully transparent');
  // The middle of the column, and the bottom edge of the lowest row.
  return { x: sum / weight + 0.5, y: bottom + 1 };
}

/**
 * One figure copied out of the cut-out sheet onto a transparent RGBA canvas
 * of the given size, with its anchor at `at`. Pixels of other figures that
 * reach into its bounds are left out.
 */
export function isolateFigure(rgba, labels, width, figure, anchor, canvas, at) {
  const owned = new Set(figure.labels);
  const out = Buffer.alloc(canvas.width * canvas.height * 4);
  const dx = at.x - anchor.x;
  const dy = at.y - anchor.y;
  for (let y = figure.top; y < figure.bottom; y++) {
    for (let x = figure.left; x < figure.right; x++) {
      const p = y * width + x;
      if (!owned.has(labels[p])) continue;
      const tx = x + dx;
      const ty = y + dy;
      if (tx < 0 || ty < 0 || tx >= canvas.width || ty >= canvas.height) throw new Error('figure outside its canvas');
      rgba.copy(out, (ty * canvas.width + tx) * 4, p * 4, p * 4 + 4);
    }
  }
  return out;
}

/**
 * Sheets drawn as a grid of framed cells: every pose in a cell of its own,
 * drawn round in a thin light-grey line, with a grey number in a corner and
 * the pose standing on a thin black ground line. The cells of a row need
 * not be as wide as those of another, so the frames are found, not
 * assumed.
 */

/**
 * @typedef {object} FrameConfig
 * @property {number} minLight Darkest grey of a frame line, its antialiased fringe included.
 * @property {number} maxLight Lightest such grey; anything lighter is backdrop.
 * @property {number} maxSpread Largest difference between channels of a frame pixel.
 * @property {number} minShare A line of pixels at least this share of frame grey is a frame.
 * @property {number} minCell Spans between frames no wider than this are gaps between doubled lines, not cells.
 */

/** Whether the pixel at `i` is the grey of a frame line. */
function isFrameGrey(data, i, { minLight, maxLight, maxSpread }) {
  const lo = Math.min(data[i], data[i + 1], data[i + 2]);
  const hi = Math.max(data[i], data[i + 1], data[i + 2]);
  return lo >= minLight && hi <= maxLight && hi - lo <= maxSpread;
}

/**
 * The spans between frame lines along one axis: `isLine(k)` says whether
 * line k (a row or a column) is a frame. Each span runs from just after one
 * frame to just before the next, the image's edges counting as frames;
 * spans no wider than `minSpan` are left out (see FrameConfig.minCell).
 */
function spansBetween(count, isLine, minSpan) {
  const spans = [];
  let start = 0;
  for (let k = 0; k <= count; k++) {
    if (k < count && !isLine(k)) continue;
    if (k - start > minSpan) spans.push({ from: start, to: k });
    start = k + 1;
  }
  return spans;
}

/**
 * The insides of the framed cells of a sheet, in reading order: row by row
 * from the top, each row left to right. A row of the image is a frame when
 * at least `minShare` of it is frame grey; within a band of cells, so is a
 * column. Each cell is given as { left, top, width, height } of the pixels
 * inside its frame, the frame's fringe excluded.
 */
export function findCells(data, width, height, channels, config) {
  const minSpan = config.minCell;
  const share = (count, at) => {
    let grey = 0;
    for (let k = 0; k < count; k++) if (isFrameGrey(data, at(k), config)) grey++;
    return grey / count;
  };
  const bands = spansBetween(
    height,
    (y) => share(width, (x) => (y * width + x) * channels) >= config.minShare,
    minSpan,
  );
  const cells = [];
  for (const band of bands) {
    const rows = band.to - band.from;
    const columns = spansBetween(
      width,
      (x) => share(rows, (k) => ((band.from + k) * width + x) * channels) >= config.minShare,
      minSpan,
    );
    for (const column of columns) {
      cells.push({ left: column.from, top: band.from, width: column.to - column.from, height: rows });
    }
  }
  return cells;
}

/** The RGB(A) pixels of a rectangle of an image, as an image of their own. */
export function crop(data, width, channels, { left, top, width: w, height: h }) {
  const out = Buffer.alloc(w * h * channels);
  for (let y = 0; y < h; y++) {
    const from = ((top + y) * width + left) * channels;
    data.copy(out, y * w * channels, from, from + w * channels);
  }
  return out;
}

/**
 * Clears the drawn parts of a cut-out cell that hold no ink: the cell's
 * number, drawn in grey without an outline. Every inked part of a pose has
 * some pixel at least as dark as `maxInk` in its darkest channel, even a
 * falling drop of water; the number has none. `source` is the cell's
 * pixels before cutting, whose colours the cut has not unblended.
 */
export function clearUninked(rgba, source, width, height, channels, maxInk) {
  const solid = new Uint8Array(width * height);
  for (let p = 0; p < solid.length; p++) solid[p] = rgba[p * 4 + 3] > 0 ? 1 : 0;
  const { labels, components } = labelComponents(solid, width, height);
  const inked = new Uint8Array(components.length + 1);
  for (let p = 0; p < solid.length; p++) {
    if (!labels[p]) continue;
    const i = p * channels;
    if (Math.min(source[i], source[i + 1], source[i + 2]) <= maxInk) inked[labels[p]] = 1;
  }
  for (let p = 0; p < solid.length; p++) {
    if (labels[p] && !inked[labels[p]]) rgba.fill(0, p * 4, p * 4 + 4);
  }
}

/**
 * @typedef {object} GroundLineConfig
 * @property {number} minRun A row with a run of ink at least this share of the cell wide is the ground line.
 * @property {number} ink Brightest channel of an ink pixel, after the cut has unblended it.
 */

/**
 * Takes the ground line out from under a pose in a cut-out cell. The line
 * is a long, thin, perfectly horizontal run of ink near the bottom: the
 * lowest band of rows that each hold an unbroken run of ink at least
 * `minRun` of the cell wide. It is cleared in every column where nothing
 * of the pose stands on it, that is where the pixel just above the band is
 * less than half opaque. Under the feet the band is kept, as the soles'
 * outline it has merged into, so the feet lose nothing; nor does anything
 * lying on the line, a trailing rope or a hand flat on the ground. Returns
 * the band's rows, or null when the cell has no ground line.
 */
export function removeGroundLine(rgba, width, height, { minRun, ink }) {
  const isInk = (p) => rgba[p * 4 + 3] > 0 && Math.max(rgba[p * 4], rgba[p * 4 + 1], rgba[p * 4 + 2]) <= ink;
  const longestRun = (y) => {
    let best = 0;
    let run = 0;
    for (let x = 0; x < width; x++) {
      run = isInk(y * width + x) ? run + 1 : 0;
      best = Math.max(best, run);
    }
    return best;
  };
  const isLine = (y) => longestRun(y) >= minRun * width;

  let bottom = height - 1;
  while (bottom >= 0 && !isLine(bottom)) bottom--;
  if (bottom < 0) return null;
  let top = bottom;
  while (top > 0 && isLine(top - 1)) top--;

  for (let x = 0; x < width; x++) {
    if (top > 0 && rgba[((top - 1) * width + x) * 4 + 3] >= 128) continue;
    for (let y = top; y <= bottom; y++) rgba.fill(0, (y * width + x) * 4, (y * width + x) * 4 + 4);
  }
  return { top, bottom };
}

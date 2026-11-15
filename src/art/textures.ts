import Phaser from 'phaser';

/**
 * Placeholder art, drawn with the 2D canvas API at boot and registered as
 * Phaser textures. Swap these for real assets by loading images under the
 * same keys.
 */

/** Sprites are drawn at this multiple of their world size so they stay sharp when zoomed. */
export const ART_SCALE = 3;
/** The ground tile is large, so it gets a smaller oversampling factor. */
export const GROUND_ART_SCALE = 2;
/** Side of the repeating ground tile, in world units. */
export const GROUND_TILE = 1024;

export const TEX = {
  navia: 'navia',
  volhv: 'volhv',
  stake: 'stake',
  shadow: 'shadow',
  dot: 'dot',
  light: 'light',
  ground: 'ground',
  fog: 'fog',
  hurt: 'hurt',
} as const;

export const ANIM = {
  naviaSway: 'navia-sway',
} as const;

const TAU = Math.PI * 2;
const OUTLINE = '#07090b';
const BONE = '#d9cfb4';

type Ctx = CanvasRenderingContext2D;

function makeCanvas(width: number, height: number, scale: number): { canvas: HTMLCanvasElement; g: Ctx } {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const g = canvas.getContext('2d')!;
  g.scale(scale, scale);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  return { canvas, g };
}

const line = (g: Ctx, x1: number, y1: number, x2: number, y2: number) => {
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.stroke();
};
const disc = (g: Ctx, x: number, y: number, r: number) => {
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
};
const oval = (g: Ctx, x: number, y: number, rx: number, ry: number) => {
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, TAU);
  g.fill();
};

// ── Navia: a pale shroud with hollow eyes ──────────────────────────────────

/** Hem offsets for the sway animation frames. */
const NAVIA_SWAYS = [-1.6, 0, 1.6, 0];
/** Frame cell: a 30x40 figure with a 1px gutter so frames do not bleed. */
const NAVIA_FRAME = { width: 32, height: 42 };

function drawNavia(g: Ctx, sway: number): void {
  const cx = 15;
  const shroud = new Path2D();
  shroud.moveTo(cx - 6, 10);
  shroud.bezierCurveTo(cx - 7, 1.5, cx + 7, 1.5, cx + 6, 10);
  shroud.bezierCurveTo(cx + 11, 14, cx + 11, 25, cx + 10 + sway, 36);
  shroud.lineTo(cx + 6 + sway, 31);
  shroud.lineTo(cx + 3 + sway, 37.5);
  shroud.lineTo(cx + sway * 0.5, 32);
  shroud.lineTo(cx - 3 + sway, 38);
  shroud.lineTo(cx - 6 + sway, 32);
  shroud.lineTo(cx - 10 + sway, 36);
  shroud.bezierCurveTo(cx - 11, 25, cx - 11, 14, cx - 6, 10);
  shroud.closePath();

  g.strokeStyle = OUTLINE;
  g.lineWidth = 3;
  g.stroke(shroud);
  const cloth = g.createLinearGradient(0, 3, 0, 38);
  cloth.addColorStop(0, '#e6eef1');
  cloth.addColorStop(0.55, '#b4c9d5');
  cloth.addColorStop(1, '#6c8898');
  g.fillStyle = cloth;
  g.fill(shroud);

  // folds
  g.strokeStyle = 'rgba(25,45,58,0.4)';
  g.lineWidth = 1;
  line(g, cx - 4, 19, cx - 5 + sway * 0.6, 30);
  line(g, cx + 4, 19, cx + 5 + sway * 0.6, 30);

  // eyes and mouth
  g.fillStyle = OUTLINE;
  oval(g, cx - 2.7, 9.6, 1.6, 2.3);
  oval(g, cx + 2.7, 9.6, 1.6, 2.3);
  oval(g, cx, 15, 1.3, 2.5);
}

function createNavia(textures: Phaser.Textures.TextureManager): void {
  const { width, height } = NAVIA_FRAME;
  const { canvas, g } = makeCanvas(width * NAVIA_SWAYS.length, height, ART_SCALE);
  NAVIA_SWAYS.forEach((sway, i) => {
    g.save();
    g.translate(i * width + 1, 1);
    drawNavia(g, sway);
    g.restore();
  });
  const texture = textures.addCanvas(TEX.navia, canvas)!;
  NAVIA_SWAYS.forEach((_, i) => {
    texture.add(i, 0, i * width * ART_SCALE, 0, width * ART_SCALE, height * ART_SCALE);
  });
}

// ── Volhv: hides, antlers, a staff with a skull and red thread ─────────────

function drawVolhv(g: Ctx): void {
  const bone = (x1: number, y1: number, x2: number, y2: number) => {
    g.strokeStyle = OUTLINE;
    g.lineWidth = 3.6;
    line(g, x1, y1, x2, y2);
    g.strokeStyle = BONE;
    g.lineWidth = 1.7;
    line(g, x1, y1, x2, y2);
  };

  // antlers
  bone(14, 8, 10, 1.5);
  bone(12, 5, 8, 5.5);
  bone(21, 8, 24.5, 1.5);
  bone(23, 4.5, 26, 5.5);

  // hide cloak
  const cloak = new Path2D();
  cloak.moveTo(10.5, 20);
  cloak.quadraticCurveTo(17.5, 15, 24.5, 20);
  cloak.lineTo(28.5, 44);
  cloak.quadraticCurveTo(17.5, 47.5, 6, 44);
  cloak.closePath();
  g.strokeStyle = OUTLINE;
  g.lineWidth = 3;
  g.stroke(cloak);
  g.fillStyle = '#3d2b1f';
  g.fill(cloak);
  g.strokeStyle = '#5d4430';
  g.lineWidth = 1.4;
  for (let i = 0; i < 5; i++) {
    const upper = (i % 2) * 2.5;
    const lower = ((i + 1) % 2) * 2.5;
    line(g, 10 + i * 3.6, 27 + upper, 9.4 + i * 3.6, 31.5 + upper);
    line(g, 9 + i * 4.2, 36 + lower, 8.4 + i * 4.2, 40.5 + lower);
  }

  // fur collar
  g.fillStyle = OUTLINE;
  oval(g, 17.5, 20.5, 9.6, 4.6);
  g.fillStyle = '#8a6a48';
  oval(g, 17.5, 20.5, 8.4, 3.4);

  // head and hood
  g.fillStyle = OUTLINE;
  disc(g, 17.5, 13, 6.4);
  g.fillStyle = '#c9b99c';
  disc(g, 17.5, 13, 5.1);
  g.fillStyle = '#2a1e16';
  g.beginPath();
  g.arc(17.5, 12.2, 5.5, Math.PI, 0);
  g.closePath();
  g.fill();

  // beard
  g.fillStyle = '#c4bfb4';
  g.beginPath();
  g.moveTo(13.4, 15);
  g.lineTo(21.6, 15);
  g.lineTo(18.6, 25);
  g.lineTo(16.4, 25);
  g.closePath();
  g.fill();

  // eyes
  g.fillStyle = '#e0a03a';
  disc(g, 16, 13.5, 1);
  disc(g, 19.7, 13.5, 1);

  // staff with a skull
  g.strokeStyle = OUTLINE;
  g.lineWidth = 4.6;
  line(g, 30, 45, 30, 10);
  g.strokeStyle = '#6b4f36';
  g.lineWidth = 2.2;
  line(g, 30, 45, 30, 10);
  g.fillStyle = OUTLINE;
  disc(g, 30, 7, 4.8);
  g.fillStyle = BONE;
  disc(g, 30, 7, 3.5);
  g.fillStyle = OUTLINE;
  disc(g, 28.7, 6.6, 0.95);
  disc(g, 31.3, 6.6, 0.95);

  // red thread
  g.strokeStyle = '#c0282d';
  g.lineWidth = 1.7;
  line(g, 28.4, 12.5, 31.6, 14);
  line(g, 28.4, 15, 31.6, 16.5);
  line(g, 31.2, 16.5, 33, 22);

  // hand
  g.fillStyle = OUTLINE;
  disc(g, 29.5, 28, 3);
  g.fillStyle = '#c9b99c';
  disc(g, 29.5, 28, 1.9);
}

function createVolhv(textures: Phaser.Textures.TextureManager): void {
  // A 36x48 figure facing right, with a 1px gutter.
  const { canvas, g } = makeCanvas(38, 50, ART_SCALE);
  g.translate(1, 1);
  drawVolhv(g);
  textures.addCanvas(TEX.volhv, canvas);
}

// ── Small props ────────────────────────────────────────────────────────────

/** Aspen stake, pointing right. 30x9 with the grip 14 units from the left. */
function createStake(textures: Phaser.Textures.TextureManager): void {
  const { canvas, g } = makeCanvas(30, 9, ART_SCALE);
  g.translate(14, 4.5);
  g.fillStyle = OUTLINE;
  g.beginPath();
  g.moveTo(-13, -3.5);
  g.lineTo(5, -3.5);
  g.lineTo(15, 0);
  g.lineTo(5, 3.5);
  g.lineTo(-13, 3.5);
  g.closePath();
  g.fill();
  g.fillStyle = '#e2d3ac';
  g.beginPath();
  g.moveTo(-11, -1.6);
  g.lineTo(5, -1.6);
  g.lineTo(12, 0);
  g.lineTo(5, 1.6);
  g.lineTo(-11, 1.6);
  g.closePath();
  g.fill();
  textures.addCanvas(TEX.stake, canvas);
}

/** Soft blob shadow, tinted and faded by whoever uses it. */
function createShadow(textures: Phaser.Textures.TextureManager): void {
  const { canvas, g } = makeCanvas(28, 10, ART_SCALE);
  g.fillStyle = '#000000';
  oval(g, 14, 5, 13, 4.5);
  textures.addCanvas(TEX.shadow, canvas);
}

/** White disc used for particles; 32px across. */
function createDot(textures: Phaser.Textures.TextureManager): void {
  const { canvas, g } = makeCanvas(32, 32, 1);
  g.fillStyle = '#ffffff';
  disc(g, 16, 16, 15);
  textures.addCanvas(TEX.dot, canvas);
}

function createRadial(
  textures: Phaser.Textures.TextureManager,
  key: string,
  innerRadius: number,
  stops: Array<[number, string]>,
): void {
  const size = 512;
  const half = size / 2;
  const { canvas, g } = makeCanvas(size, size, 1);
  const gradient = g.createRadialGradient(half, half, half * innerRadius, half, half, half);
  for (const [offset, color] of stops) gradient.addColorStop(offset, color);
  g.fillStyle = gradient;
  g.fillRect(0, 0, size, size);
  textures.addCanvas(key, canvas);
}

// ── Ground: a seamless tile of soil, grass, stones, bones and fallen crosses ─

function hash(x: number, y: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function createGround(textures: Phaser.Textures.TextureManager): void {
  const T = GROUND_TILE;
  const { canvas, g } = makeCanvas(T, T, GROUND_ART_SCALE);
  // Everything is drawn nine times, shifted by one tile in each direction,
  // so that shapes crossing an edge continue on the opposite side.
  const SHIFTS = [-T, 0, T];

  g.fillStyle = '#15120e';
  g.fillRect(0, 0, T, T);

  // damp and dry soil patches
  const B = 256;
  for (let bx = 0; bx < T / B; bx++) {
    for (let by = 0; by < T / B; by++) {
      const r = hash(bx * 3 + 1, by * 7 + 5);
      const x = bx * B + hash(bx, by + 99) * B;
      const y = by * B + hash(bx + 57, by) * B;
      g.fillStyle = r < 0.5 ? 'rgba(0,0,0,0.13)' : 'rgba(52,43,31,0.15)';
      for (const sx of SHIFTS) {
        for (const sy of SHIFTS) {
          g.beginPath();
          g.ellipse(x + sx, y + sy, 90 + r * 90, 50 + r * 50, r * 3, 0, TAU);
          g.fill();
        }
      }
    }
  }

  const grass = new Path2D();
  const stones = new Path2D();
  const bones = new Path2D();
  const crosses: Array<{ x: number; y: number; angle: number }> = [];

  const C = 64;
  for (let cx = 0; cx < T / C; cx++) {
    for (let cy = 0; cy < T / C; cy++) {
      const r = hash(cx, cy);
      const baseX = cx * C + hash(cx + 11, cy) * C;
      const baseY = cy * C + hash(cx, cy + 17) * C;
      for (const sx of SHIFTS) {
        for (const sy of SHIFTS) {
          const x = baseX + sx;
          const y = baseY + sy;
          if (r < 0.5) {
            grass.moveTo(x, y);
            grass.lineTo(x - 3.5, y - 6);
            grass.moveTo(x, y);
            grass.lineTo(x + 0.5, y - 8.5);
            grass.moveTo(x, y);
            grass.lineTo(x + 4, y - 5.5);
          } else if (r < 0.66) {
            stones.moveTo(x + 4 + r * 5, y);
            stones.ellipse(x, y, 4 + r * 5, 3 + r * 3, 0, 0, TAU);
          } else if (r < 0.7) {
            bones.moveTo(x - 6, y - 2);
            bones.lineTo(x + 6, y + 2);
            bones.moveTo(x - 3, y + 4);
            bones.lineTo(x + 4, y - 4);
          } else if (r < 0.715) {
            crosses.push({ x, y, angle: hash(cx + 5, cy + 5) * TAU });
          }
        }
      }
    }
  }

  g.strokeStyle = '#2a3523';
  g.lineWidth = 1.6;
  g.stroke(grass);
  g.fillStyle = '#2b2722';
  g.fill(stones);
  g.strokeStyle = 'rgba(217,207,180,0.32)';
  g.lineWidth = 2;
  g.stroke(bones);

  // fallen roofed grave crosses
  g.strokeStyle = '#33271c';
  g.lineWidth = 4;
  for (const cross of crosses) {
    g.save();
    g.translate(cross.x, cross.y);
    g.rotate(cross.angle);
    g.beginPath();
    g.moveTo(0, 16);
    g.lineTo(0, -16);
    g.moveTo(-9, -6);
    g.lineTo(9, -6);
    g.moveTo(-7, -11);
    g.lineTo(0, -17);
    g.lineTo(7, -11);
    g.stroke();
    g.restore();
  }

  textures.addCanvas(TEX.ground, canvas);
}

// ── Public API ─────────────────────────────────────────────────────────────

export function createTextures(textures: Phaser.Textures.TextureManager): void {
  createNavia(textures);
  createVolhv(textures);
  createStake(textures);
  createShadow(textures);
  createDot(textures);
  createGround(textures);

  // Warm glow on the ground around the hero.
  createRadial(textures, TEX.light, 0, [
    [0, 'rgba(224,160,58,0.16)'],
    [1, 'rgba(224,160,58,0)'],
  ]);
  // Fog closing in from the edges of the view.
  createRadial(textures, TEX.fog, 0.24, [
    [0, 'rgba(15,21,21,0)'],
    [0.45, 'rgba(15,21,21,0.28)'],
    [0.8, 'rgba(13,18,18,0.82)'],
    [1, 'rgba(10,14,14,0.98)'],
  ]);
  // Red vignette flashed when the hero is hit.
  createRadial(textures, TEX.hurt, 0.3, [
    [0, 'rgba(179,38,43,0)'],
    [1, 'rgba(179,38,43,0.75)'],
  ]);
}

export function createAnimations(anims: Phaser.Animations.AnimationManager): void {
  anims.create({
    key: ANIM.naviaSway,
    frames: NAVIA_SWAYS.map((_, frame) => ({ key: TEX.navia, frame })),
    frameRate: 5,
    repeat: -1,
  });
}

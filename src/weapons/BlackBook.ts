import Phaser from 'phaser';
import { bandRows, pulse, SIGN_LIGHT, signPixels } from '../art/signs';
import { ART_SCALE, SIGN_FRAMES, signGlowFrame, signRaysFrame, TEX } from '../art/textures';
import { CFG } from '../config';
import type { Horde } from '../entities/Horde';
import type { Fx } from '../fx/Fx';
import { itemStats } from '../progression/progression';
import { inStrike, newSign, pickPlaces, signDone, signLight, stepSign, type BookStats, type Sign } from './book';

/** How dark the cuts themselves show on the soil, at most. */
const CUT_ALPHA = 0.5;
/** How much taller the rays stand at the height of the surge. */
const SURGE_TALLER = 0.6;
/** The rays' colour, a little short of full so the surge can whiten and brighten it. */
const RAY_SHARE = 0.8;

interface Shown {
  sign: Sign;
  /** The cuts, on the ground under everyone. */
  cut: Phaser.GameObjects.Image;
  /** The cuts' own glow, among the entities, under all that stands on the sign. */
  glow: Phaser.GameObjects.Image;
  /** The rays, band by band from the back, each band's groups in turn. */
  rays: Phaser.GameObjects.Image[];
  /** Each group's pulses a second and phase, the sign's own. */
  rates: number[];
  phases: number[];
}

/**
 * The black book: every few seconds it cuts signs into the ground under
 * enemies near the hero, picked at random, which strike a moment later at
 * whoever stands on them then. A sign never moves: one who walks off in
 * time is spared. The cuts lie on the ground, dark and barely seen; the
 * sign is read by the witch-light rising out of them, which grows towards
 * the strike, surges at it and fades. That light is drawn among the
 * entities as light added to them (TEX.signLight), so what stands in front
 * of a sign covers its rays, and it keeps its brightness in the dark
 * through the night's mask of lights (see `glows`). Not owned at the start
 * of a run: level 0 cuts nothing.
 */
export class BlackBook {
  private stats: BookStats | null = null;
  /** Seconds until the next cut; it cuts as soon as it is gained. */
  private cooldown = 0;
  private shown: Shown[] = [];
  private readonly pool: Shown[] = [];
  /** Every sprite of the signs' light, for the night to keep in its own colour. */
  private readonly lights = new Set<Phaser.GameObjects.GameObject>();

  /**
   * `ground` is the layer of marks on the ground under the entities, where
   * the cuts lie; `entities` is the depth-sorted layer their light rises in.
   */
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly ground: Phaser.GameObjects.Layer,
    private readonly entities: Phaser.GameObjects.Layer,
    private readonly horde: Horde,
    private readonly fx: Fx,
  ) {}

  /** Whether `object` is the light of a sign, which the night keeps in its own colour like the coals'. */
  readonly glows = (object: Phaser.GameObjects.GameObject): boolean => this.lights.has(object);

  /** Takes on the numbers of `level`, from 1; 0 for none. */
  setLevel(level: number): void {
    this.stats = itemStats(CFG.items, 'book', level);
  }

  /**
   * Cuts signs when ready round a hero whose feet stand on (x, feetY),
   * ages those cut and strikes. Returns the number of kills.
   */
  update(dt: number, x: number, feetY: number): number {
    const stats = this.stats;
    if (stats) {
      this.cooldown -= dt;
      if (this.cooldown <= 0) {
        // Added rather than set, so the cuts keep their time on average whatever the frame rate.
        this.cooldown = this.cut(x, feetY, stats)
          ? Math.max(0, this.cooldown + stats.cooldown)
          : CFG.book.retry;
      }
    }

    let kills = 0;
    let kept = 0;
    for (const shown of this.shown) {
      if (stepSign(shown.sign, dt)) kills += this.strike(shown.sign);
      if (signDone(shown.sign, CFG.book)) {
        this.hide(shown);
        this.pool.push(shown);
      } else {
        this.draw(shown);
        this.shown[kept++] = shown;
      }
    }
    this.shown.length = kept;
    return kills;
  }

  /** Cuts the level's signs under enemies in reach. Returns whether any was cut. */
  private cut(x: number, feetY: number, stats: BookStats): boolean {
    const places = this.horde.list
      .filter((enemy) => !enemy.dead)
      .map((enemy) => ({ x: enemy.x, y: enemy.y + enemy.kind.groundY }));
    const picked = pickPlaces(places, x, feetY, stats.count, CFG.book, Math.random);
    for (const place of picked) {
      const sign = newSign(place, stats, Math.floor(Math.random() * SIGN_FRAMES.length));
      const shown = this.pool.pop() ?? this.addShown();
      shown.sign = sign;
      shown.cut.setFrame(SIGN_FRAMES[sign.drawing]);
      shown.glow.setFrame(signGlowFrame(sign.drawing));
      shown.rays.forEach((ray, i) => {
        const band = Math.floor(i / SIGN_LIGHT.groups);
        ray.setFrame(signRaysFrame(sign.drawing, band, i % SIGN_LIGHT.groups));
      });
      for (let g = 0; g < SIGN_LIGHT.groups; g++) {
        const [low, high] = SIGN_LIGHT.rate;
        shown.rates[g] = low + (high - low) * Math.random();
        shown.phases[g] = Math.random() * 2 * Math.PI;
      }
      this.shown.push(shown);
    }
    return picked.length > 0;
  }

  /** Wounds every enemy standing within the sign's strike. */
  private strike(sign: Sign): number {
    const damage = this.stats?.damage ?? 0;
    const flatten = CFG.ground.flatten;
    let kills = 0;
    for (const enemy of this.horde.list) {
      if (enemy.dead || !inStrike(enemy.x - sign.x, enemy.y + enemy.kind.groundY - sign.y, sign.radius, flatten)) continue;
      if (this.horde.damage(enemy, damage, 0, 0)) {
        kills++;
        this.fx.wisps(enemy.x, enemy.y);
      }
    }
    return kills;
  }

  private draw(shown: Shown): void {
    const { sign } = shown;
    const flatten = CFG.ground.flatten;
    const light = signLight(sign.age, sign.delay, CFG.book);
    // The sheet holds the sign SIGN_LIGHT.size units wide; this one is as wide as its strike.
    const size = (2 * sign.radius) / SIGN_LIGHT.size;
    const scale = size / SIGN_LIGHT.scale;
    const { height } = signPixels(flatten);
    shown.cut
      .setVisible(true)
      .setPosition(sign.x, sign.y)
      .setScale(size / ART_SCALE, (size / ART_SCALE) * flatten)
      .setAlpha(CUT_ALPHA * light.fade);
    // Under everything that stands on the sign.
    shown.glow
      .setVisible(true)
      .setPosition(sign.x, sign.y)
      .setScale(scale)
      .setDepth(sign.y - sign.radius * flatten - 1)
      .setAlpha(Math.min(1, light.grow * light.fade * (1 + 0.5 * light.surge)));

    const tint = rayTint(light.surge);
    shown.rays.forEach((ray, i) => {
      const { top, bottom } = bandRows(Math.floor(i / SIGN_LIGHT.groups), height);
      const g = i % SIGN_LIGHT.groups;
      const beat = pulse(sign.age, shown.rates[g], shown.phases[g]);
      ray
        .setVisible(true)
        .setPosition(sign.x, sign.y + (bottom - height / 2) * scale)
        .setScale(scale, scale * (1 + SURGE_TALLER * light.surge))
        // Sorted by the middle of its band: in front of what stands behind those cuts, behind what stands before them.
        .setDepth(sign.y + ((top + bottom) / 2 - height / 2) * scale)
        .setTint(tint)
        .setAlpha(Math.min(1, light.grow * light.fade * Math.max(beat, light.surge)));
    });
  }

  private hide(shown: Shown): void {
    shown.cut.setVisible(false);
    shown.glow.setVisible(false);
    for (const ray of shown.rays) ray.setVisible(false);
  }

  private addShown(): Shown {
    const scene = this.scene;
    const cut = scene.add.image(0, 0, TEX.signs, SIGN_FRAMES[0]);
    this.ground.add(cut);
    const glow = scene.add.image(0, 0, TEX.signLight, signGlowFrame(0));
    const rays = Array.from({ length: SIGN_LIGHT.bands * SIGN_LIGHT.groups }, () =>
      scene.add.image(0, 0, TEX.signLight, signRaysFrame(0, 0, 0)).setOrigin(0.5, 1),
    );
    for (const light of [glow, ...rays]) {
      this.entities.add(light);
      this.lights.add(light);
    }
    return { sign: newSign({ x: 0, y: 0 }, CFG.items.book[0], 0), cut, glow, rays, rates: [], phases: [] };
  }
}

/** The rays' tint at `surge` (0..1) of the strike's surge: their navi green, whitening to the pale of the cut. */
function rayTint(surge: number): number {
  const { green, pale } = SIGN_LIGHT;
  const channel = (c: number) => {
    const base = RAY_SHARE * (0.75 * green[c] + 0.25 * pale[c]);
    return Math.round(255 * (base + (pale[c] - base) * surge));
  };
  return (channel(0) << 16) | (channel(1) << 8) | channel(2);
}

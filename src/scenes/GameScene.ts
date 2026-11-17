import Phaser from 'phaser';
import { CFG } from '../config';
import { FootprintDebug } from '../debug/FootprintDebug';
import { DPR } from '../display';
import { Horde } from '../entities/Horde';
import { NAVIA } from '../entities/navia';
import { UPYR } from '../entities/upyr';
import { Player } from '../entities/Player';
import { Sparks } from '../entities/Sparks';
import { dropWorth } from '../entities/spark';
import type { Enemy } from '../entities/enemy';
import { Fx } from '../fx/Fx';
import { controls } from '../input/controls';
import { addNight, type NightFilter } from '../night/NightFilter';
import { cardFor } from '../progression/cards';
import {
  gainXp,
  itemStats,
  levelCost,
  newProgress,
  offer,
  pick,
  type ItemId,
  type Progress,
} from '../progression/progression';
import { spawnsUpyr, WaveDirector } from '../systems/WaveDirector';
import { ui, type RunStats } from '../ui/Ui';
import { AspenStake } from '../weapons/AspenStake';
import { FuneralBell } from '../weapons/FuneralBell';
import { Sickles } from '../weapons/Sickles';
import { WolfTeeth } from '../weapons/WolfTeeth';
import { Ground } from '../world/Ground';
import { Scenery } from '../world/Scenery';
import { randomScenerySeed } from '../world/SceneryLayout';

/** `choose`: the run stands still while the player picks what a level-up gives. */
type Mode = 'title' | 'run' | 'pause' | 'choose' | 'dead';

const BEST_TIME_KEY = 'morok.best';
/** Registry flag: skip the title screen on the next scene start. */
const AUTOSTART = 'autostart';
/** Longest simulation step, so a slow frame cannot fling things through each other. */
const MAX_DT = 0.05;

function loadBestTime(): number {
  try {
    return Number(localStorage.getItem(BEST_TIME_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveBestTime(seconds: number): void {
  try {
    localStorage.setItem(BEST_TIME_KEY, String(seconds));
  } catch {
    // Storage can be unavailable; the record just does not persist.
  }
}

/** A single run: the hero against the night. */
export class GameScene extends Phaser.Scene {
  private mode: Mode = 'title';
  private player!: Player;
  private horde!: Horde;
  private sparks!: Sparks;
  private ground!: Ground;
  private scenery!: Scenery;
  private fx!: Fx;
  private stake!: AspenStake;
  private teeth!: WolfTeeth;
  private bell!: FuneralBell;
  private sickles!: Sickles;
  private director!: WaveDirector;
  /** The layers that can stand in front of a coal or light it, for the night's mask of the coals. */
  private layers!: Record<'entities' | 'lights' | 'overhead', Phaser.GameObjects.Layer>;
  /** Public for tuning from the console in dev builds. */
  night!: NightFilter;
  /** Dev builds only: outlines of the footprints. Declared, so production builds get no field. */
  declare private footprintDebug?: FootprintDebug;

  /** Seconds survived in this run. */
  private elapsed = 0;
  /** Seconds the scene has been animating, including the title screen. */
  private clock = 0;
  private kills = 0;
  /** Experience gathered in this run: the worth of every spark the skull has drunk in. */
  private xp = 0;
  /** The hero's level and items. */
  private progress!: Progress;
  /** The items on the cards shown, in order. */
  private offered: ItemId[] = [];

  constructor() {
    super('Game');
  }

  create(): void {
    // Draw order, bottom to top: the soil, puddles on it, marks on the
    // ground (the bell's ring), shadows, then
    // everything standing and the sparks on the ground with the tiny sparks
    // they shed, the trails of the sparks in flight, and what flies over it
    // all. Entities are depth-sorted by the y where they meet the ground.
    const tiles = this.add.layer();
    const puddles = this.add.layer();
    const marks = this.add.layer();
    const shadows = this.add.layer();
    const entities = this.add.layer();
    const lights = this.add.layer();
    const overhead = this.add.layer();
    this.layers = { entities, lights, overhead };

    this.elapsed = 0;
    this.clock = 0;
    this.kills = 0;
    this.xp = 0;
    this.progress = newProgress(CFG.items);
    this.offered = [];

    this.ground = new Ground(this, tiles);
    // A new layout of the scenery for every run.
    this.scenery = new Scenery(this, puddles, entities, randomScenerySeed());
    this.player = new Player(this, { shadows, entities, overhead });
    this.horde = new Horde(this, entities, shadows);
    this.sparks = new Sparks(this, entities, lights);
    this.fx = new Fx(this, overhead);
    this.stake = new AspenStake(this, overhead, this.horde, this.fx);
    this.teeth = new WolfTeeth(this, entities, this.horde, this.fx);
    this.bell = new FuneralBell(this, marks, overhead, this.horde, this.fx);
    this.sickles = new Sickles(this, entities, this.horde, this.fx);
    this.equip();
    this.director = new WaveDirector(CFG.spawn);
    // Light, fog and the hurt flash, over everything the camera sees.
    this.night = addNight(this.cameras.main);
    if (import.meta.env.DEV) this.footprintDebug = new FootprintDebug(this, overhead);

    controls.onAdvance = () => this.advance();
    controls.onPause = () => this.togglePause();
    controls.onChoose = (index) => {
      if (this.mode === 'choose') ui.pickCard(index);
    };
    ui.onPick = (index) => this.choose(index);
    controls.onBlur = () => {
      if (this.mode === 'run') this.togglePause();
    };
    ui.onScreenClick = () => this.advance();

    // The scene does not update while paused, so reframe on resize explicitly.
    this.scale.on(Phaser.Scale.Events.RESIZE, this.frameCamera, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.frameCamera, this);
    });

    if (this.registry.get(AUTOSTART)) {
      this.mode = 'run';
      ui.update(this.stats);
      ui.showRun();
    } else {
      this.mode = 'title';
      ui.showTitle();
    }
    this.player.draw();
    this.frameCamera();
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(MAX_DT, delta / 1000);
    this.clock += dt;
    if (this.mode === 'run') this.simulate(dt);
    this.player.draw();
    this.night.steer(this.player.facing, this.player.moving ? controls.moveY : 0, dt);
    this.frameCamera();
  }

  /** Snapshot for the HUD and for debugging. */
  get stats(): RunStats & {
    mode: Mode;
    wave: number;
    hp: number;
    maxHp: number;
    enemies: number;
    xp: number;
    sparks: number;
    items: Record<ItemId, number>;
  } {
    const progress = this.progress;
    return {
      mode: this.mode,
      elapsed: this.elapsed,
      kills: this.kills,
      wave: this.director.wave,
      hp: this.player.hp,
      maxHp: CFG.player.hp,
      enemies: this.horde.size,
      xp: this.xp,
      sparks: this.sparks.size,
      level: progress.level,
      levelXp: progress.xp,
      levelCost: levelCost(progress.level, CFG.levels),
      items: { ...progress.items },
    };
  }

  private simulate(dt: number): void {
    this.elapsed += dt;
    const player = this.player;
    player.update(dt, controls.moveX, controls.moveY);
    const feet = this.scenery.blockFeet(player.x, player.feetY, CFG.player.radius);
    player.placeFeet(feet.x, feet.y);

    const spawnRadius = this.spawnRadius;
    this.director.update(dt, this.elapsed, (angle, extraDistance) => {
      const distance = spawnRadius + extraDistance;
      const kind = spawnsUpyr(this.elapsed, Math.random(), CFG.upyr) ? UPYR : NAVIA;
      this.horde.spawn(player.x + Math.cos(angle) * distance, player.y + Math.sin(angle) * distance, this.elapsed, kind);
    });

    const contact = this.horde.update(dt, this.clock, player, spawnRadius, spawnRadius * 1.7, this.strike);
    this.kills += this.stake.update(dt, player, player.facing);
    this.kills += this.teeth.update(dt, player.x, player.feetY);
    this.kills += this.bell.update(dt, player.x, player.feetY);
    this.kills += this.sickles.update(dt, player.x, player.feetY, player.facingY);
    this.horde.removeDead(this.dropSpark);
    const drunk = this.sparks.update(dt, this.clock, player, player.skullEye, this.pickupRadius);
    if (drunk > 0) {
      this.xp += drunk;
      gainXp(this.progress, drunk, CFG.levels);
      this.night.feed(drunk);
    }

    if (contact > 0 && player.hurt(contact)) this.onPlayerHurt();
    ui.update(this.stats);
    if (this.mode === 'run') this.offerChoice();
  }

  /** How far the hero draws in sparks from: further with the hag stone. */
  private get pickupRadius(): number {
    return itemStats(CFG.items, 'hagStone', this.progress.items.hagStone)?.pickupRadius ?? CFG.spark.pickupRadius;
  }

  /** Gives the weapons the numbers of their items' levels. */
  private equip(): void {
    this.stake.setLevel(this.progress.items.stake);
    this.teeth.setLevel(this.progress.items.teeth);
    this.bell.setLevel(this.progress.items.bell);
    this.sickles.setLevel(this.progress.items.sickle);
  }

  /**
   * Shows the cards for the next level-up waiting for its choice, standing
   * the run still, if there is one; with every item at its top level there
   * is none, and the run goes on. Returns whether cards are shown.
   */
  private offerChoice(): boolean {
    this.offered = offer(this.progress, CFG.items, CFG.levels, Math.random);
    if (this.offered.length === 0) return false;
    if (this.mode !== 'choose') {
      this.mode = 'choose';
      this.scene.pause();
    }
    ui.showChoice(this.offered.map((id) => cardFor(this.progress, CFG.items, id)));
    return true;
  }

  /**
   * The player picked the card of `index`: the item is gained or raised,
   * then the next level-up's cards follow if another is waiting, or the run
   * goes on.
   */
  private choose(index: number): void {
    const id = this.offered[index];
    if (this.mode !== 'choose' || !id) return;
    pick(this.progress, CFG.items, id);
    this.equip();
    ui.update(this.stats);
    if (this.offerChoice()) return;
    this.mode = 'run';
    ui.showRun();
    this.scene.resume();
  }

  /** Whether `object` gives its own light, which the night keeps in its colour: a coal or a sickle's trail. */
  private readonly glows = (object: Phaser.GameObjects.GameObject): boolean =>
    this.sparks.glows(object) || this.sickles.glows(object);

  /** A slain enemy leaves a spark where it fell. */
  private readonly dropSpark = (enemy: Enemy): void => {
    const height = enemy.kind.groundY;
    const cfg = CFG.spark;
    const worth = dropWorth(cfg.randomGrade, enemy.kind.xp(), Math.random(), cfg.grades);
    this.sparks.drop(enemy.x, enemy.y + height, height, worth);
  };

  /** An enemy's attack reaches the hero. Returns whether it landed. */
  private readonly strike = (damage: number): boolean => {
    if (!this.player.hurt(damage)) return false;
    this.onPlayerHurt();
    return true;
  };

  private onPlayerHurt(): void {
    this.cameras.main.shake(260, 0.006);
    this.fx.blood(this.player.x, this.player.y);
    this.night.flash();
    if (this.player.dead) this.die();
  }

  private die(): void {
    this.mode = 'dead';
    const best = loadBestTime();
    const isRecord = this.elapsed > best;
    if (isRecord) saveBestTime(this.elapsed);
    ui.update(this.stats);
    ui.showDeath(this.stats, best, isRecord);
    this.scene.pause();
  }

  /** Enter, Space or a click: start, resume or restart depending on the mode. */
  private advance(): void {
    if (this.mode === 'title') {
      this.mode = 'run';
      ui.update(this.stats);
      ui.showRun();
    } else if (this.mode === 'pause') {
      this.togglePause();
    } else if (this.mode === 'dead') {
      this.registry.set(AUTOSTART, true);
      this.scene.restart();
    }
  }

  private togglePause(): void {
    if (this.mode === 'run') {
      this.mode = 'pause';
      ui.showPause();
      this.scene.pause();
    } else if (this.mode === 'pause') {
      this.mode = 'run';
      ui.showRun();
      this.scene.resume();
    }
  }

  /** Size of the visible part of the world, in world units. */
  private get viewSize(): { width: number; height: number } {
    const zoom = this.cameras.main.zoom;
    return { width: this.scale.width / zoom, height: this.scale.height / zoom };
  }

  /** Just beyond the corners of the view, inside the fog. */
  private get spawnRadius(): number {
    const { width, height } = this.viewSize;
    return Math.hypot(width, height) / 2 + 40;
  }

  private frameCamera(): void {
    const camera = this.cameras.main;
    camera.setZoom(CFG.zoom * DPR);
    camera.centerOn(this.player.x, this.player.y);
    this.night.focusX = this.player.x;
    this.night.focusY = this.player.y;
    const eye = this.player.skullEye;
    this.night.eyeX = eye.x;
    this.night.eyeY = eye.y;
    const { width, height } = this.viewSize;
    // A margin keeps the ground under the screen edges during camera shake.
    const margin = 32;
    const left = this.player.x - width / 2 - margin;
    const top = this.player.y - height / 2 - margin;
    this.ground.cover(left, top, width + margin * 2, height + margin * 2);
    this.scenery.cover(left, top, width + margin * 2, height + margin * 2);
    // The fires' heat over the view, for the night to thin its fog by, and
    // the coals' light and the sickle's trail as seen, for it to keep in
    // their colour.
    this.night.fires.draw(this.player.x, this.player.y, width, height, (stamp) => this.sparks.fires(stamp));
    const { entities, lights, overhead } = this.layers;
    this.night.coals.draw(camera, entities, this.glows, lights, overhead);
    if (import.meta.env.DEV) {
      this.footprintDebug?.draw(
        () => this.scenery.footprints(left, top, width + margin * 2, height + margin * 2),
        this.player.x,
        this.player.feetY,
        CFG.player.radius,
      );
    }
  }
}

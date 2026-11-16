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
import { spawnsUpyr, WaveDirector } from '../systems/WaveDirector';
import { ui, type RunStats } from '../ui/Ui';
import { AspenStake } from '../weapons/AspenStake';
import { Ground } from '../world/Ground';
import { Scenery } from '../world/Scenery';
import { randomScenerySeed } from '../world/SceneryLayout';

type Mode = 'title' | 'run' | 'pause' | 'dead';

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
  private director!: WaveDirector;
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

  constructor() {
    super('Game');
  }

  create(): void {
    // Draw order, bottom to top: the soil, puddles on it, shadows, then
    // everything standing and the sparks on the ground, the light the sparks
    // shed, and what flies over it all. Entities are depth-sorted by the y
    // where they meet the ground.
    const tiles = this.add.layer();
    const puddles = this.add.layer();
    const shadows = this.add.layer();
    const entities = this.add.layer();
    const lights = this.add.layer();
    const overhead = this.add.layer();

    this.elapsed = 0;
    this.clock = 0;
    this.kills = 0;
    this.xp = 0;

    this.ground = new Ground(this, tiles);
    // A new layout of the scenery for every run.
    this.scenery = new Scenery(this, puddles, entities, randomScenerySeed());
    this.player = new Player(this, { shadows, entities, overhead });
    this.horde = new Horde(this, entities, shadows);
    this.sparks = new Sparks(this, entities, lights);
    this.fx = new Fx(this, overhead);
    this.stake = new AspenStake(this, overhead, this.horde, this.fx);
    this.director = new WaveDirector(CFG.spawn);
    // Light, fog and the hurt flash, over everything the camera sees.
    this.night = addNight(this.cameras.main);
    if (import.meta.env.DEV) this.footprintDebug = new FootprintDebug(this, overhead);

    controls.onAdvance = () => this.advance();
    controls.onPause = () => this.togglePause();
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
  get stats(): RunStats & { mode: Mode; wave: number; enemies: number; xp: number; sparks: number } {
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
    this.kills += this.stake.update(dt, player);
    this.horde.removeDead(this.dropSpark);
    const drunk = this.sparks.update(dt, this.clock, player, player.skullEye);
    if (drunk > 0) {
      this.xp += drunk;
      this.night.feed(drunk);
    }

    if (contact > 0 && player.hurt(contact)) this.onPlayerHurt();
    ui.update(this.stats);
  }

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
    // The fires' heat over the view, for the night to thin its fog by.
    this.night.fires.draw(this.player.x, this.player.y, width, height, (stamp) => this.sparks.fires(stamp));
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

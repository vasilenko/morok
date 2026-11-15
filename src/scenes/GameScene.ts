import Phaser from 'phaser';
import { CFG } from '../config';
import { DPR } from '../display';
import { Horde } from '../entities/Horde';
import { Player } from '../entities/Player';
import { EVENTS } from '../events';
import { Fx } from '../fx/Fx';
import { controls } from '../input/controls';
import { WaveDirector } from '../systems/WaveDirector';
import { STRINGS } from '../ui/strings';
import { ui, type RunStats } from '../ui/Ui';
import { AspenStake } from '../weapons/AspenStake';
import { Ground } from '../world/Ground';

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
  private ground!: Ground;
  private fx!: Fx;
  private stake!: AspenStake;
  private director!: WaveDirector;

  /** Seconds survived in this run. */
  private elapsed = 0;
  /** Seconds the scene has been animating, including the title screen. */
  private clock = 0;
  private kills = 0;

  constructor() {
    super('Game');
  }

  create(): void {
    // Draw order, bottom to top. Entities are depth-sorted by their y.
    const ground = this.add.layer();
    const shadows = this.add.layer();
    const entities = this.add.layer();
    const overhead = this.add.layer();

    this.elapsed = 0;
    this.clock = 0;
    this.kills = 0;

    this.ground = new Ground(this, ground);
    this.player = new Player(this, { ground, shadows, entities, overhead });
    this.horde = new Horde(this, entities, shadows);
    this.fx = new Fx(this, overhead);
    this.stake = new AspenStake(this, overhead, this.horde, this.fx);
    this.director = new WaveDirector(CFG.spawn);

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
    this.player.draw(this.clock);
    this.frameCamera();
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(MAX_DT, delta / 1000);
    this.clock += dt;
    if (this.mode === 'run') this.simulate(dt);
    this.player.draw(this.clock);
    this.frameCamera();
  }

  /** Snapshot for the HUD and for debugging. */
  get stats(): RunStats & { mode: Mode; enemies: number } {
    return {
      mode: this.mode,
      elapsed: this.elapsed,
      kills: this.kills,
      wave: this.director.wave,
      hp: this.player.hp,
      maxHp: CFG.player.hp,
      enemies: this.horde.size,
    };
  }

  private simulate(dt: number): void {
    this.elapsed += dt;
    const player = this.player;
    player.update(dt, controls.moveX, controls.moveY);

    const spawnRadius = this.spawnRadius;
    const wave = this.director.update(dt, this.elapsed, (angle, extraDistance) => {
      const distance = spawnRadius + extraDistance;
      this.horde.spawn(player.x + Math.cos(angle) * distance, player.y + Math.sin(angle) * distance, this.elapsed);
    });
    if (wave) ui.banner(wave.ring ? STRINGS.ringWave : STRINGS.wave(wave.wave));

    const touched = this.horde.update(dt, this.clock, player, spawnRadius, spawnRadius * 1.7);
    this.kills += this.stake.update(dt, player);
    this.horde.removeDead();

    if (touched && player.hurt(CFG.navia.damage)) this.onPlayerHurt();
    ui.update(this.stats);
  }

  private onPlayerHurt(): void {
    this.cameras.main.shake(260, 0.006);
    this.fx.blood(this.player.x, this.player.y);
    this.game.events.emit(EVENTS.playerHurt);
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
    const { width, height } = this.viewSize;
    // A margin keeps the ground under the screen edges during camera shake.
    const margin = 32;
    this.ground.cover(
      this.player.x - width / 2 - margin,
      this.player.y - height / 2 - margin,
      width + margin * 2,
      height + margin * 2,
    );
  }
}

import type { SpawnConfig, UpyrConfig } from '../config';

const TAU = Math.PI * 2;

/** Places one enemy at `angle` around the player, `extraDistance` beyond the spawn ring. */
export type SpawnFn = (angle: number, extraDistance: number) => void;

export interface WaveEvent {
  /** 1-based wave number. */
  wave: number;
  /** Ring waves surround the player; the rest arrive from a single direction. */
  ring: boolean;
  count: number;
}

/**
 * Decides when and where enemies appear: a steady trickle that thickens over
 * the night, plus periodic waves. Knows nothing about rendering.
 */
export class WaveDirector {
  wave = 0;
  private trickleDebt = 0;
  private waveTimer: number;

  constructor(
    private readonly cfg: SpawnConfig,
    private readonly random: () => number = Math.random,
  ) {
    this.waveTimer = cfg.firstWave;
  }

  /**
   * Advances the schedule by `dt` seconds. `elapsed` is the time survived so
   * far. Returns the wave that started during this step, if any.
   */
  update(dt: number, elapsed: number, spawn: SpawnFn): WaveEvent | null {
    this.trickleDebt += dt * (this.cfg.trickle + this.cfg.trickleGrowth * (elapsed / 60));
    while (this.trickleDebt >= 1) {
      this.trickleDebt -= 1;
      spawn(this.random() * TAU, this.random() * 60);
    }

    this.waveTimer -= dt;
    if (this.waveTimer > 0) return null;
    this.waveTimer += this.cfg.waveEvery;
    return this.startWave(spawn);
  }

  private startWave(spawn: SpawnFn): WaveEvent {
    this.wave++;
    const count = this.cfg.waveBase + this.cfg.waveGrowth * (this.wave - 1);
    const ring = this.wave % this.cfg.ringEvery === 0;
    const direction = this.random() * TAU;

    for (let i = 0; i < count; i++) {
      if (ring) spawn(direction + (i / count) * TAU, this.random() * 40);
      else spawn(direction + (this.random() - 0.5) * 1.0, this.random() * 160);
    }
    return { wave: this.wave, ring, count };
  }
}

/**
 * Whether the enemy spawned now is an upyr rather than a navia: never
 * before `appearsAt` seconds into the run, then with a chance of `share`.
 * `roll` is a uniform random number in [0, 1).
 */
export function spawnsUpyr(
  elapsed: number,
  roll: number,
  { appearsAt, share }: Pick<UpyrConfig, 'appearsAt' | 'share'>,
): boolean {
  return elapsed >= appearsAt && roll < share;
}

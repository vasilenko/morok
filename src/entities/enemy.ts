import type Phaser from 'phaser';

/**
 * One of the restless dead. The horde owns what every kind shares: pooling,
 * the spatial grid, crowding, knockback, the hit flash, damage, death and
 * contact with the hero. What sets a kind apart lives in its EnemyKind,
 * and whatever it needs to remember per enemy in `state`.
 */
export interface Enemy<S = unknown> {
  kind: EnemyKind<S>;
  state: S;
  x: number;
  y: number;
  hp: number;
  radius: number;
  /** Walking or floating speed, in units per second. */
  speed: number;
  /** Knockback velocity, decays quickly. */
  kx: number;
  ky: number;
  /** Seconds of hit flash left. */
  flash: number;
  /** Per-enemy offset so the crowd does not move in unison. */
  phase: number;
  /** Facing left, towards a hero on that side. */
  flipped: boolean;
  dead: boolean;
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
}

/** Deals damage to the hero. Returns whether it landed, as an invulnerable hero shrugs it off. */
export type Strike = (damage: number) => boolean;

export interface Target {
  x: number;
  y: number;
}

/** The numbers a kind gives a new enemy. */
export interface Newborn<S> {
  hp: number;
  radius: number;
  speed: number;
  state: S;
}

/**
 * What sets one kind of enemy apart: how it moves of its own will, when the
 * crowd and the stakes may push it, what touching it costs the hero, and
 * how it looks.
 */
export interface EnemyKind<S = unknown> {
  /** Texture its sprites are created with. */
  readonly texture: string;
  /** Width of its ground shadow in world units, and the shadow's opacity. */
  readonly shadowWidth: number;
  readonly shadowAlpha: number;
  /** How far below its position the ground is: where it stands or its shadow falls, and where its spark drops. */
  readonly groundY: number;
  /**
   * The share of a blow's knock-back that moves it: 1 for most, less for
   * the heavy. Applied to every knock-back a weapon deals (see Horde.damage).
   */
  readonly knockback: number;
  /** Worth of the spark it leaves when laid to rest. */
  xp(): number;
  /** Stats and fresh state for a new enemy; `elapsed` is the time survived so far. */
  create(elapsed: number): Newborn<S>;
  /**
   * Moves the enemy by its own will, before crowding and knockback. An
   * attack that reaches the hero deals its damage through `strike`.
   */
  steer(enemy: Enemy<S>, dt: number, target: Target, strike: Strike): void;
  /** Whether the enemy holds its ground: the crowd and knockback do not move it. */
  anchored(enemy: Enemy<S>): boolean;
  /**
   * Damage dealt to the hero on touching. An enemy with none passes through
   * the hero instead of stopping at its edge.
   */
  contactDamage(enemy: Enemy<S>): number;
  /** Readies a sprite, new or from the pool, to show a newly spawned enemy. */
  dress(sprite: Phaser.GameObjects.Sprite): void;
  /** Restores the sprite's resting look after the hit flash. */
  rest(sprite: Phaser.GameObjects.Sprite): void;
  /** Syncs the sprite and shadow to the enemy. */
  place(enemy: Enemy<S>, clock: number, target: Target): void;
}

/** Takes health off an enemy. Returns whether this killed it. */
export function wound(enemy: { hp: number; dead: boolean }, amount: number): boolean {
  enemy.hp -= amount;
  if (enemy.hp > 0) return false;
  enemy.dead = true;
  return true;
}

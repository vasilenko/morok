import type { ItemLadders, LevelConfig } from '../config';

/**
 * The hero's growth in a run, as pure logic: experience fills levels, every
 * level gained earns a choice of item to gain or raise, and an item's level
 * picks its row of numbers.
 */
export type ItemId = keyof ItemLadders;

/** The items in the order they are listed, which is the order cards are offered in before shuffling. */
export function itemIds(ladders: ItemLadders): ItemId[] {
  return Object.keys(ladders) as ItemId[];
}

export interface Progress {
  /** The hero's level, from 1. */
  level: number;
  /** Experience gathered towards the next level. */
  xp: number;
  /** Levels gained whose choice has not been made yet. */
  choices: number;
  /** Each item's level; 0 for an item not owned. */
  items: Record<ItemId, number>;
}

/** The start of a run: level 1, with the stake at level 1 and nothing else. */
export function newProgress(ladders: ItemLadders): Progress {
  const items = {} as Record<ItemId, number>;
  for (const id of itemIds(ladders)) items[id] = 0;
  items.stake = 1;
  return { level: 1, xp: 0, choices: 0, items };
}

/** Experience it takes to go from `level` to the next. */
export function levelCost(level: number, cfg: LevelConfig): number {
  return cfg.first + cfg.step * (level - 1);
}

/**
 * Adds experience, rising as many levels as it fills, each of which earns
 * a choice. Returns the number of levels gained.
 */
export function gainXp(progress: Progress, amount: number, cfg: LevelConfig): number {
  progress.xp += amount;
  let gained = 0;
  for (let cost = levelCost(progress.level, cfg); progress.xp >= cost; cost = levelCost(progress.level, cfg)) {
    progress.xp -= cost;
    progress.level++;
    gained++;
  }
  progress.choices += gained;
  return gained;
}

/** The highest level of an item. */
export function topLevel(ladders: ItemLadders, id: ItemId): number {
  return ladders[id].length;
}

/** The items that can still be gained or raised, in listed order. */
export function upgradable(progress: Progress, ladders: ItemLadders): ItemId[] {
  return itemIds(ladders).filter((id) => progress.items[id] < topLevel(ladders, id));
}

/**
 * The items to offer for the next waiting choice: every item that can still
 * be raised, or `cfg.choices` of them picked at random when there are more,
 * drawing with `random` (0..1, uniform). Returns none when no choice is
 * waiting; when there is nothing left to raise, the waiting choices lapse,
 * so levels keep counting without asking.
 */
export function offer(progress: Progress, ladders: ItemLadders, cfg: LevelConfig, random: () => number): ItemId[] {
  if (progress.choices <= 0) return [];
  const pool = upgradable(progress, ladders);
  if (pool.length === 0) {
    progress.choices = 0;
    return [];
  }
  // A partial Fisher-Yates shuffle: the first `count` places are a uniform draw.
  const count = Math.min(cfg.choices, pool.length);
  for (let i = 0; i < count; i++) {
    const j = i + Math.min(pool.length - i - 1, Math.floor(random() * (pool.length - i)));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  // Shown in listed order, so an item keeps its usual place among the cards.
  const order = itemIds(ladders);
  return pool.slice(0, count).sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

/** Makes a waiting choice: gains the item at level 1 or raises it by one. */
export function pick(progress: Progress, ladders: ItemLadders, id: ItemId): void {
  if (progress.choices <= 0) throw new Error('no choice is waiting');
  if (progress.items[id] >= topLevel(ladders, id)) throw new Error(`${id} is at its top level`);
  progress.items[id]++;
  progress.choices--;
}

/** An item's numbers at `level`, from 1; null for an item not owned. */
export function itemStats<K extends ItemId>(ladders: ItemLadders, id: K, level: number): ItemLadders[K][number] | null {
  if (level <= 0) return null;
  const ladder = ladders[id];
  return ladder[Math.min(level, ladder.length) - 1];
}

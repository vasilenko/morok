import { describe, expect, it } from 'vitest';
import { CFG, type ItemLadders, type LevelConfig } from '../config';
import { cardFor, gainLine } from './cards';
import { gainXp, itemStats, levelCost, newProgress, offer, pick, upgradable, type ItemId } from './progression';

const levels: LevelConfig = { first: 120, step: 90, choices: 3 };
const ladders: ItemLadders = CFG.items;
/** The first three items alone, for rules that read more plainly with no more cards than fit. */
const three = { stake: ladders.stake, teeth: ladders.teeth, hagStone: ladders.hagStone } as unknown as ItemLadders;

/** A random source that always returns the same draw. */
const always = (value: number) => () => value;

describe('levels', () => {
  it('cost more each time', () => {
    expect([1, 2, 3, 4].map((level) => levelCost(level, levels))).toEqual([120, 210, 300, 390]);
  });

  it('fill from experience and keep what is left over', () => {
    const progress = newProgress(ladders);
    expect(gainXp(progress, 100, levels)).toBe(0);
    expect(progress).toMatchObject({ level: 1, xp: 100, choices: 0 });
    expect(gainXp(progress, 40, levels)).toBe(1);
    expect(progress).toMatchObject({ level: 2, xp: 20, choices: 1 });
  });

  it('can rise several at once, each earning its own choice', () => {
    const progress = newProgress(ladders);
    expect(gainXp(progress, 120 + 210 + 300 + 5, levels)).toBe(3);
    expect(progress).toMatchObject({ level: 4, xp: 5, choices: 3 });
  });

  it('rise on exactly the cost', () => {
    const progress = newProgress(ladders);
    gainXp(progress, 120, levels);
    expect(progress).toMatchObject({ level: 2, xp: 0 });
  });
});

describe('a new run', () => {
  it('starts at level 1 with only the stake, at level 1', () => {
    const progress = newProgress(ladders);
    expect(progress.level).toBe(1);
    expect(progress.items).toEqual({ stake: 1, teeth: 0, bell: 0, hagStone: 0 });
  });
});

describe('the cards offered', () => {
  it('are none while no choice is waiting', () => {
    expect(offer(newProgress(ladders), ladders, levels, Math.random)).toEqual([]);
  });

  it('are every item not at its top level, in listed order', () => {
    const progress = newProgress(three);
    progress.choices = 1;
    expect(offer(progress, three, levels, always(0.99))).toEqual(['stake', 'teeth', 'hagStone']);
  });

  it('leave out the items at their top level', () => {
    const progress = newProgress(three);
    progress.items.stake = 5;
    progress.choices = 1;
    expect(upgradable(progress, three)).toEqual(['teeth', 'hagStone']);
    expect(offer(progress, three, levels, Math.random)).toEqual(['teeth', 'hagStone']);
  });

  it('are three at random when more can be raised', () => {
    const many = { ...three, a: ladders.hagStone, b: ladders.hagStone } as unknown as ItemLadders;
    const progress = newProgress(many);
    progress.choices = 1;
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const cards = offer(progress, many, levels, Math.random);
      expect(cards).toHaveLength(3);
      expect(new Set(cards).size).toBe(3);
      for (const id of cards) seen.add(id);
    }
    expect(seen.size).toBe(5);
  });

  it('lapse when nothing is left to raise, so levels keep counting without a choice', () => {
    const progress = newProgress(ladders);
    for (const id of Object.keys(ladders) as ItemId[]) progress.items[id] = 5;
    gainXp(progress, 120 + 210, levels);
    expect(progress.level).toBe(3);
    expect(offer(progress, ladders, levels, Math.random)).toEqual([]);
    expect(progress.choices).toBe(0);
  });
});

describe('a pick', () => {
  it('gains a new item at level 1 and uses up one choice', () => {
    const progress = newProgress(ladders);
    progress.choices = 2;
    pick(progress, ladders, 'teeth');
    expect(progress.items.teeth).toBe(1);
    expect(progress.choices).toBe(1);
  });

  it('raises an owned item by one level', () => {
    const progress = newProgress(ladders);
    progress.choices = 1;
    pick(progress, ladders, 'stake');
    expect(progress.items.stake).toBe(2);
  });

  it('is refused with no choice waiting or past the top level', () => {
    const progress = newProgress(ladders);
    expect(() => pick(progress, ladders, 'stake')).toThrow();
    progress.choices = 1;
    progress.items.hagStone = 5;
    expect(() => pick(progress, ladders, 'hagStone')).toThrow();
  });

  it('takes every item to its top level in five picks each, minus the stake it starts with', () => {
    const progress = newProgress(ladders);
    gainXp(progress, 1e7, levels);
    let picks = 0;
    for (let cards = offer(progress, ladders, levels, Math.random); cards.length > 0; ) {
      pick(progress, ladders, cards[0]);
      picks++;
      cards = offer(progress, ladders, levels, Math.random);
    }
    expect(picks).toBe(5 * Object.keys(ladders).length - 1);
    expect(progress.items).toEqual({ stake: 5, teeth: 5, bell: 5, hagStone: 5 });
    expect(progress.choices).toBe(0);
  });
});

describe('the numbers each level gives', () => {
  it('are the stake ladder', () => {
    expect([1, 2, 3, 4, 5].map((level) => itemStats(ladders, 'stake', level))).toEqual([
      { ways: 1, damage: 10, cooldown: 0.6, range: 120, pierce: 1 },
      { ways: 1, damage: 10, cooldown: 0.6, range: 170, pierce: 2 },
      { ways: 2, damage: 15, cooldown: 0.5, range: 170, pierce: 2 },
      { ways: 2, damage: 15, cooldown: 0.5, range: 240, pierce: 3 },
      { ways: 4, damage: 30, cooldown: 0.4, range: 240, pierce: 3 },
    ]);
  });

  it('are the wolf teeth ladder', () => {
    expect([1, 2, 3, 4, 5].map((level) => itemStats(ladders, 'teeth', level))).toEqual([
      { count: 2, damage: 10, radius: 85, period: 1.6 },
      { count: 3, damage: 10, radius: 85, period: 1.6 },
      { count: 3, damage: 15, radius: 100, period: 1.6 },
      { count: 4, damage: 15, radius: 100, period: 1.6 },
      { count: 5, damage: 15, radius: 115, period: 1.6 },
    ]);
  });

  it('are the funeral bell ladder', () => {
    expect([1, 2, 3, 4, 5].map((level) => itemStats(ladders, 'bell', level))).toEqual([
      { damage: 10, radius: 110, cooldown: 5.0, knockback: 600 },
      { damage: 10, radius: 140, cooldown: 5.0, knockback: 600 },
      { damage: 15, radius: 140, cooldown: 4.2, knockback: 600 },
      { damage: 15, radius: 170, cooldown: 4.2, knockback: 600 },
      { damage: 30, radius: 170, cooldown: 3.5, knockback: 600 },
    ]);
  });

  it('are the hag stone ladder', () => {
    expect([1, 2, 3, 4, 5].map((level) => itemStats(ladders, 'hagStone', level)?.pickupRadius)).toEqual([
      85, 110, 140, 170, 210,
    ]);
  });

  it('are none for an item not owned', () => {
    expect(itemStats(ladders, 'teeth', 0)).toBeNull();
  });
});

describe('a card', () => {
  it('offers a new item with what gaining it does', () => {
    const card = cardFor(newProgress(ladders), ladders, 'teeth');
    expect(card).toMatchObject({ id: 'teeth', name: 'Wolf teeth', level: 1 });
    expect(card.line.length).toBeGreaterThan(0);
  });

  it('offers an owned item at its next level with what changes', () => {
    const card = cardFor(newProgress(ladders), ladders, 'stake');
    expect(card).toMatchObject({ level: 2, line: 'Flies further, pierces 2 of the dead' });
  });

  it('names every number that changes', () => {
    expect(gainLine(ladders, 'stake', 3)).toBe('Also thrown behind, wounds for 15, thrown every 0.5 s');
    expect(gainLine(ladders, 'stake', 4)).toBe('Flies further, pierces 3 of the dead');
    expect(gainLine(ladders, 'stake', 5)).toBe('Thrown four ways, wounds for 30, thrown every 0.4 s');
    expect(gainLine(ladders, 'teeth', 3)).toBe('Wounds for 15, circles wider');
    expect(gainLine(ladders, 'teeth', 5)).toBe('5 fangs, circles wider');
    expect(gainLine(ladders, 'hagStone', 2)).toBe('Draws sparks from 29% further');
  });

  it('reads every level of the funeral bell', () => {
    expect(cardFor(newProgress(ladders), ladders, 'bell')).toMatchObject({
      name: 'Funeral bell',
      level: 1,
      line: 'Tolls, and its ring wounds and throws back all around you',
    });
    expect([2, 3, 4, 5].map((level) => gainLine(ladders, 'bell', level))).toEqual([
      'Rings out wider',
      'Wounds for 15, tolls every 4.2 s',
      'Rings out wider',
      'Wounds for 30, tolls every 3.5 s',
    ]);
  });

  it('has a line for every level of every item', () => {
    for (const id of Object.keys(ladders) as ItemId[]) {
      for (let level = 2; level <= ladders[id].length; level++) expect(gainLine(ladders, id, level)).not.toBe('');
    }
  });
});

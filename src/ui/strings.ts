import type { ItemLadders } from '../config';

/** What raising an item gives for one of its numbers, from its old value to its new one. */
export type Phrase = (from: number, to: number) => string;

/** An item's text: see STRINGS.items. */
interface ItemText<K extends keyof ItemLadders> {
  name: string;
  gain: string;
  gains: Partial<Record<keyof ItemLadders[K][number], Phrase>>;
}

const woundsFor: Phrase = (_from, to) => `wounds for ${to}`;

/** All player-facing text, kept in one place so it can be localized later. */
export const STRINGS = {
  title: 'MOROK',
  tagline: 'The night has only begun. The navii are already walking out of the fog.',
  start: 'Enter — step into the night',

  paused: 'Paused',
  resume: 'Esc — resume',

  death: 'Nav has claimed you',
  deathStats: (time: string, kills: number) => `You lasted ${time} · ${kills} laid to rest`,
  newRecord: 'Your longest night yet',
  bestTime: (time: string) => `Longest night: ${time}`,
  restart: 'Enter — try again',

  kills: 'laid to rest',
  level: 'Level',

  /** The level-up screen. */
  choose: 'The fire grows',
  /** On a card: an item not owned yet, or the level it rises to. */
  newItem: 'New',
  itemLevel: (level: number) => `Level ${level}`,

  /**
   * Each item's name, what gaining it does, and what raising it gives: one
   * phrase per number that changes, from its old value to its new one,
   * which a card joins into one line. The phrases are the item's own, since
   * the same number means different things for different items.
   */
  items: {
    stake: {
      name: 'Aspen stake',
      gain: 'Thrown the way you face',
      gains: {
        ways: (_from, to) => (to === 2 ? 'also thrown behind' : to === 4 ? 'thrown four ways' : `thrown ${to} ways`),
        damage: woundsFor,
        cooldown: (_from, to) => `thrown every ${to} s`,
        range: (from, to) => (to > from ? 'flies further' : 'flies less far'),
        pierce: (_from, to) => `pierces ${to} of the dead`,
      },
    },
    teeth: {
      name: 'Wolf teeth',
      gain: 'Fangs circle you and bite all they touch',
      gains: {
        count: (_from, to) => `${to} fangs`,
        damage: woundsFor,
        radius: (from, to) => (to > from ? 'circles wider' : 'circles closer'),
      },
    },
    hagStone: {
      name: 'Hag stone',
      gain: 'Draws sparks in from further away',
      gains: {
        pickupRadius: (from, to) => `draws sparks from ${Math.round((to / from) * 100) - 100}% further`,
      },
    },
  } satisfies { [K in keyof ItemLadders]: ItemText<K> },
};

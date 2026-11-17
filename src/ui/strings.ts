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

  /** Each item's name and what gaining it does. */
  items: {
    stake: { name: 'Aspen stake', gain: 'Thrown the way you face' },
    teeth: { name: 'Wolf teeth', gain: 'Fangs circle you and bite all they touch' },
    hagStone: { name: 'Hag stone', gain: 'Draws sparks in from further away' },
  },

  /**
   * What raising an item gives, one phrase per number that changes, from
   * its old value to its new one; a card joins them into one line.
   */
  gains: {
    ways: (_from: number, to: number) =>
      to === 2 ? 'also thrown behind' : to === 4 ? 'thrown four ways' : `thrown ${to} ways`,
    damage: (_from: number, to: number) => `wounds for ${to}`,
    cooldown: (_from: number, to: number) => `thrown every ${to} s`,
    range: (from: number, to: number) => (to > from ? 'flies further' : 'flies less far'),
    pierce: (_from: number, to: number) => `pierces ${to} of the dead`,
    count: (_from: number, to: number) => `${to} fangs`,
    radius: (from: number, to: number) => (to > from ? 'circles wider' : 'circles closer'),
    pickupRadius: (from: number, to: number) => `draws sparks from ${Math.round((to / from) * 100) - 100}% further`,
  },
};

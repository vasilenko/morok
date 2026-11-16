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

  hp: 'Life',
  kills: 'laid to rest',
};

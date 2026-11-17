import type { ItemLadders } from '../config';
import { STRINGS, type Phrase } from '../ui/strings';
import { itemStats, type ItemId, type Progress } from './progression';

/** What a level-up card shows for an item. */
export interface Card {
  id: ItemId;
  name: string;
  /** The level the item rises to if picked: 1 for an item not owned yet. */
  level: number;
  /** One line saying what that level gives. */
  line: string;
}

/** The card offering `id` at its next level. */
export function cardFor(progress: Progress, ladders: ItemLadders, id: ItemId): Card {
  const level = progress.items[id] + 1;
  const text = STRINGS.items[id];
  return { id, name: text.name, level, line: level === 1 ? text.gain : gainLine(ladders, id, level) };
}

/**
 * What rising to `level` gives: the item's phrase for every number that
 * changes from the level below, joined into one line that starts with a
 * capital.
 */
export function gainLine(ladders: ItemLadders, id: ItemId, level: number): string {
  const before = itemStats(ladders, id, level - 1) as Record<string, number> | null;
  const after = itemStats(ladders, id, level) as Record<string, number> | null;
  if (!before || !after) throw new Error(`${id} has no level ${level} to rise to`);
  const gains: Partial<Record<string, Phrase>> = STRINGS.items[id].gains;
  const phrases: string[] = [];
  for (const [stat, to] of Object.entries(after)) {
    const from = before[stat];
    if (from === to) continue;
    const phrase = gains[stat];
    if (!phrase) throw new Error(`no words for a change in the ${stat} of ${id}`);
    phrases.push(phrase(from, to));
  }
  const line = phrases.join(', ');
  return line.charAt(0).toUpperCase() + line.slice(1);
}

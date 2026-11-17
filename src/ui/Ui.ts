import bellUrl from '../art/sprites/item-bell.png';
import sickleUrl from '../art/sprites/item-sickle.png';
import hagStoneUrl from '../art/sprites/item-hag-stone.png';
import stakeUrl from '../art/sprites/item-stake.png';
import teethUrl from '../art/sprites/item-teeth.png';
import type { Card } from '../progression/cards';
import type { ItemId } from '../progression/progression';
import './ui.css';
import { STRINGS } from './strings';

export interface RunStats {
  /** Seconds survived. */
  elapsed: number;
  kills: number;
  level: number;
  /** Experience gathered towards the next level, and what that level costs. */
  levelXp: number;
  levelCost: number;
}

const byId = (id: string) => document.getElementById(id)!;

/** The items' pictures on the cards. */
const PICTURES: Record<ItemId, string> = {
  stake: stakeUrl,
  teeth: teethUrl,
  bell: bellUrl,
  sickle: sickleUrl,
  hagStone: hagStoneUrl,
};

/**
 * Milliseconds the cards ignore every pick after they appear, as long as
 * they take to fade in: the hero is fighting when they come up, and a click
 * or a key meant for the fight must not pick one.
 */
const CHOICE_GRACE = 300;

const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)');

export function formatTime(seconds: number): string {
  const whole = Math.floor(seconds);
  const mm = String(Math.floor(whole / 60)).padStart(2, '0');
  const ss = String(whole % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

/**
 * The DOM layer over the canvas: the in-run HUD and the title, pause,
 * level-up and death screens.
 */
class Ui {
  /** The player clicked a full-screen overlay. */
  onScreenClick: () => void = () => {};
  /** The player picked the card of this index on the level-up screen. */
  onPick: (index: number) => void = () => {};

  private readonly hud = byId('hud');
  private readonly timer = byId('timer');
  private readonly kills = byId('kills');
  private readonly level = byId('level');
  private readonly xpFill = byId('xpFill');
  private readonly xpFlash = byId('xpFlash');
  private readonly screen = byId('screen');
  /** When the cards on show became pickable, by performance.now(); null while none are shown. */
  private cardsFrom: number | null = null;
  private shown: Partial<Record<'timer' | 'kills' | 'level' | 'xp', string | number>> = {};

  constructor() {
    // The picture itself is set in index.html; its name is text, so it comes from the strings.
    (byId('killsIcon') as HTMLImageElement).alt = STRINGS.kills;
    this.screen.addEventListener('click', () => this.onScreenClick());
  }

  showTitle(): void {
    this.hud.classList.remove('on');
    this.setScreen([
      ['h1', '', STRINGS.title],
      ['p', '', STRINGS.tagline],
      ['div', 'cta', STRINGS.start],
    ]);
  }

  showPause(): void {
    this.setScreen([
      ['h1', 'small', STRINGS.paused],
      ['div', 'cta', STRINGS.resume],
    ]);
  }

  showDeath(stats: RunStats, bestTime: number, isRecord: boolean): void {
    this.setScreen([
      ['h1', 'small', STRINGS.death],
      ['p', '', STRINGS.deathStats(formatTime(stats.elapsed), stats.kills)],
      ['p', 'dim', isRecord ? STRINGS.newRecord : STRINGS.bestTime(formatTime(bestTime))],
      ['div', 'cta', STRINGS.restart],
    ]);
  }

  /** The level-up screen: up to three cards, picked by a click or by the keys 1 to 3. */
  showChoice(cards: readonly Card[]): void {
    const title = document.createElement('h1');
    title.className = 'small';
    title.textContent = STRINGS.choose;
    const row = document.createElement('div');
    row.className = 'cards';
    row.append(...cards.map((card, index) => this.card(card, index)));
    this.screen.replaceChildren(title, row);
    this.screen.classList.add('on', 'choice');
    this.cardsFrom = performance.now() + CHOICE_GRACE;
  }

  /** Picks the card of `index`, unless no cards are shown, there is no such card or they have only just appeared. */
  pickCard(index: number): void {
    if (this.cardsFrom === null || performance.now() < this.cardsFrom) return;
    if (index < 0 || index >= this.screen.querySelectorAll('.card').length) return;
    this.cardsFrom = null;
    this.onPick(index);
  }

  /** Hides any overlay screen and shows the HUD. */
  showRun(): void {
    this.hud.classList.add('on');
    this.screen.classList.remove('on', 'choice');
    this.cardsFrom = null;
  }

  /** Refreshes the HUD, touching the DOM only for values that changed. */
  update(stats: RunStats): void {
    const time = formatTime(stats.elapsed);
    if (time !== this.shown.timer) {
      this.timer.textContent = this.shown.timer = time;
    }
    if (stats.kills !== this.shown.kills) {
      this.kills.textContent = String((this.shown.kills = stats.kills));
    }
    const filled = Math.min(1, stats.levelXp / stats.levelCost);
    if (stats.level !== this.shown.level) {
      // A new level starts the bar afresh, rather than draining it back.
      this.xpFill.classList.add('snap');
      this.fillXp((this.shown.xp = filled));
      void this.xpFill.offsetWidth;
      this.xpFill.classList.remove('snap');
      this.shown.level = stats.level;
      const number = document.createElement('span');
      number.textContent = String(stats.level);
      this.level.replaceChildren(STRINGS.level, number);
    } else if (filled !== this.shown.xp) {
      if (filled > (this.shown.xp as number)) this.flashXp();
      this.fillXp((this.shown.xp = filled));
    }
  }

  private fillXp(filled: number): void {
    this.xpFill.style.transform = `translateX(${(filled - 1) * 100}%)`;
  }

  /** A brief flare over the fill, so a gain is noticed; each gain starts it over. */
  private flashXp(): void {
    if (REDUCED_MOTION.matches) return;
    for (const flash of this.xpFlash.getAnimations()) flash.cancel();
    this.xpFlash.animate([{ opacity: 0.7 }, { opacity: 0 }], { duration: 450, easing: 'ease-out' });
  }

  private card(card: Card, index: number): HTMLElement {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'card';
    // Out of the tab order, so a held Space or Enter can never press it.
    el.tabIndex = -1;
    el.style.setProperty('--i', String(index));
    const picture = document.createElement('img');
    picture.src = PICTURES[card.id];
    picture.alt = '';
    const text = (className: string, content: string) => {
      const span = document.createElement('span');
      span.className = className;
      span.textContent = content;
      return span;
    };
    el.append(
      text('key', String(index + 1)),
      picture,
      text('name', card.name),
      text(card.level === 1 ? 'rank new' : 'rank', card.level === 1 ? STRINGS.newItem : STRINGS.itemLevel(card.level)),
      text('line', card.line),
    );
    el.addEventListener('click', (event) => {
      event.stopPropagation();
      this.pickCard(index);
    });
    return el;
  }

  private setScreen(lines: Array<[tag: string, className: string, text: string]>): void {
    this.screen.replaceChildren(
      ...lines.map(([tag, className, text]) => {
        const el = document.createElement(tag);
        if (className) el.className = className;
        el.textContent = text;
        return el;
      }),
    );
    this.screen.classList.remove('choice');
    this.screen.classList.add('on');
    this.cardsFrom = null;
  }
}

export const ui = new Ui();

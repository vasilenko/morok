import './ui.css';
import { STRINGS } from './strings';

export interface RunStats {
  /** Seconds survived. */
  elapsed: number;
  kills: number;
  hp: number;
  maxHp: number;
}

const byId = (id: string) => document.getElementById(id)!;

export function formatTime(seconds: number): string {
  const whole = Math.floor(seconds);
  const mm = String(Math.floor(whole / 60)).padStart(2, '0');
  const ss = String(whole % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

/**
 * The DOM layer over the canvas: the in-run HUD and the title, pause and
 * death screens.
 */
class Ui {
  /** The player clicked a full-screen overlay. */
  onScreenClick: () => void = () => {};

  private readonly hud = byId('hud');
  private readonly hpFill = byId('hpFill');
  private readonly timer = byId('timer');
  private readonly kills = byId('kills');
  private readonly screen = byId('screen');
  private shown: Partial<Record<'timer' | 'kills' | 'hp', string | number>> = {};

  constructor() {
    byId('hpLabel').textContent = STRINGS.hp;
    byId('killsLabel').textContent = STRINGS.kills;
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

  /** Hides any overlay screen and shows the HUD. */
  showRun(): void {
    this.hud.classList.add('on');
    this.screen.classList.remove('on');
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
    if (stats.hp !== this.shown.hp) {
      this.shown.hp = stats.hp;
      this.hpFill.style.transform = `scaleX(${stats.hp / stats.maxHp})`;
    }
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
    this.screen.classList.add('on');
  }
}

export const ui = new Ui();

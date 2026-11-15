import './ui.css';
import { STRINGS } from './strings';

export interface RunStats {
  /** Seconds survived. */
  elapsed: number;
  kills: number;
  wave: number;
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
 * The DOM layer over the canvas: the in-run HUD, the wave banner and the
 * title, pause and death screens.
 */
class Ui {
  /** The player clicked a full-screen overlay. */
  onScreenClick: () => void = () => {};

  private readonly hud = byId('hud');
  private readonly hpFill = byId('hpFill');
  private readonly timer = byId('timer');
  private readonly waveLabel = byId('waveLabel');
  private readonly kills = byId('kills');
  private readonly bannerEl = byId('banner');
  private readonly screen = byId('screen');
  private shown: Partial<Record<'timer' | 'kills' | 'hp' | 'wave', string | number>> = {};

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
      ['p', 'dim', STRINGS.controls],
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
      ['p', '', STRINGS.deathStats(formatTime(stats.elapsed), stats.wave, stats.kills)],
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
    if (stats.wave !== this.shown.wave) {
      this.shown.wave = stats.wave;
      this.waveLabel.textContent = stats.wave === 0 ? STRINGS.dusk : STRINGS.wave(stats.wave);
    }
  }

  /** Announces a wave in large letters that fade on their own. */
  banner(text: string): void {
    this.bannerEl.textContent = text;
    this.bannerEl.classList.remove('show');
    void this.bannerEl.offsetWidth; // restart the CSS animation
    this.bannerEl.classList.add('show');
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

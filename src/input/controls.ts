type Direction = 'up' | 'down' | 'left' | 'right';

/** Physical key positions, so movement works on any keyboard layout. */
const MOVE_KEYS: Record<string, Direction> = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
};

/** The keys that pick a card on the level-up screen, by the card's index. */
const CHOICE_KEYS: Record<string, number> = {
  Digit1: 0,
  Digit2: 1,
  Digit3: 2,
  Numpad1: 0,
  Numpad2: 1,
  Numpad3: 2,
};

/**
 * Keyboard state shared by the whole game. Lives outside Phaser's scene input
 * so that it keeps working while a scene is paused.
 */
class Controls {
  /** Enter or Space: start, resume or restart. */
  onAdvance: () => void = () => {};
  /** Escape or P. */
  onPause: () => void = () => {};
  /** 1, 2 or 3: pick the card of that index. */
  onChoose: (index: number) => void = () => {};
  /** The window lost focus. */
  onBlur: () => void = () => {};

  private readonly held: Record<Direction, boolean> = { up: false, down: false, left: false, right: false };

  constructor() {
    window.addEventListener('keydown', (event) => {
      const direction = MOVE_KEYS[event.code];
      if (direction) {
        this.held[direction] = true;
        event.preventDefault();
      }
      if (event.repeat) return;
      if (event.code === 'Enter' || event.code === 'Space') {
        event.preventDefault();
        this.onAdvance();
      } else if (event.code === 'Escape' || event.code === 'KeyP') {
        this.onPause();
      } else if (event.code in CHOICE_KEYS) {
        this.onChoose(CHOICE_KEYS[event.code]);
      }
    });

    window.addEventListener('keyup', (event) => {
      const direction = MOVE_KEYS[event.code];
      if (direction) this.held[direction] = false;
    });

    window.addEventListener('blur', () => {
      this.held.up = this.held.down = this.held.left = this.held.right = false;
      this.onBlur();
    });
  }

  /** -1, 0 or 1. */
  get moveX(): number {
    return (this.held.right ? 1 : 0) - (this.held.left ? 1 : 0);
  }

  /** -1, 0 or 1; positive is down the screen. */
  get moveY(): number {
    return (this.held.down ? 1 : 0) - (this.held.up ? 1 : 0);
  }
}

export const controls = new Controls();

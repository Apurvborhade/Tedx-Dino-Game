// ════════════════════════════════════════════════════════════════════════════
// Input.ts — Unified touch/mouse/keyboard → jump signals
// ════════════════════════════════════════════════════════════════════════════

import { PHYSICS } from '../config';

/** A touch that travels this far downward before it is classified counts as
 *  a duck rather than a jump. */
const SWIPE_DOWN_PX = 14;
/** How long a touch may stay unclassified before it is treated as a jump.
 *  Short enough to feel instant, long enough to catch a swipe's first moves. */
const TAP_CLASSIFY_MS = 45;

type PointerMode = 'PENDING' | 'JUMP' | 'DUCK' | null;

export class Input {
  jumpPressed = false;
  jumpHeld = false;
  jumpReleased = false;
  /** Duck (ground) / fast-fall (air) is held: ↓ / S, or a downward swipe held */
  duckHeld = false;

  /** Time since last jump press, for jump buffering */
  timeSinceJumpPress = Infinity;

  private _jumpDown = false;
  private _jumpWasDown = false;
  private _keyDuckDown = false;
  private _pointerDuckDown = false;

  // Touch gesture classification
  private pointerMode: PointerMode = null;
  private pointerStartY = 0;
  private pointerStartTime = 0;
  /** A quick tap: jump for exactly one step, then release */
  private tapRelease = false;

  /** Elements that should NOT trigger jump on tap (buttons, inputs, etc.) */
  private ignoreElements = new Set<HTMLElement>();

  /** Callback for first user gesture (audio context init) */
  onFirstGesture: (() => void) | null = null;
  private firstGestureFired = false;

  constructor(gameRoot: HTMLElement) {
    // Keyboard
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);

    // Pointer (covers touch + mouse)
    gameRoot.addEventListener('pointerdown', this.onPointerDown);
    gameRoot.addEventListener('pointermove', this.onPointerMove);
    gameRoot.addEventListener('pointerup', this.onPointerUp);
    gameRoot.addEventListener('pointercancel', this.onPointerUp);

    // Prevent context menu on long press
    gameRoot.addEventListener('contextmenu', (e) => e.preventDefault());

    // Prevent rubber-band scrolling
    gameRoot.addEventListener('touchmove', (e) => {
      if (!this.isInteractive(e.target)) e.preventDefault();
    }, { passive: false });
  }

  /** Register an element that should not trigger jumps */
  addIgnored(el: HTMLElement): void {
    this.ignoreElements.add(el);
  }

  removeIgnored(el: HTMLElement): void {
    this.ignoreElements.delete(el);
  }

  /** Call at the start of each simulation step */
  update(dt: number): void {
    // A touch that hasn't swiped down within the window is a jump
    if (this.pointerMode === 'PENDING' && performance.now() - this.pointerStartTime >= TAP_CLASSIFY_MS) {
      this.pointerMode = 'JUMP';
      this._jumpDown = true;
      this.fireFirstGesture();
    }

    this.jumpPressed = this._jumpDown && !this._jumpWasDown;
    this.jumpReleased = !this._jumpDown && this._jumpWasDown;
    this.jumpHeld = this._jumpDown;
    this._jumpWasDown = this._jumpDown;

    if (this.jumpPressed) {
      this.timeSinceJumpPress = 0;
    } else {
      this.timeSinceJumpPress += dt;
    }

    this.duckHeld = this._keyDuckDown || this._pointerDuckDown;

    // Quick tap: registered as pressed this step, released for the next
    if (this.tapRelease) {
      this.tapRelease = false;
      this._jumpDown = false;
    }
  }

  /** Check if jump was pressed within buffer window */
  hasBufferedJump(): boolean {
    return this.timeSinceJumpPress <= PHYSICS.JUMP_BUFFER;
  }

  /** Consume the buffered jump */
  consumeJump(): void {
    this.timeSinceJumpPress = Infinity;
    this._jumpWasDown = true; // prevent re-trigger
  }

  private fireFirstGesture(): void {
    if (!this.firstGestureFired && this.onFirstGesture) {
      this.firstGestureFired = true;
      this.onFirstGesture();
    }
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.repeat) return;
    // Let text fields and focused buttons keep Space/Enter
    if (this.isInteractive(e.target)) return;
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault();
      this._jumpDown = true;
      this.fireFirstGesture();
    } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      e.preventDefault();
      this._keyDuckDown = true;
      this.fireFirstGesture();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      this._jumpDown = false;
    } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      this._keyDuckDown = false;
    }
  };

  private onPointerDown = (e: PointerEvent): void => {
    // Only the primary button/finger counts
    if (e.button !== 0) return;
    if (this.isInteractive(e.target)) return;
    // Don't classify yet: a downward swipe in the next few ms means duck,
    // anything else means jump.
    this.pointerMode = 'PENDING';
    this.pointerStartY = e.clientY;
    this.pointerStartTime = performance.now();
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (this.pointerMode !== 'PENDING') return;
    if (e.clientY - this.pointerStartY >= SWIPE_DOWN_PX) {
      this.pointerMode = 'DUCK';
      this._pointerDuckDown = true;
      this.fireFirstGesture();
    }
  };

  /** True when the tap landed on a control that should get the click instead
   *  of the game (buttons, inputs, scrollable lists, explicitly ignored nodes). */
  private isInteractive(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false;
    if (target.closest('button, a, input, select, textarea, label, [data-no-jump]')) {
      return true;
    }
    for (const ignored of this.ignoreElements) {
      if (ignored === target || ignored.contains(target)) return true;
    }
    return false;
  }

  private onPointerUp = (_e: PointerEvent): void => {
    switch (this.pointerMode) {
      case 'PENDING':
        // Released before classification: a quick tap → one-step jump press
        this._jumpDown = true;
        this.tapRelease = true;
        this.fireFirstGesture();
        break;
      case 'JUMP':
        this._jumpDown = false;
        break;
      case 'DUCK':
        this._pointerDuckDown = false;
        break;
    }
    this.pointerMode = null;
  };

  /** Reset between runs */
  reset(): void {
    this._jumpDown = false;
    this._jumpWasDown = false;
    this._keyDuckDown = false;
    this._pointerDuckDown = false;
    this.pointerMode = null;
    this.tapRelease = false;
    this.jumpPressed = false;
    this.jumpHeld = false;
    this.jumpReleased = false;
    this.duckHeld = false;
    this.timeSinceJumpPress = Infinity;
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Input.ts — Unified touch/mouse/keyboard → jump signals
// ════════════════════════════════════════════════════════════════════════════

import { PHYSICS } from '../config';

export class Input {
  jumpPressed = false;
  jumpHeld = false;
  jumpReleased = false;

  /** Time since last jump press, for jump buffering */
  timeSinceJumpPress = Infinity;

  private _jumpDown = false;
  private _jumpWasDown = false;
  private pointerDown = false;
  /** A tap that began and ended within one step: keep the press for exactly
   *  one step, then release */
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
    this.jumpPressed = this._jumpDown && !this._jumpWasDown;
    this.jumpReleased = !this._jumpDown && this._jumpWasDown;
    this.jumpHeld = this._jumpDown;
    this._jumpWasDown = this._jumpDown;

    if (this.jumpPressed) {
      this.timeSinceJumpPress = 0;
    } else {
      this.timeSinceJumpPress += dt;
    }

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
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      this._jumpDown = false;
    }
  };

  private onPointerDown = (e: PointerEvent): void => {
    // Only the primary button/finger counts
    if (e.button !== 0) return;
    if (this.isInteractive(e.target)) return;
    this.pointerDown = true;
    this._jumpDown = true;
    this.fireFirstGesture();
  };

  private onPointerUp = (_e: PointerEvent): void => {
    if (!this.pointerDown) return;
    this.pointerDown = false;
    if (!this._jumpWasDown) {
      // Released before a step saw the press: keep it for one step
      this.tapRelease = true;
    } else {
      this._jumpDown = false;
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

  /** Reset between runs */
  reset(): void {
    this._jumpDown = false;
    this._jumpWasDown = false;
    this.pointerDown = false;
    this.tapRelease = false;
    this.jumpPressed = false;
    this.jumpHeld = false;
    this.jumpReleased = false;
    this.timeSinceJumpPress = Infinity;
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }
}

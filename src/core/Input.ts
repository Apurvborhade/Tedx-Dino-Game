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
    gameRoot.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
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
    // Check if the target is an ignored element (buttons, inputs)
    const target = e.target as HTMLElement;
    for (const ignored of this.ignoreElements) {
      if (ignored === target || ignored.contains(target)) {
        return;
      }
    }
    this._jumpDown = true;
    this.fireFirstGesture();
  };

  private onPointerUp = (_e: PointerEvent): void => {
    this._jumpDown = false;
  };

  /** Reset between runs */
  reset(): void {
    this._jumpDown = false;
    this._jumpWasDown = false;
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

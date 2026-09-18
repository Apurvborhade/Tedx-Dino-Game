// ════════════════════════════════════════════════════════════════════════════
// Loop.ts — Fixed-timestep game loop with accumulator
// ════════════════════════════════════════════════════════════════════════════

import { LOOP } from '../config';

export type UpdateFn = (dt: number) => void;
export type RenderFn = (alpha: number) => void;

export class Loop {
  private accumulator = 0;
  private lastTime = 0;
  private rafId = 0;
  private running = false;
  private updateFn: UpdateFn;
  private renderFn: RenderFn;
  paused = false;

  constructor(updateFn: UpdateFn, renderFn: RenderFn) {
    this.updateFn = updateFn;
    this.renderFn = renderFn;

    document.addEventListener('visibilitychange', this.onVisibility);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now() / 1000;
    this.accumulator = 0;
    this.rafId = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  private tick = (nowMs: number): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.tick);

    const now = nowMs / 1000;
    const frameDt = Math.min(now - this.lastTime, LOOP.MAX_FRAME_DT);
    this.lastTime = now;

    if (this.paused) {
      this.renderFn(0);
      return;
    }

    this.accumulator += frameDt;

    let steps = 0;
    while (this.accumulator >= LOOP.FIXED_DT && steps < LOOP.MAX_STEPS_PER_FRAME) {
      this.updateFn(LOOP.FIXED_DT);
      this.accumulator -= LOOP.FIXED_DT;
      steps++;
    }

    // Give up on remaining accumulator to prevent spiral of death
    if (steps === LOOP.MAX_STEPS_PER_FRAME) {
      this.accumulator = 0;
    }

    // Alpha for interpolation
    const alpha = this.accumulator / LOOP.FIXED_DT;
    this.renderFn(alpha);
  };

  private onVisibility = (): void => {
    if (document.hidden) {
      this.paused = true;
    } else {
      // Reset timing to avoid spiral of death on resume
      this.lastTime = performance.now() / 1000;
      this.accumulator = 0;
      this.paused = false;
    }
  };

  destroy(): void {
    this.stop();
    document.removeEventListener('visibilitychange', this.onVisibility);
  }
}

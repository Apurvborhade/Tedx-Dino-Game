// ════════════════════════════════════════════════════════════════════════════
// Difficulty.ts — Score → speed, spawn interval, gap sizing
// ════════════════════════════════════════════════════════════════════════════

import { SPEED, HARD_MODE } from '../config';

export class Difficulty {
  speed: number = SPEED.INITIAL;
  /** True once the run has passed HARD_MODE.START_SCORE */
  hard = false;
  private elapsed = 0;
  /** 0-1 blend of the hard-mode speed bonus */
  private hardBlend = 0;

  reset(): void {
    this.speed = SPEED.INITIAL;
    this.hard = false;
    this.elapsed = 0;
    this.hardBlend = 0;
  }

  update(dt: number, score = 0): { speedChanged: boolean; hardModeStarted: boolean } {
    const prevSpeed = this.speed;
    this.elapsed += dt;

    let hardModeStarted = false;
    if (!this.hard && score >= HARD_MODE.START_SCORE) {
      this.hard = true;
      hardModeStarted = true;
    }
    if (this.hard && this.hardBlend < 1) {
      this.hardBlend = Math.min(1, this.hardBlend + dt / HARD_MODE.RAMP_SECONDS);
    }

    this.speed = Difficulty.speedAtTime(this.elapsed) + HARD_MODE.SPEED_BONUS * this.hardBlend;

    return { speedChanged: Math.abs(this.speed - prevSpeed) > 0.5, hardModeStarted };
  }

  /** Get current speed for a given elapsed time (for validation) */
  static speedAtTime(elapsedSeconds: number): number {
    if (SPEED.USE_EXPONENTIAL) {
      return SPEED.MAX - (SPEED.MAX - SPEED.INITIAL) * Math.exp(-SPEED.EXP_K * elapsedSeconds);
    }
    return Math.min(SPEED.INITIAL + SPEED.ACCEL * elapsedSeconds, SPEED.MAX);
  }

  /** Compute maximum achievable score for a given duration (for server validation) */
  static maxScoreForDuration(durationMs: number): number {
    const dt = 0.01; // integration step
    const totalTime = durationMs / 1000;
    let distance = 0;
    let t = 0;

    while (t < totalTime) {
      const step = Math.min(dt, totalTime - t);
      // Assume the hard-mode bonus for the whole run: a conservative upper bound
      const speed = Difficulty.speedAtTime(t) + HARD_MODE.SPEED_BONUS;
      distance += speed * step;
      t += step;
    }

    // score = distance * UNITS_PER_PX (imported from config)
    return Math.floor(distance * 0.025);
  }
}

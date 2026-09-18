// ════════════════════════════════════════════════════════════════════════════
// Difficulty.ts — Score → speed, spawn interval, gap sizing
// ════════════════════════════════════════════════════════════════════════════

import { SPEED } from '../config';

export class Difficulty {
  speed: number = SPEED.INITIAL;
  private elapsed = 0;

  reset(): void {
    this.speed = SPEED.INITIAL;
    this.elapsed = 0;
  }

  update(dt: number): { speedChanged: boolean } {
    const prevSpeed = this.speed;
    this.elapsed += dt;

    if (SPEED.USE_EXPONENTIAL) {
      // Asymptotic curve: approaches MAX smoothly
      this.speed = SPEED.MAX - (SPEED.MAX - SPEED.INITIAL) * Math.exp(-SPEED.EXP_K * this.elapsed);
    } else {
      // Linear acceleration
      this.speed = Math.min(SPEED.INITIAL + SPEED.ACCEL * this.elapsed, SPEED.MAX);
    }

    return { speedChanged: Math.abs(this.speed - prevSpeed) > 0.5 };
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
      const speed = Difficulty.speedAtTime(t);
      distance += speed * step;
      t += step;
    }

    // score = distance * UNITS_PER_PX (imported from config)
    return Math.floor(distance * 0.025);
  }
}

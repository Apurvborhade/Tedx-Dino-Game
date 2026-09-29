// ════════════════════════════════════════════════════════════════════════════
// Difficulty.ts — Score → speed, spawn interval, gap sizing
// ════════════════════════════════════════════════════════════════════════════

import { SPEED, HARD_MODE, ENDGAME_MODE } from '../config';

export class Difficulty {
  speed: number = SPEED.INITIAL;
  /** True once the run has passed HARD_MODE.START_SCORE */
  hard = false;
  /** True once the run has passed SPEED.SURGE_START_SCORE */
  surge = false;
  /** True once the run has passed ENDGAME_MODE.START_SCORE (1500) */
  endgame = false;
  private elapsed = 0;
  /** 0-1 blend of the hard-mode speed bonus */
  private hardBlend = 0;
  /** Seconds spent in the surge tier — the base curve has flattened by then,
   *  so this is what keeps the run getting faster. */
  private surgeTime = 0;
  /** Seconds spent in the endgame tier (score >= 1500) */
  private endgameTime = 0;

  reset(): void {
    this.speed = SPEED.INITIAL;
    this.hard = false;
    this.surge = false;
    this.endgame = false;
    this.elapsed = 0;
    this.hardBlend = 0;
    this.surgeTime = 0;
    this.endgameTime = 0;
  }

  update(dt: number, score = 0): {
    speedChanged: boolean;
    hardModeStarted: boolean;
    surgeStarted: boolean;
    endgameStarted: boolean;
  } {
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

    let surgeStarted = false;
    if (score >= SPEED.SURGE_START_SCORE) {
      if (!this.surge) {
        this.surge = true;
        surgeStarted = true;
      }
      this.surgeTime += dt;
    }

    let endgameStarted = false;
    if (score >= ENDGAME_MODE.START_SCORE) {
      if (!this.endgame) {
        this.endgame = true;
        endgameStarted = true;
      }
      this.endgameTime += dt;
    }

    const surgeSpeed = Math.min(
      Difficulty.speedAtTime(this.elapsed)
        + HARD_MODE.SPEED_BONUS * this.hardBlend
        + SPEED.SURGE_ACCEL * this.surgeTime,
      SPEED.SURGE_MAX,
    );

    if (this.endgame) {
      this.speed = Math.min(
        surgeSpeed + ENDGAME_MODE.SPEED_ACCEL * this.endgameTime,
        ENDGAME_MODE.SPEED_MAX,
      );
    } else {
      this.speed = surgeSpeed;
    }

    return {
      speedChanged: Math.abs(this.speed - prevSpeed) > 0.5,
      hardModeStarted,
      surgeStarted,
      endgameStarted,
    };
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
      // Assume the hard-mode bonus, surge, and endgame acceleration:
      const surgeSpeed = Math.min(
        Difficulty.speedAtTime(t) + HARD_MODE.SPEED_BONUS + SPEED.SURGE_ACCEL * t,
        SPEED.SURGE_MAX,
      );
      const speed = Math.min(
        surgeSpeed + ENDGAME_MODE.SPEED_ACCEL * t,
        ENDGAME_MODE.SPEED_MAX,
      );
      distance += speed * step;
      t += step;
    }

    // score = distance * UNITS_PER_PX (imported from config)
    return Math.floor(distance * 0.025);
  }
}

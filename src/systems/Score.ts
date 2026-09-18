// ════════════════════════════════════════════════════════════════════════════
// Score.ts — Distance → score, high score, localStorage
// ════════════════════════════════════════════════════════════════════════════

import { SCORE_CONFIG } from '../config';
import { safeGetItem, safeSetItem } from './storage';

const HI_KEY = 'kalachakra.hi';

export class Score {
  value = 0;
  highScore = 0;
  isNewBest = false;

  // Milestone flash
  milestoneFlashing = false;
  private milestoneFlashTimer = 0;
  private milestoneFlashVisible = true;
  private lastMilestone = 0;

  constructor() {
    this.highScore = parseInt(safeGetItem(HI_KEY) || '0', 10) || 0;
  }

  reset(): void {
    this.value = 0;
    this.isNewBest = false;
    this.milestoneFlashing = false;
    this.milestoneFlashTimer = 0;
    this.milestoneFlashVisible = true;
    this.lastMilestone = 0;
  }

  update(distanceTravelled: number, dt: number): { milestone: boolean } {
    this.value = Math.floor(distanceTravelled * SCORE_CONFIG.UNITS_PER_PX);

    // Check milestone
    let milestone = false;
    const currentMilestone = Math.floor(this.value / SCORE_CONFIG.MILESTONE_EVERY);
    if (currentMilestone > this.lastMilestone && this.value > 0) {
      this.lastMilestone = currentMilestone;
      milestone = true;
      this.milestoneFlashing = true;
      this.milestoneFlashTimer = 0.5;
      this.milestoneFlashVisible = true;
    }

    // Animate milestone flash
    if (this.milestoneFlashing) {
      this.milestoneFlashTimer -= dt;
      // 4 cycles over 0.5s = cycle period ~0.125s
      this.milestoneFlashVisible = Math.floor(this.milestoneFlashTimer / 0.0625) % 2 === 0;
      if (this.milestoneFlashTimer <= 0) {
        this.milestoneFlashing = false;
        this.milestoneFlashVisible = true;
      }
    }

    return { milestone };
  }

  /** Call on game over */
  finalize(): void {
    if (this.value > this.highScore) {
      this.highScore = this.value;
      this.isNewBest = true;
      safeSetItem(HI_KEY, String(this.highScore));
    }
  }

  /** Format score as zero-padded string */
  format(val?: number): string {
    const v = val ?? this.value;
    return String(v).padStart(SCORE_CONFIG.DIGITS, '0');
  }

  /** Whether the score text should be visible right now (for milestone flash) */
  isVisible(): boolean {
    return this.milestoneFlashVisible;
  }
}

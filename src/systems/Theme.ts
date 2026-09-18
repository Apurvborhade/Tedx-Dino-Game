// ════════════════════════════════════════════════════════════════════════════
// Theme.ts — Score → {era, timeOfDay} + transition easing
// ════════════════════════════════════════════════════════════════════════════

import { THEME_THRESHOLDS } from '../config';
import type { Era } from '../entities/Ground';
import type { TimeOfDay } from '../entities/Backdrop';

export interface Palette {
  ink: string;
  paper: string;
  inkR: number; inkG: number; inkB: number;
  paperR: number; paperG: number; paperB: number;
}

const DAY_PALETTE: Palette = {
  ink: '#1a1a1a', paper: '#f7f7f7',
  inkR: 26, inkG: 26, inkB: 26,
  paperR: 247, paperG: 247, paperB: 247,
};

const NIGHT_PALETTE: Palette = {
  ink: '#f2f2f2', paper: '#141414',
  inkR: 242, inkG: 242, inkB: 242,
  paperR: 20, paperG: 20, paperB: 20,
};

export class Theme {
  era: Era = 'PAST';
  timeOfDay: TimeOfDay = { phase: 'DAY', transition: 0 };
  palette: Palette = { ...DAY_PALETTE };

  private eraTransitionProgress = 1; // 1 = done
  private prevNightFactor = 0;

  // Dither band for sunset
  ditherY = -1; // -1 means no dither band active
  ditherActive = false;

  // Twinkling stars
  twinklePhase = 0;

  reset(): void {
    this.era = 'PAST';
    this.timeOfDay = { phase: 'DAY', transition: 0 };
    this.palette = { ...DAY_PALETTE };
    this.eraTransitionProgress = 1;
    this.prevNightFactor = 0;
    this.ditherY = -1;
    this.ditherActive = false;
    this.twinklePhase = 0;
  }

  update(score: number, dt: number): { eraChanged: boolean; paletteChanged: boolean } {
    // ── Era ──
    let newEra: Era = 'PAST';
    if (score >= THEME_THRESHOLDS.FUTURE) {
      newEra = 'FUTURE';
    } else if (score >= THEME_THRESHOLDS.PRESENT) {
      newEra = 'PRESENT';
    }

    let eraChanged = false;
    if (newEra !== this.era) {
      this.era = newEra;
      this.eraTransitionProgress = 0;
      eraChanged = true;
    }

    if (this.eraTransitionProgress < 1) {
      this.eraTransitionProgress = Math.min(1, this.eraTransitionProgress + dt / 2.0);
    }

    // ── Day/Night ──
    // Cycles independently based on score
    const cyclePos = ((score - THEME_THRESHOLDS.NIGHT_START) % THEME_THRESHOLDS.CYCLE_LENGTH + THEME_THRESHOLDS.CYCLE_LENGTH) % THEME_THRESHOLDS.CYCLE_LENGTH;
    const halfCycle = THEME_THRESHOLDS.CYCLE_LENGTH / 2;

    let nightFactor: number;
    const transitionScoreWidth = 100; // score units for transition

    if (score < THEME_THRESHOLDS.NIGHT_START) {
      nightFactor = 0;
    } else if (cyclePos < transitionScoreWidth) {
      // Transitioning to night
      nightFactor = cyclePos / transitionScoreWidth;
    } else if (cyclePos < halfCycle - transitionScoreWidth) {
      // Full night
      nightFactor = 1;
    } else if (cyclePos < halfCycle + transitionScoreWidth) {
      // Transitioning to day
      nightFactor = 1 - (cyclePos - halfCycle + transitionScoreWidth) / (transitionScoreWidth * 2);
    } else if (cyclePos < THEME_THRESHOLDS.CYCLE_LENGTH - transitionScoreWidth) {
      // Full day
      nightFactor = 0;
    } else {
      // Transitioning to night again
      nightFactor = (cyclePos - (THEME_THRESHOLDS.CYCLE_LENGTH - transitionScoreWidth)) / transitionScoreWidth;
    }

    nightFactor = Math.max(0, Math.min(1, nightFactor));

    // Determine phase
    if (nightFactor > 0.95) {
      this.timeOfDay = { phase: 'NIGHT', transition: 1 };
    } else if (nightFactor < 0.05) {
      this.timeOfDay = { phase: 'DAY', transition: 0 };
    } else {
      this.timeOfDay = { phase: 'SUNSET', transition: nightFactor };
    }

    // Dither band during transition
    if (this.timeOfDay.phase === 'SUNSET') {
      this.ditherActive = true;
      this.ditherY = Math.round(nightFactor * 240); // sweeps top to bottom
    } else {
      this.ditherActive = false;
      this.ditherY = -1;
    }

    // ── Palette interpolation ──
    let paletteChanged = false;
    if (Math.abs(nightFactor - this.prevNightFactor) > 0.005) {
      this.palette = lerpPalette(DAY_PALETTE, NIGHT_PALETTE, nightFactor);
      this.prevNightFactor = nightFactor;
      paletteChanged = true;
    }

    // Twinkle animation
    if (this.timeOfDay.phase === 'NIGHT' || this.timeOfDay.phase === 'SUNSET') {
      this.twinklePhase = (this.twinklePhase + dt / 0.8) % 1;
    }

    return { eraChanged, paletteChanged };
  }

  isNight(): boolean {
    return this.timeOfDay.phase === 'NIGHT';
  }

  getEraTransitionProgress(): number {
    return this.eraTransitionProgress;
  }
}

function lerpPalette(a: Palette, b: Palette, t: number): Palette {
  const inkR = Math.round(a.inkR + (b.inkR - a.inkR) * t);
  const inkG = Math.round(a.inkG + (b.inkG - a.inkG) * t);
  const inkB = Math.round(a.inkB + (b.inkB - a.inkB) * t);
  const paperR = Math.round(a.paperR + (b.paperR - a.paperR) * t);
  const paperG = Math.round(a.paperG + (b.paperG - a.paperG) * t);
  const paperB = Math.round(a.paperB + (b.paperB - a.paperB) * t);

  return {
    ink: `rgb(${inkR},${inkG},${inkB})`,
    paper: `rgb(${paperR},${paperG},${paperB})`,
    inkR, inkG, inkB,
    paperR, paperG, paperB,
  };
}

export { DAY_PALETTE, NIGHT_PALETTE };

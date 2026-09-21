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

// Tuned to the painted plates in public/game-bg: warm sand + dark umber by
// day, deep indigo + moonlit cream by night.
const DAY_PALETTE: Palette = {
  ink: '#2a1e14', paper: '#ecdcb6',
  inkR: 42, inkG: 30, inkB: 20,
  paperR: 236, paperG: 220, paperB: 182,
};

const NIGHT_PALETTE: Palette = {
  ink: '#f0e6c8', paper: '#0b0d1a',
  inkR: 240, inkG: 230, inkB: 200,
  paperR: 11, paperG: 13, paperB: 26,
};

export class Theme {
  era: Era = 'PAST';
  timeOfDay: TimeOfDay = { phase: 'DAY', transition: 0 };
  palette: Palette = { ...DAY_PALETTE };
  /** Eased 0 = full day → 1 = full night; drives backdrop crossfade + palette */
  nightFactor = 0;

  private eraTransitionProgress = 1; // 1 = done
  /** Linear 0-1 progress of the current day/night fade (time-based) */
  private nightBlend = 0;
  private prevNightFactor = 0;

  reset(): void {
    this.era = 'PAST';
    this.timeOfDay = { phase: 'DAY', transition: 0 };
    this.palette = { ...DAY_PALETTE };
    this.nightFactor = 0;
    this.eraTransitionProgress = 1;
    this.nightBlend = 0;
    this.prevNightFactor = 0;
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
    // Score decides which half of the cycle we're in; the actual blend is
    // animated over TRANSITION_DURATION seconds so the switch is a quick,
    // smooth fade rather than a slow drift tied to distance.
    const cyclePos = ((score - THEME_THRESHOLDS.NIGHT_START) % THEME_THRESHOLDS.CYCLE_LENGTH + THEME_THRESHOLDS.CYCLE_LENGTH) % THEME_THRESHOLDS.CYCLE_LENGTH;
    const wantNight = score >= THEME_THRESHOLDS.NIGHT_START && cyclePos < THEME_THRESHOLDS.CYCLE_LENGTH / 2;

    const step = dt / THEME_THRESHOLDS.TRANSITION_DURATION;
    this.nightBlend = wantNight
      ? Math.min(1, this.nightBlend + step)
      : Math.max(0, this.nightBlend - step);

    // Smoothstep easing
    const b = this.nightBlend;
    const nightFactor = b * b * (3 - 2 * b);
    this.nightFactor = nightFactor;

    // Determine phase
    if (nightFactor > 0.95) {
      this.timeOfDay = { phase: 'NIGHT', transition: 1 };
    } else if (nightFactor < 0.05) {
      this.timeOfDay = { phase: 'DAY', transition: 0 };
    } else {
      this.timeOfDay = { phase: 'SUNSET', transition: nightFactor };
    }

    // ── Palette interpolation ──
    let paletteChanged = false;
    if (nightFactor !== this.prevNightFactor) {
      this.palette = lerpPalette(DAY_PALETTE, NIGHT_PALETTE, nightFactor);
      this.prevNightFactor = nightFactor;
      paletteChanged = true;
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

// ════════════════════════════════════════════════════════════════════════════
// config.ts — Single source of truth for ALL tunable constants.
// Units: virtual pixels and seconds. Never frames, never CSS pixels.
// ════════════════════════════════════════════════════════════════════════════

export const VIRTUAL = {
  WIDTH: 640,
  HEIGHT: 240,
  GROUND_Y: 196,
} as const;

export const VIEWPORT = {
  /** In portrait, show a narrower slice of the world so 1 virtual px maps to
   *  at least this many CSS px (bigger sprites on phones). */
  PORTRAIT_MIN_SCALE: 0.85,
  /** Never crop the visible world narrower than this (virtual px) */
  MIN_VISIBLE_WIDTH: 400,
} as const;

export const PHYSICS = {
  GRAVITY: 2600,
  JUMP_VELOCITY: -600,
  HOLD_GRAVITY_SCALE: 0.55,
  MAX_HOLD_TIME: 0.14,
  MAX_FALL_SPEED: 1800,
  JUMP_BUFFER: 0.10,
  COYOTE_TIME: 0.06,
} as const;

export const SPEED = {
  INITIAL: 260,
  MAX: 680,
  ACCEL: 4.2,
  USE_EXPONENTIAL: true,
  EXP_K: 0.026,
} as const;

export const SPAWN = {
  MIN_GAP_PX: 190,
  MAX_GAP_PX: 520,
  GAP_SPEED_FACTOR: 0.55,
  CLUSTER_CHANCE: 0.18,
  CLUSTER_MIN_SCORE: 400,
} as const;

export const SCORE_CONFIG = {
  UNITS_PER_PX: 0.025,
  MILESTONE_EVERY: 100,
  DIGITS: 6,
} as const;

export const THEME_THRESHOLDS = {
  PRESENT: 500,
  FUTURE: 1500,
  NIGHT_START: 700,
  CYCLE_LENGTH: 1400,
  /** Seconds for the day ⇄ night crossfade (backdrop + palette) */
  TRANSITION_DURATION: 0.6,
} as const;

/** After the first nightfall the run tightens up: faster cap, tighter gaps,
 *  more clusters and flyers. Applies for the rest of the run (doesn't ease
 *  back when day returns). */
export const HARD_MODE = {
  /** Score at which hard mode kicks in — same as the first night */
  START_SCORE: THEME_THRESHOLDS.NIGHT_START,
  /** Extra px/s added on top of the normal speed curve */
  SPEED_BONUS: 80,
  /** Seconds to blend the speed bonus in (no sudden jerk) */
  RAMP_SECONDS: 4,
  GAP_SPEED_FACTOR: 0.42,
  CLUSTER_CHANCE: 0.28,
  FLYER_CHANCE: 0.35,
} as const;

export const PLAYER_CONFIG = {
  SPRITE_SIZE: 32,
  X: 72,
  HITBOX_INSET: 5,
  ROLL_FRAMES: 8,
  ROLL_PX_PER_FRAME: 14,
} as const;

export const AUDIO_CONFIG = {
  MASTER_GAIN: 0.22,
  DEFAULT_MUTED: false,
} as const;

export const LEADERBOARD_CONFIG = {
  TOP_N: 10,
  NAME_MAX_LEN: 12,
  REFRESH_MS: 20000,
} as const;

export const LOOP = {
  FIXED_DT: 1 / 120,
  MAX_FRAME_DT: 0.25,
  MAX_STEPS_PER_FRAME: 8,
} as const;

/** Jump is the only verb, so every obstacle must be clearable by a jump:
 *  ground types stand on GROUND_Y, flyers hover low enough that a grounded
 *  wheel (hitbox top 27px up) always hits them. Nothing hangs from the sky. */
export const OBSTACLE_TYPES = {
  STONE_SMALL:    { width: 16, height: 20,  minScore: 0,    isFlyer: false },
  STONE_TALL:     { width: 18, height: 34,  minScore: 0,    isFlyer: false },
  PILLAR_BROKEN:  { width: 22, height: 30,  minScore: 150,  isFlyer: false },
  THORN_CLUSTER:  { width: 30, height: 24,  minScore: 350,  isFlyer: false },
  TIME_BIRD:      { width: 24, height: 16,  minScore: 600,  isFlyer: true  },
  /** Tall spire: a tap jump barely clears it, a held jump is comfortable */
  OBELISK:        { width: 12, height: 60,  minScore: 800,  isFlyer: false },
} as const;

export type ObstacleTypeName = keyof typeof OBSTACLE_TYPES;

/** Flying obstacle altitude constants (px above GROUND_Y for the *bottom* of
 *  the sprite). Both are below the grounded hitbox top, so a bird is always
 *  jumped, never walked under. */
export const FLYERS = {
  /** Skims the ground: reads like a wide, short obstacle */
  LOW_Y:  6,
  /** Wing height: still hits a grounded wheel, needs a slightly taller jump */
  HIGH_Y: 20,
  /** Score at which flyers start appearing */
  MIN_SCORE: 600,
  /** Chance a spawn slot becomes a flyer (when eligible) */
  FLYER_CHANCE: 0.25,
} as const;

// ── Sanity checks (dev only) ──────────────────────────────────────────────

export function assertConfigSanity(): void {
  if (import.meta.env.PROD) return;

  // Compute maximum jump arc length at max speed
  const v0 = -PHYSICS.JUMP_VELOCITY; // positive upward speed
  // Time to apex with hold: v0 / (g * holdScale) but capped by MAX_HOLD_TIME
  const holdTime = Math.min(PHYSICS.MAX_HOLD_TIME, v0 / (PHYSICS.GRAVITY * PHYSICS.HOLD_GRAVITY_SCALE));
  const vAfterHold = v0 - PHYSICS.GRAVITY * PHYSICS.HOLD_GRAVITY_SCALE * holdTime;
  const timeAfterHold = vAfterHold / PHYSICS.GRAVITY;
  const totalRiseTime = holdTime + timeAfterHold;
  // Total airtime ≈ 2x rise time (symmetric enough for this check)
  const totalAirTime = totalRiseTime * 2;
  const jumpArcLength = SPEED.MAX * totalAirTime;

  // Widest obstacle
  let maxObstacleWidth = 0;
  for (const t of Object.values(OBSTACLE_TYPES)) {
    if (t.width > maxObstacleWidth) maxObstacleWidth = t.width;
  }

  const margin = 24;
  const requiredClearance = maxObstacleWidth + margin;

  console.assert(
    jumpArcLength > requiredClearance,
    `[CONFIG] Jump arc (${jumpArcLength.toFixed(0)}px) must exceed widest obstacle + margin (${requiredClearance}px)`
  );

  console.assert(
    SPAWN.MIN_GAP_PX > requiredClearance,
    `[CONFIG] MIN_GAP_PX (${SPAWN.MIN_GAP_PX}) must exceed widest obstacle + margin (${requiredClearance})`
  );

  console.log('[CONFIG] Sanity checks passed ✓');
  console.log(`  Jump arc at max speed: ${jumpArcLength.toFixed(0)}px`);
  console.log(`  Total airtime: ${(totalAirTime * 1000).toFixed(0)}ms`);
  console.log(`  Widest obstacle + margin: ${requiredClearance}px`);
}
